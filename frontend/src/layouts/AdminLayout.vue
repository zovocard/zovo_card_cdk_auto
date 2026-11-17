<template>
  <div class="app-shell" :class="[`layout-${layout}`, `nav-${nav}`]">
    <!-- 侧栏 / 细轨（cyber、slate 等） -->
    <aside v-if="layout === 'sidebar' || layout === 'rail'" class="sidenav">
      <div class="side-brand" @click="router.push('/ops')">
        <span class="brand-icon" :class="{ 'mythic-seal-host': isMythic }">{{ isMythic ? '' : (skin === 'cyber' ? '◈' : '🚀') }}</span>
        <span v-if="layout !== 'rail'" class="brand-text">{{ brand.name || '运营控制台' }}</span>
      </div>
      <nav class="side-pills" aria-label="后台导航">
        <template v-for="(g, gi) in navGroups" :key="g.label">
          <div v-if="layout !== 'rail'" class="side-group">{{ g.label }}</div>
          <div v-else-if="gi > 0" class="side-sep" role="separator" />
          <router-link
            v-for="it in g.items"
            :key="it.path"
            :to="it.path"
            class="side-link"
            :class="{ active: isActive(it.path) }"
            :title="it.label"
            :aria-label="layout === 'rail' ? it.label : undefined"
          >
            <el-icon><component :is="it.icon" /></el-icon>
            <span v-if="layout !== 'rail'" class="side-label">{{ it.label }}</span>
          </router-link>
        </template>
      </nav>
      <div class="side-foot">
        <button type="button" class="side-tool" :title="`跳转到页面（${modKey}K）`" aria-label="跳转到页面" @click="paletteOpen = true">
          <span v-if="layout !== 'rail'">跳转 <kbd>{{ modKey }}K</kbd></span>
          <span v-else aria-hidden="true">⌘</span>
        </button>
        <el-popover :persistent="false" placement="right-end" :width="340" trigger="click">
          <template #reference>
            <button type="button" class="side-tool" title="整站主题" aria-label="整站主题">
              <el-icon><Brush /></el-icon>
            </button>
          </template>
          <SkinPicker show-mode title="整站主题" />
        </el-popover>
        <span v-if="layout !== 'rail'" class="admin-name">{{ auth.username || 'admin' }}</span>
        <el-button v-if="layout !== 'rail'" size="small" @click="doLogout">退出</el-button>
        <el-button v-else size="small" circle title="退出" aria-label="退出登录" @click="doLogout">⎋</el-button>
      </div>
    </aside>

    <div class="main-col">
      <!-- 顶栏：top 布局始终显示；侧栏布局显示精简顶条 -->
      <header v-if="layout === 'top'" class="topnav">
        <div class="nav-inner">
          <div class="brand" @click="router.push('/ops')">
            <span class="brand-icon" :class="{ 'mythic-seal-host': isMythic }">{{ isMythic ? '' : '🚀' }}</span>
            <span class="brand-text">{{ brand.name || '运营控制台' }}</span>
          </div>
          <nav class="nav-pills" aria-label="后台导航">
            <template v-for="(g, gi) in navGroups" :key="g.label">
              <span v-if="gi > 0" class="nav-sep" role="separator" />
              <router-link
                v-for="it in g.items"
                :key="it.path"
                :to="it.path"
                class="pill"
                :class="{ active: isActive(it.path) }"
              >
                <el-icon><component :is="it.icon" /></el-icon><span>{{ it.label }}</span>
              </router-link>
            </template>
          </nav>
          <div class="nav-actions">
            <button type="button" class="kbd-btn" :title="`跳转到页面（${modKey}K）`" aria-label="跳转到页面" @click="paletteOpen = true">
              <span>跳转</span><kbd>{{ modKey }}K</kbd>
            </button>
            <el-popover :persistent="false" placement="bottom-end" :width="340" trigger="click">
              <template #reference>
                <button type="button" class="hicon" title="整站主题" aria-label="整站主题"><el-icon><Brush /></el-icon></button>
              </template>
              <SkinPicker show-mode title="整站主题" />
            </el-popover>
            <span class="admin-name">{{ auth.username || 'admin' }}</span>
            <el-button size="small" round @click="doLogout">退出</el-button>
          </div>
        </div>
      </header>

      <header v-else class="subtop">
        <div class="subtop-inner">
          <div class="subtop-title">{{ currentTitle }}</div>
          <div class="nav-actions">
            <span class="admin-name">{{ auth.username || 'admin' }}</span>
          </div>
        </div>
      </header>

      <main class="page">
        <!-- 中文的分页/空态等内置文案（原来是英文 Total / Go to / No Data） -->
        <el-config-provider :locale="zhCn"><router-view /></el-config-provider>
      </main>
    </div>

    <!-- ⌘K 跳转面板 -->
    <div v-if="paletteOpen" class="modal-mask palette-mask" @click.self="paletteOpen = false">
      <div class="palette card card-solid" role="dialog" aria-modal="true" aria-label="跳转到页面" @keydown="onPaletteKey">
        <input ref="paletteInput" v-model="paletteQ" class="palette__input" placeholder="跳转到…（输入页面名）" aria-label="搜索页面" />
        <ul class="palette__list" role="listbox">
          <li
            v-for="(it, i) in paletteItems"
            :key="it.path"
            role="option"
            :aria-selected="i === paletteIdx"
            class="palette__item"
            :class="{ 'is-on': i === paletteIdx }"
            @mouseenter="paletteIdx = i"
            @click="goPalette(it.path)"
          >
            <el-icon><component :is="it.icon" /></el-icon>
            <span>{{ it.label }}</span>
            <span class="palette__group">{{ it.group }}</span>
          </li>
          <li v-if="!paletteItems.length" class="palette__empty">没有匹配的页面</li>
        </ul>
        <div class="palette__hint"><kbd>↑</kbd><kbd>↓</kbd> 选择 · <kbd>Enter</kbd> 打开 · <kbd>Esc</kbd> 关闭 · 列表页按 <kbd>/</kbd> 聚焦搜索</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn.mjs'
