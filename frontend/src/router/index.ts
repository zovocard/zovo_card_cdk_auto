import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '../stores/auth'

// 管理端入口故意不用 /admin，降低扫路径风险。API 仍为 /api/v1/admin/*（服务端鉴权）。
const OPS_BASE = '/ops'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeView.vue'),
  },
  // 旧登录路径 → 隐蔽入口
  { path: '/auth/login', redirect: `${OPS_BASE}/login` },
  { path: '/admin', redirect: OPS_BASE },
  { path: '/admin/:pathMatch(.*)*', redirect: (to) => `${OPS_BASE}/${to.params.pathMatch || ''}` },
  {
    path: `${OPS_BASE}/login`,
    name: 'Login',
    component: () => import('../views/auth/LoginView.vue'),
  },
  {
    path: `${OPS_BASE}/setup`,
    name: 'Setup',
    component: () => import('../views/admin/SetupView.vue'),
    meta: { setupPage: true },
  },
  {
    path: '/auth/register',
    name: 'Register',
    component: () => import('../views/auth/RegisterView.vue'),
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/user/DashboardView.vue'),
  },
  {
    path: '/billing',
    name: 'BillingCheck',
    component: () => import('../views/user/BillingCheckView.vue'),
  },
  {
    path: '/recharge',
    name: 'Recharge',
    component: () => import('../views/user/RechargeView.vue'),
  },
  {
    path: '/batch',
    name: 'BatchRedeem',
    component: () => import('../views/user/BatchRedeemView.vue'),
  },
  {
    path: '/history',
    name: 'CDKStatusLookup',
    component: () => import('../views/user/CDKStatusView.vue'),
  },
  {
    path: '/lookup',
    redirect: '/history',
  },
  // 代理隐藏换码页（不进导航；管理员设密码后使用）
  {
    path: '/partner/swap',
    name: 'AgentCDKSwap',
    component: () => import('../views/user/AgentSwapView.vue'),
  },
  {
    path: '/a/swap',
    redirect: '/partner/swap',
  },
  {
    path: OPS_BASE,
    component: () => import('../layouts/AdminLayout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      { path: '', name: 'AdminDashboard', component: () => import('../views/admin/AdminDashboard.vue') },
      { path: 'cdkeys', name: 'CDKeyManagement', component: () => import('../views/admin/CDKeyManagement.vue') },
      { path: 'orders', name: 'OrderReconcile', component: () => import('../views/admin/OrderReconcile.vue') },
      { path: 'appearance', name: 'SiteAppearance', component: () => import('../views/admin/SiteAppearance.vue') },
      { path: 'integration', name: 'CardIntegration', component: () => import('../views/admin/CardIntegration.vue') },
      { path: 'audit', name: 'AuditLogs', component: () => import('../views/admin/AuditLogs.vue') },
      { path: 'webhooks', name: 'Webhooks', component: () => import('../views/admin/WebhookEvents.vue') },
      { path: 'card-selection', name: 'CardSelectionConfig', component: () => import('../views/admin/CardSelectionConfig.vue') },
      // 旧路径兼容
      { path: 'accounts', redirect: OPS_BASE },
      { path: 'proxies', redirect: OPS_BASE },
      { path: 'recharge-requests', redirect: OPS_BASE },
      { path: 'billing', redirect: `${OPS_BASE}/orders` },
      { path: 'cards', redirect: `${OPS_BASE}/integration` },
      { path: 'statistics', redirect: OPS_BASE },
      { path: 'checkout', redirect: OPS_BASE },
      { path: 'reconcile', redirect: `${OPS_BASE}/orders` },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFoundView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

let setupChecked = false
let setupInstalled = true

async function ensureSetupStatus(): Promise<boolean> {
  if (setupChecked) return setupInstalled
  try {
    const r = await fetch('/api/v1/setup/status')
    const d = await r.json()
    setupInstalled = !!d.installed
  } catch {
    setupInstalled = true // 后端不可达时不阻断登录页
  }
  setupChecked = true
  return setupInstalled
}

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  const installed = await ensureSetupStatus()

  // 未安装：强制进安装向导（登录页除外可看，但推荐 setup）
  if (!installed && !to.meta.setupPage && to.path.startsWith(OPS_BASE) && to.path !== `${OPS_BASE}/login`) {
    return `${OPS_BASE}/setup`
  }
  if (installed && to.meta.setupPage) {
    return `${OPS_BASE}/login`
  }

  if (to.meta.requiresAdmin && !authStore.isLoggedIn) {
    return {
      path: `${OPS_BASE}/login`,
      query: { redirect: to.fullPath },
    }
  }

  if ((to.path === `${OPS_BASE}/login` || to.path === '/auth/login') && authStore.isLoggedIn) {
    return OPS_BASE
  }
})

// 区域标记：/ops 下是管理端。styles/admin.css 只在 html[data-area=admin] 下生效，
// 用户页外观不受影响；body 挂载的弹层（下拉/弹窗/抽屉）也在 html 之下，能读到同一套变量。
export function isAdminPath(path: string) {
  return path === OPS_BASE || path.startsWith(`${OPS_BASE}/`)
}
router.afterEach((to) => {
  const root = document.documentElement
  if (isAdminPath(to.path)) root.setAttribute('data-area', 'admin')
  else root.removeAttribute('data-area')
})

export default router
