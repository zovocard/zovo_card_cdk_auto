package cardplatform

import "strings"

// Gemini / Google One AI 档位：本站裸键 ai_plus_monthly / ai_pro_monthly / ai_ultra_monthly，
// ACC 定价表与派发带 gemini_ 前缀（gemini_ai_plus_monthly…）。发码一律带 gemini_ 前缀
// （GeminiIssuePlan），让卡台直接定位到 Gemini，不靠「遍历各产品档位表」反查。与 Claude 同构。
//
// 凭据 = Google 账户 refresh_token（1//… OAuthLogin scope）或含 refreshToken 的 JSON。
// 三档裸键唯一，不与 GPT（plus/pro_20x…）、X、Grok、Claude 的键冲突。
var geminiBarePlans = map[string]bool{
	"ai_plus_monthly":  true,
	"ai_pro_monthly":   true,
	"ai_ultra_monthly": true,
}

// IsGeminiPlan 识别 Gemini 档位：带 gemini_ 前缀，或裸键命中三档之一。
func IsGeminiPlan(plan string) bool {
	p := strings.ToLower(strings.TrimSpace(plan))
	if strings.HasPrefix(p, "gemini_") {
		return geminiBarePlans[strings.TrimPrefix(p, "gemini_")]
	}
	return geminiBarePlans[p]
}

// GeminiBarePlan 去掉 gemini_ 前缀的裸档位（本站界面与码上都用裸键）。
func GeminiBarePlan(plan string) string {
	return strings.TrimPrefix(strings.ToLower(strings.TrimSpace(plan)), "gemini_")
}

// GeminiIssuePlan 发给卡台的发码档位：显式带 gemini_ 前缀。卡台落库时会去掉前缀。
func GeminiIssuePlan(plan string) string {
	return "gemini_" + GeminiBarePlan(plan)
}

// IsGeminiCredential 识别 Gemini 凭据：Google rt（1//…）或含 refreshToken 的 JSON。
func IsGeminiCredential(cred string) bool {
	s := strings.TrimSpace(cred)
	if strings.HasPrefix(s, "1//") {
		return true
	}
	return strings.Contains(s, "refreshToken") || strings.Contains(s, "refresh_token")
}
