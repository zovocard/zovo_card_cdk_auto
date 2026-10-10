// Package cardplatform 封装卡台 Open API + 公开 CDK 兑换接口。
// 文档：docs/zovocard-cdk-zh.md、docs/zovocard-openapi-zh.md
package cardplatform

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/tuzi/cdk-recharge-system/internal/db"
)

const defaultBase = "https://zovocard.com"

// Config 从 site_settings（优先）与环境变量读取。
type Config struct {
	// SiteBase 如 https://zovocard.com（不含 /openapi）
	SiteBase string
	// APIKey sk_...
	APIKey string
}

func LoadConfig() Config {
	base, _ := db.GetSetting("card_api_base")
	key, _ := db.GetSetting("card_api_key")
	if strings.TrimSpace(base) == "" {
		base = os.Getenv("CARD_API_BASE")
	}
	if strings.TrimSpace(key) == "" {
		key = os.Getenv("CARD_API_KEY")
	}
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	// 兼容用户填了 .../openapi/v1
	base = strings.TrimSuffix(base, "/openapi/v1")
	base = strings.TrimSuffix(base, "/openapi")
	if base == "" {
		base = defaultBase
	}
	return Config{SiteBase: base, APIKey: strings.TrimSpace(key)}
}

func (c Config) OpenAPIBase() string {
	return c.SiteBase + "/openapi/v1"
}

func (c Config) PublicCDKBase() string {
	return c.SiteBase + "/api/v1/cdk"
}

type Client struct {
	cfg    Config
	client *http.Client
}

const (
	defaultHTTPTimeout = 45 * time.Second
	issueHTTPTimeout   = 180 * time.Second
	// MaxIssueCount 与卡台 GPTDirectCDKBatchMax 对齐。
	MaxIssueCount = 200
)

func New(cfg Config) *Client {
	return &Client{
		cfg: cfg,
		client: &http.Client{
			Timeout: defaultHTTPTimeout,
		},
	}
}

func NewFromSettings() *Client {
	return New(LoadConfig())
}

// ---- Open API envelope ----

type envelope struct {
	Code  int             `json:"code"`
	Msg   string          `json:"msg"`
	Data  json.RawMessage `json:"data"`
	Error string          `json:"error_code"`
}

// APIError 业务/HTTP 错误
type APIError struct {
	HTTPStatus int
	Code       int
	Msg        string
	ErrorCode  string
}

func (e *APIError) Error() string {
	if e.ErrorCode != "" {
		return fmt.Sprintf("cardplatform: http=%d code=%d err=%s msg=%s", e.HTTPStatus, e.Code, e.ErrorCode, e.Msg)
	}
	return fmt.Sprintf("cardplatform: http=%d code=%d msg=%s", e.HTTPStatus, e.Code, e.Msg)
}

func (c *Client) doOpenAPI(ctx context.Context, method, path string, body any, idempotencyKey string) (json.RawMessage, error) {
	return c.doOpenAPIWithClient(ctx, c.client, method, path, body, idempotencyKey)
}

func (c *Client) doOpenAPIWithClient(ctx context.Context, httpc *http.Client, method, path string, body any, idempotencyKey string) (json.RawMessage, error) {
	if c.cfg.APIKey == "" {
		return nil, &APIError{HTTPStatus: 401, Msg: "card_api_key not configured"}
	}
	if httpc == nil {
		httpc = c.client
	}
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		rdr = bytes.NewReader(b)
	}
	u := c.cfg.OpenAPIBase() + path
	req, err := http.NewRequestWithContext(ctx, method, u, rdr)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-API-Key", c.cfg.APIKey)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if idempotencyKey != "" {
		req.Header.Set("Idempotency-Key", idempotencyKey)
	}
	resp, err := httpc.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	var env envelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return nil, &APIError{HTTPStatus: resp.StatusCode, Msg: "invalid json from card platform: " + truncate(string(raw), 200)}
	}
	// Open API：成功 code=0（HTTP 可能 200/202）；失败 code!=0 或 HTTP 4xx/5xx
	if resp.StatusCode == 401 || env.Code == 401 {
		return nil, &APIError{HTTPStatus: 401, Code: env.Code, Msg: nonEmpty(env.Msg, "unauthorized"), ErrorCode: env.Error}
	}
	if env.Code != 0 {
		st := resp.StatusCode
		if st < 400 {
			st = http.StatusBadRequest
		}
		return nil, &APIError{HTTPStatus: st, Code: env.Code, Msg: nonEmpty(env.Msg, "business error"), ErrorCode: env.Error}
	}
	if resp.StatusCode >= 400 {
		return nil, &APIError{HTTPStatus: resp.StatusCode, Code: env.Code, Msg: nonEmpty(env.Msg, resp.Status), ErrorCode: env.Error}
	}
	return env.Data, nil
}

