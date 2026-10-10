import { describe, expect, it } from 'vitest'
import { grokCredential, grokPlanLabel, isGrokCredential, isGrokPlan } from '../grok'
import { isXPremiumPlan } from '../x-premium'
import { planLabel, planSatisfied } from '../plan'
import { extractCdkSession } from '../batch-session'

describe('Grok plans', () => {
  it('recognises bare and prefixed Grok keys without touching GPT / X keys', () => {
    for (const p of ['monthly', 'yearly', 'lite_monthly', 'plus_yearly', 'heavy_monthly', 'grok_heavy_yearly']) {
      expect(isGrokPlan(p)).toBe(true)
    }
    for (const p of ['plus', 'pro_20x', 'pro_20x_renew', 'credit250', 'go', 'premium_monthly', 'basic_yearly', 'premium_plus_monthly']) {
      expect(isGrokPlan(p)).toBe(false)
    }
    expect(isXPremiumPlan('plus_monthly')).toBe(false)
  })
  it('labels Grok plans and compares them exactly (tiers are parallel product lines)', () => {
    expect(grokPlanLabel('monthly')).toBe('Grok SuperGrok / 月')
    expect(planLabel('grok_heavy_yearly')).toBe('Grok SuperGrok Heavy / 年')
    expect(planSatisfied('monthly', 'grok_monthly')).toBe(true)
    expect(planSatisfied('heavy_monthly', 'monthly')).toBe(false)
    expect(planSatisfied('monthly', 'yearly')).toBe(false)
  })
})

describe('Grok credential', () => {
  const value = 'eyJhbGciOiJIUzI1NiJ9.abcdefghijklmnop.signature_value'
  it('accepts a cookie header or a bare sso value', () => {
    expect(grokCredential('sso=' + value)).toBe('sso=' + value)
    expect(grokCredential('sso-rw=' + value + '; sso=' + value)).toBe('sso-rw=' + value + '; sso=' + value)
    expect(grokCredential('  ' + value + '  ')).toBe('sso=' + value)
  })
  it('rejects empty, multi-line, JSON and too-short input', () => {
    expect(grokCredential('')).toBe('')
    expect(grokCredential('sso=a\nb')).toBe('')
    expect(grokCredential('{"sessionToken":"x"}')).toBe('')
    expect(grokCredential('short')).toBe('')
  })
  it('batch import keeps cookie-form Grok credentials but not GPT JSON', () => {
    expect(isGrokCredential('sso=' + value)).toBe(true)
    expect(isGrokCredential(value)).toBe(false)
    expect(extractCdkSession('sso=' + value)).toBe('sso=' + value)
  })
})
