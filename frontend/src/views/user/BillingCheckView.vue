<template>
  <!-- 东方意象七主题：订阅账单渲染进展示外壳的查询页（surface=billing，移植自 autocard，原作者授权开源使用）。
       状态与查询函数与下方经典版共用；结构沿用原项目订阅查询页类名以复用其样式。 -->
  <RedeemPresentation
    v-if="mythicPresentation"
    ref="presentation"
    surface="billing"
    :phase="billingPhase"
    :card="billingCard"
    :busy="loading"
  >
    <div class="billing-page">
      <div class="billing-shell">
        <form class="card space-y-4" role="search" @submit.prevent="query">
          <div class="billing-mode-switch query-tabs">
            <button type="button" class="billing-mode-btn" :aria-pressed="mode === 'cdk'" @click="mode = 'cdk'">{{ t('rp.billingCdkTab') }}</button>
            <button type="button" class="billing-mode-btn" :aria-pressed="mode === 'session'" @click="mode = 'session'">{{ t('rp.billingSessionTab') }}</button>
          </div>
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <label for="billing-query-input" class="block text-sm font-medium text-ink">{{ mode === 'cdk' ? t('m19.cdkMaterials') : t('m19.accountMaterials') }}</label>
            </div>
            <button type="button" class="ru-micro-btn" :disabled="loading" @click="pasteBilling">{{ t('m19.pasteBtn') }}</button>
          </div>
          <textarea
            v-if="mode === 'cdk'"
            id="billing-query-input"
            v-model="cdkCode"
            rows="3"
            :placeholder="t('m19.pasteHere')"
            autocomplete="off"
            spellcheck="false"
            :disabled="loading"
            class="work-input input billing-textarea font-mono"
            @keydown.enter.exact.prevent="query"
          ></textarea>
          <textarea
            v-else
            id="billing-query-input"
            v-model="tokenInput"
            rows="3"
            :placeholder="t('m19.pasteHere')"
            autocomplete="off"
            spellcheck="false"
            :disabled="loading"
            class="work-input input billing-textarea font-mono"
            @keydown.meta.enter.prevent="query"
            @keydown.ctrl.enter.prevent="query"
          ></textarea>
          <p class="text-xs text-muted">{{ mode === 'cdk' ? t('rp.billingCdkHint') : t('rp.billingSessionHint') }}</p>
          <p v-if="error" class="query-alert" role="status">{{ error }}</p>
          <div class="query-actions flex flex-wrap gap-3">
            <button type="submit" class="work-primary btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed" :disabled="loading || !canSubmit">
              <span v-if="loading" class="flex items-center justify-center gap-2"><span class="spinner"></span>{{ t('common.querying') }}</span>
              <span v-else>{{ t('m19.querySubscription') }}</span><span aria-hidden="true">→</span>
            </button>
            <button type="button" class="work-guide btn-secondary px-5" @click="clearBilling">{{ t('m19.clear') }}</button>
          </div>
          <div class="query-help"><button type="button" @click="presentation?.openGuide()">{{ t('m19.readGuide') }}</button></div>
        </form>

        <div v-if="summary" class="billing-result-region result-flow query-result mt-8" data-result-flow="" role="region" aria-live="polite">
          <span class="query-status" :data-tone="summary.has_active_subscription ? undefined : 'warn'">{{ billingCard.statusLabel }}</span>
          <h2>{{ billingPlanText }}</h2>
          <small>{{ t('m19.subscriptionUpdated') }} {{ billingObservedAt }} · {{ t('m19.subscriptionQueryLabel') }}</small>
          <dl class="query-facts rf-facts">
            <div><dt>{{ t('rp.billingPlan') }}</dt><dd>{{ billingPlanText }}</dd></div>
            <div><dt>{{ t('rp.billingActive') }}</dt><dd>{{ summary.has_active_subscription ? t('rp.yes') : t('rp.no') }}</dd></div>
            <div><dt>{{ t('rp.billingRenew') }}</dt><dd>{{ summary.will_renew == null ? '—' : (summary.will_renew ? t('rp.renewOn') : t('rp.renewOff')) }}</dd></div>
            <div><dt>{{ t('rp.billingCurrency') }}</dt><dd>{{ summary.billing_currency || '—' }} {{ summary.billing_period || '' }}</dd></div>
            <div><dt>{{ t('rp.billingUntil') }}</dt><dd>{{ summary.active_until || summary.expires_at || summary.renews_at || '—' }}</dd></div>
            <div v-if="authSource"><dt>{{ t('rp.billingSource') }}</dt><dd>{{ authSource === 'cdk' ? t('rp.sourceCdk') : t('rp.sourceSession') }}</dd></div>
          </dl>
          <details v-if="invoices" class="billing-query-details rf-more" :open="invoices.length > 0 && invoices.length <= 3">
            <summary>{{ t('m19.subscriptionResultDetails') }} · {{ t('rp.billingInvoices', { n: invoices.length }) }}</summary>
            <p v-if="!invoices.length" class="query-empty">{{ t('rp.billingNoInvoices') }}</p>
            <div v-for="inv in invoices" :key="inv.id || inv.number" class="billing-result-card">
              <div class="billing-card-header"><span class="mono">{{ formatAmount(inv.total, inv.currency) }}</span></div>
              <div>
                <p class="text-muted">{{ inv.paid ? t('rp.paid') : (inv.status || t('rp.unpaid')) }} · {{ formatTs(inv.created) }}</p>
                <p v-if="inv.description" class="text-subtle text-xs">{{ inv.description }}</p>
                <p class="flex gap-3">
                  <a v-if="inv.hosted_invoice_url" class="app-link" :href="inv.hosted_invoice_url" target="_blank" rel="noopener">{{ t('rp.invoiceLink') }}</a>
                  <a v-if="inv.invoice_pdf" class="app-link" :href="inv.invoice_pdf" target="_blank" rel="noopener">PDF</a>
                </p>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  </RedeemPresentation>
  <div v-else class="u-page">
    <UserPageHeader :eyebrow="t('hero.billingEyebrow')" :title="t('redeemTabs.billing')" :subtitle="t('hero.billingSub')" />
    <div class="u-main max-w-3xl space-y-6">
      <RedeemModeTabs class="!mb-0" />
      <div class="card space-y-4">
        <div class="flex gap-2">
          <button
            type="button"
            class="btn-secondary !py-1.5"
            :class="{ 'ring-2 ring-offset-1': mode === 'cdk' }"
            style="--tw-ring-color: var(--primary)"
            @click="mode = 'cdk'"
          >卡密查询</button>
          <button
            type="button"
            class="btn-secondary !py-1.5"
            :class="{ 'ring-2 ring-offset-1': mode === 'session' }"
            style="--tw-ring-color: var(--primary)"
            @click="mode = 'session'"
          >Session 查询</button>
        </div>

        <template v-if="mode === 'cdk'">
          <div class="rounded-xl bg-soft p-4 text-sm text-muted">
            输入兑换用的 CDK。系统使用兑换预检时保存的 session 去拉取账单（无需再贴 token）。
            若从未用 session 完成过兑换，请改用「Session 查询」。
          </div>
          <div class="form-group">
            <label>CDK 卡密</label>
            <input
              v-model="cdkCode"
              class="input mono"
              placeholder="SXC-XXXX-XXXX-XXXX-XXXX"
              @keyup.enter="query"
            />
          </div>
        </template>

        <template v-else>
          <div class="rounded-xl bg-soft p-4 text-sm text-muted">
            打开
            <a class="app-link underline" href="https://chatgpt.com/api/auth/session" target="_blank" rel="noopener">
              chatgpt.com/api/auth/session
            </a>
            ，复制<strong>完整 JSON</strong>（须含 sessionToken）。已禁用纯 Access Token。
          </div>
          <div class="form-group">
            <label>完整 Session JSON</label>
            <textarea
              v-model="tokenInput"
              class="input h-36 font-mono text-xs"
              placeholder='{"user":{...},"accessToken":"eyJ...","sessionToken":"eyJ..."}'
            />
          </div>
        </template>

        <div v-if="error" class="alert alert-error">{{ error }}</div>
        <button
          class="btn-primary w-full"
          :disabled="loading || !canSubmit"
          @click="query"
        >
          {{ loading ? '查询中…' : '查询订阅与账单' }}
        </button>
      </div>

      <div v-if="summary" class="card space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold text-ink">订阅摘要</h2>
          <el-tag v-if="authSource" size="small" type="info">{{ authSource === 'cdk' ? '来自卡密绑定' : '来自 session' }}</el-tag>
        </div>
        <div class="grid sm:grid-cols-2 gap-2 text-sm">
          <div class="flex justify-between gap-2 border-b bd py-2">
            <span class="text-muted">方案</span>
            <b class="text-ink">{{ planLabel }}</b>
          </div>
          <div class="flex justify-between gap-2 border-b bd py-2">
            <span class="text-muted">有效订阅</span>
            <b>{{ summary.has_active_subscription ? '是' : '否' }}</b>
          </div>
          <div class="flex justify-between gap-2 border-b bd py-2">
            <span class="text-muted">自动续费</span>
            <b>{{ summary.will_renew == null ? '—' : (summary.will_renew ? '开启' : '已关闭') }}</b>
          </div>
          <div class="flex justify-between gap-2 border-b bd py-2">
            <span class="text-muted">计费</span>
            <b class="mono">{{ summary.billing_currency || '—' }} {{ summary.billing_period || '' }}</b>
          </div>
          <div class="flex justify-between gap-2 border-b bd py-2 sm:col-span-2">
            <span class="text-muted">到期 / 续费</span>
            <b class="mono text-sm">{{ summary.active_until || summary.expires_at || summary.renews_at || '—' }}</b>
          </div>
        </div>
      </div>

      <div v-if="invoices" class="card space-y-3">
        <h2 class="text-xl font-semibold text-ink">付款账单（{{ invoices.length }}）</h2>
        <p v-if="!invoices.length" class="text-sm text-muted">无付款账单记录。</p>
        <div v-for="inv in invoices" :key="inv.id || inv.number" class="rounded-xl bg-soft p-4 text-sm space-y-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <b class="mono">{{ formatAmount(inv.total, inv.currency) }}</b>
            <span class="text-muted">{{ inv.paid ? '已付' : (inv.status || '未付') }} · {{ formatTs(inv.created) }}</span>
          </div>
          <div v-if="inv.description" class="text-subtle text-xs">{{ inv.description }}</div>
          <div class="flex gap-3">
            <a v-if="inv.hosted_invoice_url" class="app-link" :href="inv.hosted_invoice_url" target="_blank" rel="noopener">账单链接</a>
            <a v-if="inv.invoice_pdf" class="app-link" :href="inv.invoice_pdf" target="_blank" rel="noopener">PDF</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import UserPageHeader from '../../components/UserPageHeader.vue'