func nonEmpty(s, fallback string) string {
	if strings.TrimSpace(s) == "" {
		return fallback
	}
	return s
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

// PlanInfo 套餐实时配置（服务费 + 参考区间）
type PlanInfo struct {
	Key                 string `json:"key"`
	Label               string `json:"label"`
	Currency            string `json:"currency"`
	Enabled             bool   `json:"enabled"`
	ServiceFeeUsdMinor  int64  `json:"serviceFeeUsdMinor"`
	ExpectedAmountMinor int64  `json:"expectedAmountMinor,omitempty"`
	MinAmountMinor      int64  `json:"minAmountMinor,omitempty"`
	MaxAmountMinor      int64  `json:"maxAmountMinor,omitempty"`
}

// PlanRegistryItem 卡台档位注册表的元信息（展示顺序/文案/性质）。
// ★代理侧不要再维护档位清单★——卡台后台新增的档位会自动出现在这里。
type PlanRegistryItem struct {
	Key                        string `json:"key"`
	Label                      string `json:"label"`
	Flow                       string `json:"flow"`
	Tier                       int    `json:"tier"`
	SortOrder                  int    `json:"sort_order"`
	IsCredit                   bool   `json:"is_credit"`
	RequiresActiveSubscription bool   `json:"requires_active_subscription"`
	// 上游实际付款价（点数是 PHP 计价，不是美元）。
	// ★漏接这两个字段的代价★：点数档在界面上只剩服务费 $0.10，
	// 代理看不到「这张码兑换时要垫 ₱565」，把点数当成一美元不到的东西发。
	CheckoutCurrency    string `json:"checkout_currency"`
	CheckoutAmountMinor int64  `json:"checkout_amount_minor"`
}

// PaymentRegion 卡台支持的付款地区。发码时可以指定，指定了兑换就按这个区付款。
type PaymentRegion struct {
	Country  string `json:"country"`
	Currency string `json:"currency"`
}

type PlansResponse struct {
	Version  int64               `json:"version"`
	Plans    map[string]PlanInfo `json:"plans"`
	Registry []PlanRegistryItem  `json:"registry,omitempty"`
	// PaymentRegions 卡台下发的地区清单。★本站不要自己写一份★：
	// 写死的那份和卡台 NormalizeGPTDirectRegion 的表迟早不一致，而不一致时
	// 两边都不报错——多出来的地区发码被拒，少了的地区卡台支持了却选不到。
	// 老版本卡台没有这个字段，缺失即为空，界面上就只剩「默认(PH)」，行为不变。
	PaymentRegions []PaymentRegion `json:"payment_regions,omitempty"`
}

// GetPlans GET /gpt-direct/plans — 实时服务费与套餐开关
// 卡台返回 PaymentConfig：version + plans[key].serviceFeeUsdMinor
func (c *Client) GetPlans(ctx context.Context, products ...string) (*PlansResponse, error) {
	product := "gpt"
	if len(products) > 0 && (products[0] == "x" || products[0] == "grok") {
		product = products[0]
	}
	path := "/gpt-direct/plans"
	if product != "gpt" {
		path += "?product=" + product
	}
	data, err := c.doOpenAPI(ctx, http.MethodGet, path, nil, "")
	if err != nil {
		return nil, err
	}
	// 宽松解析：兼容 camelCase / snake_case
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	out := &PlansResponse{Plans: map[string]PlanInfo{}}
	if v, ok := raw["version"]; ok {
		var ver int64
		_ = json.Unmarshal(v, &ver)
		out.Version = ver
	}
	// 档位注册表（展示顺序/文案/性质）——卡台后台新增的档位会自动出现在这里，
	// 代理侧不必再维护一份档位清单。老版本卡台没有这个字段，缺失即为空，不影响。
	if reg, has := raw["registry"]; has {
		var items []PlanRegistryItem
		if err := json.Unmarshal(reg, &items); err == nil {
			out.Registry = items
		}
	}
	// 付款地区清单，同样以卡台下发为准。解析失败/字段缺失都当空，
	// 界面回落到只有「默认(PH)」——那正是本功能上线前的行为，安全。
	if regions, has := raw["payment_regions"]; has {
		var items []PaymentRegion
		if err := json.Unmarshal(regions, &items); err == nil {
			out.PaymentRegions = items
		}
	}
	plansRaw, ok := raw["plans"]
	if !ok {
		return out, nil
	}
	var plansMap map[string]map[string]interface{}
	if err := json.Unmarshal(plansRaw, &plansMap); err != nil {
		// 回退标准结构
		var std PlansResponse
		if err2 := json.Unmarshal(data, &std); err2 != nil {
			return nil, err
		}
		return &std, nil
	}
	for k, m := range plansMap {
		p := PlanInfo{Key: k, Enabled: true}
		if s, _ := m["key"].(string); s != "" {
			p.Key = s
		}
		if s, _ := m["label"].(string); s != "" {
			p.Label = s
		}
		if s, _ := m["currency"].(string); s != "" {
			p.Currency = s
		}
		if b, ok := m["enabled"].(bool); ok {
			p.Enabled = b
		}
		p.ServiceFeeUsdMinor = jsonInt64(m, "serviceFeeUsdMinor", "service_fee_usd_minor", "serviceFeeUSDMinor")
		p.ExpectedAmountMinor = jsonInt64(m, "expectedAmountMinor", "expected_amount_minor")
		p.MinAmountMinor = jsonInt64(m, "minAmountMinor", "min_amount_minor")
		p.MaxAmountMinor = jsonInt64(m, "maxAmountMinor", "max_amount_minor")
		out.Plans[k] = p
	}
	if product == "x" {
		all := out.Plans
		out.Plans = map[string]PlanInfo{}
		registry := []PlanRegistryItem{}
		for _, entry := range out.Registry {
			if info, ok := all["x_"+entry.Key]; ok && IsXPremiumPlan(entry.Key) {
				info.Key = entry.Key
				out.Plans[entry.Key] = info
				registry = append(registry, entry)
			}
		}
		out.Registry = registry
		regions := []PaymentRegion{}
		for _, r := range out.PaymentRegions {
			if country, err := XPaymentCountry(r.Country); err == nil && country == r.Country {
				regions = append(regions, r)
			}
		}
		if len(regions) == 0 {
			regions = []PaymentRegion{{Country: "JP", Currency: "JPY"}}
		}
		out.PaymentRegions = regions
	}
	if product == "grok" {
		// 与 X 同构：定价表键是 grok_monthly，注册表键是裸 monthly。本站统一用裸键。
		all := out.Plans
		out.Plans = map[string]PlanInfo{}
		registry := []PlanRegistryItem{}
		for _, entry := range out.Registry {
			if info, ok := all["grok_"+entry.Key]; ok && IsGrokPlan(entry.Key) {
				info.Key = entry.Key
				out.Plans[entry.Key] = info
				registry = append(registry, entry)
			}
		}
		out.Registry = registry
		// Grok 美元固定价：卡台兑换时一律按 US/USD 收单，别的地区选了也不生效。
		out.PaymentRegions = []PaymentRegion{{Country: "US", Currency: "USD"}}
	}
	return out, nil
}

func jsonInt64(m map[string]interface{}, keys ...string) int64 {
	for _, k := range keys {
		v, ok := m[k]
		if !ok || v == nil {
			continue
		}
		switch t := v.(type) {
		case float64:
			return int64(t)
		case json.Number:
			n, _ := t.Int64()
			return n
		case string:
			var n int64
			fmt.Sscanf(t, "%d", &n)
			return n
		}
	}
	return 0
}

type BalanceResponse struct {
	Balance              json.Number `json:"balance"`
	SpendableBalance     json.Number `json:"spendable_balance"`
	AccountReserveAmount json.Number `json:"account_reserve_amount"`
}

func (c *Client) GetBalance(ctx context.Context) (*BalanceResponse, error) {
	data, err := c.doOpenAPI(ctx, http.MethodGet, "/balance", nil, "")
	if err != nil {
		return nil, err
	}
	var out BalanceResponse
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

type IssueCDKRequest struct {
	Plan             string `json:"plan"`
	Count            int    `json:"count"`
	FundingConfirmed bool   `json:"funding_confirmed"`
	// 兑换选卡偏好：写入卡台 CDK，兑换时优先用该产品/渠道
	PreferredIssuer      string `json:"preferred_issuer,omitempty"`
	PreferredSegmentType string `json:"preferred_segment_type,omitempty"`
	PreferredSegmentKey  string `json:"preferred_segment_key,omitempty"`
	// PaymentCountry 这批码兑换时用哪个地区付款。空 = 菲律宾（存量行为）。
	//
	// ★与 preferred_* 不是一回事★：那三个只是购码快照、兑换不读；
	// 这个兑换时真的会读——地区在卡台的兑换预检那一步就定死了。
	//
	// ★只传国家，不传币种★：币种由卡台按它的唯一真相源补。本站猜一个的话，
	// 猜错会被卡台判成「付款地区与币种不匹配」，而那句报错完全指不到
	// 「代理站把 CLP 写成了 CLF」这个真因。
	PaymentCountry string `json:"payment_country,omitempty"`
}

// IssueCardPref 发码时的选卡偏好。
type IssueCardPref struct {
	Issuer      string
	SegmentType string
	SegmentKey  string
	// PaymentCountry 付款地区（国家码）。空 = 菲律宾。
	PaymentCountry string
}

type IssuedCDK struct {
	ID             int64  `json:"id"`
	Code           string `json:"code"`
	Plan           string `json:"plan"`
	CodePrefix     string `json:"code_prefix"`
	FeeAmountMinor int64  `json:"fee_amount_minor"`
	PaymentCountry string `json:"payment_country"`
}

type IssueCDKResult struct {
	Requested int         `json:"requested"`
	Issued    []IssuedCDK `json:"issued"`
}

// DisableCDK POST /gpt-direct/cdks/:id/disable — 禁用未使用 CDK。
func (c *Client) DisableCDK(ctx context.Context, id int64) error {
	if id <= 0 {
		return fmt.Errorf("invalid cdk id")
	}
	path := fmt.Sprintf("/gpt-direct/cdks/%d/disable", id)
	_, err := c.doOpenAPI(ctx, http.MethodPost, path, map[string]any{}, "")
	return err
}

// EnableCDK POST /gpt-direct/cdks/:id/enable — 解除禁用。
func (c *Client) EnableCDK(ctx context.Context, id int64) error {
	if id <= 0 {
		return fmt.Errorf("invalid cdk id")
	}
	path := fmt.Sprintf("/gpt-direct/cdks/%d/enable", id)
	_, err := c.doOpenAPI(ctx, http.MethodPost, path, map[string]any{}, "")
	return err
}

// BatchDisableCDKs POST /gpt-direct/cdks/batch-disable — 批量禁用。
type BatchDisableCDKResult struct {
	Disabled      []int64          `json:"disabled"`
	Failed        []map[string]any `json:"failed"`
	DisabledCount int              `json:"disabled_count"`
	FailedCount   int              `json:"failed_count"`
}

// BatchEnableCDKResult 批量解除禁用结果。
type BatchEnableCDKResult struct {
	Enabled      []int64          `json:"enabled"`
	Failed       []map[string]any `json:"failed"`
	EnabledCount int              `json:"enabled_count"`
	FailedCount  int              `json:"failed_count"`
}

func parseIDListResult(data json.RawMessage, okKey, countKey string) (ids []int64, failed []map[string]any, okN, failN int, err error) {
	var loose map[string]any
	if err = json.Unmarshal(data, &loose); err != nil {
		return
	}
	okN = anyToInt(loose[countKey])
	failN = anyToInt(loose["failed_count"])
	if arr, ok := loose[okKey].([]any); ok {
		for _, v := range arr {
			ids = append(ids, int64(anyToInt(v)))
		}
	}
	if arr, ok := loose["failed"].([]any); ok {
		for _, v := range arr {
			if m, ok := v.(map[string]any); ok {
				failed = append(failed, m)
			}
		}
	}
	return
}

func (c *Client) BatchDisableCDKs(ctx context.Context, ids []int64) (*BatchDisableCDKResult, error) {
	if len(ids) == 0 {
		return &BatchDisableCDKResult{}, nil
	}
	data, err := c.doOpenAPI(ctx, http.MethodPost, "/gpt-direct/cdks/batch-disable", map[string]any{"ids": ids}, "")
	if err != nil {
		return nil, err
	}
	idsOK, failed, okN, failN, err := parseIDListResult(data, "disabled", "disabled_count")
	if err != nil {
		return nil, err
	}
	return &BatchDisableCDKResult{Disabled: idsOK, Failed: failed, DisabledCount: okN, FailedCount: failN}, nil
}

func (c *Client) BatchEnableCDKs(ctx context.Context, ids []int64) (*BatchEnableCDKResult, error) {
	if len(ids) == 0 {
		return &BatchEnableCDKResult{}, nil
	}
	data, err := c.doOpenAPI(ctx, http.MethodPost, "/gpt-direct/cdks/batch-enable", map[string]any{"ids": ids}, "")
	if err != nil {
		return nil, err
	}
	idsOK, failed, okN, failN, err := parseIDListResult(data, "enabled", "enabled_count")
	if err != nil {
		return nil, err
	}
	return &BatchEnableCDKResult{Enabled: idsOK, Failed: failed, EnabledCount: okN, FailedCount: failN}, nil
}

// IssueCDKs POST /gpt-direct/cdks
func (c *Client) IssueCDKs(ctx context.Context, plan string, count int, idem string, pref ...IssueCardPref) (*IssueCDKResult, error) {
	if count < 1 {
		count = 1
	}
	if count > MaxIssueCount {
		return nil, fmt.Errorf("count max %d", MaxIssueCount)
	}
	body := IssueCDKRequest{Plan: plan, Count: count, FundingConfirmed: true}
	if len(pref) > 0 {
		body.PreferredIssuer = strings.TrimSpace(pref[0].Issuer)
		body.PreferredSegmentType = strings.TrimSpace(pref[0].SegmentType)
		body.PreferredSegmentKey = strings.TrimSpace(pref[0].SegmentKey)
		body.PaymentCountry = strings.ToUpper(strings.TrimSpace(pref[0].PaymentCountry))
		if body.PreferredSegmentKey != "" && body.PreferredSegmentType == "" {
			body.PreferredSegmentType = "product"
		}
	}
	issueClient := &http.Client{Timeout: issueHTTPTimeout, Transport: c.client.Transport}
	data, err := c.doOpenAPIWithClient(ctx, issueClient, http.MethodPost, "/gpt-direct/cdks", body, idem)
	if err != nil {
		return nil, err
	}
	var out IssueCDKResult
	if err := json.Unmarshal(data, &out); err != nil {
		// 有的实现 data 直接是 issued 数组包一层
		var alt struct {
			Requested int         `json:"requested"`
			Issued    []IssuedCDK `json:"issued"`
		}
		if err2 := json.Unmarshal(data, &alt); err2 != nil {
			return nil, err
		}
		out = IssueCDKResult(alt)
	}
	return &out, nil
}

type CDKListItem struct {
	ID             int64  `json:"id"`
	Plan           string `json:"plan"`
	Code           string `json:"code"`
	FullCode       string `json:"full_code"`
	CodePrefix     string `json:"code_prefix"`
	Status         string `json:"status"`
	PaymentCountry string `json:"payment_country"`
	FeeAmountMinor int64  `json:"fee_amount_minor"`
	CreatedAt      string `json:"created_at"`
}

func (it CDKListItem) FullCodeText() string {
	for _, s := range []string{it.FullCode, it.Code} {
		s = strings.TrimSpace(s)
		if len(s) >= 20 && strings.Contains(s, "-") {
			return s
		}
	}
	return ""
}

type CDKListResult struct {
	List  []CDKListItem `json:"list"`
	Total int           `json:"total"`
}

// CDKListQuery 卡台 Open API 列 CDK 筛选。
type CDKListQuery struct {
	Page     int
	PageSize int
	Status   string
	Plan     string
	Query    string // q：id / code_prefix 模糊
}

func (c *Client) ListCDKs(ctx context.Context, page, pageSize int) (*CDKListResult, error) {
	return c.ListCDKsQuery(ctx, CDKListQuery{Page: page, PageSize: pageSize})
}

func (c *Client) ListCDKsQuery(ctx context.Context, q CDKListQuery) (*CDKListResult, error) {
	page, pageSize := q.Page, q.PageSize
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 20
	}
	vals := url.Values{}
	vals.Set("page", strconv.Itoa(page))
	vals.Set("page_size", strconv.Itoa(pageSize))
	if s := strings.TrimSpace(q.Status); s != "" {
		vals.Set("status", s)
	}
	if p := strings.TrimSpace(q.Plan); p != "" {
		vals.Set("plan", p)
	}
	if raw := strings.TrimSpace(q.Query); raw != "" {
		vals.Set("q", raw)
	}
	path := "/gpt-direct/cdks?" + vals.Encode()
	data, err := c.doOpenAPI(ctx, http.MethodGet, path, nil, "")
	if err != nil {
		return nil, err
	}
	var out CDKListResult
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, err
	}
	// 兼容 total 为 float64 / string 的松散 JSON
	if out.Total == 0 && len(out.List) > 0 {
		var loose map[string]any
		if json.Unmarshal(data, &loose) == nil {
			out.Total = anyToInt(loose["total"])
		}
	}
	return &out, nil
}

