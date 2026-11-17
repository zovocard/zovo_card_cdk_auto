<template>
  <div class="adm-page">
    <AdminPageHeader title="卡台接入" desc="填写卡台站点根地址与 Open API Key；Open API / 公开 CDK 路径自动拼接" @more="onMore">
      <el-button type="primary" :loading="busy" @click="runAllChecks">一键检测</el-button>
      <template #more>
        <el-dropdown-item command="ping">连通检测</el-dropdown-item>
        <el-dropdown-item command="plans">刷新价格</el-dropdown-item>
        <el-dropdown-item command="balance">刷新余额</el-dropdown-item>
        <el-dropdown-item divided command="egress">重新探测出口 IP</el-dropdown-item>
      </template>
    </AdminPageHeader>

    <!-- 出口 IP：卡台白名单要填这个 -->
    <div class="card egress-hero">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div class="text-xs text-muted">本机出口 IP · 填到卡台 API Key 白名单</div>
          <div class="mt-1 flex flex-wrap items-baseline gap-3 min-h-[40px]">
            <span v-if="egressIp" class="text-3xl font-bold mono text-ink">{{ egressIp }}</span>
            <span v-else class="sk" style="width: 220px; height: 30px" />
          </div>
          <p class="text-xs text-subtle mt-1">发码 / 拉价格 / 余额从此 IP 出网（不是浏览器 IP）</p>
        </div>
        <div class="flex gap-2">
          <el-button type="primary" plain :disabled="!egressIp" @click="copyText(egressIp)">复制 IP</el-button>
          <el-button :loading="loadingNet" @click="loadNetwork">重探测</el-button>
        </div>
      </div>
    </div>

    <!-- 状态摘要（详情进弹窗） -->
    <div class="grid gap-3 sm:grid-cols-3">
      <button type="button" class="status-card" @click="openStatusDialog">
        <div class="sc-label">连通状态</div>
        <div class="sc-value" :class="pingOk === true ? 'ok' : pingOk === false ? 'bad' : ''">
          {{ pingOk === true ? '正常' : pingOk === false ? '异常' : '未检测' }}
        </div>
        <div class="sc-hint">点击查看详情</div>
      </button>
      <button type="button" class="status-card" @click="openBalanceDialog">
        <div class="sc-label">可消费余额</div>
        <div class="sc-value mono">{{ spendableDisplay }}</div>
        <div class="sc-hint">含保证金信息</div>
      </button>
      <button type="button" class="status-card" @click="openPlansDialog">
        <div class="sc-label">服务费（实时）</div>
        <div class="sc-value mono">{{ feeSummary }}</div>
        <div class="sc-hint">v{{ plansVersion ?? '—' }} · 点击展开</div>
      </button>
    </div>

    <!-- 配置 -->
    <section class="card">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 class="adm-section-title">接入配置</h2>
        <el-tag v-if="hints.card_api_key_configured" type="success" size="small">Key 已存</el-tag>
        <el-tag v-else type="info" size="small">Key 未配置</el-tag>
      </div>
      <form class="set-group" autocomplete="off" @submit.prevent="save">
        <div class="set-row">
          <div>
            <div class="set-row__label">卡台 Base URL</div>
            <div class="set-row__desc">填站点根即可，末尾的 /openapi/v1 会自动去掉</div>
          </div>
          <div class="set-row__field">
            <div class="flex flex-wrap gap-2">
              <el-button size="small" :type="presetActive === 'prod' ? 'primary' : 'default'" :plain="presetActive === 'prod'" @click="applyPreset('prod')">
                生产 · zovocard.com
              </el-button>
              <el-button size="small" :type="presetActive === 'sandbox' ? 'primary' : 'default'" :plain="presetActive === 'sandbox'" @click="applyPreset('sandbox')">
                沙盒 · sandbox
              </el-button>
            </div>
            <el-input v-model="form.card_api_base" clearable @blur="normalizeBase" />
            <div class="path-chips">
              <div class="path-chip"><span class="k">Open API</span><code class="v">{{ resolvedOpenapi }}</code></div>
              <div class="path-chip"><span class="k">公开 CDK</span><code class="v">{{ resolvedCdk }}</code></div>
            </div>
          </div>
        </div>
        <div class="set-row">
          <div>
            <div class="set-row__label">Open API Key</div>
            <div class="set-row__desc">sk_ 开头。留空保存 = 不修改</div>
          </div>
          <div class="set-row__field">
            <el-input
              v-model="secrets.card_api_key"
              type="password"
              show-password
              clearable
              :placeholder="keyHint"
              autocomplete="off"
            />
          </div>
        </div>
        <div class="set-row">
          <div>
            <div class="set-row__label">代理换码密码</div>
            <div class="set-row__desc">代理凭此密码进入隐藏页，把<strong>失败且未扣款</strong>的 CDK 换一张新码。留空保存 = 不修改</div>
          </div>
          <div class="set-row__field">
            <el-input
              v-model="secrets.agent_swap_password"
              type="password"
              show-password
              clearable
              :placeholder="swapPwHint"
              autocomplete="off"
            />
            <div>
              <el-tag v-if="hints.agent_swap_password_configured" size="small" type="success">已设置</el-tag>
              <el-tag v-else size="small" type="info">未设置</el-tag>
            </div>
          </div>
        </div>
        <div class="set-row">
          <div>
            <div class="set-row__label">代理换码链接</div>
            <div class="set-row__desc">
              路径固定 <code class="mono">/partner/swap</code>（短链 <code class="mono">/a/swap</code>），导航栏不展示；把完整链接 + 密码发给代理即可
            </div>
          </div>
          <div class="set-row__field">
            <el-input :model-value="agentSwapUrl" readonly class="mono-input">
              <template #append>
                <el-button @click="copyText(agentSwapUrl)">复制</el-button>
              </template>
            </el-input>
            <div><el-button size="small" text type="primary" @click="openSwap">在新标签打开 ↗</el-button></div>
          </div>
        </div>
        <div class="set-actions">
          <el-button type="primary" native-type="submit" :loading="saving">保存</el-button>
        </div>
      </form>
    </section>

    <div class="flex flex-wrap gap-4 text-sm">
      <router-link class="adm-link" to="/ops/cdkeys">去发码 →</router-link>
      <router-link class="adm-link" to="/ops/webhooks">配置 Webhook →</router-link>
      <router-link class="adm-link" to="/ops/appearance">整站主题 →</router-link>
    </div>

    <!-- 连通详情弹窗 -->
    <el-dialog v-model="dlgStatus" title="连通检测" width="480px" align-center destroy-on-close>
      <el-result
        :icon="pingOk ? 'success' : 'error'"
        :title="pingOk ? '卡台可达' : '探测失败'"
        :sub-title="pingMsg || ''"
      />
      <div class="result-grid mt-2">
        <div v-for="(v, k) in pingTiles" :key="k" class="result-tile">
          <div class="k">{{ k }}</div>
          <div class="v mono">{{ v }}</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="dlgStatus = false">关闭</el-button>
        <el-button type="primary" :loading="pinging" @click="ping">重新探测</el-button>
      </template>
    </el-dialog>

    <!-- 余额弹窗 -->
    <el-dialog v-model="dlgBal" title="账户余额" width="420px" align-center destroy-on-close>
      <div class="result-grid">
        <div class="result-tile">
          <div class="k">可消费 spendable</div>
          <div class="v mono text-lg">{{ bal.spendable ?? '—' }}</div>
        </div>
        <div class="result-tile">
          <div class="k">总余额 balance</div>
          <div class="v mono text-lg">{{ bal.balance ?? '—' }}</div>
        </div>
        <div class="result-tile">
          <div class="k">风险保证金 reserve</div>
          <div class="v mono text-lg">{{ bal.reserve ?? '—' }}</div>
        </div>
      </div>
      <p class="text-xs text-muted mt-3">主动消费只能用 spendable（总余额含 20U 保证金）</p>
      <template #footer>
        <el-button @click="dlgBal = false">关闭</el-button>
        <el-button type="primary" :loading="loadingBal" @click="loadBalance">刷新</el-button>
      </template>
    </el-dialog>

    <!-- 价格弹窗 -->
    <el-dialog v-model="dlgPlans" title="实时服务费" width="520px" align-center destroy-on-close>
      <p class="text-sm text-muted mb-3">
        GET /openapi/v1/gpt-direct/plans · version {{ plansVersion ?? '—' }}
      </p>
      <div class="grid gap-3 sm:grid-cols-3">
        <div v-for="p in planCards" :key="p.key" class="result-tile text-center">
          <div class="k">{{ p.label }}</div>
          <div class="v mono text-2xl" style="color: var(--primary)">${{ p.fee }}</div>
          <div class="text-xs text-subtle mt-1">/ 张 · 可购</div>
          <!-- 点数按比索计价：服务费之外还要垫这笔上游付款 -->
          <div v-if="p.checkout" class="text-xs text-subtle">兑换垫付 {{ p.checkout }}</div>
          <div v-if="p.minor != null" class="text-xs text-subtle">minor {{ p.minor }}</div>
        </div>
      </div>
      <el-empty v-if="!planCards.length" description="卡台未开放任何可发码档位" :image-size="60" />
      <el-alert
        v-if="feeAllZero"
        class="mt-3"
        type="info"
        :closable="false"
        show-icon
        title="当前账户配置服务费为 $0（卡台 payment config）。若应为 1/5/10U，请在卡台管理端检查 GPT 直充价格版本。"
      />
      <template #footer>
        <el-button @click="dlgPlans = false">关闭</el-button>
        <el-button type="primary" :loading="loadingPlans" @click="loadPlans">刷新价格</el-button>
      </template>
    </el-dialog>

    <UnsavedBar :show="dirtyParts.length > 0" :saving="saving" :detail="dirtyParts.join('、')" @discard="discardEdits" @save="save" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { authFetch } from '../../lib/api'
