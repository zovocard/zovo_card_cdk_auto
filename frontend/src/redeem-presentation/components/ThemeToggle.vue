<template>
  <button
    class="theme-toggle-control btn-ghost !px-2.5"
    :class="{'visitor-entry light-toggle':presentation}"
    type="button"
    :title="toggleLabel"
    :aria-label="toggleLabel"
    :aria-pressed="dark"
    @click="onToggle"
  >
    <!-- sun (shown in dark mode, click → light) -->
    <svg v-if="presentation ? !dark : dark" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" :r="presentation ? 3.7 : 4" />
      <path :d="presentation ? 'M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41' : 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41'" />
    </svg>
    <!-- moon (shown in light mode, click → dark) -->
    <svg v-else aria-hidden="true" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path :d="presentation ? 'M20.3 14.5A8.5 8.5 0 0 1 9.5 3.7 8.5 8.5 0 1 0 20.3 14.5Z' : 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'" />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { isDark, toggleTheme, themeMode } from '../theme'

withDefaults(defineProps<{presentation?:boolean}>(),{presentation:false})
const { locale } = useI18n({ useScope: 'global' })
type ToggleLocale = 'zh' | 'en' | 'ru'

// themeMode is referenced so the computed re-evaluates on change
const dark = computed(() => {
  void themeMode.value
  return isDark()
})
const currentLocale = computed<ToggleLocale>(() => {
  const value = String(locale.value || 'en')
  if (value.startsWith('zh')) return 'zh'
  if (value.startsWith('ru')) return 'ru'
  return 'en'
})
const toggleLabel = computed(() => {
  const labels = {
    zh: dark.value ? '切换到亮色模式，当前为暗色模式' : '切换到暗色模式，当前为亮色模式',
    en: dark.value ? 'Switch to light mode, currently dark mode' : 'Switch to dark mode, currently light mode',
    ru: dark.value ? 'Переключить на светлую тему, сейчас тёмная тема' : 'Переключить на тёмную тему, сейчас светлая тема',
  }
  return labels[currentLocale.value]
})

const onToggle = () => toggleTheme()
</script>

<style scoped>
.theme-toggle-control {
  min-width: 44px;
  min-height: 44px;
}
</style>
