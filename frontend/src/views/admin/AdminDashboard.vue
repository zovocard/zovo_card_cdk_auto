<template>
  <div class="adm-page">
    <AdminPageHeader title="总览" desc="CDK 白标门户：卡台发码 / 公开兑换 / Webhook / Session 账单查询" @more="onMore">
      <el-button :loading="statsLoading" @click="loadStats">刷新</el-button>
      <template #more>
        <el-dropdown-item command="pwd">修改密码</el-dropdown-item>
        <el-dropdown-item command="version">检查更新</el-dropdown-item>
      </template>
    </AdminPageHeader>

    <div class="w-full space-y-4">
      <div v-if="statsError" class="inline-err" :class="{ 'inline-err--setup': stats.configured === false }">
        <span>{{ statsError }}</span>
        <span class="flex gap-2 items-center">
          <router-link v-if="stats.configured === false" to="/ops/integration" class="adm-link text-xs">去配置 →</router-link>
          <el-button size="small" :loading="statsLoading" @click="loadStats">重试</el-button>
        </span>
      </div>
      <div v-if="stats.counts_partial" class="alert alert-warning text-sm">
        CDK 数量较多，状态分布为扫描样本汇总；总数仍以卡台 total 为准。
      </div>

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article v-for="card in statCards" :key="card.label" class="card stat-card">
          <div class="stat-card__label">{{ card.label }}</div>
          <div class="stat-card__value mono">
            <span v-if="card.value === '…'" class="sk" style="width: 72px; height: 28px" />
            <template v-else>{{ card.value }}</template>
          </div>
          <div class="stat-card__hint">{{ card.hint }}</div>
        </article>
      </div>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <section class="card space-y-3">
          <h2 class="adm-section-title">快捷入口</h2>
          <div class="flex flex-wrap gap-2">
            <router-link to="/ops/cdkeys" class="btn-primary !px-4 !py-2 text-sm">CDK 卡密</router-link>
            <router-link to="/ops/orders" class="btn-secondary !px-4 !py-2 text-sm">兑换对账</router-link>
            <router-link to="/ops/integration" class="btn-secondary !px-4 !py-2 text-sm">卡台接入</router-link>
            <router-link to="/ops/webhooks" class="btn-secondary !px-4 !py-2 text-sm">Webhook</router-link>
            <router-link to="/ops/appearance" class="btn-secondary !px-4 !py-2 text-sm">外观</router-link>
            <router-link to="/billing" class="btn-secondary !px-4 !py-2 text-sm">Session 账单</router-link>
          </div>
        </section>
        <section class="card space-y-3">
          <h2 class="adm-section-title">能力说明</h2>
          <ul class="text-sm text-muted list-disc pl-5 space-y-1">
            <li>发码 / 实时服务费：卡台 Open API</li>
            <li>用户兑换：公开 CDK 四步 + 本站 BFF</li>
            <li>对账：开通邮箱 / 用卡 / 金额 / CDK 消耗或释放</li>
            <li>结果通知：轮询 result + 可选 Webhook</li>
          </ul>
        </section>
        <section class="card space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="adm-section-title">版本更新</h2>
              <p class="text-xs text-muted mt-1">GitHub 预编译包 · 一键无痕热更</p>
            </div>
            <el-button size="small" :loading="versionLoading" @click="loadVersion(true)">检查更新</el-button>
          </div>
          <div v-if="versionError" class="text-sm" style="color: var(--err)">{{ versionError }}</div>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between gap-2">
              <span class="text-muted">当前版本</span>
              <span class="mono font-semibold text-ink">v{{ versionInfo.current || '—' }}</span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-muted">GitHub 最新</span>
              <span class="mono font-semibold" :style="versionInfo.update_available ? 'color: var(--warn)' : 'color: var(--good)'">
                {{ versionInfo.latest ? `v${versionInfo.latest}` : '—' }}
              </span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-muted">状态</span>
              <el-tag size="small" :type="versionInfo.update_available ? 'warning' : 'success'">
                {{ versionInfo.update_available ? '有新版本' : (versionInfo.latest ? '已是最新' : '未取到远端') }}
              </el-tag>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-muted">发布包</span>
              <el-tag size="small" :type="versionInfo.has_bundle ? 'success' : 'info'">
                {{ versionInfo.has_bundle ? 'cdk-bundle 可用' : '无预编译包' }}
              </el-tag>
            </div>
            <div v-if="versionInfo.github_repo" class="text-xs text-subtle break-all">
              仓库 {{ versionInfo.github_repo }}
              <span v-if="versionInfo.checked_at"> · 检查于 {{ formatChecked(versionInfo.checked_at) }}</span>
            </div>
          </div>

          <!-- 热更进度 -->
          <div v-if="updating || updatePhase" class="rounded-xl p-3 space-y-2" style="background: var(--surface-2)">
            <div class="flex justify-between text-xs text-muted">
              <span>{{ updateMessage || updatePhase }}</span>
              <span class="mono">{{ updateProgress }}%</span>
            </div>
            <div class="h-2 rounded-full overflow-hidden" style="background: var(--brd)">
              <div
                class="h-2 rounded-full transition-all duration-300"
                :style="{ width: `${updateProgress}%`, background: updateFailed ? 'var(--err)' : 'var(--primary)' }"
              />
            </div>
            <div v-if="updateFailed" class="text-xs" style="color: var(--err)">{{ updateError }}</div>
          </div>

          <div class="flex flex-wrap gap-2 pt-1">
            <el-button
              type="primary"
              :loading="updating"
              :disabled="!canOneClickUpdate"
              @click="oneClickUpdate"
            >
              {{ updating ? '更新中…' : '一键无痕更新' }}
            </el-button>
            <a
              v-if="versionInfo.release_url"
              class="btn-secondary !px-4 !py-2 text-sm"
              :href="versionInfo.release_url"
              target="_blank"
              rel="noopener noreferrer"
            >打开 Release</a>
            <a
              v-if="versionInfo.tags_url"
              class="btn-secondary !px-4 !py-2 text-sm"
              :href="versionInfo.tags_url"
              target="_blank"
              rel="noopener noreferrer"
            >查看 Tags</a>
          </div>
          <p class="text-xs text-subtle leading-relaxed">
            在线下载发布包 → 热替换二进制与前端 → 进程 re-exec 重载。
            <b>不修改</b> app.env / 数据库。需 Release 挂有 <code>cdk-bundle-linux-amd64.tgz</code>（git tag 触发 CI 自动上传）。
          </p>
        </section>
      </div>
    </div>

    <div
      v-if="pwdModal"
      class="modal-mask fixed inset-0 z-50 flex items-center justify-center p-4"
      @click.self="closePwdModal"
    >
      <div class="card card-solid w-full max-w-md space-y-4" role="dialog" aria-modal="true">
        <h2 class="adm-section-title !text-lg">修改密码</h2>
        <div class="form-group">
          <label>旧密码</label>
          <input v-model="pwdForm.old_password" type="password" class="input" autocomplete="current-password" />
        </div>
        <div class="form-group">
          <label>新密码（至少 12 位）</label>
          <input v-model="pwdForm.new_password" type="password" class="input" autocomplete="new-password" />
        </div>
        <div class="form-group">
          <label>确认新密码</label>
          <input v-model="pwdForm.confirm" type="password" class="input" autocomplete="new-password" />
        </div>
        <div v-if="pwdError" class="alert alert-error">{{ pwdError }}</div>
        <div class="flex gap-2 justify-end">
          <el-button @click="closePwdModal">取消</el-button>
          <el-button type="primary" :loading="pwdLoading" @click="submitPwd">保存</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { authFetch } from '../../lib/api'
