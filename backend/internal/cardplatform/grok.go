package cardplatform

import (
	"regexp"
	"strings"
)

// Grok 档位：卡台注册表里是裸键（monthly / plus_yearly …），ACC 定价表里带 grok_ 前缀。
// 与 GPT（plus / pro_20x …）、X（premium_monthly …）、Kiro（pro_monthly …）的键互不重叠。
var grokPlanRe = regexp.MustCompile(`^(?:grok_)?(?:(?:lite|plus|heavy)_)?(?:monthly|yearly)$`)

func IsGrokPlan(plan string) bool {
	return grokPlanRe.MatchString(strings.ToLower(strings.TrimSpace(plan)))
}

// GrokBarePlan 去掉 grok_ 前缀的裸档位（本站界面与码上都用裸键，与 X 一致）。
func GrokBarePlan(plan string) string {
	return strings.TrimPrefix(strings.ToLower(strings.TrimSpace(plan)), "grok_")
}

// GrokIssuePlan 发给卡台的发码档位：显式带 grok_ 前缀。
// 卡台也认裸键，但裸键要靠「遍历各产品档位表」反查产品，将来哪个产品也有 monthly 就会认错；
// 带前缀则直接定位到 Grok。卡台落库时会去掉前缀。
func GrokIssuePlan(plan string) string {
	return "grok_" + GrokBarePlan(plan)
}

// IsGrokCredential Grok 登录态（grok.com 的 sso cookie，含 sso= / sso-rw=）。
// 它是可复用的登录凭据，不是 ChatGPT 账单会话，不能绑到卡密供账单页查询。
func IsGrokCredential(raw string) bool {
	s := strings.TrimSpace(raw)
	if s == "" || strings.HasPrefix(s, "{") {
		return false
	}
	return strings.HasPrefix(s, "sso=") || strings.HasPrefix(s, "sso-rw=") ||
		strings.Contains(s, "; sso=") || strings.Contains(s, ";sso=") ||
		strings.Contains(s, "; sso-rw=") || strings.Contains(s, ";sso-rw=")
}
