<template>
  <div class="u-page">
    <UserPageHeader :eyebrow="t('hero.batchEyebrow')" :title="t('batch.title')" :subtitle="t('batch.subtitle')" />
    <div class="u-main max-w-3xl">

      <RedeemModeTabs />
      <p class="hint-line text-sm text-muted mb-3">{{ t('xPremium.batchHint') }}</p>
      <p class="hint-line text-sm text-muted mb-3">{{ t('grok.batchHint') }}</p>

      <div class="card space-y-4">
        <div class="flex items-start gap-3 pb-3 border-b bd">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white text-[10px] font-bold leading-tight text-center"
            style="background: var(--primary)"
          >
            批量<br />兑换
          </div>
          <div>
            <h2 class="text-base font-semibold text-ink">{{ t('batch.panelTitle') }}</h2>
            <p class="text-xs text-muted mt-0.5 leading-relaxed">{{ t('batch.panelHint') }}</p>
          </div>
        </div>

        <!-- input phase -->
        <template v-if="phase === 'input'">
          <div>
            <label class="block text-sm font-medium text-ink mb-1.5">
              {{ t('batch.cdkListLabel', { max: BATCH_MAX_KEYS }) }}
            </label>
            <textarea
              v-model="cdkText"
              rows="6"
              class="input mono text-sm min-h-[120px]"
              :placeholder="t('batch.cdkPlaceholder')"
            />
            <p class="text-xs text-muted mt-1">
              {{ t('batch.cdkRecognized', { n: parsedCdks.length }) }}
              <span v-if="parsedCdks.length > 100" class="text-warn">
                · {{ t('batch.cdkQueueHint') }}
              </span>
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-ink mb-1.5">{{ t('batch.credMode') }}</label>
            <div class="flex gap-2">
              <button
                type="button"
                class="btn-secondary !py-1.5 flex-1"
                :class="{ 'ring-2': credMode === 'session' }"
                @click="credMode = 'session'"
              >
                {{ t('batch.modeSession') }}
              </button>
              <button
                type="button"
                class="btn-secondary !py-1.5 flex-1"
                :class="{ 'ring-2': credMode === 'mailbox' }"
                @click="credMode = 'mailbox'"
              >
                {{ t('batch.modeMailbox') }}
              </button>
            </div>
          </div>

          <ExcelImportBlock
            v-if="credMode === 'session'"
            :session-pool="sessionPool"
            :import-msg="importMsg"
            :importing="importing"
            @pick="onPickFile"
            @clear="clearSessionPool"
          />

          <div v-else class="space-y-1.5">
            <label class="block text-sm font-medium text-ink">{{ t('batch.mailboxLabel') }}</label>
            <textarea
              v-model="mailboxText"
              rows="6"
              class="input mono text-sm min-h-[120px]"
              :placeholder="t('batch.mailboxPlaceholder')"
            />
            <p class="text-xs text-muted">
              {{ t('batch.mailboxRecognized', { n: parsedMailboxes.length }) }}
            </p>
            <input
              ref="mailboxFileRef"
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              class="hidden"
              @change="onPickMailboxFile"
            />
            <button
              type="button"
              class="w-full py-2.5 rounded-xl border border-dashed text-sm font-medium disabled:opacity-40"
              style="border-color: color-mix(in srgb, var(--primary) 45%, var(--brd)); color: var(--primary)"
              :disabled="importing"
              @click="mailboxFileRef?.click()"
            >
              {{ importing ? t('batch.importing') : t('batch.mailboxImportBtn') }}
            </button>
            <p v-if="importMsg" class="text-xs text-muted leading-relaxed">{{ importMsg }}</p>
            <p class="text-[11px] text-subtle">{{ t('batch.mailboxHint') }}</p>
          </div>

          <button
            type="button"
            class="btn-primary w-full"
            :disabled="verifying || parsedCdks.length === 0"
            @click="handleVerifyBatch"
          >
            {{ verifying ? t('batch.verifying') : t('batch.verifyStart') }}
          </button>
          <p v-if="sessionError" class="text-xs text-err">{{ sessionError }}</p>
        </template>

        <!-- run phase -->
        <template v-else>
          <div class="grid grid-cols-4 gap-2 text-center">
            <div class="rounded-lg bg-soft py-2">
              <div class="text-lg font-bold tabular-nums text-ink">{{ stats.total }}</div>
              <div class="text-[10px] text-muted">{{ t('batch.statTotal') }}</div>
            </div>
            <div class="rounded-lg py-2" style="background: color-mix(in srgb, var(--warn, #d97706) 12%, transparent)">
              <div class="text-lg font-bold tabular-nums text-warn">{{ stats.wait }}</div>
              <div class="text-[10px] text-muted">{{ t('batch.statWait') }}</div>
            </div>
            <div class="rounded-lg py-2" style="background: color-mix(in srgb, var(--primary) 12%, transparent)">
              <div class="text-lg font-bold tabular-nums" style="color: var(--primary)">{{ stats.run }}</div>
              <div class="text-[10px] text-muted">{{ t('batch.statRun') }}</div>
            </div>
            <div class="rounded-lg py-2" style="background: color-mix(in srgb, var(--good, #16a34a) 12%, transparent)">
              <div class="text-lg font-bold tabular-nums text-good">
                {{ stats.ok }}<span class="text-muted text-sm font-normal">/{{ stats.fail }}</span>
              </div>
              <div class="text-[10px] text-muted">{{ t('batch.statOkFail') }}</div>
            </div>
          </div>

          <div v-if="!verifying && pendingSessionItems.length > 0 && credMode === 'session'" class="rounded-xl border bd p-3">
            <ExcelImportBlock
              :session-pool="sessionPool"
              :import-msg="importMsg"
              :importing="importing"
              @pick="onPickFile"
              @clear="clearSessionPool"
            />
          </div>
          <div v-else-if="!verifying && pendingSessionItems.length > 0 && credMode === 'mailbox'" class="rounded-xl border bd p-3 space-y-2">
            <label class="block text-sm font-medium text-ink">{{ t('batch.mailboxLabel') }}</label>
            <textarea
              v-model="mailboxText"
              rows="4"
              class="input mono text-sm"
              :placeholder="t('batch.mailboxPlaceholder')"
            />
            <p class="text-xs text-muted">{{ t('batch.mailboxRecognized', { n: parsedMailboxes.length }) }}</p>
          </div>

          <div v-if="verifying" class="text-sm text-muted text-center py-4">
            {{ t('batch.verifyingKeys') }}
          </div>

          <div
            v-else-if="currentItem"
            class="rounded-xl border p-4 space-y-3"
            style="border-color: color-mix(in srgb, var(--primary) 35%, var(--brd)); background: color-mix(in srgb, var(--primary) 6%, transparent)"
          >
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="text-sm font-medium text-ink">
                {{ t('batch.currentOrdinal', { n: currentOrdinal, total: totalVerified }) }}
                <span class="text-xs font-normal text-muted ml-1">
                  · {{ t('batch.remaining', { n: pendingSessionItems.length }) }}
                </span>
              </div>
              <div class="text-xs font-mono" style="color: var(--primary)">
                {{ currentItem.cardKey }}
                <span v-if="currentItem.planLabel" class="ml-1.5 text-muted">({{ currentItem.planLabel }})</span>
              </div>
            </div>
            <template v-if="credMode === 'session'">
              <p
                v-if="currentExcelIdx >= 0 && sessionPool[currentExcelIdx]?.email"
                class="text-xs text-muted"
              >
                {{ t('batch.willUseAccount') }}
                <span class="font-mono ml-1 text-ink">{{ sessionPool[currentExcelIdx].email }}</span>
              </p>
              <textarea
                ref="sessionBoxRef"
                v-model="sessionInput"
                rows="5"
                class="input mono text-xs min-h-[100px]"
                :placeholder="t('batch.sessionPlaceholder')"
                :disabled="submitting || autoSubmitting"
                @input="sessionError = ''"
              />
            </template>
            <template v-else>
              <p
                v-if="currentExcelIdx >= 0 && mailboxPool[currentExcelIdx]?.email"
                class="text-xs text-muted"
              >
                {{ t('batch.willUseAccount') }}
                <span class="font-mono ml-1 text-ink">{{ mailboxPool[currentExcelIdx].email }}</span>
              </p>
              <textarea
                ref="sessionBoxRef"
                v-model="sessionInput"
                rows="3"
                class="input mono text-xs min-h-[72px]"
                :placeholder="t('batch.mailboxLinePlaceholder')"
                :disabled="submitting || autoSubmitting"
                @input="sessionError = ''"
              />
            </template>
            <p v-if="sessionError" class="text-xs text-err">{{ sessionError }}</p>
            <div class="flex flex-col gap-2">
              <button
                type="button"
                class="btn-primary w-full"
                :disabled="!sessionInput.trim() || submitting || autoSubmitting"
                @click="handleSubmitSession"
              >
                {{ submitting ? t('batch.submitting') : t('batch.submitNext') }}
              </button>
              <button
                v-if="credMode === 'session' ? sessionPool.length > 0 : mailboxPool.length > 0"
                type="button"
                class="btn-secondary w-full !border-0 text-white"
                style="background: var(--good, #16a34a)"
                :disabled="submitting || autoSubmitting"
                @click="handleAutoSubmitAll"
              >
                {{
                  autoSubmitting
                    ? t('batch.autoSubmitting')
                    : t('batch.autoSubmit', {
                        n: credMode === 'session' ? sessionPool.length : mailboxPool.length,
                      })
                }}
              </button>
            </div>
            <p class="text-[11px] text-muted text-center">
              {{ credMode === 'session' ? t('batch.pairHint') : t('batch.mailboxPairHint') }}
            </p>
          </div>

          <div
            v-else-if="allSessionsCollected"
            class="rounded-xl border p-4 text-center space-y-2"
            style="border-color: color-mix(in srgb, var(--good, #16a34a) 35%, var(--brd)); background: color-mix(in srgb, var(--good, #16a34a) 8%, transparent)"
          >
            <p class="text-sm font-medium text-good">
              {{ t('batch.allSubmitted', { n: sessionsDone }) }}
            </p>
            <p class="text-xs text-muted">{{ t('batch.watchProgress') }}</p>
            <button
              v-if="stats.ok > 0"
              type="button"
              class="text-xs px-3 py-1.5 rounded-lg text-white"
              style="background: var(--good, #16a34a)"
              @click="exportBatchSuccess"
            >
              {{ t('batch.exportOk', { n: stats.ok }) }}
            </button>
          </div>

          <div v-else class="text-sm text-muted text-center py-3">
            {{ t('batch.noValidKeys') }}
          </div>

          <div class="rounded-xl border bd overflow-hidden">
            <div class="px-3 py-2 bg-soft text-xs font-medium text-muted">{{ t('batch.liveProgress') }}</div>
            <ul class="divide-y max-h-80 overflow-y-auto" style="border-color: var(--brd)">
              <li
                v-for="(it, idx) in items"
                :key="it.id"
                class="px-3 py-2.5 text-xs space-y-1"
                style="border-color: var(--brd)"
              >
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-subtle tabular-nums w-5">{{ idx + 1 }}</span>
                  <span class="font-mono text-ink break-all">{{ it.cardKey }}</span>
                  <span v-if="it.planLabel" class="text-[10px] text-muted">{{ it.planLabel }}</span>
                  <span class="ml-auto px-1.5 py-0.5 rounded font-medium status-pill" :data-st="it.status">
                    {{ statusLabel(it.status) }}
                  </span>
                </div>
                <div
                  v-if="it.progressMsg || it.verifyMsg || it.email || it.cardLastFour || it.redemptionToken"
                  class="pl-7 text-[11px] text-muted space-y-0.5"
                >
                  <div v-if="it.email">{{ t('batch.account') }}：{{ it.email }}</div>
                  <div v-if="it.cardLastFour">{{ t('batch.card') }}：•••• {{ it.cardLastFour }}</div>
                  <div v-else-if="it.status === 'processing' || it.status === 'success'">
                    {{ t('batch.card') }}：{{ t('batch.cardPending') }}
                  </div>
                  <div v-if="it.redemptionToken" class="font-mono truncate">
                    token：{{ it.redemptionToken.slice(0, 18) }}…
                  </div>
                  <div>
                    {{
                      it.status === 'verify_fail' || it.status === 'failed'
                        ? it.error || it.progressMsg || it.verifyMsg
                        : it.progressMsg || it.verifyMsg
                    }}
                  </div>
                </div>
              </li>
            </ul>
          </div>

          <button
            v-if="stats.ok > 0"
            type="button"
            class="btn-secondary w-full"
            style="color: var(--good, #16a34a); border-color: color-mix(in srgb, var(--good, #16a34a) 40%, var(--brd))"
            @click="exportBatchSuccess"
          >
            {{ t('batch.exportOk', { n: stats.ok }) }}
          </button>
          <button type="button" class="btn-secondary w-full" @click="resetAll">
            {{ t('batch.reset') }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UserPageHeader from '../../components/UserPageHeader.vue'
import RedeemModeTabs from '../../components/RedeemModeTabs.vue'
import ExcelImportBlock from '../../components/ExcelImportBlock.vue'
import { isGrokCredential } from '../../lib/grok'
import {
  AUTO_SUBMIT_CONCURRENCY,
  BATCH_MAX_KEYS,
  BATCH_POLL_INTERVAL_MS,
  VERIFY_CONCURRENCY,
  accessTokenFromSession,
  checkSessionForCdk,
  exportSuccessWorkbook,
  extractCdkSession,
  mapPool,
  parseCdks,
  parseMailboxLine,
  parseMailboxLines,
  parseMailboxesFromSheet,
  parseSessionsFromSheet,
  readWorkbookRows,
  type ImportedMailbox,
  type ImportedSession,
} from '../../lib/batch-session'

const { t } = useI18n({ useScope: 'global' })

type ItemStatus =
  | 'pending_verify'
  | 'verify_ok'
  | 'verify_fail'
  | 'waiting_session'
  | 'submitting'
  | 'processing'
  | 'success'
  | 'failed'

interface BatchItem {
  id: string
  cardKey: string
  planLabel: string
  status: ItemStatus
  verifyMsg: string
  redemptionToken: string
  progressMsg: string
  email: string
  cardLastFour: string
  accessToken: string
  gptPassword: string
  emailPassword: string
  error: string
}

function extractCardLastFour(order: any): string {
  const last = String(order?.card_last_four || '').trim()
  if (/^\d{4}$/.test(last)) return last
  const n = String(order?.card_number || '').replace(/\D/g, '')
  return n.length >= 4 ? n.slice(-4) : ''
}

const deviceId = (() => {
  const k = 'cdk_device_id'
  let v = localStorage.getItem(k)
  if (!v) {
    v = 'web-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem(k, v)
  }
  return v
})()

const phase = ref<'input' | 'run'>('input')
const credMode = ref<'session' | 'mailbox'>('session')
const cdkText = ref('')
const mailboxText = ref('')
const items = ref<BatchItem[]>([])
const verifying = ref(false)
const sessionInput = ref('')
const sessionError = ref('')
const submitting = ref(false)
const autoSubmitting = ref(false)
const sessionPool = ref<ImportedSession[]>([])
const mailboxPool = ref<ImportedMailbox[]>([])
const importMsg = ref('')
const importing = ref(false)
const sessionBoxRef = ref<HTMLTextAreaElement | null>(null)
const mailboxFileRef = ref<HTMLInputElement | null>(null)
const lastFilledItemId = ref<string | null>(null)

const pollTargets = ref<Record<string, { token: string; terminal: boolean }>>({})
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollInFlight = false

const parsedCdks = computed(() => parseCdks(cdkText.value))
const parsedMailboxes = computed(() => parseMailboxLines(mailboxText.value))

watch(parsedMailboxes, (rows) => {
  // 文本粘贴优先；Excel 导入写入 mailboxPool 后也会同步到 mailboxText
  if (credMode.value === 'mailbox') mailboxPool.value = rows
})

const verifiedQueue = computed(() =>
  items.value.filter((i) => i.status !== 'pending_verify' && i.status !== 'verify_fail'),
)
const pendingSessionItems = computed(() =>
  items.value.filter((i) => i.status === 'waiting_session' || i.status === 'verify_ok'),
)
const currentItem = computed(() => pendingSessionItems.value[0] ?? null)
const currentExcelIdx = computed(() => {
  if (!currentItem.value) return -1
  return verifiedQueue.value.findIndex((i) => i.id === currentItem.value!.id)
})
const sessionsDone = computed(() =>
  items.value.filter((i) => ['submitting', 'processing', 'success', 'failed'].includes(i.status)).length,
)
const totalVerified = computed(() => verifiedQueue.value.length)
const currentOrdinal = computed(() =>
  currentExcelIdx.value >= 0 ? currentExcelIdx.value + 1 : sessionsDone.value,
)

const stats = computed(() => {
  const s = { total: items.value.length, ok: 0, fail: 0, run: 0, wait: 0 }
  for (const i of items.value) {
    if (i.status === 'success') s.ok++
    else if (i.status === 'failed' || i.status === 'verify_fail') s.fail++
    else if (i.status === 'processing' || i.status === 'submitting') s.run++
    else if (i.status === 'waiting_session' || i.status === 'verify_ok') s.wait++
  }
  return s
})

const allSessionsCollected = computed(
  () =>
    phase.value === 'run' &&
    !verifying.value &&
    totalVerified.value > 0 &&
    pendingSessionItems.value.length === 0,
)

function statusLabel(st: ItemStatus) {
  const map: Record<ItemStatus, string> = {
    pending_verify: t('batch.status.pending_verify'),
    verify_ok: t('batch.status.verify_ok'),
    verify_fail: t('batch.status.verify_fail'),
    waiting_session: t('batch.status.waiting_session'),
    submitting: t('batch.status.submitting'),
    processing: t('batch.status.processing'),
    success: t('batch.status.success'),
    failed: t('batch.status.failed'),
  }
  return map[st] || st
}

function updateItem(id: string, patch: Partial<BatchItem>) {
  items.value = items.value.map((it) => (it.id === id ? { ...it, ...patch } : it))
}

async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {})
  headers.set('X-Redemption-Device', deviceId)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const r = await fetch(path, { ...init, headers, credentials: 'include' })
  const text = await r.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  return { r, data }
}

