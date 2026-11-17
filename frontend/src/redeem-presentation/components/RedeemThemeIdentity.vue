<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { artwork, createIdentityArtwork, type IdentityFrame } from '../visuals/redeem/identity/artwork'
import { identityPalette, identitySubtitles, type IdentityTheme } from '../visuals/redeem/identity/palette'
const props = defineProps<{ theme: IdentityTheme; name: string; dark: boolean; enabled: boolean; query: boolean }>()
const host = ref<HTMLElement | null>(null)
let renderer: ReturnType<typeof createIdentityArtwork> | undefined
const seal = computed(() => artwork(props.theme, 'seal'))
const color = computed(() => identityPalette[props.theme][props.dark ? 'night' : 'day'])
onMounted(() => { if (host.value) renderer = createIdentityArtwork(host.value, props.theme) })
watch(() => props.theme, theme => renderer?.setTheme(theme))
function frame(options: IdentityFrame) { renderer?.frame(options) }
defineExpose({ frame })
onBeforeUnmount(() => { renderer?.destroy(); renderer = undefined })
</script>
<template>
 <div v-show="enabled" class="redeem-front-identity" :class="{ 'redeem-front-identity-query': query }" :style="{ color }" aria-hidden="true">
  <div ref="host" class="redeem-front-identity-scene" />
  <div class="redeem-front-identity-signature"><span class="redeem-front-identity-seal" v-html="seal" /><span class="redeem-front-identity-name">{{ name }}<small>{{ identitySubtitles[theme] }}</small></span></div>
 </div>
</template>
<style scoped>
.redeem-front-identity { pointer-events:none; position:absolute; inset:0; }
.redeem-front-identity-scene { position:absolute; right:14px; top:-79px; width:272px; height:148px; opacity:.82; overflow:hidden; }
.redeem-front-identity-scene :deep(svg) { display:block; width:100%; height:100%; overflow:visible; }
.redeem-front-identity-signature { position:absolute; left:24px; top:-40px; display:flex; align-items:center; gap:10px; font:10px/1.4 'Noto Sans CJK SC','PingFang SC',sans-serif; letter-spacing:.16em; }
.redeem-front-identity-seal { width:28px; height:28px; flex:none; }
.redeem-front-identity-seal :deep(svg) { display:block; width:100%; height:100%; }
.redeem-front-identity-name { color:var(--a-ink); max-width:240px; }
.redeem-front-identity-name small { display:block; font-size:8px; letter-spacing:.14em; opacity:.75; margin-top:3px; }
.redeem-front-identity-query .redeem-front-identity-scene { top:-49px; }
.redeem-front-identity-query .redeem-front-identity-signature { top:30px; }
@media(max-width:760px) {
 .redeem-front-identity-scene { width:120px; height:48px; right:0; top:-25px; opacity:.78; }
 .redeem-front-identity-signature { left:12px; top:-23px; font-size:9px; gap:6px; }
 .redeem-front-identity-seal { width:22px; height:22px; }
 .redeem-front-identity-signature { max-width:calc(100% - 120px); }
 .redeem-front-identity-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
 .redeem-front-identity-name small { display:none; }
 .redeem-front-identity-query .redeem-front-identity-scene { top:-26px; height:24px; }
 .redeem-front-identity-query .redeem-front-identity-signature { top:-24px; }
}
@media(prefers-reduced-motion:reduce) { .redeem-front-identity-scene { opacity:.72; } }
</style>
