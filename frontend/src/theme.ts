// 整站主题包：颜色 + 字体 + 圆角 + 密度 + 导航 + 布局壳（原子应用，避免半套换肤）
import { ref, computed } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'auto'
export type SkinId =
  | 'zovo'
  | 'terracotta'
  | 'ember'
  | 'ocean'
  | 'cyber'
  | 'forest'
  | 'violet'
  | 'slate'
  | 'rose'
  | 'noir'
  | 'paper'
  // 东方意象七主题（移植自 autocard 项目，原作者授权开源使用，2026-11-17）
  | 'atelier'
  | 'silk'
  | 'porcelain'
  | 'orbit'
  | 'astral'
  | 'verdant'
  | 'dawn'

const MODE_KEY = 'theme-mode'
const SKIN_KEY = 'site-skin'
const BRAND_KEY = 'site-brand'
/** 首屏脚本(index.html)用的皮肤摘要：是否默认暗色 + 后台布局。由这里写，index.html 只读，皮肤清单只维护 SKINS 一处 */
const BOOT_KEY = 'site-skin-boot'

export interface SiteBrand {
  name: string
  sub: string
}

export interface SkinMeta {
  id: SkinId
  label: string
  labelEn: string
  swatch: string
  swatch2: string
  blurb: string
  heading: 'serif' | 'sans' | 'display' | 'mono'
  density: 'comfy' | 'compact' | 'airy'
  nav: 'pill' | 'underline' | 'block'
  /** 管理端壳层布局 */
  layout: 'top' | 'sidebar' | 'rail'
  /** 是否默认走暗色（如 cyber/ember/noir） */
  preferDark?: boolean
  /** 主色，用于同步 Element Plus */
  primary: string
  primaryOn?: string
  /** 亮色模式下另用一套主色（同一皮肤明暗两套配色时，如卡台新版 曜夜/流金） */
  primaryLight?: string
  primaryOnLight?: string
  /** 该皮肤用到的 Google 字体（css2 family 参数），切换皮肤时按需加载 */
  fonts: string[]
  /** 皮肤家族：mythic = 东方意象七主题（共用性格样式、印章 logo、canvas 背景氛围） */
  family?: 'mythic'
}

// 各皮肤共用的等宽字体（金额、卡密、表格数字）
const MONO_FONT = 'JetBrains+Mono:wght@400;500;600'
const SERIF_SC = 'Noto+Serif+SC:wght@500;600;700'
const MYTHIC_FONTS = ['Manrope:wght@400;500;600;700', 'Cormorant+Garamond:wght@500;600;700', SERIF_SC]