const TERMINAL = new Set(['completed', 'declined', 'failed_precharge', 'cancelled', 'failed'])

function isTerminal(st: string) {
  return TERMINAL.has(String(st || '').toLowerCase())
}

function isSuccessStatus(st: string) {
  return String(st || '').toLowerCase() === 'completed'
}

function isFailStatus(st: string) {
  const s = String(st || '').toLowerCase()
  return ['declined', 'failed_precharge', 'cancelled', 'failed'].includes(s)
}

function planLabelOf(data: any): string {
  return String(data?.plan || data?.plan_type || data?.plan_label || data?.data?.plan || '')
}

function stopAllPolls() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  pollInFlight = false
  pollTargets.value = {}
}

async function pollBatch() {
  if (pollInFlight) return
  const entries = Object.entries(pollTargets.value).filter(([, v]) => !v.terminal)
  if (!entries.length) {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    return
  }
  pollInFlight = true
  try {
    await Promise.all(
      entries.map(async ([id, target]) => {
        try {
          const { r, data } = await api(
            '/api/v1/public/cdk/result?token=' + encodeURIComponent(target.token),
          )
          if (!r.ok) return
          const order = data?.order || data?.data?.order || data?.data || data || {}
          const st = String(order.status || data?.status || data?.data?.status || '')
          const message = String(
            order.message || order.user_message || data?.message || data?.user_message || '',
          )
          const email = String(order.account_email || order.email || '').trim()
          const cardLastFour = extractCardLastFour(order)
          const meta: Partial<BatchItem> = {}
          if (email) meta.email = email
          if (cardLastFour) meta.cardLastFour = cardLastFour
          if (isSuccessStatus(st)) {
            updateItem(id, {
              ...meta,
              status: 'success',
              progressMsg: message || '开通完成',
              error: '',
            })
            pollTargets.value[id] = { ...target, terminal: true }
          } else if (isFailStatus(st)) {
            updateItem(id, {
              ...meta,
              status: 'failed',
              progressMsg: message || '兑换失败',
              error: message || '失败',
            })
            pollTargets.value[id] = { ...target, terminal: true }
          } else {
            updateItem(id, {
              ...meta,
              status: 'processing',
              progressMsg: message || (st ? `处理中 · ${st}` : '处理中…'),
              error: '',
            })
          }
        } catch {
          /* transient */
        }
      }),
    )
  } finally {
    pollInFlight = false
  }
}

