package cardplatform

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"testing"
)

// TestSanitizeUpstreamErr 验证上游调用错误不再泄露 zovocard 域名(白标)。
func TestSanitizeUpstreamErr(t *testing.T) {
	// 复刻截图那条:Post "https://zovocard.com/api/v1/cdk/preflight": context deadline exceeded
	ue := &url.Error{
		Op:  "Post",
		URL: "https://zovocard.com/api/v1/cdk/preflight",
		Err: context.DeadlineExceeded,
	}
	got := sanitizeUpstreamErr(ue).Error()
	if strings.Contains(got, "zovocard") {
		t.Fatalf("url.Error 仍含 zovocard: %q", got)
	}
	if !strings.Contains(got, "上游服务") {
		t.Fatalf("应替换为「上游服务」,实际: %q", got)
	}

	// 裸域名也要抹掉
	plain := sanitizeUpstreamErr(errors.New("dial tcp sandbox.zovocard.com:443: connect: connection refused")).Error()
	if strings.Contains(plain, "zovocard") {
		t.Fatalf("裸域名仍含 zovocard: %q", plain)
	}

	// nil 安全
	if sanitizeUpstreamErr(nil) != nil {
		t.Fatal("nil 应返回 nil")
	}
	// 无域名的错误原样返回语义
	if sanitizeUpstreamErr(errors.New("boom")).Error() != "boom" {
		t.Fatal("无域名错误不应被改写")
	}
}
