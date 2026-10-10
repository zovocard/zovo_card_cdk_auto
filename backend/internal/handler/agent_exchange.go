package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tuzi/cdk-recharge-system/internal/cardplatform"
	"github.com/tuzi/cdk-recharge-system/internal/db"
	"golang.org/x/crypto/bcrypt"
)

const agentSwapPasswordKey = "agent_swap_password_hash"

// 简易 IP 限流：每 IP 每小时最多 20 次换码尝试
var (
	swapRateMu   sync.Mutex
	swapRateHits = map[string][]time.Time{}
)

func swapRateAllow(ip string) bool {
	swapRateMu.Lock()
	defer swapRateMu.Unlock()
	now := time.Now()
	cut := now.Add(-time.Hour)
	hits := swapRateHits[ip]
	kept := hits[:0]
	for _, t := range hits {
		if t.After(cut) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= 20 {
		swapRateHits[ip] = kept
		return false
	}
	swapRateHits[ip] = append(kept, now)
	return true
}

func setAgentSwapPassword(plain string) error {
	plain = strings.TrimSpace(plain)
	if plain == "" {
		return db.DeleteSetting(agentSwapPasswordKey)
	}
	if len(plain) < 6 {
		return errPasswordTooShort
	}
	hash, err := db.HashAdminPassword(plain)
	if err != nil {
		return err
	}
	return db.SetSetting(agentSwapPasswordKey, hash)
}

var errPasswordTooShort = &simpleError{"代理换码密码至少 6 位"}

type simpleError struct{ s string }

func (e *simpleError) Error() string { return e.s }

func agentSwapPasswordConfigured() bool {
	v, _ := db.GetSetting(agentSwapPasswordKey)
	return strings.TrimSpace(v) != ""
}

func verifyAgentSwapPassword(plain string) bool {
	stored, _ := db.GetSetting(agentSwapPasswordKey)
	stored = strings.TrimSpace(stored)
	if stored == "" || strings.TrimSpace(plain) == "" {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(stored), []byte(plain)) == nil
}

// orderLooksUnpaid 订单终态失败且无扣款证据。
func orderLooksUnpaid(status, stage string, finalMinor int64, events []map[string]any) bool {
	st := strings.ToLower(strings.TrimSpace(status))
	// 成功/进行中不可换
	switch st {
	case "completed", "success", "paid":
		return false
	case "running", "queued", "dispatching", "pending", "awaiting_card", "funding_pending", "card_open_review":
		return false
	}
	// 允许失败类终态
	okFail := st == "failed_precharge" || st == "declined" || st == "cancelled" || st == "failed"
	if !okFail {
		// 有些上游用 stage 表达失败
		sg := strings.ToLower(stage)
		if strings.Contains(sg, "failed") || strings.Contains(sg, "decline") || strings.Contains(sg, "unpaid") {
			okFail = true
		}
	}
	if !okFail {
		return false
	}
	if finalMinor > 0 {
		return false
	}
	for _, ev := range events {
		pf := strings.ToLower(strAny(ev["payment_fact"]))
		if pf == "true" || pf == "1" || pf == "charged" || pf == "paid" {
			return false
		}
		cat := strings.ToLower(strAny(ev["category"]))
		if cat == "charged" || cat == "payment" {
			// 再看 message
			msg := strings.ToLower(strAny(ev["public_message"]) + " " + strAny(ev["event"]))
			if strings.Contains(msg, "paid") || strings.Contains(msg, "扣款") || strings.Contains(msg, "charged") {
				return false
			}
		}
	}
	return true
}

// PublicAgentCDKExchange POST /api/v1/public/cdk/exchange
// body: { password, code }  校验代理密码后，未扣款失败的 CDK 换一张同套餐新码。
func PublicAgentCDKExchange(c *gin.Context) {
	ip := c.ClientIP()
	if !swapRateAllow(ip) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "请求过于频繁，请稍后再试"})
		return
	}
	if !agentSwapPasswordConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "管理员尚未启用代理换码功能"})
		return
	}
	var req struct {
		Password string `json:"password"`
		Code     string `json:"code"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if !verifyAgentSwapPassword(req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "密码错误"})
		return
	}
	code := strings.TrimSpace(req.Code)
	if code == "" || len(code) < 10 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请输入完整卡密"})
		return
	}
	codeHash := db.HashCDKCode(code)
	if db.AgentCDKAlreadyExchanged(codeHash) {
		c.JSON(http.StatusConflict, gin.H{"error": "该卡密已换过新码，不可重复兑换"})
		return
	}

	upstreamID, plan, prefix, localStatus, ok := db.LookupStoredCDKByCode(code)
	if !ok || upstreamID <= 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "本站未找到该完整卡密（仅支持本站发过的码）"})
		return
	}
	plan = strings.ToLower(strings.TrimSpace(plan))
	if plan == "" {
		plan = "plus"
	}

	cli := cardplatform.NewFromSettings()
	// 查该 CDK 的订单（卡台 OpenAPI）
	raw, err := cli.ListCDKOrdersQuery(c.Request.Context(), cardplatform.CDKOrderListQuery{
		Page: 1, PageSize: 20, CDKID: upstreamID,
	})
	if err != nil {
		writeCardErr(c, err)
		return
	}
	list, total := parseCDKOrderList(raw)
	if total == 0 || len(list) == 0 {
		// 从未进兑换：不允许「白嫖」新码
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "该卡密尚无兑换失败记录，不能换新码",
			"hint":  "仅限充值失败且未扣款的卡密",
		})
		return
	}

	// 取最近一单
	latest := list[0]
	orderID := int64(anyToInt64(latest["order_id"]))
	if orderID == 0 {
		orderID = int64(anyToInt64(latest["id"]))
	}
	status := strings.ToLower(strAny(latest["status"]))
	stage := strings.ToLower(strAny(latest["stage"]))
	finalMinor := anyToInt64(latest["final_amount_minor"])

	// 拉详情看 events 的 payment_fact
	var events []map[string]any
	if orderID > 0 {
		if detailRaw, err := cli.GetCDKOrder(c.Request.Context(), strconv.FormatInt(orderID, 10)); err == nil {
			if evs := extractOrderEvents(detailRaw); len(evs) > 0 {
				events = evs
			}
			// 详情里的 order 覆盖
			if m := extractOrderMap(detailRaw); m != nil {
				if s := strAny(m["status"]); s != "" {
					status = strings.ToLower(s)
				}
				if s := strAny(m["stage"]); s != "" {
					stage = strings.ToLower(s)
				}
				if n := anyToInt64(m["final_amount_minor"]); n > 0 {
					finalMinor = n
				}
			}
		}
	}

	// 任一成功单则拒
	for _, it := range list {
		st := strings.ToLower(strAny(it["status"]))
		if st == "completed" || st == "success" || st == "paid" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "该卡密已有成功充值记录，不能换新码"})
			return
		}
	}

	if !orderLooksUnpaid(status, stage, finalMinor, events) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":        "不符合换码条件（需充值失败且未扣款）",
			"order_status": status,
			"order_stage":  stage,
			"final_amount": finalMinor,
			"local_status": localStatus,
		})
		return
	}

	// ★新码必须与旧码同一付款地区★：补发原来只带套餐，智利/日本等地区码补发出来全成了默认菲律宾区，
	// 用户兑换时按 PHP 走、和原单完全不是一回事（2026-10-10 代理反馈）。地区以本站缓存为准，
	// 老数据没记过地区就去卡台查；两边都拿不到就拒绝补发——宁可让代理找管理员，也不发错区的码。
	country, known := db.LookupStoredCDKRegion(upstreamID)
	if !known {
		country, known = upstreamCDKRegion(c, cli, upstreamID)
	}
	if !known {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "无法确认原卡密的付款地区，暂不能补发，请联系管理员"})
		return
	}
	// 发一张同套餐、同地区的新码（带本站选卡偏好；跳过未启动卡头）
	sitePref, hasSitePref := issuePrefFromSite()
	issuePrefs := agentSwapIssuePrefs(sitePref, hasSitePref, country)

	idem := "agent-swap-" + codeHash[:16] + "-" + strconv.FormatInt(time.Now().UnixNano(), 36)
	var res *cardplatform.IssueCDKResult
	if len(issuePrefs) > 0 {
		res, err = cli.IssueCDKs(c.Request.Context(), plan, 1, idem, issuePrefs[0])
	} else {
		res, err = cli.IssueCDKs(c.Request.Context(), plan, 1, idem)
	}
	if err != nil {
		writeCardErr(c, err)
		return
	}
	if res == nil || len(res.Issued) == 0 || strings.TrimSpace(res.Issued[0].Code) == "" {
		c.JSON(http.StatusBadGateway, gin.H{"error": "发新码失败：卡台未返回完整码"})
		return
	}
	newIt := res.Issued[0]
	newCode := strings.TrimSpace(newIt.Code)
	newPrefix := strings.TrimSpace(newIt.CodePrefix)
	if newPrefix == "" && len(newCode) >= 14 {
		newPrefix = newCode[:14]
	}
	if got := strings.ToUpper(strings.TrimSpace(newIt.PaymentCountry)); got != "" && got != country {
		log.Printf("[agent-exchange] 新码 %d 地区 %s 与旧码 %d 地区 %q 不一致", newIt.ID, got, upstreamID, country)
	}
	_ = db.SaveCardplatformCDKCode(newIt.ID, newCode, newPrefix, plan, newIt.FeeAmountMinor, country)

	// 禁用旧码（防再次兑换）
	if err := cli.DisableCDK(c.Request.Context(), upstreamID); err != nil {
		log.Printf("[agent-exchange] disable old cdk %d failed: %v (new already issued id=%d)", upstreamID, err, newIt.ID)
		// 不回滚新码；记录警告
	} else {
		_ = db.UpdateCardplatformCDKStatus(upstreamID, "disabled")
	}

	_ = db.RecordAgentCDKExchange(codeHash, upstreamID, newIt.ID, prefix, newPrefix, plan, orderID, status, ip)
	db.WriteAudit("agent-swap", "agent_cdk_exchange",
		"old="+strconv.FormatInt(upstreamID, 10)+" new="+strconv.FormatInt(newIt.ID, 10)+" plan="+plan+" region="+country+" order="+strconv.FormatInt(orderID, 10),
		ip)

	c.JSON(http.StatusOK, gin.H{
		"ok":              true,
		"plan":            plan,
		"old_cdk_id":      upstreamID,
		"old_code_prefix": prefix,
		"new_cdk_id":      newIt.ID,
		"new_code":        newCode,
		"new_code_prefix": newPrefix,
		"payment_country": country,
		"order_status":    status,
		"message":         "已换发全新卡密，请妥善保存（仅显示一次）",
	})
}

// agentSwapIssuePrefs 补发的发码偏好：地区与选卡偏好是两件独立的事，
// 没有本站选卡配置时也要把非默认地区带上（与正常发码 PublicIssue 同一规则）。
func agentSwapIssuePrefs(sitePref cardplatform.IssueCardPref, hasSitePref bool, country string) []cardplatform.IssueCardPref {
	country = strings.ToUpper(strings.TrimSpace(country))
	if !hasSitePref && country == "" {
		return nil
	}
	sitePref.PaymentCountry = country
	return []cardplatform.IssueCardPref{sitePref}
}

// upstreamCDKRegion 本站没记过地区的老码，从卡台按 id 查权威地区并回填缓存。
func upstreamCDKRegion(c *gin.Context, cli *cardplatform.Client, upstreamID int64) (string, bool) {
	res, err := cli.ListCDKsQuery(c.Request.Context(), cardplatform.CDKListQuery{Page: 1, PageSize: 50, Query: strconv.FormatInt(upstreamID, 10)})
	if err != nil || res == nil {
		return "", false
	}
	for _, it := range res.List {
		if it.ID == upstreamID {
			country := strings.ToUpper(strings.TrimSpace(it.PaymentCountry))
			_ = db.UpdateCardplatformCDKRegion(upstreamID, country)
			return country, true
		}
	}
	return "", false
}

func parseCDKOrderList(raw json.RawMessage) (list []map[string]any, total int) {
	if len(raw) == 0 {
		return nil, 0
	}
	var envelope map[string]any
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, 0
	}
	// data.list or list
	data := envelope
	if d, ok := envelope["data"].(map[string]any); ok {
		data = d
	}
	total = int(anyToInt64(data["total"]))
	arr, _ := data["list"].([]any)
	for _, v := range arr {
		if m, ok := v.(map[string]any); ok {
			list = append(list, m)
		}
	}
	if total == 0 {
		total = len(list)
	}
	return list, total
}

func extractOrderMap(raw json.RawMessage) map[string]any {
	var envelope map[string]any
	if json.Unmarshal(raw, &envelope) != nil {
		return nil
	}
	if d, ok := envelope["data"].(map[string]any); ok {
		if o, ok := d["order"].(map[string]any); ok {
			return o
		}
		// data itself is order
		if _, ok := d["status"]; ok {
			return d
		}
	}
	if o, ok := envelope["order"].(map[string]any); ok {
		return o
	}
	return nil
}

func extractOrderEvents(raw json.RawMessage) []map[string]any {
	var envelope map[string]any
	if json.Unmarshal(raw, &envelope) != nil {
		return nil
	}
	var arr []any
	if d, ok := envelope["data"].(map[string]any); ok {
		arr, _ = d["events"].([]any)
	}
	if arr == nil {
		arr, _ = envelope["events"].([]any)
	}
	out := make([]map[string]any, 0, len(arr))
	for _, v := range arr {
		if m, ok := v.(map[string]any); ok {
			out = append(out, m)
		}
	}
	return out
}

func anyToInt64(v any) int64 {
	switch t := v.(type) {
	case float64:
		return int64(t)
	case int64:
		return t
	case int:
		return int64(t)
	case json.Number:
		n, _ := t.Int64()
		return n
	case string:
		n, _ := strconv.ParseInt(t, 10, 64)
		return n
	default:
		return 0
	}
}