function startPoll(id: string, token: string) {
  pollTargets.value = { ...pollTargets.value, [id]: { token, terminal: false } }
  if (!pollTimer) {
    void pollBatch()
    pollTimer = setInterval(() => void pollBatch(), BATCH_POLL_INTERVAL_MS)
  }
}

function fillCredentialFromPool(excelIdx: number) {
  if (credMode.value === 'mailbox') {
    const pool = mailboxPool.value
    if (!pool.length || excelIdx < 0 || excelIdx >= pool.length) {
      sessionInput.value = ''
      return
    }
    const m = pool[excelIdx]
    sessionInput.value = `${m.email}----${m.password}`
    sessionError.value = ''
    return
  }
  const pool = sessionPool.value
  if (!pool.length || excelIdx < 0 || excelIdx >= pool.length) {
    sessionInput.value = ''
    return
  }
  sessionInput.value = pool[excelIdx].session
  sessionError.value = ''
}

watch(
  () => currentItem.value?.id,
  async (id) => {
    if (!id || currentExcelIdx.value < 0) return
    if (lastFilledItemId.value === id) return
    lastFilledItemId.value = id
    const hasPool =
      credMode.value === 'mailbox' ? mailboxPool.value.length > 0 : sessionPool.value.length > 0
    if (hasPool) fillCredentialFromPool(currentExcelIdx.value)
    else sessionInput.value = ''
    await nextTick()
    sessionBoxRef.value?.focus()
  },
)

