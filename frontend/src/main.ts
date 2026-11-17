import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { installElement } from './element'
import App from './App.vue'
import router from './router'
import './style.css'
import './styles/skins.css'
import './styles/mythic-skins.css'
import './styles/mythic-personality.css'
import './styles/admin.css'
import { useAuthStore } from './stores/auth'
import { initTheme, setSiteBrand, setSkin, setTheme, type SkinId, type ThemeMode } from './theme'
import { i18n } from './i18n'

initTheme()

async function loadPublicSite() {
  try {
    const r = await fetch('/api/v1/public/site')
    if (!r.ok) return
    const d = await r.json()
    // 品牌 + 整站主题：管理员在后台设定，对所有用户生效
    if (d.brand_name) setSiteBrand({ name: d.brand_name, sub: d.brand_sub || '' })
    if (d.skin) setSkin(d.skin as SkinId)
    // 明暗：用户本机偏好优先；无偏好时跟服务端默认
    const hasLocalMode = !!localStorage.getItem('theme-mode')
    if (!hasLocalMode && d.theme_mode) setTheme(d.theme_mode as ThemeMode)
  } catch {
    /* offline / first boot */
  }
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(i18n)
installElement(app)

const authStore = useAuthStore(pinia)
authStore.restore()

// 不等站点配置：先按本机缓存的皮肤渲染，配置返回后再原子切换（首屏不再被一次网络请求卡住）。
app.mount('#app')
void loadPublicSite()
