import R18Relief from "./relief-m18.js";
/* V4.5 / M1 — presentation-only studio light. No account data, network, business
   outcomes, task clocks or persistent state are read or changed here. */
'use strict';
 const records=new WeakMap(), sets=new WeakMap(),TAU=Math.PI*2;
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 function rgb(s){if(/^#[0-9a-f]{6}$/i.test(s))return [1,3,5].map(i=>parseInt(s.slice(i,i+2),16));const m=String(s).match(/[\d.]+/g);return m&&m.length>=3?m.slice(0,3).map(Number):[232,218,192]}
 const rgba=(c,a)=>`rgba(${c[0]},${c[1]},${c[2]},${clamp(a)})`;
 function perimeter(w,h,r,d){
  // Clockwise true arc-length parametrization. No stretched circular orbit.
  const straightX=w-2*r,straightY=h-2*r,arc=Math.PI*r/2,P=2*(straightX+straightY)+4*arc;
  d=((d%P)+P)%P;
  if(d<straightX)return [r+d,0];d-=straightX;
  if(d<arc){let a=-Math.PI/2+d/r;return [w-r+r*Math.cos(a),r+r*Math.sin(a)]}d-=arc;
  if(d<straightY)return [w,r+d];d-=straightY;
  if(d<arc){let a=d/r;return [w-r+r*Math.cos(a),h-r+r*Math.sin(a)]}d-=arc;
  if(d<straightX)return [w-r-d,h];d-=straightX;
  if(d<arc){let a=Math.PI/2+d/r;return [r+r*Math.cos(a),h-r+r*Math.sin(a)]}d-=arc;
  if(d<straightY)return [0,h-r-d];d-=straightY;
  let a=Math.PI+d/r;return [r+r*Math.cos(a),r+r*Math.sin(a)];
 }
 function mount(host){
  if(records.has(host))return records.get(host);
  const root=host.closest('.atelier')||host.parentElement;
  const r={host,root,faces:[],w:0,h:0,scale:1,radius:18,phase:host.dataset.phase,edge:0,settleAt:-99,flipUntil:0,dead:false,frames:0,lastT:0,lightX:0,lightY:0,tiltX:0,tiltY:0,energy:.8,lastSurfaceAt:-99,bounds:host.getBoundingClientRect(),localX:0,localY:0,cardHover:false,clickAt:-999,clickX:.5,clickY:.5,clickCount:0,impulse:0,phaseAt:0,prevFlip:host.dataset.flipped,lastDomAt:-999};
  for(const f of host.querySelectorAll('.face')){
   const light=document.createElement('canvas'),edge=document.createElement('canvas');
   light.className='m1-surface-light';edge.className='m1-edge-light';
   for(const c of [light,edge]){c.setAttribute('aria-hidden','true');c.style.pointerEvents='none'}
   f.insertBefore(light,f.querySelector('.couture-craft'));f.appendChild(edge);
   r.faces.push({face:f,light,edge,lc:light.getContext('2d'),ec:edge.getContext('2d')});
  }
  function size(){r.bounds=host.getBoundingClientRect();const el=host.querySelector('.card-orbit');if(!el)return;
   const w=el.clientWidth,h=el.clientHeight,scale=Math.min(devicePixelRatio||1,2);
   if(!w||!h||w===r.w&&h===r.h&&scale===r.scale)return;
   r.w=w;r.h=h;r.scale=scale;r.radius=parseFloat(getComputedStyle(r.faces[0].face).borderTopLeftRadius)||18;
   r.faces.forEach(f=>[f.light,f.edge].forEach(c=>{c.width=Math.round(w*scale);c.height=Math.round(h*scale)}));
  }
  r.resize=size;r.onScroll=()=>{r.bounds=host.getBoundingClientRect()};addEventListener('scroll',r.onScroll,{passive:true,capture:true});size();r.ro=new ResizeObserver(size);r.ro.observe(host.querySelector('.card-orbit'));
  r.mo=new MutationObserver(ms=>{if(ms.some(x=>x.attributeName==='data-flipped')&&host.dataset.flipped!==r.prevFlip){r.prevFlip=host.dataset.flipped;r.flipUntil=performance.now()+1120}});
  r.mo.observe(host,{attributes:true,attributeFilter:['data-flipped']});
  r.onPointerMove=e=>{if(e.pointerType==='touch')return;const b=r.bounds;r.localX=clamp((e.clientX-b.left)/Math.max(1,b.width)*2-1,-1,1);r.localY=clamp((e.clientY-b.top)/Math.max(1,b.height)*2-1,-1,1);r.cardHover=true;};
  r.onPointerLeave=()=>{r.cardHover=false;r.localX=0;r.localY=0;};
  r.onClick=e=>{if(e.target.closest('a,button,input,textarea,select,label,[contenteditable=true]')||['action','unknown','failed','review'].includes(host.dataset.phase)||root.querySelector('dialog[open]')||root.dataset.motion==='static'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
   const b=host.getBoundingClientRect();r.clickX=clamp((e.clientX-b.left)/Math.max(1,b.width),.1,.9);r.clickY=clamp((e.clientY-b.top)/Math.max(1,b.height),.1,.9);r.clickAt=r.lastT;r.clickCount++;
  };
  host.addEventListener('pointermove',r.onPointerMove,{passive:true});host.addEventListener('pointerleave',r.onPointerLeave);host.addEventListener('click',r.onClick);
  records.set(host,r);let group=sets.get(root);if(!group){group=new Set();sets.set(root,group)}group.add(r);
  host.dataset.optics='studio-m1';return r;
 }
 function surface(f,r,q,c,ref,lightCard){
  const g=f.lc,{w,h,scale}=r,{t,strength,theme,phase,scene,staticMode}=q;
  g.setTransform(scale,0,0,scale,0,0);g.clearRect(0,0,w,h);g.save();g.beginPath();g.roundRect(.6,.6,w-1.2,h-1.2,r.radius);g.clip();
  const quiet=/action|unknown|review|failed/.test(phase),active=/processing|submitting|verifying/.test(phase);
  const target=phase==='failed'?.17:quiet?.43:active?1.0:.70;
  r.energy+=(target-r.energy)*Math.min(1,Math.max(q.dt,1/180)*3);
  const rig=scene||{x:q.px*2,y:q.py*2,lightX:.5,lightY:.3,profile:{spread:.25}},amp=strength*r.energy;
  const family=r.host.dataset.craftFinish,metal=['titanium','obsidian','platinum','amethyst','carbon'].includes(family);
  // A studio lamp changes position across the entire stage. Card-local lighting
  // uses the exact same lamp, with a small broad reflected ribbon at rest.
  const world=(rig.lightX*innerWidth-(r.bounds.left||0))/Math.max(1,w);
  const autonomous=staticMode?0:Math.sin(t*(theme==='silk'?.23:.19)-.65)*.27;
  const cx=w*(.44+(world-.48)*.30+rig.x*.20+autonomous);
  const cy=h*(.25+rig.y*.19+(staticMode?0:Math.sin(t*.15)*.07));r.lightX=cx/w;r.lightY=cy/h;
  g.save();g.translate(cx,cy);g.rotate(-.26+rig.x*.14+(staticMode?0:Math.sin(t*.105)*.055));
  const width=w*(metal?.22:rig.profile.spread+.025),edgeWidth=w*(family==='platinum'?.020:metal?.034:.072);
  let grad=g.createLinearGradient(-width,0,width,0);
  [[0,0],[.16,.012],[.32,.06],[.45,.23],[.51,.34],[.62,.18],[.81,.025],[1,0]].forEach(([k,a])=>grad.addColorStop(k,rgba(ref,a*amp*(lightCard?.56:1))));
  g.fillStyle=grad;g.fillRect(-width,-h*2,width*2,h*4);
  if(metal){grad=g.createLinearGradient(-edgeWidth,0,edgeWidth,0);[[0,0],[.24,.015],[.49,.13],[.58,.065],[1,0]].forEach(([k,a])=>grad.addColorStop(k,rgba(ref,a*amp)));g.fillStyle=grad;g.fillRect(-edgeWidth,-h*2,edgeWidth*2,h*4);}
  // Reflected dark flag makes a brushed/enamel normal visible without bleaching text.
  grad=g.createLinearGradient(width*.44,0,width*1.75,0);[[0,0],[.46,.15],[.68,.07],[1,0]].forEach(([k,a])=>grad.addColorStop(k,`rgba(0,0,0,${a*amp*(lightCard?1.15:.78)})`));g.fillStyle=grad;g.fillRect(width*.44,-h*2,width*1.32,h*4);g.restore();
  // Theme-specific material response, not seven copies of a white scan line.
  if(['silk','dawn','porcelain'].includes(theme)){
   g.save();g.translate(w*.5,h*(.70+rig.y*.10));g.rotate(-.09+rig.x*.06);
   const q2=g.createLinearGradient(0,-h*.13,0,h*.12);q2.addColorStop(0,rgba(ref,0));q2.addColorStop(.48,rgba(ref,(theme==='silk'?.13:.19)*amp));q2.addColorStop(.56,rgba(ref,.055*amp));q2.addColorStop(1,rgba(ref,0));g.fillStyle=q2;g.beginPath();g.moveTo(-w,-h*.12);g.bezierCurveTo(-w*.4,h*.06,w*.4,-h*.07,w,h*.09);g.lineTo(w,h*.24);g.bezierCurveTo(w*.4,h*.08,-w*.4,h*.2,-w,h*.03);g.closePath();g.fill();g.restore();
  }else if(theme==='verdant'||family==='platinum'){
   g.save();g.globalCompositeOperation='screen';for(let k=0;k<3;k++){g.strokeStyle=rgba(ref,(.045+k*.012)*amp);g.lineWidth=1.1;g.beginPath();const x=w*(.55+k*.085+rig.x*.07);g.moveTo(x,-20);g.lineTo(x-w*.12,h*.44);g.lineTo(x+w*.09,h+20);g.stroke();}g.restore();
  }
  // One soft light bloom on card click/phase entry. Pure optics, not a task action.
  if(!staticMode&&r.impulse>.002){
   const xx=w*r.clickX,yy=h*r.clickY,age=Math.max(0,t-r.clickAt),rad=w*(.07+.40*Math.min(1,age/.95));
   const bloom=g.createRadialGradient(xx,yy,0,xx,yy,rad);bloom.addColorStop(0,rgba(ref,.11*r.impulse*strength));bloom.addColorStop(.40,rgba(c,.06*r.impulse*strength));bloom.addColorStop(1,rgba(c,0));g.fillStyle=bloom;g.fillRect(xx-rad,yy-rad,rad*2,rad*2);
   g.strokeStyle=rgba(ref,.20*r.impulse*strength);g.lineWidth=.7;g.beginPath();g.ellipse(xx,yy,rad,rad*.63,-.26,.42,2.62);g.stroke();
  }
  // The information rail inherits the same reflected horizon. Nothing moves there.
  const horizon=g.createLinearGradient(0,h*.72,0,h);horizon.addColorStop(0,rgba(c,0));horizon.addColorStop(.60,rgba(c,.025*amp));horizon.addColorStop(1,rgba(ref,.15*amp));g.fillStyle=horizon;g.fillRect(0,h*.72,w,h*.28);
  // Bevel has directional illumination, rather than a uniform neon border.
  g.lineWidth=1;const b=g.createLinearGradient(0,0,w,h);b.addColorStop(0,rgba(ref,(.3+rig.x*.10)*amp));b.addColorStop(.47,rgba(c,.03));b.addColorStop(1,rgba(ref,(.15-rig.x*.08)*amp));g.strokeStyle=b;g.beginPath();g.roundRect(1.7,1.7,w-3.4,h-3.4,Math.max(3,r.radius-1.5));g.stroke();g.restore();
 }
 function edge(f,r,q,c,ref){
  const g=f.ec,{w,h,scale,radius}=r,{t,phase,strength,staticMode}=q;g.setTransform(scale,0,0,scale,0,0);g.clearRect(0,0,w,h);
  const inset=1.55,ww=w-2*inset,hh=h-2*inset,rr=Math.max(3,radius-inset),P=2*(ww+hh-4*rr)+TAU*rr;
  g.save();g.translate(inset,inset);
  // Tone follows the actual semantic state, never an animated success guess.
  let tone=c;if(phase==='failed')tone=[180,112,105];else if(['action','unknown'].includes(phase))tone=[195,162,107];
  g.beginPath();g.roundRect(0,0,ww,hh,rr);g.lineWidth=.8;g.strokeStyle=rgba(tone,phase==='success'?.88:.26+r.impulse*.09);if(phase==='unknown')g.setLineDash([3,6]);g.stroke();g.setLineDash([]);
  let active=['idle','specimen','identified','verifying','submitting','processing'].includes(phase);
  let settle=phase==='success'&&!staticMode?1-clamp((t-r.settleAt)/1.15):0;
  if((!active||staticMode)&&settle<=0){g.restore();return}
  const isRun=['processing','submitting','verifying'].includes(phase),level=+(r.host.dataset.craftLevel||0),brightness=(isRun?1.03: .30)*strength*(phase==='success'?settle:1);
  const tail=P*(.145+.018*level)*(phase==='success'?Math.max(.01,settle):1),pos=r.edge*P;
  for(let i=0;i<70;i++){
   const u=i/70,v=(i+1)/70,a=perimeter(ww,hh,rr,pos-tail+tail*u),b=perimeter(ww,hh,rr,pos-tail+tail*v),alpha=Math.pow(v,2.25)*brightness;
   g.beginPath();g.moveTo(...a);g.lineTo(...b);g.lineCap='round';
   g.lineWidth=5+level*.25;g.strokeStyle=rgba(tone,alpha*.10);g.stroke();
   g.lineWidth=1.8+level*.10;g.strokeStyle=rgba(tone,alpha*.58);g.stroke();
   g.lineWidth=.8+level*.06;g.strokeStyle=rgba(ref,alpha*.95);g.stroke();
  }
  const [hx,hy]=perimeter(ww,hh,rr,pos),halo=g.createRadialGradient(hx,hy,0,hx,hy,11+level);
  halo.addColorStop(0,rgba(ref,.94*brightness));halo.addColorStop(.07,rgba(ref,.48*brightness));halo.addColorStop(.20,rgba(ref,.13*brightness));halo.addColorStop(.35,rgba(tone,.12*brightness));halo.addColorStop(1,rgba(tone,0));
  g.fillStyle=halo;g.fillRect(hx-18,hy-18,36,36);g.restore();
 }
 function paint(root,q){
  const group=sets.get(root);if(!group)return;
  group.forEach(r=>{
   if(r.dead||!r.host.isConnected)return;
   const phase=r.host.dataset.phase||'idle',theme=r.host.dataset.cardStage||q.theme;
   if(phase!==r.phase){if(['success','failed','unknown','action','review'].includes(phase)){r.clickAt=-999;r.impulse=0}if(phase==='success')r.settleAt=q.t;if(['identified','submitting','processing'].includes(phase)){r.clickAt=q.t;r.clickX=.68;r.clickY=.37}r.phaseAt=q.t;r.phase=phase}
   const staticMode=q.staticMode||r.host.dataset.fx==='static';const age=Math.max(0,q.t-r.clickAt);r.impulse=staticMode?0:(age<1.05?Math.sin(Math.PI*Math.min(1,age/1.05))**1.3:0);
   const cycle=(phase==='verifying'?2.9:phase==='processing'||phase==='submitting'?4.7:12.6)*({silk:1.16,porcelain:1.05,orbit:.90,astral:.97,verdant:1.10,dawn:1.17}[theme]||1);
   if(!staticMode&&['idle','specimen','identified','processing','submitting','verifying'].includes(phase))r.edge=(r.edge+q.dt/cycle)%1;
   const style=r.host.style,c=rgb(style.getPropertyValue('--card-edge')),ref=rgb(style.getPropertyValue('--card-reflector'));
   const qq={...q,phase,theme,staticMode,strength:q.strength*parseFloat(style.getPropertyValue('--edge-intensity')||'1')};
   R18Relief?.paint(r.host,{...qq,motion:r.root.dataset.motion},c,ref);
   const front=r.host.dataset.flipped!=='true',flipping=performance.now()<r.flipUntil;
   r.faces.forEach((f,i)=>{if((i===0)!==front&&!flipping)return;surface(f,r,qq,c,ref,r.host.dataset.projectedTone==='light');edge(f,r,qq,c,ref)});
   const updateDom=q.staticMode||q.t-r.lastDomAt>1/12;if(updateDom)r.lastDomAt=q.t;
   const crest=updateDom?r.host.querySelectorAll('.couture-motif linearGradient'):[];
   for(const grad of crest){grad.setAttribute('x1',(12+Math.sin(q.t*.19)*24+(q.scene?.x||0)*25)+'%');grad.setAttribute('y1','-10%');grad.setAttribute('x2',(83+Math.sin(q.t*.19+.7)*18+(q.scene?.y||0)*21)+'%');grad.setAttribute('y2','100%')}
   const tilt=r.host.querySelector('.card-tilt');
   if(tilt){
    const anyFocus=r.root.contains(document.activeElement)&&document.activeElement?.matches('input,textarea,select,[contenteditable=true]');
    const held=staticMode||innerWidth<720||flipping||anyFocus||['action','review','unknown','failed'].includes(phase)||!!r.root.querySelector('dialog[open]');
    const px=held?0:(r.cardHover?r.localX*.78+(q.scene?.x||0)*.22:(q.scene?.x||0)*.50),py=held?0:(r.cardHover?r.localY*.78+(q.scene?.y||0)*.22:(q.scene?.y||0)*.50),factor=q.scene?.profile?.card||.8,k=1-Math.exp(-Math.min(.1,q.dt||.016)*8.5);
    r.tiltX+=(-py*4.1*factor-r.tiltX)*k;r.tiltY+=(px*6.2*factor-r.tiltY)*k;
    if(held){r.tiltX=0;r.tiltY=0;}
    tilt.style.translate='none';tilt.style.rotate='none';tilt.style.transition='none';
    tilt.style.transform=held?'none':`rotateX(${r.tiltX.toFixed(3)}deg) rotateY(${r.tiltY.toFixed(3)}deg) scale(${(1-r.impulse*.006).toFixed(5)})`;
    if(updateDom){r.host.style.setProperty('--m13-shadow-x',(-px*11).toFixed(2)+'px');r.host.style.setProperty('--m13-shadow-y',(3-py*4).toFixed(2)+'px');
    r.host.style.setProperty('--m16-shadow-scale',(1-r.impulse*.018).toFixed(4));
    r.host.style.setProperty('--m1-shadow-strength',(.37+.025*Math.sin(q.t*.17)).toFixed(3));
    }
    // Type and form positions are never rewritten by this renderer.
   }
   r.frames++;r.lastT=q.t;
  });
 }
 function destroy(host){R18Relief?.destroy(host);const r=records.get(host);if(!r)return;r.dead=true;r.ro.disconnect();r.mo.disconnect();host.removeEventListener('pointermove',r.onPointerMove);host.removeEventListener('pointerleave',r.onPointerLeave);host.removeEventListener('click',r.onClick);removeEventListener('scroll',r.onScroll,true);sets.get(r.root)?.delete(r);r.faces.forEach(f=>{f.light.remove();f.edge.remove()});records.delete(host)}
 function info(root){return [...(sets.get(root)||[])].map(r=>({product:r.host.dataset.product,phase:r.phase,edgePhase:+r.edge.toFixed(5),lightX:r.lightX,lightY:r.lightY,tiltX:r.tiltX,tiltY:r.tiltY,frames:r.frames,cardHover:r.cardHover,clickCount:r.clickCount,impulse:r.impulse,relief:R18Relief?.info(r.host),buffer:[Math.round(r.w*r.scale),Math.round(r.h*r.scale)],connected:r.host.isConnected}))}
export default {mount,paint,destroy,info,perimeter};
