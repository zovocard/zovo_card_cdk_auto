package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/tuzi/cdk-recharge-system/internal/auth"
)

// mintToken 用指定密钥签一枚 JWT，便于构造「有效/过期/错签名/管理员/非管理员」各种票。
func mintToken(t *testing.T, secret string, isAdmin bool, exp time.Time) string {
	t.Helper()
	claims := auth.CustomClaims{
		UserID:  7,
		IsAdmin: isAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	}
	s, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("签发测试 token 失败: %v", err)
	}
	return s
}

// ctxWithCookie 造一个带 auth_token cookie 的请求上下文。
func ctxWithCookie(token string) *gin.Context {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	req := httptest.NewRequest(http.MethodGet, "/assets/admin/CDKeyManagement-x.js", nil)
	if token != "" {
		req.AddCookie(&http.Cookie{Name: "auth_token", Value: token})
	}
	c.Request = req
	return c
}

// TestAdminAssetAllowed 验证 /assets/admin/* 的静态门禁判定：只有已登录管理员放行。
func TestAdminAssetAllowed(t *testing.T) {
	gin.SetMode(gin.TestMode)
	const secret = "test-secret-please-change-0123456789"
	t.Setenv("JWT_SECRET", secret)
	future := time.Now().Add(time.Hour)

	t.Run("无票拒绝", func(t *testing.T) {
		if adminAssetAllowed(ctxWithCookie("")) {
			t.Fatal("无 auth_token 竟放行")
		}
	})
	t.Run("管理员放行", func(t *testing.T) {
		if !adminAssetAllowed(ctxWithCookie(mintToken(t, secret, true, future))) {
			t.Fatal("合法管理员票被拒")
		}
	})
	t.Run("普通用户拒绝", func(t *testing.T) {
		if adminAssetAllowed(ctxWithCookie(mintToken(t, secret, false, future))) {
			t.Fatal("非管理员(is_admin=false)竟放行")
		}
	})
	t.Run("过期票拒绝", func(t *testing.T) {
		if adminAssetAllowed(ctxWithCookie(mintToken(t, secret, true, time.Now().Add(-time.Minute)))) {
			t.Fatal("过期管理员票竟放行")
		}
	})
	t.Run("错签名拒绝", func(t *testing.T) {
		if adminAssetAllowed(ctxWithCookie(mintToken(t, "another-wrong-secret-aaaaaaaaaaaaa", true, future))) {
			t.Fatal("用错密钥签的票竟放行")
		}
	})
	t.Run("乱码票拒绝", func(t *testing.T) {
		if adminAssetAllowed(ctxWithCookie("not-a-jwt")) {
			t.Fatal("非法 token 竟放行")
		}
	})
	t.Run("Bearer头管理员放行", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		req := httptest.NewRequest(http.MethodGet, "/assets/admin/x.js", nil)
		req.Header.Set("Authorization", "Bearer "+mintToken(t, secret, true, future))
		c.Request = req
		if !adminAssetAllowed(c) {
			t.Fatal("Bearer 头里的合法管理员票被拒")
		}
	})
}