import { dialog } from '../../lib/dialog'
import { copyToClipboard } from '../../lib/clipboard'
import AdminPageHeader from '../../components/admin/AdminPageHeader.vue'
import UnsavedBar from '../../components/admin/UnsavedBar.vue'

const PRESETS: Record<string, string> = {
  prod: 'https://zovocard.com',
  sandbox: 'https://sandbox.zovocard.com',
}

const form = reactive({ card_api_base: PRESETS.prod })
const secrets = reactive({ card_api_key: '', agent_swap_password: '' })
const hints = reactive<Record<string, any>>({})
const saving = ref(false)
const busy = ref(false)
const pinging = ref(false)
const loadingPlans = ref(false)
const loadingBal = ref(false)
const loadingNet = ref(false)

const egressIp = ref('')
const pingOk = ref<boolean | null>(null)
const pingMsg = ref('')
const pingTiles = ref<Record<string, string>>({})
const bal = reactive<{ spendable?: string; balance?: string; reserve?: string }>({})
const plansRaw = ref<Record<string, any>>({})
const plansVersion = ref<number | null>(null)

const dlgStatus = ref(false)
const dlgBal = ref(false)
const dlgPlans = ref(false)

const keyHint = computed(() =>
  hints.card_api_key_configured ? `已配置 ${hints.card_api_key_hint || ''}`.trim() : '粘贴 sk_…',
)
const swapPwHint = computed(() =>
  hints.agent_swap_password_configured ? '已设置（留空保存不修改）' : '设置代理换码密码（至少 6 位）',
)
const agentSwapUrl = computed(() => {
  if (typeof window === 'undefined') return '/partner/swap'
  return `${window.location.origin}/partner/swap`
})

