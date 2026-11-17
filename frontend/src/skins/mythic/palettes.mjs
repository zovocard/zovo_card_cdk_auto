// 东方意象七主题的调色板（移植自 autocard 项目 admin-themes，原作者授权开源使用，2026-11-17）。
// night / day 三段 = [底色 bg, 面板 surface, 次级面板 soft]；accent 夜间主色，dayAccent 日间主色；glow 光晕 RGB。
// ★唯一数据源★：styles/mythic-skins.css 由 scripts/gen-mythic-skins.mjs 据此生成，改色改这里再重新生成。
export const MYTHIC_SCENES = {
  atelier: { name: '天阙云殿', en: 'Celestial Terrace', tag: '云阙 / 金工', accent: '#d3ba89', dayAccent: '#785723', night: ['#171613', '#23211c', '#2d2922'], day: ['#f0eee7', '#fcfbf6', '#eae6dc'], muted: '#b4a994', glow: [171, 134, 78] },
  silk: { name: '流霞天绫', en: 'Silk Brocade', tag: '云锦 / 流霞', accent: '#e0b089', dayAccent: '#8a552e', night: ['#201812', '#2b221c', '#352a21'], day: ['#f2ebe2', '#fffaf3', '#eaded0'], muted: '#c1ae9d', glow: [193, 125, 68] },
  porcelain: { name: '月魄玉璧', en: 'Lunar Jade', tag: '月华 / 清辉', accent: '#b3cfc4', dayAccent: '#386b5d', night: ['#172320', '#21312b', '#293c34'], day: ['#eaf0ec', '#f8fbf8', '#e1eae3'], muted: '#adc2b8', glow: [98, 161, 143] },
  orbit: { name: '星宿天衡', en: 'Armillary', tag: '天衡 / 紫钛', accent: '#c1b4e5', dayAccent: '#675089', night: ['#1b1726', '#272133', '#312940'], day: ['#eeeaf4', '#fbf9ff', '#e6deee'], muted: '#b8adcc', glow: [141, 116, 196] },
  astral: { name: '辰海天河', en: 'River of Stars', tag: '天河 / 星辉', accent: '#9fbfe5', dayAccent: '#3a638f', night: ['#111c2a', '#1a293b', '#22334a'], day: ['#e8eef5', '#f8fbff', '#dce6f1'], muted: '#a5b8ce', glow: [92, 145, 199] },
  verdant: { name: '青玉山海', en: 'Jade Ranges', tag: '山岚 / 灵玉', accent: '#a9cba6', dayAccent: '#376a47', night: ['#142219', '#203128', '#293d2e'], day: ['#e9eee4', '#f7faf2', '#dfe7d8'], muted: '#acc0aa', glow: [110, 152, 98] },
  dawn: { name: '曦羽流霞', en: 'Dawn Plumes', tag: '曦羽 / 烟玫', accent: '#e0b5ad', dayAccent: '#92584f', night: ['#261b20', '#33262c', '#3e2e35'], day: ['#f3e8e5', '#fff9f6', '#eeddd8'], muted: '#c6adae', glow: [189, 118, 115] },
}

export const MYTHIC_IDS = Object.keys(MYTHIC_SCENES)
