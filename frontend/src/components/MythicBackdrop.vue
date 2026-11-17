<template>
  <canvas v-if="active" ref="canvas" class="mythic-backdrop" aria-hidden="true" />
</template>

<script setup lang="ts">
// 东方意象七主题的背景氛围（canvas 蚀刻线 + 雾气），只在 mythic 家族皮肤下挂载。
// 画法来自 autocard 项目（原作者授权开源使用，2026-11-17）。
// 性能：约 24fps、标签页隐藏时停、系统「减少动态效果」时只画一帧静态图；不挂任何业务事件。
// 管理端(/ops)只画一帧静态图：后台是长时间停留、表格密集的工作界面，全屏动画每帧都要
// 重新合成整页（以前面板还带 backdrop-filter，每帧重算模糊），表格滚动和输入都会被拖慢。
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { currentSkinMeta, isDark, themeMode } from '../theme'
import { mythicArt } from '../skins/mythic/atmosphere.js'
import { presentationShells } from '../redeem-presentation/shell-state'

const canvas = ref<HTMLCanvasElement | null>(null)
const route = useRoute()
const adminArea = computed(() => route.path === '/ops' || route.path.startsWith('/ops/'))
// 兑换页展示外壳（RedeemPresentation）自带环境画布与底板照片：外壳在时这里让位，避免双背景。
const active = computed(() => currentSkinMeta.value.family === 'mythic' && presentationShells.value === 0)

const FRAME_MS = 1000 / 24
const reduceMotion = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null

let raf = 0
let last = 0
let w = 0
let h = 0
const pointer = { x: 0, y: 0, tx: 0, ty: 0 }

function resize() {
  const el = canvas.value
  if (!el) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  w = window.innerWidth
  h = window.innerHeight
  el.width = Math.round(w * dpr)
  el.height = Math.round(h * dpr)
  el.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function paint(now: number) {
  const el = canvas.value
  const ctx = el?.getContext('2d')
  if (!el || !ctx) return
  const still = !!reduceMotion?.matches || adminArea.value
  pointer.x += (pointer.tx - pointer.x) * 0.06
  pointer.y += (pointer.ty - pointer.y) * 0.06
  ctx.clearRect(0, 0, w, h)
  mythicArt.draw(ctx, {
    w,
    h,
    theme: currentSkinMeta.value.id,
    t: still ? 0 : now / 1000,
    staticMode: still,
    scene: still ? { x: 0, y: 0 } : { x: pointer.x, y: pointer.y },
    darkness: isDark() ? 1 : 0,
    motion: 'full',
  })
}

function loop(now: number) {
  raf = requestAnimationFrame(loop)
  if (document.hidden || now - last < FRAME_MS) return
  last = now
  paint(now)
}

function onPointer(e: PointerEvent) {
  pointer.tx = (e.clientX / Math.max(w, 1) - 0.5) * 2
  pointer.ty = (e.clientY / Math.max(h, 1) - 0.5) * 2
}

function onResize() {
  resize()
  paint(performance.now())
}

function start() {
  stop()
  resize()
  paint(performance.now())
  window.addEventListener('resize', onResize, { passive: true })
  if (reduceMotion?.matches || adminArea.value) return // 静态：只在尺寸/主题变化时重画
  window.addEventListener('pointermove', onPointer, { passive: true })
  raf = requestAnimationFrame(loop)
}

function stop() {
  cancelAnimationFrame(raf)
  raf = 0
  window.removeEventListener('resize', onResize)
  window.removeEventListener('pointermove', onPointer)
}

watch(
  () => [active.value, currentSkinMeta.value.id, themeMode.value, adminArea.value] as const,
  async ([on]) => {
    if (!on) return stop()
    await nextTick()
    start()
  },
  { immediate: true },
)
reduceMotion?.addEventListener?.('change', () => { if (active.value) start() })
onBeforeUnmount(stop)
</script>
