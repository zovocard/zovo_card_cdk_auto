/* 平台与档位只负责显示（R10 Final 1.2 ICON_MAPPING）。不据颜色、金额或图标推断权益、付款或能力。 */
import { BRAND_PATHS } from './brandPaths'

export type ProductBrand = keyof typeof BRAND_PATHS
export type TierGlyph = 'base' | 'plus' | 'pro' | 'more' | 'max' | 'offer' | 'credits' | 'unknown'
export type TierTint = 'slate' | 'blue' | 'violet' | 'teal' | 'gold'
export interface ProductIdentity { brand: ProductBrand; key: string; label: string; glyph: TierGlyph; tint: TierTint; level: number; unknown: boolean }

export const BRAND_NAMES: Record<ProductBrand, string> = { openai: 'OpenAI', claude: 'Claude', grok: 'Grok', x: 'X' }
export const TIER_SHAPES: Record<TierGlyph, string> = {
  base: 'M5 3h6l2 5-5 5-5-5z',
  plus: 'M8 3v10M3 8h10',
  pro: 'M8 2l6 6-6 6-6-6zM5 8h6',
  more: 'M8 1.5l6 6-6 6-6-6zM8 5l2.5 2.5L8 10 5.5 7.5z',
  max: 'M2 5l3 3 3-5 3 5 3-3-1 7H3z',
  offer: 'M2 3h6l6 6-5 5-7-7zM5 5h.01',
  credits: 'M3 5l5-3 5 3-5 3zM3 8l5 3 5-3M3 11l5 3 5-3',
  unknown: 'M3 3h10v10H3zM8 7v3M8 5h.01',
}

type Entry = [ProductBrand, string, string, TierGlyph, TierTint, number, string[]]
// 生产 plan_type / 卡面 id 在前，样板别名在后；同名 Plus/Premium/Max 只在本平台内匹配。
const CATALOG: Entry[] = [
  ['openai', 'go', 'Go', 'base', 'slate', 1, ['go', 'chatgpt go', 'chatgptgoplan']],
  ['openai', 'plus', 'Plus', 'plus', 'blue', 2, ['plus', 'chatgpt plus', 'chatgptplusplan', 'chatgpt_plus']],
  ['openai', 'plus-half', 'Plus 半价', 'offer', 'blue', 2, ['plus_half', 'plus半价', 'plus 半价', 'chatgpt plus 半价']],
  ['openai', 'pro100', 'Pro 100', 'pro', 'violet', 3, ['pro5x', 'pro-standard', 'pro100', 'pro 100', 'pro100（standard）', 'pro100 (standard)', 'standard', 'chatgpt pro 100', 'prolite', 'pro_lite']],
  ['openai', 'pro200', 'Pro 200', 'more', 'teal', 4, ['pro20x', 'pro-more', 'pro200', 'pro 200', 'pro200（more）', 'more', 'chatgpt pro 200']],
  ['openai', 'pro500', 'Pro 500', 'max', 'gold', 5, ['pro50x', 'pro-500', 'pro500', 'pro 500', 'pro500（max）', 'chatgpt pro 500', 'chatgptpromax']],
  ['openai', 'credits', 'Codex 点数', 'credits', 'slate', 3, ['codex-credits', 'codex credits']],
  ['claude', 'pro', 'Pro', 'pro', 'violet', 1, ['claude_pro', 'claude-pro', 'pro', 'claude pro']],
  ['claude', 'max5', 'Max 5×', 'more', 'teal', 2, ['claude_max5x', 'claude-5x', 'max 5x', 'max 5×', 'claude max 5x', 'claude max 5×']],
  ['claude', 'max20', 'Max 20×', 'max', 'gold', 3, ['claude_max20x', 'claude-20x', 'max 20x', 'max 20×', 'claude max 20x', 'claude max 20×']],
  ['claude', 'max', 'Max', 'max', 'gold', 3, ['max', 'claude max']],
  ['grok', 'plus', 'Plus', 'plus', 'blue', 1, ['grok_xai_plus', 'plus', 'grok plus', 'grok x ai plus']],
  ['grok', 'premium', 'Premium', 'pro', 'violet', 2, ['grok_xai_premium', 'premium', 'grok premium', 'grok x ai premium']],
  ['grok', 'super', 'Super', 'more', 'teal', 3, ['grok_xai_super', 'super', 'grok super', 'grok x ai super', 'supergrok']],
  ['grok', 'ultra', 'Ultra', 'max', 'gold', 4, ['grok_xai_ultra', 'ultra', 'grok ultra', 'grok x ai ultra']],
  ['x', 'basic', 'Basic', 'base', 'slate', 1, ['x_basic_monthly', 'x_basic_yearly', 'basic', 'x basic', 'x basic monthly', 'x basic yearly']],
  ['x', 'premium', 'Premium', 'pro', 'violet', 2, ['x_premium_monthly', 'x_premium_yearly', 'premium', 'x premium', 'x premium monthly', 'x premium yearly']],
  ['x', 'premium-plus', 'Premium+', 'max', 'gold', 3, ['x_premium_plus_monthly', 'x_premium_plus_yearly', 'premium+', 'x premium+', 'x premium+ monthly', 'x premium+ yearly']],
]

