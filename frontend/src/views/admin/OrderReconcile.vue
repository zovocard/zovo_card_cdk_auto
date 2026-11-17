<template>
  <div class="pb-2 space-y-5">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 class="text-3xl font-bold text-ink">兑换对账</h1>
        <p class="text-sm text-muted mt-2">
          卡台 CDK 兑换订单：开通邮箱、用卡、开通时间、实付金额、CDK 消耗/释放状态
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <el-button :loading="loading" @click="load">刷新</el-button>
      </div>
    </div>

    <div class="card !py-3 flex flex-wrap items-center gap-3 text-sm">
      <span class="text-muted">共 <b class="mono text-ink">{{ total }}</b> 笔</span>
      <el-select
        v-model="statusFilter"
        clearable
        placeholder="订单状态"
        style="width: 150px"
        @change="onFilterChange"
      >
        <el-option v-for="s in statusOptions" :key="s" :label="s" :value="s" />
      </el-select>
      <el-input
        v-model="emailQ"
        clearable
        placeholder="邮箱关键字（本页）"
        style="width: 200px"
        @keyup.enter="onFilterChange"
        @clear="onFilterChange"
      />
      <el-button @click="onFilterChange">筛选</el-button>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div class="card overflow-hidden !p-0">
      <el-table :data="displayRows" v-loading="loading" size="small" stripe empty-text="暂无兑换订单">
        <el-table-column prop="order_id" label="订单" width="88">
          <template #default="{ row }">
            <span class="mono">#{{ row.order_id || row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column label="CDK" min-width="120">
          <template #default="{ row }">
            <div class="mono text-xs">{{ row.code_prefix || (row.cdk_id ? `id:${row.cdk_id}` : '—') }}</div>
            <el-tag size="small" :type="cdkTagType(row)" class="mt-1">{{ row.cdk_lifecycle || row.cdk_status || '—' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="plan" label="套餐" width="90" />
        <el-table-column label="用户邮箱" min-width="160">
          <template #default="{ row }">
            <span class="mono text-sm">{{ row.account_email || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="使用卡片" min-width="140">
          <template #default="{ row }">
            <span class="mono text-sm">{{ cardLabel(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="消耗金额" width="120">
          <template #default="{ row }">
            <div class="mono text-sm">{{ amountLabel(row) }}</div>
            <div class="text-xs text-subtle">费 {{ feeLabel(row) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="订单状态" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="orderTagType(row.status)">{{ row.status || '—' }}</el-tag>
            <div v-if="row.stage" class="text-xs text-subtle mt-1">{{ row.stage }}</div>
          </template>
        </el-table-column>
        <el-table-column label="开通时间" min-width="150">
          <template #default="{ row }">
            <div class="text-sm">{{ fmtTime(row.completed_at) }}</div>
            <div class="text-xs text-subtle">创建 {{ fmtTime(row.created_at) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="148" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
            <el-button
              v-if="rowCardId(row)"
              link
              type="danger"
              size="small"
              :loading="deletingId === String(rowCardId(row))"
              @click="deleteCard(row)"
            >
              删卡
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <span>
        第 {{ page }} / {{ totalPages }} 页 · 本页 {{ displayRows.length }} 条
      </span>
      <el-pagination
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        :page-sizes="[20, 50, 100]"
        :disabled="loading"
        @current-change="onPageChange"
        @size-change="onSizeChange"
      />
    </div>

    <el-drawer v-model="detailOpen" title="订单详情" size="420px">
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
        <div v-if="rowCardId(detail)" class="mt-4">
          <el-button
            type="danger"
            plain
            :loading="deletingId === String(rowCardId(detail))"
            @click="deleteCard(detail)"
          >
            删除虚拟卡（余额退回）
          </el-button>
          <p class="text-xs text-muted mt-2">
            调用卡台 <code>DELETE /cards/{id}</code>，永久销卡并将卡内余额退回平台余额。
          </p>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { authFetch } from '../../lib/api'
import { dialog } from '../../lib/dialog'

const rows = ref<any[]>([])
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

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams()
    params.set('page', String(page.value))
    params.set('page_size', String(pageSize.value))
    if (statusFilter.value) params.set('status', statusFilter.value)
    const r = await authFetch(`/api/v1/admin/cardplatform/cdk-orders?${params}`)
    const d = await r.json().catch(() => ({}))
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
    error.value = e?.message || '网络错误'
  } finally {
    loading.value = false
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
</style>