async function onPickFile(file: File | null) {
  if (!file) return
  importing.value = true
  importMsg.value = ''
  try {
    const rows = await readWorkbookRows(file)
    const { sessions, mode, sessionCol, skippedDup } = parseSessionsFromSheet(rows)
    if (!sessions.length) {
      sessionPool.value = []
      importMsg.value =
        sessionCol < 0
          ? '未识别到 Session 列。请确保有 session 列或单元格为完整 Session JSON'
          : '识别到列但无有效 Session（需完整 JSON 含 sessionToken，或五段 JWE）'
      return
    }
    sessionPool.value = sessions
    importMsg.value =
      `已从「${file.name}」识别 ${sessions.length} 条 Session（${mode}）` +
      (skippedDup > 0 ? `，已去重跳过 ${skippedDup} 条` : '') +
      (sessions[0]?.email ? `，如 ${sessions[0].email}` : '')
    lastFilledItemId.value = null
    if (phase.value === 'run' && currentExcelIdx.value >= 0) {
      fillCredentialFromPool(currentExcelIdx.value)
    }
  } catch (e) {
    sessionPool.value = []
    importMsg.value = '读取 Excel 失败：' + (e instanceof Error ? e.message : '未知错误')
  } finally {
    importing.value = false
  }
}

async function onPickMailboxFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (!file) return
  importing.value = true
  importMsg.value = ''
  try {
    const name = (file.name || '').toLowerCase()
    if (name.endsWith('.txt')) {
      const text = await file.text()
      const rows = parseMailboxLines(text)
      if (!rows.length) {
        importMsg.value = '未识别到邮箱密码行（支持 email----password）'
        return
      }
      mailboxText.value = rows.map((r) => `${r.email}----${r.password}`).join('\n')
      mailboxPool.value = rows
      importMsg.value = `已从「${file.name}」识别 ${rows.length} 条邮箱密码`
      return
    }
    const sheetRows = await readWorkbookRows(file)
    const { mailboxes, mode, skippedDup } = parseMailboxesFromSheet(sheetRows)
    if (!mailboxes.length) {
      importMsg.value = '未识别到邮箱/密码列。请使用「邮箱,邮箱密码」或 email----password'
      return
    }
    mailboxText.value = mailboxes.map((r) => `${r.email}----${r.password}`).join('\n')
    mailboxPool.value = mailboxes
    importMsg.value =
      `已从「${file.name}」识别 ${mailboxes.length} 条邮箱密码（${mode}）` +
      (skippedDup > 0 ? `，已去重跳过 ${skippedDup} 条` : '')
    lastFilledItemId.value = null
    if (phase.value === 'run' && currentExcelIdx.value >= 0) {
      fillCredentialFromPool(currentExcelIdx.value)
    }
  } catch (err) {
    importMsg.value = '读取失败：' + (err instanceof Error ? err.message : '未知错误')
  } finally {
    importing.value = false
  }
}

