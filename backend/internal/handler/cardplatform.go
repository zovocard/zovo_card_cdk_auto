package handler

import (
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tuzi/cdk-recharge-system/internal/cardplatform"
	"github.com/tuzi/cdk-recharge-system/internal/db"
)

// CardPlatformPing GET /api/v1/admin/cardplatform/ping
// 探测卡台是否可达，并返回解析后的 OpenAPI / CDK 路径与出口 IP。
func CardPlatformPing(c *gin.Context) {
	cfg := cardplatform.LoadConfig()
	base := cfg.SiteBase
	if strings.TrimSpace(base) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"ok": false, "error": "card_api_base not configured"})
		return
	}

	client := &http.Client{Timeout: 8 * time.Second}
	candidates := []string{
		cfg.OpenAPIBase() + "/balance", // 若无 key 可能 401，仍说明可达
		base + "/health",
		cfg.PublicCDKBase(),
		base + "/",
	}
	var lastErr string
	var probed string
	var status int
	for _, u := range candidates {
		req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, u, nil)
		if err != nil {
			lastErr = cardplatform.RedactUpstreamDomains(err.Error())
			continue
		}
		req.Header.Set("User-Agent", "cdk-recharge-system/cardplatform-ping")
		if cfg.APIKey != "" && strings.Contains(u, "/openapi/") {
			req.Header.Set("X-API-Key", cfg.APIKey)
		}
		resp, err := client.Do(req)
		if err != nil {
			lastErr = cardplatform.RedactUpstreamDomains(err.Error())
			continue
		}
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		_ = resp.Body.Close()
		// 2xx/3xx/401/403/404/405 都说明主机可达
		if resp.StatusCode > 0 && resp.StatusCode < 500 {
			probed = u
			status = resp.StatusCode
			break
		}
		lastErr = "status " + resp.Status
	}

	egressIP, egressSrc, _ := detectEgressIP(c.Request.Context())
	keyCfg, _ := db.GetSetting("card_api_key")

	if probed == "" {
		c.JSON(http.StatusBadGateway, gin.H{
			"ok":              false,
			"error":           "unreachable",
			"detail":          lastErr,
			"site_base":       cfg.SiteBase,
			"openapi_base":    cfg.OpenAPIBase(),
			"public_cdk_base": cfg.PublicCDKBase(),
			"egress_ip":       egressIP,
			"egress_source":   egressSrc,
		})
		return
	}

	msg := "card platform reachable"
	if status == 401 {
		msg = "主机可达；API Key 无效或未配置（HTTP 401）"
	} else if status == 403 {
		msg = "主机可达；可能 IP 不在白名单（HTTP 403）— 请把下方出口 IP 加入卡台白名单"
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":                 true,
		"message":            msg,
		"probed":             probed,
		"status":             status,
		"api_key_configured": strings.TrimSpace(keyCfg) != "",
		"site_base":          cfg.SiteBase,
		"openapi_base":       cfg.OpenAPIBase(),
		"public_cdk_base":    cfg.PublicCDKBase(),
		"egress_ip":          egressIP,
		"egress_source":      egressSrc,
	})
}
