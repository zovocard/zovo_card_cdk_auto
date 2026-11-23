package server

import (
	"context"
	"fmt"
	"log"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/tuzi/cdk-recharge-system/internal/auth"
	"github.com/tuzi/cdk-recharge-system/internal/config"
	"github.com/tuzi/cdk-recharge-system/internal/db"
	"github.com/tuzi/cdk-recharge-system/internal/handler"
	"github.com/tuzi/cdk-recharge-system/internal/plansync"
)

type Server struct {
	engine *gin.Engine
	cfg    *config.Config
}

func New(ctx context.Context, cfg *config.Config) (*Server, error) {
	// 生产模式下强制要求安全的 JWT secret，避免 token 被伪造
	if err := enforceJWTSecret(cfg.Server.Mode); err != nil {
		return nil, err
	}

	// Initialize database
	if err := db.Init(&cfg.Database); err != nil {
		return nil, err
	}

	engine := gin.Default()

	// 不信任任意代理头（X-Forwarded-For 等），保证限流拿到的是真实来源 IP。
	// 若部署在已知反代后，用 TRUSTED_PROXIES（逗号分隔）显式声明。
	if tp := strings.TrimSpace(os.Getenv("TRUSTED_PROXIES")); tp != "" {
		_ = engine.SetTrustedProxies(splitAndTrim(tp))
	} else {
		_ = engine.SetTrustedProxies(nil)
	}

	// Setup middleware
	engine.Use(SecurityHeadersMiddleware())
	engine.Use(CORSMiddleware())

	// Setup routes
	setupRoutes(engine)

	// 启动卡台产品状态后台同步（每3分钟）
	plansync.Start(ctx)

	return &Server{
		engine: engine,
		cfg:    cfg,
	}, nil
}

// enforceJWTSecret 在 release 模式下拒绝使用空/默认密钥启动。
func enforceJWTSecret(mode string) error {
	secret := os.Getenv("JWT_SECRET")
	weak := secret == "" ||
		secret == "your-secret-key-change-in-production" ||
		secret == "dev-secret-key-change-in-production" ||
		len(secret) < 16
	if mode == "release" && weak {
		return fmt.Errorf("不安全的 JWT_SECRET：release 模式必须设置至少 16 位的随机 JWT_SECRET 环境变量")
	}
	if weak {
		log.Printf("⚠️  当前 JWT_SECRET 不安全（默认/过短）。仅可用于本地开发，部署前请设置强随机 JWT_SECRET（release 模式将拒绝启动）。")
	}
	return nil
}

func splitAndTrim(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if v := strings.TrimSpace(p); v != "" {
			out = append(out, v)
		}
	}
	return out
}

