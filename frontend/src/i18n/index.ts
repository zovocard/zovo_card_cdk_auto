import { createI18n } from 'vue-i18n'
import zh from './locales/zh'
import en from './locales/en'

export type AppLocale = 'zh' | 'en'

const STORAGE_KEY = 'locale'

function detectLocale(): AppLocale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'zh' || saved === 'en') return saved
  // 没手动选过：跟随浏览器首选语言——中文(zh / zh-CN / zh-TW / zh-HK…)用中文，其它一律英文
  const prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language])
    .filter(Boolean)
    .map((l) => String(l).toLowerCase())
  return prefs.length && prefs[0].startsWith('zh') ? 'zh' : 'en'
}

const locale = detectLocale()
document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale,
  fallbackLocale: 'zh',
  messages: { zh, en },
})

export function setLocale(next: AppLocale) {
  i18n.global.locale.value = next
  localStorage.setItem(STORAGE_KEY, next)
  document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en'
}
