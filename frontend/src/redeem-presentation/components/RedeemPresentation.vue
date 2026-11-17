<template>
 <div ref="root" v-bind="surfaceAttrs" :class="['redeem-presentation',theme !== 'classic'||surface==='learn'?surface==='recharge'?'atelier':surface==='learn'?'atelier learn-presentation':'atelier query-page':'']" :data-page="surface==='billing'?'subscription':'status'" :data-template="theme" :data-stage="theme" :data-phase="card?.phase || phase" :data-work-phase="workPhase" :data-motion="motion" :data-visitor-light="dark?'night':'day'" :data-visitor-fonts="String(content?.visitorDefaults.onlineFonts ?? false)" :data-font-style="content?.visitorDefaults.fontStyle || 'editorial'" :data-tone-system="'hue-kept-m18'" :style="theme==='classic'?undefined:{...panelStyle,...surfaceStyle}">
  <div v-show="theme !== 'classic'" class="ambient" aria-hidden="true"><img v-if="theme !== 'classic'" class="ambient-plate" alt="" decoding="async" fetchpriority="low" sizes="(max-width: 900px) 320px, 100vw" :srcset="scenePlateSet(theme)" :src="scenePlate(theme)" /><canvas data-v4-environment /><canvas data-v4-stars /><div class="shade" /></div>
  <header v-show="theme !== 'classic'||surface==='learn'" class="topbar">
   <router-link class="brand" to="/" :aria-label="`${brandName} 首页`"><svg aria-hidden="true" viewBox="0 0 48 42"><path d="M5 36V6h18c21 0 21 21 0 21H5m20 0 18 12" /></svg>{{ content?.brand || brandName }}</router-link>
   <nav id="site-navigation" class="toplinks" :aria-label="t('m19.serviceNavigation')"><a v-for="link in visibleNavigation" :key="link.id" :class="surface==='recharge'?'m11-nav-item':undefined" :aria-current="isCurrentLink(link)?'page':undefined" :href="navigationUrl(link)" :target="navigationTarget(link)" rel="noopener noreferrer" referrerpolicy="no-referrer" @click="navigate($event,navigationUrl(link))">{{ tutorialNavigationText(link, 'label', t('learn.title')) }}</a></nav><button class="m11-nav-trigger" type="button" @click="navigationOpen=true" :aria-label="t('m19.serviceNavigation')" :aria-expanded="navigationOpen" aria-controls="public-service-menu" aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" /></svg>{{ t('m19.navigation') }}</button><ThemeToggle presentation /><LanguageToggle v-model:open="languageOpen" presentation />
  </header>
  <p v-if="appearanceError" class="appearance-error" role="status">外观暂不可用，原操作仍可继续。<button type="button" :disabled="appearanceLoading" @click="loadPublicPresentation">重新读取外观</button></p>
  <section v-if="surface!=='learn'" :class="surface==='recharge'?'main-stage journey-grid':'query-main'" :data-mode="mode">
   <div v-show="theme !== 'classic'" :class="surface==='recharge'?'identity-zone':'identity-zone query-identity'"><RedeemThemeIdentity v-if="theme!=='classic'" ref="themeIdentity" :theme="theme" :name="redeemThemeName(theme,content)" :dark="dark" :enabled="template?.backgroundEnabled!==false" :query="surface!=='recharge'" /><div v-if="surface==='recharge'" class="card-caption" aria-hidden="true">{{ brandUpper }}  /  DIGITAL EDITION</div><section ref="cardHost" class="card-stage" aria-label="套餐与原任务卡片" /><div v-if="surface==='recharge'" class="m11-utility"><button type="button" class="m11-tier-trigger" @click="tiersOpen=true">{{ t('m19.tierOverview') }}</button></div><p v-if="surface==='recharge'" class="context-line">{{ template?.caption }}</p><div v-else class="after-card"><p class="query-caption">{{ t('m19.queryCaption') }}</p><slot name="secondary" /></div></div>
   <div :class="surface==='recharge'?'operation-zone':'query-content'">
    <section v-show="theme !== 'classic'" :class="surface==='recharge'?'headcopy':'query-head'"><p :class="surface==='recharge'?'eyebrow':'query-eyebrow'">{{ surface === 'recharge' ? template?.eyebrow : surface === 'billing'?'YOUR SUBSCRIPTION':'YOUR REDEMPTION' }}</p><h1 v-if="surface==='recharge'"><span>{{ template?.titleFirst }}</span><span>{{ template?.titleSecond }}</span></h1><h1 v-else class="query-heading">{{ t(surface==='billing'?'m19.subscriptionTitle':'m19.historyTitle') }}</h1><p :class="surface==='recharge'?'deck':'query-lead'">{{ surface==='recharge'?template?.description:t(surface==='billing'?'m19.subscriptionDescription':'m19.historyDescription') }}</p></section>
    <!-- 唯一业务 slot；换肤、明暗、语言与阶段变化不重挂载原输入/任务/挑战。 -->
    <div class="workbench" :data-query-surface="surface"><header v-if="surface==='recharge'" v-show="theme !== 'classic'" class="work-header"><div class="work-eyebrow"><span>{{ ['REDEMPTION / START','ACCOUNT / CHECK','REVIEW / CONFIRM','ORIGINAL TASK / STATUS'][workStep-1] }}</span><span>{{ String(workStep).padStart(2,'0') }} / 04</span></div><h2 tabindex="-1">{{ workHeading[0] }}</h2><p>{{ workHeading[1] }}</p></header><slot /><div class="guide-line" v-show="theme !== 'classic' && workPhase!=='task' && workPhase!=='challenge' && (surface==='recharge' && (mode==='batch' || workPhase==='entry' || workPhase==='credentials' && card?.productData.family==='claude'))"><button type="button" class="work-guide" :disabled="desolatePromptPending" @click="openGuide()">{{ t('m19.guide') }} ↗</button></div><slot name="workbench-footer" /></div>
   </div>
   <slot name="wide" />
  </section>
  <main v-else class="learn-shell"><slot /></main>
  <aside v-if="MUSIC_AVAILABLE && theme === 'classic'" class="classic-music" aria-label="音乐控制"><button type="button" @click="toggleRedeemMusic">♫ {{ t(redeemMusic.playing.value||redeemMusic.pending.value?'m19.musicStop':'m19.musicPlay') }}</button><p v-if="redeemMusic.notice.value" role="status">{{ t(redeemMusic.notice.value==='blocked'?'m19.musicBlocked':'m19.musicError') }}</p></aside>
  <footer v-show="theme !== 'classic'" :class="['footer',surface!=='recharge'?'query-footer':'']">
   <span :id="surface==='recharge'?'footer-copy':undefined">{{ surface==='recharge'?content?.footerText:surface==='learn'?`${brandUpper} · LEARN`:`${brandUpper} · QUERY STUDIO` }}</span><span class="today-theme">{{ t('m19.today') }} · {{ redeemThemeName(theme,content) }}</span>
   <span v-if="surface==='recharge'" id="footer-links" class="footer-links">
    <button class="m11-nav-item" data-action="guide" type="button" :disabled="desolatePromptPending" @click="openGuide()"><span class="m11-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4zM14 7a3 3 0 0 1 3-3h3v13h-3a3 3 0 0 0-3 3" /></svg></span>{{ t('m19.illustratedGuide') }}</button>
    <button v-if="TUTORIAL_VIDEO_AVAILABLE" class="m11-nav-item" data-action="video" type="button" :disabled="desolatePromptPending" @click="openGuide('video')"><span class="m11-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m10 9 5 3-5 3z" /></svg></span>{{ t('m19.video') }}</button>
    <button class="m11-nav-item" data-action="challenge-guide" type="button" :disabled="desolatePromptPending" @click="openGuide('challenge')"><span class="m11-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.3 2.3 0 0 1 4.6.4c0 1.7-2.3 1.9-2.3 3.4M12 16h.01" /></svg></span>{{ t('m19.challengeGuide') }}</button>
    <button v-if="MUSIC_AVAILABLE" class="m14-music-toggle" type="button" :aria-pressed="redeemMusic.playing.value" :aria-label="musicDetailsAvailable ? t('m19.musicReason') : undefined" :aria-haspopup="musicDetailsAvailable ? 'dialog' : undefined" :data-audio-label="musicDetailsAvailable ? t(redeemMusic.notice.value==='blocked'?'m19.musicWhy':'m19.musicInfo') : undefined" :data-audio-state="redeemMusic.notice.value || (redeemMusic.playing.value ? 'playing' : 'paused')" :title="redeemMusic.notice.value ? t(redeemMusic.notice.value==='blocked'?'m19.musicBlocked':'m19.musicError') : undefined" :aria-describedby="redeemMusic.notice.value ? 'visitor-audio-status' : undefined" @click="footerMusicAction">♫ {{ t(redeemMusic.playing.value||redeemMusic.pending.value?'m19.musicStop':'m19.musicPlay') }}</button>
   </span>
   <template v-else>
    <button data-action="guide" type="button" :disabled="desolatePromptPending" @click="openGuide()">{{ t('m19.illustratedGuide') }}</button>
    <button v-if="TUTORIAL_VIDEO_AVAILABLE" data-action="video" type="button" :disabled="desolatePromptPending" @click="openGuide('video')">{{ t('m19.video') }} ↗</button>
    <button v-if="MUSIC_AVAILABLE" class="m14-music-toggle" type="button" :aria-pressed="redeemMusic.playing.value" :aria-label="musicDetailsAvailable ? t('m19.musicReason') : undefined" :aria-haspopup="musicDetailsAvailable ? 'dialog' : undefined" :data-audio-label="musicDetailsAvailable ? t(redeemMusic.notice.value==='blocked'?'m19.musicWhy':'m19.musicInfo') : undefined" :data-audio-state="redeemMusic.notice.value || (redeemMusic.playing.value ? 'playing' : 'paused')" :title="redeemMusic.notice.value ? t(redeemMusic.notice.value==='blocked'?'m19.musicBlocked':'m19.musicError') : undefined" :aria-describedby="redeemMusic.notice.value ? 'visitor-audio-status' : undefined" @click="footerMusicAction">♫ {{ t(redeemMusic.playing.value||redeemMusic.pending.value?'m19.musicStop':'m19.musicPlay') }}</button>
   </template>
   <button data-action="display-audio" type="button" :disabled="desolatePromptPending" @click="motionOpen=true">{{ t('m19.displayAudio') }}</button>
   <span v-if="MUSIC_AVAILABLE && redeemMusic.notice.value && !motionOpen" id="visitor-audio-status" class="sr-only" role="status">{{ t(redeemMusic.notice.value==='blocked'?'m19.musicBlocked':'m19.musicError') }}</span>
  </footer>
  <ModalDialog :animate="false" :preserve-scrollbar="theme!=='classic'" :open="navigationOpen" panel-class="public-navigation-panel" :title="t('m19.serviceNavigation')" :panel-style="panelStyle" @close="navigationOpen=false"><nav id="public-service-menu" class="m11-menu-links" :aria-label="t('m19.serviceEntries')"><a v-for="link in visibleNavigation" :key="link.id" class="m11-nav-item" :href="navigationUrl(link)" :target="navigationTarget(link)" rel="noopener noreferrer" referrerpolicy="no-referrer" @click="navigate($event,navigationUrl(link));navigationOpen=false"><span class="m11-nav-label">{{ tutorialNavigationText(link, 'label', t('learn.title')) }}</span><small v-if="link.description" class="m11-nav-description">{{ tutorialNavigationText(link, 'description', t('learn.navDescription')) }}</small></a></nav></ModalDialog>
  <ModalDialog :animate="false" :preserve-scrollbar="theme!=='classic'" :open="tiersOpen" :title="t('m19.tierOverview')" panel-class="m19-tier-dialog" :panel-style="panelStyle" @close="tiersOpen=false">
   <div v-for="product in tierOverview" :key="product.id" class="m19-tier-row">
    <strong>{{ product.overview?.name || product.displayLabel }}</strong>
    <span>{{ product.overview?.caption || product.cardCaption || product.officialLabel }}{{ product.overview?.formerPlan ? ' (' + t('m19.formerPlan', { plan: product.overview.formerPlan }) + ')' : '' }}</span>
   </div>
  </ModalDialog>
  <RedeemTutorial :open="guideOpen" :initial-entry="guideEntry" :content="content" :theme="theme" :dark="dark" :panel-style="panelStyle" @close="guideOpen=false" />
  <ModalDialog :animate="false" :preserve-scrollbar="theme!=='classic'" :open="motionOpen" :title="t('m19.displayAudio')" panel-class="modal visitor-dialog" :panel-style="panelStyle" backdrop-class="atelier redeem-preferences-backdrop" :backdrop-attributes="{'data-stage':theme,'data-visitor-light':dark?'night':'day','data-motion':motion,'data-visitor-fonts':String(content?.visitorDefaults.onlineFonts??false),'data-font-style':content?.visitorDefaults.fontStyle||'editorial'}" :backdrop-style="{...panelStyle,background:'#03060bbb',backdropFilter:'blur(6px)'}" @close="motionOpen=false">
   <section v-if="MUSIC_AVAILABLE" class="visitor-group"><label class="visitor-field"><span>{{ t('m19.volume') }}</span><input type="range" min="0" max="0.5" step="0.01" :value="redeemMusic.volume.value" :aria-label="t('m19.volume')" @input="setRedeemMusicVolume(Number(($event.target as HTMLInputElement).value))" /></label><div class="visitor-audio-row"><button type="button" class="visitor-play" :aria-pressed="redeemMusic.playing.value" @click="toggleRedeemMusic">♫ {{ t(redeemMusic.playing.value||redeemMusic.pending.value?'m19.musicStop':'m19.musicPlay') }}</button></div><p class="visitor-note">{{ t('m19.musicPolicy') }}</p><p v-if="redeemMusic.notice.value" id="visitor-audio-status" class="visitor-note" role="status">{{ t(redeemMusic.notice.value==='blocked'?'m19.musicBlocked':'m19.musicError') }}</p></section>
   <section class="visitor-group"><p>{{ t('m19.motion') }}</p><div class="visitor-audio-row"><button v-for="option in ['full','light','static'] as const" :key="option" type="button" class="visitor-play" :aria-pressed="motion===option" @click="motionOverride=option">{{ t(`m19.${option}`) }}</button></div></section>
  </ModalDialog>
 </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ModalDialog from './ModalDialog.vue'
