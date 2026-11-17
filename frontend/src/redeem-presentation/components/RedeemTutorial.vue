<template>
 <ModalDialog :animate="false" :preserve-scrollbar="theme!=='classic'" :open="open" :title="showVideo?t('m19.video'):content?.guide.title??guide.title" :panel-class="`modal redeem-tutorial-panel ${showVideo?'m11-video-modal':''}`" :panel-style="panelStyle" backdrop-class="atelier redeem-tutorial-backdrop" :backdrop-attributes="{'data-stage':theme==='classic'?'atelier':theme,'data-visitor-light':dark?'night':'day','data-visitor-fonts':String(content?.visitorDefaults.onlineFonts??false),'data-font-style':content?.visitorDefaults.fontStyle||'editorial'}" :backdrop-style="{...panelStyle,background:'#03060bbb',backdropFilter:'blur(6px)'}" @close="$emit('close')">
  <template #header="{close,titleId}"><header class="modal-head"><div><p v-if="showVideo" class="m11-kicker">REDEEMAI / LEARN</p><h2 :id="titleId">{{ showVideo?t('m19.tutorialTitle'):content?.guide.title??guide.title }}</h2><p v-if="showVideo" class="m11-video-meta">{{ t('m19.tutorialDescription') }}</p></div><button type="button" class="modal-close" :aria-label="t('m19.closeTutorial')" @click="close">×</button></header></template>
  <div class="tutorial-content">
   <template v-if="showVideo">
    <div class="m11-video-layout"><section class="m11-screen">
     <div class="m11-video-screen"><video ref="video" :src="localVideo||tutorialVideo" controls playsinline preload="none" :poster="'/media/redeem/m19/poster.jpg'" :aria-label="t('m19.tutorialTitle')" @play="mediaPlaying" @playing="playbackReady" @pause="mediaPaused" @ended="mediaPaused" @timeupdate="syncChapter" @loadedmetadata="metadataReady" @error="failVideo"><track default kind="subtitles" srclang="zh-CN" label="简体中文" :src="'/media/redeem/m19/captions.zh-CN.vtt'" /></video></div>
     <div class="m11-player-controls"><button type="button" @click="startVideo">▷ {{ t('m19.videoStart') }}</button><button type="button" @click="seek(0)">{{ t('m19.videoRestart') }}</button><span class="m11-play-progress">{{ stamp(currentTime) }} / 01:52</span></div>
     <p class="m11-media-status" :class="{'is-error':videoError}" role="status">{{ t(videoError?'m19.videoUnavailable':videoReady?'m19.videoReady':'m19.videoPrompt') }}</p>
     <p class="m11-video-meta">M1.9 · {{ t('m19.tutorialVersion') }} · {{ t('m19.videoVersion') }}</p>
     <div class="m11-player-controls"><button type="button" @click="fileInput?.click()">{{ t('m19.selectLocalVideo') }}</button><button type="button" @click="readGuide">{{ t('m19.readIllustratedGuide') }} ↗</button><input ref="fileInput" type="file" accept="video/mp4,video/webm,.mp4,.webm" hidden @change="selectLocalVideo" /></div>
    </section><aside class="m11-chapter-panel"><h3>{{ t('m19.watchByChapter') }}</h3><nav :aria-label="t('m19.videoChapters')" class="m11-chapters tutorial-chapters"><button v-for="(chapter,i) in chapters" :key="chapter.at" type="button" class="m11-chapter" :aria-current="step===i?'step':undefined" @click="seek(i)"><time>{{ stamp(chapter.at) }}</time><span>{{ chapter.chapter }}</span></button></nav></aside></div>
    <section class="m11-transcript" aria-live="polite"><h3>{{ chapterCopy?.title || chapters[step].chapter }}</h3><p id="m11-active-copy">{{ chapterCopy?.body || chapters[step].text }}</p><small>{{ chapters[step].note }}</small></section>
   </template>
   <template v-else>
    <p class="result-note">{{ shownGuide.intro }}</p>
    <nav :aria-label="t('m19.guideSteps')" class="guide-steps tutorial-chapters"><button v-for="(item,i) in guideSteps" :key="item.id" type="button" :aria-current="guideIndex===i?'step':undefined" @click="selectGuide(i)">{{ i+1 }} {{ item.title }}</button></nav>
    <section class="guide-body"><img v-if="TUTORIAL_IMAGES_AVAILABLE && guideMeta" class="guide-real-image" :src="`/media/redeem/m19/step-${guideMeta.id}.jpg`" :alt="t('m19.exampleNotice')" loading="lazy" /><h3>{{ guideSteps[guideIndex].title }}</h3><p>{{ guideSteps[guideIndex].body }}</p><aside v-if="guideNote" class="guide-note">{{ guideNote }}</aside><div class="guide-next-row"><button type="button" :disabled="guideIndex===0" @click="selectGuide(guideIndex-1)">← {{ t('m19.previousStep') }}</button><button v-if="MUSIC_AVAILABLE" type="button" :aria-pressed="redeemMusic.playing.value" @click="toggleRedeemMusic">♫ {{ t(redeemMusic.playing.value||redeemMusic.pending.value?'m19.musicStop':'m19.musicPlay') }}</button><button type="button" :disabled="guideIndex===guideSteps.length-1" @click="selectGuide(guideIndex+1)">{{ t('m19.nextStep') }} →</button></div></section>
    <div v-if="TUTORIAL_VIDEO_AVAILABLE" class="m11-guide-video"><span>{{ t('m19.challengeVideoPrompt') }}</span><button type="button" class="m11-player-link" @click="openVideo">{{ t('m19.watchChallenge') }} ▷</button></div>
    <div v-if="faqs.length" class="faq-list"><details v-for="faq in faqs" :key="faq.id"><summary>{{ faq.question }}</summary><p>{{ faq.answer }}</p></details></div>
   </template>
  </div>
 </ModalDialog>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ModalDialog from './ModalDialog.vue'
