<template>
  <div class="adm-page">
    <AdminPageHeader title="兑换对账" desc="卡台 CDK 兑换订单：开通邮箱、用卡、开通时间、实付金额、CDK 消耗 / 释放状态">
      <el-button type="primary" :loading="loading" @click="load">刷新</el-button>
    </AdminPageHeader>

    <section class="card list-card">
      <div class="adm-toolbar">
        <el-input
          v-model="emailQ"
          clearable
          class="adm-search"
          data-admin-search
          placeholder="邮箱关键字（筛本页，按 / 聚焦）"
        />
        <el-select
          v-model="statusFilter"
          clearable
          placeholder="订单状态"
          style="width: 160px"
          @change="onFilterChange"
        >
          <el-option v-for="s in statusOptions" :key="s" :label="s" :value="s" />
        </el-select>
        <span class="flex-1" />
        <span class="text-xs text-subtle tabular">共 <b class="mono text-ink">{{ total }}</b> 笔</span>
      </div>

      <div v-if="statusFilter || emailQ.trim()" class="chips">
        <span v-if="statusFilter" class="chip">状态：{{ statusFilter }}
          <button type="button" class="chip__x" aria-label="移除状态筛选" @click="statusFilter = ''; onFilterChange()">×</button>
        </span>
        <span v-if="emailQ.trim()" class="chip">邮箱：{{ emailQ.trim() }}
          <button type="button" class="chip__x" aria-label="移除邮箱筛选" @click="emailQ = ''">×</button>
        </span>
        <button type="button" class="adm-link text-xs" @click="resetFilters">重置</button>
      </div>

      <div v-if="error" class="inline-err">
        <span>{{ error }}</span>
        <span class="flex gap-2 items-center">
          <router-link to="/ops/integration" class="adm-link text-xs">检查卡台接入 →</router-link>
          <el-button size="small" :loading="loading" @click="load">重试</el-button>
        </span>
      </div>

      <div class="tbl-wrap">
        <div class="adm-progress" :class="{ 'is-on': loading && loaded }" aria-hidden="true" />
        <TableSkeleton v-if="!loaded" :rows="8" :cols="[1, 1.6, 1, 0.8, 2, 1.6, 1.2, 1.6, 1]" :row-height="52" />
        <div v-else-if="!displayRows.length" class="empty-state">
          <template v-if="emailQ.trim() || statusFilter">
            <div class="empty-state__title">没有符合筛选条件的订单</div>
            <div class="empty-state__desc">邮箱关键字只筛当前页；换一页或清除筛选再看。</div>
            <el-button type="primary" @click="resetFilters">重置筛选</el-button>
          </template>
          <template v-else>
            <div class="empty-state__title">暂无兑换订单</div>
            <div class="empty-state__desc">{{ error ? '卡台列表没有取到（见上方错误）。' : '用户兑换 CDK 后，订单会出现在这里。' }}</div>
            <el-button type="primary" :loading="loading" @click="load">刷新</el-button>
          </template>
        </div>
        <el-table v-else :data="displayRows" class="adm-table" :class="`is-${density}`" :max-height="tableMaxHeight" stripe>
          <el-table-column prop="order_id" label="订单" width="96" fixed="left">
            <template #default="{ row }">
              <span class="mono">#{{ row.order_id || row.id }}</span>
            </template>
          </el-table-column>
          <el-table-column label="订单状态" width="132">
            <template #default="{ row }">
              <el-tag size="small" :type="orderTagType(row.status)" disable-transitions>{{ row.status || '—' }}</el-tag>
              <div v-if="row.stage" class="cell-sub">{{ row.stage }}</div>
            </template>
          </el-table-column>
          <el-table-column label="CDK" min-width="140">
            <template #default="{ row }">
              <div class="mono text-xs">{{ row.code_prefix || (row.cdk_id ? `id:${row.cdk_id}` : '—') }}</div>
              <span class="badge mt-1" :class="`badge--${cdkTagType(row) || 'primary'}`">{{ row.cdk_lifecycle || row.cdk_status || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="plan" label="套餐" width="100" />
          <el-table-column label="用户邮箱" min-width="180">
            <template #default="{ row }">
              <span class="mono text-sm cell-ellipsis" :title="row.account_email || ''">{{ row.account_email || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="使用卡片" min-width="140">
            <template #default="{ row }">
              <span class="mono text-sm">{{ cardLabel(row) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="消耗金额" width="128" align="right">
            <template #default="{ row }">
              <div class="mono text-sm">{{ amountLabel(row) }}</div>
              <div class="cell-sub">费 {{ feeLabel(row) }}</div>
            </template>
          </el-table-column>
          <el-table-column label="开通时间" width="176">
            <template #default="{ row }">
              <div class="text-sm nowrap">{{ fmtTime(row.completed_at) }}</div>
              <div class="cell-sub nowrap">创建 {{ fmtTime(row.created_at) }}</div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="112" fixed="right" align="right">
            <template #default="{ row }">
              <span class="row-acts">
                <button type="button" class="row-act" @click="openDetail(row)">详情</button>
                <button
                  v-if="rowCardId(row)"
                  type="button"
                  class="row-act row-act--danger"
                  :disabled="deletingId === String(rowCardId(row))"
                  @click="deleteCard(row)"
                >{{ deletingId === String(rowCardId(row)) ? '删卡中…' : '删卡' }}</button>
              </span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="list-foot">
        <span class="text-xs text-subtle">第 {{ page }} / {{ totalPages }} 页 · 本页 {{ displayRows.length }} 条</span>
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          :page-sizes="[20, 50, 100]"
          :disabled="loading && !loaded"
          @current-change="onPageChange"
          @size-change="onSizeChange"
        />
      </div>
    </section>

    <el-drawer v-model="detailOpen" title="订单详情" size="440px">
      <template v-if="detail">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="订单 ID">{{ detail.order_id || detail.id }}</el-descriptions-item>
          <el-descriptions-item label="CDK ID">{{ detail.cdk_id || '—' }}</el-descriptions-item>
          <el-descriptions-item label="CDK 前缀">{{ detail.code_prefix || '—' }}</el-descriptions-item>
          <el-descriptions-item label="CDK 状态">{{ detail.cdk_status || '—' }} / {{ detail.cdk_lifecycle || '—' }}</el-descriptions-item>
          <el-descriptions-item label="套餐">{{ detail.plan || '—' }}</el-descriptions-item>
          <el-descriptions-item label="用户邮箱">{{ detail.account_email || '—' }}</el-descriptions-item>
          <el-descriptions-item label="使用卡片">{{ cardLabel(detail) }}</el-descriptions-item>
          <el-descriptions-item label="卡 ID">{{ rowCardId(detail) || '—' }}</el-descriptions-item>
          <el-descriptions-item label="卡充值额">{{ fundingCardLabel(detail) }}</el-descriptions-item>
          <el-descriptions-item label="实付">{{ amountLabel(detail) }}</el-descriptions-item>
          <el-descriptions-item label="服务费">{{ feeLabel(detail) }}（{{ detail.service_fee_status || '—' }}）</el-descriptions-item>
          <el-descriptions-item label="订单状态">{{ detail.status }} / {{ detail.stage || '—' }}</el-descriptions-item>
          <el-descriptions-item label="支付状态">{{ detail.payment_state || '—' }}</el-descriptions-item>
          <el-descriptions-item label="资金状态">{{ detail.funding_state || '—' }} / {{ detail.funding_hold_status || '—' }}</el-descriptions-item>
          <el-descriptions-item label="创建">{{ fmtTime(detail.created_at) }}</el-descriptions-item>
          <el-descriptions-item label="开通">{{ fmtTime(detail.completed_at) }}</el-descriptions-item>
          <el-descriptions-item label="更新">{{ fmtTime(detail.updated_at) }}</el-descriptions-item>
          <el-descriptions-item label="client_request_id">
            <span class="mono text-xs break-all">{{ detail.client_request_id || '—' }}</span>
          </el-descriptions-item>
          <el-descriptions-item v-if="detail.user_message" label="说明">{{ detail.user_message }}</el-descriptions-item>
        </el-descriptions>
        <div v-if="rowCardId(detail)" class="danger-zone">
          <div>
            <div class="text-sm font-semibold" style="color: var(--err)">删除虚拟卡</div>
            <p class="text-xs text-muted mt-1">
              调用卡台 <code>DELETE /cards/{id}</code>，永久销卡并将卡内余额退回平台余额。不可撤销。
            </p>
          </div>
          <el-button
            type="danger"
            plain
            :loading="deletingId === String(rowCardId(detail))"
            @click="deleteCard(detail)"
          >
            删除虚拟卡
          </el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authFetch } from '../../lib/api'
import { dialog } from '../../lib/dialog'
import AdminPageHeader from '../../components/admin/AdminPageHeader.vue'
import TableSkeleton from '../../components/admin/TableSkeleton.vue'
import { tableDensity as density } from '../../lib/admin-prefs'

const rows = shallowRef<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const error = ref('')
const statusFilter = ref('')
const emailQ = ref('')
const detailOpen = ref(false)
const detail = ref<any>(null)
const deletingId = ref('')
/** 首次数据到达前显示骨架；之后刷新保留旧数据 + 顶部细进度条 */
const loaded = ref(false)

const viewportH = ref(typeof window !== 'undefined' ? window.innerHeight : 900)
function onResize() { viewportH.value = window.innerHeight }
onMounted(() => window.addEventListener('resize', onResize, { passive: true }))
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  loadAbort?.abort()
})
const tableMaxHeight = computed(() => Math.max(420, viewportH.value - 150))

// 状态 / 页码同步到地址栏
const route = useRoute()
const router = useRouter()

const statusOptions = [
  'completed',
  'queued',
  'running',
  'pending',
  'review',
  'declined',
  'failed_precharge',
  'cancelled',
]

const totalPages = computed(() => {
  const t = total.value
  const s = pageSize.value
  if (t <= 0) return 1
  return Math.max(1, Math.ceil(t / s))
})

/** 状态已服务端筛选；邮箱仍为本页关键字过滤（卡台 OpenAPI 无 email 参数） */
const displayRows = computed(() => {
  let list = rows.value
  const q = emailQ.value.trim().toLowerCase()
  if (q) {
    list = list.filter((r) => String(r.account_email || '').toLowerCase().includes(q))
  }
  return list
})

function minorMoney(minor: any, currency = '') {
  const n = Number(minor)
  if (!Number.isFinite(n)) return '—'
  const v = (n / 100).toFixed(2)
  return currency ? `${currency} ${v}` : v
}

function amountLabel(row: any) {
  const minor = row.final_amount_minor ?? row.quoted_amount_minor
  return minorMoney(minor, row.currency || 'PHP')
}

function feeLabel(row: any) {
  const n = Number(row.service_fee_minor)
  if (!Number.isFinite(n)) return '—'
  return `$${(n / 100).toFixed(2)}`
}

function fundingCardLabel(row: any) {
  const n = Number(row.funding_card_amount_minor)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return minorMoney(n, row.currency || 'PHP')
}

function cardLabel(row: any) {
  if (row.card_number) return row.card_number
  if (row.card_last_four) return `•••• ${row.card_last_four}`
  if (row.card_id) return `card#${row.card_id}`
  return '—'
}

function rowCardId(row: any): string | number | '' {
  if (!row) return ''
  const id = row.card_id ?? row.local_card_id ?? row.vm_card_id
  if (id == null || id === '') return ''
  return id
}

function fmtTime(v: any) {
  if (!v) return '—'
  try {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v)
    return d.toLocaleString()
  } catch {
    return String(v)
  }
}

function orderTagType(s: string) {
  if (s === 'completed') return 'success'
  if (s === 'declined' || s === 'failed_precharge' || s === 'cancelled') return 'danger'
  if (s === 'review' || s === 'pending') return 'warning'
  return 'info'
}

function cdkTagType(row: any) {
  const st = (row.cdk_status || '').toLowerCase()
  const life = row.cdk_lifecycle || ''
  if (st === 'consumed' || life.includes('消耗')) return 'info'
  if (st === 'unused' || life.includes('释放') || life.includes('未使用')) return 'success'
  if (st === 'reserved' || st === 'frozen') return 'warning'
  if (st === 'disabled') return 'danger'
  return ''
}

function resetFilters() {
  emailQ.value = ''
  if (statusFilter.value) {
    statusFilter.value = ''
    onFilterChange()
  }
}

function onFilterChange() {
  page.value = 1
  load()
}

function onPageChange(p: number) {
  page.value = p
  load()
}

function onSizeChange(s: number) {
  pageSize.value = s
  page.value = 1
  load()
}

function syncQuery() {
  const query: Record<string, string> = {}
  if (statusFilter.value) query.status = statusFilter.value
  if (page.value > 1) query.page = String(page.value)
  if (pageSize.value !== 20) query.size = String(pageSize.value)
  const cur = route.query
  const same = Object.keys(query).length === Object.keys(cur).length && Object.entries(query).every(([k, v]) => cur[k] === v)
  if (!same) router.replace({ query }).catch(() => {})
}
{
  const q = route.query
  if (typeof q.status === 'string' && statusOptions.includes(q.status)) statusFilter.value = q.status
  const pg = Number(q.page)
  if (Number.isInteger(pg) && pg > 1) page.value = pg
  const sz = Number(q.size)
  if ([20, 50, 100].includes(sz)) pageSize.value = sz
}

let loadAbort: AbortController | null = null
async function load() {
  // 新请求取消旧请求：快速翻页时慢响应不会后到覆盖
  loadAbort?.abort()
  const ac = new AbortController()
  loadAbort = ac
  loading.value = true
  error.value = ''
  syncQuery()
  try {
    const params = new URLSearchParams()
    params.set('page', String(page.value))
    params.set('page_size', String(pageSize.value))
    if (statusFilter.value) params.set('status', statusFilter.value)
    const r = await authFetch(`/api/v1/admin/cardplatform/cdk-orders?${params}`, { signal: ac.signal })
    const d = await r.json().catch(() => ({}))
    if (ac.signal.aborted) return
    if (!r.ok) {
      error.value = d.error || d.msg || '加载失败（检查卡台 Key / 出口 IP）'
      rows.value = []
      total.value = 0
      return
    }
    const list = Array.isArray(d.list) ? d.list : []
    rows.value = list
    let t = Number(d.total)
    if (!Number.isFinite(t) || t < 0) t = 0
    // total 缺失但本页满页时，至少允许往后翻
    if (t === 0 && list.length >= pageSize.value) {
      t = page.value * pageSize.value + 1
    } else if (t < list.length) {
      t = list.length
    }
    total.value = t
  } catch (e: any) {
    if (ac.signal.aborted || e?.name === 'AbortError') return
    error.value = e?.message || '网络错误'
  } finally {
    if (loadAbort === ac) {
      loadAbort = null
      loading.value = false
      loaded.value = true
    }
  }
}

async function openDetail(row: any) {
  detail.value = row
  detailOpen.value = true
  const id = row.order_id || row.id
  if (!id) return
  try {
    const r = await authFetch(`/api/v1/admin/cardplatform/cdk-orders/${id}`)
    if (r.ok) {
      const d = await r.json()
      detail.value = { ...row, ...d }
    }
  } catch {
    /* keep list row */
  }
}

async function deleteCard(row: any) {
  const id = rowCardId(row)
  if (!id) {
    dialog.toast('无 card_id，无法删卡', 'warn')
    return
  }
  const label = cardLabel(row)
  const ok = await dialog.confirm(
    `确认删除虚拟卡 ${label}（id=${id}）？\n卡内余额将退回卡台平台余额，此操作不可撤销。`,
    { title: '删除虚拟卡', okText: '确认删除', cancelText: '取消', danger: true },
  )
  if (!ok) return
  deletingId.value = String(id)
  try {
    const r = await authFetch(`/api/v1/admin/cardplatform/cards/${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      dialog.toast(d.error || d.msg || '删卡失败', 'err')
      return
    }
    dialog.toast(d.message || '删卡成功，余额已退回', 'ok')
    if (detail.value && String(rowCardId(detail.value)) === String(id)) {
      detail.value = { ...detail.value, card_deleted: true }
    }
    await load()
  } catch (e: any) {
    dialog.toast(e?.message || '网络错误', 'err')
  } finally {
    deletingId.value = ''
  }
}

onMounted(load)
</script>

<style scoped>
.mono {
  font-variant-numeric: tabular-nums;
  font-family: var(--font-mono);
}
.list-card { display: flex; flex-direction: column; gap: 12px; }
.list-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; min-height: 32px; }
.tbl-wrap { position: relative; }
.cell-sub { margin-top: 2px; font-size: 11.5px; line-height: 16px; color: var(--ink-3); }
.cell-ellipsis { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nowrap { white-space: nowrap; }
.danger-zone {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 16px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--err) 40%, var(--brd));
  border-radius: var(--radius-md);
}
</style>