import { isTutorialLink } from '../utils/tutorialRoutes'
import { publicNavigationLinks, tutorialNavigationText } from '../utils/tutorialNavigation'
import RedeemTutorial from './RedeemTutorial.vue'
import RedeemThemeIdentity from './RedeemThemeIdentity.vue'
import type { IdentityFrame } from '../visuals/redeem/identity/artwork'
import ThemeToggle from './ThemeToggle.vue'
import LanguageToggle from './LanguageToggle.vue'
import { desolatePromptPending } from '../utils/desolatePrompt'
import { redeemThemeName, type RedeemContent, type RedeemTheme, type RedeemPhase, type RedeemMotion } from '../utils/redeemPresentation'
import { publicContent as content, publicTheme as theme, loadPublicPresentation, lockPresentation, presentationMotion, appearanceError, appearanceLoading } from '../utils/publicPresentation'
import { cardForTask, redeemProducts as products } from '../utils/redeemCard'
import { redeemMusic, toggleRedeemMusic, blockRedeemMusic, setRedeemMusicVolume } from '../utils/redeemMusic'
import { isDark, themeMode } from '../theme'
// 本站接入：品牌、路由、外壳计数（让 App 级背景画布让位）、媒体降级开关。
import { useRoute, useRouter } from 'vue-router'
import { siteBrand } from '../../theme'
import { presentationShells } from '../shell-state'
import { MUSIC_AVAILABLE, TUTORIAL_VIDEO_AVAILABLE } from '../config'
import { presentationPanelColors, provideRedeemSurfaceTheme, surfaceThemeFromTone, themeStyle } from '../utils/redeemThemeBridge'
import { redeemArtwork } from '../visuals/redeem/artwork'
import type { CardView } from '../visuals/redeem/contracts'
// @ts-ignore 获批同源展示模块。
import { createIdentityCard } from '../visuals/redeem/runtime/card.js'
// @ts-ignore 获批同源展示模块。
import { createEnvironment } from '../visuals/redeem/runtime/environment.js'
import R45Optics from '../visuals/redeem/runtime/optical-motion.js'
// @ts-ignore 获批同源展示模块。
import Motion from '../visuals/redeem/runtime/motion-director.js'
// @ts-ignore 获批同源色相投影。
import Tone from '../visuals/redeem/runtime/tone-m17.js'
// 本站移植：原项目在 App.vue 全局先载 redeem-surfaces.css，再随本组件载 index.css；保持同样的层叠顺序。
import '../styles/redeem-surfaces.css'
import '../visuals/redeem/styles/index.css'
// 本站移植：抵消本站皮肤全局样式（.btn-primary 等）渗进外壳的部分，放在最后。
import '../styles/host-overrides.css'
// 底板按主题名取景（天阙云殿、流霞天绫、月魄玉璧、星宿天衡、辰海天河、青玉山海、曦羽流霞）；换图时提升版本号，避免浏览器沿用旧缓存。
const PLATE_VERSION = 4
const scenePlates: Record<string, string> = Object.fromEntries(['atelier', 'silk', 'porcelain', 'orbit', 'astral', 'verdant', 'dawn'].map(name => [name, `/redeem-plates/${name}.webp?v=${PLATE_VERSION}`]))
function scenePlate(name: string) { return scenePlates[name] || scenePlates.atelier }
function scenePlateSet(name: string) { const full = scenePlate(name); return `${full.replace('.webp', '-960.webp')} 960w, ${full} 1280w` }
const tierOverview=products.filter(product=>product.family==='openai'&&product.kind==='subscription')
const props=withDefaults(defineProps<{phase?:RedeemPhase;card?:CardView;busy?:boolean;mode?:'single'|'batch';workPhase?:string;surface?:'recharge'|'billing'|'history'|'learn'}>(),{phase:'idle',busy:false,mode:'single',workPhase:'entry',surface:'recharge'})
const emit=defineEmits<{content:[content:RedeemContent];theme:[theme:RedeemTheme]}>()
const {t,locale}=useI18n({useScope:'global'})
const router=useRouter(),route=useRoute()
// 本站接入：导航高亮按当前路由判断（/batch 与 /recharge 同属 recharge 外壳）；路由不在导航里时沿用原判据。
const currentPath=computed(()=>route.path==='/'?'/recharge':route.path)
function isCurrentLink(link:{url:string}){if(visibleNavigation.value.some(item=>item.url===currentPath.value))return link.url===currentPath.value;return (['/','/recharge'].includes(link.url)&&props.surface==='recharge')||(link.url==='/billing'&&props.surface==='billing')||(link.url==='/history'&&props.surface==='history')||(isTutorialLink(link.url)&&props.surface==='learn')}
const brandName=computed(()=>(siteBrand.value.name||'').trim()||'CDK Portal'),brandUpper=computed(()=>brandName.value.toUpperCase())
const root=ref<HTMLElement|null>(null),cardHost=ref<HTMLElement|null>(null),guideOpen=ref(false),tiersOpen=ref(false),motionOpen=ref(false),languageOpen=ref(false),navigationOpen=ref(false),motionOverride=ref<RedeemMotion|null>(null)
const themeIdentity=ref<InstanceType<typeof RedeemThemeIdentity>|null>(null)
function frameThemeIdentity(frame:IdentityFrame){
 const focused=!!document.activeElement?.matches('input,textarea,select,[contenteditable=true]')
 const paused=focused||guideOpen.value||tiersOpen.value||motionOpen.value||languageOpen.value||navigationOpen.value||desolatePromptPending.value||props.workPhase==='credentials'||props.workPhase==='challenge'||['verifying','review','submitting','action','unknown','failed'].includes(props.card?.phase||props.phase)
 themeIdentity.value?.frame({...frame,staticMode:frame.staticMode||paused})
}
const guideEntry=ref<'guide'|'video'|'challenge'>('guide')
async function closePanels(){guideOpen.value=false;tiersOpen.value=false;motionOpen.value=false;languageOpen.value=false;navigationOpen.value=false;await nextTick()}
function openGuide(entry:'guide'|'video'|'challenge'='guide'){if(!desolatePromptPending.value){guideEntry.value=entry;guideOpen.value=true}}
const motion=computed(()=>motionOverride.value||presentationMotion.value),template=computed(()=>{
 if(theme.value==='classic')return null
 return content.value?.templates[theme.value] || {
  name:redeemThemeName(theme.value,null),
  eyebrow:'REDEEM / CONTINUE',
  titleFirst:'RedeemAI',
  titleSecond:'Recharge',
  description:'Continue with the original task and keep its status visible.',
  caption:'Original task and verification stay in this view.',
  overline:'REDEEMAI',
  backgroundEnabled:true,
 }
})
const dark=computed(()=>{void themeMode.value;return isDark()})
const panelStyle=computed<Record<string,string>>(()=>{
 const tone=Tone.scene(theme.value==='classic'?'atelier':theme.value)
 const night=dark.value,palette=presentationPanelColors(theme.value,night?'dark':'light',tone)
 return {'--night':night?'1':'0','--env-light':'1','--env-saturation':'1','--fx-light':night?'.84':'1','--night-ink':tone.ink,'--night-muted':tone.muted,'--night-bg':tone.base,'--night-surface':tone.surface,'--night-accent':tone.accent,'--ink':palette.ink!,'--ink-2':palette.muted!,'--ink-3':palette.muted!,'--surface':palette.panel!,'--surface-2':night?'#ffffff09':'#ffffff15','--primary':palette.accent!,'--accent':palette.accent!,'--primary-on':palette['on-accent']!,'--primary-soft':palette.soft!,'--brd':palette.line!,'--warn':palette.warning!,'--good':palette.success!,'--good-soft':palette['success-soft']!,'--err':palette.danger!,'--err-soft':palette['danger-soft']!}
})
const surfaceTheme = computed(() => theme.value === 'classic' ? null : surfaceThemeFromTone(theme.value, dark.value ? 'dark' : 'light', Tone.scene(theme.value), presentationPanelColors(theme.value, dark.value ? 'dark' : 'light', Tone.scene(theme.value))))
const surfaceAttrs = computed<Record<string,string>>(() => {
 const theme=surfaceTheme.value
 if(!theme)return {} as Record<string,string>
 return {'data-redeem-ui':'public','data-lighting':theme.lighting,'data-realm':theme.realm}
})
const surfaceStyle = computed(() => themeStyle(surfaceTheme.value))
provideRedeemSurfaceTheme(surfaceTheme)
const visibleNavigation = computed(() => publicNavigationLinks(content.value?.navigation))
function navigationUrl(link:{id:string;url:string}){return props.surface!=='recharge'&&link.id==='redeem'&&['#code','/#code'].includes(link.url)?'/':link.url}
function navigationTarget(link:{url:string;target:string}){return isTutorialLink(link.url)?props.surface==='learn'?'_self':'_blank':link.target}
function navigate(event:MouseEvent,url:string){if(url===currentPath.value||props.surface==='recharge'&&url==='/'&&currentPath.value==='/recharge')event.preventDefault();else if(props.surface==='learn'&&url==='/help'&&typeof window!=='undefined'&&window.location?.pathname==='/help')event.preventDefault()
 // 本站接入：站内 _self 链接走路由，不整页刷新（保留新标签打开等修饰键行为）。
 else if(url.startsWith('/')&&!url.startsWith('//')&&!event.defaultPrevented&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&(event.currentTarget as HTMLAnchorElement|null)?.target!=='_blank'){event.preventDefault();void router.push(url)}}