import { useAuthStore } from '../stores/auth'
import { serverLogout } from '../lib/api'
import { siteBrand, currentSkinMeta, siteSkin } from '../theme'
import SkinPicker from '../components/SkinPicker.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const brand = siteBrand
const skin = siteSkin

const layout = computed(() => currentSkinMeta.value.layout)
const isMythic = computed(() => currentSkinMeta.value.family === 'mythic')
const nav = computed(() => currentSkinMeta.value.nav)

// 导航分组：运营（日常）/ 配置（偶尔）/ 审计
const navGroups = [
  {
    label: '运营',
    items: [
      { path: '/ops', label: '总览', icon: 'Odometer' },
      { path: '/ops/cdkeys', label: 'CDK卡密', icon: 'Key' },
      { path: '/ops/orders', label: '兑换对账', icon: 'Document' },
      { path: '/ops/webhooks', label: 'Webhook', icon: 'Bell' },
    ],
  },
  {
    label: '配置',
    items: [
      { path: '/ops/integration', label: '卡台接入', icon: 'Link' },
      { path: '/ops/card-selection', label: '选卡配置', icon: 'CreditCard' },
      { path: '/ops/appearance', label: '外观', icon: 'Brush' },
    ],
  },
  {
    label: '审计',
    items: [{ path: '/ops/audit', label: '审计', icon: 'List' }],
  },
]
const navItems = navGroups.flatMap((g) => g.items.map((it) => ({ ...it, group: g.label })))

const currentTitle = computed(() => {
  const hit = navItems.find((n) => isActive(n.path))
  return hit?.label || brand.value.name || '控制台'
})

function isActive(p: string) {
  return p === '/ops' ? route.path === '/ops' : route.path.startsWith(p)
}
async function doLogout() {
  await serverLogout()
  router.push('/ops/login')
}

