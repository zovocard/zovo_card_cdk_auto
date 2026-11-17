<template>
  <div class="adm-page">
    <AdminPageHeader title="选卡配置" desc="兑换时用哪张卡：开卡产品在线状态、自动选卡优先级、本站兑换策略与卡健康归因" @more="onMore">
      <el-button type="primary" :loading="syncing" @click="doSync">立即同步产品</el-button>
      <template #more>
        <el-dropdown-item command="health">刷新卡健康</el-dropdown-item>
        <el-dropdown-item command="reload">重新载入全部配置</el-dropdown-item>
      </template>
    </AdminPageHeader>

    <!-- 产品在线状态 -->
    <div class="card">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 class="adm-section-title">产品在线状态</h2>
          <p class="adm-section-desc">
            与卡台「可开卡产品」对齐 · 每 3 分钟同步 · 在线
            <strong>{{ onlineCount }}</strong> / 共 {{ products.length }}
            <span v-if="lastSync" class="ml-2 text-subtle">上次：{{ lastSync }}</span>
            <span v-if="nextSync && nextSync !== '—'" class="ml-1 text-subtle">· {{ nextSync }}后</span>
          </p>
          <p class="text-xs text-subtle mt-1">
            说明：此处是<strong>开卡产品</strong>（渠道/BIN），不是 CDK 套餐（Plus/Pro）。卡台下架的卡段会显示已下线；CDK 能否购买看套餐是否开启。
          </p>
        </div>
        <div class="flex gap-2 items-center">
          <el-switch v-model="showOffline" active-text="显示已下线" />
        </div>
      </div>

      <div v-if="!loaded" class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div v-for="i in 8" :key="i" class="prod-card"><span class="sk" style="width: 60%" /><span class="sk" style="width: 40%" /><span class="sk" style="width: 80%" /></div>
      </div>
      <div v-else-if="products.length === 0" class="empty-state">
        <div class="empty-state__title">暂无产品缓存</div>
        <div class="empty-state__desc">从卡台同步可开卡产品（需先在「卡台接入」配置 API Key）。</div>
        <el-button type="primary" :loading="syncing" @click="doSync">立即同步</el-button>
      </div>

      <div v-else class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div
          v-for="p in visibleProducts"
          :key="p.product_code"
          class="prod-card"
          :class="isProductOnline(p) ? 'prod-online' : 'prod-offline'"
        >
          <div class="flex items-start justify-between gap-1">
            <span class="prod-code mono">{{ p.product_code }}</span>
            <el-tag :type="isProductOnline(p) ? 'success' : 'danger'" size="small">
              {{ isProductOnline(p) ? '在线' : '已下线' }}
            </el-tag>
          </div>
          <div class="prod-issuer">{{ issuerLabel(p.issuer) }}</div>
          <div class="prod-bin mono">{{ binDisplay(p) }}</div>
          <div class="prod-area">{{ p.issuing_area }} · {{ p.scene }}</div>
          <div v-if="p.suspended_at" class="prod-suspend">已暂停</div>
        </div>
      </div>
    </div>

    <!-- 自动选卡优先级 -->
    <div class="card">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 class="adm-section-title">自动选卡优先级</h2>
          <p class="adm-section-desc">
            顺序越靠前优先级越高；已下线或禁用的自动跳过
            <el-tag type="warning" size="small" effect="plain" class="ml-2">仅美卡参与自动选卡</el-tag>
          </p>
        </div>
        <div class="flex gap-2">
          <el-button @click="showAddDialog = true">+ 添加产品</el-button>
          <el-button type="primary" :loading="saving" @click="saveRules">保存</el-button>
        </div>
      </div>

      <div v-if="loaded && rules.length === 0" class="empty-state">
        <div class="empty-state__title">暂无选卡规则</div>
        <div class="empty-state__desc">没有规则时由卡台默认级联选卡；添加产品后可调整先后顺序。</div>
        <el-button type="primary" @click="showAddDialog = true">+ 添加产品</el-button>
      </div>

      <div v-else class="rules-list">
        <div
          v-for="(rule, idx) in rules"
          :key="rule._id"
          class="rule-row"
          :class="{ 'rule-disabled': !rule.enabled }"
        >
          <!-- 优先级序号 -->
          <div class="rule-num">{{ idx + 1 }}</div>

          <!-- 状态 -->
          <div class="rule-badge">
            <el-tag
              v-if="productMap[rule.plan_key]"
              :type="isProductOnline(productMap[rule.plan_key]) ? 'success' : 'danger'"
              size="small" effect="plain"
            >{{ isProductOnline(productMap[rule.plan_key]) ? '在线' : '已下线' }}</el-tag>
            <el-tag v-else type="info" size="small" effect="plain">未同步</el-tag>
          </div>

          <!-- 产品信息（只读展示 + 渠道可编辑） -->
          <div class="rule-info">
            <div class="rule-name">
              <span class="issuer-tag" :data-issuer="productMap[rule.plan_key]?.issuer || ''">
                {{ productMap[rule.plan_key] ? issuerLabel(productMap[rule.plan_key].issuer) : rule.channel || '—' }}
              </span>
              <span class="rule-code mono">{{ rule.plan_key }}</span>
              <span v-if="productMap[rule.plan_key]" class="rule-scene text-muted">
                · {{ productMap[rule.plan_key].scene }}
              </span>
            </div>
            <div class="rule-bins mono text-subtle">
              {{ productMap[rule.plan_key] ? binDisplay(productMap[rule.plan_key]) : (rule.bin_prefix || '—') }}
            </div>
          </div>

          <!-- 启用（保存后生效，所以用勾选框而不是即时开关） -->
          <el-checkbox v-model="rule.enabled">启用</el-checkbox>

          <!-- 上下移 + 删除 -->
          <div class="rule-actions">
            <el-button size="small" circle :disabled="idx === 0" title="上移" aria-label="上移" @click="moveUp(idx)">↑</el-button>
            <el-button size="small" circle :disabled="idx === rules.length - 1" title="下移" aria-label="下移" @click="moveDown(idx)">↓</el-button>
            <el-button size="small" circle text type="danger" title="从列表移除（保存后生效）" aria-label="移除" @click="removeRule(idx)">×</el-button>
          </div>
        </div>
      </div>

      <div class="mt-3 text-xs text-subtle">
        ※ 仅美卡（渠道1/渠道3/渠道4）参与默认优先级；香港卡可手动添加，但默认排除。
      </div>
    </div>


    <!-- 本站可控策略 -->
    <div class="card">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 class="adm-section-title">本站可控策略</h2>
          <p class="adm-section-desc">
            选卡优先级保存后会同步到卡台所有者规则（<code class="mono text-xs">select_priority</code> + <code class="mono text-xs">strict_select</code>）。
            未启动的卡头自动跳过。兑换有规则即声明 <code class="mono text-xs">strict_card_preference</code>，不再被卡台 537872/星链级联盖过。
          </p>
          <p v-if="resolvedPref.segment_key" class="text-xs text-subtle mt-1">
            当前生效偏好：{{ resolvedPref.issuer || '—' }} / {{ resolvedPref.segment_key }}
          </p>
        </div>
        <div class="flex items-center gap-3">
          <el-checkbox v-model="policy.enabled" border>启用本站兑换策略</el-checkbox>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div class="text-xs text-muted mb-1">每卡新账号上限（展示）</div>
          <el-input-number v-model="policy.max_new_accounts_per_card" :min="1" :max="50" class="!w-full" />
        </div>
        <div>
          <div class="text-xs text-muted mb-1">单任务最多卡数（预留）</div>
          <el-input-number v-model="policy.max_cards_per_task" :min="1" :max="20" class="!w-full" />
        </div>
        <div>
          <div class="text-xs text-muted mb-1">失败冷却（小时，预留）</div>
          <el-input-number v-model="policy.fail_cooldown_hours" :min="0" :max="168" class="!w-full" />
        </div>
        <div>
          <div class="text-xs text-muted mb-1">限定发卡地区</div>
          <el-input v-model="policy.issuing_area" placeholder="United States" />
        </div>
        <div>
          <div class="text-xs text-muted mb-1">持卡人名</div>
          <el-input v-model="policy.holder_first" placeholder="GPT" />
        </div>
        <div>
          <div class="text-xs text-muted mb-1">持卡人姓</div>
          <el-input v-model="policy.holder_last" placeholder="Direct" />
        </div>
        <div class="sm:col-span-2">
          <div class="text-xs text-muted mb-1">指定产品码（留空=用下方选卡优先级第一条）</div>
          <el-input v-model="policy.product_code" placeholder="留空自动最低成本/优先级产品" clearable />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-4 mt-4">
        <el-checkbox v-model="autoSwitchUnpaid" :disabled="!policy.enabled">
          确认未扣款/失败后自动换卡（关闭=发 no_auto_card_switch）
        </el-checkbox>
        <el-checkbox v-model="policy.auto_open_when_no_card" :disabled="!policy.enabled">
          无合格卡时自动开卡
        </el-checkbox>
        <el-button type="primary" :loading="policySaving" @click="savePolicy">保存策略</el-button>
      </div>
      <p class="text-xs text-subtle mt-3">
        说明：一卡几付的硬上限由<strong>卡台账户容量</strong>执行；本站负责「用哪张产品偏好」与「是否允许卡台自动换卡」。
        保存选卡优先级后：1）同步到卡台所有者用卡规则（旧码兑换也走这份优先级）；2）新发码写入 preferred。未启动卡头不会被选中。
      </p>
    </div>

    <!-- 卡健康：同卡失败 × 邮箱归因 -->
    <div class="card">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 class="adm-section-title">卡健康（失败归因）</h2>
          <p class="adm-section-desc">
            本站观察充值失败：同一张卡失败达到阈值后——
            <strong>不同邮箱</strong>判为卡问题（拉黑并冻结，下次自动选卡跳过）；
            <strong>同一邮箱</strong>判为邮箱/号问题（不冻卡）。
          </p>
        </div>
        <div class="flex items-center gap-3">
          <el-checkbox v-model="healthPolicy.enabled" border>启用</el-checkbox>
          <el-button :loading="healthLoading" @click="loadHealth">刷新</el-button>
          <el-button type="primary" :loading="healthSaving" @click="saveHealthPolicy">保存</el-button>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <div>
          <div class="text-xs text-muted mb-1">失败次数阈值</div>
          <el-input-number v-model="healthPolicy.fail_threshold" :min="1" :max="10" class="!w-full" />
        </div>
        <div class="flex items-end pb-1">
          <el-checkbox v-model="healthPolicy.freeze_on_block">判定坏卡后自动冻结（卡台）</el-checkbox>
        </div>
        <div class="flex items-end pb-1">
          <el-checkbox v-model="healthPolicy.require_known_email">无邮箱时不拉黑（推荐）</el-checkbox>
        </div>
      </div>

      <div class="mb-4">
        <h3 class="text-sm font-semibold text-ink mb-2">已拉黑的卡</h3>
        <div v-if="!blocklist.length" class="text-sm text-muted py-2">暂无</div>
        <div v-else class="space-y-2">
          <div
            v-for="b in blocklist"
            :key="b.card_id"
            class="flex flex-wrap items-center justify-between gap-2 rounded-lg border bd px-3 py-2 text-sm"
          >
            <div>
              <span class="mono font-medium">#{{ b.card_id }}</span>
              <span v-if="b.card_last_four" class="mono text-muted ml-2">****{{ b.card_last_four }}</span>
              <el-tag size="small" class="ml-2" type="danger">{{ b.reason }}</el-tag>
              <span class="text-muted ml-2">失败 {{ b.fail_count }} · 邮箱 {{ b.distinct_emails }}</span>
              <span class="text-subtle ml-2">冻:{{ b.freeze_status || '—' }}</span>
            </div>
            <el-button size="small" :loading="unblockingId === b.card_id" @click="unblockCard(b.card_id)">解禁并解冻</el-button>
          </div>
        </div>
      </div>

      <div>
        <h3 class="text-sm font-semibold text-ink mb-2">最近失败观察</h3>
        <div v-if="!failEvents.length" class="text-sm text-muted py-2">暂无（需 Webhook 或用户轮询 result）</div>
        <div v-else class="tbl-scroll" style="max-height: 420px">
          <table class="adm-plain-table">
            <thead>
              <tr>
                <th style="width: 170px">时间</th>
                <th style="width: 130px">卡</th>
                <th style="width: 100px">订单</th>
                <th>邮箱</th>
                <th style="width: 110px">判定</th>
                <th style="width: 110px">状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in failEvents" :key="e.id">
                <td class="mono whitespace-nowrap text-xs">{{ e.created_at }}</td>
                <td class="mono text-xs">#{{ e.card_id }}{{ e.card_last_four ? ' ·' + e.card_last_four : '' }}</td>
                <td class="mono text-xs">{{ e.order_id || '—' }}</td>
                <td class="mono text-xs truncate" :title="e.account_email_norm">{{ e.account_email_norm }}</td>
                <td>
                  <span
                    class="badge"
                    :class="e.verdict === 'card_suspect' ? 'badge--danger' : e.verdict === 'email_suspect' ? 'badge--warning' : ''"
                  >{{ verdictLabel(e.verdict) }}</span>
                </td>
                <td class="text-xs">{{ e.order_status }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 添加产品弹窗 -->
    <el-dialog v-model="showAddDialog" title="添加产品到优先级" width="480px" align-center destroy-on-close>
      <div class="space-y-3">
        <p class="text-sm text-muted">选择要加入自动选卡的产品（已在列表中的不会重复添加）</p>
        <div
          v-for="p in addableProducts"
          :key="p.product_code"
          class="add-prod-row"
          :class="{ 'add-prod-offline': !isProductOnline(p) }"
          @click="isProductOnline(p) && addProductToRules(p)"
        >
          <div class="flex items-center gap-2 flex-1">
            <span class="issuer-tag" :data-issuer="p.issuer">{{ issuerLabel(p.issuer) }}</span>
            <span class="mono font-semibold">{{ p.product_code }}</span>
            <span class="text-sm text-muted">{{ p.scene }}</span>
          </div>
          <div class="text-xs text-subtle mono">{{ binDisplay(p) }}</div>
          <el-tag v-if="!isProductOnline(p)" type="danger" size="small">已下线</el-tag>
          <el-tag v-else-if="isInRules(p.product_code)" type="info" size="small">已添加</el-tag>
          <el-tag v-else type="success" size="small">+ 添加</el-tag>
        </div>
        <p v-if="addableProducts.length === 0" class="text-sm text-muted text-center py-4">
          暂无可添加的产品，请先点击「立即同步」
        </p>
      </div>
      <template #footer>
        <el-button @click="showAddDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <UnsavedBar :show="dirtyParts.length > 0" :saving="savingAll" :detail="dirtyParts.join('、')" @discard="discardAll" @save="saveAll" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { authFetch } from '../../lib/api'
import { dialog } from '../../lib/dialog'
import AdminPageHeader from '../../components/admin/AdminPageHeader.vue'
import UnsavedBar from '../../components/admin/UnsavedBar.vue'

interface CardProduct {
  product_code: string
  issuer: string
  bin: string
  network: string
  issuing_area: string
  scene: string
  card_group: string
  description: string
  bin_heads: string[]
  enabled: boolean
  suspended_at: string
  synced_at: string
}

interface RuleRow {
  _id: number
  id: number
  sort_order: number
  plan_key: string
  display_name: string
  bin_prefix: string
  channel: string
  enabled: boolean
}

let _idSeq = 0
const rules = ref<RuleRow[]>([])
const products = ref<CardProduct[]>([])
const lastSync = ref('')
const nextSync = ref('')
const saving = ref(false)
const syncing = ref(false)
const showAddDialog = ref(false)
const showOffline = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

// 本站兑换策略（此前漏定义导致整页白屏）
const policy = reactive({
  enabled: false,
  no_auto_card_switch: true,
  auto_open_when_no_card: true,
  max_new_accounts_per_card: 4,
  max_cards_per_task: 3,
  fail_cooldown_hours: 24,
  issuing_area: 'United States',
  holder_first: 'GPT',
  holder_last: 'Direct',
  product_code: '',
  issuer: '',
})
const autoSwitchUnpaid = ref(false)
const policySaving = ref(false)
const resolvedPref = reactive({
  issuer: '',
  segment_type: '',
  segment_key: '',
})
// 勾选「失败后自动换卡」→ 关闭 no_auto_card_switch
watch(autoSwitchUnpaid, (v) => {
  policy.no_auto_card_switch = !v
})

const ISSUER_MAP: Record<string, string> = {
  one: '渠道1', two: '渠道2', three: '渠道3', four: '渠道4', five: '渠道5',
}

function issuerLabel(issuer: string) {
  return ISSUER_MAP[issuer] || issuer || '—'
}

function isProductOnline(p: CardProduct) {
  return !!(p && p.enabled && !p.suspended_at)
}

const onlineCount = computed(() => products.value.filter(isProductOnline).length)
const visibleProducts = computed(() => {
  const list = products.value
  if (showOffline.value) return list
  return list.filter(isProductOnline)
})

function binDisplay(p: CardProduct) {
  // bin 字段是完整卡号前缀（可能8位，如 43612080）
  // bin_heads 是 6 位 BIN 列表（多卡段时用）
  // 规则：
  //  - 若 bin 比 bin_heads 中任何一个都长，说明 bin 是完整前缀，优先展示 bin
  //  - 若存在多个 bin_heads 且 bin 已包含在其中，展示所有 bin_heads
  //  - 否则 fallback 到 bin
  const bin = p.bin || ''
  const heads = (p.bin_heads || []).filter(Boolean)

  if (heads.length === 0) return bin || '—'

  // bin 比所有 bin_heads 都长（8位 bin vs 6位 heads）→ 优先用完整 bin 展示
  const maxHeadLen = Math.max(...heads.map(h => h.length))
  if (bin.length > maxHeadLen) {
    // 若同时有多个 bin_heads（多卡段产品），展示完整 bin + 其他 bin_heads
    if (heads.length > 1) {
      // 找到与 bin 对应的那个 head（前缀匹配）
      const others = heads.filter(h => !bin.startsWith(h))
      return others.length ? `${bin} / ${others.join(' / ')}` : bin
    }
    return bin
  }

  // bin_heads 已经够详细（含多卡段），直接展示
  return heads.join(' / ')
}

// product_code → product map
const productMap = computed(() => {
  const m: Record<string, CardProduct> = {}
  for (const p of products.value) m[p.product_code] = p
  return m
})

// 产品列表（全量，用于弹窗选择）
const addableProducts = computed(() => products.value)

function isInRules(code: string) {
  return rules.value.some(r => r.plan_key === code)
}

function addProductToRules(p: CardProduct) {
  if (isInRules(p.product_code)) {
    dialog.toast('该产品已在列表中', 'warn')
    return
  }
  rules.value.push({
    _id: ++_idSeq,
    id: 0,
    sort_order: rules.value.length + 1,
    plan_key: p.product_code,
    display_name: `${issuerLabel(p.issuer)} · ${p.product_code} · ${p.scene}`,
    bin_prefix: p.bin_heads?.[0] || p.bin || '',
    channel: p.issuer,
    enabled: true,
  })
  dialog.toast(`已添加 ${p.product_code}`, 'ok')
}

async function loadRules() {
  const r = await authFetch('/api/v1/admin/card-selection/rules')
  if (!r.ok) return
  const d = await r.json().catch(() => ({}))
  lastSync.value = d.last_sync || ''
  nextSync.value = d.next_sync || ''
  rules.value = (d.rules || []).map((item: any) => ({
    ...item,
    _id: ++_idSeq,
    enabled: item.enabled !== false,
  }))
  snap.rules = rulesKey()
}

async function loadPlanStatus() {
  const r = await authFetch('/api/v1/admin/card-selection/plan-status')
  if (!r.ok) return
  const d = await r.json().catch(() => ({}))
  products.value = d.products || []
  lastSync.value = d.last_sync || lastSync.value
  nextSync.value = d.next_sync || nextSync.value
}

async function doSync() {
  syncing.value = true
  try {
    const r = await authFetch('/api/v1/admin/card-selection/sync', { method: 'POST' })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { dialog.toast(d.error || '同步失败', 'err'); return }
    products.value = d.products || []
    lastSync.value = d.last_sync || ''
    nextSync.value = d.next_sync || ''
    dialog.toast(`同步完成，共 ${products.value.length} 个产品`, 'ok')
  } finally {
    syncing.value = false
  }
}

async function saveRules() {
  saving.value = true
  try {
    const payload = rules.value.map((r, i) => ({
      id: r.id || 0,
      sort_order: i + 1,
      plan_key: r.plan_key.trim(),
      display_name: r.display_name.trim() || r.plan_key.trim(),
      bin_prefix: r.bin_prefix?.trim() || '',
      channel: r.channel?.trim() || '',
      enabled: r.enabled,
    }))
    const r = await authFetch('/api/v1/admin/card-selection/rules', {
      method: 'PUT',
      body: JSON.stringify({ rules: payload }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { dialog.toast(d.error || '保存失败', 'err'); return }
    rules.value = (d.rules || []).map((item: any) => ({
      ...item, _id: ++_idSeq, enabled: item.enabled !== false,
    }))
    snap.rules = rulesKey()
    if (d.cardplatform_ok === false) {
      dialog.toast('已保存本站规则，但同步卡台失败：' + (d.cardplatform_err || 'unknown'), 'warn')
    } else {
      dialog.toast('已保存并同步到卡台', 'ok')
    }
  } finally {
    saving.value = false
  }
}

function moveUp(idx: number) {
  if (idx === 0) return
  const a = rules.value
  ;[a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]
}
function moveDown(idx: number) {
  const a = rules.value
  if (idx >= a.length - 1) return
  ;[a[idx], a[idx + 1]] = [a[idx + 1], a[idx]]
}
function removeRule(idx: number) {
  rules.value.splice(idx, 1)
}


async function loadPolicy() {
  try {
    const r = await authFetch('/api/v1/admin/card-selection/site-policy')
    if (!r.ok) return
    const d = await r.json().catch(() => ({}))
    const p = d.policy || {}
    Object.assign(policy, {
      enabled: !!p.enabled,
      no_auto_card_switch: p.no_auto_card_switch !== false,
      auto_open_when_no_card: p.auto_open_when_no_card !== false,
      max_new_accounts_per_card: Number(p.max_new_accounts_per_card) || 4,
      max_cards_per_task: Number(p.max_cards_per_task) || 3,
      fail_cooldown_hours: Number(p.fail_cooldown_hours) || 24,
      issuing_area: p.issuing_area || 'United States',
      holder_first: p.holder_first || 'GPT',
      holder_last: p.holder_last || 'Direct',
      product_code: p.product_code || '',
      issuer: p.issuer || '',
    })
    autoSwitchUnpaid.value = !policy.no_auto_card_switch
    const rp = d.resolved_pref || {}
    resolvedPref.issuer = rp.issuer || ''
    resolvedPref.segment_type = rp.segment_type || ''
    resolvedPref.segment_key = rp.segment_key || ''
    snap.policy = policyKey()
  } catch { /* ignore */ }
}

async function savePolicy() {
  policySaving.value = true
  try {
    const r = await authFetch('/api/v1/admin/card-selection/site-policy', {
      method: 'PUT',
      body: JSON.stringify({ ...policy }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      dialog.toast(d.error || '保存策略失败', 'err')
      return
    }
    const p = d.policy || {}
    Object.assign(policy, p)
    snap.policy = policyKey()
    const rp = d.resolved_pref || {}
    resolvedPref.issuer = rp.issuer || ''
    resolvedPref.segment_type = rp.segment_type || ''
    resolvedPref.segment_key = rp.segment_key || ''
    if (d.cardplatform_ok === false) {
      dialog.toast('策略已保存，但同步卡台失败：' + (d.cardplatform_err || 'unknown'), 'warn')
    } else {
      dialog.toast('策略已保存并同步到卡台', 'ok')
    }
  } finally {
    policySaving.value = false
  }
}

// ---- 卡健康 ----
const healthPolicy = reactive({
  enabled: true,
  fail_threshold: 2,
  freeze_on_block: true,
  require_known_email: true,
})
const healthSaving = ref(false)
const healthLoading = ref(false)
const blocklist = ref<any[]>([])
const failEvents = ref<any[]>([])

function verdictLabel(v: string) {
  const m: Record<string, string> = {
    card_suspect: '卡问题',
    email_suspect: '邮箱/号问题',
    need_more: '次数不足',
    unknown_emails: '缺邮箱',
    already_blocked: '已拉黑',
  }
  return m[v] || v || '—'
}

async function loadHealth() {
  healthLoading.value = true
  try {
    const r = await authFetch('/api/v1/admin/card-health')
    if (!r.ok) return
    const d = await r.json().catch(() => ({}))
    const p = d.policy || {}
    Object.assign(healthPolicy, {
      enabled: p.enabled !== false,
      fail_threshold: Number(p.fail_threshold) || 2,
      freeze_on_block: p.freeze_on_block !== false,
      require_known_email: p.require_known_email !== false,
    })
    snap.health = healthKey()
    blocklist.value = Array.isArray(d.blocklist) ? d.blocklist.filter((b: any) => b.active !== false) : []
    failEvents.value = Array.isArray(d.events) ? d.events : []
  } finally {
    healthLoading.value = false
  }
}

async function saveHealthPolicy() {
  healthSaving.value = true
  try {
    const r = await authFetch('/api/v1/admin/card-health/policy', {
      method: 'PUT',
      body: JSON.stringify({ ...healthPolicy }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      dialog.toast(d.error || '保存失败', 'err')
      return
    }
    if (d.policy) Object.assign(healthPolicy, d.policy)
    snap.health = healthKey()
    dialog.toast('卡健康策略已保存', 'ok')
  } finally {
    healthSaving.value = false
  }
}

const unblockingId = ref<number | null>(null)
async function unblockCard(cardId: number) {
  if (unblockingId.value != null) return // 防连点重复提交
  unblockingId.value = cardId
  try {
    const r = await authFetch('/api/v1/admin/card-health/unblock', {
      method: 'POST',
      body: JSON.stringify({ card_id: cardId, unfreeze: true }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      dialog.toast(d.error || '解禁失败', 'err')
      return
    }
    dialog.toast('已解禁' + (d.unfreeze ? `（${d.unfreeze}）` : ''), 'ok')
    await loadHealth()
  } finally {
    unblockingId.value = null
  }
}

// ── 未保存更改：三块配置各自和最近一次载入/保存的快照比 ──
const snap = reactive({ rules: '', policy: '', health: '' })
function rulesKey() { return JSON.stringify(rules.value.map((r) => [r.plan_key, !!r.enabled])) }
function policyKey() { return JSON.stringify(policy) }
function healthKey() { return JSON.stringify(healthPolicy) }
const dirtyParts = computed(() => {
  if (!loaded.value) return []
  const out: string[] = []
  if (rulesKey() !== snap.rules) out.push('选卡优先级')
  if (policyKey() !== snap.policy) out.push('本站策略')
  if (healthKey() !== snap.health) out.push('卡健康策略')
  return out
})
const savingAll = computed(() => saving.value || policySaving.value || healthSaving.value)
async function saveAll() {
  const parts = dirtyParts.value
  if (parts.includes('选卡优先级')) await saveRules()
  if (parts.includes('本站策略')) await savePolicy()
  if (parts.includes('卡健康策略')) await saveHealthPolicy()
}
async function discardAll() {
  const parts = dirtyParts.value
  await Promise.all([
    parts.includes('选卡优先级') ? loadRules() : null,
    parts.includes('本站策略') ? loadPolicy() : null,
    parts.includes('卡健康策略') ? loadHealth() : null,
  ])
}
function onMore(cmd: string) {
  if (cmd === 'health') return loadHealth()
  if (cmd === 'reload') return Promise.all([loadRules(), loadPlanStatus(), loadPolicy(), loadHealth()])
}

const loaded = ref(false)
onMounted(async () => {
  await Promise.all([loadRules(), loadPlanStatus(), loadPolicy(), loadHealth()])
  // 某块没载入成功时，以当前（默认）值为基准，免得一进页面就提示「未保存」
  if (!snap.rules) snap.rules = rulesKey()
  if (!snap.policy) snap.policy = policyKey()
  if (!snap.health) snap.health = healthKey()
  loaded.value = true
  pollTimer = setInterval(loadPlanStatus, 3 * 60 * 1000)
})
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })
</script>

<style scoped>
/* ── 产品状态卡片 ── */
.prod-card {
  padding: 11px 13px;
  border-radius: var(--radius-md);
  border: 1px solid var(--brd);
  background: var(--surface-2);
  display: flex; flex-direction: column; gap: 3px;
}
.prod-online  { border-left: 3px solid var(--good); }
.prod-offline { border-left: 3px solid var(--err); opacity: .6; }
.prod-code   { font-size: 14px; font-weight: 700; color: var(--ink); }
.prod-issuer { font-size: 11px; font-weight: 600; color: var(--primary); }
.prod-bin    { font-size: 12px; color: var(--ink-2); }
.prod-area   { font-size: 11px; color: var(--ink-3); }
.prod-suspend{ font-size: 11px; color: var(--err); }
.mono { font-family: var(--font-mono); }

/* ── 渠道标签 ── */
.issuer-tag {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: var(--primary-soft);
  color: var(--primary);
  white-space: nowrap;
}
/* 渠道徽标用语义色的柔底：原来写死浅色底，暗色皮肤下是一块块亮斑 */
[data-issuer="one"]   { background: var(--info-soft); color: var(--info); }
[data-issuer="three"] { background: var(--good-soft); color: var(--good); }
[data-issuer="four"]  { background: var(--warn-soft); color: var(--warn); }

/* ── 规则列表 ── */
.rules-list { display: flex; flex-direction: column; gap: 6px; }

.rule-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--brd);
  background: var(--surface);
  transition: .15s ease;
}
.rule-row:hover { border-color: var(--primary); box-shadow: var(--shadow-sm); }
.rule-disabled  { opacity: .45; }

.rule-num {
  min-width: 24px; text-align: center;
  font-size: 14px; font-weight: 800; color: var(--primary); flex-shrink: 0;
}
.rule-badge { min-width: 56px; flex-shrink: 0; }

.rule-info { flex: 1; min-width: 0; }
.rule-name {
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
  font-size: 14px;
}
.rule-code  { font-weight: 700; color: var(--ink); }
.rule-scene { font-size: 12px; }
.rule-bins  { font-size: 11px; margin-top: 3px; }

.rule-actions { display: flex; gap: 4px; flex-shrink: 0; }

/* ── 添加产品弹窗行 ── */
.add-prod-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: var(--radius-md);
  border: 1px solid var(--brd); background: var(--surface-2);
  cursor: pointer; transition: .15s;
}
.add-prod-row:hover { border-color: var(--primary); background: var(--primary-soft); }
.add-prod-offline   { opacity: .5; cursor: not-allowed; }

@media (max-width: 640px) {
  .rule-row { flex-wrap: wrap; }
  .rule-info { width: 100%; }
}
</style>
