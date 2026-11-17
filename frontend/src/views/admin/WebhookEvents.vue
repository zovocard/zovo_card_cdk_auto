<template>
  <div class="adm-page">
    <AdminPageHeader title="Webhook" desc="卡台主动推送兑换结果与卡交易事件（OpenAPI §7）；验签 + 幂等入库">
      <el-button type="primary" :loading="loading" @click="load">刷新事件</el-button>
    </AdminPageHeader>

    <section class="card">
      <div class="mb-3">
        <h2 class="adm-section-title">回调配置</h2>
        <p class="adm-section-desc">
          兑换结果仍可用轮询 <code>/public/cdk/result</code>；配置后卡台会主动推送 <code>gpt_direct.completed</code> / 卡交易等事件。
        </p>
      </div>
      <div class="set-group">
        <div class="set-row">
          <div>
            <div class="set-row__label">回调 URL</div>
            <div class="set-row__desc">填到卡台「开发者」页的回调地址（须 https）</div>
          </div>
          <div class="set-row__field">
            <el-input :model-value="webhookUrl" readonly class="mono-input">
              <template #append>
                <el-button @click="copy(webhookUrl)">复制</el-button>
              </template>
            </el-input>
          </div>
        </div>
        <div class="set-row">
          <div>
            <div class="set-row__label">Webhook Secret</div>
            <div class="set-row__desc">卡台首次保存回调地址后生成的 <code>whsec_…</code>；本站用它校验 <code>X-Signature</code>。留空不修改。</div>
          </div>
          <div class="set-row__field">
            <el-input
              v-model="secretInput"
              type="password"
              show-password
              autocomplete="off"
              :placeholder="secretHint"
            />
            <div class="flex items-center gap-2 text-xs">
              <span class="dot" :class="secretSet ? 'dot--good' : 'dot--warn'" />
              <span :style="{ color: secretSet ? 'var(--ink-2)' : 'var(--warn)' }">
                {{ secretSet ? secretHint : '尚未配置 webhook_secret：卡台回调会被 503/401 拒绝' }}
              </span>
            </div>
            <div>
              <el-button type="primary" :loading="saving" :disabled="!secretInput.trim()" @click="saveSecret">保存 Secret</el-button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="card list-card">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="adm-section-title">最近事件</h2>
          <p class="adm-section-desc">共 {{ events.length }} 条</p>
        </div>
      </div>
      <div v-if="error" class="inline-err">
        <span>{{ error }}</span>
        <el-button size="small" :loading="loading" @click="load">重试</el-button>
      </div>
      <div class="tbl-wrap">
        <div class="adm-progress" :class="{ 'is-on': loading && loaded }" aria-hidden="true" />
        <TableSkeleton v-if="!loaded" :rows="8" :cols="[0.6, 1.4, 2, 1.4, 3]" />
        <div v-else-if="!events.length" class="empty-state">
          <div class="empty-state__title">暂无回调</div>
          <div class="empty-state__desc">先配好回调 URL 与 Secret；未配置时仍可用轮询拿结果。</div>
          <el-button type="primary" @click="copy(webhookUrl)">复制回调 URL</el-button>
        </div>
        <div v-else class="tbl-scroll" :class="`is-${density}`">
          <table class="adm-plain-table">
            <thead>
              <tr>
                <th style="width: 80px">ID</th>
                <th style="width: 190px">类型</th>
                <th style="width: 240px">幂等键</th>
                <th style="width: 180px">时间</th>
                <th>摘要</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in events" :key="e.id">
                <td class="mono">{{ e.id }}</td>
                <td><span class="badge badge--primary">{{ e.event_type }}</span></td>
                <td class="mono ellipsis" :title="e.idem_key">{{ e.idem_key }}</td>
                <td class="mono text-muted nowrap">{{ e.created_at }}</td>
                <td class="text-subtle ellipsis" :title="summarize(e.payload)">{{ summarize(e.payload) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <UnsavedBar :show="!!secretInput.trim()" :saving="saving" detail="Webhook Secret" @discard="secretInput = ''" @save="saveSecret" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { authFetch } from '../../lib/api'
import { dialog } from '../../lib/dialog'
import { copyToClipboard } from '../../lib/clipboard'
import AdminPageHeader from '../../components/admin/AdminPageHeader.vue'
import TableSkeleton from '../../components/admin/TableSkeleton.vue'
import UnsavedBar from '../../components/admin/UnsavedBar.vue'
import { tableDensity as density } from '../../lib/admin-prefs'

const webhookUrl = ref('https://gptcdk.ai/api/v1/webhooks/cardplatform')
const secretSet = ref(false)
const secretHint = ref('未配置')
const secretInput = ref('')
const events = ref<any[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const loaded = ref(false)

function summarize(p: any) {
  if (!p || typeof p !== 'object') return '—'
  if (p.type === 'gpt_direct.completed' || p.order_id) {
    return `order=${p.order_id || ''} plan=${p.plan || ''} status=${p.status || ''}`
  }
  if (p.event === 'card_transaction') {
    return `${p.type || ''} ${p.status || ''} ${p.merchant_name || p.merchant || ''}`
  }
  if (p.event === 'card_operation') {
    return `${p.operation || ''} ${p.status || ''}`
  }
  return Object.keys(p).slice(0, 4).join(',')
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const r = await authFetch('/api/v1/admin/webhooks/events')
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      error.value = d.error || '加载失败'
      return
    }
    if (d.webhook_url) webhookUrl.value = d.webhook_url
    secretSet.value = !!d.webhook_secret_set
    secretHint.value = d.webhook_secret_set ? `已配置 ${d.webhook_secret_hint || ''}` : '未配置'
    events.value = d.events || []
  } catch (e: any) {
    error.value = e?.message || '网络错误'
  } finally {
    loading.value = false
    loaded.value = true
  }
}

async function saveSecret() {
  if (!secretInput.value.trim()) {
    dialog.toast('请填写 secret', 'err')
    return
  }
  saving.value = true
  try {
    const r = await authFetch('/api/v1/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ webhook_secret: secretInput.value.trim() }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      dialog.toast(d.error || '保存失败', 'err')
      return
    }
    secretInput.value = ''
    dialog.toast('已保存 webhook_secret', 'ok')
    await load()
  } finally {
    saving.value = false
  }
}

async function copy(t: string) {
  // 后台常跑在 http 内网地址上，navigator.clipboard 不可用；copyToClipboard 有 execCommand 回退
  const ok = await copyToClipboard(t)
  dialog.toast(ok ? '已复制' : '复制失败', ok ? 'ok' : 'err')
}

onMounted(load)
</script>

<style scoped>
.list-card { display: flex; flex-direction: column; gap: 12px; }
.tbl-wrap { position: relative; }
.nowrap { white-space: nowrap; }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 12.5px; }
.ellipsis { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mono-input :deep(.el-input__inner) { font-family: var(--font-mono); font-size: 12.5px; }
</style>