const musicDetailsAvailable=computed(()=>!!redeemMusic.notice.value&&!redeemMusic.playing.value&&!redeemMusic.pending.value)
function footerMusicAction(){if(musicDetailsAvailable.value)motionOpen.value=true;else toggleRedeemMusic()}
const owner=Symbol();let alive=true,cardView:any,environment:any,director:any,layoutObserver:ResizeObserver|undefined
function destroy(){layoutObserver?.disconnect();layoutObserver=undefined;cardView?.destroy();environment?.destroy();director?.destroy();cardView=environment=director=undefined}
function createPresentationCard(){
 const card=createIdentityCard(cardHost.value,{}),setState=card.setState
 let product=props.card?.productData
 card.setState=(next:Partial<CardView>)=>{setState(next);product=next.productData||product
  if(product?.id==='unidentified'&&product.displayLabel==='等待识别'){const title=t('m19.waitingIdentification');cardHost.value?.querySelectorAll('.digest-product').forEach(el=>{el.textContent=title;el.setAttribute('data-long',String(title.length>10))})}
  if(product?.legacyLabel&&product.cardUsageMultiplier){cardHost.value?.querySelectorAll('.digest-edition').forEach(el=>{el.setAttribute('data-pro-information','');const current=document.createElement('span'),usage=document.createElement('span');current.textContent=`${product?.cardCaption} · ${t('m19.formerPlan',{plan:product?.legacyLabel})}`;usage.className='pro-usage-caption';usage.textContent=t('m19.actualUsage',{multiplier:product?.cardUsageMultiplier});el.replaceChildren(current,usage)})}else{cardHost.value?.querySelectorAll('.digest-edition').forEach(el=>el.removeAttribute('data-pro-information'))}
 }
 return card
}
const stockCopy=(value:string|undefined,stocks:string[],key:string)=>!value||stocks.includes(value)?t(key):value
const stockTitles=['输入兑换码','输入卡密','先贴兑换码','填写兑换码']
const stockHints=['整串粘贴，识别后继续核对账号。','识别套餐后，再逐步核对账号信息。','整段贴上。这一步只认出套餐，还不会开始兑换。','请粘贴完整兑换码。本步只识别套餐，不会提交兑换。']
const workHeading=computed(()=>props.mode==='batch'?[t('m19.workHeading.batchTitle'),t('m19.workHeading.batchHint')]:props.phase==='submitting'?[t('m19.workHeading.submittingTitle'),t('m19.workHeading.submittingHint')]:props.workPhase==='entry'?props.phase==='verifying'?[t('m19.workHeading.identifyingTitle'),t('m19.workHeading.identifyingHint')]:[stockCopy(content.value?.copy.inputTitle,stockTitles,'m19.workHeading.inputTitle'),stockCopy(content.value?.copy.inputHint,stockHints,'m19.workHeading.inputHint')]:props.workPhase==='credentials'?props.phase==='verifying'?[t('m19.workHeading.precheckingTitle'),t('m19.workHeading.precheckingHint')]:[t('m19.workHeading.credentialsTitle'),t('m19.workHeading.credentialsHint')]:props.workPhase==='review'?[t('m19.workHeading.reviewTitle'),t('m19.workHeading.reviewHint')]:props.phase==='success'?[t('m19.workHeading.successTitle'),t('m19.workHeading.successHint')]:props.phase==='action'?[props.workPhase==='challenge'||desolatePromptPending.value?t('m19.workHeading.humanTitle'):t('m19.workHeading.actionTitle'),props.workPhase==='challenge'||desolatePromptPending.value?t('m19.workHeading.humanHint'):t('m19.workHeading.actionHint')]:props.phase==='unknown'?[t('m19.workHeading.unknownTitle'),t('m19.workHeading.unknownHint')]:props.phase==='failed'?[t('m19.workHeading.failedTitle'),t('m19.workHeading.failedHint')]:[t('m19.workHeading.processingTitle'),t('m19.workHeading.processingHint')])
async function sync(){await nextTick();if(!alive||!root.value||(props.surface!=='learn'&&!cardHost.value))return;if(theme.value==='classic'){destroy();return}
 director ||= Motion.install(root.value)
 if(cardHost.value)cardView ||= createPresentationCard()
 environment ||= createEnvironment(root.value,redeemArtwork,frameThemeIdentity)
 if(cardHost.value){
 cardView.setState({...(props.card||cardForTask({phase:props.phase})),brand:brandName.value,...(props.surface==='recharge'?{inputTitle:workHeading.value[0],inputHint:workHeading.value[1]}:{}),clockCopy:{verification:t('feedback.clock.verification'),success:t('feedback.clock.success'),failed:t('feedback.clock.failed'),unknown:t('feedback.clock.unknown'),action:t('feedback.clock.action'),processing:t('feedback.clock.processing'),pending:t('feedback.clock.pending'),pendingDetail:t('feedback.clock.pendingDetail'),stoppedDetail:t('feedback.clock.stoppedDetail'),terminalDetail:t('feedback.clock.terminalDetail'),runningDetail:t('feedback.clock.runningDetail')},darkness:dark.value?1:0,summaryMode:true,stage:theme.value,motion:motion.value,experience:{timerEnabled:true,stageLabelEnabled:true,edgeIntensity:.9,successSettle:true,themeAdaptation:true}})
 if(props.surface!=='recharge'){
  cardHost.value.querySelectorAll('.card-footer>div:first-child .foot-label').forEach(el=>el.textContent=props.surface==='billing'?'ACCOUNT':'ORIGINAL TASK')
  const tag=cardHost.value.querySelector('.front .card-tag');if(tag)tag.textContent=props.surface==='billing'?'SUBSCRIPTION LOOKUP':'TASK LOOKUP'
  cardHost.value.querySelectorAll('[data-state],[data-front-state]').forEach(el=>el.textContent=props.card?.statusLabel||t(props.phase==='verifying'?'common.querying':props.surface==='billing'?'m19.subscriptionEmpty':'m19.historyEmpty'))
 }
 // 原引擎保留实例；异步内容布局后刷新位置，避免共享光源使用旧边界。
 R45Optics.mount(cardHost.value).resize()
 if(!layoutObserver){layoutObserver=new ResizeObserver(()=>{if(alive&&cardHost.value&&cardView)R45Optics.mount(cardHost.value).resize()});layoutObserver.observe(root.value)}
 }
 environment.setDarkness(dark.value?1:0);environment.setTheme(theme.value);environment.setMotion(motion.value);environment.setPhase(props.card?.phase || props.phase);environment.setBackgroundEnabled(template.value?.backgroundEnabled)
}
watch(()=>[locale.value,theme.value,motion.value,dark.value,props.phase,props.card,template.value?.backgroundEnabled,brandName.value],sync,{deep:true})
watch(content,c=>{if(c)emit('content',c)},{immediate:true})
watch(theme,value=>emit('theme',value),{immediate:true})
const workStep=computed(()=>props.mode==='batch'?1:props.phase==='submitting'?4:props.workPhase==='entry'?1:props.workPhase==='credentials'?2:props.workPhase==='review'?3:4)
watch(workHeading,()=>{void sync()})
const musicOwner=`presentation-${Math.random().toString(36).slice(2)}`
watch(()=>[props.phase,props.busy,desolatePromptPending.value,guideOpen.value,tiersOpen.value,motionOpen.value,languageOpen.value,navigationOpen.value],()=>{lockPresentation(owner,props.busy||!['idle','success','failed'].includes(props.phase)||desolatePromptPending.value||guideOpen.value||tiersOpen.value||motionOpen.value||languageOpen.value||navigationOpen.value);blockRedeemMusic(musicOwner,props.phase==='action')},{immediate:true})
watch(desolatePromptPending,value=>{if(value){guideOpen.value=false;tiersOpen.value=false;motionOpen.value=false;languageOpen.value=false;navigationOpen.value=false}})
onMounted(()=>{presentationShells.value++;void loadPublicPresentation();void sync()})
onBeforeUnmount(()=>{presentationShells.value=Math.max(0,presentationShells.value-1);alive=false;lockPresentation(owner);blockRedeemMusic(musicOwner,false);destroy()})
defineExpose({environment:()=>environment,cardView:()=>cardView,openGuide,closePanels})
</script>
<style>
.classic-music{padding:12px 24px;text-align:center}.classic-music button{min-height:44px}.classic-music p{font-size:12px}