function clearSessionPool() {
  sessionPool.value = []
  importMsg.value = ''
  sessionInput.value = ''
}

async function handleVerifyBatch() {
  const keys = parseCdks(cdkText.value)
  if (!keys.length) return
  if (keys.length > BATCH_MAX_KEYS) {
    sessionError.value = `单次最多 ${BATCH_MAX_KEYS} 个卡密`
    return
  }
  verifying.value = true
  sessionError.value = ''
  stopAllPolls()
  lastFilledItemId.value = null
  if (credMode.value === 'mailbox') {
    mailboxPool.value = parsedMailboxes.value
  }
  const list: BatchItem[] = keys.map((k, i) => ({
    id: `${i}-${k}`,
    cardKey: k,
    planLabel: '',
    status: 'pending_verify',
    verifyMsg: '验证中…',
    redemptionToken: '',
    progressMsg: '',
    email: '',
    cardLastFour: '',
    accessToken: '',
    gptPassword: '',
    emailPassword: '',
    error: '',
  }))
  items.value = list
  phase.value = 'run'
  sessionInput.value = ''

  try {
    const results = await mapPool(list, VERIFY_CONCURRENCY, async (item) => {
      try {
        const { r, data } = await api('/api/v1/public/cdk/preview', {
          method: 'POST',
          body: JSON.stringify({ code: item.cardKey }),
        })
        if (!r.ok) {
          const msg = String(data?.error || data?.msg || data?.message || 'CDK 无效或不可用')
          return {
            ...item,
            status: 'verify_fail' as const,
            verifyMsg: msg,
            error: msg,
          }
        }
        const token = String(
          data?.redemption_token || data?.data?.redemption_token || data?.token || '',
        )
        if (!token) {
          return {
            ...item,
            status: 'verify_fail' as const,
            verifyMsg: '未返回 redemption_token',
            error: '未返回 redemption_token',
          }
        }
        const body = data?.data || data || {}
        return {
          ...item,
          status: 'waiting_session' as const,
          verifyMsg: '有效',
          planLabel: planLabelOf(body),
          redemptionToken: token,
        }
      } catch {
        return {
          ...item,
          status: 'verify_fail' as const,
          verifyMsg: '验证请求失败',
          error: '验证请求失败',
        }
      }
    })
    items.value = results
  } finally {
    verifying.value = false
    lastFilledItemId.value = null
  }
}

