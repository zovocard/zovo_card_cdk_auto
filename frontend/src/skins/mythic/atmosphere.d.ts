export interface MythicFrame {
  w: number
  h: number
  theme: string
  t: number
  staticMode?: boolean
  scene?: { x: number; y: number }
  /** 0 = 日间（浅底），1 = 夜间（深底）；影响部分主题的描线色与强度 */
  darkness?: number
  phase?: string
  motion?: 'light' | 'full'
}
export declare const mythicArt: {
  draw(ctx: CanvasRenderingContext2D, q: MythicFrame): string
  profiles: Record<string, { name: string; color: number[]; family: string }>
}