// ── ⌘K 跳转面板 + 「/」聚焦列表搜索 ──
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const modKey = isMac ? '⌘' : 'Ctrl+'
const paletteOpen = ref(false)
const paletteQ = ref('')
const paletteIdx = ref(0)
const paletteInput = ref<HTMLInputElement | null>(null)
const paletteItems = computed(() => {
  const q = paletteQ.value.trim().toLowerCase()
  if (!q) return navItems
  return navItems.filter((it) => `${it.label} ${it.group} ${it.path}`.toLowerCase().includes(q))
})
watch(paletteQ, () => { paletteIdx.value = 0 })
watch(paletteOpen, async (open) => {
  if (!open) return
  paletteQ.value = ''
  paletteIdx.value = Math.max(0, navItems.findIndex((n) => isActive(n.path)))
  await nextTick()
  paletteInput.value?.focus()
})
function goPalette(path: string) {
  paletteOpen.value = false
  if (route.path !== path) router.push(path)
}
function onPaletteKey(e: KeyboardEvent) {
  const n = paletteItems.value.length
  if (e.key === 'Escape') { paletteOpen.value = false; e.preventDefault() }
  else if (e.key === 'ArrowDown' && n) { paletteIdx.value = (paletteIdx.value + 1) % n; e.preventDefault() }
  else if (e.key === 'ArrowUp' && n) { paletteIdx.value = (paletteIdx.value - 1 + n) % n; e.preventDefault() }
  else if (e.key === 'Enter' && n) { goPalette(paletteItems.value[paletteIdx.value].path); e.preventDefault() }
}
function isTypingTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
}
function onGlobalKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    paletteOpen.value = !paletteOpen.value
    return
  }
  if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !paletteOpen.value && !isTypingTarget(e.target)) {
    const input = document.querySelector<HTMLInputElement>('[data-admin-search] input, input[data-admin-search]')
    if (input) {
      e.preventDefault()
      input.focus()
      input.select()
    }
  }
}
onMounted(() => window.addEventListener('keydown', onGlobalKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKey))
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  /* 底色由 html 统一画（见 style.css），这里透明：否则会盖住固定氛围层，
     原来的 background-attachment: fixed 还会让滚动每帧重绘整屏 */
  background: transparent;
  color: var(--ink);
}
.layout-sidebar, .layout-rail {
  flex-direction: row;
  align-items: stretch;
}
.main-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* ── top nav ── */
.topnav {
  position: sticky; top: 0; z-index: 100;
  /* 不透明 + 不模糊：backdrop-filter 会让下面每次重绘（表格滚动、氛围画布）都重算一遍模糊 */
  background: var(--surface-solid);
  border-bottom: 1px solid var(--brd);
}
.nav-inner {
  max-width: var(--content-max, 1500px); margin: 0 auto;
  height: var(--nav-height, 60px); padding: 0 20px;
  display: flex; align-items: center; gap: 14px;
}
.brand, .side-brand {
  display: flex; align-items: center; gap: 8px; cursor: pointer; flex-shrink: 0;
}
.brand-icon { font-size: 20px; line-height: 1; }
.brand-icon.mythic-seal-host { display: inline-block; width: 26px; height: 26px; }
.brand-text {
  font-size: 17px; font-weight: 700; color: var(--ink); white-space: nowrap;
  font-family: var(--font-display, var(--font-serif));
}
.nav-pills { display: flex; align-items: center; gap: 2px; flex-wrap: wrap; flex: 1; }
.pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 12px; border-radius: var(--radius-pill, 999px); font-size: 14px;
  color: var(--ink-2); text-decoration: none; white-space: nowrap; transition: all .15s;
}
.pill:hover { background: var(--primary-soft); color: var(--ink); }
.pill.active { background: var(--primary-soft); color: var(--primary); font-weight: 600; }
.nav-actions { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.nav-sep { width: 1px; height: 18px; margin: 0 6px; background: var(--brd-2); flex: none; }
.kbd-btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 30px; padding: 0 6px 0 10px;
  border: 1px solid var(--brd); border-radius: var(--radius-md);
  background: var(--surface-2); color: var(--ink-3); font-size: 12.5px; cursor: pointer;
}
.kbd-btn:hover { color: var(--ink); border-color: var(--brd-2); }
kbd {
  display: inline-block; min-width: 18px; padding: 0 4px;
  border: 1px solid var(--brd); border-bottom-width: 2px; border-radius: 4px;
  background: var(--surface-solid); color: var(--ink-2);
  font-family: var(--font-mono); font-size: 11px; line-height: 16px; text-align: center;
}
.hicon { cursor: pointer; color: var(--ink-2); display: flex; font-size: 18px; background: none; border: 0; padding: 4px; border-radius: 6px; }
.hicon:hover { color: var(--ink); background: var(--primary-soft); }
.admin-name { font-size: 13px; color: var(--ink-2); }
.page {
  max-width: var(--content-max, 1500px); width: 100%; margin: 0 auto;
  padding: var(--page-pad, 22px 20px); flex: 1;
}

/* ── sidebar ── */
.sidenav {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 12px;
  background: var(--surface);
  border-right: 1px solid var(--brd);
  position: sticky;
  top: 0;
  height: 100vh;
  z-index: 50;
}
.layout-rail .sidenav {
  width: 64px;
  align-items: center;
  padding: 12px 8px;
}
.side-brand {
  padding: 8px 10px 14px;
  border-bottom: 1px solid var(--brd);
  margin-bottom: 8px;
  width: 100%;
}
.layout-rail .side-brand { justify-content: center; padding: 8px 0 12px; }
.side-pills {
  display: flex; flex-direction: column; gap: 4px; flex: 1; width: 100%;
  overflow: auto;
}
.side-link {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  color: var(--ink-2);
  text-decoration: none;
  font-size: 14px;
  border: 1px solid transparent;
  transition: .15s ease;
}
.layout-rail .side-link { justify-content: center; padding: 12px; }
.side-link:hover { background: var(--primary-soft); color: var(--ink); }
.side-link.active {
  background: var(--primary-soft);
  color: var(--primary);
  border-color: var(--brd-2);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}