export const SKINS: SkinMeta[] = [
  {
    // 与卡台新版 UI 同一套设计语言：夜间=曜夜（深黑 + 雾金），日间=流金（象牙 + 暗金）
    id: 'zovo',
    label: '卡台新版',
    labelEn: 'ZovoCard',
    swatch: '#cbb079',
    swatch2: '#0c0c11',
    blurb: '曜夜雾金 · 玻璃面板 · 与卡台新版一致',
    heading: 'display',
    density: 'comfy',
    nav: 'pill',
    layout: 'top',
    primary: '#cbb079',
    primaryOn: '#07070a',
    primaryLight: '#9c7c3c',
    primaryOnLight: '#fffdf7',
    fonts: ['Manrope:wght@400;500;600;700', 'Sora:wght@500;600;700', 'Cormorant+Garamond:wght@500;600;700', SERIF_SC],
  },
  {
    id: 'terracotta',
    label: '赤陶奶油',
    labelEn: 'Terracotta',
    swatch: '#c0563a',
    swatch2: '#f2ede4',
    blurb: '衬线标题 · 釉面胶囊按钮 · 奶油纸面',
    heading: 'serif',
    density: 'comfy',
    nav: 'pill',
    layout: 'top',
    primary: '#c0563a',
    fonts: ['Inter:wght@400;500;600;700', 'Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,700', SERIF_SC],
  },
  {
    id: 'cyber',
    label: '赛博科技',
    labelEn: 'Cyber',
    swatch: '#22d3ee',
    swatch2: '#0b1020',
    blurb: '切角按钮 · HUD 角标面板 · 等宽大写 · 霓虹',
    heading: 'mono',
    density: 'compact',
    nav: 'block',
    layout: 'sidebar',
    preferDark: true,
    primary: '#22d3ee',
    primaryOn: '#041016',
    fonts: ['DM+Sans:wght@400;500;600;700', 'Space+Grotesk:wght@500;600;700'],
  },
  {
    id: 'ocean',
    label: '苹果玻璃',
    labelEn: 'Ocean',
    swatch: '#2563eb',
    swatch2: '#eef4fb',
    blurb: '大圆角白卡 · 渐变胶囊按钮 · iOS 分段页签',
    heading: 'sans',
    density: 'compact',
    nav: 'block',
    layout: 'top',
    primary: '#2563eb',
    fonts: ['Inter:wght@400;500;600;700', 'Outfit:wght@500;600;700'],
  },
  {
    id: 'ember',
    label: '熔岩霓光',
    labelEn: 'Ember',
    swatch: '#ff854a',
    swatch2: '#140b08',
    blurb: '熔岩渐变按钮 · 外发光掠光 · 渐变描边面板',
    heading: 'display',
    density: 'comfy',
    nav: 'pill',
    layout: 'top',
    preferDark: true,
    primary: '#ff854a',
    primaryOn: '#1a0c08',
    fonts: ['Inter:wght@400;500;600;700', 'Space+Grotesk:wght@500;600;700'],
  },
  {
    id: 'forest',
    label: '薄荷清新',
    labelEn: 'Forest',
    swatch: '#059669',
    swatch2: '#eef6f1',
    blurb: '薄荷渐变底 · 左侧色条卡片 · 实心翠绿按钮',
    heading: 'sans',
    density: 'airy',
    nav: 'pill',
    layout: 'top',
    primary: '#059669',
    fonts: ['Inter:wght@400;500;600;700', 'Outfit:wght@500;600;700'],
  },
  {
    id: 'violet',
    label: '靛紫重磅',
    labelEn: 'Violet',
    swatch: '#7c3aed',
    swatch2: '#f4f0fb',
    blurb: '极粗标题 · 墨蓝主按钮 · 方块步骤号',
    heading: 'display',
    density: 'comfy',
    nav: 'underline',
    layout: 'top',
    primary: '#7c3aed',
    fonts: ['Inter:wght@400;500;600;700', 'Space+Grotesk:wght@500;600;700'],
  },
  {
    id: 'slate',
    label: '黑白控制台',
    labelEn: 'Slate',
    swatch: '#475569',
    swatch2: '#f1f5f9',
    blurb: '黑色胶囊按钮 · 等宽小标签 · 超大标题',
    heading: 'mono',
    density: 'compact',
    nav: 'block',
    layout: 'rail',
    primary: '#475569',
    fonts: ['DM+Sans:wght@400;500;600;700'],
  },
  {
    id: 'rose',
    label: '玫瑰杂志',
    labelEn: 'Rose',
    swatch: '#e11d48',
    swatch2: '#fdf2f4',
    blurb: '斜体衬线大标题 · 方角大写按钮 · 下划线页签',
    heading: 'serif',
    density: 'airy',
    nav: 'underline',
    layout: 'top',
    primary: '#e11d48',
    fonts: ['Inter:wght@400;500;600;700', 'Instrument+Serif:ital@0;1', 'Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,700', SERIF_SC],
  },
  {
    id: 'noir',
    label: '粗野主义',
    labelEn: 'Noir',
    swatch: '#e5e5e5',
    swatch2: '#0a0a0a',
    blurb: '粗描边 · 硬投影 · 按下回弹',
    heading: 'display',
    density: 'compact',
    nav: 'block',
    layout: 'top',
    preferDark: true,
    primary: '#fafafa',
    primaryOn: '#0a0a0a',
    fonts: ['DM+Sans:wght@400;500;600;700', 'Space+Grotesk:wght@500;600;700'],
  },
  {
    id: 'paper',
    label: '纸感笔记',
    labelEn: 'Paper',
    swatch: '#8b7355',
    swatch2: '#f7f3ea',
    blurb: '横线纸底 · 胶带面板 · 印章按钮',
    heading: 'serif',
    density: 'comfy',
    nav: 'underline',
    layout: 'top',
    primary: '#8b5e34',
    fonts: ['Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700', SERIF_SC],
  },
  {
    id: 'atelier',
    label: '天阙云殿',
    labelEn: 'Celestial Terrace',
    swatch: '#d3ba89',
    swatch2: '#171613',
    blurb: '云阙金工 · 云台流云 · 香槟金',
    heading: 'serif',
    density: 'airy',
    nav: 'underline',
    layout: 'top',
    primary: '#d3ba89',
    primaryOn: '#1c211e',
    primaryLight: '#785723',
    primaryOnLight: '#fffcf7',
    family: 'mythic',
    fonts: MYTHIC_FONTS,
  },
  {
    id: 'silk',
    label: '流霞天绫',
    labelEn: 'Silk Brocade',
    swatch: '#e0b089',
    swatch2: '#201812',
    blurb: '云锦流霞 · 天绫丝线 · 暖铜缎金',
    heading: 'serif',
    density: 'airy',
    nav: 'underline',
    layout: 'top',
    primary: '#e0b089',
    primaryOn: '#1c211e',
    primaryLight: '#8a552e',
    primaryOnLight: '#fffcf7',
    family: 'mythic',
    fonts: MYTHIC_FONTS,
  },
  {
    id: 'porcelain',
    label: '月魄玉璧',
    labelEn: 'Lunar Jade',
    swatch: '#b3cfc4',
    swatch2: '#172320',
    blurb: '月华清辉 · 玉璧圆月 · 珍珠白',
    heading: 'serif',
    density: 'airy',
    nav: 'underline',
    layout: 'top',
    primary: '#b3cfc4',
    primaryOn: '#1c211e',
    primaryLight: '#386b5d',
    primaryOnLight: '#fffcf7',
    family: 'mythic',
    fonts: MYTHIC_FONTS,
  },
  {
    id: 'orbit',
    label: '星宿天衡',
    labelEn: 'Armillary',
    swatch: '#c1b4e5',
    swatch2: '#1b1726',
    blurb: '天衡浑仪 · 星宿连线 · 烟紫钛',
    heading: 'serif',
    density: 'airy',
    nav: 'underline',
    layout: 'top',
    primary: '#c1b4e5',
    primaryOn: '#1c211e',
    primaryLight: '#675089',
    primaryOnLight: '#fffcf7',
    family: 'mythic',
    fonts: MYTHIC_FONTS,
  },
  {
    id: 'astral',
    label: '辰海天河',
    labelEn: 'River of Stars',
    swatch: '#9fbfe5',
    swatch2: '#111c2a',
    blurb: '天河星辉 · 流动星尘 · 午夜蓝',
    heading: 'serif',
    density: 'airy',
    nav: 'underline',
    layout: 'top',
    primary: '#9fbfe5',
    primaryOn: '#1c211e',
    primaryLight: '#3a638f',
    primaryOnLight: '#fffcf7',
    family: 'mythic',
    fonts: MYTHIC_FONTS,
  },
  {
    id: 'verdant',
    label: '青玉山海',
    labelEn: 'Jade Ranges',
    swatch: '#a9cba6',
    swatch2: '#142219',
    blurb: '山岚灵玉 · 层叠山脊 · 祖母绿',
    heading: 'serif',
    density: 'airy',
    nav: 'underline',
    layout: 'top',
    primary: '#a9cba6',
    primaryOn: '#1c211e',
    primaryLight: '#376a47',
    primaryOnLight: '#fffcf7',
    family: 'mythic',
    fonts: MYTHIC_FONTS,
  },
  {
    id: 'dawn',
    label: '曦羽流霞',
    labelEn: 'Dawn Plumes',
    swatch: '#e0b5ad',
    swatch2: '#261b20',
    blurb: '曦羽烟玫 · 半透羽翎 · 珠光',
    heading: 'serif',
    density: 'airy',
    nav: 'underline',
    layout: 'top',
    primary: '#e0b5ad',
    primaryOn: '#1c211e',
    primaryLight: '#92584f',
    primaryOnLight: '#fffcf7',
    family: 'mythic',
    fonts: MYTHIC_FONTS,
  },
]

