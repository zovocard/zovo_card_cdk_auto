// Grok 卡密：档位识别 + 登录态（grok.com 的 sso cookie）规范化。
//
// ★卡台预览只回裸档位★（monthly / plus_yearly …，不带 grok_ 前缀，也不回 product），
// 所以只能按档位键认产品。这些键与 GPT（plus / pro_20x …）、X（premium_monthly …）互不重叠。
//
// ★Grok 不产预检票★：预检只查账号状态，不回 preflight_token；兑换时改为直接带登录态
// credential（卡台按码上的产品分流，GPT / X 码仍必须带 preflight_token）。

const GROK_PLAN = /^(?:grok_)?(?:(?:lite|plus|heavy)_)?(?:monthly|yearly)$/

export function isGrokPlan(value: string): boolean {
  return GROK_PLAN.test(String(value || '').trim().toLowerCase())
}

/** 裸档位（去掉 grok_ 前缀），用于和预检回来的 currentPlan 比对。 */
export function grokBarePlan(value: string): string {
  return String(value || '').trim().toLowerCase().replace(/^grok_/, '')
}

const TIER_LABEL: Record<string, string> = { lite: 'SuperGrok Lite', plus: 'SuperGrok Plus', heavy: 'SuperGrok Heavy' }

export function grokPlanLabel(value: string): string {
  const bare = grokBarePlan(value)
  const m = bare.match(/^(?:(lite|plus|heavy)_)?(monthly|yearly)$/)
  if (!m) return value
  const tier = m[1] ? TIER_LABEL[m[1]] : 'SuperGrok'
  return `Grok ${tier} / ${m[2] === 'yearly' ? '年' : '月'}`
}

const SSO_COOKIE = /(?:^|;\s*)sso(?:-rw)?=[^;\s]+/

/** 已是 cookie 形式（含 sso= / sso-rw=）的 Grok 登录态。批量导入只认这种，避免和 GPT 裸 token 混淆。 */
export function isGrokCredential(raw: string): boolean {
  const s = String(raw || '').trim()
  return !!s && s.length <= 8192 && !/[\r\n\0]/.test(s) && !s.startsWith('{') && SSO_COOKIE.test(s)
}

/**
 * 规范化用户粘贴的 Grok 登录态，无效返回 ''。
 * 接受整段 cookie（含 sso=）或只粘了 sso 的值（补成 sso=<值>）。
 */
export function grokCredential(raw: string): string {
  const s = String(raw || '').trim()
  if (!s || s.length > 8192 || /[\r\n\0]/.test(s)) return ''
  if (isGrokCredential(s)) return s
  // 只粘了值：cookie 值字符集，末尾允许 base64 填充 =
  return /^[A-Za-z0-9._~%+/-]{16,4096}={0,2}$/.test(s) ? 'sso=' + s : ''
}