import chapters from '../presets/chapters.json'
import guide from '../visuals/redeem/guide.json'
import { redeemMusic, toggleRedeemMusic, pauseRedeemMusic, blockRedeemMusic } from '../utils/redeemMusic'
import { type RedeemContent, type RedeemTheme } from '../utils/redeemPresentation'
// 本站接入：媒体降级开关；教程提示优先取本站内容里的 note（原 guide.json 的提示讲的是原项目界面）。
import { MUSIC_AVAILABLE, TUTORIAL_IMAGES_AVAILABLE, TUTORIAL_VIDEO_AVAILABLE } from '../config'
const props=withDefaults(defineProps<{open:boolean;initialEntry?:'guide'|'video'|'challenge';content:RedeemContent|null;theme:RedeemTheme;dark:boolean;panelStyle:Record<string,string>}>(),{initialEntry:'guide'})
defineEmits<{close:[]}>()
const {t}=useI18n({useScope:'global'})
const step=ref(0),showVideo=ref(false),video=ref<HTMLVideoElement|null>(null),fileInput=ref<HTMLInputElement|null>(null),videoError=ref(false),videoReady=ref(false),currentTime=ref(0),localVideo=ref('')
const tutorialVideo='/media/redeem/m19/RedeemAI_M19_Complete_Guide_1080p.mp4'
let pendingTime=0,mediaVersion=0,loadVersion=0,alive=true
let loadDeadline:ReturnType<typeof setTimeout>|null=null,playDeadline:ReturnType<typeof setTimeout>|null=null,finishPlayWait:(()=>void)|null=null
const hidden=()=>{if(document.hidden){invalidateMediaWaits();video.value?.pause();blockRedeemMusic('video',false)}}
document.addEventListener('visibilitychange',hidden)
// 六步图文与十三章视频共用章节时钟；未知章节仍归等待步骤。
const chapterToGuide=[0,0,1,2,3,4,4,4,3,5,5,5,5]
const guideStarts=[0,2,3,4,5,9]
const guideIndex=ref(0)
const previousGuideBodies=['找到卡片右边的“CDK / 兑换码”，粘贴整段卡密，再点“验证”。卡片翻过来后，看看显示的是不是你买的套餐。','识别成功后，在右侧粘贴目标账号的材料。先确认当前登录的是你要兑换的账号，再点“预检账号并继续”。这些材料不要发到聊天或公开截图里。','重点看账号和套餐。兑换点数时，还要核对数量、金额和报价有效期。确认无误后勾选确认项，点一次“确认本次兑换”。报价过期时返回重新预检。','看到任务编号，就说明请求已经受理。卡片边上的光会继续流动，时间表示已经等了多久，不是还剩多久。中途可能需要你操作，先别关掉页面。','看到“请完成人机验证”，点击这笔订单下方的入口。在新页面完成验证，再回到这里查看原任务。','显示“兑换已完成”后，卡片保留本次回执，右侧会显示“账单与凭证”。点击“查看账单”在线查看，点击“下载账单 PDF”保存文件。要看套餐和到期时间，用顶部“订阅查询”；要查这笔兑换，用“状态查询”。']
const shownGuide=computed(()=>{const remote=props.content?.guide;if(!remote?.steps)return guide;const steps=remote.steps;const previous=remote.intro==='先粘贴卡密，核对账号和套餐。页面提示需要人机验证时，再按当前入口操作。'&&steps.length===previousGuideBodies.length&&steps.every((item,i)=>item.title===guide.steps[i].title&&item.body===previousGuideBodies[i]);return previous?{...remote,intro:guide.intro,steps:guide.steps.map(({id,title,body})=>({id,title,body}))}:remote})
const guideSteps=computed(()=>shownGuide.value.steps)
const canonicalID=(id:string)=>id==='enter'?'code':id==='receipt'?'result':id
const guideMeta=computed(()=>{const id=guideSteps.value[guideIndex.value]?.id;if(!id)return;const chapter=/^chapter-(\d+)$/.exec(id);return chapter?guide.steps[chapterToGuide[Math.min(12,Math.max(0,Number(chapter[1])-1))]]:guide.steps.find(item=>item.id===canonicalID(id))})
const guideNote=computed(()=>{const custom=(guideSteps.value[guideIndex.value] as {note?:string}|undefined)?.note;return custom!==undefined?custom:guideMeta.value?.note})
const chapterCopy=computed(()=>{const steps=guideSteps.value,specific=steps.find(item=>item.id===`chapter-${step.value+1}`);if(specific)return specific;const original=guide.steps[chapterToGuide[step.value]],custom=steps.find(item=>canonicalID(item.id)===original.id);return custom&&(custom.title!==original.title || custom.body!==original.body)?custom:undefined})
const faqs=computed(()=>(props.content?.guide.faq ?? guide.faq).filter(item=>item.question!=='切换外观，会丢掉当前操作吗？'))
function selectGuide(i:number){guideIndex.value=Math.max(0,Math.min(guideSteps.value.length-1,i));const id=guideSteps.value[guideIndex.value].id,chapter=/^chapter-(\d+)$/.exec(id),group=guide.steps.findIndex(item=>item.id===canonicalID(id));seek(chapter?Number(chapter[1])-1:guideStarts[group<0?Math.min(5,guideIndex.value):group])}
function syncGuide(){const steps=guideSteps.value,original=guide.steps[chapterToGuide[step.value]],specific=steps.findIndex(item=>item.id===`chapter-${step.value+1}`),group=steps.findIndex(item=>canonicalID(item.id)===original.id);guideIndex.value=specific>=0?specific:group>=0?group:Math.min(guideIndex.value,steps.length-1)}
watch(step,()=>{if(showVideo.value)syncGuide()})
watch(guideSteps,(steps,previous)=>{const id=previous?.[guideIndex.value]?.id,index=steps.findIndex(item=>item.id===id);guideIndex.value=index>=0?index:Math.max(0,Math.min(guideIndex.value,steps.length-1));if(showVideo.value)syncGuide()},{deep:true,flush:'sync'})
const stamp=(seconds:number)=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`
// 视频源与播放各有一次性期限，关闭/换源/hidden 会失效旧回调；不自动重试。
function clearLoadDeadline(){if(loadDeadline!==null)clearTimeout(loadDeadline);loadDeadline=null}
function clearPlayDeadline(){if(playDeadline!==null)clearTimeout(playDeadline);playDeadline=null;const finish=finishPlayWait;finishPlayWait=null;finish?.()}
function invalidateMediaWaits(){mediaVersion++;loadVersion++;clearLoadDeadline();clearPlayDeadline()}
function currentMedia(event?:Event){const media=video.value;if(!alive||!props.open||!showVideo.value||document.hidden||!media||(event&&event.currentTarget!==media))return false;const src=media.currentSrc;if(event&&src){const base=document.baseURI||'https://redeemai.invalid/';if(new URL(src,base).href!==new URL(localVideo.value||tutorialVideo,base).href)return false}return true}
function loadVideo(){const media=video.value;if(!currentMedia()||!media)return;clearLoadDeadline();const version=++loadVersion;loadDeadline=setTimeout(()=>{loadDeadline=null;if(currentMedia()&&media===video.value&&version===loadVersion&&media.readyState<1)failVideo()},12000);media.preload='metadata';media.load()}
function waitForPlayback(media:HTMLVideoElement){const version=++mediaVersion;const limit=new Promise<void>(resolve=>{finishPlayWait=resolve;playDeadline=setTimeout(()=>{if(currentMedia()&&media===video.value&&version===mediaVersion)failVideo();resolve()},12000)});return{version,limit}}
function mediaPlaying(event:Event){const media=video.value;if(!currentMedia(event)||!media||media.paused||media.ended)return;if(playDeadline===null)waitForPlayback(media);blockRedeemMusic('video',true)}
function playbackReady(event:Event){const media=video.value;if(!currentMedia(event)||!media||media.paused||media.ended)return;clearLoadDeadline();clearPlayDeadline();videoReady.value=true;videoError.value=false;blockRedeemMusic('video',true)}
function mediaPaused(event:Event){const media=video.value;if(!currentMedia(event)||!media||(!media.paused&&!media.ended))return;mediaVersion++;clearPlayDeadline();blockRedeemMusic('video',false)}
function syncChapter(event?:Event){if(!currentMedia(event))return;const time=video.value?.currentTime||0;currentTime.value=time;step.value=time>=chapters[chapters.length-1].end?chapters.length-1:Math.max(0,chapters.findIndex(c=>time>=c.at&&time<c.end))}
function seek(i:number){step.value=Math.max(0,Math.min(chapters.length-1,i));pendingTime=chapters[step.value].at;currentTime.value=pendingTime;if(video.value?.readyState&&video.value.readyState>=1)video.value.currentTime=pendingTime}
function metadataReady(event?:Event){if(!currentMedia(event))return;clearLoadDeadline();videoReady.value=true;videoError.value=false;const media=video.value;if(media)media.currentTime=Math.min(pendingTime,Number.isFinite(media.duration)?Math.max(0,media.duration-.1):pendingTime);syncChapter()}
function openVideo(){seek(5);pendingTime=chapters[step.value].at;currentTime.value=pendingTime;videoReady.value=false;videoError.value=false;showVideo.value=true}
async function startVideo(){const media=video.value;if(!currentMedia()||!media)return;const retry=videoError.value||media.networkState===3||(media.readyState<1&&loadDeadline===null);if(playDeadline!==null)media.pause();clearPlayDeadline();videoError.value=false;blockRedeemMusic('video',true);if(retry)loadVideo();const{version,limit}=waitForPlayback(media);try{await Promise.race([media.play(),limit])}catch(error){if(!currentMedia()||version!==mediaVersion||media!==video.value||(error instanceof Error&&error.name==='AbortError'))return;failVideo()}finally{if(version===mediaVersion)clearPlayDeadline()}}
function readGuide(){invalidateMediaWaits();video.value?.pause();syncGuide();showVideo.value=false}
function selectLocalVideo(event:Event){const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;if(file.size>512*1024*1024||!(/\.(mp4|webm)$/i.test(file.name))){failVideo();return}invalidateMediaWaits();video.value?.pause();if(localVideo.value)URL.revokeObjectURL(localVideo.value);localVideo.value=URL.createObjectURL(file);videoReady.value=false;videoError.value=false;pendingTime=0;currentTime.value=0;step.value=0;const version=loadVersion;void nextTick().then(()=>{if(version===loadVersion&&currentMedia())loadVideo()})}
function failVideo(event?:Event){if(!currentMedia(event))return;invalidateMediaWaits();videoError.value=true;videoReady.value=false;video.value?.pause();blockRedeemMusic('video',false)}
watch(()=>props.open,(open,wasOpen)=>{invalidateMediaWaits();if(open){videoError.value=false;videoReady.value=false;step.value=props.initialEntry==='challenge'?Math.max(0,chapters.findIndex(chapter=>chapter.action==='challenge')):0;pendingTime=chapters[step.value].at;currentTime.value=pendingTime;showVideo.value=props.initialEntry==='video';guideIndex.value=0;syncGuide()}else{if(wasOpen)pauseRedeemMusic();video.value?.pause();showVideo.value=false;blockRedeemMusic('video',false);if(localVideo.value){URL.revokeObjectURL(localVideo.value);localVideo.value=''}}},{immediate:true})
watch(showVideo,on=>{invalidateMediaWaits();blockRedeemMusic('video',on);if(on){const version=loadVersion;void nextTick().then(()=>{if(version===loadVersion&&currentMedia())loadVideo()})}},{immediate:true})
onBeforeUnmount(()=>{alive=false;invalidateMediaWaits();document.removeEventListener('visibilitychange',hidden);video.value?.pause();blockRedeemMusic('video',false);if(localVideo.value)URL.revokeObjectURL(localVideo.value)})
</script>
<style>
.atelier[data-stage][data-visitor-light].redeem-tutorial-backdrop{background:#03060bbb!important;width:calc(100% - var(--modal-viewport-gap,0px));right:auto;position:fixed;min-height:0;overflow:visible;inset:0;-webkit-font-smoothing:auto;font-family:var(--r-ui)}
.atelier .redeem-tutorial-panel{max-width:calc(100vw - 2em - 6px);flex:none;box-sizing:border-box;font-family:var(--r-ui);backdrop-filter:none;-webkit-backdrop-filter:none}
.atelier .redeem-tutorial-panel h2{letter-spacing:normal}
.atelier .redeem-tutorial-panel h3{font-family:inherit;letter-spacing:normal}
.atelier .redeem-tutorial-panel>:not([hidden])~:not([hidden]){margin-top:0}
.atelier .redeem-tutorial-panel .modal-close{min-width:40px;min-height:40px;padding:0}
.atelier .redeem-tutorial-panel .tutorial-content{min-height:0;background:transparent;overflow:visible}
.atelier .redeem-tutorial-panel .guide-next-row span{align-self:center;font:10px ui-monospace;color:var(--a-muted)}
</style>
