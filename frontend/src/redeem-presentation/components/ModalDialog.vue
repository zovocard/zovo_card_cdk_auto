<template>
  <Teleport to="body">
    <Transition name="modal" :css="animate !== false">
      <div
        v-if="open"
        :class="['modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4', backdropClass]"
        v-bind="{ ...backdropAttributes, ...portalAttrs }"
        :style="{...surfaceStyle,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)','--modal-viewport-gap':`${viewportGap}px`,...backdropStyle}"
        @click.self="close"
        @keydown.tab="trapFocus"
        @wheel.self.prevent
        @touchmove.self.prevent
      >
        <div
          ref="dialogRef"
          :class="['modal-panel card w-full max-w-lg space-y-4', animate !== false ? 'animate-slideInUp' : '', panelClass]"
          :style="panelStyle"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
        >
          <slot name="header" :close="close" :title-id="titleId"><div class="flex items-center justify-between gap-4">
            <h2 :id="titleId" class="text-xl font-semibold text-ink">{{ title }}</h2>
            <button
              type="button"
              class="modal-close btn-ghost !p-2 !rounded-full"
              :aria-label="t('common.closeDialog')"
              @click="close"
            >
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div></slot>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRedeemSurfaceTheme } from '../utils/redeemThemeBridge'

const { t } = useI18n({ useScope: 'global' })
const { portalAttrs, surfaceStyle } = useRedeemSurfaceTheme()

const props = defineProps<{
  open: boolean
  title: string
  panelClass?: string
  panelStyle?: Record<string, string>
  backdropClass?: string
  backdropAttributes?: Record<string, string>
  backdropStyle?: Record<string, string>
  animate?: boolean
  preserveScrollbar?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const dialogRef = ref<HTMLElement | null>(null)
const viewportGap = ref(0)
const titleId = `modal-title-${Math.random().toString(36).slice(2)}`
let previouslyFocused: HTMLElement | null = null
let previousBodyOverflow = ''
let previousScrollbarGutter = ''
let lockedScroll: { x: number; y: number } | null = null
const holdBackgroundScroll = () => {
  if (lockedScroll && (window.scrollX !== lockedScroll.x || window.scrollY !== lockedScroll.y)) window.scrollTo({ left: lockedScroll.x, top: lockedScroll.y, behavior: 'instant' })
}
const releaseBackgroundScroll = () => {
  window.removeEventListener('scroll', holdBackgroundScroll)
  lockedScroll = null
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const close = () => emit('close')

const visibleFocusable = (el: HTMLElement) => {
  if (el.hasAttribute('disabled')) return false
  if (el.getAttribute('aria-hidden') === 'true') return false
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
}

const closeOnEscape = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || event.defaultPrevented || !props.open) return
  const panel = dialogRef.value
  if (!panel) return
  // 按钮忙碌禁用后浏览器可能将焦点移到 body；仍只允许最上层可见弹窗处理一次。
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).filter(visibleFocusable)
  if (dialogs[dialogs.length - 1] !== panel) return
  event.preventDefault()
  close()
}

const trapFocus = (event: KeyboardEvent) => {
  const panel = dialogRef.value
  if (!panel) return
  const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(visibleFocusable)
  if (focusable.length === 0) {
    event.preventDefault()
    panel.focus()
    return
  }
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (document.activeElement === panel) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    window.addEventListener('keydown', closeOnEscape)
    viewportGap.value = Math.max(0, window.innerWidth - document.documentElement.clientWidth)
    previouslyFocused = document.activeElement as HTMLElement | null
    previousBodyOverflow = document.body.style.overflow
    if (props.preserveScrollbar) {
      previousScrollbarGutter = document.documentElement.style.scrollbarGutter
      // 保留真实页面滚动条；浮层截断滚动，页面位置按原坐标保持。
      lockedScroll = { x: window.scrollX, y: window.scrollY }
      window.addEventListener('scroll', holdBackgroundScroll, { passive: true })
    }
    if (!props.preserveScrollbar) document.body.style.overflow = 'hidden'
    if (props.preserveScrollbar) {
      // 页面实际滚动条已占的空间无需由浮层再扣一次；触摸视口可能不占该空间。
      const retainedGap = Math.max(0, window.innerWidth - document.documentElement.getBoundingClientRect().width)
      viewportGap.value = Math.max(0, viewportGap.value - retainedGap)
    }
    await nextTick()
    if (props.open) dialogRef.value?.focus({ preventScroll: props.preserveScrollbar })
    return
  }
  releaseBackgroundScroll()
  window.removeEventListener('keydown', closeOnEscape)
  document.body.style.overflow = previousBodyOverflow
  if (props.preserveScrollbar) document.documentElement.style.scrollbarGutter = previousScrollbarGutter
  if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: props.preserveScrollbar })
  previouslyFocused = null
}, { immediate: props.open })

onBeforeUnmount(() => {
  window.removeEventListener('keydown', closeOnEscape)
  releaseBackgroundScroll()
  if (props.open) {
    document.body.style.overflow = previousBodyOverflow
    if (props.preserveScrollbar) document.documentElement.style.scrollbarGutter = previousScrollbarGutter
    if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: props.preserveScrollbar })
    previouslyFocused = null
  }
})
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-panel,
.modal-leave-active .modal-panel {
  transition: transform 0.18s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-panel,
.modal-leave-to .modal-panel {
  transform: translateY(6px);
}

.modal-close {
  align-items: center;
  display: inline-flex;
  justify-content: center;
  min-height: 44px;
  min-width: 44px;
}

.modal-backdrop {
  padding:
    max(16px, env(safe-area-inset-top))
    max(16px, env(safe-area-inset-right))
    max(16px, env(safe-area-inset-bottom))
    max(16px, env(safe-area-inset-left));
}

.modal-panel {
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  overscroll-behavior: contain;
}

@supports not (height: 100dvh) {
  .modal-panel {
    max-height: calc(100vh - 32px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal-enter-active,
  .modal-leave-active,
  .modal-enter-active .modal-panel,
  .modal-leave-active .modal-panel {
    transition: none;
  }

  .modal-enter-from .modal-panel,
  .modal-leave-to .modal-panel {
    transform: none;
  }
}
</style>
