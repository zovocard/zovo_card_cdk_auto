package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tuzi/cdk-recharge-system/internal/cardplatform"
	"github.com/tuzi/cdk-recharge-system/internal/db"
)

func accounthubBaseURL() string {
	if u := strings.TrimSpace(os.Getenv("ACCOUNTHUB_BASE_URL")); u != "" {
		return strings.TrimRight(u, "/")
	}
	return "http://localhost:8788"
}

// extractEmailFromSession 从 session JSON 提取 user.email。
func extractEmailFromSession(raw string) string {
	s := strings.TrimSpace(raw)
	if !strings.HasPrefix(s, "{") {
		return ""
	}
	var data map[string]interface{}
	if json.Unmarshal([]byte(s), &data) != nil {
		return ""
	}
	if user, ok := data["user"].(map[string]interface{}); ok {
		if email, ok := user["email"].(string); ok {
			return strings.TrimSpace(email)
		}
	}
	if email, ok := data["email"].(string); ok {
		return strings.TrimSpace(email)
	}
	return ""
}

type acchubInvoiceResp struct {
	InvoiceURL string                   `json:"invoice_url"`
	Invoices   []map[string]interface{} `json:"invoices"`
	Source     string                   `json:"source"`
	Error      string                   `json:"error"`
}

// queryAccounthubInvoices 通过邮箱调 accounthub 获取账单。
func queryAccounthubInvoices(email string) (*acchubInvoiceResp, error) {
	base := accounthubBaseURL()
	u := fmt.Sprintf("%s/gpt/invoices-by-email?email=%s", base, url.QueryEscape(email))
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(u)
	if err != nil {
		return nil, fmt.Errorf("accounthub 请求失败: %v", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != 200 {
		var errResp struct{ Error string `json:"error"` }
		json.Unmarshal(body, &errResp)
		return nil, fmt.Errorf("accounthub %d: %s", resp.StatusCode, errResp.Error)
	}
	var out acchubInvoiceResp
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("accounthub 响应解析失败")
	}
	return &out, nil
}

// SessionBillingCheck POST /api/v1/public/billing/check
// 支持：
//  1. cdk_code — 用兑换时绑定的 session 查账单
//  2. token_input / session — 直接贴 session / accessToken
func SessionBillingCheck(c *gin.Context) {
	var req struct {
		TokenInput string `json:"token_input"`
		Session    string `json:"session"`
		CDKCode    string `json:"cdk_code"`
		Code       string `json:"code"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	raw := strings.TrimSpace(req.TokenInput)
	if raw == "" {
		raw = strings.TrimSpace(req.Session)
	}
	cdk := strings.TrimSpace(req.CDKCode)
	if cdk == "" {
		cdk = strings.TrimSpace(req.Code)
	}

	if raw == "" && cdk != "" {
		sess, err := db.GetSessionByCDK(cdk)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "查询绑定失败"})
			return
		}
		if strings.TrimSpace(sess) == "" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "未找到该卡密绑定的 session。请确认兑换时使用了 session 凭证，或改用直接粘贴 session 查询。",
			})
			return
		}
		raw = sess
	}

	if raw == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请输入卡密，或粘贴 session JSON / accessToken"})
		return
	}

	// 账单查询分流:
	//  1) 配了 ACCOUNTHUB_BASE_URL 的部署(如 gptcdk.ai@208,本机就有 ACC)→ 优先走 ACC
	//     按邮箱查:本地、快、★不依赖卡台★。这是存量部署一直在用、能用的路径。
	//  2) 自托管发卡站(无 ACC)→ 走卡台开放 API subscription-check 服务端代查。
	//     ★为什么不本机直查★:自托管服务器 IP 直连 chatgpt.com 会被 Cloudflare 挡成
	//     401/403,账单永远查不到(工单 #2174);卡台用共享出口代查可避开。
	//  raw 可能是卡密绑定的 session,也可能是用户直接粘贴的 session/accessToken。
	if strings.TrimSpace(os.Getenv("ACCOUNTHUB_BASE_URL")) != "" {
		if email := extractEmailFromSession(raw); email != "" {
			if inv, err := queryAccounthubInvoices(email); err == nil {
				invoices := inv.Invoices
				if invoices == nil && inv.InvoiceURL != "" {
					invoices = []map[string]interface{}{{"hosted_invoice_url": inv.InvoiceURL}}
				}
				if invoices == nil {
					invoices = []map[string]interface{}{}
				}
				c.JSON(http.StatusOK, gin.H{
					"summary":     map[string]interface{}{"email": email},
					"invoices":    invoices,
					"invoice_url": inv.InvoiceURL,
					"auth_source": "accounthub",
				})
				return
			}
			// ACC 配了但没查到(邮箱无账单 / ACC 暂不可用)→ 回退卡台
		}
	}

	res, err := cardplatform.NewFromSettings().CheckSubscription(c.Request.Context(), raw)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": billingErrMessage(err), "auth_source": "cardplatform"})
		return
	}
	invoices := res.Invoices
	if invoices == nil {
		invoices = []map[string]any{}
	}
	c.JSON(http.StatusOK, gin.H{
		"summary":     res.Summary,
		"invoices":    invoices,
		"auth_source": "cardplatform",
	})
}

// billingErrMessage 把卡台返回的业务错误转成对用户友好的提示（token 失效等）。
func billingErrMessage(err error) string {
	var apiErr *cardplatform.APIError
	if errors.As(err, &apiErr) && strings.TrimSpace(apiErr.Msg) != "" {
		return apiErr.Msg
	}
	return "账单查询失败：" + err.Error()
}
