import proSeries from '../presets/products/pro-series.json'
import grokSeries from '../presets/products/grok-series.json'
import xSeries from '../presets/products/x-series.json'

export const X_PRODUCTS = xSeries
export const GROK_PRODUCTS = grokSeries
export const grokCheckoutCurrency = (plan: string, region: string): string => {
  const product = grokSeries.find(item => item.plan_type === plan)
  return product ? (product.checkout_regions as Record<string, string>)[region] || '' : ''
}

export const PRO_DISPLAY_NAMES = Object.fromEntries(proSeries.map(p => [p.plan_type, p.plan_display_name])) as Record<'pro5x' | 'pro20x' | 'pro50x', string>

export const PLAN_OPTIONS = [
  { value: 'go', label: 'Go' },
  { value: 'plus', label: 'Plus' },
  ...proSeries.map(product => ({ value: product.plan_type, label: product.plan_display_name })),
  { value: 'claude_pro', label: 'Claude Pro' },
  { value: 'claude_max5x', label: 'Claude Max 5X' },
  { value: 'claude_max20x', label: 'Claude Max 20X' },
  ...grokSeries.map(product => ({ value: product.plan_type, label: product.plan_display_name })),
  ...xSeries.map(product => ({ value: product.plan_type, label: product.plan_display_name })),
  { value: 'codex_250', label: 'Codex 250' },
  { value: 'codex_500', label: 'Codex 500' },
  { value: 'codex_1000', label: 'Codex 1000' },
] as const

export const CDK_PLAN_OPTIONS = [
  ...PLAN_OPTIONS.slice(0, 2),
  { value: 'plus_half', label: 'Plus半价' },
  ...PLAN_OPTIONS.slice(2),
] as const

export const REGION_OPTIONS = [
  { value: 'PH', label: '菲律宾 (PHP)' },
  { value: 'JP', label: '日本 (JPY)' },
  { value: 'US', label: '美国 (USD)' },
  { value: 'CL', label: '智利 · Chile（CL）' },
  { value: 'EG', label: '埃及 (EGP)' },
] as const

export const defaultCheckoutRegion = (plan?: string | null): string =>
  xSeries.some(product => product.plan_type === plan) ? xSeries.find(product => product.plan_type === plan)?.default_checkout_region || 'US' : grokSeries.some(product => product.plan_type === plan)
    ? grokSeries.find(product => product.plan_type === plan)?.default_checkout_region || 'US'
    : proSeries.find(product => product.plan_type === plan)?.default_checkout_region || 'PH'

export const checkoutRegionAllowed = (plan: string, region: string): boolean => {
  const x = xSeries.find(product => product.plan_type === plan)
  if (x) return Object.hasOwn(x.checkout_regions, region)
  const grok = grokSeries.find(product => product.plan_type === plan)
  if (grok) return Object.hasOwn(grok.checkout_regions, region)
  const product = proSeries.find(product => product.plan_type === plan)
  return product ? product.checkout_regions.includes(region) : REGION_OPTIONS.some(option => option.value === region && region !== 'CL' && region !== 'EG')
}

export const checkoutRegionOptionsForPlan = (plan: string) =>
  REGION_OPTIONS.filter(option => checkoutRegionAllowed(plan, option.value))

export const PROCESSING_MODE_OPTIONS = [
  { value: '', label: '默认 (跟随计划)' },
  { value: 'manual', label: '卡付' },
  { value: 'google_play', label: '谷歌 (Google Play)' },
  { value: 'protocol', label: '协议 (Protocol)' },
] as const

export const CHECKOUT_LOCKS = {
  go: {
    planName: 'chatgptgoplan',
    label: 'Go',
    country: 'PH',
    countryLabel: '菲律宾',
    currency: 'PHP',
  },
  plus: {
    planName: 'chatgptplusplan',
    label: 'Plus',
    country: 'PH',
    countryLabel: '菲律宾',
    currency: 'PHP',
  },
  plus_half: {
    planName: 'chatgptplusplan',
    label: 'Plus半价',
    country: 'PH',
    countryLabel: '菲律宾',
    currency: 'PHP',
  },
  pro5x: {
    planName: 'chatgptprolite',
    label: `${PRO_DISPLAY_NAMES.pro5x}`,
    country: 'PH',
    countryLabel: '菲律宾',
    currency: 'PHP',
  },
  pro20x: {
    planName: 'chatgptplusplan',
    label: `${PRO_DISPLAY_NAMES.pro20x} (Plus→Pro)`,
    country: 'PH',
    countryLabel: '菲律宾',
    currency: 'PHP',
  },
} as const

const CHECKOUT_REGIONS = {
  PH: { country: 'PH', countryLabel: '菲律宾', currency: 'PHP' },
  US: { country: 'US', countryLabel: '美国', currency: 'USD' },
  JP: { country: 'JP', countryLabel: '日本', currency: 'JPY' },
  CL: { country: 'CL', countryLabel: '智利', currency: 'CLP' },
  EG: { country: 'EG', countryLabel: '埃及', currency: 'EGP' },
} as const

export const MINIMUM_REGIONAL_CHECKOUT_EXTENSION_VERSION = '3.99.134'

const parseExtensionVersion = (raw?: string | null) => {
  const parts = String(raw || '').trim().split('.')
  if (parts.length < 3 || parts.length > 4 || parts.some((part) => !/^\d+$/.test(part))) return null
  return parts.map(Number)
}

export const supportsRegionalCheckoutExtension = (region?: string | null, version?: string | null) => {
  const normalizedRegion = String(region || 'PH').trim().toUpperCase()
  if (normalizedRegion === 'PH') return true
  if (normalizedRegion !== 'US' && normalizedRegion !== 'JP') return false
  const current = parseExtensionVersion(version)
  const minimum = parseExtensionVersion(MINIMUM_REGIONAL_CHECKOUT_EXTENSION_VERSION)
  if (!current || !minimum) return false
  const width = Math.max(current.length, minimum.length)
  for (let index = 0; index < width; index += 1) {
    const got = current[index] || 0
    const want = minimum[index] || 0
    if (got !== want) return got > want
  }
  return true
}

const planLabelMap: Record<string, string> = Object.fromEntries(CDK_PLAN_OPTIONS.map((item) => [item.value, item.label]))
Object.assign(planLabelMap, { grok_pro: 'Grok Pro', grok_max5x: 'Grok SuperGrok', grok_max20x: 'Grok SuperGrok 20X' })
const processingModeLabelMap: Record<string, string> = Object.fromEntries(PROCESSING_MODE_OPTIONS.map((item) => [item.value, item.label]))


export const planLabel = (value?: string | null) => {
  if (!value) return '-'
  return planLabelMap[value] || value
}

export const processingModeLabel = (value?: string | null) => {
  if (!value) return '-'
  return processingModeLabelMap[value] || value
}

export const checkoutLockForPlan = (value?: string | null, region: string | null = 'PH') => {
  if (!value) return null
  const lock = CHECKOUT_LOCKS[value as keyof typeof CHECKOUT_LOCKS]
  const normalizedRegion = String(region || 'PH').trim().toUpperCase() as keyof typeof CHECKOUT_REGIONS
  const regionLock = CHECKOUT_REGIONS[normalizedRegion]
  if (!lock || !regionLock || (normalizedRegion === 'CL' || normalizedRegion === 'EG') && !['pro5x', 'pro50x'].includes(value) || value === 'pro50x') return null
  return { ...lock, ...regionLock }
}