// SyncUpstreamResult 从卡台列表拉回完整码并写入本站 SQLite。
type SyncUpstreamResult struct {
	Imported                int         `json:"imported"`
	Updated                 int         `json:"updated"`
	PrefixOnly              int         `json:"prefix_only"`
	Pages                   int         `json:"pages"`
	Scanned                 int         `json:"scanned"`
	UpstreamTotal           int         `json:"upstream_total"`
	Codes                   []IssuedCDK `json:"codes,omitempty"`
	NeedCardplatformUpgrade bool        `json:"need_cardplatform_upgrade"`
}

// SyncUpstreamFullCodes 翻页拉取卡台 CDK，把带完整 code 的写入本站。
func (c *Client) SyncUpstreamFullCodes(ctx context.Context, status, plan string, maxPages int) (*SyncUpstreamResult, error) {
	if maxPages <= 0 || maxPages > 50 {
		maxPages = 50
	}
	out := &SyncUpstreamResult{Codes: make([]IssuedCDK, 0)}
	for page := 1; page <= maxPages; page++ {
		res, err := c.ListCDKsQuery(ctx, CDKListQuery{Page: page, PageSize: 100, Status: status, Plan: plan})
		if err != nil {
			return out, err
		}
		if res == nil {
			break
		}
		out.Pages++
		out.UpstreamTotal = res.Total
		if len(res.List) == 0 {
			break
		}
		for _, it := range res.List {
			out.Scanned++
			code := it.FullCodeText()
			if code == "" {
				_ = db.UpdateCardplatformCDKRegion(it.ID, it.PaymentCountry)
				out.PrefixOnly++
				continue
			}
			prefix := strings.TrimSpace(it.CodePrefix)
			if prefix == "" && len(code) >= 14 {
				prefix = code[:14]
			}
			_, existed := db.LookupCardplatformCDKCode(it.ID, prefix)
			if err := db.SaveCardplatformCDKCodeWithStatus(it.ID, code, prefix, it.Plan, it.FeeAmountMinor, it.Status, it.PaymentCountry); err != nil {
				continue
			}
			if existed {
				continue
			}
			out.Imported++
			out.Codes = append(out.Codes, IssuedCDK{
				ID: it.ID, Code: code, Plan: it.Plan,
				CodePrefix: prefix, FeeAmountMinor: it.FeeAmountMinor,
				PaymentCountry: it.PaymentCountry,
			})
		}
		if page*100 >= res.Total {
			break
		}
	}
	out.Updated = out.Imported
	out.NeedCardplatformUpgrade = out.Scanned > 0 && out.Imported == 0 && out.PrefixOnly == out.Scanned
	return out, nil
}