async function submitOne(
  item: BatchItem,
  credential:
    | { mode: 'session'; session: string; imported?: ImportedSession }
    | { mode: 'mailbox'; email: string; password: string },
): Promise<'ok' | 'fail'> {
  if (credential.mode === 'session') {
    const check = checkSessionForCdk(credential.session)
    if (!check.ok) {
      updateItem(item.id, {
        status: 'failed',
        progressMsg: check.error,
        error: check.error,
      })
      return 'fail'
    }
    const session = extractCdkSession(credential.session)
    const imported = credential.imported
    updateItem(item.id, {
      status: 'submitting',
      email: check.email || imported?.email || '',
      accessToken: imported?.accessToken || accessTokenFromSession(credential.session),
      gptPassword: imported?.gptPassword || '',
      emailPassword: imported?.emailPassword || '',
      progressMsg: '账号预检…',
      error: '',
    })
    return runPreflightRedeem(item, { mode: 'session', session }, check.email || imported?.email || '')
  }

  const email = credential.email.trim()
  const password = credential.password
  if (!email.includes('@') || !password) {
    updateItem(item.id, {
      status: 'failed',
      progressMsg: '邮箱或密码无效',
      error: '邮箱或密码无效',
    })
    return 'fail'
  }
  updateItem(item.id, {
    status: 'submitting',
    email,
    emailPassword: password,
    progressMsg: '账号预检…',
    error: '',
  })
  return runPreflightRedeem(item, { mode: 'mailbox', email, password }, email)
}