.side-label { white-space: nowrap; }
.side-group {
  padding: 12px 12px 4px;
  font-size: 11px; font-weight: 600; letter-spacing: .08em;
  color: var(--ink-3);
}
.side-pills > .side-group:first-child { padding-top: 0; }
.side-sep { height: 1px; margin: 6px 10px; background: var(--brd); }

/* ⌘K 跳转面板 */
.palette-mask { position: fixed; inset: 0; z-index: 3000; display: flex; justify-content: center; align-items: flex-start; padding: 12vh 16px 16px; }
.palette { width: min(520px, 100%); padding: 8px !important; display: flex; flex-direction: column; gap: 4px; }
.palette__input {
  width: 100%; height: 44px; padding: 0 12px;
  border: 0; border-bottom: 1px solid var(--brd); outline: none;
  background: transparent; color: var(--ink); font-size: 15px;
}
.palette__list { list-style: none; margin: 0; padding: 4px 0; max-height: 50vh; overflow: auto; }
.palette__item {
  display: flex; align-items: center; gap: 10px;
  height: 40px; padding: 0 12px; border-radius: var(--radius-md);
  color: var(--ink-2); cursor: pointer; font-size: 14px;
}
.palette__item.is-on { background: var(--adm-hover, var(--primary-soft)); color: var(--ink); }
.palette__group { margin-left: auto; font-size: 11px; color: var(--ink-3); }
.palette__empty { padding: 16px 12px; color: var(--ink-3); font-size: 13px; }
.palette__hint { padding: 8px 12px 4px; border-top: 1px solid var(--brd); font-size: 11.5px; color: var(--ink-3); }
.palette__hint kbd { margin: 0 2px; }
.side-foot {
  display: flex; flex-direction: column; gap: 8px;
  padding-top: 12px; border-top: 1px solid var(--brd);
  width: 100%;
}
.layout-rail .side-foot { align-items: center; }
.side-tool {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 36px; border-radius: var(--radius-md);
  border: 1px solid var(--brd); background: var(--surface-2);
  color: var(--ink-2); cursor: pointer;
}
.layout-rail .side-tool { width: 40px; }

.subtop {
  border-bottom: 1px solid var(--brd);
  background: var(--surface-solid);
  position: sticky; top: 0; z-index: 40;
}
.subtop-inner {
  height: 48px; padding: 0 20px;
  display: flex; align-items: center; justify-content: space-between;
}
.subtop-title {
  font-family: var(--font-display, var(--font-serif));
  font-weight: 700; font-size: 15px; color: var(--ink);
}

/* cyber 侧栏霓虹已移到 style.css：scoped 里的 :global(html[...]) .sidenav 会被编译成裸的
   html[data-skin=cyber]{…}，把侧栏渐变刷到整个 html 上。 */

/* 窄屏顶栏：品牌 + 操作一行，导航单独一行横向滑动（原来换行后压在页面内容上） */
@media (max-width: 900px) {
  .nav-inner { height: auto; flex-wrap: wrap; row-gap: 8px; padding: 10px 14px; }
  .nav-actions { margin-left: auto; gap: 8px; }
  .nav-actions .admin-name { display: none; }
  .kbd-btn kbd { display: none; }
  .nav-pills {
    order: 3;
    flex: 1 0 100%;
    flex-wrap: nowrap;
    overflow-x: auto;
    gap: 4px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    mask-image: linear-gradient(to right, #000 88%, transparent);
  }
  .nav-pills::-webkit-scrollbar { display: none; }
  .page { padding: 16px 14px; }
}

@media (max-width: 900px) {
  .layout-sidebar .sidenav,
  .layout-rail .sidenav {
    width: 56px;
    padding: 10px 6px;
  }
  .side-label, .layout-sidebar .brand-text, .layout-sidebar .admin-name,
  .layout-sidebar .side-foot .el-button:not(.is-circle) {
    display: none !important;
  }
  .side-brand, .side-link, .side-foot { align-items: center; justify-content: center; }
}
</style>
