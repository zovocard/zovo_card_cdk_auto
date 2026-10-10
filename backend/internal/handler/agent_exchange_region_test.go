package handler

import (
	"testing"

	"github.com/tuzi/cdk-recharge-system/internal/cardplatform"
)

// 补发必须保留原码地区：智利码补发出来不能变成默认菲律宾码（2026-10-10 代理反馈）。
func TestAgentSwapIssuePrefsKeepRegion(t *testing.T) {
	site := cardplatform.IssueCardPref{Issuer: "one", SegmentType: "product", SegmentKey: "P5378"}
	got := agentSwapIssuePrefs(cardplatform.IssueCardPref{}, false, " cl ")
	if len(got) != 1 || got[0].PaymentCountry != "CL" {
		t.Fatalf("没有选卡配置时也要带上地区：%+v", got)
	}
	got = agentSwapIssuePrefs(site, true, "JP")
	if len(got) != 1 || got[0].PaymentCountry != "JP" || got[0].SegmentKey != "P5378" {
		t.Fatalf("选卡偏好与地区要一起带：%+v", got)
	}
	if got := agentSwapIssuePrefs(cardplatform.IssueCardPref{}, false, ""); got != nil {
		t.Fatalf("默认区且无选卡配置时不传偏好（与原行为一致）：%+v", got)
	}
	got = agentSwapIssuePrefs(site, true, "")
	if len(got) != 1 || got[0].PaymentCountry != "" {
		t.Fatalf("默认区保留选卡偏好：%+v", got)
	}
}