async function runPreflightRedeem(
  item: BatchItem,
  credential:
    | { mode: 'session'; session: string }
    | { mode: 'mailbox'; email: string; password: string },
  fallbackEmail: string,
): Promise<'ok' | 'fail'> {
  let redemptionToken = item.redemptionToken
  try {
    if (!redemptionToken) {
      const preview = await api('/api/v1/public/cdk/preview', {
        method: 'POST',
        body: JSON.stringify({ code: item.cardKey }),
      })
      if (!preview.r.ok) {
        const msg = String(preview.data?.error || preview.data?.msg || 'CDK 预览失败')
        updateItem(item.id, { status: 'failed', progressMsg: msg, error: msg })
        return 'fail'
      }
      redemptionToken = String(
        preview.data?.redemption_token || preview.data?.data?.redemption_token || '',
      )
      if (!redemptionToken) {
        updateItem(item.id, {
          status: 'failed',
          progressMsg: '未返回 redemption_token',
          error: '未返回 redemption_token',
        })
        return 'fail'
      }
      updateItem(item.id, { redemptionToken })
    }

    const { r, data } = await api('/api/v1/public/cdk/preflight', {
      method: 'POST',
      body: JSON.stringify({
        code: item.cardKey,
        redemption_token: redemptionToken,
        credential,
      }),
    })
    if (!r.ok || (data && typeof data.code === 'number' && data.code !== 0)) {
      const msg = String(data?.error || data?.msg || data?.message || '预检失败')
      updateItem(item.id, { status: 'failed', progressMsg: msg, error: msg })
      return 'fail'
    }
    const body = data?.data && typeof data.data === 'object' ? data.data : data || {}
    const preflightToken = String(body.preflight_token || data?.preflight_token || '')
    // Grok 码：预检不产票，兑换直接带登录态；卡台给出的拦截原因（登录态失效/已有订阅）直接判失败。
    const grok = credential.mode === 'session' && isGrokCredential(credential.session)
    const blocking = grok ? String(body.blocking_reason || '') : ''
    if (blocking) {
      updateItem(item.id, { status: 'failed', progressMsg: blocking, error: blocking })
      return 'fail'
    }
    if (!preflightToken && !grok) {
      updateItem(item.id, {
        status: 'failed',
        progressMsg: '未返回 preflight_token',
        error: '未返回 preflight_token',
      })
      return 'fail'
    }
    const email = String(body.email || body.account_email || fallbackEmail || '')
    updateItem(item.id, { email, progressMsg: '预检通过，提交兑换…' })

    const client_request_id = `batch-${deviceId.slice(0, 8)}-${Date.now()}-${item.id}`
    const redeem = await api('/api/v1/public/cdk/redeem', {
      method: 'POST',
      body: JSON.stringify(grok
        ? { redemption_token: redemptionToken, credential, client_request_id }
        : { redemption_token: redemptionToken, preflight_token: preflightToken, client_request_id }),
    })
    const order =
      redeem.data?.order || redeem.data?.data?.order || redeem.data?.data || redeem.data || {}
    const st = String(order.status || redeem.data?.status || '')
    const message = String(
      order.message || order.user_message || redeem.data?.message || redeem.data?.msg || '',
    )
    const cardLastFour = extractCardLastFour(order)
    const orderEmail = String(order.account_email || order.email || email).trim()

    if (!redeem.r.ok && redeem.r.status !== 202) {
      updateItem(item.id, {
        status: 'failed',
        email: orderEmail || email,
        cardLastFour: cardLastFour || item.cardLastFour,
        progressMsg: message || redeem.data?.error || '兑换被拒绝',
        error: message || redeem.data?.error || '兑换被拒绝',
      })
      return 'fail'
    }

    if (isSuccessStatus(st)) {
      updateItem(item.id, {
        status: 'success',
        email: orderEmail || email,
        cardLastFour,
        progressMsg: message || '开通完成',
        error: '',
      })
    } else if (isFailStatus(st)) {
      updateItem(item.id, {
        status: 'failed',
        email: orderEmail || email,
        cardLastFour,
        progressMsg: message || '兑换失败',
        error: message || '失败',
      })
      return 'fail'
    } else {
      updateItem(item.id, {
        status: 'processing',
        email: orderEmail || email,
        cardLastFour,
        progressMsg: message || '处理中…',
        error: '',
      })
      startPoll(item.id, redemptionToken)
    }
    return 'ok'
  } catch {
    updateItem(item.id, {
      status: 'failed',
      progressMsg: '网络异常，请稍后重试或联系客服确认是否已受理',
      error: '网络异常',
    })
    return 'fail'
  }
}

async function handleSubmitSession() {
  if (!currentItem.value || submitting.value || autoSubmitting.value) return
  const raw = sessionInput.value.trim()
  if (credMode.value === 'mailbox') {
    const parsed = parseMailboxLine(raw)
    if (!parsed) {
      sessionError.value = '请填写 email----password（或 email:password）'
      return
    }
    sessionError.value = ''
    submitting.value = true
    const item = currentItem.value
    sessionInput.value = ''
    lastFilledItemId.value = null
    try {
      await submitOne(item, { mode: 'mailbox', email: parsed.email, password: parsed.password })
    } finally {
      submitting.value = false
    }
    return
  }

  const check = checkSessionForCdk(raw)
  if (!check.ok) {
    sessionError.value = check.error
    return
  }
  sessionError.value = ''
  submitting.value = true
  const item = currentItem.value
  sessionInput.value = ''
  lastFilledItemId.value = null
  try {
    const imported =
      currentExcelIdx.value >= 0 ? sessionPool.value[currentExcelIdx.value] : undefined
    await submitOne(item, {
      mode: 'session',
      session: raw,
      imported: imported?.session.trim() === raw ? imported : undefined,
    })
  } finally {
    submitting.value = false
  }
}