const siteRoot = computed(() => {
  let b = (form.card_api_base || '').trim().replace(/\/+$/, '')
  b = b.replace(/\/openapi\/v1$/i, '').replace(/\/openapi$/i, '')
  return b || PRESETS.prod
})
const resolvedOpenapi = computed(() => siteRoot.value + '/openapi/v1')
const resolvedCdk = computed(() => siteRoot.value + '/api/v1/cdk')
const presetActive = computed(() => {
  const b = siteRoot.value.toLowerCase()
  if (b === PRESETS.prod) return 'prod'
  if (b === PRESETS.sandbox) return 'sandbox'
  return ''
})

// 档位清单来自服务端下发的 registry（已按「卡台注册表 ∩ ACC 定价开关」过滤）。
// 这里原来写死 go/plus/pro_5x/pro_20x，两头都不对：卡台新开的点数档看不到，
// 卡台/ACC 关掉的档还照样列。
const planRegistry = ref<any[]>([])
const planCards = computed(() =>
  planRegistry.value.map((p: any) => {
    const minor = p.serviceFeeUsdMinor ?? p.service_fee_usd_minor
    const fee =
      minor != null && minor !== ''
        ? (Number(minor) / 100).toFixed(2)
        : p.service_fee_usd != null
          ? Number(p.service_fee_usd).toFixed(2)
          : '—'
    // 点数按比索计价，服务费之外还要垫这笔付款
    const checkout = p.checkout_amount_minor
      ? `${p.checkout_currency || 'PHP'} ${(Number(p.checkout_amount_minor) / 100).toFixed(2)}`
      : ''
    return { key: p.key, label: p.label || p.key, fee, minor, checkout, enabled: true }
  }),
)
const feeSummary = computed(() =>
  planCards.value.map((p) => `$${p.fee}`).join(' / ') || '—',
)
const feeAllZero = computed(() => planCards.value.every((p) => Number(p.fee) === 0))
const spendableDisplay = computed(() => bal.spendable ?? '—')

