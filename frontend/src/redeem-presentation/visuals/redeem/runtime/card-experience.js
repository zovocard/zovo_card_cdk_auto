/* V4.1 presentation-only theme projection and host-authoritative elapsed time.
 * No requests, no task creation, no success heuristics, no task persistence.
 * Compatible with browsers and Node tests. All timestamps are epoch milliseconds.
 */
import { ThemePalettes } from "./theme-palettes.js";

  'use strict';
  const DEFAULTS = Object.freeze({timerEnabled:true, stageLabelEnabled:true, edgeIntensity:0.85, successSettle:true, themeAdaptation:true});
  const CLOCK_COPY = Object.freeze({verification:'识别用时',success:'完成耗时',failed:'结束耗时',unknown:'提交后耗时',action:'等待操作',processing:'已耗时',pending:'待同步',pendingDetail:'时间待同步',stoppedDetail:'核验停止时的耗时',terminalDetail:'截至最终结果的耗时',runningDetail:'已耗时，非预计剩余时间'});
  const STAGES = Object.freeze({
    atelier: {light:'#e3cfaa', shade:'#0c0d12', reflector:'#fbe8c8', shadow:'#000000', edgePeriod:3.8, finish:'engraved', label:'CHAMPAGNE / GALLERY', blend:.055},
    silk: {light:'#ead5ae', shade:'#272323', reflector:'#ffedcf', shadow:'#191109', edgePeriod:4.8, finish:'satin', label:'WOVEN LIGHT / SATIN', blend:.10},
    porcelain: {light:'#f0f5ec', shade:'#435b5a', reflector:'#ffffff', shadow:'#637f77', edgePeriod:4.2, finish:'ceramic', label:'SOFT LIGHT / PLATINUM', blend:.16},
    orbit: {light:'#b9b7f5', shade:'#1b203b', reflector:'#dfddff', shadow:'#080d23', edgePeriod:2.75, finish:'calibrated', label:'SPECTRAL / CALIBRATED', blend:.13},
    verdant: {light:'#c9e7c7',shade:'#073e33',reflector:'#e8ffde',shadow:'#02221d',edgePeriod:3.7,finish:'engraved',label:'EMERALD / SCULPTED',blend:.1},
    dawn: {light:'#fff1e5',shade:'#a26f7d',reflector:'#fff5ef',shadow:'#a57887',edgePeriod:4.5,finish:'ceramic',label:'ROSE / PEARL',blend:.1},
    astral: {light:'#adcdf1', shade:'#172945', reflector:'#e4f3ff', shadow:'#06112b', edgePeriod:3.25, finish:'stardust', label:'CELESTIAL / REFLECTED', blend:.12}
  });
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  function mix(a,b,t) { const v=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16));const x=v(a),y=v(b);return '#'+x.map((c,i)=>Math.round(c+(y[i]-c)*clamp(t)).toString(16).padStart(2,'0')).join(''); }
  function preferences(p) { return {...DEFAULTS,...(p||{}),edgeIntensity:Number.isFinite(p?.edgeIntensity)?clamp(p.edgeIntensity):DEFAULTS.edgeIntensity}; }
  function palette(product,stage='atelier',enabled=true) {
    const s=STAGES[stage]||STAGES.atelier;
    const all=ThemePalettes;
    let p=product.palette;
    if(enabled&&all){
      const custom=product.themePalettes?.[stage];
      const platform=(product.family==='grok'||product.family==='x')&&all.neutral[stage]?Object.fromEntries(Object.entries(p).map(([k,v])=>[k,mix(v,all.neutral[stage][k]||v,s.blend)])):null;
      p=custom||all.defaults[stage]?.[product.id]||platform||all.neutral[stage]||p;
    }
    const lum=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).reduce((n,v,i)=>n+[.2126,.7152,.0722][i]*(v<=.04045?v/12.92:((v+.055)/1.055)**2.4),0);
    return {...p,reflector:s.reflector,shadow:s.shadow,period:s.edgePeriod,finish:s.finish,label:all?.labels[stage]||s.label,light:lum(p.ink)<lum(p.base)};
  }
  function validTimestamp(v){return typeof v==='number'&&Number.isFinite(v)&&v>0;}
  function formatDuration(ms) { const t=Math.max(0,Math.floor(ms/1000));const h=Math.floor(t/3600),m=Math.floor(t/60)%60,s=t%60;return (h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'); }
  /** Read-only clock. Creating/replacing a view never invents a start time.
   * The caller may supply a monotonic epoch clock to avoid wall-clock adjustments.
   * UNKNOWN / ACTION keep elapsed time running unless the host supplies an
   * authoritative verification stop. No view invents a stop or a completion.
   */
  function clockSnapshot(state,now=Date.now()) {
    const p=state.phase,copy={...CLOCK_COPY,...state.clockCopy};
    if(p==='verifying')return make(copy.verification,state.verificationStartedAt,null,now,'verification',false,copy);
    if(!['submitting','processing','success','failed','unknown','action'].includes(p))return {visible:false};
    const terminal=['success','failed'].includes(p),stopped=p==='unknown'&&state.taskStoppedAt!==undefined;
    const end=terminal?state.taskCompletedAt:stopped?state.taskStoppedAt:null;
    const label=copy[p]||copy.processing;
    const clock=make(label,state.taskStartedAt,end,now,terminal?'terminal':'task',terminal||stopped,copy);
    if(stopped&&!clock.pending)clock.detail=copy.stoppedDetail;
    return clock;
  }
  function make(label,start,end,now,kind,terminal,copy) {
    if(!validTimestamp(start)||!Number.isFinite(now)||start>now+1500||(terminal&&!validTimestamp(end))||(validTimestamp(end)&&end<start))return {visible:true,label,text:'— —:— —',ms:null,kind,pending:true,pendingLabel:copy.pending,detail:copy.pendingDetail};
    const ms=Math.max(0,(validTimestamp(end)?end:now)-start);
    return {visible:true,label,text:formatDuration(ms),ms,kind,pending:false,pendingLabel:copy.pending,frozen:validTimestamp(end),detail:terminal?copy.terminalDetail:copy.runningDetail};
  }
  function createMonotonicEpochClock(wall=Date.now,mono=()=>performance.now()){const base=wall(),anchor=mono();return()=>base+Math.max(0,mono()-anchor);}
  const api={DEFAULTS,STAGES,preferences,palette,mix,clockSnapshot,formatDuration,createMonotonicEpochClock};
export default api;
export { palette, clockSnapshot };