async function handleAutoSubmitAll() {
  if (autoSubmitting.value || submitting.value || verifying.value) return
  const verifiedSnap = items.value.filter(
    (i) => i.status !== 'pending_verify' && i.status !== 'verify_fail',
  )
  const pendingSnap = items.value.filter(
    (i) => i.status === 'verify_ok' || i.status === 'waiting_session',
  )
  if (!pendingSnap.length) {
    sessionError.value = '没有待提交的卡密'
    return
  }

  if (credMode.value === 'mailbox') {
    const pool = mailboxPool.value.length ? mailboxPool.value : parsedMailboxes.value
    if (!pool.length) {
      sessionError.value = '请先粘贴或导入邮箱密码列表'
      return
    }
    autoSubmitting.value = true
    sessionError.value = ''
    const verifiedPositions = new Map(verifiedSnap.map((item, index) => [item.id, index]))
    let cursor = 0
    const workers = Array.from(
      { length: Math.min(AUTO_SUBMIT_CONCURRENCY, pendingSnap.length) },
      async () => {
        while (true) {
          const itemIndex = cursor++
          if (itemIndex >= pendingSnap.length) return
          const item = pendingSnap[itemIndex]
          const excelIdx = verifiedPositions.get(item.id) ?? -1
          const mb = excelIdx >= 0 ? pool[excelIdx] : undefined
          if (!mb) {
            updateItem(item.id, {
              status: 'failed',
              progressMsg: `邮箱列表只有 ${pool.length} 条，第 ${excelIdx + 1} 张无对应`,
              error: '邮箱密码不足',
            })
            continue
          }
          await submitOne(item, { mode: 'mailbox', email: mb.email, password: mb.password })
        }
      },
    )
    await Promise.all(workers)
    sessionInput.value = ''
    autoSubmitting.value = false
    return
  }

  const pool = sessionPool.value
  if (!pool.length) {
    sessionError.value = '请先导入 Excel Session'
    return
  }
  autoSubmitting.value = true
  sessionError.value = ''
  const verifiedPositions = new Map(verifiedSnap.map((item, index) => [item.id, index]))
  let cursor = 0
  const workers = Array.from(
    { length: Math.min(AUTO_SUBMIT_CONCURRENCY, pendingSnap.length) },
    async () => {
      while (true) {
        const itemIndex = cursor++
        if (itemIndex >= pendingSnap.length) return
        const item = pendingSnap[itemIndex]
        const excelIdx = verifiedPositions.get(item.id) ?? -1
        const sess = excelIdx >= 0 ? pool[excelIdx] : undefined
        if (!sess) {
          updateItem(item.id, {
            status: 'failed',
            progressMsg: `Excel 只有 ${pool.length} 条 Session，第 ${excelIdx + 1} 张无对应`,
            error: 'Session 不足',
          })
          continue
        }
        await submitOne(item, { mode: 'session', session: sess.session, imported: sess })
      }
    },
  )
  await Promise.all(workers)
  sessionInput.value = ''
  autoSubmitting.value = false
}

async function exportBatchSuccess() {
  const ok = items.value.filter((i) => i.status === 'success')
  if (!ok.length) {
    sessionError.value = '本批尚无成功记录'
    return
  }
  sessionError.value = ''
  const part = (value: string) => String(value || '').replace(/[\r\n]+/g, ' ').trim()
  try {
    await exportSuccessWorkbook(
      ok.map((i) => [part(i.email), part(i.gptPassword), part(i.emailPassword), part(i.accessToken)]),
    )
  } catch {
    sessionError.value = '导出失败，请重试'
  }
}

function resetAll() {
  stopAllPolls()
  phase.value = 'input'
  items.value = []
  cdkText.value = ''
  mailboxText.value = ''
  mailboxPool.value = []
  sessionPool.value = []
  importMsg.value = ''
  sessionInput.value = ''
  sessionError.value = ''
  autoSubmitting.value = false
  lastFilledItemId.value = null
}

onUnmounted(() => stopAllPolls())
</script>

<style scoped>
.text-good { color: var(--good, #16a34a); }
.text-warn { color: var(--warn, #d97706); }
.text-err { color: var(--err, #dc2626); }
.status-pill[data-st='pending_verify'] { background: var(--soft); color: var(--muted); }
.status-pill[data-st='verify_ok'],
.status-pill[data-st='success'] {
  background: color-mix(in srgb, var(--good, #16a34a) 16%, transparent);
  color: var(--good, #16a34a);
}
.status-pill[data-st='verify_fail'],
.status-pill[data-st='failed'] {
  background: color-mix(in srgb, var(--err, #dc2626) 14%, transparent);
  color: var(--err, #dc2626);
}
.status-pill[data-st='waiting_session'] {
  background: color-mix(in srgb, var(--warn, #d97706) 14%, transparent);
  color: var(--warn, #d97706);
}
.status-pill[data-st='submitting'],
.status-pill[data-st='processing'] {
  background: color-mix(in srgb, var(--primary) 14%, transparent);
  color: var(--primary);
}
</style>
