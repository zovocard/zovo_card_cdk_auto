/* V4.5 — Product-specific craftsmanship, not product-specific business logic.
 * Same permanent card DOM, same one-way perimeter, no success callbacks or new RAF.
 * All patterns are original analytic SVGs, no images or third-party assets/fonts.
 */
import V45Emblems from "./card-emblems.js";
'use strict';
 const NS='http://www.w3.org/2000/svg';
 const STYLES=Object.freeze({
  unidentified:{emblem:'neutral',level:0,finish:'unverified',name:'DIGITAL REDEMPTION',motif:'quiet',period:5.2,tail:8,width:.75,bezel:1},
  go:{emblem:'horizon',level:1,finish:'alloy',name:'SATIN ALLOY',motif:'horizon',period:3.8,tail:10,width:1.1,bezel:1},
  plus:{emblem:'lustre',level:2,finish:'nacre',name:'PEARL CHAMPAGNE',motif:'pearl',period:4.1,tail:13,width:1.25,bezel:2},
  'pro-standard':{emblem:'aperture',level:3,finish:'titanium',name:'BRUSHED TITANIUM',motif:'engine',period:4.3,tail:16,width:1.4,bezel:2},
  'pro-more':{emblem:'signet',level:4,finish:'obsidian',name:'OBSIDIAN / GUILLOCHE',motif:'rosette',period:4.6,tail:19,width:1.65,bezel:3},
  'pro-500':{emblem:'reserve',level:5,finish:'platinum',name:'PLATINUM / RESERVE',motif:'prism',period:4.9,tail:22,width:1.75,bezel:3},
  'claude-pro':{emblem:'folio',level:1,finish:'copper',name:'PORCELAIN COPPER',motif:'sun',period:4.2,tail:11,width:1.15,bezel:1},
  'claude-5x':{emblem:'rosette',level:2,finish:'rose',name:'SMOKED ROSE',motif:'petal',period:4.5,tail:15,width:1.45,bezel:2},
  'claude-20x':{emblem:'nocturne',level:3,finish:'amethyst',name:'AMETHYST / ENGRAVED',motif:'bloom',period:4.8,tail:19,width:1.65,bezel:3},
  'codex-credits':{emblem:'circuit',level:0,finish:'carbon',name:'CARBON / COMPUTE',motif:'circuit',period:3.9,tail:15,width:1.4,bezel:2},
  grok_xai_plus:{emblem:'eclipse',engrave:1,level:1,finish:'graphite',name:'GRAPHITE / EVENT HORIZON',motif:'horizon',pattern:'mist',period:3.9,tail:11,width:1.15,bezel:1},
  grok_xai_premium:{emblem:'eclipse',engrave:2,level:2,finish:'graphite',name:'INDIGO / EVENT HORIZON',motif:'engine',pattern:'contour',period:4.2,tail:14,width:1.3,bezel:2},
  grok_xai_super:{emblem:'eclipse',engrave:4,level:3,finish:'obsidian',name:'CYAN / ACCRETION',motif:'rosette',pattern:'facets',period:4.5,tail:18,width:1.55,bezel:3},
  grok_xai_ultra:{emblem:'eclipse',engrave:5,level:4,finish:'platinum',name:'GOLD / SINGULARITY',motif:'prism',pattern:'prism',period:4.8,tail:21,width:1.75,bezel:3},
  x_basic:{emblem:'meridian',engrave:1,level:1,finish:'alloy',name:'SLATE / MERIDIAN',motif:'pearl',pattern:'mist',period:4,tail:11,width:1.15,bezel:1},
  x_premium:{emblem:'meridian',engrave:3,level:2,finish:'titanium',name:'COBALT / MERIDIAN',motif:'engine',pattern:'contour',period:4.4,tail:15,width:1.4,bezel:2},
  x_premium_plus:{emblem:'meridian',engrave:5,level:3,finish:'obsidian',name:'ONYX / MERIDIAN',motif:'prism',pattern:'prism',period:4.8,tail:20,width:1.7,bezel:3},
 });
 function art(style){return V45Emblems.render(style.emblem||'neutral',style.motif,style.engrave);}
 const stageCoeff={atelier:1,silk:1.12,porcelain:1.16,orbit:.91,astral:1.02};
 function finery(host,level){
  const signature='m17-'+level;
  if(host.dataset.finery===signature)return;
  host.dataset.finery=signature;
  for(const face of host.querySelectorAll('.face')){
   let el=face.querySelector('.finery17');if(!el){el=document.createElement('div');el.className='finery17';el.setAttribute('aria-hidden','true');face.querySelector('.couture-craft').append(el);}
   const n=level===0?0:12+level*8,lines=[];
   for(let i=0;i<n;i++){
    const y=28+i/(n-1)*43,long=i%8===0;
    lines.push(`<path d="M97 ${y.toFixed(2)}h-${long?1.1:.42}" class="${long?'major':'minor'}"/>`);
   }
   const corners=level<3?'':`<path d="M3.2 7.4V5.6H8.5M91.5 5.6h5.3v1.8M3.2 92.6v1.8h5.3M91.5 94.4h5.3v-1.8" class="corner"/>`;
   el.innerHTML=`<svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">${corners}${lines.join('')}</svg>`;
  }
 }
 function mount(host){
  for(const face of host.querySelectorAll('.face')){
   const layer=document.createElement('div');layer.className='couture-craft';layer.setAttribute('aria-hidden','true');
   layer.innerHTML='<div class="couture-lacquer"></div><div class="couture-grain"></div><div class="couture-chamfer"></div><div class="couture-bezel"></div><div class="couture-watermark"></div><div class="couture-motif"></div><div class="couture-signature"></div><div class="couture-facet-light"></div>';
   face.insertBefore(layer,face.firstChild);
   const tier=document.createElement('span');tier.className='couture-tier';tier.setAttribute('aria-hidden','true');face.querySelector('.card-brandrow').append(tier);
   const svg=face.querySelector('.edge-track');
   // Overlay segments all share the same head position, so this is ONE light with a soft tail.
   for(let j=0;j<7;j++){
    const seg=document.createElementNS(NS,'rect');seg.setAttribute('class','jewel-runner jewel-'+j);seg.setAttribute('pathLength','100');seg.setAttribute('stroke-linecap','round');seg.setAttribute('vector-effect','non-scaling-stroke');svg.appendChild(seg);
   }
   // A stationary foil inlay, not a second counter-rotating animation.
   const inlay=document.createElementNS(NS,'rect');inlay.setAttribute('class','couture-inlay');inlay.setAttribute('pathLength','100');inlay.setAttribute('vector-effect','non-scaling-stroke');svg.insertBefore(inlay,svg.firstChild);
  }
 }
 function align(host){
  const orb=host.querySelector('.card-orbit');if(!orb||!orb.clientWidth||!orb.clientHeight)return;
  const w=orb.clientWidth,h=orb.clientHeight,r=parseFloat(getComputedStyle(host.querySelector('.face')).borderTopLeftRadius)||18;
  host.querySelectorAll('.couture-inlay').forEach(el=>{const inset=host.dataset.craftLevel==='0'?3.8:5.8;el.setAttribute('x',760*inset/w);el.setAttribute('y',475*inset/h);el.setAttribute('width',760*(1-2*inset/w));el.setAttribute('height',475*(1-2*inset/h));el.setAttribute('rx',Math.max(0,r-inset)*760/w);el.setAttribute('ry',Math.max(0,r-inset)*475/h);});
 }
 function apply(host,product,skin,stage,phase){
  const key=String(product.id).replace(/_(monthly|yearly)$/,''),id=Object.hasOwn(STYLES,key)?key:'unidentified',s=STYLES[id];
  const expected={go:'mist',plus:'pearl','pro-standard':'brush','pro-more':'contour','pro-500':'prism','claude-pro':'sun','claude-5x':'petal','claude-20x':'facets','codex-credits':'circuit'};
  const customMotif=({mist:'horizon',pearl:'pearl',brush:'engine',contour:'rosette',prism:'prism',sun:'sun',petal:'petal',facets:'bloom',circuit:'circuit'})[product.pattern];
  const drawn={...s,motif:product.pattern!==(expected[id]??s.pattern)&&id!=='unidentified'&&customMotif?customMotif:s.motif};
  const signature=id+'|'+drawn.motif+'|'+(product.edition||s.name);const previous=host.dataset.craftSignature;host.dataset.craftSignature=signature;host.dataset.craft=id;host.dataset.craftLevel=s.level;host.dataset.craftFinish=s.finish;host.dataset.craftTheme=stage;host.dataset.emblem=s.emblem;
  if(previous!==signature){
   host.querySelectorAll('.couture-motif').forEach(el=>el.innerHTML=art(drawn));
   host.querySelectorAll('.couture-signature').forEach(el=>el.textContent=product.edition||s.name);
   host.querySelectorAll('.couture-watermark').forEach(el=>el.replaceChildren());
   host.querySelectorAll('.couture-tier').forEach(el=>el.replaceChildren());
  }
  finery(host,s.level);
  host.style.setProperty('--craft-width',s.width+'px');
  host.style.setProperty('--craft-period',(s.period*(stageCoeff[stage]||1)).toFixed(2)+'s');
  host.style.setProperty('--craft-idle-period',(s.period*3.7).toFixed(2)+'s');
  host.style.setProperty('--craft-tail',s.tail);
  host.style.setProperty('--craft-bezel',s.bezel);
  host.style.setProperty('--crest-opacity',skin.light?(s.level>2?.86:.76):(s.level>2?.94:.83));
  host.style.setProperty('--foil-alpha',skin.light?.12:.18);
  host.querySelectorAll('.jewel-runner').forEach(el=>{
   const n=Number([...el.classList].find(x=>/^jewel-\d$/.test(x))?.slice(6)||0);
   const fractions=[1,.80,.61,.43,.27,.12,.025],opacities=[.045,.065,.10,.14,.24,.44,1];
   const len=s.tail*fractions[n];el.style.setProperty('--tail-len',len.toFixed(3)+'px');el.style.setProperty('--tail-gap',(100-len).toFixed(3)+'px');el.style.setProperty('--tail-alpha',opacities[n]);
  });
  align(host);
 }
export default { STYLES, mount, apply, align };
