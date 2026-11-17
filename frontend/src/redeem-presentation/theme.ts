// 适配层：原项目的展示组件从 '../theme' 取明暗状态；这里转接到本站 src/theme.ts，
// 明暗完全跟随本站（themeMode / isDark / setTheme / toggleTheme），展示层自己不再写 localStorage。
export { isDark, themeMode, setTheme, toggleTheme, initTheme } from '../theme'
export type { ThemeMode } from '../theme'
