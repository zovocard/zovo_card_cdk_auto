/* M1.3 · one decorative light rig for the whole public surface.
 * Pointer coordinates are normalized; no task/account/credential state is read.
 * No RAF of its own: the existing environment renderer supplies the clock.
 */
'use strict';
 const rigs=new WeakMap(),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const profiles=Object.freeze({
  atelier:{depth:.74,response:4.0,spread:.22,warmth:1.0,card:.86},
  silk:{depth:1.05,response:3.0,spread:.31,warmth:.95,card:.70},
  porcelain:{depth:.65,response:3.7,spread:.43,warmth:.20,card:.65},
  orbit:{depth:1.08,response:4.2,spread:.24,warmth:0,card:.94},
  astral:{depth:1.32,response:3.0,spread:.29,warmth:0,card:.94},
  verdant:{depth:.92,response:3.5,spread:.22,warmth:.55,card:.80},
  dawn:{depth:.70,response:2.9,spread:.42,warmth:.85,card:.62}
 });
 function create(root){
  if(rigs.has(root))return rigs.get(root);
  const fine=matchMedia('(any-pointer: fine)'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let x=0,y=0,tx=0,ty=0,speed=0,engaged=false,dead=false,samples=0,theme='atelier',last=null;
  const move=e=>{if(dead||e.pointerType==='touch'||!fine.matches||reduce.matches||root.dataset.motion==='static')return;tx=clamp(e.clientX/Math.max(1,innerWidth)*2-1,-1,1);ty=clamp(e.clientY/Math.max(1,innerHeight)*2-1,-1,1);engaged=true;};
  const leave=e=>{if(e&&e.type==='mouseout'&&e.relatedTarget)return;tx=0;ty=0;engaged=false;};
  const vis=()=>{if(document.hidden)leave();};
  addEventListener('pointermove',move,{passive:true});addEventListener('mouseout',leave);addEventListener('blur',leave);document.addEventListener('visibilitychange',vis);
  function sample(dt,t,name,staticMode){
   theme=profiles[name]?name:'atelier';const p=profiles[theme];dt=clamp(Number(dt)||0,0,.1);
   const off=staticMode||reduce.matches;
   if(off){x=0;y=0;tx=0;ty=0;speed=0;engaged=false;}
   else{const k=1-Math.exp(-dt*p.response),ox=x,oy=y;x+=(tx-x)*k;y+=(ty-y)*k;const velocity=dt?Math.hypot(x-ox,y-oy)/dt:0;speed+=(velocity-speed)*(1-Math.exp(-dt*5));}
   const energy=clamp(speed*.14,0,.24),w=off?0:1;
   const lightX=.43+x*.30+Math.sin(t*.115)*.11*w,lightY=.30+y*.22+Math.cos(t*.095)*.08*w;
   last={x,y,px:x*.5,py:y*.5,lightX,lightY,energy,engaged:!off&&engaged,profile:p,theme,t,staticMode:off,depth:p.depth};samples++;
   // Canvas consumers read this sample directly. Avoid invalidating the entire
   // translated form subtree via inherited root custom properties every frame.
   if(root.dataset.sceneRig!=='m13')root.dataset.sceneRig='m13';
   return last;
  }
  const api={sample,info:()=>({version:'m13',theme,x,y,targetX:tx,targetY:ty,speed,engaged,samples,lightX:last?.lightX,lightY:last?.lightY,dead}),
   // Decorative input seam for deterministic motion comparison, never a business event.
   setPointer(nx,ny){if(reduce.matches||root.dataset.motion==='static')return;tx=clamp(Number(nx)||0,-1,1);ty=clamp(Number(ny)||0,-1,1);engaged=true;},
   destroy(){dead=true;removeEventListener('pointermove',move);removeEventListener('mouseout',leave);removeEventListener('blur',leave);document.removeEventListener('visibilitychange',vis);rigs.delete(root);}};
  rigs.set(root,api);return api;
 }
 const api={create,profiles,info:root=>rigs.get(root)?.info(),setPointer:(root,x,y)=>rigs.get(root)?.setPointer(x,y)};
export default api;