// CDKStatusSummary 卡台 CDK 按状态汇总（翻页聚合）。
type CDKStatusSummary struct {
	Total    int            `json:"total"`
	ByStatus map[string]int `json:"by_status"`
	Partial  bool           `json:"partial"` // 超过扫描上限时为 true
	Scanned  int            `json:"scanned"`
}

// SummarizeCDKs 分页拉取本 API 作用域下 CDK，汇总 total 与各 status。
// maxPages 限制最大扫描页数（每页 100）；0 默认 50（最多约 5000 张）。
func (c *Client) SummarizeCDKs(ctx context.Context, maxPages int) (*CDKStatusSummary, error) {
	if maxPages <= 0 {
		maxPages = 50
	}
	const pageSize = 100
	sum := &CDKStatusSummary{ByStatus: map[string]int{}}
	for page := 1; page <= maxPages; page++ {
		res, err := c.ListCDKs(ctx, page, pageSize)
		if err != nil {
			return nil, err
		}
		if page == 1 {
			sum.Total = res.Total
		}
		if len(res.List) == 0 {
			break
		}
		for _, item := range res.List {
			st := strings.TrimSpace(item.Status)
			if st == "" {
				st = "unknown"
			}
			sum.ByStatus[st]++
			sum.Scanned++
		}
		if sum.Scanned >= sum.Total || len(res.List) < pageSize {
			break
		}
		if page == maxPages && sum.Scanned < sum.Total {
			sum.Partial = true
		}
	}
	// 若卡台 total 为 0 但扫到了条目，用扫描数兜底
	if sum.Total == 0 && sum.Scanned > 0 {
		sum.Total = sum.Scanned
	}
	return sum, nil
}

