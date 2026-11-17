export const identityPalette = {
  "atelier": {
    "night": "#d2bd8f",
    "day": "#806332"
  },
  "silk": {
    "night": "#d6af95",
    "day": "#925b47"
  },
  "porcelain": {
    "night": "#afc9c6",
    "day": "#436c68"
  },
  "orbit": {
    "night": "#c4b7e6",
    "day": "#665587"
  },
  "astral": {
    "night": "#a9c8e8",
    "day": "#416b92"
  },
  "verdant": {
    "night": "#aac6b0",
    "day": "#477157"
  },
  "dawn": {
    "night": "#d7b5b3",
    "day": "#8d595c"
  }
} as const
export type IdentityTheme = keyof typeof identityPalette
export const identitySubtitles = {
  "atelier": "重阙 · 云阶 · 金工",
  "silk": "绫带 · 云锦 · 织光",
  "porcelain": "玉璧 · 月弧 · 冷釉",
  "orbit": "星群 · 衡仪 · 星尘",
  "astral": "星河 · 潮汐 · 银沙",
  "verdant": "玉峰 · 山岚 · 云脊",
  "dawn": "凤翎 · 曦轮 · 玫金"
} as const