import { dialog } from '../../lib/dialog'
import AdminPageHeader from '../../components/admin/AdminPageHeader.vue'

const stats = ref<any>({})
const statsError = ref('')
const statsLoading = ref(false)
const statsLoaded = ref(false)
const pwdModal = ref(false)
const pwdLoading = ref(false)
const pwdError = ref('')
const pwdForm = reactive({ old_password: '', new_password: '', confirm: '' })

const versionLoading = ref(false)
const versionError = ref('')
const versionInfo = ref<any>({})

const updating = ref(false)
const updatePhase = ref('')
const updateMessage = ref('')
const updateProgress = ref(0)
const updateFailed = ref(false)
const updateError = ref('')
let updatePollTimer: number | null = null

const canOneClickUpdate = computed(() => {
  if (updating.value) return false
  if (versionInfo.value.update_enabled === false) return false
  // 有新版本且有 bundle，或强制允许「重装最新」当 has_bundle
  if (versionInfo.value.one_click_ready) return true
  return !!(versionInfo.value.has_bundle && versionInfo.value.latest && versionInfo.value.update_available)
})

function numOrDash(v: unknown) {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) ? n : '—'
}

function formatChecked(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function stopUpdatePoll() {
  if (updatePollTimer != null) {
    window.clearInterval(updatePollTimer)
    updatePollTimer = null
  }
}

async function pollUpdateStatus() {
  try {
    const r = await authFetch('/api/v1/admin/system/update/status')
    const d = await r.json().catch(() => ({}))
    const st = d.state || {}
    updatePhase.value = st.phase || ''
    updateMessage.value = st.message || ''
    updateProgress.value = Number(st.progress) || 0
    if (st.phase === 'failed') {
      updateFailed.value = true
      updateError.value = st.error || st.message || '更新失败'
      updating.value = false
      stopUpdatePoll()
      return
    }
    if (st.phase === 'reloading' || st.phase === 'done') {
      updateMessage.value = st.message || '重载中，等待服务恢复…'
      updateProgress.value = Math.max(updateProgress.value, 95)
      // 轮询 health + 新版本
      await waitForReload()
    }
  } catch {
    // 进程 re-exec 瞬间可能短暂断连，继续等 health
    await waitForReload()
  }
}

async function waitForReload() {
  stopUpdatePoll()
  const before = versionInfo.value.current
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500))
    try {
      const h = await fetch('/health', { credentials: 'include' })
      if (!h.ok) continue
      // 恢复后刷新版本
      await loadVersion(true)
      const after = versionInfo.value.current
      updateProgress.value = 100
      updatePhase.value = 'done'
      updateMessage.value = after && after !== before
        ? `已热更至 v${after}`
        : `服务已恢复（当前 v${after || before || '—'}）`
      updating.value = false
      updateFailed.value = false
      return
    } catch {
      /* keep waiting */
    }
  }
  updateFailed.value = true
  updateError.value = '重载超时：请手动刷新页面并检查 systemctl status cdk-recharge'
  updating.value = false
}

