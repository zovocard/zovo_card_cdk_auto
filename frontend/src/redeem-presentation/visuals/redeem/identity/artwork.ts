import type { IdentityTheme } from './palette'
import scenes_atelier from './scenes/atelier.svg?raw'
import scenes_silk from './scenes/silk.svg?raw'
import scenes_porcelain from './scenes/porcelain.svg?raw'
import scenes_orbit from './scenes/orbit.svg?raw'
import scenes_astral from './scenes/astral.svg?raw'
import scenes_verdant from './scenes/verdant.svg?raw'
import scenes_dawn from './scenes/dawn.svg?raw'
import seals_atelier from './seals/atelier.svg?raw'
import seals_silk from './seals/silk.svg?raw'
import seals_porcelain from './seals/porcelain.svg?raw'
import seals_orbit from './seals/orbit.svg?raw'
import seals_astral from './seals/astral.svg?raw'
import seals_verdant from './seals/verdant.svg?raw'
import seals_dawn from './seals/dawn.svg?raw'

const scenes = {atelier: scenes_atelier, silk: scenes_silk, porcelain: scenes_porcelain, orbit: scenes_orbit, astral: scenes_astral, verdant: scenes_verdant, dawn: scenes_dawn}
const seals = {atelier: seals_atelier, silk: seals_silk, porcelain: seals_porcelain, orbit: seals_orbit, astral: seals_astral, verdant: seals_verdant, dawn: seals_dawn}
let serial = 0
/** 只读取包内可信 SVG，每个实例独占渐变和样式 ID。 */
export function artwork(theme: IdentityTheme, kind: 'scene' | 'seal' = 'scene') {
 const source = (kind === 'seal' ? seals : scenes)[theme]
 const original = source.match(/data-art-id="([^"]+)"/)![1]
 return source.replaceAll(original, `redeem-identity-${++serial}`)
}
export interface IdentityFrame { time: number; staticMode?: boolean; reduced?: boolean; pointerX?: number }
/** 由宿主原背景 draw 调用，不注册时钟、事件或业务订阅。 */
export function createIdentityArtwork(host: HTMLElement, initialTheme: IdentityTheme) {
 let theme: IdentityTheme | undefined, dead = false, painted = false
 let nodes: SVGElement[] = []
 let flows: { path: SVGPathElement; length: number; dot: SVGCircleElement; index: number }[] = []
 function setTheme(next: IdentityTheme) {
  if (dead || theme === next) return
  theme = next; painted = false
  host.innerHTML = artwork(theme)
  nodes = [...host.querySelectorAll<SVGElement>('[data-move]')]; flows = []
  const flow = theme === 'orbit' ? 'M84 105C306 128 508 402 826 438' : theme === 'astral' ? 'M84 535C266 560 691 396 513 291C302 166 444 87 813 82' : null
  if (flow) {
   const svg = host.querySelector('svg')!, ns = 'http://www.w3.org/2000/svg'
   const path = document.createElementNS(ns, 'path'); path.setAttribute('d', flow); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'none'); svg.append(path)
   const length = path.getTotalLength()
   for (let index = 0; index < 7; index++) {
    const dot = document.createElementNS(ns, 'circle'); dot.setAttribute('r', index % 3 === 0 ? '2' : '1.35'); dot.setAttribute('fill', 'currentColor'); svg.append(dot); flows.push({ path, length, dot, index })
   }
  }
  frame({ time: 0, staticMode: true })
 }
 function frame({ time, staticMode = false, reduced = false, pointerX = 0 }: IdentityFrame) {
  if (dead || painted && (staticMode || reduced)) return
  const t = Math.max(0, Number(time) || 0), px = staticMode || reduced ? 0 : Math.max(-1, Math.min(1, pointerX))
  for (const f of flows) {
   const u = (f.index / 7 + t / (theme === 'orbit' ? 48 : 30)) % 1, point = f.path.getPointAtLength(u * f.length)
   f.dot.setAttribute('cx', String(point.x)); f.dot.setAttribute('cy', String(point.y)); f.dot.setAttribute('opacity', String(.3 + Math.sin(u * Math.PI) * .65))
  }
  const phases: Record<string, number> = {}
  for (const node of nodes) {
   const kind = node.dataset.move!, index = Number(node.dataset.index ?? (phases[kind] ?? 0)); phases[kind] = (phases[kind] ?? 0) + 1
   let transform = '', opacity = ''
   if (kind === 'cloud') transform = `translate(${Math.sin(t / 7 + index * .7) * 8 + px * 3} 0)`
   if (kind === 'mist') transform = `translate(${Math.sin(t / 9 + 1 + index * .6) * 6} ${Math.sin(t / 11 + index * .4) * 3})`
   if (kind === 'ribbon-a') transform = `translate(0 ${Math.sin(t / 3.5) * 5})`
   if (kind === 'ribbon-b') transform = `translate(0 ${Math.sin(t / 3.5 + 2.1) * 4})`
   if (kind === 'lunar-light') opacity = String(.76 + Math.sin(t / 5.7) * .2)
   if (kind === 'instrument') transform = `rotate(${t * 360 / 1800} 450 307)`
   if (kind === 'stars') opacity = String(.82 + Math.sin(t / 6) * .12)
   if (kind === 'tide') transform = `translate(${Math.sin(t / 4.8 + index * .18) * 3} ${Math.sin(t / 4.8 + index * .18) * 2})`
   if (kind === 'water') transform = `translate(0 ${Math.sin(t / 5 + 1.2 + index * .6) * 3})`
   if (kind === 'feather') transform = `rotate(${Math.sin(t / 5.1 + index * .46) * .65} 0 0)`
   if (transform) node.setAttribute('transform', transform)
   if (opacity) node.setAttribute('opacity', opacity)
  }
  painted = true
 }
 setTheme(initialTheme)
 return { setTheme, frame, destroy() { dead = true; host.replaceChildren(); nodes = []; flows = [] } }
}