func setupRoutes(r *gin.Engine) {
	webDir := strings.TrimSpace(os.Getenv("WEB_DIR"))

	// Root route for quick manual checks in browser (仅当未托管前端时)
	if webDir == "" {
		r.GET("/", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"status":   "ok",
				"message":  "Recharge System backend is running",
				"health":   "/health",
				"api_base": "/api/v1",
			})
		})
	}

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"message": "Recharge System is running",
		})
	})

	// API v1 routes
	api := r.Group("/api/v1")
	{
		api.GET("", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"status":  "ok",
				"message": "API v1 is available",
			})
		})

		auth := api.Group("/auth")
		{
			auth.POST("/admin/login", handler.AdminLogin)
			auth.POST("/admin/logout", handler.AdminLogout)
			auth.GET("/admin/me", JWTAuthMiddleware(), handler.AdminMe)
			auth.POST("/admin/change-password", JWTAuthMiddleware(), AdminAuthMiddleware(), handler.AdminChangePassword)
		}

		// 首次安装向导（仅 pending；完成后 410）
		setup := api.Group("/setup")
		{
			setup.GET("/status", handler.SetupStatus)
			setup.POST("/bootstrap", handler.SetupBootstrap)
		}

		// 公开站点配置（品牌/皮肤，无密钥）
		api.GET("/public/site", handler.PublicSiteConfig)

		// 卡台 CDK 公开兑换 BFF + 实时服务费展示
		pubCDK := api.Group("/public/cdk")
		{
			pubCDK.GET("/plans", handler.PublicCDKPlans)
			pubCDK.POST("/preview", handler.PublicCDKPreview)
			pubCDK.POST("/preflight", handler.PublicCDKPreflight)
			pubCDK.POST("/recover-subscription", handler.PublicCDKGraceRecovery)
			pubCDK.POST("/redeem", handler.PublicCDKRedeem)
			pubCDK.GET("/result", handler.PublicCDKResult)
			// 刷新进度 / 任务查询：凭卡密反查本站绑定的 redemption_token
			pubCDK.GET("/result-by-code", handler.PublicCDKResultByCode)
			// 客户自过码（browser_native）：取 Stripe 交接参数 + 过码后回传推进订单
			pubCDK.GET("/native-captcha/params", handler.PublicCDKNativeCaptchaParams)
			pubCDK.POST("/native-captcha/complete", handler.PublicCDKNativeCaptchaComplete)
			// 代理隐藏换码：密码 + 失败未扣款 CDK → 新码
			pubCDK.POST("/exchange", handler.PublicAgentCDKExchange)
		}

		// 卡密状态查询：是否已用 + 充值邮箱（不返回 token）
		lookup := api.Group("/lookup")
		{
			lookup.GET("/cdk", handler.LookupCDKStatus)
			lookup.POST("/cdk/batch", handler.LookupCDKStatusBatch)
			// 兼容旧路径
			lookup.GET("/task", handler.LookupCDKStatus)
		}

		// 卡台 Webhook（须在卡台开发者页配置 https://你的域名/api/v1/webhooks/cardplatform）
		api.POST("/webhooks/cardplatform", handler.CardPlatformWebhook)

		// 账单：粘贴 session 查 ChatGPT 订阅 + hosted_invoice（小助手同款）
		api.POST("/public/billing/check", handler.SessionBillingCheck)
		api.POST("/billing/check", handler.SessionBillingCheck)

		// Stats routes
		stats := api.Group("/stats")
		stats.Use(JWTAuthMiddleware(), AdminAuthMiddleware())
		{
			stats.GET("/system", handler.GetSystemStats)
		}

		// Admin routes
		admin := api.Group("/admin")
		admin.Use(JWTAuthMiddleware())
		admin.Use(AdminAuthMiddleware())
		{
			// 版本：本机 VERSION + GitHub 最新 release/tag
			admin.GET("/system/version", handler.AdminSystemVersion)
			admin.GET("/system/update/status", handler.AdminSystemUpdateStatus)
			admin.POST("/system/update", handler.AdminSystemUpdate)

			// 卡台 Open API：实时价格 / 余额 / 发码 / 列码 / CDK 订单
			admin.GET("/cardplatform/ping", handler.CardPlatformPing)
			admin.GET("/cardplatform/plans", handler.CardPlatformPlans)
			admin.GET("/cardplatform/balance", handler.CardPlatformBalance)
			admin.GET("/cardplatform/cdks", handler.CardPlatformListCDKs)
			admin.GET("/cardplatform/cdks/stored", handler.CardPlatformListStoredCDKs)
			admin.POST("/cardplatform/cdks", handler.CardPlatformIssueCDKs)
			admin.POST("/cardplatform/cdks/sync", handler.CardPlatformSyncUpstreamCDKs)
			admin.POST("/cardplatform/cdks/store", handler.CardPlatformStoreCDKCodes)
			admin.POST("/cardplatform/cdks/batch-disable", handler.CardPlatformBatchDisableCDKs)
			admin.POST("/cardplatform/cdks/batch-enable", handler.CardPlatformBatchEnableCDKs)
			admin.POST("/cardplatform/cdks/batch-note", handler.CardPlatformBatchSetCDKNote)
			admin.POST("/cardplatform/cdks/batch-clear-note", handler.CardPlatformBatchClearCDKNote)
			admin.PUT("/cardplatform/cdks/:id/note", handler.CardPlatformSetCDKNote)
			admin.POST("/cardplatform/cdks/:id/disable", handler.CardPlatformDisableCDK)
			admin.POST("/cardplatform/cdks/:id/enable", handler.CardPlatformEnableCDK)
			admin.GET("/cardplatform/cdk-orders", handler.CardPlatformListCDKOrders)
			admin.GET("/cardplatform/cdk-orders/:id", handler.CardPlatformGetCDKOrder)
			admin.DELETE("/cardplatform/cards/:id", handler.CardPlatformDeleteCard)

			// Webhook 事件列表 + 配置提示
			admin.GET("/webhooks/events", handler.AdminListWebhooks)

			// 本机出口 IP（卡台 API 白名单）
			admin.GET("/network/egress", handler.NetworkEgress)

			// Audit logs
			admin.GET("/audit-logs", handler.ListAuditLogs)

			// 站点设置（品牌/皮肤/卡台密钥保险箱）
			admin.GET("/settings", handler.AdminGetSettings)
			admin.PUT("/settings", handler.AdminPutSettings)

			// 自动选卡权重配置
			admin.GET("/card-selection/rules", handler.AdminGetCardSelectionRules)
			admin.PUT("/card-selection/rules", handler.AdminPutCardSelectionRules)
			admin.GET("/card-selection/plan-status", handler.AdminGetPlanStatus)
			admin.POST("/card-selection/sync", handler.AdminSyncPlanStatus)
			admin.GET("/card-selection/site-policy", handler.AdminGetSiteRedeemPolicy)
			admin.PUT("/card-selection/site-policy", handler.AdminPutSiteRedeemPolicy)

			// 卡健康：同卡失败 × 邮箱归因 → 坏卡冻结
			admin.GET("/card-health", handler.AdminListCardHealth)
			admin.GET("/card-health/policy", handler.AdminGetCardHealthPolicy)
			admin.PUT("/card-health/policy", handler.AdminPutCardHealthPolicy)
			admin.POST("/card-health/unblock", handler.AdminUnblockCard)
			admin.POST("/card-health/observe", handler.AdminReobserveCardOrder)
		}
	}

	// 托管前端 SPA（当设置了 WEB_DIR 时）：真实存在的文件直出，其余回退到 index.html
	if webDir != "" {
		indexFile := filepath.Join(webDir, "index.html")
		r.NoRoute(func(c *gin.Context) {
			p := c.Request.URL.Path
			if strings.HasPrefix(p, "/api") || strings.HasPrefix(p, "/health") {
				c.JSON(404, gin.H{"error": "not found"})
				return
			}
			if c.Request.Method != "GET" && c.Request.Method != "HEAD" {
				c.JSON(404, gin.H{"error": "not found"})
				return
			}
			// 防目录穿越：path.Clean 后再拼接，确保不越出 webDir
			clean := path.Clean("/" + strings.TrimPrefix(p, "/"))
			// ★后台前端代码门禁★：assets/admin/* 只对已登录管理员可见。未登录/非管理员一律 404，
			// 不让匿名访客下载后台 JS（内含后台接口路径、上游品牌/域名）。用 404 而非 403，
			// 不暴露「此处有受保护文件」。clean 已归一化，挡住 /assets/admin/.. 之类穿越写法。
			if strings.HasPrefix(clean, "/assets/admin/") {
				// ★绝不缓存★：这些响应随 auth_token 而异（管理员 200 / 他人 404），一旦被
				// CDN/浏览器按 URL 缓存，一个管理员取到的 JS 会被边缘缓存后发给匿名访客，
				// 直接绕过本门禁。no-store 让 CF 与浏览器都不缓存（管理端非性能敏感，可接受回源）。
				// 同时发 Vary: Cookie，双保险告知任何中间缓存按 Cookie 区分。
				c.Header("Cache-Control", "no-store")
				c.Header("Vary", "Cookie")
				if !adminAssetAllowed(c) {
					c.JSON(404, gin.H{"error": "not found"})
					return
				}
			}
			if clean != "/" {
				fp := filepath.Join(webDir, filepath.FromSlash(clean))
				if st, err := os.Stat(fp); err == nil && !st.IsDir() {
					c.File(fp)
					return
				}
			}
			c.File(indexFile)
		})
	}
}

