/** Public presentation context; no HTTP, storage, account parsing or global DOM writes. */
import { computed, inject, provide, type InjectionKey, type Ref } from 'vue'
export const REALMS = ['atelier','silk','porcelain','orbit','astral','verdant','dawn'] as const
export type Realm = typeof REALMS[number]
export type Light = 'light' | 'dark'
export const COLOR_KEYS = ['ink','muted','accent','on-accent','panel','input','soft','line','success','success-soft','warning','warning-soft','danger','danger-soft'] as const
export type ColorKey = typeof COLOR_KEYS[number]
export type SurfaceColors = Record<ColorKey,string>
export interface SurfaceTheme { realm: Realm; lighting: Light; colors: SurfaceColors }
export interface TonePalette { base: string; surface: string; ink: string; muted: string; accent: string }
const CONTEXT: InjectionKey<Readonly<Ref<SurfaceTheme | null>>> = Symbol('redeem-public-surfaces')
const FALLBACK_DARK: SurfaceColors = {ink:'#e4ebf2',muted:'#b0bdca',accent:'#bdd2e7','on-accent':'#152735',panel:'#192a39',input:'#213344',soft:'#aec6df12',line:'#b5cce535',success:'#a6d4bd','success-soft':'#a6d4bd12',warning:'#d8c59b','warning-soft':'#d8c59b12',danger:'#e0a7ad','danger-soft':'#e0a7ad12'}
const FALLBACK_LIGHT: SurfaceColors = {...FALLBACK_DARK,ink:'#223540',muted:'#536777',accent:'#3b6480','on-accent':'#ffffff',panel:'#edf2f6',input:'#f9fbfd',soft:'#3658780d',line:'#4d667d38',success:'#27684d','success-soft':'#27684d12',warning:'#806125','warning-soft':'#80612512',danger:'#97434e','danger-soft':'#97434e12'}
export function safeColor(value: unknown): string | undefined {
 if (typeof value !== 'string') return undefined
 const v = value.trim()
 // No var(), url(), escapes, comments, semicolons, expressions or arbitrary CSS.
 if (v.length > 96) return undefined
 if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return v
 if (/^(?:rgb|rgba|hsl|hsla)\([\d\s.,%/+-]+\)$/i.test(v) && typeof CSS !== 'undefined' && CSS.supports('color',v)) return v
 return undefined
}
export function normalizeSurfaceTheme(realm: unknown, lighting: unknown, values: Partial<Record<ColorKey,unknown>> = {}): SurfaceTheme {
 const valid = REALMS.includes(realm as Realm) ? realm as Realm : 'atelier'
 const light: Light = lighting === 'light' ? 'light' : 'dark'
 const colors = {...(light === 'light' ? FALLBACK_LIGHT : FALLBACK_DARK)}
 for (const key of COLOR_KEYS) colors[key] = safeColor(values[key]) ?? colors[key]
 return {realm:valid, lighting:light, colors}
}
/** Existing M1.9 Shell panel colors, shared with public pages without a Shell. */
export function presentationPanelColors(realm: unknown, lighting: unknown, tone: TonePalette): Partial<Record<ColorKey,string>> {
 const pale = realm === 'porcelain' || realm === 'dawn', night = lighting === 'dark'
 const ink = night ? tone.ink : pale ? '#293537' : '#eeeae3'
 const muted = night ? tone.muted : pale ? '#576764' : '#b0ada6'
 const accent = night ? tone.accent : pale ? '#365f55' : '#d4be94'
 return {
  ink, muted, accent, panel: night ? tone.surface : pale ? '#f6f7f3' : '#101215',
  'on-accent': night ? '#192019' : pale ? '#fff' : '#191910',
  soft: accent + '22', line: muted + '40',
  warning: pale && !night ? '#825d16' : '#eaca82', success: pale && !night ? '#256646' : '#b1d4bd',
  'success-soft': '#5f8c6420', danger: pale && !night ? '#a43131' : '#f39b9b', 'danger-soft': '#a4313112',
 }
}
/** Map the existing M1.9 tone palette to the small public-surface contract. */
export function surfaceThemeFromTone(realm: unknown, lighting: unknown, tone: TonePalette, dayPalette?: Partial<Record<ColorKey, unknown>>): SurfaceTheme {
 const light = lighting === 'light' ? 'light' : 'dark'
 const day = light === 'light'
 const values: Partial<Record<ColorKey, unknown>> = day ? {
  ink: dayPalette?.ink ?? FALLBACK_LIGHT.ink,
  muted: dayPalette?.muted ?? FALLBACK_LIGHT.muted,
  accent: dayPalette?.accent ?? FALLBACK_LIGHT.accent,
  'on-accent': dayPalette?.['on-accent'] ?? '#ffffff',
  panel: dayPalette?.panel ?? '#f6f7f3',
  input: dayPalette?.input ?? '#ffffff',
  soft: dayPalette?.soft ?? tone.accent + '14',
  line: dayPalette?.line ?? tone.muted + '48',
  success: dayPalette?.success ?? '#256646',
  'success-soft': dayPalette?.['success-soft'] ?? '#25664616',
  warning: dayPalette?.warning ?? '#825d16',
  'warning-soft': dayPalette?.['warning-soft'] ?? '#825d1614',
  danger: dayPalette?.danger ?? '#a43131',
  'danger-soft': dayPalette?.['danger-soft'] ?? '#a4313114',
 } : {
  ink: tone.ink,
  muted: tone.muted,
  accent: tone.accent,
  'on-accent': '#192019',
  panel: tone.surface,
  input: tone.surface,
  soft: '#ffffff09',
  line: tone.muted + '40',
  success: '#b1d4bd',
  'success-soft': '#5f8c6420',
  warning: '#eaca82',
  'warning-soft': '#eaca8218',
  danger: '#f39b9b',
  'danger-soft': '#a4313118',
 }
 return normalizeSurfaceTheme(realm, light, values)
}
export function themeStyle(theme: SurfaceTheme | null): Record<string,string> {
 if (!theme) return {}
 const safe=normalizeSurfaceTheme(theme.realm,theme.lighting,theme.colors)
 return Object.fromEntries(COLOR_KEYS.map(key=>['--ru-'+key,safe.colors[key]]))
}
/** Call in the EXISTING public theme shell. Do not provide this from AdminLayout. */
export function provideRedeemSurfaceTheme(theme: Readonly<Ref<SurfaceTheme | null>>): void {provide(CONTEXT,theme)}
/** Teleport preserves Vue's logical parent/injection, unlike CSS DOM inheritance. */
export function useRedeemSurfaceTheme() {
 const theme=inject(CONTEXT,null)
 return {
  portalAttrs:computed(()=>theme?.value ? {'data-redeem-portal':'public','data-lighting':theme.value.lighting,'data-realm':theme.value.realm} : {}),
  surfaceAttrs:computed(()=>theme?.value ? {'data-redeem-ui':'public','data-lighting':theme.value.lighting,'data-realm':theme.value.realm} : {}),
  surfaceStyle:computed(()=>themeStyle(theme?.value ?? null)),
 }
}