.redeem-presentation:not(.atelier) .journey-grid,.redeem-presentation:not(.atelier) .query-main{display:block}.redeem-presentation:not(.atelier) .workbench{padding:0}.atelier .appearance-error{position:relative;padding:12px}.atelier .toplinks .theme-toggle-control,.atelier .toplinks .language-toggle-control{padding:8px!important}.atelier .headcopy h1 span{display:block}.atelier .footer button{background:transparent;border:0;color:inherit;font-size:11px}.atelier .recharge-page,.atelier .billing-page,.atelier .history-page{min-height:0;padding:0}.atelier .recharge-page>main,.atelier .billing-shell,.atelier .history-page>main{max-width:none;padding:0}.atelier .recharge-classic-header,.atelier .query-classic-header{display:none}.atelier .workbench .card{background:transparent;border-left:0;border-right:0;border-bottom:0;box-shadow:none;border-radius:0;padding:0;backdrop-filter:none;-webkit-backdrop-filter:none}.atelier .workbench .card:not(.query-result){border-top:0}.atelier .workbench .input{background:var(--w-input);color:var(--w-ink);border:1px solid var(--w-line);box-shadow:none;border-radius:7px;line-height:1.65}.atelier .workbench .btn-primary:not(.work-primary){background:color-mix(in srgb,var(--w-accent) 91%,#fff 9%);color:var(--w-on);border:1px solid color-mix(in srgb,var(--w-accent) 50%,transparent);box-shadow:none;border-radius:7px;font-size:12px}.atelier .workbench .btn-secondary:not(.work-primary){background:none;border:1px solid var(--w-line);color:var(--w-ink);box-shadow:none;border-radius:7px}.atelier .workbench .recharge-mode-switch{font-size:11px;margin-bottom:16px}.atelier .workbench .recharge-mode-btn{padding:4px 8px;background:transparent;border:0;border-bottom:1px solid var(--brd);min-height:32px}.atelier .workbench .step-indicator{display:none}.atelier .workbench .cdk-entry h2{display:none}.atelier .workbench .cdk-input-row{display:grid;grid-template-columns:minmax(0,1fr) 72px;gap:9px;align-items:end}.atelier .workbench .cdk-verify{height:49px;padding:0;font-size:12px;min-width:0}.atelier .workbench .cdk-next{margin-top:12px}.atelier .workbench label{font:11px/1.6 var(--r-ui);color:var(--w-muted);margin-bottom:9px;letter-spacing:normal;text-transform:none}.atelier .workbench .input{font-size:13px;min-height:49px;padding:12px 13px}.atelier .workbench .help-action{font-size:11px}.redeem-tutorial-panel{max-width:900px}.atelier .query-classic-header{display:none}.atelier .billing-mode-switch{padding:0;margin-bottom:12px}.atelier .billing-mode-btn{font-size:11px;min-width:0}.atelier .billing-mini-tag{display:none}
.atelier .recharge-mode-switch{background:none;border:0;border-radius:0;padding:0;gap:18px}.atelier .recharge-mode-switch .recharge-mode-btn{color:var(--w-muted);box-shadow:none;background:none;border-radius:0}.atelier .recharge-mode-switch .recharge-mode-btn--active{color:var(--w-accent);border-color:var(--w-accent)}.atelier .workbench .alert{font-size:11px;line-height:1.9;background:transparent;border:0;border-left:1px solid var(--w-line);padding:10px 0 10px 12px;border-radius:0}.atelier .workbench .recharge-gate-ribbon{font-size:10px;background:none;border:0;border-top:1px solid var(--w-line);padding:10px 0;border-radius:0}.atelier .workbench :is(.recharge-gate-ribbon__label,.recharge-gate-ribbon__value){font-size:10px}.atelier .workbench .session-section-heading{display:none}.atelier .workbench .session-help{background:none;border:0;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:8px}.atelier .workbench .session-help p{font-size:10px;line-height:1.8}.atelier .workbench .session-help a{font-size:10px;padding:0}.atelier .workbench textarea{height:auto;min-height:98px}.atelier .workbench .review-list>div{font-size:11px}.atelier .workbench .query-tabs{background:none;padding:0;border-radius:0;gap:18px;box-shadow:none}.atelier .query-tabs button{background:none!important;color:var(--w-muted)!important;border:0!important;border-bottom:1px solid transparent!important;border-radius:0!important;box-shadow:none!important;padding:8px 0 12px!important;min-height:42px}.atelier .query-tabs button[aria-pressed=true]{color:var(--w-accent)!important;border-bottom-color:var(--w-accent)!important}.atelier .query-content .query-result{padding-top:20px}.atelier .workbench .query-form-title{display:none}.atelier .query-content .form-group{font-family:var(--r-ui)}
.redeem-presentation.atelier .recharge-mode-switch{background:none;border:0;border-radius:0;padding:0;gap:18px}.redeem-presentation.atelier .recharge-mode-switch .recharge-mode-btn{background:none;color:var(--w-muted);border-radius:0;font-size:11px;font-weight:400}.redeem-presentation.atelier .recharge-mode-switch .recharge-mode-btn--active{color:var(--w-accent)}.atelier .workbench .task-observation{background:none;border:0;border-radius:0;padding:0;box-shadow:none;font-size:11px}.atelier .workbench .task-observation>p{font-size:11px;line-height:1.9;color:var(--w-muted);font-weight:400}.atelier .workbench .task-observation .task-facts{margin:18px 0 0;border-bottom:1px solid var(--w-line);padding:10px 0;font-size:10px}.atelier .workbench .task-observation .task-controls{display:flex;align-items:center;justify-content:space-between;gap:16px;border:0;margin-top:17px;padding:0}.atelier .workbench .task-observation .task-controls a{font-size:10px;color:var(--w-muted)}.atelier .workbench .task-observation>[role=status]{display:none}.atelier .workbench .session-section-heading{display:none}.atelier .footer .m11-nav-item{min-height:44px;letter-spacing:normal}

.atelier .workbench .task-observation{margin-top:0}.atelier .workbench .task-observation>:where(:not([hidden])~:not([hidden])){margin-top:0}.atelier .workbench .task-observation>p:not([role]){font-size:12px;line-height:1.9;margin:0 0 16px}.atelier .workbench .task-observation>.task-facts:not([hidden]){margin:11px 0 0;padding:9px 0;border:0}.atelier .workbench .task-observation>.last-observation:not([hidden]){display:block;margin:9px 0;font-size:9px;line-height:1.7}.atelier .workbench .task-observation>.task-controls:not([hidden]){margin-top:20px;border-top:1px solid var(--w-line);padding-top:15px}.atelier .workbench .task-controls>.work-guide{border:0;background:none;color:var(--w-accent);font-size:11px;flex:0 0 auto;padding:4px 0;min-height:36px;white-space:nowrap}.atelier .workbench .task-controls>.work-primary{display:flex;justify-content:space-between;align-items:center;gap:10px;flex:1;min-height:45px;padding:10px 16px;border-radius:8px;font-size:12px;font-weight:500;letter-spacing:.12px;line-height:1.6}.atelier .workbench .task-controls>.work-primary::after{content:"↗"}.redeem-presentation.atelier{-webkit-font-smoothing:auto}.redeem-presentation.atelier .couture-motif>svg{display:inline;vertical-align:baseline}html:has(.redeem-presentation.atelier) body{background:#080b11}.atelier .topbar :is(.theme-toggle-control,.language-toggle-control){min-width:40px;min-height:40px;width:40px;height:40px;padding:10px!important;border:1px solid color-mix(in srgb,var(--a-ink) 15%,transparent);border-radius:50%;background:color-mix(in srgb,var(--a-bg) 35%,transparent);box-shadow:none;margin-left:-15px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center}.atelier .topbar .theme-toggle-control svg{width:19px;height:19px;stroke-width:1.4}.atelier .topbar .language-toggle-control svg{width:16px;height:16px;stroke-width:1.2}.redeem-presentation.atelier:not(.query-page) #site-navigation>a[aria-current=page]{font-weight:400;letter-spacing:normal}
</style>


<style>
.m19-tier-dialog{color:var(--ink)}
.m19-tier-dialog .m19-tier-row{display:flex;flex-direction:column;align-items:flex-start;gap:5px;padding:12px 0;border-bottom:1px solid var(--brd);line-height:1.6;min-width:0}
.m19-tier-dialog .m19-tier-row:last-child{border-bottom:0}
.m19-tier-dialog .m19-tier-row strong{display:block;color:var(--ink);font-size:16px;font-weight:600;white-space:normal;overflow-wrap:anywhere}
.m19-tier-dialog .m19-tier-row span{display:block;color:var(--ink-2);font-size:14px;white-space:normal;overflow-wrap:anywhere}
.atelier .workbench .cdk-result{background:none;border:0;border-top:1px solid var(--w-line);padding:10px 0;font-size:11px}.atelier .cdk-result-valid{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px}.atelier .cdk-result-valid>*{margin:0!important}.atelier .cdk-result-valid>.flex{gap:8px;font-size:10px}.atelier .cdk-result-valid>.cdk-detail-hint{display:none}.atelier .cdk-result-valid>.font-semibold{font-size:11px}
.atelier .account-entry>.session-help{display:flex;flex-direction:row;align-items:center;justify-content:space-between;padding:0;background:none;gap:12px;margin:0 0 16px}.atelier .session-help .font-medium{font-size:11px}.atelier .session-help .text-xs{font-size:10px;line-height:1.7}.atelier .session-help>a{border:0;font-weight:400;font-size:10px;padding:0;min-height:36px}.atelier .session-input-hint{font-size:10px;line-height:1.8;margin-top:9px}.atelier .account-entry>.session-warning{background:none!important;border:0;padding:0;color:var(--w-muted)!important;font-size:10px;line-height:1.85}.atelier .account-entry>.form-group{margin:0}.atelier .account-entry textarea.work-input{display:block;min-height:98px;font-size:12px;line-height:1.7;margin-top:0}.atelier .account-entry>#recharge-session-precheck-status{padding:9px 0;font-weight:400}.atelier .account-entry>#recharge-session-precheck-status strong{font-weight:400}
.atelier .review-entry>.review-intro{margin:0 0 12px;font-size:10px;line-height:1.85}.atelier .review-entry>.review-list{padding:0;background:none;border:0}.atelier .review-entry>.review-list>div{margin:0;padding:10px 0;border-bottom:1px solid var(--w-line);gap:12px;font-size:11px;line-height:1.8}.atelier .review-entry>.review-list>.review-legacy-detail{display:none}.atelier .review-entry>.review-list>div>span:last-child{font-weight:400;overflow-wrap:anywhere;text-align:right;min-width:0}.atelier .review-entry>.agreement{display:block;padding:0;background:none;border:0;border-radius:0;gap:8px;margin:0 0 9px;font-size:11px;line-height:1.6}.atelier .review-entry>.agreement>span{font-size:11px;line-height:1.6}.atelier .review-entry>.agreement input{width:16px;height:16px;margin:0;vertical-align:middle}
.atelier .account-entry>.session-section-heading+*,.atelier .review-entry>.session-section-heading+*{margin-top:0}.atelier .workbench :is(.account-cta,.review-cta){gap:15px;align-items:center;margin-top:17px}.atelier .workbench :is(.account-cta,.review-cta)>.work-primary{display:flex;align-items:center;justify-content:space-between;gap:10px;flex:1;min-height:45px;padding:10px 16px;border-radius:8px;font-size:12px;font-weight:500;line-height:1.6}.atelier .workbench .account-return{margin-top:8px;padding:0;font-size:10px;font-weight:400;background:none;border:0;color:var(--w-muted)}
.atelier .workbench .challenge-host{margin:20px 0 0;padding:18px 0 0;border:0;border-top:1px solid color-mix(in srgb,var(--w-warn) 45%,transparent);border-radius:0;background:none;box-shadow:none}.atelier .workbench .challenge-host>p{font-size:11px;line-height:1.9;color:var(--w-muted)}.atelier[data-work-phase=challenge] .challenge-host>h3{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);margin:0;padding:0}.atelier .challenge-caption{display:flex;align-items:center;justify-content:space-between}.atelier .workbench .challenge-host .btn-primary{min-height:45px;border-radius:8px;font-size:12px;font-weight:500}.atelier .workbench .challenge-host .btn-secondary{font-size:10px;padding:0;border:0;background:none}
.atelier .workbench .task-observation>.task-read-error{display:block!important;margin:12px 0;font-size:11px;line-height:1.9}.atelier[data-work-phase=challenge] .task-observation>p:not([role]){display:none}.atelier .workbench .challenge-host>.challenge-policy{display:none}.atelier .workbench .challenge-host>.challenge-actions{display:flex;flex-direction:column;align-items:stretch;gap:10px}.atelier .workbench .challenge-actions>.btn-primary{display:flex;justify-content:space-between;align-items:center;padding:10px 16px}.atelier .workbench .challenge-actions>.btn-secondary{align-self:flex-start;min-height:36px}.atelier .challenge-host>.challenge-timer{display:flex;align-items:center;justify-content:space-between;margin-top:10px}.atelier .challenge-timer time{font-family:ui-monospace,monospace}
@media(max-width:700px){.atelier .review-entry>.review-list>div,.atelier .review-entry>.agreement>span{font-size:12px}.atelier .account-entry textarea.work-input{font-size:16px}}
</style>

<style>
.atelier .topbar>.theme-toggle-control{margin-left:0}.atelier .topbar .language-toggle-control{margin-left:0}@media(max-width:700px){.atelier .topbar :is(.theme-toggle-control,.language-toggle-control){width:38px;height:40px;min-width:38px;min-height:40px;padding:9px!important;margin-left:0}.atelier .topbar>.theme-toggle-control,.atelier .topbar .language-toggle-control{margin-left:0}}
</style>

<style>
.atelier .cdk-entry>.cdk-input-row{margin-top:0}.atelier .cdk-input-row .form-group{margin-bottom:0}.atelier .cdk-input-row input.work-input{margin-top:0}.atelier .cdk-entry>.field-hint{margin:9px 0 0;font-size:10px;line-height:1.85}.atelier .workbench>.guide-line{margin-top:16px}.atelier .workbench>.work-bottom{justify-content:flex-end}.atelier[data-phase=success] .workbench .task-observation>.receipt-host-m19{margin:20px 0 16px}.atelier .receipt-origin-m19{display:block;margin-top:7px;color:var(--a-muted);font-size:9px;line-height:1.5;opacity:.82}
.atelier .task-detail-completed{display:flex;align-items:center;min-height:36px}@media(max-width:700px){.atelier .workbench>.guide-line{margin-top:12px}}@media(max-width:540px){.atelier[data-phase=success] .workbench .task-observation>.receipt-host-m19{margin-top:15px}}
.atelier .cdk-input-row .form-group{display:contents}.atelier .cdk-input-row label{grid-column:1/-1;margin-bottom:0}.atelier .cdk-input-row input{grid-column:1}.atelier .cdk-input-row .cdk-verify{grid-column:2;height:auto;min-height:49px;align-self:stretch}@media(max-width:700px){.atelier .workbench .cdk-input-row{grid-template-columns:minmax(0,1fr)76px}.atelier .cdk-input-row label{font-size:12px}}
.atelier .workbench .cdk-input-row>.cdk-verify.work-primary{justify-content:center;gap:0;padding:0 8px;white-space:normal}.atelier .workbench .cdk-input-row>.cdk-verify.work-primary>span{font-size:12px;line-height:1.4;white-space:normal}
</style>

<style>
.atelier.query-page .billing-mode-switch.query-tabs{display:flex;flex-direction:row;flex-wrap:nowrap;align-items:stretch;padding:0;gap:18px;margin-bottom:24px;border:0;border-bottom:1px solid var(--w-line);border-radius:0;background:none;box-shadow:none}
.atelier.query-page .billing-mode-switch.query-tabs .billing-mode-btn{width:auto;flex:0 1 auto;min-height:42px;justify-content:flex-start;padding:8px 0 12px;font-size:12px;font-weight:400;border-radius:0;background:none;box-shadow:none}
.atelier.query-page .billing-mode-switch.query-tabs :is(svg,.billing-mini-tag){display:none}
.atelier.query-page .billing-result-region.query-result{margin-top:28px;padding-top:20px}
.atelier.query-page :is(.billing-result-meta,.billing-result-card,.billing-empty-card,.billing-stat-box){background:none;border:0;border-radius:0;box-shadow:none}
.atelier.query-page .billing-result-meta{padding:0;font-size:10px;color:var(--w-muted)}
.atelier.query-page .billing-result-card{border-bottom:1px solid var(--w-line);overflow:visible}
.atelier.query-page .billing-result-card .billing-card-header{background:none;padding:8px 0;color:var(--w-ink)}
.atelier.query-page .billing-card-header :is(.text-white,span){color:var(--w-ink)}
.atelier.query-page .billing-result-card>div:not(.billing-card-header){padding:10px 0;font-size:12px}
.atelier.query-page .history-task-details.query-facts{display:block;padding:0;background:none;border-radius:0}
.atelier.query-page .history-task-details.query-facts>div{display:flex;align-items:baseline;justify-content:space-between;padding:10px 0;gap:15px;border-bottom:1px solid var(--w-line)}
.atelier.query-page .history-task-details.query-facts :is(dt,dd){font-size:12px}
.atelier.query-page .history-task-details.query-facts dt{color:var(--w-muted);flex-shrink:0}
.atelier.query-page .history-task-details.query-facts dd{margin:0;text-align:right;overflow-wrap:anywhere}
.atelier.query-page .query-identity .after-card{display:block;margin:0}
.atelier.query-page .footer .m11-nav-item{min-height:35px}
.atelier.query-page .guide-line{margin-top:12px}
.atelier.query-page .workbench>.guide-line .work-guide{color:var(--w-accent);font-size:11px}
</style>

<style>
.atelier .workbench .account-entry{display:flex;flex-direction:column;position:relative}.atelier .account-entry>*{margin-top:0}.atelier .workbench .account-entry>.session-help{display:contents}.atelier .account-entry>.session-help>div{order:0;display:flex;align-items:center;min-height:48px;padding:0 0 15px;margin:0 0 15px;border-bottom:1px solid var(--w-line)}.atelier .account-entry>.session-help>div p{display:flex;gap:10px;font-size:11px;line-height:1.6;font-weight:400;color:var(--w-accent)}.atelier .account-entry>.form-group{order:1}.atelier .account-entry>.form-group>label{display:block;margin:0 0 9px;font-weight:400;text-transform:none;letter-spacing:normal}.atelier .account-entry>.form-group>.session-input-hint{margin:10px 0 7px;line-height:1.85}.atelier .account-entry>.alert{order:2}.atelier .account-entry>.session-help>a{order:3;align-self:flex-start;min-height:36px;margin:0;padding:0;border:0!important;display:flex;align-items:center}.atelier .account-entry>#recharge-session-precheck-status{order:4}.atelier .account-entry>.account-cta{order:5}.atelier .account-entry>.account-change-code{position:absolute;right:0;top:0;margin:0;min-height:32px;padding:1px 6px}.atelier .account-entry>.session-precheck-empty{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:0!important;overflow:hidden;clip-path:inset(50%);border:0!important}.atelier .review-list .font-mono{font-family:var(--r-ui)}
.atelier[data-work-phase=challenge] .task-observation>.last-observation{display:block!important}.atelier[data-work-phase=challenge] .task-observation>.task-controls{display:none!important}.atelier .workbench .challenge-host>:where(:not([hidden])~:not([hidden])){margin-top:0}.atelier .workbench .challenge-host>.challenge-description{margin:8px 0 13px}.atelier .workbench .challenge-host>.origin-note{margin:0 0 13px;padding:10px 0}.atelier .origin-note span{display:block;margin:0;color:var(--w-muted)}.atelier .origin-note strong{font-size:11px;font-weight:400}.atelier .workbench .challenge-host>.challenge-timer{margin:13px 0 0;padding:10px 0}.atelier .workbench .challenge-host>.challenge-next{display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:15px;margin:7px 0 0}.atelier .workbench .challenge-next>.btn-secondary{min-height:36px;padding:0;border:0;background:none;font-size:10px;font-weight:400}.atelier .workbench .challenge-host>.work-guide{min-height:36px;padding:4px 0;border:0;background:none;font-size:11px;color:var(--w-accent)}.atelier .workbench .challenge-host>.challenge-footnote{border-top:1px solid var(--w-line);padding-top:10px;margin-top:10px;font-size:10px!important}
@media(max-width:700px){.atelier .workbench .challenge-host{margin:17px 0 0;padding:17px 0 0}.atelier .workbench .challenge-host>p{font-size:12px}.atelier .workbench .challenge-host .btn-primary{min-height:48px}.atelier .workbench .challenge-host>.work-guide{min-height:39px}}
</style>

<style>
.atelier .m14-music-toggle[data-audio-state=blocked]{text-decoration:underline;text-decoration-style:dotted;text-underline-offset:5px}
.atelier .visitor-dialog{box-sizing:border-box;flex:none}
</style>

<style>
.atelier.query-page .workbench :where(form.card)>:where(:not([hidden])~:not([hidden])),.atelier.query-page .workbench :where(section[role=search])>:where(:not([hidden])~:not([hidden])){margin-top:0}
.atelier.query-page .workbench textarea.work-input{min-height:82px;font-family:ui-monospace,monospace;display:block}
.atelier.query-page .workbench .billing-input-tag{display:none}
.atelier.query-page .workbench .query-actions{margin-top:15px;gap:20px;flex-wrap:nowrap}
.atelier.query-page .workbench .query-actions>.work-primary{padding:12px 18px;border-radius:6px;flex:1;display:flex;justify-content:space-between;font-weight:500}
.atelier.query-page .workbench .query-actions>.work-guide{border:0;border-radius:0;padding:0;background:none;color:var(--w-accent);font-size:11px;flex:none;min-height:36px}
.atelier.query-page .workbench .query-help{margin-top:12px;font-size:11px;line-height:1.8}
.atelier.query-page .workbench .query-help>button{border:0;background:none;padding:5px 0;color:var(--w-accent);font-size:11px}
.atelier.query-page .workbench label{display:block;margin-bottom:9px}
.atelier.query-page .workbench .form-group{margin-bottom:0}
.atelier.query-page .workbench .query-tabs{font-size:12px;border-bottom:1px solid var(--w-line);margin-bottom:24px}
@media(max-width:760px){.atelier.query-page .workbench textarea.work-input{font-size:16px}}
</style>

<style>
.atelier[data-stage][data-visitor-light].redeem-preferences-backdrop{background:#03060bbb!important;width:calc(100% - var(--modal-viewport-gap,0px));right:auto;position:fixed;min-height:0;overflow:visible;inset:0;font-family:var(--r-ui);-webkit-font-smoothing:auto}
.atelier .cdk-entry.cdk-confirmed{position:relative}
.atelier .cdk-confirmed>.cdk-result{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);margin:0;padding:0;border:0}
.atelier .cdk-confirmed .cdk-verify{visibility:hidden}
.atelier .cdk-confirmed>.cdk-next{position:absolute;top:26.6px;right:0;width:72px;height:49px;min-height:49px;margin:0;padding:0;font-size:12px;font-weight:500;white-space:nowrap}
.atelier.query-page .workbench #history-batch-cdk-codes{min-height:82px}
@media(max-width:700px){.atelier .cdk-confirmed>.cdk-next{top:28.2px;width:76px}}
</style>

<style>
.redeem-presentation.atelier .billing-shell{padding:0}
/* 沿用原展示列底部留白；原型演示控件不进入业务 DOM。 */
.atelier.query-page .query-content{padding-bottom:69px}
.atelier.query-page .query-identity .after-card{min-height:0}
.atelier.query-page .workbench textarea.work-input{line-height:1.7}
.atelier.query-page .query-actions>.work-primary:disabled{opacity:1}
@media(max-width:1050px){.atelier:not(.query-page) .footer #footer-copy{display:inline-flex;align-items:center;min-height:35px}}
@media(max-width:760px){.atelier.query-page .workbench textarea.work-input{line-height:1.5}}
</style>

<style>
.atelier .m14-music-toggle{position:relative;padding:1px 6px}
.atelier .m14-music-toggle[data-audio-label]{padding-inline:0;gap:6px}
.atelier .m14-music-toggle[data-audio-label]::after{content:attr(data-audio-label);position:static;display:block;font:inherit;letter-spacing:inherit;text-decoration:underline;text-underline-offset:2px;white-space:nowrap}
@media(max-width:700px){.atelier:not(.query-page) .footer .m14-music-toggle{font-size:8px}}
@media(min-width:361px) and (max-width:700px){.atelier:not(.query-page) #footer-links:has(>.m14-music-toggle[data-audio-label]){column-gap:15.75px}}
</style>

<style>
.atelier[data-stage=dawn][data-visitor-light=day] .workbench .work-input{background:#fff8}
</style>

<style>
.atelier:not(.query-page) .footer .m14-music-toggle{font-size:9px}
@media(min-width:701px){.atelier:not(.query-page) .footer::after{content:"";width:19em;font-size:9px;flex-shrink:0}}
@media(max-width:700px){.atelier:not(.query-page) .footer .m14-music-toggle{font-size:8px}}
</style>

<style>
.atelier .identity-zone .digest-edition[data-pro-information]{letter-spacing:0!important}.atelier .identity-zone .digest-edition[data-pro-information]>span{display:block}
/* 新增说明使用原字号/行高，消耗原卡密前留白，保留套餐卡比例。 */
.atelier .identity-zone .card-stage:has(.digest-edition[data-pro-information]) .key-engraving{margin-top:1.953125px!important}
@media(max-width:700px){.atelier .identity-zone .card-stage:has(.digest-edition[data-pro-information]) .key-engraving{margin-top:0!important}.atelier .identity-zone .digest-edition[data-pro-information]{margin-top:6.6015625px!important}}
/* 小屏保留新增说明的文字留白；主兑换的标题、卡密与印记在下面回归原参考位置。 */
@media(max-width:360px){.atelier .identity-zone .card-stage:has(.digest-edition[data-pro-information]) .card-orbit{min-height:177px!important}.atelier .identity-zone .digest-edition[data-pro-information]{margin-top:3.6015625px!important}.atelier .identity-zone .card-stage:has(.digest-edition[data-pro-information]) .card-digest{padding-top:15px!important;padding-bottom:11px!important}.atelier .identity-zone .card-stage:has(.digest-edition[data-pro-information]) .digest-family{margin-bottom:0!important}}
@media(max-width:360px){.atelier:not(.query-page) .identity-zone .card-stage:has(.digest-edition[data-pro-information]) .digest-status{bottom:-5.5px}}
/* 只移动四组文字；完成印记补偿原锚点，状态与计时不参与平移。 */
@media(max-width:360px){.atelier:not(.query-page) .identity-zone .card-stage:has(.digest-edition[data-pro-information]) .card-digest>:is(.digest-family,.digest-product,.digest-edition,.key-engraving){translate:0 -1.5px}.atelier:not(.query-page) .identity-zone .card-stage:has(.digest-edition[data-pro-information]) .digest-seal{bottom:20.5px}}
</style>
<style>
/* 320px Claude 确认卡：保留原字体、卡比例和状态锚点，只压缩内部留白。 */
@media(max-width:320px){
 .atelier:not(.query-page) .identity-zone .card-stage[data-summary-mode=true][data-product=claude-pro][data-phase=review]:not(:has(.elapsed-row:not([hidden]))) .card-digest{padding:0 0 12px}
 .atelier:not(.query-page) .identity-zone .card-stage[data-summary-mode=true][data-product=claude-pro][data-phase=review]:not(:has(.elapsed-row:not([hidden]))) .digest-family{margin-bottom:2px}
 .atelier:not(.query-page) .identity-zone .card-stage[data-summary-mode=true][data-product=claude-pro][data-phase=review]:not(:has(.elapsed-row:not([hidden]))) .digest-edition{margin-top:2px!important}
 .atelier:not(.query-page) .identity-zone .card-stage[data-summary-mode=true][data-product=claude-pro][data-phase=review]:not(:has(.elapsed-row:not([hidden]))) .key-engraving{margin-top:2px}
 .atelier:not(.query-page) .identity-zone .card-stage[data-summary-mode=true][data-product=claude-pro][data-phase=review]:not(:has(.elapsed-row:not([hidden]))) .card-footer{margin-top:2px;padding-top:2px}
}
</style>
<style>
/* 窄屏 Pro100 / Pro200 / Pro500 确认卡：完整换行说明需额外高度，原字号、徽章和上下外缘留白保持。 */
@media(max-width:820px){
 .atelier:not(.query-page) .identity-zone .card-stage[data-summary-mode=true]:is([data-product=pro-standard],[data-product=pro-more],[data-product=pro-500])[data-phase=review]:not(:has(.elapsed-row:not([hidden]))) .card-orbit{min-height:300px!important}
 .atelier:not(.query-page) .identity-zone .card-stage[data-summary-mode=true]:is([data-product=pro-standard],[data-product=pro-more],[data-product=pro-500])[data-phase=review]:not(:has(.elapsed-row:not([hidden]))) .card-digest{padding:1px 0 14px!important}
 .atelier:not(.query-page) .identity-zone .card-stage[data-summary-mode=true]:is([data-product=pro-standard],[data-product=pro-more],[data-product=pro-500])[data-phase=review]:not(:has(.elapsed-row:not([hidden]))) .digest-family{margin-bottom:2px!important}
 .atelier:not(.query-page) .identity-zone .card-stage[data-summary-mode=true]:is([data-product=pro-standard],[data-product=pro-more],[data-product=pro-500])[data-phase=review]:not(:has(.elapsed-row:not([hidden]))) .digest-edition{margin-top:2px!important}
 .atelier:not(.query-page) .identity-zone .card-stage[data-summary-mode=true]:is([data-product=pro-standard],[data-product=pro-more],[data-product=pro-500])[data-phase=review]:not(:has(.elapsed-row:not([hidden]))) .key-engraving{margin-top:2px!important}
 .atelier:not(.query-page) .identity-zone .card-stage[data-summary-mode=true]:is([data-product=pro-standard],[data-product=pro-more],[data-product=pro-500])[data-phase=review]:not(:has(.elapsed-row:not([hidden]))) .card-digest>:is(.digest-family,.digest-product,.digest-edition,.key-engraving){translate:none}
 .atelier:not(.query-page) .identity-zone .card-stage[data-summary-mode=true]:is([data-product=pro-standard],[data-product=pro-more],[data-product=pro-500])[data-phase=review]:not(:has(.elapsed-row:not([hidden]))) .digest-status{bottom:0}
 .atelier:not(.query-page) .identity-zone .card-stage[data-summary-mode=true]:is([data-product=pro-standard],[data-product=pro-more],[data-product=pro-500])[data-phase=review]:not(:has(.elapsed-row:not([hidden]))) .card-footer{margin-top:2px;padding-top:2px}
}
@media(max-width:700px){
 .atelier:not(.query-page) .identity-zone .card-stage[data-summary-mode=true]:is([data-product=pro-standard],[data-product=pro-more],[data-product=pro-500])[data-phase=review]:not(:has(.elapsed-row:not([hidden]))) .card-orbit{min-height:229px!important}
}
@media(max-width:360px){
 .atelier:not(.query-page) .identity-zone .card-stage[data-summary-mode=true]:is([data-product=pro-standard],[data-product=pro-more],[data-product=pro-500])[data-phase=review]:not(:has(.elapsed-row:not([hidden]))) .card-orbit{min-height:221px!important}
}
@media(min-width:701px) and (max-width:820px){
 .atelier:not(.query-page) .identity-zone .card-stage[data-summary-mode=true]:is([data-product=pro-standard],[data-product=pro-more],[data-product=pro-500])[data-phase=review]:not(:has(.elapsed-row:not([hidden]))) .card-digest{padding-bottom:18px!important}
}
</style>

<style>
/* Teleported menu owns its layout; it must not depend on a desktop .atelier ancestor. */
.public-navigation-panel{max-height:calc(100dvh - 32px);overflow-y:auto;overscroll-behavior:contain;color:var(--ink)}
.public-navigation-panel .m11-menu-links{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;min-width:0}
.public-navigation-panel .m11-menu-links>a{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:5px;width:100%;min-width:0;min-height:60px;padding:13px 15px;border:1px solid var(--brd);border-radius:10px;color:var(--ink);text-decoration:none;white-space:normal;overflow-wrap:anywhere;line-height:1.6}
.public-navigation-panel .m11-nav-label{font-size:15px;font-weight:600}.public-navigation-panel .m11-nav-description{font-size:12px;color:var(--ink-2);line-height:1.7}
.public-navigation-panel .modal-close{min-width:44px;min-height:44px}
.learn-presentation{min-height:100dvh}.learn-presentation[data-template=classic]{background:var(--surface);--a-ink:var(--ink);--a-muted:var(--ink-2);--a-accent:var(--accent);--a-bg:var(--surface)}.learn-presentation .learn-shell{position:relative;z-index:2;width:min(1240px,100%);margin:0 auto;padding:26px 32px 60px}
@media(max-width:760px){
 .redeem-presentation.atelier #site-navigation{display:none!important}
 .redeem-presentation.atelier .m11-nav-trigger{display:inline-flex!important;align-items:center;justify-content:center;gap:5px;min-width:44px;min-height:44px;flex-shrink:0}
 .redeem-presentation.atelier .topbar{gap:8px;flex-wrap:wrap;padding-left:16px;padding-right:16px}
 .redeem-presentation.atelier .topbar .brand{min-width:0;margin-right:auto;overflow-wrap:anywhere}
 .redeem-presentation.atelier .topbar :is(.theme-toggle-control,.language-toggle-control){width:44px;height:44px;min-width:44px;min-height:44px;margin-left:0}
 .learn-presentation .learn-shell{padding:16px 16px 40px}
}
</style>