const norm = (value: unknown) => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
const BRAND_ALIASES: Record<string, ProductBrand> = { chatgpt: 'openai', gpt: 'openai', openai: 'openai', codex: 'openai', claude: 'claude', anthropic: 'claude', grok: 'grok', xai: 'grok', 'x ai': 'grok', x: 'x', 'x 订阅': 'x', twitter: 'x' }

export function brandFromText(value: unknown): ProductBrand | null { return BRAND_ALIASES[norm(value)] || null }

function brandFromPlan(raw: string): ProductBrand | null {
  if (/^grok[\s_]/.test(raw) || raw === 'supergrok') return 'grok'
  if (/^x[\s_]/.test(raw)) return 'x'
  if (/^claude[\s_-]/.test(raw)) return 'claude'
  if (/^(chatgpt|codex)[\s_-]/.test(raw) || /^(go|plus(_half| ?半价)?|pro[\s_-]?(5x|20x|50x|100|200|500|standard|more)|\d+ credits)$/.test(raw)) return 'openai'
  return null
}

/** 结算口径：先看平台上下文，再看本平台的明确档位；只有平台没有档位时显示“档位未记录”，不按价格猜。 */
export function resolveProductIdentity(input: { plan?: unknown; platform?: unknown; family?: unknown }): ProductIdentity | null {
  const raw = norm(input.plan)
  let brand = brandFromText(input.platform) || brandFromText(input.family) || (raw ? brandFromPlan(raw) : null)
  if (!brand && raw) {
    const only = CATALOG.filter(entry => entry[6].includes(raw))
    if (only.length && only.every(entry => entry[0] === only[0][0])) brand = only[0][0]
  }
  if (!brand) return null
  const hit = CATALOG.find(entry => entry[0] === brand && (entry[1] === raw || entry[6].includes(raw)))
  if (hit) return { brand, key: hit[1], label: hit[2], glyph: hit[3], tint: hit[4], level: hit[5], unknown: false }
  const codex = /^codex_(\d+)$/.exec(raw)
  if (codex) return { brand, key: 'credits', label: `${codex[1]} credits`, glyph: 'credits', tint: 'slate', level: 3, unknown: false }
  const original = String(input.plan ?? '').trim()
  return { brand, key: 'unknown', label: original && norm(original) !== norm(BRAND_NAMES[brand]) ? original : '档位未记录', glyph: 'unknown', tint: 'slate', level: 0, unknown: true }
}

export function brandMarkSvg(brand: ProductBrand, className = 'product-brand-svg') {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" aria-hidden="true" focusable="false"><path d="${BRAND_PATHS[brand]}"/></svg>`
}
export function tierMarkSvg(glyph: TierGlyph, className = 'tier-mark') {
  return `<svg class="${className}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="${TIER_SHAPES[glyph] || TIER_SHAPES.unknown}"/></svg>`
}
