import { describe, expect, it, vi } from 'vitest'

// src/theme.ts 在模块加载时读 localStorage；node 环境下给一个内存实现（本仓库未装 jsdom）。
vi.hoisted(() => {
  const store = new Map<string, string>()
  ;(globalThis as any).localStorage ??= {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  }
})
import { batchPhase, presentationPlan, queryCard, rechargeCard, rechargePhase, type RechargeAppearanceInput } from '../../redeem-presentation/adapter'
import { buildPresentationContent } from '../../redeem-presentation/content'
import { isRedeemContent } from '../../redeem-presentation/utils/redeemPresentation'

const base: RechargeAppearanceInput = { step: 1, busy: false, code: '', plan: '', identified: false, resultStatus: '', terminal: false, needsAction: false, email: '' }

describe('东方意象展示层接入：套餐映射', () => {
  it('本站套餐键映射到原项目卡面键', () => {
    expect(presentationPlan('plus')).toBe('plus')
    expect(presentationPlan('plus_half')).toBe('plus_half')
    expect(presentationPlan('pro_5x')).toBe('pro5x')
    expect(presentationPlan('pro_20x')).toBe('pro20x')
    expect(presentationPlan('pro_20x_renew')).toBe('pro20x')
    expect(presentationPlan('pro_50x')).toBe('pro50x')
    expect(presentationPlan('grok_super_monthly')).toBe('grok_xai_super')
    expect(presentationPlan('x_premium_monthly')).toBe('x_premium_monthly')
    expect(presentationPlan('team')).toBe('')
    expect(presentationPlan('')).toBe('')
  })

  it('未识别时是「等待识别」卡；认不出的套餐保留本站名称', () => {
    expect(rechargeCard(base, 'idle').productData.id).toBe('unidentified')
    const team = rechargeCard({ ...base, step: 2, plan: 'team', identified: true }, 'review')
    expect(team.productData.displayLabel).toBe('Team')
    expect(rechargeCard({ ...base, step: 2, plan: 'plus', identified: true }, 'review').productData.id).toBe('plus')
  })
})

describe('东方意象展示层接入：阶段映射', () => {
  it('按步骤与结果状态给出展示阶段', () => {
    expect(rechargePhase(base)).toBe('idle')
    expect(rechargePhase({ ...base, busy: true })).toBe('verifying')
    expect(rechargePhase({ ...base, step: 3 })).toBe('review')
    expect(rechargePhase({ ...base, step: 3, busy: true })).toBe('submitting')
    expect(rechargePhase({ ...base, step: 4, resultStatus: 'processing' })).toBe('processing')
    expect(rechargePhase({ ...base, step: 4, resultStatus: 'processing', needsAction: true })).toBe('action')
    expect(rechargePhase({ ...base, step: 4, resultStatus: 'completed', terminal: true })).toBe('success')
    expect(rechargePhase({ ...base, step: 4, resultStatus: 'failed', terminal: true })).toBe('failed')
  })
})

describe('东方意象展示层接入：随包内容', () => {
  it('覆盖后的内容仍满足原项目的内容校验，且不再出现原品牌', () => {
    for (const locale of ['zh', 'en']) {
      const content = buildPresentationContent('Demo Brand', locale)
      expect(isRedeemContent(content)).toBe(true)
      expect(JSON.stringify(content)).not.toMatch(/RedeemAI|REDEEMAI/)
      expect(content.navigation.filter((link) => link.enabled).map((link) => link.url)).toEqual(['/recharge', '/batch', '/history', '/billing'])
    }
  })
})

describe('东方意象展示层接入：查询页与批量页', () => {
  it('查询页卡面：未查询是「等待识别」，查到后用对应套餐并带页面给的状态文字', () => {
    expect(queryCard({ phase: 'idle', identified: false, statusLabel: '查询后显示原任务' }).statusLabel).toBe('查询后显示原任务')
    expect(queryCard({ phase: 'idle', identified: false }).productData.id).toBe('unidentified')
    const used = queryCard({ phase: 'success', plan: 'pro_20x', identified: true, statusLabel: '使用成功' })
    expect(used.productData.id).toBe('pro-more')
    expect(used.statusLabel).toBe('使用成功')
    expect(queryCard({ phase: 'identified', presentationPlanKey: 'plus', identified: true }).productData.id).toBe('plus')
  })

  it('批量整体阶段：全成功 = success，全失败 = failed，有进行中 = processing', () => {
    const base = { phase: 'run' as const, verifying: false, submitting: false, total: 3, ok: 0, fail: 0, run: 0, wait: 0 }
    expect(batchPhase({ ...base, phase: 'input' })).toBe('idle')
    expect(batchPhase({ ...base, verifying: true })).toBe('verifying')
    expect(batchPhase({ ...base, submitting: true })).toBe('submitting')
    expect(batchPhase({ ...base, run: 1, ok: 2 })).toBe('processing')
    expect(batchPhase({ ...base, wait: 3 })).toBe('idle')
    expect(batchPhase({ ...base, ok: 3 })).toBe('success')
    expect(batchPhase({ ...base, fail: 3 })).toBe('failed')
    expect(batchPhase({ ...base, ok: 1, fail: 2 })).toBe('unknown')
  })
})