import RedeemModeTabs from '../../components/RedeemModeTabs.vue'
// 东方意象七主题的展示外壳（移植自 autocard，原作者授权开源使用，2026-11-17）
import RedeemPresentation from '../../redeem-presentation/components/RedeemPresentation.vue'
import { mythicPresentation, queryCard } from '../../redeem-presentation/adapter'
import { planFromSubscription } from '../../redeem-presentation/utils/redeemCard'
import type { RedeemPhase } from '../../redeem-presentation/utils/redeemPresentation'
const { t } = useI18n({ useScope: 'global' })


const route = useRoute()
const mode = ref<'cdk' | 'session'>('cdk')
const cdkCode = ref('')
const tokenInput = ref('')
const loading = ref(false)
const error = ref('')
const summary = ref<any>(null)
const invoices = ref<any[] | null>(null)
const authSource = ref('')

const canSubmit = computed(() =>
  mode.value === 'cdk' ? !!cdkCode.value.trim() : !!tokenInput.value.trim(),
)

const planLabel = computed(() => {
  const s = summary.value || {}
  const raw = (s.plan_type || s.subscription_plan || '').toString()
  if (!raw || raw === 'free') return '免费 / 未知'
  return raw.replace('chatgpt', 'ChatGPT ').replace(/_/g, ' ')
})

