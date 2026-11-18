<template>
  <div class="adm-page">
    <AdminPageHeader title="CDK 卡密" desc="向卡台购买并生成 CDK，查看、复制、导出本站完整码库" @more="onHeaderMore">
      <el-button :loading="loadingMeta || loadingList" @click="refreshAll">刷新</el-button>
      <el-button type="primary" @click="openIssue">购买并生成</el-button>
      <template #more>
        <el-dropdown-item command="syncUpstream">从卡台同步完整码</el-dropdown-item>
        <el-dropdown-item command="syncCache">同步本机缓存到服务器</el-dropdown-item>
        <el-dropdown-item divided command="copySwap">复制代理换码链接</el-dropdown-item>
        <el-dropdown-item command="openSwap">打开代理换码页</el-dropdown-item>
        <el-dropdown-item divided command="integration">卡台配置</el-dropdown-item>
      </template>
    </AdminPageHeader>

    <!-- 状态条：固定高度，数据到达前用占位，不推挤下方内容 -->
    <div class="adm-strip" :class="{ 'is-error': !!metaError }">
      <span class="adm-strip__item">
        <span class="dot" :class="loadingMeta && !metaLoaded ? 'dot--idle' : configured ? 'dot--good' : 'dot--err'" />
        <template v-if="loadingMeta && !metaLoaded"><span class="sk sk--text" style="width: 64px" /></template>
        <template v-else>{{ configured ? 'API 已配置' : '未配置 Key' }}</template>
      </span>
      <span class="adm-strip__item">
        <span class="adm-strip__k">出口 IP</span>
        <button v-if="egressIp" type="button" class="copyable mono" title="点击复制出口 IP" @click="copyText(egressIp)">{{ egressIp }}</button>
        <span v-else class="sk sk--text" style="width: 96px" />
      </span>
      <span class="adm-strip__item">
        <span class="adm-strip__k">余额</span>
        <b v-if="balanceText" class="mono">{{ balanceText }}</b>
        <span v-else-if="loadingMeta && !metaLoaded" class="sk sk--text" style="width: 56px" />
        <span v-else class="text-subtle">—</span>
      </span>
      <span class="adm-strip__item text-subtle">价格 {{ priceSource }} · v{{ pricingVersion ?? '—' }}</span>
      <span class="adm-strip__grow" />
      <span v-if="metaError" class="adm-strip__err" :class="{ 'adm-strip__err--setup': metaLoaded && !configured }" :title="metaError">{{ metaError }}</span>
      <el-button v-if="metaError" size="small" :loading="loadingMeta" @click="loadMeta">重试</el-button>
      <router-link v-if="metaLoaded && !configured" to="/ops/integration" class="adm-link">去配置 API Key →</router-link>
    </div>

    <section ref="issueEl" class="card !p-0 overflow-hidden issue-card">
      <button type="button" class="fold-head" :aria-expanded="issueOpen" @click="issueOpen = !issueOpen">
        <span class="font-semibold text-ink">购买并生成</span>
        <span class="text-xs text-muted">
          {{ productLabel }} · {{ planLabel(form.plan) }} · {{ form.count }} 张 · ${{ estimatedTotal }}
        </span>
        <span class="fold-caret" :class="{ 'is-open': issueOpen }" aria-hidden="true">⌄</span>
      </button>
      <div v-show="issueOpen" class="issue-body">
        <div class="issue-row">
          <span class="issue-k">{{ t('xPremium.product') }}</span>
          <el-radio-group v-model="directProduct" size="small" :disabled="issuing || loadingMeta" @change="loadMeta">
            <el-radio-button value="gpt">ChatGPT</el-radio-button>
            <el-radio-button value="x">X Premium</el-radio-button>
            <el-radio-button value="grok">Grok</el-radio-button>
            <el-radio-button value="claude">Claude</el-radio-button>
          </el-radio-group>
        </div>
        <div class="issue-row issue-row--top">
          <span class="issue-k">套餐</span>
          <div class="grid gap-2 sm:grid-cols-3 flex-1">
            <button
              v-for="p in planCards"
              :key="p.key"
              type="button"
              class="plan-card-sm"
              :class="{ 'plan-card-sm--on': form.plan === p.key }"
              :aria-pressed="form.plan === p.key"
              @click="selectPlan(p.key)"
            >
              <span class="font-medium">{{ p.label }}</span>
              <span class="mono text-ink">${{ formatUsd(p.service_fee_usd) }}</span>
              <!-- 点数是比索计价：兑换时代理要垫这笔付款，不写出来会被当成只花 $0.10 -->
              <small v-if="p.checkoutText" class="text-xs text-muted">兑换垫付 {{ p.checkoutText }}</small>
            </button>
            <div v-if="!planCards.length" class="text-sm text-muted py-2">
              {{ loadingMeta ? '正在获取可售档位…' : '卡台没有下发可售档位（检查 API Key / 出口 IP 白名单）' }}
            </div>
          </div>
        </div>
        <div class="issue-row">
          <span class="issue-k">数量</span>
          <div class="flex flex-wrap items-center gap-2">
            <el-input-number v-model="form.count" :min="1" :max="ISSUE_MAX" size="small" controls-position="right" class="!w-28" />
            <el-button-group>
              <el-button v-for="n in [1, 10, 50, 100, ISSUE_MAX]" :key="n" size="small" :type="form.count === n ? 'primary' : 'default'" plain @click="form.count = n">{{ n }}</el-button>
            </el-button-group>
          </div>
        </div>
        <div class="issue-row">
          <span class="issue-k">付款地区</span>
          <!-- placeholder 必须显式给：Element Plus 不把空字符串当「已选中」，
               所以未选时不会显示下面那条 value="" 的选项，而是回落到内置英文
               placeholder「Select」——中文界面里突兀，更要命的是「不选就是菲律宾」
               这个信息在下拉展开前完全看不到，操作者会以为自己还没选地区。 -->
          <el-select v-model="form.payment_country" :persistent="false" size="small" style="width: 180px"
                     :placeholder="directProduct === 'x' ? '默认(日本)' : directProduct === 'grok' ? '美国(USD 固定价)' : directProduct === 'claude' ? '美国(USD 固定价)' : '默认(菲律宾)'">
            <el-option v-if="directProduct === 'gpt'" label="默认(菲律宾)" value="" />
            <el-option v-for="r in paymentRegions" :key="r.country"
                       :label="`${regionLabel(r.country)} (${r.currency})`" :value="r.country" />
          </el-select>
        </div>
        <div class="issue-foot">
          <el-checkbox v-model="form.funding_confirmed">确认承担兑换资金</el-checkbox>
          <el-button type="primary" class="issue-buy" :loading="issuing" :disabled="!canIssue" @click="issue">
            {{ issuing ? '购买中…' : `购买 ${form.count} 张 ${planLabel(form.plan)} · $${estimatedTotal}` }}
          </el-button>
        </div>
        <p v-if="isRenewPlan" class="text-xs font-semibold" style="color: var(--err)">⚠️ 续费完成后请联系客户取消自动续费，不取消次月可能会连续扣款</p>
        <p v-if="!configured" class="text-xs" style="color: var(--err)">请先在「卡台配置」填写 Base 与 sk_</p>
        <p v-else-if="!form.funding_confirmed" class="text-xs text-muted">勾选「确认承担兑换资金」后再购买。实付由本账户承担，服务费从卡台余额扣除。</p>
        <div v-if="issueError" class="alert alert-error">{{ issueError }}</div>
        <div v-if="issueOk" class="alert alert-success">{{ issueOk }}</div>
        <div v-if="recentCodes.length" class="recent-box">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="text-sm font-medium" style="color: var(--good)">
              本批 {{ recentCodes.length }} 张
              <span v-if="recentMeta" class="text-xs text-muted font-normal">
                · {{ recentMeta.plan }}
                · {{ recentMeta.region ? regionLabel(recentMeta.region) : '默认(菲律宾)' }}
                · {{ recentMeta.atLabel }}
              </span>
            </div>
            <div class="flex gap-1">
              <el-button size="small" type="primary" @click="copyAll()">复制</el-button>
              <el-button size="small" @click="downloadCodes">导出</el-button>
              <el-button size="small" text type="danger" @click="clearRecent">清除</el-button>
            </div>
          </div>
          <textarea
            class="input mono text-sm !min-h-[88px] w-full"
            readonly
            :value="recentCodes.join('\n')"
            @focus="($event.target as HTMLTextAreaElement).select()"
          />
        </div>
      </div>
    </section>

    <section class="card list-card">
      <div class="list-head">
        <div>
          <h2 class="text-base font-semibold text-ink">CDK 列表</h2>
          <p class="text-xs text-muted mt-0.5 tabular">
            共 {{ total }} 条
            <span v-if="storeStats.fullInStore != null"> · 本站已存 {{ storeStats.fullInStore }}</span>
            <span v-if="listMode === 'upstream' && storeStats.fullOnPage != null"> · 本页完整 {{ storeStats.fullOnPage }}</span>
          </p>
        </div>
        <el-radio-group v-model="listMode" size="small" @change="onListModeChange">
          <el-radio-button value="stored">本站完整码库</el-radio-button>
          <el-radio-button value="upstream">卡台状态列表</el-radio-button>
        </el-radio-group>
      </div>

      <div class="adm-toolbar">
        <el-input
          ref="searchRef"
          v-model="listQ"
          clearable
          class="adm-search"
          data-admin-search
          :placeholder="listMode === 'stored' ? '搜索备注 / 完整码 / ID / 前缀（按 / 聚焦）' : '模糊搜索：ID / 码前缀（按 / 聚焦）'"
          @keyup.enter="searchNow"
          @clear="searchNow"
        />
        <el-select v-model="listStatus" :persistent="false" clearable placeholder="状态" class="!w-[120px]" @change="searchNow">
          <el-option v-for="s in statusOptions" :key="s" :label="statusLabel(s)" :value="s" />
        </el-select>
        <el-select v-model="listPlan" :persistent="false" clearable placeholder="套餐" class="!w-[130px]" @change="searchNow">
          <el-option v-for="k in planKeys" :key="k" :label="planLabel(k)" :value="k" />
        </el-select>
        <span class="flex-1" />
        <el-dropdown :persistent="false" trigger="click" @command="onCopyCommand">
          <el-button>复制 / 导出<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="copyPage" :disabled="!pageFullCodes.length">
                复制本页 ({{ pageFullCodes.length }})
              </el-dropdown-item>
              <el-dropdown-item command="copySelected" :disabled="!selectedFullCodes.length">
                复制选中 ({{ selectedFullCodes.length }})
              </el-dropdown-item>
              <el-dropdown-item command="exportSelected" :disabled="!selectedFullCodes.length">
                导出选中 .txt
              </el-dropdown-item>
              <el-dropdown-item divided command="exportAll" :disabled="!storeStats.fullInStore || exportingAll">
                导出本站全部{{ exportingAll ? '…' : '' }}
              </el-dropdown-item>
              <el-dropdown-item command="copyAllStored" :disabled="!storeStats.fullInStore || exportingAll">
                复制本站全部
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-popover :persistent="false" placement="bottom-end" :width="200" trigger="click">
          <template #reference>
            <el-button aria-label="显示列与密度" title="显示列与密度">列</el-button>
          </template>
          <div class="col-menu">
            <div class="col-menu__title">显示列</div>
            <el-checkbox v-for="c in OPTIONAL_COLS" :key="c.key" :model-value="colVisible[c.key]" @change="(v: any) => setCol(c.key, !!v)">
              {{ c.label }}
            </el-checkbox>
            <div class="col-menu__title mt-2">行高</div>
            <el-radio-group :model-value="density" size="small" @change="(v: any) => setDensity(v)">
              <el-radio-button value="compact">紧凑</el-radio-button>
              <el-radio-button value="default">默认</el-radio-button>
            </el-radio-group>
          </div>
        </el-popover>
        <el-button :loading="loadingList" aria-label="刷新列表" title="刷新列表" @click="loadList">
          <span aria-hidden="true">↻</span>
        </el-button>
      </div>

      <div v-if="activeFilters.length" class="chips">
        <span v-for="f in activeFilters" :key="f.key" class="chip">
          {{ f.label }}
          <button type="button" class="chip__x" :aria-label="`移除筛选 ${f.label}`" @click="removeFilter(f.key)">×</button>
        </span>
        <button type="button" class="adm-link text-xs" @click="resetFilters">重置</button>
      </div>

      <div v-if="listError" class="inline-err">
        <span>{{ listError }}</span>
        <el-button size="small" :loading="loadingList" @click="loadList">重试</el-button>
      </div>

      <div class="tbl-wrap">
        <div class="adm-progress" :class="{ 'is-on': loadingList && listLoaded }" aria-hidden="true" />
        <TableSkeleton v-if="!listLoaded" :rows="Math.min(pageSize, 12)" :row-height="density === 'compact' ? 36 : 40" />
        <div v-else-if="!displayRows.length && !listError" class="empty-state">
          <template v-if="activeFilters.length">
            <div class="empty-state__title">没有符合筛选条件的 CDK</div>
            <div class="empty-state__desc">换个关键字，或清除筛选再看。</div>
            <el-button type="primary" @click="resetFilters">重置筛选</el-button>
          </template>
          <template v-else-if="listMode === 'stored'">
            <div class="empty-state__title">本站尚未存入完整码</div>
            <div class="empty-state__desc">从卡台同步已发出的完整码，或在上方购买发码。</div>
            <div class="flex gap-2 justify-center">
              <el-button type="primary" :loading="syncingUpstream" @click="syncFromCardplatform()">从卡台同步完整码</el-button>
              <el-button @click="openIssue">购买并生成</el-button>
            </div>
          </template>
          <template v-else>
            <div class="empty-state__title">卡台暂无 CDK</div>
            <div class="empty-state__desc">卡台状态列表为空，或 API Key 尚未配置。</div>
            <el-button type="primary" @click="openIssue">购买并生成</el-button>
          </template>
        </div>
        <el-table
          v-else
          ref="tableRef"
          :data="displayRows"
          :class="['adm-table', `is-${density}`]"
          :max-height="tableMaxHeight"
          stripe
          row-key="rowKey"
          :default-sort="{ prop: 'created_at', order: 'descending' }"
          @selection-change="onSelectionChange"
        >
          <el-table-column type="selection" width="44" fixed="left" :selectable="rowSelectable" reserve-selection />
          <el-table-column prop="id" label="ID" width="84" fixed="left" sortable :sort-method="sortById">
            <template #default="{ row }"><span class="mono">{{ row.id ?? '—' }}</span></template>
          </el-table-column>
          <el-table-column label="卡密" min-width="230">
            <template #default="{ row }">
              <button
                type="button"
                class="code-cell"
                :title="row.fullCode ? '点击复制完整码' : '仅有前缀（请切换到「本站完整码库」或重新发码）'"
                @click="copyRowCode(row)"
              >
                <span class="code-cell__text mono" :class="row.fullCode ? 'is-full' : 'is-prefix'">{{ row.displayCode || '—' }}</span>
                <span v-if="!row.fullCode" class="badge">仅前缀</span>
                <span class="code-cell__copy" aria-hidden="true">复制</span>
              </button>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="92">
            <template #default="{ row }">
              <span class="badge" :class="`badge--${statusType(row.status)}`">{{ statusLabel(row.status) }}</span>
            </template>
          </el-table-column>
          <el-table-column v-if="colVisible.plan" prop="plan" label="套餐" min-width="100">
            <template #default="{ row }"><span class="cell-ellipsis">{{ planLabel(row.plan) }}</span></template>
          </el-table-column>
          <el-table-column v-if="colVisible.region" label="区域" min-width="110">
            <template #default="{ row }">
              <span class="cell-ellipsis" :class="row.payment_country == null ? 'text-muted' : ''">{{ cdkRegionLabel(row.payment_country) }}</span>
            </template>
          </el-table-column>
          <el-table-column v-if="colVisible.fee" prop="fee_amount_minor" label="服务费" width="96" align="right" sortable :sort-method="sortByFee">
            <template #default="{ row }">
              <span class="mono">${{ ((row.fee_amount_minor || 0) / 100).toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column v-if="colVisible.note" label="备注" min-width="100">
            <template #default="{ row }">
              <button type="button" class="note-cell" :title="row.note ? `${row.note}（点击编辑）` : '点击添加备注'" @click="editNoteOne(row)">
                <span v-if="row.note" class="note-cell__text">{{ row.note }}</span>
                <span v-else class="note-cell__empty">添加备注…</span>
              </button>
            </template>
          </el-table-column>
          <el-table-column v-if="colVisible.created" prop="created_at" label="创建时间" width="184" sortable>
            <template #default="{ row }"><span class="mono text-muted nowrap">{{ row.created_at || '—' }}</span></template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right" align="right">
            <!-- 行内操作最多 3 个，直接平铺成文字按钮：原来每行一个 el-dropdown，
                 每个都常驻一个弹层 DOM（200 行 = 200 个 popper），切到每页 200 条要卡 1 秒多。 -->
            <template #default="{ row }">
              <span class="row-acts">
                <button type="button" class="row-act" :disabled="!row.fullCode" @click="onRowCommand('copy', row)">复制</button>
                <button type="button" class="row-act" :disabled="!row.id" @click="onRowCommand('note', row)">备注</button>
                <button v-if="canDisableRow(row)" type="button" class="row-act row-act--danger" @click="onRowCommand('disable', row)">禁用</button>
                <button v-else-if="canEnableRow(row)" type="button" class="row-act" @click="onRowCommand('enable', row)">解禁</button>
                <!-- 占位：没有第三个操作时也留出位置，各行「复制 / 备注」上下对齐 -->
                <span v-else class="row-act row-act--ph" aria-hidden="true">禁用</span>
              </span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="list-foot">
        <span class="text-xs text-subtle">{{ listMode === 'stored' ? '本站完整码库' : '卡台状态' }} · 第 {{ page }} 页 · 排序作用于本页</span>
        <el-pagination
          background
          layout="total, sizes, prev, pager, next"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          :page-sizes="[20, 50, 100, 200]"
          :disabled="loadingList && !listLoaded"
          @current-change="(p: number) => { page = p; loadList() }"
          @size-change="(s: number) => { pageSize = s; page = 1; loadList() }"
        />
      </div>
    </section>

    <!-- 选中后浮出的批量操作条 -->
    <transition name="bulk">
      <div v-if="selectedRows.length" class="bulk-bar" role="toolbar" aria-label="批量操作">
        <span class="bulk-bar__count">已选 <b>{{ selectedRows.length }}</b> 项</span>
        <el-button size="small" type="primary" :disabled="!selectedFullCodes.length" @click="copySelectedFull">复制 ({{ selectedFullCodes.length }})</el-button>
        <el-button size="small" :disabled="!selectedFullCodes.length" @click="exportSelectedFull">导出</el-button>
        <el-button size="small" :disabled="!selectedNoteIds.length" :loading="noting" @click="batchSetNoteSelected">备注</el-button>
        <el-button size="small" :disabled="!selectedHasNoteIds.length || noting" @click="batchClearNoteSelected">去除备注</el-button>
        <el-button size="small" :disabled="!selectedEnableableIds.length || disabling" @click="batchEnableSelected">解除禁用 ({{ selectedEnableableIds.length }})</el-button>
        <el-button size="small" type="danger" plain :disabled="!selectedDisableableIds.length" :loading="disabling" @click="batchDisableSelected">禁用 ({{ selectedDisableableIds.length }})</el-button>
        <button type="button" class="bulk-bar__x" aria-label="取消选择" title="取消选择" @click="clearSelection">×</button>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authFetch } from '../../lib/api'
import AdminPageHeader from '../../components/admin/AdminPageHeader.vue'
import TableSkeleton from '../../components/admin/TableSkeleton.vue'
import { readPref, setTableDensity, tableDensity, writePref, type TableDensity } from '../../lib/admin-prefs'
import { dialog } from '../../lib/dialog'
import { copyToClipboard } from '../../lib/clipboard'
import { isCardAttachPlan } from '../../lib/plan'

const RECENT_KEY = 'cdk_recent_issued_v1'
/** 浏览器兜底缓存（历史本机数据）；主存储已改为服务器 SQLite */
const CODE_CACHE_KEY = 'cdk_full_code_cache_v1'
/** 卡台完整码形如 GPTD-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxx（约 43 字符） */
const FULL_CODE_MIN_LEN = 20
const ISSUE_MAX = 200
/** 代理换码隐藏页（完整 URL，便于复制发给代理） */
const agentSwapUrl =
  typeof window !== 'undefined' ? `${window.location.origin}/partner/swap` : '/partner/swap'

type CodeCacheEntry = { code: string; plan?: string; prefix?: string; at?: number; id?: number }
/** id -> entry；prefix -> entry（仅作兜底 / 回填服务器） */
// shallowRef：缓存可能上万条，深层响应式会让每次查表都走代理、并把每个键都登记成依赖。
// 只整体替换，从不原地改。
const codeCache = shallowRef<Record<string, CodeCacheEntry>>({})
const storeStats = reactive({ fullOnPage: null as number | null, fullInStore: null as number | null })
const syncingCache = ref(false)
const syncingUpstream = ref(false)
const exportingAll = ref(false)
const disabling = ref(false)
const noting = ref(false)
/** stored = 本站完整码库（默认可复制导出）；upstream = 卡台状态列表 */
const listMode = ref<'stored' | 'upstream'>('stored')
const selectedRows = ref<any[]>([])
const tableRef = ref<any>(null)
const issueOpen = ref(false)
const issueEl = ref<HTMLElement | null>(null)
/** 首次数据是否已到：之前显示骨架/占位，之后刷新只显示顶部细进度条、保留旧数据 */
const metaLoaded = ref(false)
const listLoaded = ref(false)

const directProduct = ref('gpt')
const productLabel = computed(() => PRODUCT_LABELS[directProduct.value] || directProduct.value)
const plans = ref<Record<string, any>>({})
const pricingVersion = ref<number | null>(null)
const priceSource = ref('—')
const balanceText = ref('')
const egressIp = ref('')
const metaError = ref('')
const loadingMeta = ref(false)
const configured = ref(false)

const form = reactive({
  plan: 'plus',
  count: 1,
  funding_confirmed: false,
  // 空 = 菲律宾（存量行为）。空和 'PH' 在这里是两件事，界面上也分开显示：
  // 将来卡台若改默认地区，「没指定」和「明确指定了 PH」该走不同的路。
  payment_country: '',
})
// ★地区清单只认卡台下发的 payment_regions★，本站不写死。
// 写死的那份和卡台的校验表迟早不一致，而不一致时两边都不报错：
// 多出来的地区发码被拒，少了的地区卡台支持了却选不到。
const paymentRegions = ref<Array<{ country: string; currency: string }>>([])
const REGION_NAMES: Record<string, string> = {
  PH: '菲律宾', US: '美国', JP: '日本', CL: '智利', EG: '埃及', IN: '印度', KR: '韩国', NG: '尼日利亚', TR: '土耳其',
}
// 没收录的国家码原样显示——比显示空白好，新地区不必等这份表补齐就能用。
function regionLabel(code: string): string {
  return REGION_NAMES[code] || code
}
function cdkRegionLabel(country: unknown): string {
  if (country == null) return '待同步'
  const code = String(country).trim().toUpperCase()
  if (!code) return '默认（菲律宾）'
  const name = regionLabel(code)
  return name === code ? code : `${name} (${code})`
}
const issuing = ref(false)
const issueError = ref('')
const issueOk = ref('')
const recentCodes = ref<string[]>([])
// region 一并记下来：整批码是复制出去卖的，事后只能从这条横幅确认
// 「刚买的这 200 张到底是哪个区的」——码文本身看不出地区。
const recentMeta = ref<{ plan: string; atLabel: string; region: string } | null>(null)

// shallowRef：每页最多 200 行 × 20 来个字段，没必要给每个字段建响应式代理；只整体替换
const rows = shallowRef<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loadingList = ref(false)
const listError = ref('')
const listQ = ref('')
const listStatus = ref('')
const listPlan = ref('')
const statusOptions = ['unused', 'reserved', 'consumed', 'frozen', 'disabled', 'review']

// ── 筛选同步到地址栏：刷新/分享链接后筛选还在 ──
const route = useRoute()
const router = useRouter()
const PAGE_SIZES = [20, 50, 100, 200]
function readQuery() {
  const q = route.query
  if (typeof q.q === 'string') listQ.value = q.q
  if (typeof q.status === 'string' && statusOptions.includes(q.status)) listStatus.value = q.status
  if (typeof q.plan === 'string') listPlan.value = q.plan
  if (q.mode === 'upstream') listMode.value = 'upstream'
  const pg = Number(q.page)
  if (Number.isInteger(pg) && pg > 1) page.value = pg
  const sz = Number(q.size)
  if (PAGE_SIZES.includes(sz)) pageSize.value = sz
}
function writeQuery() {
  const query: Record<string, string> = {}
  if (listQ.value.trim()) query.q = listQ.value.trim()
  if (listStatus.value) query.status = listStatus.value
  if (listPlan.value) query.plan = listPlan.value
  if (listMode.value !== 'stored') query.mode = listMode.value
  if (page.value > 1) query.page = String(page.value)
  if (pageSize.value !== 20) query.size = String(pageSize.value)
  const cur = route.query
  const same = Object.keys(query).length === Object.keys(cur).length && Object.entries(query).every(([k, v]) => cur[k] === v)
  if (!same) router.replace({ query }).catch(() => { /* 导航被新导航取代 */ })
}
readQuery()

// ── 搜索防抖：停止输入 300ms 后查询；回车/清空/改下拉立即查 ──
let appliedQ = listQ.value.trim()
let qTimer: number | undefined
watch(listQ, () => {
  window.clearTimeout(qTimer)
  qTimer = window.setTimeout(() => {
    if (listQ.value.trim() !== appliedQ) searchList()
  }, 300)
})
function searchNow() {
  window.clearTimeout(qTimer)
  return searchList()
}
onBeforeUnmount(() => {
  window.clearTimeout(qTimer)
  listAbort?.abort()
})

const activeFilters = computed(() => {
  const out: { key: 'q' | 'status' | 'plan'; label: string }[] = []
  if (listQ.value.trim()) out.push({ key: 'q', label: `搜索：${listQ.value.trim()}` })
  if (listStatus.value) out.push({ key: 'status', label: `状态：${statusLabel(listStatus.value)}` })
  if (listPlan.value) out.push({ key: 'plan', label: `套餐：${planLabel(listPlan.value)}` })
  return out
})
function removeFilter(key: 'q' | 'status' | 'plan') {
  if (key === 'q') listQ.value = ''
  if (key === 'status') listStatus.value = ''
  if (key === 'plan') listPlan.value = ''
  searchNow()
}
function resetFilters() {
  listQ.value = ''
  listStatus.value = ''
  listPlan.value = ''
  searchNow()
}

// ── 列显示 / 行高（本机偏好）──
const OPTIONAL_COLS = [
  { key: 'plan', label: '套餐' },
  { key: 'region', label: '区域' },
  { key: 'fee', label: '服务费' },
  { key: 'note', label: '备注' },
  { key: 'created', label: '创建时间' },
] as const
type ColKey = typeof OPTIONAL_COLS[number]['key']
const COLS_KEY = 'cdk-admin-cols-v1'
const colVisible = reactive<Record<ColKey, boolean>>(
  readPref(COLS_KEY, { plan: true, region: true, fee: true, note: true, created: true }),
)
function setCol(key: ColKey, v: boolean) {
  colVisible[key] = v
  writePref(COLS_KEY, { ...colVisible })
}
const density = tableDensity
function setDensity(v: TableDensity) {
  setTableDensity(v)
}

// 表头吸顶：表格自带纵向滚动，高度跟视口走
const viewportH = ref(typeof window !== 'undefined' ? window.innerHeight : 900)
function onResize() { viewportH.value = window.innerHeight }
onMounted(() => window.addEventListener('resize', onResize, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
const tableMaxHeight = computed(() => Math.max(420, viewportH.value - 150))

// 本页排序（卡台/本站接口没有排序参数，排序只作用于当前页）
function sortById(a: any, b: any) { return (Number(a.id) || 0) - (Number(b.id) || 0) }
function sortByFee(a: any, b: any) { return (Number(a.fee_amount_minor) || 0) - (Number(b.fee_amount_minor) || 0) }

const PRODUCT_LABELS: Record<string, string> = { gpt: 'ChatGPT', x: 'X Premium', grok: 'Grok', claude: 'Claude' }

// 档位清单、展示顺序、能不能卖，全部由服务端下发的 registry 决定。
// ★代理侧不再维护任何档位清单，也不再自己判断可见性★
// 写死清单的代价见过一次：卡台开了 Codex 点数，代理明明能发码却在界面上看不到。
// 自己判可见性的代价也见过一次（2026-08-22 线上）：Claude 档位混进来还能发码——
// 它在 ACC 定价表里 enabled=true，但我们根本没有 Claude 兑换流程。
// 服务端已按「卡台注册表 ∩ ACC 定价开关」过滤，这里直接用，不要再加回落分支。
const planRegistry = ref<any[]>([])
const planKeys = computed(() => planRegistry.value.map((r: any) => r.key))
function planMeta(k: string) {
  return planRegistry.value.find((r: any) => r.key === k) || null
}

// 点数档真正要垫的是比索付款，$0.10 只是我们的服务费。
// 只显示服务费的话，代理会把一张 ₱2260 的码当成一毛钱的东西发出去。
function checkoutText(meta: any): string {
  if (!meta?.checkout_amount_minor) return ''
  const cur = meta.checkout_currency || 'PHP'
  const amount = (Number(meta.checkout_amount_minor) / 100).toFixed(2)
  return `${cur} ${amount}`
}

const planCards = computed(() =>
  planRegistry.value.map((meta: any) => ({
    key: meta.key,
    label: meta.label || meta.key,
    enabled: true, // 服务端只下发可卖档位
    service_fee_usd: meta.service_fee_usd ?? null,
    serviceFeeUsdMinor: meta.serviceFeeUsdMinor,
    isCredit: !!meta.is_credit,
    checkoutText: checkoutText(meta),
    requiresActiveSubscription: !!meta.requires_active_subscription,
  })),
)

// 绑卡档(Pro 20x 续费):生成这种 CDK 要提醒代理，续费后让客户取消自动续费。
const isRenewPlan = computed(() => isCardAttachPlan(form.plan, planMeta(form.plan)?.flow))

const canIssue = computed(() =>
  configured.value && form.funding_confirmed && form.count >= 1 && form.count <= ISSUE_MAX && !issuing.value &&
  // 选中的档位必须在可卖清单里：默认值 plus 也可能被卡台/ACC 关掉，
  // 不判的话按钮是亮的、点下去被后端 400 挡回来。
  planKeys.value.includes(form.plan),
)

// 可卖清单变了（首次加载 / 卡台改了配置）就把选中项收回到清单内。
watch(planKeys, (keys) => {
  if (keys.length && !keys.includes(form.plan)) form.plan = keys[0]
})

/** 列表行：合并服务器 full_code + 本机兜底缓存 */
const displayRows = computed(() =>
  rows.value.map((row, idx) => {
    const full = lookupFullCode(row)
    const id = row.id != null ? String(row.id) : `i${idx}`
    return {
      ...row,
      rowKey: `${listMode.value}-${id}-${String(row.code_prefix || row.code || idx)}`,
      fullCode: full,
      displayCode: full || String(row.code_prefix || row.code || '').trim() || '',
    }
  }),
)

async function openIssue() {
  issueOpen.value = true
  await nextTick()
  issueEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function onHeaderMore(cmd: string) {
  if (cmd === 'syncUpstream') return syncFromCardplatform()
  if (cmd === 'syncCache') return syncLocalCacheToServer()
  if (cmd === 'copySwap') return copyText(agentSwapUrl)
  if (cmd === 'openSwap') return openAgentSwap()
  if (cmd === 'integration') return router.push('/ops/integration')
}

const pageFullCodes = computed(() =>
  displayRows.value.map((r) => String(r.fullCode || '').trim()).filter((c) => isFullCode(c)),
)
const selectedFullCodes = computed(() =>
  selectedRows.value.map((r) => String(r.fullCode || lookupFullCode(r) || '').trim()).filter((c) => isFullCode(c)),
)

/** 可禁用：有 id 且状态为 unused */
function canDisableRow(row: any) {
  const id = Number(row?.id)
  if (!Number.isFinite(id) || id <= 0) return false
  const st = String(row?.status || 'unused').toLowerCase()
  return st === 'unused' || st === ''
}
/** 可解除禁用：status=disabled */
function canEnableRow(row: any) {
  const id = Number(row?.id)
  if (!Number.isFinite(id) || id <= 0) return false
  return String(row?.status || '').toLowerCase() === 'disabled'
}
const selectedDisableableIds = computed(() => {
  const ids: number[] = []
  const seen = new Set<number>()
  for (const r of selectedRows.value) {
    if (!canDisableRow(r)) continue
    const id = Number(r.id)
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
})
const selectedEnableableIds = computed(() => {
  const ids: number[] = []
  const seen = new Set<number>()
  for (const r of selectedRows.value) {
    if (!canEnableRow(r)) continue
    const id = Number(r.id)
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
})

function rowSelectable(row: any) {
  const id = Number(row?.id)
  return !!row?.fullCode || canDisableRow(row) || canEnableRow(row) || (Number.isFinite(id) && id > 0)
}
function onSelectionChange(rowsSel: any[]) {
  selectedRows.value = Array.isArray(rowsSel) ? rowsSel : []
}
function clearSelection() {
  selectedRows.value = []
  tableRef.value?.clearSelection?.()
}
function onListModeChange() {
  page.value = 1
  clearSelection()
  loadList()
}

function onCopyCommand(cmd: string) {
  if (cmd === 'copySelected') return copySelectedFull()
  if (cmd === 'exportSelected') return exportSelectedFull()
  if (cmd === 'copyPage') return copyPageFull()
  if (cmd === 'exportAll') return exportAllStored()
  if (cmd === 'copyAllStored') return copyAllStored()
}

function onRowCommand(cmd: string, row: any) {
  if (cmd === 'copy') return copyRowCode(row)
  if (cmd === 'note') return editNoteOne(row)
  if (cmd === 'disable') return disableOne(row)
  if (cmd === 'enable') return enableOne(row)
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text.endsWith('\n') ? text : text + '\n'], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

async function copyCodes(codes: string[], label: string) {
  if (!codes.length) {
    dialog.toast('没有可复制的完整码', 'warn')
    return
  }
  const ok = await copyToClipboard(codes.join('\n'))
  dialog.toast(ok ? `已复制 ${codes.length} 张${label}` : '复制失败，请导出 .txt 后打开', ok ? 'ok' : 'err')
}

async function copySelectedFull() {
  await copyCodes(selectedFullCodes.value, '完整码（选中）')
}
async function copyPageFull() {
  await copyCodes(pageFullCodes.value, '完整码（本页）')
}
function exportSelectedFull() {
  const codes = selectedFullCodes.value
  if (!codes.length) {
    dialog.toast('请先勾选带「完整」标签的行', 'warn')
    return
  }
  downloadText(`cdk-selected-${codes.length}-${Date.now()}.txt`, codes.join('\n'))
  dialog.toast(`已导出 ${codes.length} 张`, 'ok')
}

async function fetchAllStoredCodes(): Promise<string[]> {
  const qs = new URLSearchParams({ limit: '10000' })
  if (listPlan.value) qs.set('plan', listPlan.value)
  if (listQ.value.trim()) qs.set('q', listQ.value.trim())
  const r = await authFetch(`/api/v1/admin/cardplatform/cdks/stored?${qs.toString()}`)
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || d.msg || '拉取本站完整码失败')
  const list = Array.isArray(d.list) ? d.list : []
  const codes: string[] = []
  const seen = new Set<string>()
  for (const it of list) {
    const c = extractFullCode(it) || String(it?.code || '').trim()
    if (!isFullCode(c) || seen.has(c)) continue
    seen.add(c)
    codes.push(c)
  }
  if (d.full_code_in_store != null) storeStats.fullInStore = Number(d.full_code_in_store)
  return codes
}

async function copyAllStored() {
  exportingAll.value = true
  try {
    const codes = await fetchAllStoredCodes()
    await copyCodes(codes, '完整码（本站全部）')
  } catch (e: any) {
    dialog.toast(e?.message || '复制失败', 'err')
  } finally {
    exportingAll.value = false
  }
}

async function exportAllStored() {
  exportingAll.value = true
  try {
    // 优先走后端 txt 附件（更省内存）
    const qs = new URLSearchParams({ format: 'txt', limit: '10000' })
    if (listPlan.value) qs.set('plan', listPlan.value)
    if (listQ.value.trim()) qs.set('q', listQ.value.trim())
    const r = await authFetch(`/api/v1/admin/cardplatform/cdks/stored?${qs.toString()}`)
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      throw new Error(d.error || d.msg || '导出失败')
    }
    const text = await r.text()
    const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    if (!lines.length) {
      dialog.toast('本站没有可导出的完整码', 'warn')
      return
    }
    downloadText(`cdk-stored-all-${lines.length}-${Date.now()}.txt`, lines.join('\n'))
    dialog.toast(`已导出 ${lines.length} 张完整码`, 'ok')
  } catch (e: any) {
    dialog.toast(e?.message || '导出失败', 'err')
  } finally {
    exportingAll.value = false
  }
}

async function disableOne(row: any) {
  const id = Number(row?.id)
  if (!canDisableRow(row) || !id) {
    dialog.toast('只能禁用未使用(unused)的 CDK', 'warn')
    return
  }
  const ok = await dialog.confirm(`确定禁用 ID ${id}？禁用后不可兑换（不退服务费）。`, {
    title: '禁用 CDK',
    okText: '禁用',
    danger: true,
  })
  if (!ok) return
  disabling.value = true
  try {
    const r = await authFetch(`/api/v1/admin/cardplatform/cdks/${id}/disable`, { method: 'POST', body: '{}' })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      dialog.toast(d.error || d.msg || '禁用失败', 'err')
      return
    }
    dialog.toast(`已禁用 #${id}`, 'ok')
    await loadList()
  } finally {
    disabling.value = false
  }
}

async function batchDisableSelected() {
  const ids = selectedDisableableIds.value
  if (!ids.length) {
    dialog.toast('请勾选可禁用的 CDK（unused）', 'warn')
    return
  }
  const ok = await dialog.confirm(
    `将禁用 ${ids.length} 张未使用 CDK，禁用后不可兑换（不退服务费，可再「解除禁用」）。确定？`,
    { title: '批量禁用', okText: '批量禁用', danger: true },
  )
  if (!ok) return
  disabling.value = true
  try {
    const r = await authFetch('/api/v1/admin/cardplatform/cdks/batch-disable', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      dialog.toast(d.error || d.msg || '批量禁用失败', 'err')
      return
    }
    const nOk = Number(d.disabled_count) || (Array.isArray(d.disabled) ? d.disabled.length : 0)
    const nFail = Number(d.failed_count) || (Array.isArray(d.failed) ? d.failed.length : 0)
    dialog.toast(`禁用完成：成功 ${nOk}，失败 ${nFail}`, nFail ? 'warn' : 'ok')
    await loadList()
  } finally {
    disabling.value = false
  }
}

async function enableOne(row: any) {
  const id = Number(row?.id)
  if (!canEnableRow(row) || !id) {
    dialog.toast('只能对「已禁用」的 CDK 解除禁用', 'warn')
    return
  }
  const ok = await dialog.confirm(`确定解除禁用 ID ${id}？解除后恢复为未使用，可再次兑换。`, {
    title: '解除禁用',
    okText: '解除禁用',
  })
  if (!ok) return
  disabling.value = true
  try {
    const r = await authFetch(`/api/v1/admin/cardplatform/cdks/${id}/enable`, { method: 'POST', body: '{}' })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      dialog.toast(d.error || d.msg || '解除失败', 'err')
      return
    }
    dialog.toast(`已解除禁用 #${id}`, 'ok')
    await loadList()
  } finally {
    disabling.value = false
  }
}

async function batchEnableSelected() {
  const ids = selectedEnableableIds.value
  if (!ids.length) {
    dialog.toast('请勾选「已禁用」的 CDK', 'warn')
    return
  }
  const ok = await dialog.confirm(
    `将解除禁用 ${ids.length} 张 CDK，恢复为未使用。确定？`,
    { title: '批量解除禁用', okText: '解除禁用' },
  )
  if (!ok) return
  disabling.value = true
  try {
    const r = await authFetch('/api/v1/admin/cardplatform/cdks/batch-enable', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      dialog.toast(d.error || d.msg || '批量解除失败', 'err')
      return
    }
    const nOk = Number(d.enabled_count) || (Array.isArray(d.enabled) ? d.enabled.length : 0)
    const nFail = Number(d.failed_count) || (Array.isArray(d.failed) ? d.failed.length : 0)
    dialog.toast(`解除完成：成功 ${nOk}，失败 ${nFail}`, nFail ? 'warn' : 'ok')
    await loadList()
  } finally {
    disabling.value = false
  }
}


const selectedNoteIds = computed(() => {
  const ids: number[] = []
  const seen = new Set<number>()
  for (const r of selectedRows.value) {
    const id = Number(r?.id)
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
})
const selectedHasNoteIds = computed(() => {
  const ids: number[] = []
  const seen = new Set<number>()
  for (const r of selectedRows.value) {
    const id = Number(r?.id)
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue
    if (!String(r?.note || '').trim()) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
})

async function editNoteOne(row: any) {
  const id = Number(row?.id)
  if (!Number.isFinite(id) || id <= 0) {
    dialog.toast('缺少 CDK ID，无法备注', 'warn')
    return
  }
  const cur = String(row?.note || '')
  const next = await dialog.prompt('为该 CDK 填写备注（留空并确定可清空）', {
    title: `备注 #${id}`,
    defaultValue: cur,
    placeholder: '最多 200 字，例如批次/客户/用途',
    okText: '保存',
  })
  if (next === null || next === undefined) return
  noting.value = true
  try {
    const r = await authFetch(`/api/v1/admin/cardplatform/cdks/${id}/note`, {
      method: 'PUT',
      body: JSON.stringify({ note: String(next) }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      dialog.toast(d.error || d.msg || '保存备注失败', 'err')
      return
    }
    const note = String(d.note || '').trim()
    // 本地立刻反映
    row.note = note
    rows.value = rows.value.map((it) => (Number(it?.id) === id ? { ...it, note } : it))
    dialog.toast(note ? '备注已保存' : '备注已清空', 'ok')
  } finally {
    noting.value = false
  }
}

async function batchSetNoteSelected() {
  const ids = selectedNoteIds.value
  if (!ids.length) {
    dialog.toast('请先勾选要备注的 CDK', 'warn')
    return
  }
  const next = await dialog.prompt(`为选中的 ${ids.length} 张 CDK 设置同一备注`, {
    title: '批量备注',
    defaultValue: '',
    placeholder: '最多 200 字；若要清空请用「批量去除备注」',
    okText: '写入备注',
  })
  if (next === null || next === undefined) return
  const note = String(next).trim()
  if (!note) {
    dialog.toast('备注为空：请用「批量去除备注」清空，或填写内容后再提交', 'warn')
    return
  }
  noting.value = true
  try {
    const r = await authFetch('/api/v1/admin/cardplatform/cdks/batch-note', {
      method: 'POST',
      body: JSON.stringify({ ids, note }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      dialog.toast(d.error || d.msg || '批量备注失败', 'err')
      return
    }
    const nOk = Number(d.updated_count) || 0
    const nFail = Number(d.failed_count) || 0
    dialog.toast(`批量备注完成：成功 ${nOk}，失败 ${nFail}`, nFail ? 'warn' : 'ok')
    await loadList()
  } finally {
    noting.value = false
  }
}

async function batchClearNoteSelected() {
  const ids = selectedHasNoteIds.value.length
    ? selectedHasNoteIds.value
    : selectedNoteIds.value
  if (!ids.length) {
    dialog.toast('请先勾选要去除备注的 CDK', 'warn')
    return
  }
  const ok = await dialog.confirm(
    `将清除选中 ${ids.length} 张 CDK 的备注，确定？`,
    { title: '批量去除备注', okText: '清除备注', danger: true },
  )
  if (!ok) return
  noting.value = true
  try {
    const r = await authFetch('/api/v1/admin/cardplatform/cdks/batch-clear-note', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      dialog.toast(d.error || d.msg || '批量清除失败', 'err')
      return
    }
    dialog.toast(`已清除 ${d.cleared_count ?? ids.length} 条备注`, 'ok')
    await loadList()
  } finally {
    noting.value = false
  }
}

// ★服务费只认卡台下发的值，猜不到就显示「—」★
// 原实现对任何未知档位一律返回 10：Codex 点数实际是 $0.10，
// 会被显示成 $10（差 100 倍），代理按这个数字定价就直接亏钱。
function feeDefault(_k: string): number | null {
  return null
}
function feeOf(k: string) {
  const p = plans.value[k]
  if (p?.service_fee_usd != null) return Number(p.service_fee_usd).toFixed(2)
  if (p?.serviceFeeUsdMinor != null) return (p.serviceFeeUsdMinor / 100).toFixed(2)
  return '—'
}
function formatUsd(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : '—'
}
function planLabel(k: string) {
  // 文案以卡台注册表为准，其次是定价配置里的 label，最后退回裸键。
  // ★不要在代理侧维护档位文案★——卡台改名或加档，这里会立刻不一致。
  return planMeta(k)?.label || plans.value[k]?.label || k
}
const estimatedTotal = computed(() => {
  // 服务费拿不到时 feeOf 返回「—」，Number('—') 是 NaN，
  // 按钮上会显示「购买 3 张 · $NaN」。宁可显示「—」也不要给代理看一个假数字。
  const unit = Number(feeOf(form.plan))
  if (!Number.isFinite(unit)) return '—'
  const c = Math.max(1, Math.min(ISSUE_MAX, form.count || 1))
  return (unit * c).toFixed(2)
})

function selectPlan(k: string) {
  form.plan = k
}
function statusType(s: string) {
  const st = String(s || '').toLowerCase()
  if (st === 'unused' || st === '') return 'success'
  if (st === 'consumed') return 'info'
  if (st === 'reserved' || st === 'review') return 'warning'
  if (st === 'frozen') return 'warning'
  if (st === 'disabled') return 'danger'
  return 'info'
}
function statusLabel(s: string) {
  const st = String(s || '').toLowerCase()
  const map: Record<string, string> = {
    unused: '未使用',
    reserved: '预留中',
    consumed: '已消耗',
    frozen: '已冻结',
    disabled: '已禁用',
    review: '待审核',
  }
  if (!st) return '未使用'
  return map[st] || st
}

function isFullCode(code: string) {
  const c = String(code || '').trim()
  // 完整码至少 20 字符；前缀一般 ≤14
  return c.length >= FULL_CODE_MIN_LEN && c.includes('-')
}

function extractFullCode(item: any): string {
  if (!item || typeof item !== 'object') return ''
  const candidates = [item.full_code, item.fullCode, item.code, item.cdk_code, item.value]
  for (const raw of candidates) {
    const s = String(raw || '').trim()
    if (isFullCode(s)) return s
  }
  return ''
}

function loadCodeCache() {
  try {
    const raw = localStorage.getItem(CODE_CACHE_KEY)
    if (!raw) return
    const o = JSON.parse(raw)
    if (o && typeof o === 'object') codeCache.value = o
  } catch {
    /* ignore */
  }
}

function saveCodeCache() {
  try {
    localStorage.setItem(CODE_CACHE_KEY, JSON.stringify(codeCache.value))
  } catch {
    /* ignore quota */
  }
}

function rememberIssued(items: any[], plan: string) {
  // 每次翻页都会调用：已在缓存里的码不再复制整份对象、也不再整份写 localStorage
  const cur = codeCache.value
  if (!items.some((it) => { const c = extractFullCode(it); return c && !cur[`code:${c}`] })) return
  const next = { ...cur }
  for (const it of items) {
    const code = extractFullCode(it)
    if (!code) continue
    const id = it?.id != null ? String(it.id) : ''
    const prefix = String(it?.code_prefix || code.slice(0, 14) || '').trim()
    const entry: CodeCacheEntry = {
      code,
      plan: String(it?.plan || plan || ''),
      prefix,
      at: Date.now(),
      id: it?.id != null ? Number(it.id) : undefined,
    }
    if (id) next[`id:${id}`] = entry
    if (prefix) next[`pfx:${prefix}`] = entry
    next[`code:${code}`] = entry
  }
  codeCache.value = next
  saveCodeCache()
}

function lookupFullCode(row: any): string {
  if (!row) return ''
  // 优先服务器列表补全的 full_code / code
  const direct = extractFullCode(row)
  if (direct) return direct
  // 兜底：浏览器旧缓存（历史未落库的码）
  const id = row.id != null ? String(row.id) : ''
  const prefix = String(row.code_prefix || '').trim()
  const cache = codeCache.value
  if (id && cache[`id:${id}`]?.code) return cache[`id:${id}`].code
  if (prefix && cache[`pfx:${prefix}`]?.code) return cache[`pfx:${prefix}`].code
  if (prefix) {
    for (const v of Object.values(cache)) {
      if (v?.code && v.code.startsWith(prefix)) return v.code
    }
  }
  return ''
}

/** 把本机完整码缓存上传到服务器 SQLite，解决换浏览器/清缓存丢码 */
async function syncLocalCacheToServer(opts?: { quiet?: boolean }) {
  const quiet = !!opts?.quiet
  const items: { id: number; code: string; code_prefix?: string; plan?: string }[] = []
  const seen = new Set<string>()
  for (const v of Object.values(codeCache.value)) {
    const code = String(v?.code || '').trim()
    if (!isFullCode(code) || seen.has(code)) continue
    seen.add(code)
    items.push({
      id: Number(v?.id) || 0,
      code,
      code_prefix: v?.prefix || code.slice(0, 14),
      plan: v?.plan || '',
    })
  }
  if (!items.length) {
    if (!quiet) dialog.toast('本机没有可同步的完整码缓存', 'info')
    return
  }
  syncingCache.value = true
  try {
    const r = await authFetch('/api/v1/admin/cardplatform/cdks/store', {
      method: 'POST',
      body: JSON.stringify({ items }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      if (!quiet) dialog.toast(d.error || '同步失败', 'err')
      return
    }
    const saved = Number(d.saved) || 0
    if (!quiet || saved > 0) {
      dialog.toast(`已同步到服务器：成功 ${saved}，跳过 ${d.skipped ?? 0}，失败 ${d.failed ?? 0}`, 'ok')
    }
    await loadList()
  } finally {
    syncingCache.value = false
  }
}

async function syncFromCardplatform(opts?: { quiet?: boolean; plan?: string; status?: string }) {
  const quiet = !!opts?.quiet
  syncingUpstream.value = true
  try {
    const r = await authFetch('/api/v1/admin/cardplatform/cdks/sync', {
      method: 'POST',
      body: JSON.stringify({
        plan: opts?.plan || listPlan.value || '',
        status: opts?.status || listStatus.value || '',
      }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      if (!quiet) dialog.toast(d.error || d.msg || '同步失败', 'err')
      return d
    }
    const codes = Array.isArray(d.codes) ? d.codes : []
    if (codes.length) rememberIssued(codes, opts?.plan || form.plan)
    if (!quiet) {
      dialog.toast(d.msg || `已从卡台同步 ${d.imported ?? 0} 张`, d.need_cardplatform_upgrade ? 'warn' : 'ok')
    }
    await loadList()
    return d
  } finally {
    syncingUpstream.value = false
  }
}

function persistRecent(codes: string[], plan: string, region = '') {
  const payload = { codes, plan, at: Date.now(), region }
  try {
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(payload))
  } catch {
    /* ignore quota */
  }
  recentMeta.value = {
    plan,
    atLabel: new Date(payload.at).toLocaleString(),
    region,
  }
}

function loadPersistedRecent() {
  try {
    const raw = sessionStorage.getItem(RECENT_KEY)
    if (!raw) return
    const o = JSON.parse(raw)
    const codes = Array.isArray(o?.codes) ? o.codes.map((x: any) => String(x || '').trim()).filter(Boolean) : []
    if (!codes.length) return
    recentCodes.value = codes
    recentMeta.value = {
      plan: String(o.plan || '—'),
      atLabel: o.at ? new Date(o.at).toLocaleString() : '—',
      region: String(o.region || ''),
    }
  } catch {
    /* ignore */
  }
}

function clearRecent() {
  recentCodes.value = []
  recentMeta.value = null
  try {
    sessionStorage.removeItem(RECENT_KEY)
  } catch {
    /* ignore */
  }
  dialog.toast('已清除本批完整码缓存', 'info')
}

function openAgentSwap() {
  window.open(agentSwapUrl, '_blank')
}

async function copyText(t: string) {
  const ok = await copyToClipboard(t)
  dialog.toast(ok ? '已复制' : '复制失败，请在文本框中全选手动复制', ok ? 'ok' : 'err')
}

async function copyRowCode(row: any) {
  // 优先服务器 full_code，其次本机兜底缓存
  const code = String(row?.fullCode || extractFullCode(row) || row?.displayCode || '').trim()
  if (!code) {
    dialog.toast('无可复制内容', 'warn')
    return
  }
  const isFull = isFullCode(code)
  if (!isFull) {
    dialog.toast('仅有前缀：点「从卡台同步完整码」拉回，不要重新购买。', 'warn')
  }
  const ok = await copyToClipboard(code)
  if (!ok) {
    dialog.toast('复制失败，请长按文本手动复制', 'err')
    return
  }
  dialog.toast(isFull ? '已复制完整卡密' : '已复制前缀（非完整码）', isFull ? 'ok' : 'warn')
}

async function loadMeta() {
  loadingMeta.value = true
  metaError.value = ''
  try {
    const [pr, br, er, sr] = await Promise.all([
      authFetch(`/api/v1/admin/cardplatform/plans?product=${directProduct.value}`),
      authFetch('/api/v1/admin/cardplatform/balance'),
      authFetch('/api/v1/admin/network/egress'),
      authFetch('/api/v1/admin/settings'),
    ])
    if (sr.ok) {
      const s = await sr.json()
      configured.value = !!s.card_api_key_configured
    }
    if (er.ok) {
      const e = await er.json()
      egressIp.value = e.egress_ip || ''
    }
    if (pr.ok) {
      const d = await pr.json()
      plans.value = d.plans || {}
      // 服务端已按「卡台注册表 ∩ ACC 定价开关」过滤，这里拿到什么就显示什么
      planRegistry.value = d.registry || []
      paymentRegions.value = Array.isArray(d.payment_regions)
        ? d.payment_regions.map((r: any) => ({ country: String(r.country || ''), currency: String(r.currency || '') }))
            .filter((r: any) => r.country && r.currency)
        : []
      // 卡台不再下发某个地区时，把已选中的收回到「默认」——
      // 否则表单会一直带着一个卡台已经不认的国家码，发码时才被拒。
      if (form.payment_country && !paymentRegions.value.some(r => r.country === form.payment_country)) {
        form.payment_country = directProduct.value === 'x' ? 'JP' : (directProduct.value === 'grok' || directProduct.value === 'claude') ? 'US' : ''
      }
      if (directProduct.value === 'x' && !form.payment_country) form.payment_country = 'JP'
      // Grok / Claude 是美元固定价，卡台兑换时一律按 US/USD 收单；这里固定为 US，免得码上印着别的地区。
      if (directProduct.value === 'grok' || directProduct.value === 'claude') form.payment_country = 'US'
      pricingVersion.value = d.version ?? null
      priceSource.value = 'live'
    } else {
      const d = await pr.json().catch(() => ({}))
      metaError.value = d.error || d.msg || '无法获取实时价格（检查 Key / 出口 IP 白名单）'
      // ★取不到实时档位时不要编一份出来★：这里编的清单既不知道卡台开了哪些档，
      // 也不知道 ACC 的开关状态，照着它发码就是在赌。清空 + 上面的报错更诚实。
      plans.value = {}
      planRegistry.value = []
      // ★地区同理，别把上一次的清单留在下拉里★
      // 漏清的后果比看上去严重：档位空了、红字也弹了，但地区下拉还挂着上次的
      // PH/US/JP/CL/EG。操作者会以为「只是价格没刷出来，地区还是对的」，
      // 而此刻卡台到底还认不认这些地区，本站根本不知道——清单本来就是它下发的。
      // 已选中的一并收回「默认」，与成功分支里那条「卡台下线某地区就收回」同一口径。
      paymentRegions.value = []
      form.payment_country = ''
      priceSource.value = 'unavailable'
    }
    if (br.ok) {
      const b = await br.json()
      balanceText.value = String(b.spendable_balance ?? b.balance ?? '')
    }
  } catch (e: any) {
    metaError.value = e?.message || '网络错误'
  } finally {
    loadingMeta.value = false
    metaLoaded.value = true
  }
}

async function issue() {
  issueError.value = ''
  issueOk.value = ''
  if (!canIssue.value) return
  issuing.value = true
  try {
    const r = await authFetch('/api/v1/admin/cardplatform/cdks', {
      method: 'POST',
      body: JSON.stringify({
        plan: form.plan,
        product: directProduct.value,
        count: form.count,
        funding_confirmed: true,
        // 只传国家，币种由卡台按它的唯一真相源补。本站猜币种猜错的话，
        // 卡台会回「付款地区与币种不匹配」——一句完全指不到真因的话。
        payment_country: form.payment_country || '',
      }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      const recovered = await syncFromCardplatform({ quiet: true, plan: form.plan, status: 'unused' })
      const recCodes = Array.isArray(recovered?.codes) ? recovered.codes.map(extractFullCode).filter(Boolean) : []
      if (recCodes.length) {
        recentCodes.value = recCodes
        // ★这里不传地区★：找回是按「plan + unused」从卡台捞最近的码，
        // 捞到的不一定全是这一批，标上地区等于给出一个可能是错的承诺。
        persistRecent(recCodes, form.plan)
        issueOk.value = `发码请求未完成，已从卡台找回 ${recCodes.length} 张完整码。不要再点购买。`
        dialog.toast(issueOk.value, 'warn')
        await loadList()
        await loadMeta()
        return
      }
      const msg = d.error || d.msg || '发码失败'
      issueError.value = msg
      if (String(msg).includes('403') || d.code === 403) {
        issueError.value += ' — 可能是 IP 未进白名单，请复制上方出口 IP 到卡台'
      }
      return
    }
    const issued = Array.isArray(d.issued) ? d.issued : (Array.isArray(d.data?.issued) ? d.data.issued : [])
    const codes = issued.map(extractFullCode).filter(Boolean)
    if (!codes.length) {
      issueError.value = '卡台返回成功但未包含完整码字段 code。原始响应请查网络面板。'
      recentCodes.value = []
      return
    }
    // 浏览器兜底 + 列表以服务器为准
    rememberIssued(issued, form.plan)
    recentCodes.value = codes
    persistRecent(codes, form.plan, form.payment_country)
    issueOpen.value = true
    const shortOnes = codes.filter((c) => !isFullCode(c))
    const storedN = Number(d.stored_count)
    const storeFail = Number(d.store_failed) || 0
    let okMsg = shortOnes.length
      ? `成功 ${codes.length} 张，但有 ${shortOnes.length} 张长度异常，请核对`
      : `成功 ${codes.length} 张完整码（每条约 ${codes[0]?.length || '—'} 字符）`
    if (Number.isFinite(storedN)) {
      okMsg += ` · 服务器已存 ${storedN}`
      if (storeFail > 0) okMsg += `（${storeFail} 条落库失败）`
    }
    if (d.recovered) {
      okMsg = d.msg || `已从卡台找回 ${codes.length} 张完整码`
    }
    issueOk.value = okMsg
    dialog.toast(issueOk.value, shortOnes.length || storeFail || d.recovered ? 'warn' : 'ok')
    // 发码成功后自动尝试复制全部，减少漏拷
    await copyAll(false)
    form.funding_confirmed = false
    await loadList()
    await loadMeta()
  } finally {
    issuing.value = false
  }
}

function searchList() {
  page.value = 1
  return loadList()
}

let listAbort: AbortController | null = null
async function loadList() {
  // 连续翻页 / 改筛选时取消上一个请求，避免慢响应后到、把新结果盖回旧的
  listAbort?.abort()
  const ac = new AbortController()
  listAbort = ac
  const signal = ac.signal
  loadingList.value = true
  listError.value = ''
  appliedQ = listQ.value.trim()
  writeQuery()
  clearSelection()
  try {
    if (listMode.value === 'stored') {
      const qs = new URLSearchParams({
        page: String(page.value),
        page_size: String(pageSize.value),
      })
      if (listQ.value.trim()) qs.set('q', listQ.value.trim())
      if (listPlan.value) qs.set('plan', listPlan.value)
      if (listStatus.value) qs.set('status', listStatus.value)
      const r = await authFetch(`/api/v1/admin/cardplatform/cdks/stored?${qs.toString()}`, { signal })
      const d = await r.json().catch(() => ({}))
      if (signal.aborted) return
      if (!r.ok) {
        listError.value = d.error || d.msg || '加载本站完整码失败'
        rows.value = []
        total.value = 0
        return
      }
      const list = Array.isArray(d.list) ? d.list : []
      rememberIssued(list, form.plan)
      rows.value = list
      total.value = Number(d.total) || 0
      if (d.page) page.value = Number(d.page) || page.value
      storeStats.fullOnPage = list.filter((it: any) => isFullCode(extractFullCode(it) || it.code)).length
      storeStats.fullInStore = d.full_code_in_store != null ? Number(d.full_code_in_store) : null
      return
    }

    const qs = new URLSearchParams({
      page: String(page.value),
      page_size: String(pageSize.value),
    })
    if (listQ.value.trim()) qs.set('q', listQ.value.trim())
    if (listStatus.value) qs.set('status', listStatus.value)
    if (listPlan.value) qs.set('plan', listPlan.value)
    const r = await authFetch(`/api/v1/admin/cardplatform/cdks?${qs.toString()}`, { signal })
    const d = await r.json().catch(() => ({}))
    if (signal.aborted) return
    if (!r.ok) {
      listError.value = d.error || d.msg || '列表失败'
      rows.value = []
      total.value = 0
      return
    }
    const list = Array.isArray(d.list) ? d.list : []
    rememberIssued(list, form.plan)
    rows.value = list
    total.value = d.total || 0
    storeStats.fullOnPage = d.full_code_on_page != null ? Number(d.full_code_on_page) : null
    storeStats.fullInStore = d.full_code_in_store != null ? Number(d.full_code_in_store) : null
  } catch (e: any) {
    if (signal.aborted || e?.name === 'AbortError') return
    listError.value = e?.message || '网络错误'
  } finally {
    if (listAbort === ac) {
      listAbort = null
      loadingList.value = false
      listLoaded.value = true
    }
  }
}

async function copyAll(showToast = true) {
  if (!recentCodes.value.length) return
  const ok = await copyToClipboard(recentCodes.value.join('\n'))
  if (showToast) dialog.toast(ok ? `已复制 ${recentCodes.value.length} 张完整码` : '复制失败，请用下方文本框全选', ok ? 'ok' : 'err')
}

function downloadCodes() {
  if (!recentCodes.value.length) return
  const blob = new Blob([recentCodes.value.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `cdk-${form.plan || recentMeta.value?.plan || 'batch'}-${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(a.href)
  dialog.toast('已导出 .txt', 'ok')
}

async function refreshAll() {
  // 价格/余额与列表互不依赖，并行拉
  await Promise.all([loadMeta(), loadList()])
}

onMounted(async () => {
  loadCodeCache()
  loadPersistedRecent()
  if (recentCodes.value.length) issueOpen.value = true
  await refreshAll()
  // 若本机有历史完整码而服务器库为空，自动静默回填一次
  const localN = Object.values(codeCache.value).filter((v) => isFullCode(v?.code || '')).length
  if (localN > 0 && storeStats.fullInStore === 0) {
    try {
      await syncLocalCacheToServer({ quiet: true })
    } catch {
      /* ignore */
    }
  }
})
</script>

<style scoped>
.issue-card { scroll-margin-top: 80px; }
.fold-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: transparent;
  border: 0;
  cursor: pointer;
  text-align: left;
  color: inherit;
}
.fold-head:hover { background: var(--adm-hover); }
.fold-caret {
  margin-left: auto;
  font-size: 16px;
  line-height: 1;
  color: var(--ink-3);
  transition: transform .2s ease;
}
.fold-caret.is-open { transform: rotate(180deg); }
.issue-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid var(--brd);
}
.issue-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
.issue-row--top { align-items: flex-start; }
.issue-k { width: 64px; flex: none; font-size: 13px; color: var(--ink-3); padding-top: 2px; }
.issue-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--brd);
}
.issue-buy { min-width: 240px; }
.recent-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius-md);
  background: var(--good-soft);
  border: 1px solid color-mix(in srgb, var(--good) 40%, transparent);
}
.plan-card-sm {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--brd);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.plan-card-sm:hover { border-color: var(--brd-2); }
.plan-card-sm--on {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}
.mono { font-variant-numeric: tabular-nums; font-family: var(--font-mono); }

.list-card { display: flex; flex-direction: column; gap: 12px; }
.list-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.list-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; min-height: 32px; }
.tbl-wrap { position: relative; }

/* 卡密：等宽单行，悬停出「复制」提示；点整格复制 */
.code-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  text-align: left;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  color: inherit;
}
.code-cell__text {
  font-size: 12.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.code-cell__text.is-full { color: var(--ink); }
.code-cell__text.is-prefix { color: var(--ink-3); }
.code-cell__copy {
  flex: none;
  margin-left: auto;
  font-size: 11px;
  color: var(--primary);
  opacity: 0;
  transition: opacity .12s ease;
}
.code-cell:hover .code-cell__copy,
.code-cell:focus-visible .code-cell__copy { opacity: 1; }
.code-cell:hover .code-cell__text.is-full { color: var(--primary); }
.cell-ellipsis { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.nowrap { white-space: nowrap; }

.note-cell {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: 0;
  padding: 0;
  cursor: pointer;
  color: inherit;
}
.note-cell__text {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12.5px;
  color: var(--ink);
}
.note-cell__empty { font-size: 12px; color: var(--ink-3); }
.note-cell:hover .note-cell__empty { color: var(--primary); }

.col-menu { display: flex; flex-direction: column; gap: 2px; }
.col-menu__title { font-size: 11px; color: var(--ink-3); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 2px; }
</style>