// ListCDKOrdersTotal 只取 CDK 订单 total（第一页）。
func (c *Client) ListCDKOrdersTotal(ctx context.Context) (int, error) {
	raw, err := c.ListCDKOrders(ctx, 1, 1)
	if err != nil {
		return 0, err
	}
	if len(raw) == 0 {
		return 0, nil
	}
	var loose map[string]any
	if err := json.Unmarshal(raw, &loose); err != nil {
		return 0, err
	}
	return anyToInt(loose["total"]), nil
}

func anyToInt(v any) int {
	switch t := v.(type) {
	case float64:
		return int(t)
	case int:
		return t
	case int64:
		return int(t)
	case json.Number:
		n, _ := t.Int64()
		return int(n)
	case string:
		var n int
		fmt.Sscanf(strings.TrimSpace(t), "%d", &n)
		return n
	default:
		return 0
	}
}

// CDKOrderListQuery 对账列表查询参数（转发卡台 OpenAPI）。
type CDKOrderListQuery struct {
	Page     int
	PageSize int
	Status   string // completed / queued / ...
	CDKID    int64
	OrderID  int64
}

// ListCDKOrders GET /gpt-direct/cdk-orders
func (c *Client) ListCDKOrders(ctx context.Context, page, pageSize int) (json.RawMessage, error) {
	return c.ListCDKOrdersQuery(ctx, CDKOrderListQuery{Page: page, PageSize: pageSize})
}

