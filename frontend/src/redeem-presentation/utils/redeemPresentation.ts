import type { TaskBillingObservation } from './taskBilling'
import names from '../visuals/redeem/theme-names.json'
// @ts-ignore 与获批参考同源的纯排期算法。
import { validate as validateRotation } from '../visuals/redeem/runtime/rotation.js'
export const presentationKey = 'REDEEM_PRESENTATION_CONTENT'
export const redeemThemes = ['classic', 'atelier', 'silk', 'porcelain', 'orbit', 'astral', 'verdant', 'dawn'] as const
export type RedeemTheme = typeof redeemThemes[number]
export type RedeemMotion = 'full' | 'light' | 'static'
export type RedeemPhase = 'idle' | 'focused' | 'verifying' | 'identified' | 'review' | 'submitting' | 'processing' | 'success' | 'unknown' | 'failed' | 'action'
export const copyLabels = { inputTitle: '输入区标题', inputLabel: '兑换码标签', placeholder: '兑换码占位文案', inputHint: '输入提示', verifyLabel: '校验按钮', confirmLabel: '普通确认按钮', guideLabel: '指南按钮', appearanceLabel: '外观按钮', reviewIntro: '核对页说明' }
export const templateLabels = { name: '外观名称', eyebrow: '标题上方短句', titleFirst: '标题首行', titleSecond: '标题次行', description: '说明', caption: '页尾短句', overline: '表单上方短句' }
export type ContentLink = { id: string; label: string; description: string; url: string; target: '_self' | '_blank'; enabled: boolean }
export type RedeemContent = {
  visitorDefaults: {fontStyle:'editorial'|'modern'|'system';onlineFonts:boolean;light:'auto'|'system'|'day'|'night';musicVolume:number;musicAutoplay:boolean}
  themeRotation: {enabled:boolean;timezone:string;anchorMonday:string;seed:string;revision:number;order:Exclude<RedeemTheme,'classic'>[]}
  schemaVersion: 1; brand: string; footerText: string
  navigation: ContentLink[]; footerLinks: ContentLink[]
  copy: Record<keyof typeof copyLabels, string>
  guide: { title: string; intro: string; steps: Array<{id: string; title: string; body: string}>; faq: Array<{id: string; question: string; answer: string}> }
  presentation: { defaultTemplate: RedeemTheme; enabledTemplates: RedeemTheme[]; allowSwitch: boolean; defaultMotion: RedeemMotion }
  templates: Record<Exclude<RedeemTheme, 'classic'>, Record<keyof typeof templateLabels, string> & {backgroundEnabled: boolean}>
}
export function safePresentationLink(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 1000 || /[\x00-\x20\x7f\\"<>]/.test(value)) return false
  if (value.startsWith('#')) return /^#[A-Za-z][\w:-]*$/.test(value)
  try {
    const decoded = decodeURIComponent(value)
    if (/[\x00-\x20\x7f\\"<>]/.test(decoded)) return false
    if (value.startsWith('/')) return !decoded.startsWith('//')
    const url = new URL(value)
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password
  } catch { return false }
}
// 服务器校验完整长度和字段合同；客户端还须拒绝不完整回执及危险辅助链接。
export function isRedeemContent(c: any): c is RedeemContent {
  const strings = (o: any, keys: string[]) => !!o && keys.every(k => typeof o[k] === 'string')
  const links = (rows: any) => Array.isArray(rows) && rows.every(r => strings(r, ['id','label','description']) && safePresentationLink(r.url) && ['_self','_blank'].includes(r.target) && typeof r.enabled === 'boolean')
  if (!c || c.schemaVersion !== 1 || !strings(c,['brand','footerText']) || !links(c.navigation) || !links(c.footerLinks) || !strings(c.copy,Object.keys(copyLabels))) return false
  if (!strings(c.guide,['title','intro']) || !Array.isArray(c.guide.steps) || !c.guide.steps.length || !c.guide.steps.every((s: any) => strings(s,['id','title','body'])) || !Array.isArray(c.guide.faq) || !c.guide.faq.every((f: any) => strings(f,['id','question','answer']))) return false
  if (!redeemThemes.slice(1).every(key => strings(c.templates?.[key],Object.keys(templateLabels)) && typeof c.templates[key].backgroundEnabled === 'boolean')) return false
  const v = c.visitorDefaults
  if (!v || !['editorial','modern','system'].includes(v.fontStyle) || typeof v.onlineFonts !== 'boolean' || typeof v.musicAutoplay !== 'boolean' || !['auto','system','day','night'].includes(v.light) || typeof v.musicVolume !== 'number' || !Number.isFinite(v.musicVolume) || v.musicVolume < 0 || v.musicVolume > .5) return false
  try { validateRotation(c.themeRotation) } catch { return false }
  const p = c.presentation
  return !!p && Array.isArray(p.enabledTemplates) && p.enabledTemplates.includes('classic') && p.enabledTemplates.every((v: any) => redeemThemes.includes(v)) && new Set(p.enabledTemplates).size === p.enabledTemplates.length && p.enabledTemplates.includes(p.defaultTemplate) && typeof p.allowSwitch === 'boolean' && ['full','light','static'].includes(p.defaultMotion)
}

export function redeemThemeName(theme: RedeemTheme, content?: RedeemContent|null) { return theme === 'classic' ? 'Classic' : content?.templates[theme]?.name || names[theme] }
export type RedeemObservedState = {taskId: string; status: string; needsAttention: boolean; verificationState?:string; billing?:TaskBillingObservation|null; createdAt?:number|null; completedAt?:number|null; stoppedAt?:number|null; serverTime?:number|null}
// 只映射原任务读回。受理和验证提交都不是成功，未识别结果保留 unknown。
export function observedRedeemPhase(tasks: RedeemObservedState[]): RedeemPhase {
  if (!tasks.length) return 'processing'
  if (tasks.every(t=>t.status==='completed')) return 'success'
  if (tasks.some(t=>t.needsAttention && !['completed','failed','cancelled','refunded'].includes(t.status))) return 'action'
  if (tasks.some(t=>!['completed','failed','cancelled','refunded','pending','queued','submitted','processing','completing','captcha_required'].includes(t.status))) return 'unknown'
  if (tasks.every(t=>['completed','failed','cancelled','refunded'].includes(t.status))) return 'failed'
  return 'processing'
}
const redeemInProgress = new Set(['pending', 'queued', 'submitted', 'processing', 'completing', 'captcha_required'])
// 读回仍是处理中、但公开结论已是未知时，卡片和右栏必须同一状态。
export function redeemObservationStatus(status: string, feedbackCode: string, needsAttention: boolean): string {
  if (feedbackCode === 'unknown' && !needsAttention && redeemInProgress.has(status)) return 'result_unconfirmed'
  return status
}
