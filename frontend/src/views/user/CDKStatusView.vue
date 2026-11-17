<template>
  <!-- 东方意象七主题：售后查询渲染进展示外壳的查询页（surface=history，移植自 autocard，原作者授权开源使用）。
       状态与函数与下方经典版共用；结构沿用原项目查询页类名（query-tabs / query-result / query-facts）以复用其样式。 -->
  <RedeemPresentation
    v-if="mythicPresentation"
    ref="presentation"
    surface="history"
    :mode="mode"
    :phase="historyPhase"
    :card="historyCard"
    :busy="querying"
  >
    <div class="history-page">
      <main aria-labelledby="history-query-title">
        <section class="card space-y-5" role="search" aria-labelledby="history-query-title">
          <h2 id="history-query-title" class="query-form-title text-xl font-bold text-ink">{{ t('cdkLookup.queryTitle') }}</h2>
          <div class="query-tabs flex gap-2">
            <button type="button" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors" :aria-pressed="mode === 'single'" @click="setMode('single')">{{ t('m19.singleQuery') }}</button>
            <button type="button" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors" :aria-pressed="mode === 'batch'" @click="setMode('batch')">{{ t('cdkLookup.modeBatch') }}</button>
          </div>

          <template v-if="mode === 'single'">
            <div class="form-group ru-has-tools">
              <label for="history-cdk-code">{{ t('m19.cdkMaterials') }}</label>
              <div class="ru-micro-actions">
                <button type="button" class="ru-micro-btn" :disabled="querying" @click="pasteInto('single')">{{ t('m19.pasteBtn') }}</button>
              </div>
              <p id="history-query-hint" class="sr-only">{{ t('cdkLookup.queryHint') }}</p>
              <textarea
                id="history-cdk-code"
                v-model="cdkCode"
                aria-describedby="history-query-hint"
                rows="3"
                autocomplete="off"
                spellcheck="false"
                :placeholder="t('m19.pasteHere')"
                class="work-input input mono"
                @keydown.enter.exact.prevent="query"
              ></textarea>
            </div>
            <div class="query-actions">
              <button type="button" class="work-primary btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed" :disabled="!cdkCode.trim() || querying" @click="query">
                <span v-if="!querying">{{ t('m19.queryOriginal') }}</span>
                <span v-else class="flex items-center justify-center gap-2"><span class="spinner"></span>{{ t('common.querying') }}</span>
                <span v-if="!querying" aria-hidden="true">→</span>
              </button>
              <button type="button" class="work-guide" @click="clearQueries">{{ t('m19.clear') }}</button>
            </div>
          </template>

          <template v-else>
            <div class="form-group ru-has-tools">
              <label for="history-batch-cdk-codes">{{ t('m19.batchMaterials') }}</label>
              <div class="ru-micro-actions">
                <button type="button" class="ru-micro-btn" :disabled="querying" @click="pasteInto('batch')">{{ t('m19.pasteBtn') }}</button>
              </div>
              <p id="history-batch-hint" class="sr-only">{{ t('cdkLookup.batchHint', { max: LOOKUP_BATCH_MAX }) }}</p>
              <textarea
                id="history-batch-cdk-codes"
                v-model="batchText"
                aria-describedby="history-batch-hint"
                rows="5"
                autocomplete="off"
                spellcheck="false"
                :placeholder="t('cdkLookup.batchPlaceholder')"
                class="work-input input mono"
                style="resize: vertical"
                @keydown.meta.enter.prevent="queryBatch"
                @keydown.ctrl.enter.prevent="queryBatch"
              ></textarea>
              <div v-if="parsedCodes.length > 0" class="ru-batch-bar" :data-over="parsedCodes.length > LOOKUP_BATCH_MAX ? 'true' : undefined">
                <span>{{ t('rp.historyBatchCount', { n: parsedCodes.length, max: LOOKUP_BATCH_MAX }) }}<template v-if="parsedCodes.length > LOOKUP_BATCH_MAX"> · {{ t('cdkLookup.batchTruncated', { max: LOOKUP_BATCH_MAX }) }}</template></span>
                <span class="opacity-75">{{ t('m19.shortcutSubmitHint') }}</span>
              </div>
            </div>
            <div class="query-actions">
              <button type="button" class="work-primary btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed" :disabled="parsedCodes.length === 0 || querying" @click="queryBatch">
                <span v-if="!querying">{{ t('m19.queryOriginal') }}</span>
                <span v-else class="flex items-center justify-center gap-2"><span class="spinner"></span>{{ t('common.querying') }}</span>
                <span v-if="!querying" aria-hidden="true">→</span>
              </button>
              <button type="button" class="work-guide" @click="clearQueries">{{ t('m19.clear') }}</button>
            </div>
          </template>
          <p v-if="error" class="query-alert" role="status">{{ error }}</p>
          <div class="query-help"><button type="button" @click="presentation?.openGuide()">{{ t('m19.readGuide') }}</button></div>
        </section>

        <div v-if="mode === 'single' && result" class="query-result result-flow mt-8 card" data-result-flow="" role="status" aria-live="polite">
          <h2 class="text-xl font-bold text-ink mb-6">{{ t('cdkLookup.resultTitle') }}</h2>
          <div class="space-y-6">
            <div class="history-task-summary rf-summary border-b bd pb-4 space-y-1">
              <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <p class="text-sm font-medium text-ink">{{ statusText(result.status) }}</p>
                <p v-if="result.used_at" class="text-xs text-muted">{{ t('cdkLookup.usedAt') }}<span class="ml-1 font-mono text-ink">{{ result.used_at }}</span></p>
              </div>
            </div>
            <dl class="history-task-details query-facts rf-facts grid min-w-0 grid-cols-2 gap-x-4 gap-y-4 rounded-xl bg-soft p-4 text-sm sm:p-6">
              <div class="min-w-0">
                <dt class="text-xs text-muted">{{ t('cdkLookup.useStatus') }}</dt>
                <dd class="mt-1" :style="{ color: statusColor(result.status) }">{{ statusText(result.status) }}</dd>
              </div>
              <div class="min-w-0">
                <dt class="text-xs text-muted">{{ t('cdkLookup.plan') }}</dt>
                <dd class="mt-1 break-words text-ink">{{ result.plan ? planLabel(result.plan) : t('cdkLookup.emailEmpty') }}</dd>
              </div>
              <div class="col-span-2 min-w-0 sm:col-span-1">
                <dt class="text-xs text-muted">{{ t('cdkLookup.cdkCode') }}</dt>
                <dd class="mt-1 break-all font-mono text-ink">{{ result.cdk_code }}</dd>
              </div>
              <div class="col-span-2 min-w-0 sm:col-span-1">
                <dt class="text-xs text-muted">{{ t('cdkLookup.rechargeEmail') }}</dt>
                <dd class="mt-1 break-all font-mono text-ink">{{ result.account_email || t('cdkLookup.emailEmpty') }}</dd>
              </div>
              <div v-if="result.used_at" class="min-w-0">
                <dt class="text-xs text-muted">{{ t('cdkLookup.usedAt') }}</dt>
                <dd class="mt-1 break-words text-muted">{{ result.used_at }}</dd>
              </div>
            </dl>
            <div class="alert rf-note space-y-1" :class="`alert-${resultNote.tone}`" data-testid="task-feedback">
              <p class="text-ink">{{ resultNote.text }}</p>
            </div>
          </div>
          <div class="rf-actions flex gap-3 mt-6">
            <button type="button" class="btn-secondary flex-1" @click="reset">{{ t('cdkLookup.queryOther') }}</button>
            <button v-if="result.can_resubmit || result.status === 'unused'" type="button" class="work-primary btn-primary flex-1 text-center" @click="goRedeem(result.cdk_code)">{{ result.can_resubmit ? t('cdkLookup.resubmit') : t('cdkLookup.goRedeem') }}</button>
          </div>
        </div>

        <div v-if="mode === 'batch' && batchResults.length" class="query-result result-flow mt-8 card space-y-4" data-result-flow="">
          <div class="rf-summary">
            <h2>{{ t('cdkLookup.resultTitle') }}</h2>
          </div>
          <dl class="query-facts rf-facts">
            <div><dt>{{ t('cdkLookup.status.used') }}</dt><dd>{{ batchSummary.used }}</dd></div>
            <div><dt>{{ t('cdkLookup.status.failed') }}</dt><dd>{{ batchSummary.failed }}</dd></div>
            <div><dt>{{ t('cdkLookup.status.unused') }}</dt><dd>{{ batchSummary.unused }}</dd></div>
            <div><dt>{{ t('cdkLookup.status.processing') }}</dt><dd>{{ batchSummary.processing }}</dd></div>
          </dl>
          <div class="ru-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{{ t('cdkLookup.cdkCode') }}</th>
                  <th>{{ t('cdkLookup.useStatus') }}</th>
                  <th>{{ t('cdkLookup.rechargeEmail') }}</th>
                  <th>{{ t('cdkLookup.plan') }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in batchResults" :key="row.cdk_code + i">
                  <td>{{ i + 1 }}</td>
                  <td class="font-mono break-all">{{ row.cdk_code }}</td>
                  <td :style="{ color: statusColor(row.status) }">{{ statusText(row.status) }}</td>
                  <td class="font-mono break-all">{{ row.account_email || t('cdkLookup.emailEmpty') }}</td>
                  <td>{{ row.plan ? planLabel(row.plan) : t('cdkLookup.emailEmpty') }}</td>
                  <td>
                    <button v-if="row.can_resubmit || row.status === 'unused'" type="button" class="ru-micro-btn" @click="goRedeem(row.cdk_code)">{{ row.can_resubmit ? t('cdkLookup.resubmit') : t('cdkLookup.goRedeem') }}</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="rf-actions flex gap-3">
            <button type="button" class="btn-secondary flex-1" @click="copyUsedEmails">{{ t('cdkLookup.copyEmails') }}</button>
            <button type="button" class="btn-secondary flex-1" @click="exportCsv">{{ t('cdkLookup.exportCsv') }}</button>
          </div>
        </div>
      </main>
    </div>
  </RedeemPresentation>
  <div v-else class="u-page">
    <UserPageHeader :eyebrow="t('hero.lookupEyebrow')" :title="t('cdkLookup.title')" :subtitle="t('cdkLookup.subtitle')" />
    <div class="u-main max-w-5xl">

      <RedeemModeTabs />

      <div class="card animate-slideInUp space-y-5">
        <div class="flex gap-2">
          <button
            type="button"
            class="btn-secondary !py-1.5 flex-1"
            :class="{ 'ring-2': mode === 'single' }"
            @click="setMode('single')"
          >
            {{ t('cdkLookup.modeSingle') }}
          </button>
          <button
            type="button"
            class="btn-secondary !py-1.5 flex-1"
            :class="{ 'ring-2': mode === 'batch' }"
            @click="setMode('batch')"
          >
            {{ t('cdkLookup.modeBatch') }}
          </button>
        </div>

        <template v-if="mode === 'single'">
          <h2 class="text-xl font-bold text-ink">{{ t('cdkLookup.queryTitle') }}</h2>
          <div class="rounded-xl bg-soft p-4 text-sm text-muted">
            {{ t('cdkLookup.queryHint') }}
          </div>
          <div class="form-group">
            <label>{{ t('cdkLookup.cdkLabel') }}</label>
            <input
              v-model="cdkCode"
              type="text"
              :placeholder="t('cdkLookup.cdkPlaceholder')"
              class="input mono"
              @keyup.enter="query"
            />
          </div>
          <button
            @click="query"
            :disabled="!cdkCode.trim() || querying"
            class="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="!querying">{{ t('cdkLookup.queryBtn') }}</span>
            <span v-else class="flex items-center justify-center gap-2">
              <span class="spinner"></span>{{ t('common.querying') }}
            </span>
          </button>
        </template>

        <template v-else>
          <h2 class="text-xl font-bold text-ink">{{ t('cdkLookup.modeBatch') }}</h2>
          <div class="rounded-xl bg-soft p-4 text-sm text-muted">
            {{ t('cdkLookup.batchHint', { max: LOOKUP_BATCH_MAX }) }}
          </div>
          <div class="form-group">
            <label>{{ t('cdkLookup.batchLabel') }}</label>
            <textarea
              v-model="batchText"
              rows="8"
              class="input mono text-sm min-h-[160px]"
              :placeholder="t('cdkLookup.batchPlaceholder')"
            />
            <p class="text-xs text-muted mt-1">
              {{ t('cdkLookup.batchRecognized', { n: parsedCodes.length }) }}
              <span v-if="parsedCodes.length > LOOKUP_BATCH_MAX" class="text-warn">
                · {{ t('cdkLookup.batchTruncated', { max: LOOKUP_BATCH_MAX }) }}
              </span>
            </p>
          </div>
          <button
            @click="queryBatch"
            :disabled="parsedCodes.length === 0 || querying"
            class="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="!querying">{{ t('cdkLookup.batchQueryBtn') }}</span>
            <span v-else class="flex items-center justify-center gap-2">
              <span class="spinner"></span>{{ t('common.querying') }}
            </span>
          </button>
        </template>

        <p v-if="error" class="text-sm" style="color: var(--err)">{{ error }}</p>
      </div>

      <div v-if="mode === 'single' && result" class="mt-8 card animate-slideInUp">
        <h2 class="text-xl font-bold text-ink mb-6">{{ t('cdkLookup.resultTitle') }}</h2>
        <div class="rounded-xl bg-soft p-6 space-y-4">
          <div class="flex justify-between items-center gap-3">
            <span class="text-muted shrink-0">{{ t('cdkLookup.cdkCode') }}</span>
            <span class="font-mono text-ink text-right break-all">{{ result.cdk_code }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-muted">{{ t('cdkLookup.useStatus') }}</span>
            <span class="font-semibold" :style="{ color: statusColor(result.status) }">{{ statusText(result.status) }}</span>
          </div>
          <div class="flex justify-between items-center gap-3">
            <span class="text-muted shrink-0">{{ t('cdkLookup.rechargeEmail') }}</span>
            <span class="font-mono text-ink text-right break-all">
              {{ result.account_email || t('cdkLookup.emailEmpty') }}
            </span>
          </div>
          <div v-if="result.plan" class="flex justify-between items-center">
            <span class="text-muted">{{ t('cdkLookup.plan') }}</span>
            <span class="text-ink">{{ result.plan }}</span>
          </div>
          <div v-if="result.used_at" class="flex justify-between items-center text-sm">
            <span class="text-muted">{{ t('cdkLookup.usedAt') }}</span>
            <span class="text-muted">{{ result.used_at }}</span>
          </div>
        </div>

        <div
          v-if="result.status === 'failed'"
          class="alert alert-error mt-6"
        >{{ result.message || t('cdkLookup.msgFailed') }}</div>
        <div
          v-else-if="result.used"
          class="alert alert-success mt-6"
        >{{ result.message || t('cdkLookup.msgUsed') }}</div>
        <div
          v-else-if="result.status === 'processing'"
          class="alert alert-info mt-6"
        >{{ result.message || t('cdkLookup.msgProcessing') }}</div>
        <div
          v-else-if="result.status === 'disabled' || result.status === 'expired'"
          class="alert mt-6"
          style="background: var(--warn-soft); color: var(--warn); border-color: var(--warn)"
        >{{ result.message }}</div>
        <div
          v-else
          class="alert alert-info mt-6"
        >{{ result.message || t('cdkLookup.msgUnused') }}</div>

        <div class="flex flex-col sm:flex-row gap-3 mt-6">
          <button
            v-if="result.can_resubmit"
            class="btn-primary flex-1"
            @click="goRedeem(result.cdk_code)"
          >{{ t('cdkLookup.resubmit') }}</button>
          <button
            v-else-if="result.status === 'unused'"
            class="btn-primary flex-1"
            @click="goRedeem(result.cdk_code)"
          >{{ t('cdkLookup.goRedeem') }}</button>
          <button @click="reset" class="btn-secondary flex-1">{{ t('cdkLookup.queryOther') }}</button>
        </div>
      </div>

      <div v-if="mode === 'batch' && batchResults.length" class="mt-8 card animate-slideInUp space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-xl font-bold text-ink">{{ t('cdkLookup.resultTitle') }}</h2>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="btn-secondary !py-1.5 !px-3 text-sm" @click="copyUsedEmails">
              {{ t('cdkLookup.copyEmails') }}
            </button>
            <button type="button" class="btn-secondary !py-1.5 !px-3 text-sm" @click="exportCsv">
              {{ t('cdkLookup.exportCsv') }}
            </button>
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-sm">
          <div class="rounded-lg py-2" style="background: color-mix(in srgb, var(--good, #16a34a) 12%, transparent)">
            {{ t('cdkLookup.summaryUsed', { n: batchSummary.used }) }}
          </div>
          <div class="rounded-lg py-2" style="background: color-mix(in srgb, var(--err, #dc2626) 12%, transparent)">
            {{ t('cdkLookup.summaryFailed', { n: batchSummary.failed }) }}
          </div>
          <div class="rounded-lg bg-soft py-2">
            {{ t('cdkLookup.summaryUnused', { n: batchSummary.unused }) }}
          </div>
          <div class="rounded-lg py-2" style="background: color-mix(in srgb, var(--primary) 12%, transparent)">
            {{ t('cdkLookup.summaryProcessing', { n: batchSummary.processing }) }}
          </div>
          <div class="rounded-lg py-2" style="background: color-mix(in srgb, var(--warn, #d97706) 12%, transparent)">
            {{ t('cdkLookup.summaryUnknown', { n: batchSummary.unknown }) }}
          </div>
        </div>
        <div class="overflow-x-auto rounded-xl border bd">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-soft text-left text-muted">
                <th class="px-3 py-2 font-medium">#</th>
                <th class="px-3 py-2 font-medium">{{ t('cdkLookup.cdkCode') }}</th>
                <th class="px-3 py-2 font-medium">{{ t('cdkLookup.useStatus') }}</th>
                <th class="px-3 py-2 font-medium">{{ t('cdkLookup.rechargeEmail') }}</th>
                <th class="px-3 py-2 font-medium">{{ t('cdkLookup.plan') }}</th>
                <th class="px-3 py-2 font-medium">{{ t('cdkLookup.usedAt') }}</th>
                <th class="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in batchResults" :key="row.cdk_code + i" class="border-t bd">
                <td class="px-3 py-2 text-muted tabular-nums">{{ i + 1 }}</td>
                <td class="px-3 py-2 font-mono break-all">{{ row.cdk_code }}</td>
                <td class="px-3 py-2 font-semibold whitespace-nowrap" :style="{ color: statusColor(row.status) }">
                  {{ statusText(row.status) }}
                </td>
                <td class="px-3 py-2 font-mono break-all">{{ row.account_email || t('cdkLookup.emailEmpty') }}</td>
                <td class="px-3 py-2">{{ row.plan || t('cdkLookup.emailEmpty') }}</td>
                <td class="px-3 py-2 text-muted whitespace-nowrap">{{ row.used_at || t('cdkLookup.emailEmpty') }}</td>
                <td class="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    v-if="row.can_resubmit"
                    type="button"
                    class="btn-primary !py-1 !px-3 text-xs"
                    @click="goRedeem(row.cdk_code)"
                  >{{ t('cdkLookup.resubmit') }}</button>
                  <button
                    v-else-if="row.status === 'unused'"
                    type="button"
                    class="btn-secondary !py-1 !px-3 text-xs"
                    @click="goRedeem(row.cdk_code)"
                  >{{ t('cdkLookup.goRedeem') }}</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import UserPageHeader from '../../components/UserPageHeader.vue'
import RedeemModeTabs from '../../components/RedeemModeTabs.vue'
import { parseCdks } from '../../lib/batch-session'
import { copyToClipboard } from '../../lib/clipboard'
import { toast } from '../../lib/ui'
import { planLabel } from '../../lib/plan'
// 东方意象七主题的展示外壳（移植自 autocard，原作者授权开源使用，2026-11-17）
import RedeemPresentation from '../../redeem-presentation/components/RedeemPresentation.vue'
import { mythicPresentation, queryCard } from '../../redeem-presentation/adapter'
import { maskRedeemCode } from '../../redeem-presentation/utils/redeemCard'
import type { RedeemPhase } from '../../redeem-presentation/utils/redeemPresentation'

const { t } = useI18n({ useScope: 'global' })
const router = useRouter()

const LOOKUP_BATCH_MAX = 100

interface CDKStatusResult {
  cdk_code: string
  status: string
  used: boolean
  can_resubmit?: boolean
  account_email?: string
  plan?: string
  used_at?: string
  notes?: string
  message?: string
}

const mode = ref<'single' | 'batch'>('single')
const cdkCode = ref('')
const batchText = ref('')
const querying = ref(false)
const error = ref('')
const result = ref<CDKStatusResult | null>(null)
const batchResults = ref<CDKStatusResult[]>([])

const parsedCodes = computed(() => parseCdks(batchText.value))

const batchSummary = computed(() => {
  const s = { used: 0, failed: 0, unused: 0, processing: 0, unknown: 0 }
  for (const row of batchResults.value) {
    if (row.status === 'used') s.used++
    else if (row.status === 'failed') s.failed++
    else if (row.status === 'unused') s.unused++
    else if (row.status === 'processing') s.processing++
    else s.unknown++
  }
  return s
})

function statusText(status: string) {
  const key = `cdkLookup.status.${status}`
  const label = t(key)
  return label === key ? status : label
}

function statusColor(status: string) {
  if (status === 'used') return 'var(--good, #16a34a)'
  if (status === 'failed') return 'var(--err, #dc2626)'
  if (status === 'unused') return 'var(--ink)'
  if (status === 'processing') return 'var(--primary)'
  if (status === 'disabled' || status === 'expired' || status === 'unknown') return 'var(--warn, #d97706)'
  return 'var(--ink)'
}

function goRedeem(code: string) {
  router.push({ path: '/recharge', query: { cdk: code } })
}

async function query() {
  const code = cdkCode.value.trim()
  if (!code) return
  querying.value = true
  error.value = ''
  result.value = null
  try {
    const r = await fetch(`/api/v1/lookup/cdk?code=${encodeURIComponent(code)}`)
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      error.value = data.error || data.message || t('cdkLookup.errNotFound')
      return
    }
    result.value = data as CDKStatusResult
  } catch {
    error.value = t('cdkLookup.errNetwork')
  } finally {
    querying.value = false
  }
}

async function queryBatch() {
  const codes = parsedCodes.value.slice(0, LOOKUP_BATCH_MAX)
  if (!codes.length) {
    error.value = t('cdkLookup.batchEmpty')
    return
  }
  querying.value = true
  error.value = ''
  batchResults.value = []
  try {
    const r = await fetch('/api/v1/lookup/cdk/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes }),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      error.value = data.error || data.message || t('cdkLookup.errNetwork')
      return
    }
    batchResults.value = Array.isArray(data.results) ? data.results : []
  } catch {
    error.value = t('cdkLookup.errNetwork')
  } finally {
    querying.value = false
  }
}

async function copyUsedEmails() {
  const emails = Array.from(
    new Set(
      batchResults.value
        .map((row) => String(row.account_email || '').trim())
        .filter(Boolean),
    ),
  )
  if (!emails.length) {
    toast(t('cdkLookup.emailEmpty'), 'warn')
    return
  }
  const ok = await copyToClipboard(emails.join('\n'))
  toast(ok ? t('cdkLookup.copied') : t('cdkLookup.copyFail'), ok ? 'ok' : 'err')
}

function exportCsv() {
  const header = ['cdk_code', 'status', 'can_resubmit', 'account_email', 'plan', 'used_at', 'message']
  const lines = [header.join(',')]
  for (const row of batchResults.value) {
    const cells = [
      row.cdk_code,
      row.status,
      row.can_resubmit ? '1' : '0',
      row.account_email || '',
      row.plan || '',
      row.used_at || '',
      row.message || '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`)
    lines.push(cells.join(','))
  }
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `cdk-lookup-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

function setMode(next: 'single' | 'batch') {
  mode.value = next
  error.value = ''
}

function reset() {
  result.value = null
  error.value = ''
  cdkCode.value = ''
}

// ── 东方意象展示外壳的状态映射（只读本页现有状态，不改查询流程） ──
const presentation = ref<InstanceType<typeof RedeemPresentation> | null>(null)
// 与原项目 HistoryView.publicPhase 同义：查询中 = verifying；没结果 = idle；成功 / 失败 / 处理中按卡密状态。
const historyPhase = computed<RedeemPhase>(() => {
  if (mode.value === 'batch') return querying.value ? 'verifying' : 'idle'
  if (querying.value && !result.value) return 'verifying'
  const st = result.value?.status
  if (!st) return 'idle'
  if (st === 'used') return 'success'
  if (st === 'failed' || st === 'disabled' || st === 'expired') return 'failed'
  if (st === 'processing') return 'processing'
  if (st === 'unused') return 'idle'
  return 'unknown'
})
const historyCard = computed(() => {
  const found = mode.value === 'single' ? result.value : null
  const statusLabel = querying.value && !found ? t('common.querying') : !found ? t('m19.historyEmpty') : statusText(found.status)
  return queryCard({ phase: historyPhase.value, plan: found?.plan, identified: !!found, identity: maskRedeemCode(found?.cdk_code || cdkCode.value), account: found?.account_email, statusLabel })
})
const resultNote = computed(() => {
  const r = result.value
  if (!r) return { tone: 'info', text: '' }
  if (r.status === 'failed') return { tone: 'error', text: r.message || t('cdkLookup.msgFailed') }
  if (r.used) return { tone: 'success', text: r.message || t('cdkLookup.msgUsed') }
  if (r.status === 'processing') return { tone: 'info', text: r.message || t('cdkLookup.msgProcessing') }
  if (r.status === 'disabled' || r.status === 'expired') return { tone: 'warn', text: r.message || statusText(r.status) }
  return { tone: 'info', text: r.message || t('cdkLookup.msgUnused') }
})
function clearQueries() {
  cdkCode.value = ''
  batchText.value = ''
  result.value = null
  batchResults.value = []
  error.value = ''
}
async function pasteInto(target: 'single' | 'batch') {
  try {
    const text = (await navigator.clipboard.readText()).trim()
    if (!text) return
    if (target === 'single') cdkCode.value = text
    else batchText.value = batchText.value.trim() ? `${batchText.value.trimEnd()}\n${text}` : text
  } catch { /* 浏览器不允许读剪贴板时什么都不做，用户可手动粘贴 */ }
}
</script>
