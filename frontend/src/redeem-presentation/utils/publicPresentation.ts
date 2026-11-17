// 本站适配版（原文件从 /api/v1/recharge/appearance 读内容并按周轮换主题）。
// 导出名与原文件保持一致，RedeemPresentation.vue 不需要改调用方式：
//  - publicTheme：本站当前皮肤属于东方意象家族时就是皮肤 id（随换肤实时变化），否则回落 atelier；
//  - publicContent：随包 default-content.json + 本站品牌/语言覆盖（见 ../content.ts），不发任何请求；
//  - 明暗不在这里设：完全跟随本站 src/theme.ts。
import { ref, computed } from 'vue'
import type { RedeemContent, RedeemTheme } from './redeemPresentation'
import { buildPresentationContent } from '../content'
import { currentSkinMeta, siteBrand } from '../../theme'
import { i18n } from '../../i18n'

const MYTHIC_THEMES: readonly RedeemTheme[] = ['atelier', 'silk', 'porcelain', 'orbit', 'astral', 'verdant', 'dawn']

export const publicContent = computed<RedeemContent | null>(() => buildPresentationContent(siteBrand.value.name, String(i18n.global.locale.value)))
export const publicTheme = computed<RedeemTheme>(() => {
  const meta = currentSkinMeta.value
  return meta.family === 'mythic' && MYTHIC_THEMES.includes(meta.id as RedeemTheme) ? (meta.id as RedeemTheme) : 'atelier'
})
export const appearanceError = ref(false)
export const appearanceLoading = ref(false)
export const presentationMotion = computed(() => publicContent.value?.presentation.defaultMotion || 'light')

// 原实现用锁阻止「输入中途轮换主题」；本站不轮换，保留空实现以兼容调用。
export function lockPresentation(_owner: symbol, _locked?: boolean) {}
// 原实现用服务器时间锚定；本站无外观接口，直接用本机时钟（只用于卡片计时显示）。
export function publicServerNow() { return Date.now() }
export function refreshPublicTheme() {}
export function destroyPublicPresentation() {}
export function initializePublicPresentation() {}

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Manrope:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap'
export async function loadPublicPresentation() {
  const defaults = publicContent.value?.visitorDefaults
  if (!defaults) return
  document.documentElement.dataset.visitorFonts = String(defaults.onlineFonts)
  document.documentElement.dataset.visitorFontStyle = defaults.fontStyle
  if (defaults.onlineFonts && defaults.fontStyle !== 'system' && !document.getElementById('redeem-webfonts')) {
    const link = document.createElement('link')
    link.id = 'redeem-webfonts'
    link.rel = 'stylesheet'
    link.href = FONT_HREF
    document.head.append(link)
  }
}
