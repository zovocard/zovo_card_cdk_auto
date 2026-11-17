import type { Palette, Stage } from '../contracts'

interface SceneTone {
  base: string
  surface: string
  ink: string
  muted: string
  accent: string
  hue: number
  ramp: string[]
}
declare const Tone: {
  profiles: Readonly<Record<Stage, SceneTone>>
  scene(theme: string): SceneTone
  card<T extends Palette>(palette: T, theme: string, darkness: number): T
  fieldWriter(theme: string, darkness: number): (output: Uint8ClampedArray, index: number, red: number, green: number, blue: number) => void
  contrast(first: string, second: string): number
  luminance(color: string): number
  mix(first: string, second: string, amount: number): string
}
export default Tone