// ListCDKOrdersQuery GET /gpt-direct/cdk-orders?page=&page_size=&status=&cdk_id=&order_id=
func (c *Client) ListCDKOrdersQuery(ctx context.Context, q CDKOrderListQuery) (json.RawMessage, error) {
	page, pageSize := q.Page, q.PageSize
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	v := url.Values{}
	v.Set("page", strconv.Itoa(page))
	v.Set("page_size", strconv.Itoa(pageSize))
	if s := strings.TrimSpace(q.Status); s != "" {
		v.Set("status", strings.ToLower(s))
	}
	if q.CDKID > 0 {
		v.Set("cdk_id", strconv.FormatInt(q.CDKID, 10))
	}
	if q.OrderID > 0 {
		v.Set("order_id", strconv.FormatInt(q.OrderID, 10))
	}
	return c.doOpenAPI(ctx, http.MethodGet, "/gpt-direct/cdk-orders?"+v.Encode(), nil, "")
}

// GetCDKOrder GET /gpt-direct/cdk-orders/:id
func (c *Client) GetCDKOrder(ctx context.Context, id string) (json.RawMessage, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, &APIError{HTTPStatus: 400, Msg: "id required"}
	}
	return c.doOpenAPI(ctx, http.MethodGet, "/gpt-direct/cdk-orders/"+url.PathEscape(id), nil, "")
}

