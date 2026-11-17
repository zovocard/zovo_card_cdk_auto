// 本站接入层：把本站兑换页状态翻译成展示层（RedeemPresentation）的 props。
import { computed } from 'vue'
import { currentSkinMeta } from '../theme'
import { isXPremiumPlan } from '../lib/x-premium'
import { isGrokPlan } from '../lib/grok'
import { planLabel } from '../lib/plan'
import { cardForTask, maskRedeemCode, productForPlan } from './utils/redeemCard'
import type { RedeemPhase } from './utils/redeemPresentation'
import type { CardView } from './visuals/redeem/contracts'

/** 当前皮肤属于东方意象七主题 → 兑换页走展示外壳。 */
export const mythicPresentation = computed(() => currentSkinMeta.value.family === 'mythic')

export { presentationShells } from './shell-state'

/**
 * 本站套餐键 → 原项目卡面套餐键。认不出的返回 ''（卡面用中性「等待套餐确认」，标签另行覆盖）。
 * 原项目键：go / plus / plus_half / pro5x / pro20x / pro50x / grok_xai_<tier> / x_<basic|premium|premium_plus>_<interval>。
 */
export function presentationPlan(plan: string): string {
  const n = String(plan || '').trim().toLowerCase()
  if (!n) return ''
  if (isXPremiumPlan(n)) {
    const bare = n.replace(/^x_/, '')
    const interval = bare.endsWith('_yearly') ? 'yearly' : 'monthly'
    const tier = bare.replace(/_(monthly|yearly)$/, '')
    if (tier === 'premium') return `x_premium_${interval}`
    if (tier === 'plus') return `x_premium_plus_${interval}`
    return ''
  }
  if (isGrokPlan(n)) {
    const tier = /^(?:grok_)?(plus|premium|super|ultra)_/.exec(n)?.[1]
    return tier ? `grok_xai_${tier}` : ''
  }
  if (n === 'go' || n.includes('chatgptgo')) return 'go'
  if (n === 'plus_half' || n.includes('plus_half')) return 'plus_half'
  if (n.includes('promax') || n.includes('50x')) return 'pro50x'
  if (n.includes('prolite') || n.includes('5x')) return 'pro5x'
  if (n.includes('pro')) return 'pro20x'
  if (n.includes('plus')) return 'plus'
  return ''
}

export interface RechargeAppearanceInput {
  step: number
  busy: boolean
  code: string
  plan: string
  identified: boolean
  /** 卡台订单状态（completed / failed / review …）；error = 提交被拒 */
  resultStatus: string
  /** 订单已到终态（本站 RechargeView 的 TERMINAL 集合） */
  terminal: boolean
  /** 需要兑换者操作（客户自过码 native_captcha） */
  needsAction: boolean
  email: string
  orderId?: string
  createdAt?: number | null
  completedAt?: number | null
  verificationStartedAt?: number | null
}

/** 本站兑换页状态 → 展示阶段（与原项目 RechargeView.appearancePhase 同一套语义）。 */
export function rechargePhase(input: RechargeAppearanceInput): RedeemPhase {
  if (input.step >= 4) {
    const st = String(input.resultStatus || '').toLowerCase()
    if (st === 'completed') return 'success'
    if (input.terminal || st === 'error') return 'failed'
    if (input.needsAction) return 'action'
    return 'processing'
  }
  if (input.busy) return input.step === 3 ? 'submitting' : 'verifying'
  return input.step > 1 ? 'review' : 'idle'
}

/** 卡面数据：认得出的套餐用原项目卡面；认不出的保留中性卡面，但标签换成本站套餐名。 */
export function rechargeCard(input: RechargeAppearanceInput, phase: RedeemPhase): CardView {
  const mapped = input.identified ? presentationPlan(input.plan) : ''
  const card = cardForTask({
    phase,
    plan: mapped,
    identity: maskRedeemCode(input.code),
    taskId: input.orderId || undefined,
    createdAt: input.createdAt ?? null,
    completedAt: input.completedAt ?? null,
    verificationStartedAt: input.verificationStartedAt ?? null,
    serverTime: Date.now(),
    identified: input.identified,
    step: input.step,
    prechecking: input.busy && input.step === 2,
    account: input.email ? input.email.replace(/^(.).+(@.*)$/, '$1•••$2') : '',
  })
  if (input.identified && input.plan && !mapped) {
    const label = planLabel(input.plan)
    card.productData = { ...productForPlan(''), displayLabel: label, officialLabel: label, cardCaption: label }
  }
  return card
}

/** 查询页（/history、/billing）与批量页的卡面：认得出的套餐用原项目卡面，认不出的保留本站套餐名；状态文字由页面给。 */
export function queryCard(input: { phase: RedeemPhase; plan?: string; presentationPlanKey?: string; identified: boolean; identity?: string; taskId?: string; account?: string; quantity?: number; statusLabel?: string }): CardView {
  const mapped = input.presentationPlanKey ?? (input.identified ? presentationPlan(input.plan || '') : '')
  const card = cardForTask({
    phase: input.phase,
    plan: mapped,
    identity: input.identity || undefined,
    taskId: input.taskId || undefined,
    identified: input.identified,
    step: 2,
    account: input.account ? input.account.replace(/^(.).+(@.*)$/, '$1•••$2') : '',
    quantity: input.quantity,
    serverTime: Date.now(),
  })
  if (input.identified && input.plan && !mapped) {
    const label = planLabel(input.plan)
    card.productData = { ...productForPlan(''), displayLabel: label, officialLabel: label, cardCaption: label }
  }
  return input.statusLabel ? { ...card, statusLabel: input.statusLabel } : card
}

/** 批量兑换整体阶段：与原项目 observedRedeemPhase 同义（全完成 = success，全终态 = failed，其余处理中）。 */
export function batchPhase(input: { phase: 'input' | 'run'; verifying: boolean; submitting: boolean; total: number; ok: number; fail: number; run: number; wait: number }): RedeemPhase {
  if (input.verifying) return 'verifying'
  if (input.submitting) return 'submitting'
  if (input.phase === 'input' || !input.total) return 'idle'
  if (input.run > 0) return 'processing'
  if (input.wait > 0) return 'idle'
  if (input.ok === input.total) return 'success'
  if (input.ok + input.fail === input.total) return input.ok > 0 ? 'unknown' : 'failed'
  return 'processing'
}