func (s *Server) Run(addr string) error {
	return s.engine.Run(addr)
}

// adminAssetAllowed 判断请求是否来自已登录管理员，供 /assets/admin/ 静态门禁用。
// 复用登录时下发的 HttpOnly auth_token cookie —— 浏览器加载同源 /assets/admin/*.js 会自动带上它，
// 所以无需为静态资源单独发凭证；同时兼容 Authorization: Bearer（非浏览器客户端）。
// 只认签名有效、未过期且 is_admin=true 的票；任何不满足都返回 false（调用方据此 404）。
// 这里只读不写、不做 CSRF 校验（GET 静态资源本就不改状态）。
func adminAssetAllowed(c *gin.Context) bool {
	var tokenStr string
	if authHeader := c.GetHeader("Authorization"); authHeader != "" {
		if parts := strings.Split(authHeader, " "); len(parts) == 2 && parts[0] == "Bearer" {
			tokenStr = parts[1]
		}
	}
	if tokenStr == "" {
		if ck, err := c.Cookie("auth_token"); err == nil {
			tokenStr = ck
		}
	}
	if tokenStr == "" {
		return false
	}
	claims := &auth.CustomClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(auth.JWTSecret()), nil
	})
	return err == nil && token.Valid && claims.IsAdmin
}
