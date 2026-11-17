<template>
  <div class="adm-page">
    <AdminPageHeader title="外观" desc="站点名称与整站主题，写入服务端 site_settings，对所有访客生效" @more="onMore">
      <el-button type="primary" :loading="saving" @click="saveBrand">保存</el-button>
      <template #more>
        <el-dropdown-item command="reapply">强制重应用主题</el-dropdown-item>
      </template>
    </AdminPageHeader>

    <section class="card">
      <div class="set-group">
        <div class="set-row">
          <div>
            <div class="set-row__label">站点名称</div>
            <div class="set-row__desc">显示在用户页与后台左上角</div>
          </div>
          <div class="set-row__field">
            <el-input v-model="form.brand_name" maxlength="40" show-word-limit class="max-w-md" />
          </div>
        </div>
        <div class="set-row">
          <div>
            <div class="set-row__label">副标题</div>
            <div class="set-row__desc">品牌名下方的一行小字</div>
          </div>
          <div class="set-row__field">
            <el-input v-model="form.brand_sub" maxlength="80" show-word-limit class="max-w-md" />
          </div>
        </div>
        <div class="set-row">
          <div>
            <div class="set-row__label">整站主题</div>
            <div class="set-row__desc">
              配色、字体、圆角、导航与布局壳一起切换。点选后本页立即预览，<b>保存</b>后对所有访客生效。
              若偶尔「半套」，用右上角「更多 → 强制重应用主题」。
            </div>
          </div>
          <div class="set-row__field">
            <div class="max-w-xl">
              <SkinPicker show-mode title="主题包（配色 + 字体 + 布局）" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <UnsavedBar :show="dirty" :saving="saving" :detail="dirtyDetail" @discard="discard" @save="saveBrand" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { siteBrand, setSiteBrand, setSkin, setTheme, siteSkin, themeMode, applyThemeAll, type SkinId, type ThemeMode } from '../../theme'
import SkinPicker from '../../components/SkinPicker.vue'
import AdminPageHeader from '../../components/admin/AdminPageHeader.vue'
import UnsavedBar from '../../components/admin/UnsavedBar.vue'
import { authFetch } from '../../lib/api'
import { dialog } from '../../lib/dialog'

const form = reactive({
  brand_name: siteBrand.value.name,
  brand_sub: siteBrand.value.sub,
})
const saving = ref(false)
// 服务端当前值：与之不同即「未保存」
const saved = reactive({ brand_name: form.brand_name, brand_sub: form.brand_sub, skin: siteSkin.value as string, theme_mode: themeMode.value as string })

const dirtyParts = computed(() => {
  const out: string[] = []
  if (form.brand_name !== saved.brand_name || form.brand_sub !== saved.brand_sub) out.push('品牌')
  if (siteSkin.value !== saved.skin || themeMode.value !== saved.theme_mode) out.push('主题')
  return out
})
const dirty = computed(() => dirtyParts.value.length > 0)
const dirtyDetail = computed(() => dirtyParts.value.join('、'))

onMounted(async () => {
  try {
    const r = await authFetch('/api/v1/admin/settings')
    if (!r.ok) return
    const d = await r.json()
    form.brand_name = d.brand_name || form.brand_name
    form.brand_sub = d.brand_sub || form.brand_sub
    if (d.skin) setSkin(d.skin as SkinId)
    if (d.theme_mode) setTheme(d.theme_mode as ThemeMode)
    setSiteBrand({ name: form.brand_name, sub: form.brand_sub })
    Object.assign(saved, { brand_name: form.brand_name, brand_sub: form.brand_sub, skin: siteSkin.value, theme_mode: themeMode.value })
  } catch { /* ignore */ }
})

function reapply() {
  applyThemeAll()
  dialog.toast('主题已重应用', 'ok')
}
function onMore(cmd: string) {
  if (cmd === 'reapply') reapply()
}

function discard() {
  form.brand_name = saved.brand_name
  form.brand_sub = saved.brand_sub
  if (siteSkin.value !== saved.skin) setSkin(saved.skin as SkinId)
  if (themeMode.value !== saved.theme_mode) setTheme(saved.theme_mode as ThemeMode)
}

async function saveBrand() {
  saving.value = true
  try {
    setSiteBrand({ name: form.brand_name, sub: form.brand_sub })
    applyThemeAll()
    const r = await authFetch('/api/v1/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        brand_name: form.brand_name,
        brand_sub: form.brand_sub,
        skin: siteSkin.value,
        theme_mode: themeMode.value,
      }),
    })
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      dialog.toast(d.error || '保存失败', 'err')
      return
    }
    Object.assign(saved, { brand_name: form.brand_name, brand_sub: form.brand_sub, skin: siteSkin.value, theme_mode: themeMode.value })
    dialog.toast('品牌/主题已保存', 'ok')
  } finally {
    saving.value = false
  }
}
</script>