// DeleteCard DELETE /cards/{id} — 永久删卡，卡内余额退回平台余额。
func (c *Client) DeleteCard(ctx context.Context, cardID string) (json.RawMessage, error) {
	cardID = strings.TrimSpace(cardID)
	if cardID == "" {
		return nil, &APIError{HTTPStatus: 400, Msg: "card id required"}
	}
	return c.doOpenAPI(ctx, http.MethodDelete, "/cards/"+url.PathEscape(cardID), nil, "")
}

// FreezeCard POST /cards/freeze — 冻结/解冻名下卡（冻结后卡台自动选卡不再选用 ACTIVE 以外的卡）。
func (c *Client) FreezeCard(ctx context.Context, cardID int64, freeze bool) error {
	if cardID <= 0 {
		return &APIError{HTTPStatus: 400, Msg: "card id required"}
	}
	_, err := c.doOpenAPI(ctx, http.MethodPost, "/cards/freeze", map[string]any{
		"card_id": cardID,
		"freeze":  freeze,
	}, "")
	return err
}

// ---- 公开兑换（无需 API Key）----

func (c *Client) doPublicCDK(ctx context.Context, method, path string, body any, device string) (int, json.RawMessage, error) {
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return 0, nil, err
		}
		rdr = bytes.NewReader(b)
	}
	u := c.cfg.PublicCDKBase() + path
	req, err := http.NewRequestWithContext(ctx, method, u, rdr)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if device != "" {
		req.Header.Set("X-Redemption-Device", device)
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	// 公开接口可能直接返回 JSON 对象，不一定是 code/msg envelope
	return resp.StatusCode, json.RawMessage(raw), nil
}

