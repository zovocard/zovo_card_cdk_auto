#!/usr/bin/env node
// 由 src/skins/mythic/palettes.mjs 生成 src/styles/mythic-skins.css（七套东方意象主题的日/夜设计令牌）。
// 取色规则沿用原作 themeTokens()，再补齐本项目用到的全部语义变量。用法：node scripts/gen-mythic-skins.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MYTHIC_SCENES } from '../src/skins/mythic/palettes.mjs'

const mix = (a, b, v) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - v) + parseInt(b.slice(i, i + 2), 16) * v).toString(16).padStart(2, '0')).join('')
const rgba = (hex, a) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')}, ${a})`
const rgb = (c, a) => `rgba(${c.join(', ')}, ${a})`

// WCAG 对比度：次要文字(--ink-2/--ink-3)对底色(--bg)与面板(--surface)都要 ≥ 4.5（小字号正文标准）。
// 不达标就往主文字色方向逐步加深/提亮，直到达标——改调色板后不会悄悄退回低对比。
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
const MIN_CONTRAST = 4.5
function readable(color, toward, backgrounds) {
  let c = color
  for (let t = 0.04; backgrounds.some((bg) => contrast(c, bg) < MIN_CONTRAST) && t <= 1; t += 0.04) c = mix(color, toward, t)
  return c
}

function tokens(p, night) {
  const c = night ? p.night : p.day
  const accent = night ? p.accent : p.dayAccent
  const line = mix(c[1], accent, night ? 0.19 : 0.22)
  return {
    '--bg': c[0],
    '--bg-tint': 'none',
    '--surface': c[1],
    '--surface-solid': c[1],
    '--surface-2': c[2],
    '--brd': line,
    '--brd-2': mix(c[1], accent, night ? 0.32 : 0.36),
    '--ink': night ? '#efeae0' : '#28342f',
    '--ink-2': readable(night ? p.muted : '#5e6a63', night ? '#efeae0' : '#28342f', [c[0], c[1], c[2]]),
    '--ink-3': readable(night ? mix(p.muted, c[0], 0.25) : '#6b756e', night ? '#efeae0' : '#28342f', [c[0], c[1], c[2]]),
    '--primary': accent,
    '--primary-hover': mix(accent, night ? '#ffffff' : '#000000', 0.12),
    '--primary-active': mix(accent, night ? '#000000' : '#ffffff', 0.12),
    '--primary-soft': mix(c[1], accent, 0.12),
    '--primary-on': night ? '#1c211e' : '#fffcf7',
    '--row-hover': rgba(accent, night ? 0.07 : 0.08),
    '--good': night ? '#a1cfb4' : '#2c7154',
    '--good-soft': night ? '#21352c' : '#e6f2e8',
    '--warn': night ? '#e4c28b' : '#855925',
    '--warn-soft': night ? '#3d3020' : '#f7ead2',
    '--err': night ? '#efa99b' : '#a44236',
    '--err-soft': night ? '#3f2b28' : '#f7e5e1',
    '--info': night ? '#adc7eb' : '#42648b',
    '--info-soft': night ? '#29374b' : '#e6edf6',
    '--shadow': night ? '0 2px 8px rgba(0, 0, 0, 0.35), 0 24px 90px rgba(0, 0, 0, 0.27)' : `0 2px 6px ${rgb(p.glow, 0.08)}, 0 24px 70px ${rgb(p.glow, 0.14)}`,
    '--shadow-sm': night ? '0 2px 8px rgba(0, 0, 0, 0.35)' : `0 2px 6px ${rgb(p.glow, 0.08)}`,
    '--glow': rgb(p.glow, night ? 0.38 : 0.26),
    '--accent-grad': `linear-gradient(120deg, ${accent}, ${mix(accent, night ? '#ffffff' : '#000000', 0.18)})`,
    ...(night ? { '--el-mask-color': 'rgba(5, 6, 8, 0.66)' } : {}),
  }
}

const block = (sel, vars) => `${sel} {\n${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}\n`

let css = `/* ★自动生成，勿手改★ 由 scripts/gen-mythic-skins.mjs 据 src/skins/mythic/palettes.mjs 生成。
   东方意象七主题（天阙云殿 / 流霞天绫 / 月魄玉璧 / 星宿天衡 / 辰海天河 / 青玉山海 / 曦羽流霞），
   移植自 autocard 项目，原作者授权开源使用（2026-11-17）。 */\n\n`
for (const [id, p] of Object.entries(MYTHIC_SCENES)) {
  for (const night of [false, true]) {
    const t = tokens(p, night)
    for (const k of ['--ink', '--ink-2', '--ink-3']) for (const bg of ['--bg', '--surface', '--surface-2']) {
      const r = contrast(t[k], t[bg])
      if (r < MIN_CONTRAST) throw new Error(`${id} ${night ? '夜' : '日'} ${k} 对 ${bg} 对比度 ${r.toFixed(2)} < ${MIN_CONTRAST}`)
    }
  }
  css += `/* ${p.name} · ${p.en} — ${p.tag} */\n`
  css += block(`html[data-skin="${id}"]`, {
    '--font-sans': "'Manrope', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif",
    '--font-display': "'Cormorant Garamond', 'Noto Serif SC', 'Songti SC', 'STSong', serif",
    '--font-serif': 'var(--font-display)',
    '--radius-sm': '8px',
    '--radius-md': '12px',
    '--radius-lg': '20px',
    ...tokens(p, false),
  })
  css += block(`html.dark[data-skin="${id}"]`, tokens(p, true))
  css += '\n'
}
const out = fileURLToPath(new URL('../src/styles/mythic-skins.css', import.meta.url))
writeFileSync(out, css)
console.log('wrote', out)
