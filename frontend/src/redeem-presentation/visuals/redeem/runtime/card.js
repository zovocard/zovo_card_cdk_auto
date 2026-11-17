import R17Tone from "./tone-m17.js";
import R13Scene from "./scene-m13.js";
/* The card is a VIEW. All business outcomes and identifiers come from the host.
 * The elapsed display timer only renders host timestamps; it cannot change a business state. */
import V41Experience from "./card-experience.js";
import V44Couture from "./card-couture.js";
import CardTheme from "./card-theme.js";
import V45Motion from "./motion-director.js";
import { neutral } from "./neutral.js";
import R45Optics from "./optical-motion.js";
import { BRAND_NAMES, brandMarkSvg, resolveProductIdentity, tierMarkSvg } from "../../product-identity/identity";

'use strict';
const PHASES=new Set(['idle','verifying','specimen','identified','review','submitting','processing','success','unknown','failed','action']);
const logo='<svg viewBox="0 0 48 42" aria-hidden="true"><path d="M5 36V6h18c21 0 21 21 0 21H5m20 0 18 12"/></svg>';
const edge='<svg class="edge-track" viewBox="0 0 760 475" preserveAspectRatio="none" aria-hidden="true"><rect class="edge-base" x="3" y="3" width="754" height="469" rx="20" pathLength="100"/><rect class="edge-trail" x="3" y="3" width="754" height="469" rx="20" pathLength="100"/><rect stroke-linecap="round" class="edge-comet" x="3" y="3" width="754" height="469" rx="20" pathLength="100"/><rect class="edge-counter" x="8" y="8" width="744" height="459" rx="16" pathLength="100"/><rect class="edge-settle" x="3" y="3" width="754" height="469" rx="20" pathLength="100"/></svg>';
const finish='<div class="card-environment" aria-hidden="true"><i class="reflection-sheet"></i><i class="material-grain"></i><svg class="theme-etch" viewBox="0 0 760 475" preserveAspectRatio="none"><g data-theme-etch></g></svg><div class="read-sweep"></div><div class="recognition-pulse"></div></div>';
const clock='<div class="elapsed-row" data-clock hidden><span class="elapsed-caption"><i class="clock-live" aria-hidden="true"></i><span data-clock-label></span></span><time data-clock-value aria-label="已耗时" aria-live="off">00:00</time></div>';

