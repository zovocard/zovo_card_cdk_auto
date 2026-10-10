import { describe, expect, it } from 'vitest'

import { isCardAttachPlan, planLabel, planSatisfied } from '../plan'

// Pro 20x 续费档（flow=card_attach）在兑换前的判定。
//
// 背景：续费档卖的是「给已有 Pro 20x 的账号换一张有钱的新卡并设为默认卡」，
// 本单不扣款。它服务的账号**本来就处在 Pro 20x**，所以任何「按套餐高低比大小」
// 的判据都会得出「已满足」——代理侧据此置灰兑换按钮，每一张续费码都兑不出去。
describe('planSatisfied · 绑卡档（Pro 20x 续费）', () => {
  it('账号已是 Pro 20x 时仍必须可买（这是它的服务对象）', () => {
    for (const current of ['pro_20x', 'pro', 'chatgptproplan', 'plus', 'free', '']) {
      expect(planSatisfied(current, 'pro_20x_renew')).toBe(false)
    }
  })

  it('后端下发了 plan_flow 时以后端为准', () => {
    expect(planSatisfied('pro_20x', 'pro_20x_renew', 'card_attach')).toBe(false)
    expect(isCardAttachPlan('unknown_key', 'card_attach')).toBe(true)
  })

  it('普通订阅档的判据不受影响（不能为修一档把别的档放开）', () => {
    expect(planSatisfied('pro_20x', 'pro_20x')).toBe(true)
    expect(planSatisfied('plus', 'pro_20x')).toBe(false)
    expect(planSatisfied('plus', 'pro_5x')).toBe(false)
    expect(planSatisfied('pro_20x', 'plus')).toBe(true)
    expect(planSatisfied('free', 'plus')).toBe(false)
  })

  it('点数档永远不判「已满足」（买点数不改变账号套餐）', () => {
    expect(planSatisfied('pro_20x', 'credit250')).toBe(false)
  })
})

describe('planLabel', () => {

  it('50x is distinct from 20x and allows upgrades from existing lower subscriptions', () => {
    for (const current of ['plus', 'prolite', 'pro', 'pro_20x', 'chatgptpro']) {
      expect(planSatisfied(current, 'pro_50x')).toBe(false)
    }
    for (const current of ['pro_50x', 'promax', 'chatgptpromaxplan']) {
      expect(planLabel(current)).toBe('Pro 50x')
      expect(planSatisfied(current, 'pro_50x')).toBe(true)
      expect(planSatisfied(current, 'pro_20x')).toBe(true)
      expect(planSatisfied(current, 'credit25000')).toBe(false)
    }
  })
  it('续费档要能看出是「续费」，不能被显示成 Pro 20x', () => {
    expect(planLabel('pro_20x_renew')).toBe('Pro 20x 续费')
    expect(planLabel('pro_5x_renew')).toBe('Pro 5x 续费')
    expect(isCardAttachPlan('pro_5x_renew')).toBe(true)
  })

  it('既有档位文案不变', () => {
    expect(planLabel('pro_20x')).toBe('Pro 20x')
    expect(planLabel('pro')).toBe('Pro 20x')
    expect(planLabel('pro_5x')).toBe('Pro 5x')
    expect(planLabel('chatgptprolite')).toBe('Pro 5x')
    expect(planLabel('plus')).toBe('Plus')
    expect(planLabel('free')).toBe('免费版')
  })
})
