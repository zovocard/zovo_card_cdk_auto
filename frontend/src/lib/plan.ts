import { isXPremiumPlan } from './x-premium'
import { grokBarePlan, grokPlanLabel, isGrokPlan } from './grok'
// 档位判定：可读名 + 「账号是否已满足该档」（兑换前的重复购买闸）。
//
// ★为什么抽成独立模块★
// 这两条判据原来内联在 RechargeView.vue 里，只有渲染才能碰到，测不动——
// 而它们直接决定「兑换按钮给不给点」。抽出来之后可以对着纯函数写用例，
// 把「续费档不能被判成已满足」这类回归钉死。
//
// ★判据必须与卡台后端同源★
// 卡台后端 gptProduct.PlanSatisfied 对绑卡档（flow=card_attach，即 Pro 20x 续费）
// 显式返回 false。代理侧若自己按档位名猜，会把 pro_20x_renew 猜成 Pro 20x 档，
// 而它服务的账号**本来就是 Pro 20x** → 判「已满足」→ 兑换按钮置灰 → 每张码都兑不出去。

/** 绑卡档 flow：本单不扣款，只把新卡绑上并设为默认（Pro 20x 续费）。 */
export const FLOW_CARD_ATTACH = 'card_attach'

/**
 * 这一单是不是绑卡档。
 *
 * 优先用后端下发的 planFlow（卡台预览响应里的 plan_flow，取自卡台档位注册表）；
 * 后端没给时才按键名兜底认那个已知的绑卡档。
 */
export function isCardAttachPlan(plan: string, planFlow?: string): boolean {
  const flow = String(planFlow || '').trim().toLowerCase()
  if (flow) return flow === FLOW_CARD_ATTACH
  return String(plan || '').trim().toLowerCase() === 'pro_20x_renew'
}

/** 档位可读名。续费档必须排在 'pro' 兜底之前，否则显示成「Pro 20x」看不出是续费。 */
export function planLabel(value: string): string {
  const n = String(value || 'free').trim().toLowerCase()
  if (isGrokPlan(n)) return grokPlanLabel(n)
  if (isXPremiumPlan(n)) return 'X ' + n.replace(/^x_/, '').replace('premium_plus', 'Premium+').replace('premium', 'Premium').replace('basic', 'Basic').replace('_monthly', ' / month').replace('_yearly', ' / year')
  if (n === 'pro_20x_renew' || n.includes('renew')) return 'Pro 20x 续费'
  if (n.includes('promax') || n === 'pro_50x') return 'Pro 50x'
  if (n.includes('prolite') || n.includes('5x') || n === 'pro_5x') return 'Pro 5x'
  if (n.includes('20x') || n === 'pro_20x' || n === 'pro' || n === 'chatgptpro' || n.includes('pro')) return 'Pro 20x'
  if (n.includes('plus')) return 'Plus'
  if (n.includes('team')) return 'Team'
  if (!n || n === 'free') return '免费版'
  return value
}

/**
 * 账号当前套餐是否已满足所购档（已满足 → 不必再买，兑换前拦下）。
 *
 * 绑卡档恒 false：它不改变账号套餐，只换一张续费卡，永远存在「要买」的理由。
 */
export function planSatisfied(currentPlan: string, requestedPlan: string, planFlow?: string): boolean {
  const current = String(currentPlan || '').trim().toLowerCase()
  const req = String(requestedPlan || '').trim().toLowerCase()
  if (isXPremiumPlan(req)) return current.startsWith('x_') && current !== 'x_free'
  // Grok 四档（Lite / SuperGrok / Plus / Heavy）与月/年付是并列商品，不存在「更高档已满足」，只认完全相同。
  if (isGrokPlan(req)) return !!current && grokBarePlan(current) === grokBarePlan(req)
  if (current.startsWith('x_')) return false
  if (isCardAttachPlan(req, planFlow)) return false
  const currentRank =
    current.includes('promax') || current === 'pro_50x' ? 4 : current.includes('prolite') || current.includes('5x') || current === 'pro_5x'
      ? 2
      : current.includes('pro')
        ? 3
        : current.includes('plus')
          ? 1
          : 0
  const requestedRank =
    req === 'pro_50x' || req.includes('promax') ? 4 : req === 'pro_20x' || req === 'pro' || req.includes('20x')
      ? 3
      : req === 'pro_5x' || req.includes('5x')
        ? 2
        : req === 'plus' || req.includes('plus')
          ? 1
          : 99
  return currentRank >= requestedRank
}
