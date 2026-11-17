<template>
  <div class="adm-page">
    <AdminPageHeader title="审计日志" desc="管理员登录、改密、卡密增删禁用、任务处理、长链接生成等敏感操作（最近 300 条）">
      <el-button type="primary" :loading="loading" @click="loadLogs">刷新</el-button>
    </AdminPageHeader>

    <section class="card list-card">
      <div class="adm-toolbar">
        <el-input v-model="q" clearable class="adm-search" data-admin-search placeholder="搜索管理员 / 详情 / IP（按 / 聚焦）" />
        <el-select v-model="actionFilter" clearable placeholder="操作类型" style="width: 200px">
          <el-option v-for="a in actionFacets" :key="a.action" :label="`${actionLabel(a.action)} (${a.count})`" :value="a.action" />
        </el-select>
        <span class="flex-1" />
        <span class="text-xs text-subtle tabular">显示 {{ filtered.length }} / {{ logs.length }} 条</span>
      </div>
      <div v-if="q.trim() || actionFilter" class="chips">
        <span v-if="actionFilter" class="chip">操作：{{ actionLabel(actionFilter) }}
          <button type="button" class="chip__x" aria-label="移除操作筛选" @click="actionFilter = ''">×</button>
        </span>
        <span v-if="q.trim()" class="chip">搜索：{{ q.trim() }}
          <button type="button" class="chip__x" aria-label="移除搜索" @click="q = ''">×</button>
        </span>
        <button type="button" class="adm-link text-xs" @click="q = ''; actionFilter = ''">重置</button>
      </div>

      <div v-if="error" class="inline-err">
        <span>{{ error }}</span>
        <el-button size="small" :loading="loading" @click="loadLogs">重试</el-button>
      </div>

      <div class="tbl-wrap">
        <div class="adm-progress" :class="{ 'is-on': loading && loaded }" aria-hidden="true" />
        <TableSkeleton v-if="!loaded" :rows="10" :cols="[1.4, 0.8, 1, 4, 1.2]" />
        <div v-else-if="!filtered.length" class="empty-state">
          <div class="empty-state__title">{{ logs.length ? '没有符合条件的记录' : '暂无审计记录' }}</div>
          <div class="empty-state__desc">{{ logs.length ? '换个关键字，或清除筛选。' : '管理员的敏感操作会记录在这里。' }}</div>
          <el-button v-if="logs.length" type="primary" @click="q = ''; actionFilter = ''">重置筛选</el-button>
        </div>
        <div v-else class="tbl-scroll" :class="`is-${density}`">
          <table class="adm-plain-table">
            <thead>
              <tr>
                <th style="width: 180px">时间</th>
                <th style="width: 120px">管理员</th>
                <th style="width: 140px">操作</th>
                <th>详情</th>
                <th style="width: 150px">IP</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filtered" :key="item.id">
                <td class="text-muted mono nowrap">{{ formatDate(item.created_at) }}</td>
                <td class="text-ink">{{ item.username || '-' }}</td>
                <td><span :class="actionClass(item.action)">{{ actionLabel(item.action) }}</span></td>
                <td class="text-muted mono detail" :title="item.detail || ''">{{ item.detail || '-' }}</td>
                <td class="text-muted mono nowrap">{{ item.ip || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { authFetch } from '../../lib/api'
import AdminPageHeader from '../../components/admin/AdminPageHeader.vue'
import TableSkeleton from '../../components/admin/TableSkeleton.vue'
import { tableDensity as density } from '../../lib/admin-prefs'

interface AuditLog {
  id: number
  username: string
  action: string
  detail: string
  ip: string
  created_at: string
}

const logs = ref<AuditLog[]>([])
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
const q = ref('')
const actionFilter = ref('')

// 数据一次取回（300 条），筛选在本地做：操作类型带计数
const actionFacets = computed(() => {
  const m = new Map<string, number>()
  for (const l of logs.value) m.set(l.action, (m.get(l.action) || 0) + 1)
  return [...m.entries()].map(([action, count]) => ({ action, count })).sort((a, b) => b.count - a.count)
})
const filtered = computed(() => {
  const kw = q.value.trim().toLowerCase()
  return logs.value.filter((l) => {
    if (actionFilter.value && l.action !== actionFilter.value) return false
    if (!kw) return true
    return `${l.username} ${l.detail} ${l.ip} ${actionLabel(l.action)}`.toLowerCase().includes(kw)
  })
})

const loadLogs = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await authFetch('/api/v1/admin/audit-logs?limit=300')
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      // 失败时保留上一次的数据，只提示
      error.value = data.error || `加载失败（HTTP ${response.status}）`
      return
    }
    logs.value = data.logs || []
  } catch (e: any) {
    error.value = e?.message || '网络错误'
  } finally {
    loading.value = false
    loaded.value = true
  }
}

const actionLabel = (action: string) => {
  const labels: Record<string, string> = {
    login: '登录',
    change_password: '修改密码',
    cdk_generate: '生成卡密',
    cdk_disable: '禁用卡密',
    cardplatform_cdk_note_set: '设置CDK备注',
    cardplatform_cdk_note_clear: '清除CDK备注',
    cardplatform_batch_note_set: '批量CDK备注',
    cardplatform_batch_note_clear: '批量清除CDK备注',
    cdk_delete: '删除卡密',
    task_approve: '任务完成',
    task_reject: '任务失败',
    checkout_generate: '生成长链接',
  }
  return labels[action] || action
}

const actionClass = (action: string) => {
  const classes: Record<string, string> = {
    login: 'pill pill-info',
    change_password: 'pill pill-warn',
    cdk_generate: 'pill pill-good',
    cdk_disable: 'pill pill-warn',
    cardplatform_cdk_note_set: 'pill pill-info',
    cardplatform_cdk_note_clear: 'pill',
    cardplatform_batch_note_set: 'pill pill-info',
    cardplatform_batch_note_clear: 'pill',
    cdk_delete: 'pill pill-err',
    task_approve: 'pill pill-good',
    task_reject: 'pill pill-err',
    checkout_generate: 'pill pill-info',
  }
  return classes[action] || 'pill'
}

const formatDate = (value: string) => (value ? new Date(value).toLocaleString('zh-CN') : '-')

onMounted(loadLogs)
</script>

<style scoped>
.list-card { display: flex; flex-direction: column; gap: 12px; }
.tbl-wrap { position: relative; }
.nowrap { white-space: nowrap; }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 12.5px; }
.detail { max-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