async function oneClickUpdate() {
  if (!canOneClickUpdate.value) return
  const target = versionInfo.value.latest || 'latest'
  const ok = await dialog.confirm(
    '• 在线下载 GitHub 预编译包\n' +
      '• 热替换二进制与前端（不改 app.env / 数据库）\n' +
      '• 进程 re-exec 亚秒重载',
    { title: `确认一键无痕更新到 v${target}？`, okText: '开始更新' },
  )
  if (!ok) return

  updating.value = true
  updateFailed.value = false
  updateError.value = ''
  updatePhase.value = 'starting'
  updateMessage.value = '提交更新任务…'
  updateProgress.value = 2
  try {
    const r = await authFetch('/api/v1/admin/system/update', {
      method: 'POST',
      body: JSON.stringify({ target: 'latest', confirm: true }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok && r.status !== 202) {
      updateFailed.value = true
      updateError.value = d.error || '启动更新失败'
      updating.value = false
      return
    }
    stopUpdatePoll()
    updatePollTimer = window.setInterval(() => {
      pollUpdateStatus()
    }, 800)
    await pollUpdateStatus()
  } catch (e: any) {
    updateFailed.value = true
    updateError.value = e?.message || '网络错误'
    updating.value = false
  }
}

const statCards = computed(() => {
  const s = stats.value || {}
  return [
    { label: 'CDK 总数', value: (statsLoading.value && !statsLoaded.value) ? '…' : numOrDash(s.total_cdks ?? s.total_cdkeys), hint: '卡台 Open API' },
    { label: '可用 CDK', value: (statsLoading.value && !statsLoaded.value) ? '…' : numOrDash(s.unused_cdks ?? s.active_cdks ?? s.active_cdkeys), hint: 'unused 未使用' },
    { label: '已兑换', value: (statsLoading.value && !statsLoaded.value) ? '…' : numOrDash(s.consumed_cdks), hint: 'consumed' },
    { label: '兑换订单', value: (statsLoading.value && !statsLoaded.value) ? '…' : numOrDash(s.total_cdk_orders ?? s.total_tasks), hint: '卡台 CDK 订单' },
  ]
})

async function loadVersion(force = false) {
  versionLoading.value = true
  versionError.value = ''
  try {
    const q = force ? '?refresh=1' : ''
    const r = await authFetch(`/api/v1/admin/system/version${q}`)
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      versionError.value = d.error || '版本检查失败'
      return
    }
    versionInfo.value = d
    if (d.github_error && !d.latest) {
      versionError.value = `GitHub: ${d.github_error}`
    }
  } catch (e: any) {
    versionError.value = e?.message || '网络错误'
  } finally {
    versionLoading.value = false
  }
}

function onMore(cmd: string) {
  if (cmd === 'pwd') return openPwdModal()
  if (cmd === 'version') return loadVersion(true)
}

async function loadStats() {
  statsLoading.value = true
  statsError.value = ''
  try {
    const r = await authFetch('/api/v1/stats/system')
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      statsError.value = d.error || '加载统计失败'
      return
    }
    stats.value = d
    if (d.error) {
      statsError.value = d.configured === false
        ? '未配置卡台 API Key，请先到「卡台接入」填写'
        : String(d.error)
    }
  } catch (e: any) {
    statsError.value = e?.message || '网络错误'
  } finally {
    statsLoading.value = false
    statsLoaded.value = true
  }
}

onMounted(() => {
  loadStats()
  loadVersion(false)
})

function openPwdModal() {
  pwdError.value = ''
  pwdForm.old_password = ''
  pwdForm.new_password = ''
  pwdForm.confirm = ''
  pwdModal.value = true
}
function closePwdModal() {
  pwdModal.value = false
}
async function submitPwd() {
  pwdError.value = ''
  if (pwdForm.new_password !== pwdForm.confirm) {
    pwdError.value = '两次新密码不一致'
    return
  }
  pwdLoading.value = true
  try {
    const r = await authFetch('/api/v1/auth/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({
        old_password: pwdForm.old_password,
        new_password: pwdForm.new_password,
      }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      pwdError.value = d.error || '修改失败'
      return
    }
    pwdModal.value = false
  } finally {
    pwdLoading.value = false
  }
}
</script>

<style scoped>
.stat-card { display: flex; flex-direction: column; gap: 4px; min-height: 112px; }
.stat-card__label { font-size: 13px; color: var(--ink-2); }
.stat-card__value { display: flex; align-items: center; min-height: 40px; font-size: 28px; line-height: 36px; font-weight: 700; color: var(--ink); }
.stat-card__hint { font-size: 12px; color: var(--ink-3); }
</style>