const emboss='<svg class="emboss" viewBox="0 0 180 240" aria-hidden="true">'+Array.from({length:8},(_,i)=>`<path d="M${58+i*8} 6 C${-25+i*8} 63 ${191+i*8} 106 ${58+i*8} 238"/>`).join('')+'</svg>';
function createIdentityCard(host,actions={}){
 let flipUntil=0;
 let state={phase:'idle',product:'Plus',account:'',requestId:'',identity:'RD · •••• · ••••'},destroyed=false;
 host.innerHTML=`<div class="card-tilt"><div class="card-orbit"><section class="face front">${edge}${emboss}${finish}<header class="card-brandrow"><span class="card-brand">${logo}<span data-brand>RedeemAI</span></span><span class="card-tag">DIGITAL REDEMPTION</span></header><div class="card-body"><form data-form novalidate><h2 class="formtitle" data-inputtitle>填写兑换码</h2><p class="microcopy" data-inputhint>请粘贴完整兑换码。本步只识别套餐，不会提交兑换。</p><label class="sr" for="atelier-code">兑换码</label><input id="atelier-code" class="code-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="RD — •••• — ••••" maxlength="120"><div class="actions"><button class="main-action" type="submit" data-verify><span>验证卡密</span><span aria-hidden="true">→</span></button><button class="help-action" type="button" data-guide>使用指南 ↗</button></div><p class="error-text" role="alert" data-error></p></form></div>${clock}<footer class="card-footer"><div><p class="foot-label">REDEMPTION ID</p><p class="foot-value mono" data-identity></p></div><div class="align-right"><p class="foot-label">STATE</p><p class="foot-value" data-front-state>待填写</p></div></footer></section><section class="face back" inert>${edge}${emboss}${finish}<header class="card-brandrow"><span class="card-brand">${logo}<span data-brand>RedeemAI</span></span><span class="card-tag" data-back-tag>PRODUCT RECOGNIZED</span></header><div class="card-body"><div class="state-panel" data-view="identified specimen"><p class="product-kicker" data-product-brand></p><div class="product-line"><h2 data-product>Plus</h2><span data-kind-label>订阅兑换</span></div><p class="state-caption" data-recognition>套餐已识别</p><div class="actions"><button class="main-action" type="button" data-next><span>核对账号</span><span>→</span></button><button class="help-action" type="button" data-guide>使用指南 ↗</button></div></div><div class="state-panel" data-view="review"><h2 class="formtitle">核对后再确认</h2><div class="summary"><div class="summary-row"><span>套餐</span><span data-product-full></span></div><div class="summary-row"><span>账号</span><span data-account></span></div></div><div class="summary-row amount-row" data-quantity-row hidden><span>本次点数</span><span data-quantity></span></div><label class="confirm-line"><input type="checkbox" data-confirm>我已核对本次账号与套餐</label><div class="actions"><button class="main-action" type="button" data-submit disabled><span>确认兑换</span><span>→</span></button><button class="help-action" type="button" data-guide>使用指南 ↗</button></div></div><div class="state-panel" data-view="submitting processing"><p class="product-kicker" data-product-brand></p><div class="product-line"><h2 data-product></h2><span data-processing-label>处理中</span></div><p class="state-caption">尚未返回最终结果。可离开本页，稍后用原兑换码查询；在此之前请勿重复提交或再次付款。</p><div class="actions"><button class="main-action" type="button" data-query><span>查询原任务</span><span>↗</span></button><button class="help-action" type="button" data-guide>使用指南 ↗</button></div></div><div class="state-panel" data-view="success"><p class="product-kicker" data-product-brand></p><div class="product-line"><h2 data-product></h2></div><p class="state-caption" data-account></p><p class="microcopy">套餐已记入本次账号。请勿再次提交。</p><div class="seal"><svg viewBox="0 0 32 28"><path d="m3 14 8 8L29 3"/></svg><span>已完成</span></div><div class="actions"><button class="main-action" type="button" data-query><span>查看原任务</span><span>↗</span></button><button class="help-action" type="button" data-guide>使用指南 ↗</button></div></div><div class="state-panel" data-view="unknown failed action"><h2 class="unknown-title" data-exception-title></h2><p class="state-caption" data-exception-copy></p><div class="actions"><button class="main-action" type="button" data-query><span>查询原任务</span><span>↗</span></button><button class="help-action" type="button" data-guide>使用指南 ↗</button></div></div></div>${clock}<footer class="card-footer"><div><p class="foot-label">REDEMPTION ID</p><p class="foot-value mono" data-identity></p></div><div class="align-right"><p class="foot-label">STATE</p><p class="foot-value" data-state></p></div></footer></section></div></div>`;
 host.querySelectorAll('.card-body').forEach(body=>{const d=document.createElement('div');d.className='card-digest';d.innerHTML='<p class="digest-family"></p><h2 class="digest-product"></h2><p class="digest-edition"></p><div class="key-engraving" data-no-translate><svg class="key-symbol" viewBox="0 0 20 20" aria-hidden="true"><circle cx="6" cy="7" r="3.5"/><path d="m8.5 9.5 7 7m-3-3 2-2m-4 0 2-2"/></svg><span class="key-label">CARD KEY</span><span class="key-value">••••  ••••  ••••</span></div><div class="digest-status"><i></i><span></span></div><div class="digest-seal" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m4 12 5 5L20 5"/></svg><span>已完成</span></div>';body.append(d)});
 host.querySelectorAll('.face').forEach(face=>{const chip=document.createElement('span');chip.className='card-platform';chip.setAttribute('aria-hidden','true');face.querySelector('.card-brandrow').append(chip);const mark=document.createElement('div');mark.className='card-platform-mark';mark.setAttribute('aria-hidden','true');face.prepend(mark);});
 V44Couture.mount(host);
 CardTheme.mount(host);
 R45Optics.mount(host);
 let epoch=NaN,monotonic=performance.now();
 const monotonicNow=()=>Number.isFinite(epoch)?epoch+performance.now()-monotonic:NaN;
 let clockInterval=0;
 const input=host.querySelector('#atelier-code'),form=host.querySelector('form'),box=host.querySelector('[data-confirm]'),verify=host.querySelector('[data-verify]'),submit=host.querySelector('[data-submit]');
 const listeners=[];function on(el,event,fn){el.addEventListener(event,fn);listeners.push(()=>el.removeEventListener(event,fn));}
 const run=name=>{if(!destroyed&&typeof actions[name]==='function')actions[name]({...state,code:input.value,confirmed:box.checked});};
 on(input,'input',()=>run('input'));
 on(form,'submit',e=>{e.preventDefault();if(state.phase==='idle')run('verify');});
 on(box,'change',()=>{submit.disabled=!box.checked||state.phase!=='review';});
 host.querySelectorAll('[data-guide]').forEach(el=>on(el,'click',()=>run('guide')));
 host.querySelectorAll('[data-query]').forEach(el=>on(el,'click',()=>run('query')));
 on(host.querySelector('[data-next]'),'click',()=>{if(state.phase==='specimen'){run('demoStart');return}if(state.phase==='identified')run('review');});
 on(submit,'click',()=>{if(state.phase==='review'&&box.checked)run('submit');});
 const tilt=host.querySelector('.card-tilt'),mq=matchMedia('(prefers-reduced-motion: reduce)');
 on(host,'pointermove',e=>{
  if(R13Scene||e.pointerType==='touch'||mq.matches||host.closest('[data-motion=static]')||host.contains(document.activeElement)||performance.now()<flipUntil)return;
  const b=host.getBoundingClientRect(),x=(e.clientX-b.left)/b.width-.5,y=(e.clientY-b.top)/b.height-.5;
  tilt.style.transform=`rotateX(${-y*4}deg) rotateY(${x*6}deg)`;
  host.style.setProperty('--spot-x',((x+.5)*100).toFixed(2)+'%');host.style.setProperty('--spot-y',((y+.5)*100).toFixed(2)+'%');
 });
 on(host,'pointerleave',()=>{tilt.style.transform='none';});on(host,'focusin',()=>{tilt.style.transform='none';});
 // Keep the running path on the physical rounded edge at every viewport size.
 const alignPerimeter=()=>{
  if(destroyed)return;
  const orbit=host.querySelector('.card-orbit'),w=orbit.clientWidth,h=orbit.clientHeight;
  if(!w||!h)return;
  const radius=parseFloat(getComputedStyle(host.querySelector('.face')).borderTopLeftRadius)||18;
  const inset=1.15,x=inset/w*760,y=inset/h*475;
  host.querySelectorAll('.edge-track rect').forEach(r=>{
   r.setAttribute('x',String(x));r.setAttribute('y',String(y));r.setAttribute('width',String(760-2*x));r.setAttribute('height',String(475-2*y));
   r.setAttribute('rx',String(Math.max(0,radius-inset)/w*760));r.setAttribute('ry',String(Math.max(0,radius-inset)/h*475));
  });
  V44Couture.align(host);
 };
 if(typeof ResizeObserver!=='undefined'){const ro=new ResizeObserver(alignPerimeter);ro.observe(host.querySelector('.card-orbit'));listeners.push(()=>ro.disconnect());}
 alignPerimeter();

 function setState(next){
  if(Number.isFinite(next.serverTime)&&next.serverTime!==state.serverTime){epoch=next.serverTime;monotonic=performance.now()}
  if(destroyed)return;if(next.phase&&!PHASES.has(next.phase))throw Error('Unsupported presentation phase');
  const edgePhase=V45Motion.captureEdge(host);
  const previousPhase=state.phase;state={...state,...next};const p=state.phase; if(p!==previousPhase&&p==='review')box.checked=false;host.dataset.phase=p;
  // The first code identification flips the card. Account prechecks never flip it back.
  const flipped=!['idle','verifying'].includes(p)||(state.productData?.id&&state.productData.id!=='unidentified');
  if(host.dataset.flipped!==String(!!flipped)){flipUntil=performance.now()+1120;tilt.style.transform='none';}
  host.dataset.flipped=String(!!flipped);
  host.querySelector('.front').inert=!!flipped;host.querySelector('.back').inert=!flipped;
  verify.disabled=p!=='idle';input.readOnly=p!=='idle';verify.querySelector('span').textContent=p==='verifying'?'识别中…':state.verifyLabel||'验证卡密';
  const labels={specimen:'卡面预览',submitting:'提交中',identified:'已识别',review:'待核对',processing:'处理中',success:'已完成',unknown:'待确认',failed:'未完成',action:'待操作'};
  const chip=state.statusLabel||labels[p]||'待填写';
  host.querySelector('[data-front-state]').textContent=chip;
  host.querySelector('[data-state]').textContent=chip;
  host.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view.split(' ').includes(p)&&!(state.summaryMode&&el.querySelector('[data-exception-title]'))));
  for(const [sel,val] of [['[data-brand]',state.brand||'RedeemAI'],['[data-product-brand]',state.productBrand||''],['[data-identity]',state.requestId||'—'],['[data-product]',state.product||''],['[data-account]',state.account||''],['[data-guide]',state.guideLabel||'使用指南 ↗']])host.querySelectorAll(sel).forEach(el=>el.textContent=val);
  host.querySelector('[data-back-tag]').textContent=({identified:'PRODUCT RECOGNIZED',review:'REVIEW YOUR DETAILS',processing:'YOUR ORIGINAL REQUEST',success:'REDEMPTION RECEIPT',unknown:'RESULT NOT CONFIRMED',failed:'REQUEST NOT COMPLETED',action:'ACTION REQUIRED'})[p]||'';
  applyProduct(); applyExperience(); V45Motion.restoreEdge(host,edgePhase); updateClock();
  host.dataset.summaryMode=String(!!state.summaryMode);
  if(state.summaryMode){
   const pr=state.productData||neutral;
   host.querySelector('.front .card-tag').textContent='CDK / PRIVATE';
   host.querySelector('.back .card-tag').textContent=pr.kind==='credits'?'USAGE CREDITS':pr.kind==='provisional'?'RESERVED DESIGN':'SUBSCRIPTION EDITION';
  }
  host.querySelectorAll('.card-digest').forEach(d=>{
    const pr=state.productData||neutral;
    d.querySelector('.digest-family').textContent=pr.family==='openai'?'CHATGPT / COLLECTION':pr.family==='claude'?'CLAUDE / COLLECTION':pr.family==='codex'?'CODEX / CREDITS':pr.family==='grok'?'GROK / X AI':pr.family==='x'?'X / SUBSCRIPTION':'REDEEMAI / YOUR CARD';
    d.querySelector('.digest-product').textContent=pr.id==='unidentified'?'等待识别':pr.displayLabel;
    d.querySelector('.digest-product').dataset.long=String(pr.displayLabel.length>10);
    d.querySelector('.digest-edition').textContent=pr.kind==='credits'?(Number.isFinite(state.quantity)?state.quantity+' 点数':'用量点数'):pr.id==='unidentified'?'REDEMPTION KEY':pr.cardCaption||(pr.family==='claude'?'Claude · 订阅兑换':'ChatGPT · 订阅兑换');
    d.querySelector('.digest-status span').textContent=state.statusLabel||labels[p]||(p==='verifying'?'识别中':'待填写');
    const key=d.querySelector('.key-value');const candidate=String(state.identity||'');const next=/^••••  ••••  (?:[\p{L}\p{N}•]{4})$/u.test(candidate)?candidate:'••••  ••••  ••••';if(key.textContent!==next){key.textContent=next;if(!mq.matches&&state.motion!=='static')key.animate([{opacity:.3,transform:'translateY(2px)'},{opacity:.84,transform:'translateY(0)'}],{duration:240,easing:'ease-out'});}
  }); if(state.inputTitle)host.querySelector('[data-inputtitle]').textContent=state.inputTitle;if(state.inputHint)host.querySelector('[data-inputhint]').textContent=state.inputHint;
  if(state.error!==undefined)host.querySelector('[data-error]').textContent=state.error;
  const except={unknown:['结果待确认','本次兑换尚未返回最终结果。请保留兑换码与任务号，稍后在本页查询；确认前请勿重复提交或再次付款。'],failed:['兑换未完成','本次没有记入套餐。若未写明扣款失败，请勿另购卡密或再次付款，并保留任务号联系客服。'],action:['需要继续操作','请按下方提示完成该步骤。完成后原任务在本页继续，请勿另行提交。']};
  if(except[p]){host.querySelector('[data-exception-title]').textContent=except[p][0];host.querySelector('[data-exception-copy]').textContent=except[p][1];}
  submit.disabled=!box.checked||p!=='review'; host.querySelector('[data-next]').disabled=state.productData?.kind==='provisional';
 }

 function ornament(kind){
  let shapes='';
  if(kind==='sun'||kind==='petal')for(let i=0;i<24;i++){const a=i*Math.PI/12,x=90+Math.cos(a)*35,y=120+Math.sin(a)*35;shapes+=`<path d="M${x} ${y} Q${90+Math.cos(a+.15)*80} ${120+Math.sin(a+.15)*80} ${90+Math.cos(a)*100} ${120+Math.sin(a)*100}"/>`;}
  else if(kind==='circuit')for(let i=0;i<10;i++)shapes+=`<path d="M${12+i*14} 0 V${50+i*9} L${33+i*14} ${70+i*9} V240"/>`;
  else if(kind==='facets'||kind==='prism')for(let i=0;i<6;i++)shapes+=`<path d="M90 ${20+i*13} L${158-i*8} 120 L90 ${220-i*13} L${22+i*8} 120 Z"/>`;
  else if(kind==='mist')for(let i=0;i<9;i++)shapes+=`<path d="M0 ${20+i*23} Q90 ${-20+i*23} 180 ${40+i*23}"/>`;
  else for(let i=0;i<10;i++)shapes+=`<path d="M${55+i*7} 0 C${-25+i*7} 70 ${174+i*7} 155 ${57+i*7} 240"/>`;
  return shapes;
 }
 const TIER_STEPS={openai:5,claude:3,grok:4,x:3};
 function applyPlatform(prod){
  const ident=prod.id==='unidentified'||prod.family==='redeemai'?null:resolveProductIdentity({plan:prod.displayLabel==='Plus半价'?'plus_half':prod.id,family:prod.family==='codex'?'openai':prod.family});
  const signature=ident?[ident.brand,ident.key,ident.label].join('|'):'';
  if(host.dataset.platformSignature===signature)return;
  host.dataset.platformSignature=signature;host.dataset.platform=ident?.brand||'';host.dataset.tier=ident?.key||'';host.dataset.tierLevel=String(ident?.level||0);
  host.querySelectorAll('.card-platform').forEach(chip=>{
   chip.replaceChildren();if(!ident)return;
   const glyph=document.createElement('span');glyph.className='platform-glyph';glyph.innerHTML=brandMarkSvg(ident.brand);
   const name=document.createElement('span');name.className='platform-name';name.textContent=BRAND_NAMES[ident.brand].toUpperCase();
   const tier=document.createElement('span');tier.className='platform-tier';tier.dataset.tint=ident.tint;tier.innerHTML=tierMarkSvg(ident.glyph);const label=document.createElement('span');label.textContent=ident.label;tier.append(label);
   chip.append(glyph,name,tier);
   const steps=ident.glyph==='credits'||ident.unknown?0:TIER_STEPS[ident.brand]||0;
   if(steps){const pips=document.createElement('span');pips.className='platform-pips';for(let i=1;i<=steps;i++){const pip=document.createElement('i');if(i<=ident.level)pip.dataset.on='';pips.append(pip);}chip.append(pips);}
  });
  host.querySelectorAll('.card-platform-mark').forEach(mark=>{mark.innerHTML=ident?brandMarkSvg(ident.brand):'';});
 }
 function applyProduct(){
  const prod=state.productData||neutral, colors=prod.palette;
  host.dataset.product=prod.id;host.dataset.family=prod.family;host.dataset.pattern=prod.pattern;
  for(const [k,v] of Object.entries(colors))host.style.setProperty('--skin-'+k,v);
  const p=state.phase;const demo=p==='specimen';host.dataset.rank=prod.rank;host.dataset.cardTone=['go','plus','claude-pro'].includes(prod.id)?'light':'dark';
  host.querySelectorAll('.emboss').forEach(el=>{if(el.dataset.pattern!==prod.pattern){el.innerHTML=ornament(prod.pattern);el.dataset.pattern=prod.pattern;}});
  const full=prod.family==='openai'?'ChatGPT '+prod.displayLabel:prod.family==='claude'?'Claude '+prod.displayLabel:prod.family==='grok'||prod.family==='x'?prod.displayLabel:prod.family==='codex'?'Codex '+prod.displayLabel:prod.displayLabel;
  host.querySelectorAll('[data-product-full]').forEach(el=>el.textContent=full);
  host.querySelectorAll('[data-product]').forEach(el=>{el.textContent=prod.displayLabel;el.dataset.long=String(prod.displayLabel.length>10);});
  host.querySelectorAll('[data-product-brand]').forEach(el=>el.textContent=prod.family==='openai'?'CHATGPT':prod.family==='claude'?'CLAUDE':prod.family==='codex'?'CODEX / USAGE CREDITS':prod.family==='grok'?'GROK / X AI':prod.family==='x'?'X / SUBSCRIPTION':'REDEEMAI');
  applyPlatform(prod);
  host.querySelector('[data-kind-label]').textContent=prod.kind==='credits'?(state.quantity??prod.demoQuantity??'—').toLocaleString()+' 点数':prod.kind==='provisional'?'预留设计':'订阅兑换';
  host.querySelector('[data-recognition]').textContent=demo?(prod.kind==='provisional'?'预留卡面 · 发布信息未确认':'材质预览 · 非已校验套餐'):'已按兑换码识别 · '+prod.edition;
  host.querySelector('[data-next] span').textContent=demo?(prod.kind==='provisional'?'预留设计 · 不可兑换':'体验此卡'):state.reviewLabel||'核对账号';
  host.querySelector('[data-back-tag]').textContent=demo?prod.edition:host.querySelector('[data-back-tag]').textContent;
  host.querySelector('[data-processing-label]').textContent=p==='submitting'?'提交中':'处理中';
  host.querySelector('[data-quantity-row]').hidden=prod.kind!=='credits';host.querySelector('[data-quantity]').textContent=prod.kind==='credits'?(Number.isFinite(state.quantity)?String(state.quantity)+' credits':'用量点数'):'';
  if(state.placeholder)input.placeholder=state.placeholder;if(state.confirmLabel)submit.querySelector('span').textContent=state.confirmLabel;
  host.querySelector('.front .card-tag').textContent='DIGITAL REDEMPTION';
 }
 function etching(theme){
   if(theme==='astral')return '<path d="M420 400L503 309 467 204 591 129 702 187 681 344 503 309M591 129L621 35M681 344L740 395"/><g class="etch-stars">'+[[420,400],[503,309],[467,204],[591,129],[702,187],[681,344],[621,35],[740,395]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.4"/>`).join('')+'</g>';
   if(theme==='orbit')return '<ellipse cx="670" cy="234" rx="160" ry="160"/><ellipse cx="670" cy="234" rx="139" ry="139"/><path stroke-dasharray="1 17" d="M485 234H755M670 20V460"/><path d="M31 62V31H62M699 444H730V413"/>';
   if(theme==='silk')return Array.from({length:9},(_,i)=>`<path d="M${280+i*15} -20C${730+i*9} 155 ${240+i*18} 296 ${710+i*12} 495"/>`).join('');
   if(theme==='porcelain')return Array.from({length:5},(_,i)=>`<path d="M410 ${60+i*14}Q750 ${125+i*13} 715 ${340+i*13}"/>`).join('');
   return '<rect x="12" y="12" width="736" height="451" rx="14"/><path d="M24 38V24H38M722 24H736V38M24 437V451H38M722 451H736V437"/>';
 }
 function applyExperience(){
   const e=V41Experience.preferences(state.experience),stage=state.stage||'atelier';
   const rawSkin=V41Experience.palette(state.productData||neutral,stage,e.themeAdaptation);
   const skin=Number.isFinite(state.darkness)&&R17Tone?R17Tone.card(rawSkin,stage,state.darkness):globalThis.R14Policy?globalThis.R14Policy.projectCard(rawSkin,stage):rawSkin;
   host.dataset.cardStage=stage;host.dataset.finish=skin.finish;host.dataset.elapsedEnabled=String(e.timerEnabled);
   host.dataset.settle=e.successSettle?'yes':'no';host.dataset.stageLabel=String(e.stageLabelEnabled);
   host.dataset.motion=state.motion||'full';
   const still=mq.matches||state.motion==='static';host.dataset.fx=still?'static':state.motion==='light'?'light':'full';
   host.style.setProperty('--edge-intensity',e.edgeIntensity);host.style.setProperty('--edge-period',skin.period+'s');
   V45Motion.paint(host,Object.fromEntries(['base','deep','ink','muted','edge','reflector','shadow'].map(k=>[k,skin[k]])),{animate:!still,duration:state.motion==='light'?420:720});
   host.dataset.projectedTone=skin.light?'light':'dark';
   host.querySelectorAll('[data-theme-etch]').forEach(el=>{if(el.dataset.theme!==skin.finish){el.innerHTML=e.themeAdaptation?etching(stage):'';el.dataset.theme=skin.finish;}});
   V44Couture.apply(host,state.productData||neutral,skin,stage,state.phase);
   CardTheme.apply(host,stage);
 }
 function updateClock(){
   if(destroyed)return;
   const shot=V41Experience.clockSnapshot(state,monotonicNow());
   const options=V41Experience.preferences(state.experience);
   host.querySelectorAll('[data-clock]').forEach(el=>{
      el.hidden=!shot.visible||!options.timerEnabled;
      if(!shot.visible)return;
      el.dataset.frozen=String(!!shot.frozen);el.dataset.pending=String(!!shot.pending);
      el.title=shot.detail;
      el.querySelector('[data-clock-label]').textContent=shot.label;
      const tm=el.querySelector('[data-clock-value]');if(tm.textContent!==(shot.pending?shot.pendingLabel:shot.text))tm.textContent=shot.pending?shot.pendingLabel:shot.text;
      tm.setAttribute('aria-label',shot.pending?shot.detail:shot.label+' '+shot.text);
      if(shot.ms!==null)tm.setAttribute('datetime','PT'+Math.floor(shot.ms/1000)+'S');else tm.removeAttribute('datetime');
   });
   const shouldTick=shot.visible&&!shot.frozen&&!shot.pending&&options.timerEnabled&&!document.hidden;
   if(shouldTick&&!clockInterval)clockInterval=setInterval(updateClock,200);
   else if(!shouldTick&&clockInterval){clearInterval(clockInterval);clockInterval=0;}
 }
 on(document,'visibilitychange',()=>{host.dataset.hidden=String(document.hidden);updateClock()});
 on(mq,'change',()=>{applyExperience();updateClock()});
 on(globalThis,'redeem:lighting',()=>{applyExperience();});

 setState(state);
 return {setState,getState:()=>({...state,code:input.value,confirmed:box.checked}),resetConfirm:()=>{box.checked=false;submit.disabled=true;},setCode:value=>{if(state.phase==='idle')input.value=String(value);},getClock:()=>V41Experience.clockSnapshot(state,monotonicNow()),destroy:()=>{destroyed=true;R45Optics.destroy(host);V45Motion.destroy(host);clearInterval(clockInterval);listeners.forEach(f=>f());host.replaceChildren();}};
}
export { createIdentityCard };