function formatAmount(total: any, currency: any) {
  const n = Number(total)
  if (!Number.isFinite(n)) return '—'
  const cur = (currency || 'usd').toString().toUpperCase()
  return `${(n / 100).toFixed(2)} ${cur}`
}
function formatTs(v: any) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return '—'
  try {
    return new Date(n * 1000).toLocaleString()
  } catch {
    return String(v)
  }
}

onMounted(() => {
  const qcdk = String(route.query.cdk || '').trim()
  if (qcdk) {
    cdkCode.value = qcdk
    mode.value = 'cdk'
    query()
  }
})

async function query() {
  error.value = ''
  summary.value = null
  invoices.value = null
  authSource.value = ''
  loading.value = true
  try {
    const body =
      mode.value === 'cdk'
        ? { cdk_code: cdkCode.value.trim() }
        : { token_input: tokenInput.value }
    const r = await fetch('/api/v1/public/billing/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      error.value = d.error || '查询失败'
      return
    }
    summary.value = d.summary || {}
    invoices.value = d.invoices || []
    authSource.value = d.auth_source || ''
  } catch (e: any) {
    error.value = e?.message || '网络错误'
  } finally {
    loading.value = false
  }
}

// ── 东方意象展示外壳的状态映射（只读本页现有状态，不改查询流程） ──
const presentation = ref<InstanceType<typeof RedeemPresentation> | null>(null)
const billingObservedAt = ref('—')
const rawPlan = computed(() => String(summary.value?.plan_type || summary.value?.subscription_plan || '').trim())
const hasPlan = computed(() => !!rawPlan.value && rawPlan.value.toLowerCase() !== 'free')
// 与原项目订阅查询页同义：查询中 = verifying；读到订阅 = identified；否则 idle。
const billingPhase = computed<RedeemPhase>(() => loading.value && !summary.value ? 'verifying' : summary.value && (summary.value.has_active_subscription || hasPlan.value) ? 'identified' : 'idle')
const billingCard = computed(() => {
  const s = summary.value
  const statusLabel = loading.value ? t('common.querying')
    : !s ? t('m19.subscriptionEmpty')
    : s.has_active_subscription ? t('m19.subscriptionActive')
    : hasPlan.value ? t('m19.subscriptionExpired')
    : t('rp.noSubscription')
  const key = hasPlan.value ? planFromSubscription(rawPlan.value.replace(/_/g, ' ')) || planFromSubscription(rawPlan.value) : ''
  return queryCard({ phase: billingPhase.value, plan: hasPlan.value ? rawPlan.value : '', presentationPlanKey: key || undefined, identified: billingPhase.value === 'identified', statusLabel })
})
// 与原项目订阅查询页 subscriptionPlanLabel 同义：认得出的套餐用卡面名称，认不出的回落本页原有文案。
const billingPlanText = computed(() => {
  const product = billingCard.value.productData
  return billingPhase.value === 'identified' && product.id !== 'unidentified' ? `${product.displayLabel} · ${product.cardCaption || product.officialLabel}` : planLabel.value
})
watch(summary, (s) => {
  if (s) billingObservedAt.value = new Date().toTimeString().slice(0, 8)
})
function clearBilling() {
  cdkCode.value = ''
  tokenInput.value = ''
  summary.value = null
  invoices.value = null
  authSource.value = ''
  error.value = ''
}
async function pasteBilling() {
  try {
    const text = (await navigator.clipboard.readText()).trim()
    if (!text) return
    if (mode.value === 'cdk') cdkCode.value = text
    else tokenInput.value = text
  } catch { /* 浏览器不允许读剪贴板时什么都不做，用户可手动粘贴 */ }
}
</script>