func (c *Client) Preview(ctx context.Context, code, device string) (int, json.RawMessage, error) {
	return c.doPublicCDK(ctx, http.MethodPost, "/preview", map[string]string{"code": code}, device)
}

func (c *Client) Preflight(ctx context.Context, body any, device string) (int, json.RawMessage, error) {
	return c.doPublicCDK(ctx, http.MethodPost, "/preflight", body, device)
}

func (c *Client) RecoverSubscription(ctx context.Context, body any, device string) (int, json.RawMessage, error) {
	copyClient := *c.client
	copyClient.Timeout = 180 * time.Second
	recoveryClient := &Client{cfg: c.cfg, client: &copyClient}
	return recoveryClient.doPublicCDK(ctx, http.MethodPost, "/recover-subscription", body, device)
}

func (c *Client) Redeem(ctx context.Context, body any, device string) (int, json.RawMessage, error) {
	return c.doPublicCDK(ctx, http.MethodPost, "/redeem", body, device)
}

func (c *Client) Result(ctx context.Context, token, device string) (int, json.RawMessage, error) {
	q := url.Values{}
	q.Set("token", token)
	return c.doPublicCDK(ctx, http.MethodGet, "/result?"+q.Encode(), nil, device)
}

// MinorToUSD 美分 → 美元展示
func MinorToUSD(minor int64) float64 {
	return float64(minor) / 100.0
}

// ProductInfo 卡台产品（/openapi/v1/products 返回条目）
type ProductInfo struct {
	ID          int64    `json:"id"`
	ProductCode string   `json:"product_code"`
	Issuer      string   `json:"issuer"`
	BIN         string   `json:"bin"`
	Network     string   `json:"network"`
	IssuingArea string   `json:"issuing_area"`
	Scene       string   `json:"scene"`
	CardGroup   string   `json:"card_group"`
	Enabled     bool     `json:"enabled"`
	SuspendedAt string   `json:"suspended_at"` // null → ""
	Description string   `json:"description"`
	BinHeads    []string `json:"bin_heads"`
}

// GetProducts GET /openapi/v1/products — 拉取所有可用卡产品列表
func (c *Client) GetProducts(ctx context.Context) ([]ProductInfo, error) {
	data, err := c.doOpenAPI(ctx, http.MethodGet, "/products?page=1&page_size=200", nil, "")
	if err != nil {
		return nil, err
	}
	// data 是 data 字段内容：可能是数组，也可能是 {list:[...],total:N}
	var items []ProductInfo
	if err := json.Unmarshal(data, &items); err == nil {
		return items, nil
	}
	// 尝试 {list: [...]}
	var wrapped struct {
		List  []ProductInfo `json:"list"`
		Total int           `json:"total"`
	}
	if err := json.Unmarshal(data, &wrapped); err != nil {
		return nil, err
	}
	return wrapped.List, nil
}