function readSkin(): SkinId {
  const v = localStorage.getItem(SKIN_KEY) as SkinId
  return SKINS.some((s) => s.id === v) ? v : 'zovo'
}

// 默认：卡台新版 + 夜间（与 index.html 首屏脚本、后端 /public/site 默认值保持一致）
export const themeMode = ref<ThemeMode>((localStorage.getItem(MODE_KEY) as ThemeMode) || 'dark')
export const siteSkin = ref<SkinId>(readSkin())

function loadBrand(): SiteBrand {
  try {
    const raw = localStorage.getItem(BRAND_KEY)
    if (raw) {
      const o = JSON.parse(raw)
      if (o?.name) return { name: String(o.name), sub: String(o.sub || '') }
    }
  } catch { /* ignore */ }
  return { name: 'CDK Portal', sub: 'Card Platform Redeem' }
}

export const siteBrand = ref<SiteBrand>(loadBrand())

function systemPrefersDark(): boolean {
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
}

export function isDark(): boolean {
  const meta = currentSkinMeta.value
  // preferDark 皮肤在 light 模式下仍用皮肤自身暗色 token；.dark 类只在用户选 dark/auto-dark 时加
  if (themeMode.value === 'auto') return systemPrefersDark()
  return themeMode.value === 'dark'
}

