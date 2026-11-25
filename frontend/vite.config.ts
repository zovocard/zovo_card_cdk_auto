import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 哪些源码属于「管理端」：这些 chunk 单独打到 assets/admin/，由后端静态兜底对
// /assets/admin/* 校验 auth_token 是管理员才放行（见 backend server/http.go）。
// 未登录/非管理员下载后台 JS 一律 404，接口路径、上游品牌不再对匿名访客暴露。
// ★前提★：管理端视图必须懒加载（router 里 () => import()），否则会被并进公共入口包，
// 既拆不出去也会把后台路径带进公共包。当前 router 已全部懒加载。
function isConsoleModule(id: string): boolean {
  // ★例外:SetupView 是登录前的初始化向导(/ops/setup),新实例或未登录时就要加载它,
  // 不能进受保护的 assets/admin/——否则会被 auth_token 网关 404,setup 页崩(v1.4.39 回归)。
  // 它只引入 vue/vue-router/auth store,不含任何后台组件,放公共目录安全。
  if (/[\\/]src[\\/]views[\\/]admin[\\/]SetupView\.vue/.test(id)) return false
  return /[\\/]src[\\/](views[\\/]admin[\\/]|components[\\/]admin[\\/]|layouts[\\/]AdminLayout\.vue)/.test(id)
}

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // 生产不再对外发布 sourcemap：原来每次构建 8 MB 的 .map 跟着上线，等于公开完整源码。
    sourcemap: false,
    rollupOptions: {
      output: {
        // 框架与组件库单独成块：业务代码改动不会让用户重新下载这些不变的依赖。
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('element-plus') || id.includes('@element-plus')) return 'vendor-element'
          if (id.includes('chart.js') || id.includes('vue-chartjs')) return 'vendor-chart'
          if (id.includes('xlsx')) return 'vendor-xlsx'
          if (/[\\/]node_modules[\\/](vue|@vue|vue-router|pinia|vue-i18n|@intlify)[\\/]/.test(id)) return 'vendor-vue'
        },
        // ★后台代码单独放 assets/admin/★：含任一管理端模块的 chunk 落到受保护目录，
        // 其余照旧放 assets/。公共 chunk 绝不能混入管理端模块，否则整块会被 404 挡掉白屏——
        // 懒加载 + 本谓词保证管理端自成独立 chunk。
        chunkFileNames: (chunk) =>
          chunk.moduleIds.some(isConsoleModule) ? 'assets/admin/[name]-[hash].js' : 'assets/[name]-[hash].js',
      },
    },
  },
})