function applyPreset(id: string) {
  form.card_api_base = PRESETS[id] || PRESETS.prod
}
function normalizeBase() {
  form.card_api_base = siteRoot.value
}
async function copyText(t: string) {
  const ok = await copyToClipboard(t)
  dialog.toast(ok ? '已复制' : '复制失败', ok ? 'ok' : 'err')
}
// 模板里不能直接用 window（原来的「打开」按钮因此点了没反应）
function openSwap() {
  window.open(agentSwapUrl.value, '_blank', 'noopener')
}
function onMore(cmd: string) {
  if (cmd === 'ping') return ping()
  if (cmd === 'plans') return loadPlans()
  if (cmd === 'balance') return loadBalance()
  if (cmd === 'egress') return loadNetwork()
}

// 未保存：Base 与服务端不同，或填了新 Key / 新密码
const savedBase = ref('')
const dirtyParts = computed(() => {
  const out: string[] = []
  if (savedBase.value && siteRoot.value !== savedBase.value) out.push('Base URL')
  if (secrets.card_api_key.trim()) out.push('API Key')
  if (secrets.agent_swap_password.trim()) out.push('代理换码密码')
  return out
})
function discardEdits() {
  if (savedBase.value) form.card_api_base = savedBase.value
  secrets.card_api_key = ''
  secrets.agent_swap_password = ''
}

async function loadNetwork() {
  loadingNet.value = true
  try {
    const r = await authFetch('/api/v1/admin/network/egress')
    const d = await r.json().catch(() => ({}))
    egressIp.value = d.egress_ip || ''
  } finally {
    loadingNet.value = false
  }
}

async function loadSettings() {
  const r = await authFetch('/api/v1/admin/settings')
  if (!r.ok) return
  const d = await r.json()
  form.card_api_base = d.card_api_base || PRESETS.prod
  Object.assign(hints, d)
  normalizeBase()
  savedBase.value = siteRoot.value
}