export const currentSkinMeta = computed(() => SKINS.find((s) => s.id === siteSkin.value) || SKINS[0])

/** 由主色生成 EP light/dark 阶梯 */
function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '').trim()
  if (h.length === 3) {
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]
  }
  if (h.length !== 6) return null
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function mix(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t)
}

function mixHex(hex: string, toward: 'white' | 'black', t: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const target = toward === 'white' ? 255 : 0
  const [r, g, b] = rgb.map((c) => mix(c, target, t))
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

function syncElementPlus(primary: string, primaryOn: string, dark: boolean) {
  const root = document.documentElement
  const set = (k: string, v: string) => root.style.setProperty(k, v)
  // 「浅色阶梯」是标签/选中行等的底色：暗色下要往黑混，往白混会在深底上冒出一块块近白色
  const toward = dark ? 'black' : 'white'
  set('--el-color-primary', primary)
  set('--el-color-primary-light-3', mixHex(primary, toward, 0.3))
  set('--el-color-primary-light-5', mixHex(primary, toward, 0.5))
  set('--el-color-primary-light-7', mixHex(primary, toward, 0.7))
  set('--el-color-primary-light-8', mixHex(primary, toward, 0.8))
  set('--el-color-primary-light-9', mixHex(primary, toward, 0.9))
  set('--el-color-primary-dark-2', mixHex(primary, dark ? 'white' : 'black', 0.2))
  // 按钮跟主色，禁止写死赤陶
  set('--el-button-bg-color', primary)
  set('--el-button-border-color', primary)
  set('--el-button-hover-bg-color', mixHex(primary, 'white', 0.12))
  set('--el-button-hover-border-color', mixHex(primary, 'white', 0.12))
  set('--el-button-active-bg-color', mixHex(primary, 'black', 0.12))
  set('--el-button-active-border-color', mixHex(primary, 'black', 0.12))
  set('--el-button-text-color', primaryOn)
  set('--el-color-white', primaryOn)
  set('--el-font-family', 'var(--font-sans)')
  set('--el-border-radius-base', 'var(--radius-md)')
  // 同步语义色给 EP
  set('--el-bg-color', 'var(--surface)')
  set('--el-bg-color-page', 'var(--bg)')
  // 弹层（下拉/弹窗/提示）必须不透明：玻璃质感皮肤的 --surface 是半透明的
  set('--el-bg-color-overlay', 'var(--surface-solid)')
  set('--el-fill-color-blank', 'var(--surface)')
  set('--el-text-color-primary', 'var(--ink)')
  set('--el-text-color-regular', 'var(--ink-2)')
  set('--el-text-color-secondary', 'var(--ink-3)')
  set('--el-border-color', 'var(--brd)')
  set('--el-border-color-light', 'var(--brd)')
  set('--el-border-color-lighter', 'var(--brd)')
  set('--el-mask-color', 'rgba(0,0,0,.45)')
}

function applyMode() {
  document.documentElement.classList.toggle('dark', isDark())
}

function applySkin() {
  const meta = currentSkinMeta.value
  const root = document.documentElement
  // 原子写入：同一帧内改完所有属性，减少半套样式
  root.setAttribute('data-skin', meta.id)
  root.setAttribute('data-heading', meta.heading)
  root.setAttribute('data-density', meta.density)
  root.setAttribute('data-nav', meta.nav)
  root.setAttribute('data-layout', meta.layout)
  if (meta.family) root.setAttribute('data-family', meta.family)
  else root.removeAttribute('data-family')
  // preferDark 皮肤：若用户未显式选 light，自动保证暗色 class 与皮肤一致
  if (meta.preferDark && themeMode.value === 'light') {
    // 允许 light，但皮肤 CSS 本身已是暗色 token；不强制改 mode
  }
  const dark = isDark() || !!meta.preferDark
  const primary = !dark && meta.primaryLight ? meta.primaryLight : meta.primary
  const primaryOn = !dark && meta.primaryOnLight ? meta.primaryOnLight : (meta.primaryOn || '#ffffff')
  syncElementPlus(primary, primaryOn, dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
  try {
    localStorage.setItem(BOOT_KEY, JSON.stringify({ skin: meta.id, preferDark: !!meta.preferDark, layout: meta.layout, family: meta.family || '' }))
  } catch { /* 隐私模式等写不进去：首屏退回默认，样式表到达后照常 */ }
  ensureSkinFonts(meta)
}

// 字体按皮肤按需加载：原来 index.html 一次拉 9 个字族（含中文 Noto Sans/Serif SC）且阻塞渲染。
// 不阻塞首屏：字体到了再换（display=swap），没到之前用系统字体。
const loadedFontHref = new Set<string>()
function ensureSkinFonts(meta: SkinMeta) {
  const families = [...meta.fonts, MONO_FONT].map((f) => `family=${f}`).join('&')
  const href = `https://fonts.googleapis.com/css2?${families}&display=swap`
  if (loadedFontHref.has(href) || document.querySelector(`link[data-skin-fonts="${meta.id}"]`)) {
    loadedFontHref.add(href)
    return
  }
  loadedFontHref.add(href)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  link.dataset.skinFonts = meta.id
  document.head.appendChild(link)
}

/** 统一入口：皮肤 + 明暗 一次刷完 */
export function applyThemeAll() {
  applyMode()
  applySkin()
}

export function setTheme(mode: ThemeMode) {
  themeMode.value = mode
  localStorage.setItem(MODE_KEY, mode)
  applyThemeAll()
}

export function toggleTheme() {
  setTheme(isDark() ? 'light' : 'dark')
}

export function setSkin(id: SkinId) {
  if (!SKINS.some((s) => s.id === id)) return
  siteSkin.value = id
  localStorage.setItem(SKIN_KEY, id)
  const meta = SKINS.find((s) => s.id === id)!
  // 切到 preferDark 皮肤时，若当前是 light 且用户没刻意锁 light，可自动转 dark 以完整适配
  if (meta.preferDark && themeMode.value === 'light') {
    themeMode.value = 'dark'
    localStorage.setItem(MODE_KEY, 'dark')
  }
  applyThemeAll()
}

export function setSiteBrand(patch: Partial<SiteBrand>) {
  siteBrand.value = {
    name: (patch.name ?? siteBrand.value.name).trim() || 'CDK Portal',
    sub: (patch.sub ?? siteBrand.value.sub).trim(),
  }
  localStorage.setItem(BRAND_KEY, JSON.stringify(siteBrand.value))
}

export function initTheme() {
  applyThemeAll()
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (themeMode.value === 'auto') applyThemeAll()
    })
  }
}
