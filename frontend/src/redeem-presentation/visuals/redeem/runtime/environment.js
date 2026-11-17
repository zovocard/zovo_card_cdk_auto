import R45Optics from "./optical-motion.js";
import R13Scene from "./scene-m13.js";
import R16Myth from "./mythic-atmosphere.js";
import R17Tone from "./tone-m17.js";
import * as R191Field from "./field-kernel-m191.js";
import * as R191FieldClient from "./field-client-m191.js";
/* V4.5 M1 — independently moving environmental materials + a shared optical clock.
 * Canvas2D is the tested production candidate; no unverified WebGL-only path.
 * Procedural cloud/fold fields are intentionally soft; stars and card edge are drawn
 * at display resolution. This decorative clock cannot change orders or deadlines. */
'use strict';
export function createEnvironment(root, artwork={}, onDecorativeFrame){
 const bg=root.querySelector('[data-v4-environment]'),sc=root.querySelector('[data-v4-stars]');
 const g=bg.getContext('2d',{alpha:false}),s=sc.getContext('2d'),mq=matchMedia('(prefers-reduced-motion: reduce)');
 if(!g||!s) return {setTheme(){},setDarkness(){},setMotion(){},setPhase(){},setBackgroundEnabled(){},destroy(){},info:()=>({renderer:'none'})};
 const v={theme:'atelier',motion:'full',phase:'idle',enabled:true,t:0,energy:1,target:1,w:1,h:1,scale:1,raf:0,last:0,drawAt:0,frames:0,drawMs:0,dead:false,night:0,x:0,y:0,px:0,py:0};
 const rig=R13Scene?.create(root);let scene=rig?.sample(0,0,'atelier',false)||null;
 const TAU=2*Math.PI,clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));let seed=93117;
 const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
 const fieldRenderer=R191Field.create();
 const field=document.createElement('canvas'),fg=field.getContext('2d',{alpha:false});let pixels,fw=384,fh=240,fieldReady=false,requestedKey='',latestKey='';
 const fieldWorker=R191FieldClient.create(data=>{if(v.dead||seekOnly||stopped()||document.hidden||!v.enabled||data.key!==latestKey||data.width!==fw||data.height!==fh)return;fg.putImageData(new ImageData(new Uint8ClampedArray(data.buffer),data.width,data.height),0,0);fieldReady=true;});
 const prior=document.createElement('canvas'),ps=document.createElement('canvas'),pg=prior.getContext('2d'),psg=ps.getContext('2d');let blending=false,blendStart=0,blendFrames=0;
 const warp=document.createElement('canvas'),wg=warp.getContext('2d',{alpha:false});
 const images=new Map();let stars=[];let first=true;let seekOnly=false;let fieldStamp=-1e6;let darknessOverride=null;
 const bases={atelier:'#090c12',silk:'#15100d',porcelain:'#e8eee9',orbit:'#070c1b',astral:'#060b19',verdant:'#071e1a',dawn:'#efe1da'};
 const stopped=()=>v.motion==='static'||mq.matches;
 const strength=()=>v.motion==='light'?.55:1;
 const rgba=(c,a)=>`rgba(${c},${clamp(a)})`;
 function img(name){if(images.has(name))return images.get(name);const x=new Image();images.set(name,x);x.onload=()=>{if(!v.dead)draw()};if(artwork[name])x.src=artwork[name];return x}
 function load(){if(v.theme==='astral')img('astral-0');if(['atelier','silk'].includes(v.theme))img('silk-0')}
 function fit(){v.w=innerWidth;v.h=innerHeight;v.scale=Math.min(devicePixelRatio||1,1.25,Math.sqrt(1900000/(v.w*v.h)));
  bg.width=Math.round(v.w*v.scale);bg.height=Math.round(v.h*v.scale);sc.width=bg.width;sc.height=bg.height;warp.width=bg.width;warp.height=bg.height;
  fw=v.w<720?136:224;fh=Math.max(104,Math.min(320,Math.round(fw*v.h/v.w)));field.width=fw;field.height=fh;pixels=fg.createImageData(fw,fh);
  fieldStamp=-1e6;fieldReady=false;requestedKey='';latestKey='';fieldWorker.clear();seed=60103;stars=Array.from({length:v.w<720?260:720},(_,i)=>({x:rand(),y:rand(),z:.2+rand()**2*1.8,a:.18+rand()*.70,r:i<18?1.1+rand()*.6:.35+rand()*.6,p:rand()*TAU}));
 }
 function cover(ctx,im,extra=1,dx=0,dy=0){if(!im?.complete||!im.naturalWidth)return;const z=Math.max(v.w/im.width,v.h/im.height)*extra;ctx.drawImage(im,(v.w-im.width*z)/2+dx,(v.h-im.height*z)/2+dy,im.width*z,im.height*z)}
 function glow(ctx,x,y,rx,ry,color,alpha){alpha*=(1-v.night*.65)*(['porcelain','dawn'].includes(v.theme)?1-v.night*.40:1);ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);let p=ctx.createRadialGradient(0,0,0,0,0,1);p.addColorStop(0,rgba(color,alpha));p.addColorStop(.40,rgba(color,alpha*.45));p.addColorStop(1,rgba(color,0));ctx.fillStyle=p;ctx.fillRect(-1,-1,2,2);ctx.restore()}
 function materialWarp(im,t){
  if(!im?.complete||!im.naturalWidth)return;const w=warp.width,h=warp.height,scale=Math.max(w/im.width,h/im.height)*1.20;
  const iw=w/scale,ih=h/scale,sx=(im.width-iw)/2,sy=(im.height-ih)/2;wg.globalCompositeOperation='source-over';
  // Integer destination strips prevent additive one-pixel seams under screen compositing.
  const step=8;
  for(let y=0;y<h;y+=step){const band=Math.min(step,h-y),shift=Math.sin(y/h*4+t*.42)*22+Math.sin(y/h*7-t*.26)*8;
   wg.drawImage(im,sx+shift/scale+Math.sin(t*.13)*9+(scene?.x||0)*19,sy+y/scale+(scene?.y||0)*7,iw,band/scale,0,y,w,band);
  }
  g.drawImage(warp,0,0,v.w,v.h);
 }

 function raster(kind){
  const key=[kind,v.night,fw,fh,v.w,v.h,v.motion].join(':');if(latestKey!==key)fieldReady=false;latestKey=key;
  const due=requestedKey!==key||v.t-fieldStamp>=1/(v.motion==='light'?10:20)||!fieldReady;
  if(due){
   const job={width:fw,height:fh,viewWidth:v.w,viewHeight:v.h,time:v.t,theme:kind,night:v.night,motion:v.motion,
    scene:scene?{x:scene.x,y:scene.y,depth:scene.depth}:null};
   // Offline deterministic capture and explicit static mode remain synchronous.
   // They use exactly the same function as the live worker, not a prettier render path.
   const useWorker=!seekOnly&&!stopped();
   if(requestedKey!==key||v.t-fieldStamp>=1/(v.motion==='light'?10:20)){
    fieldStamp=v.t;requestedKey=key;
    const accepted=useWorker&&fieldWorker.request(job,key);
    if(!accepted||!fieldReady){pixels.data.set(fieldRenderer.render(job,pixels.data.buffer));fg.putImageData(pixels,0,0);fieldReady=true;}
   }else if(!fieldReady&&fieldWorker.info().mode!=='worker'){
    pixels.data.set(fieldRenderer.render(job,pixels.data.buffer));fg.putImageData(pixels,0,0);fieldReady=true;
   }
  }
  if(fieldReady)g.drawImage(field,0,0,v.w,v.h);
 }

 function reflectedScene(){
  if(!scene)return;const {w,h,t}=v,{lightX:lx,lightY:ly,x,y}=scene,amp=strength()*(.8+scene.energy)*(1-v.night*.60),theme=v.theme;
  g.save();
  const cx=w*lx,cy=h*ly;
  if(theme==='atelier'){
   g.globalCompositeOperation='screen';glow(g,cx,cy,w*.36,h*.64,'204,181,142',.17*amp);
   g.save();g.translate(w*(.48+x*.10),h*(.45+y*.05));g.rotate(-.37+x*.08);
   const beam=g.createLinearGradient(-w*.22,0,w*.22,0);beam.addColorStop(0,'#fff0');beam.addColorStop(.43,'rgba(234,214,172,.018)');beam.addColorStop(.52,`rgba(245,229,190,${.11*amp})`);beam.addColorStop(.67,'rgba(171,147,110,.008)');beam.addColorStop(1,'#fff0');g.fillStyle=beam;g.fillRect(-w*.22,-h,w*.44,h*2);g.restore();
  }else if(theme==='silk'){
   g.globalCompositeOperation='screen';for(let k=0;k<3;k++){
    g.save();g.translate(w*(.18+k*.26+x*.13),h*(.5+y*.04));g.rotate(-.4+Math.sin(t*.10+k)*.13);
    const q=g.createLinearGradient(-w*.17,0,w*.17,0);q.addColorStop(0,'#fff0');q.addColorStop(.42,'rgba(221,184,128,.02)');q.addColorStop(.55,`rgba(253,225,168,${.14*amp})`);q.addColorStop(1,'#fff0');g.fillStyle=q;g.beginPath();g.moveTo(-w*.16,-h);g.bezierCurveTo(w*.12,-h*.28,-w*.09,h*.23,w*.16,h);g.lineTo(w*.28,h);g.bezierCurveTo(w*.03,h*.18,w*.26,-h*.23,-w*.02,-h);g.closePath();g.fill();g.restore();
   }
  }else if(theme==='porcelain'||theme==='dawn'){
   glow(g,cx,cy,w*.50,h*.75,theme==='dawn'?'255,244,220':'255,255,252',.55*amp);
   g.save();g.translate(cx,cy);g.rotate(-.22+x*.08);const q=g.createLinearGradient(-w*.25,0,w*.25,0);q.addColorStop(0,'#fff0');q.addColorStop(.46,theme==='dawn'?'rgba(171,133,128,.08)':'rgba(113,151,144,.07)');q.addColorStop(.51,`rgba(255,255,255,${.50*(1-v.night*.83)})`);q.addColorStop(.64,'rgba(255,255,255,.03)');q.addColorStop(1,'#fff0');g.fillStyle=q;g.fillRect(-w*.25,-h,w*.5,h*2);g.restore();
  }else if(theme==='verdant'){
   g.globalCompositeOperation='screen';glow(g,cx,cy,w*.35,h*.55,'144,190,139',.22*amp);
   for(let i=0;i<3;i++){g.strokeStyle=`rgba(201,211,150,${(.06+i*.012)*amp})`;g.lineWidth=1+i*.5;g.beginPath();const bx=w*(.15+i*.34+x*.06);g.moveTo(bx,-20);g.bezierCurveTo(bx+w*.2*Math.sin(t*.1+i),h*.3,bx-w*.23,h*.75,bx+w*.07,h+30);g.stroke();}
  }else{
   g.globalCompositeOperation='screen';glow(g,cx,cy,w*.37,h*.46,theme==='astral'?'111,157,222':'129,125,195',.16*amp);
  }
  g.restore();
 }
 function draw(){if(v.dead||document.hidden)return;v.night=darknessOverride??(globalThis.R14Policy?.get().darkness||0);const start=performance.now(),{w,h,t}=v;
  g.setTransform(v.scale,0,0,v.scale,0,0);s.setTransform(v.scale,0,0,v.scale,0,0);g.globalCompositeOperation='source-over';g.globalAlpha=1;g.fillStyle=R17Tone?R17Tone.mix(bases[v.theme],R17Tone.scene(v.theme).base,v.night):bases[v.theme];g.fillRect(0,0,w,h);
  if(!v.enabled){s.clearRect(0,0,w,h);v.frames++;return;}
  raster(v.theme);
  if(v.theme==='astral'){
   g.save();g.globalAlpha=.35*(1-v.night*.60);g.globalCompositeOperation='screen';cover(g,images.get('astral-0'),1.17,Math.sin(t*.115)*w*.030+v.x*20,Math.cos(t*.10)*h*.032+v.y*16);g.restore();
   g.save();g.globalCompositeOperation='screen';for(let k=0;k<5;k++)glow(g,w*(.15+k*.18+Math.sin(t*.18+k)*.035),h*(.94-k*.17+Math.cos(t*.16+k)*.045),w*.23,h*.31,k%2?'89,128,196':'100,97,165',.08*strength());g.restore();
  }
  if(v.theme==='atelier'||v.theme==='silk'){
   g.save();g.globalCompositeOperation='screen';g.globalAlpha=(v.theme==='atelier'?.16:.24)*(1-v.night*.50);materialWarp(images.get('silk-0'),t);g.restore();
   glow(g,w*(.28+.13*Math.sin(t*.18)),h*(.38+.10*Math.cos(t*.12)),w*.51,h*.82,'180,151,113',.09);
  }
  if(v.theme==='porcelain')glow(g,w*(.27+.2*Math.sin(t*.14)),h*.38,w*.68,h*.74,'255,255,255',.26);
  if(v.theme==='verdant'){g.save();g.globalCompositeOperation='screen';glow(g,w*(.28+.09*Math.sin(t*.16)),h*.46,w*.32,h*.51,'156,196,128',.17);g.restore();}
  if(v.theme==='dawn'){glow(g,w*(.22+.15*Math.sin(t*.13)),h*.28,w*.62,h*.65,'255,248,226',.6);}
  reflectedScene();
  const glint=R45Optics?.info(root)?.[0]?.impulse||0;
  if(glint>.01&&!stopped()){const c=R16Myth?.profiles[v.theme]?.color||[210,185,141];g.save();g.globalCompositeOperation='screen';glow(g,w*.32+(scene?.x||0)*20,h*.57,w*.31,h*.25,c.join(','),glint*.10);g.restore();}

  // Protect the operation column without dimming away the entire moving scene.
  if(!['porcelain','dawn'].includes(v.theme)||v.night>.1){g.save();g.globalAlpha=1-v.night*.35;const q=g.createLinearGradient(0,0,w,0);q.addColorStop(0,'rgba(3,6,11,.1)');q.addColorStop(.48,'rgba(3,6,11,.04)');q.addColorStop(.70,'rgba(3,6,11,.35)');q.addColorStop(1,'rgba(3,6,11,.45)');g.fillStyle=q;g.fillRect(0,0,w,h);g.restore()}
  s.clearRect(0,0,w,h);s.globalAlpha=1-v.night*.13;
  if(v.theme==='orbit'){
   s.save();s.globalCompositeOperation='screen';const cx=(w<720?w*.5:w*.39)+(scene?.x||0)*22,cy=h*.50+(scene?.y||0)*15,rx=w<720?w*.7:Math.min(w*.34,520),ry=Math.min(h*.29,260);
   for(let k=0;k<3;k++){s.save();s.translate(cx,cy);s.rotate(-.24+k*.17+(scene?.x||0)*.038);s.lineWidth=.9;s.strokeStyle=rgba('131,160,218',.13);s.beginPath();s.ellipse(0,0,rx+k*26,ry+k*22,0,0,TAU);s.stroke();
    let a=t*(.18+k*.026)*(k%2?-1:1)+k*2.5;s.strokeStyle=rgba(k%2?'168,147,233':'139,190,239',.55);s.lineWidth=1.6;s.beginPath();s.ellipse(0,0,rx+k*26,ry+k*22,0,a,a+.44);s.stroke();glow(s,Math.cos(a+.44)*(rx+k*26),Math.sin(a+.44)*(ry+k*22),11,11,'173,189,247',.52);s.restore();}
   s.restore();
  }
  if(v.theme==='astral'||v.theme==='orbit'){
   const count=v.theme==='astral'?stars.length:80;
   for(let i=0;i<count;i++){let a=stars[i],x=(a.x*w+t*7.7*a.z*strength()+v.x*21*a.z+w*20)%w,y=(a.y*h-t*2.2*a.z*strength()+Math.sin(t*.22+a.p)*3+v.y*12*a.z+h*20)%h;
    const fade=Math.max(0,Math.min(1,x/24,(w-x)/24,y/24,(h-y)/24)),alpha=a.a*(.68+.32*Math.sin(t*(.62+a.z*.28)+a.p))*fade*(v.theme==='orbit'?.43:1);
    s.fillStyle=rgba(i%3?'188,214,250':'235,229,217',alpha);s.beginPath();s.arc(x,y,a.r*(.7+a.z*.3),0,TAU);s.fill();if(i<9&&v.theme==='astral')glow(s,x,y,5,5,'216,233,255',alpha*.28);
   }
   if(v.theme==='astral'&&!stopped()&&v.motion==='full'){
    const t0=t%13.7;if(t0>3.0&&t0<4.25){const f=(t0-3)/1.25,x=w*(.81-.29*f),y=h*(.09+.19*f),q=s.createLinearGradient(x,y,x+126,y-61);q.addColorStop(0,rgba('236,247,255',Math.sin(f*Math.PI)*.88));q.addColorStop(1,'rgba(152,183,248,0)');s.strokeStyle=q;s.lineWidth=1.2;s.beginPath();s.moveTo(x,y);s.lineTo(x+126,y-61);s.stroke();}
   }
  }
  R16Myth?.draw(s,{w,h,t,theme:v.theme,phase:v.phase,motion:v.motion,scene,staticMode:stopped(),darkness:v.night});
  onDecorativeFrame?.({time:t,staticMode:stopped(),reduced:mq.matches,pointerX:scene?.x??v.x*2});
  s.globalAlpha=1;
  if(blending){const f=clamp((performance.now()-blendStart)/(v.motion==='light'?420:850)),a=1-f*f*(3-2*f);g.save();g.setTransform(1,0,0,1,0,0);g.globalAlpha=a;g.drawImage(prior,0,0,bg.width,bg.height);g.restore();s.save();s.setTransform(1,0,0,1,0,0);s.globalAlpha=a;s.drawImage(ps,0,0,sc.width,sc.height);s.restore();blendFrames++;if(f>=1||stopped())blending=false;}
  v.frames++;v.drawMs=v.drawMs*.9+(performance.now()-start)*.1;
 }
 root.style.setProperty('--ambient-foil-opacity','0');
 function optics(dt){R45Optics?.paint(root,{t:v.t,dt,theme:v.theme,phase:v.phase,strength:strength()*(1-v.night*.24),energy:v.energy,px:v.x,py:v.y,scene,staticMode:stopped()})}
 function paintHz(){if(v.motion==='light')return 20;const el=document.activeElement;if(el&&el.matches&&el.matches('input,textarea,select,[contenteditable="true"]'))return 18;return v.w<900?24:30}
 function frame(now){v.raf=0;if(v.dead||document.hidden||stopped()||seekOnly)return;
  const dt=Math.min(.08,v.last?(now-v.last)/1000:.016);v.last=now;v.energy+=(v.target-v.energy)*(1-Math.exp(-dt*1.6));v.t+=dt*(.7+v.energy*.3);scene=rig?.sample(dt,v.t,v.theme,stopped())||null;if(scene){v.x=scene.px;v.y=scene.py}else{v.x+=(v.px-v.x)*Math.min(1,dt*3);v.y+=(v.py-v.y)*Math.min(1,dt*3);}
  if(now-v.drawAt>=1000/paintHz()-.3){v.drawAt=now;draw()};optics(dt);v.raf=requestAnimationFrame(frame);
 }
 function sync(){fieldWorker.clear();requestedKey='';fieldStamp=-1e6;cancelAnimationFrame(v.raf);v.raf=0;v.last=0;if(v.dead||document.hidden)return;scene=rig?.sample(0,v.t,v.theme,stopped())||null;draw();optics(0);if(!stopped()&&!seekOnly)v.raf=requestAnimationFrame(frame)}
 function snapshot(){prior.width=bg.width;prior.height=bg.height;ps.width=sc.width;ps.height=sc.height;pg.drawImage(bg,0,0);psg.drawImage(sc,0,0)}
 function setTheme(t){if(!Object.hasOwn(bases,t)||t===v.theme&&!first)return;const blend=!first&&v.frames&&!stopped();if(blend)snapshot();first=false;v.theme=t;fieldStamp=-1e6;requestedKey='';latestKey='';fieldWorker.clear();root.dataset.renderer='canvas2d-m13-shared-rig';load();blending=blend;blendStart=performance.now();sync()}
 function setMotion(m){if(m===v.motion)return;v.motion=m;sync()}
 function setPhase(p){if(p===v.phase)return;v.phase=p;v.target=({idle:1,verifying:1.23,review:.78,submitting:1.30,processing:1.27,success:.70,unknown:.53,failed:.40,action:.57})[p]||1;sync()}
 function setBackgroundEnabled(b){const enabled=b!==false;if(enabled===v.enabled)return;v.enabled=enabled;root.dataset.ambientEnabled=String(enabled);sync()}
 const pointer=e=>{if(rig||stopped()||e.pointerType==='touch')return;v.px=e.clientX/innerWidth-.5;v.py=e.clientY/innerHeight-.5},resize=()=>{fit();sync()},vis=()=>{root.dataset.hidden=String(document.hidden);sync()};
 const lighting=()=>{fieldStamp=-1e6;sync()};addEventListener('redeem:lighting',lighting);
 addEventListener('pointermove',pointer,{passive:true});addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',vis);mq.addEventListener('change',sync);
 fit();load();sync();
 return {setTheme,setMotion,setPhase,setBackgroundEnabled,setDarkness:d=>{const next=Number.isFinite(d)?clamp(d):null;if(next===darknessOverride)return;darknessOverride=next;fieldStamp=-1e6;sync()},seek:t=>{const dt=Math.max(0,t-v.t);v.t=t;blending=false;scene=rig?.sample(Math.min(.1,dt),v.t,v.theme,stopped())||null;if(scene){v.x=scene.px;v.y=scene.py;}fieldStamp=-1e6;draw();optics(dt)},setOfflineCapture:on=>{seekOnly=on;sync()},redraw:sync,
  info:()=>({backgroundRenderer:'canvas2d-m191-same-field',fieldWorker:fieldWorker.info(),nightProjection:v.night,myth:R16Myth?.profiles[v.theme]?.name,flow:'nested-fbm + gradient normal, original 2D field',scene:rig?.info(),theme:v.theme,themeTransition:blending,blendFrames,phase:v.phase,motion:v.motion,backgroundEnabled:v.enabled,systemReduced:mq.matches,time:+v.t.toFixed(3),energy:v.energy,frames:v.frames,rafActive:!!v.raf,buffer:[bg.width,bg.height],softFieldBuffer:[fw,fh],meanDrawMs:+v.drawMs.toFixed(2),optics:R45Optics?.info(root)}),
  capture:()=>({background:bg.toDataURL('image/webp',.94),stars:sc.toDataURL('image/png')}),
  destroy:()=>{v.dead=true;fieldWorker.destroy();removeEventListener('redeem:lighting',lighting);rig?.destroy();cancelAnimationFrame(v.raf);removeEventListener('pointermove',pointer);removeEventListener('resize',resize);document.removeEventListener('visibilitychange',vis);mq.removeEventListener('change',sync)}};
};