async function save() {
  saving.value = true
  try {
    normalizeBase()
    const body: Record<string, string> = { card_api_base: form.card_api_base.trim() }
    if (secrets.card_api_key.trim()) body.card_api_key = secrets.card_api_key.trim()
    if (secrets.agent_swap_password.trim()) body.agent_swap_password = secrets.agent_swap_password.trim()
    const r = await authFetch('/api/v1/admin/settings', { method: 'PUT', body: JSON.stringify(body) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      dialog.toast(d.error || '保存失败', 'err')
      return false
    }
    Object.assign(hints, d)
    secrets.card_api_key = ''
    secrets.agent_swap_password = ''
    savedBase.value = siteRoot.value
    dialog.toast('已保存', 'ok')
    return true
  } finally {
    saving.value = false
  }
}

async function ping() {
  pinging.value = true
  try {
    const r = await authFetch('/api/v1/admin/cardplatform/ping')
    const d = await r.json().catch(() => ({}))
    pingOk.value = !!r.ok && !!d.ok
    pingMsg.value = d.message || d.error || ''
    if (d.egress_ip) egressIp.value = d.egress_ip
    pingTiles.value = {
      site: d.site_base || siteRoot.value,
      openapi: d.openapi_base || resolvedOpenapi.value,
      cdk: d.public_cdk_base || resolvedCdk.value,
      probed: d.probed || '—',
      http: String(d.status ?? '—'),
      egress: d.egress_ip || egressIp.value || '—',
    }
    if (d.status === 403) dialog.toast('403：请将出口 IP 加入白名单', 'warn')
    else if (pingOk.value) dialog.toast('连通正常', 'ok')
    else dialog.toast(pingMsg.value || '探测失败', 'err')
  } finally {
    pinging.value = false
  }
}

async function loadPlans() {
  loadingPlans.value = true
  try {
    const r = await authFetch('/api/v1/admin/cardplatform/plans')
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      dialog.toast(d.error || d.msg || '价格拉取失败', 'err')
      return
    }
    plansRaw.value = d.plans || {}
    planRegistry.value = d.registry || []
    plansVersion.value = d.version ?? null
    dialog.toast('价格已更新', 'ok')
    dlgPlans.value = true
  } finally {
    loadingPlans.value = false
  }
}

async function loadBalance() {
  loadingBal.value = true
  try {
    const r = await authFetch('/api/v1/admin/cardplatform/balance')
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      dialog.toast(d.error || d.msg || '余额失败', 'err')
      return
    }
    bal.spendable = String(d.spendable_balance ?? '—')
    bal.balance = String(d.balance ?? '—')
    bal.reserve = String(d.account_reserve_amount ?? '—')
    dialog.toast('余额已刷新', 'ok')
    dlgBal.value = true
  } finally {
    loadingBal.value = false
  }
}

async function runAllChecks() {
  busy.value = true
  try {
    await save()
    await ping()
    await loadBalance()
    await loadPlans()
    dlgStatus.value = true
  } finally {
    busy.value = false
  }
}

function openStatusDialog() {
  dlgStatus.value = true
  if (pingOk.value === null) ping()
}
function openBalanceDialog() {
  dlgBal.value = true
  if (bal.spendable == null) loadBalance()
}
function openPlansDialog() {
  dlgPlans.value = true
  if (!Object.keys(plansRaw.value).length) loadPlans()
}

onMounted(async () => {
  await loadSettings()
  await loadNetwork()
})
</script>

<style scoped>
.egress-hero {
  background: linear-gradient(120deg, var(--primary-soft), transparent 55%), var(--surface-solid);
  border-color: var(--brd-2);
}
.set-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 16px; border-top: 1px solid var(--brd); }
.mono-input :deep(.el-input__inner) { font-family: var(--font-mono); font-size: 12.5px; }
.path-chips { display: flex; flex-direction: column; gap: 8px; }
.path-chip {
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: var(--radius-md);
  background: var(--surface-2); border: 1px solid var(--brd);
}
.path-chip .k {
  font-size: 11px; font-weight: 600; color: var(--ink-3);
  text-transform: uppercase; letter-spacing: .04em; min-width: 72px;
}
.path-chip .v { font-size: 12px; color: var(--ink); word-break: break-all; }

.status-card {
  text-align: left;
  padding: 16px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--brd);
  background: var(--surface);
  cursor: pointer;
  transition: .18s ease;
}
.status-card:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-sm);
  transform: translateY(-2px);
}
.sc-label { font-size: 12px; color: var(--ink-3); }
.sc-value { margin-top: 6px; font-size: 20px; font-weight: 700; color: var(--ink); min-height: 30px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sc-value.ok { color: var(--good); }
.sc-value.bad { color: var(--err); }
.sc-hint { margin-top: 6px; font-size: 11px; color: var(--ink-3); }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
</style>
