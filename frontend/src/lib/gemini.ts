// Gemini / Google One：档位识别 + 凭据（Google refresh_token）规范化。
//
// 裸档位 ai_plus_monthly / ai_pro_monthly / ai_ultra_monthly（本站界面与码上用裸键）；
// 带 gemini_ 前缀时同样认（卡台/ACC 定价表带前缀）。凭据 = Google 账户 refresh_token
// （1//… OAuthLogin scope，铸 cookie 登录态）或含 refreshToken 的 JSON。

const GEMINI_PLAN = /^(?:gemini_)?ai_(?:plus|pro|ultra)_monthly$/

export function isGeminiPlan(value: string): boolean {
  return GEMINI_PLAN.test(String(value || '').trim().toLowerCase())
}

/** 裸档位（去掉 gemini_ 前缀），用于和预检回来的 currentPlan 比对。 */
export function geminiBarePlan(value: string): string {
  return String(value || '').trim().toLowerCase().replace(/^gemini_/, '')
}

const TIER_LABEL: Record<string, string> = { plus: 'Plus', pro: 'Pro', ultra: 'Ultra' }

export function geminiPlanLabel(value: string): string {
  const m = geminiBarePlan(value).match(/^ai_(plus|pro|ultra)_monthly$/)
  if (!m) return value
  return `Google AI ${TIER_LABEL[m[1]]} / 月`
}

/** Gemini 凭据 = Google refresh_token（1//…）或含 refreshToken 的 JSON。 */
export function isGeminiCredential(raw: string): boolean {
  const s = String(raw || '').trim()
  if (!s || s.length > 8192 || /[\r\n\0]/.test(s)) return false
  if (/^1\/\/[A-Za-z0-9_-]{20,}/.test(s)) return true
  return /refreshToken|refresh_token/.test(s)
}

/** 规范化用户粘贴的 Gemini 凭据，无效返回 ''。 */
export function geminiCredential(raw: string): string {
  const s = String(raw || '').trim()
  if (!s || s.length > 8192 || /[\r\n\0]/.test(s)) return ''
  return isGeminiCredential(s) ? s : ''
}
