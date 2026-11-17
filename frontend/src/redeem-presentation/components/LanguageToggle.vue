<template>
  <div ref="host" class="language-toggle" @focusout="onFocusOut" @keydown.esc="onEscape">
    <button
      ref="trigger"
      class="language-toggle-control btn-ghost !px-2.5 text-sm font-medium"
      :class="{'visitor-entry':presentation}"
      type="button"
      :title="presentation ? t('m19.displayLanguage') : switchLabel"
      :aria-label="presentation ? t('m19.displayLanguage') : switchLabel"
      :aria-haspopup="presentation ? 'menu' : undefined"
      :aria-expanded="presentation ? open : undefined"
      @click="onToggle"
      @keydown.down="onOpenKey"
      @keydown.up="onOpenKey"
    >
      <svg v-if="presentation" width="16" height="16" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="8.5" /><ellipse cx="12" cy="12" rx="3.5" ry="8.5" /><path d="M3.5 12h17M5.5 6.5h13M5.5 17.5h13" /></svg><template v-else>{{ currentLabel }}</template>
    </button>
    <div v-if="presentation && open" class="language-menu" role="menu" :aria-label="t('m19.displayLanguage')" @keydown="onMenuKeydown">
      <button v-for="language in cycle" :key="language" type="button" role="menuitemradio" :aria-checked="currentLocale===language" :lang="language==='zh'?'zh-CN':language" tabindex="-1" @click="selectLanguage(language)">
        <span>{{ menuLabels[language] }}</span><span aria-hidden="true">{{ currentLocale===language?'✓':'' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { setLocale, type AppLocale } from '../i18n'

const props=withDefaults(defineProps<{presentation?:boolean}>(),{presentation:false})
const { locale, t } = useI18n({ useScope: 'global' })
const host = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const open = defineModel<boolean>('open', { default: false })
// 本站只有中文 / 英文两种界面语言（原项目另有俄文）。
const cycle: AppLocale[] = ['zh', 'en']
const labels: Record<AppLocale, string> = { zh: '中文', en: 'EN' }
const menuLabels: Record<AppLocale, string> = { zh: '中文', en: 'English' }
const spokenLabels: Record<AppLocale, Record<AppLocale, string>> = {
  zh: { zh: '中文', en: '英语' },
  en: { zh: 'Chinese', en: 'English' },
}

const currentLocale = computed<AppLocale>(() => {
  const value = String(locale.value || 'en')
  if (value.startsWith('zh')) return 'zh'
  return 'en'
})
const currentLabel = computed(() => labels[currentLocale.value])
const nextLang = computed(() => cycle[(cycle.indexOf(currentLocale.value) + 1) % cycle.length])
const switchLabel = computed(() => {
  const map: Record<AppLocale, string> = {
    zh: `切换语言，当前为${spokenLabels.zh[currentLocale.value]}，下一个为${spokenLabels.zh[nextLang.value]}`,
    en: `Switch language, currently ${spokenLabels.en[currentLocale.value]}, next ${spokenLabels.en[nextLang.value]}`,
  }
  return map[currentLocale.value]
})

function closeMenu(restoreFocus = false) {
  if (!open.value) return
  open.value = false
  if (restoreFocus) trigger.value?.focus()
}
async function openMenu() {
  open.value = true
  await nextTick()
  host.value?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus()
}
function onEscape(event: KeyboardEvent) {
  if (!open.value) return
  event.preventDefault()
  event.stopPropagation()
  closeMenu(true)
}
function onOpenKey(event: KeyboardEvent) {
  if (!props.presentation) return
  event.preventDefault()
  void openMenu()
}
function onToggle() {
  if (!props.presentation) setLocale(nextLang.value)
  else if (open.value) closeMenu()
  else void openMenu()
}
function selectLanguage(language: AppLocale) {
  setLocale(language)
  closeMenu(true)
}
function onMenuKeydown(event: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const items = Array.from(host.value?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') || [])
  const index = items.indexOf(document.activeElement as HTMLButtonElement)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
  items[next]?.focus()
}
function onFocusOut(event: FocusEvent) {
  if (!host.value?.contains(event.relatedTarget as Node | null)) closeMenu()
}
function onOutsidePointer(event: PointerEvent) {
  if (!host.value?.contains(event.target as Node)) closeMenu()
}
watch(open, value => {
  if (value) document.addEventListener('pointerdown', onOutsidePointer)
  else document.removeEventListener('pointerdown', onOutsidePointer)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutsidePointer))
</script>

<style scoped>
.language-toggle { position: relative; display: inline-flex; flex-shrink: 0; }
.language-toggle-control { min-width: 44px; min-height: 44px; white-space: nowrap; }
.language-toggle-control.visitor-entry { display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; }
.visitor-entry { width: 44px; height: 44px; }
.language-menu {
  position: absolute; z-index: 80; top: calc(100% + 8px); right: 0;
  min-width: 152px; padding: 6px; border: 1px solid var(--brd);
  border-radius: 10px; background: var(--surface); color: var(--ink);
  box-shadow: 0 8px 24px #0003; font: 13px/1.5 var(--r-ui, sans-serif);
}
.language-menu button {
  display: flex; align-items: center; justify-content: space-between; gap: 20px;
  width: 100%; min-height: 44px; padding: 9px 12px; border: 0;
  border-radius: 6px; background: transparent; color: inherit; text-align: left;
}
.language-menu button:hover, .language-menu button[aria-checked=true] { background: var(--primary-soft); }
.language-menu button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
</style>
