/* V4.5 presentation-only transitions.
 * Colors morph on the SAME card. No cloned form, no bitmap of credentials,
 * no business callbacks, no theme-keyed remounts, no animation-driven success.
 */
'use strict';
 const records=new WeakMap(),roots=new WeakMap();
 const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 const ease=t=>t*t*(3-2*t),clamp=n=>Math.max(0,Math.min(1,n));
 function rgb(x){
  if(typeof x!=='string')return null;
  if(/^#[0-9a-f]{3}$/i.test(x))x='#'+x.slice(1).split('').map(a=>a+a).join('');
  if(/^#[0-9a-f]{6}$/i.test(x))return [1,3,5].map(i=>parseInt(x.slice(i,i+2),16));
  const m=x.match(/^rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)/);return m?[+m[1],+m[2],+m[3]]:null;
 }
 const lum=c=>{const a=c.map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return a[0]*.2126+a[1]*.7152+a[2]*.0722};
 const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
 const mix=(a,b,t)=>a.map((n,i)=>Math.round(n+(b[i]-n)*t));
 function paint(host,values,{animate=true,duration=680}={}){
  let r=records.get(host);if(!r){r={target:null,current:{},raf:0};records.set(host,r)}
  const signature=JSON.stringify(values);if(r.target===signature){
   if((!animate||reduced()||document.hidden)&&r.raf){cancelAnimationFrame(r.raf);r.raf=0;for(const[k,v]of Object.entries(values))host.style.setProperty('--card-'+k,v);r.current=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,rgb(v)]));host.dataset.paletteTransition='settled';}return;
  }
  cancelAnimationFrame(r.raf);r.raf=0;r.target=signature;
  const end=Object.fromEntries(Object.entries(values).filter(([,v])=>rgb(v)).map(([k,v])=>[k,rgb(v)]));
  const exact=()=>{for(const[k,v]of Object.entries(values))host.style.setProperty('--card-'+k,v);r.current={...end};host.dataset.paletteTransition='settled';};
  if(!animate||reduced()||document.hidden||!Object.keys(r.current).length){exact();return;}
  const begin={...r.current},started=performance.now();host.dataset.paletteTransition='running';
  function step(now){
   if(r.target!==signature)return;
   const t=clamp((now-started)/duration),f=ease(t),out={};for(const[k,v]of Object.entries(end))out[k]=mix(begin[k]||v,v,f);
   // Do not interpolate light lettering through gray onto a gray surface.
   if(t<1&&out.ink&&out.base&&out.deep){
    const surfaces=[mix(out.base,out.deep,.15),mix(out.base,out.deep,.65)];
    const score=c=>Math.min(...surfaces.map(s=>contrast(c,s)));
    for(const[k,minimum]of [['ink',4.5],['muted',3.4]])if(out[k]&&score(out[k])<minimum){
      const options=[[245,247,249],[21,29,34],end[k],begin[k]].filter(Boolean).sort((a,b)=>score(b)-score(a));out[k]=options[0];
    }
   }
   for(const[k,v]of Object.entries(out))host.style.setProperty('--card-'+k,`rgb(${v.join(',')})`);r.current=out;
   if(t===1||reduced()||document.hidden||host.dataset.fx==='static'){exact();r.raf=0;return}r.raf=requestAnimationFrame(step);
  }
  r.raf=requestAnimationFrame(step);
 }
 function destroy(host){const r=records.get(host);if(r)cancelAnimationFrame(r.raf);records.delete(host)}
 function install(root){
  if(roots.has(root))return roots.get(root);
  const active=new Set();let phase=root.dataset.workPhase,alive=true;
  const permit=()=>alive&&!reduced()&&root.dataset.motion!=='static'&&!document.hidden;
  function animate(el,frames,ms){if(!permit()||!el)return;const a=el.animate(frames,{duration:ms,easing:'cubic-bezier(.22,1,.36,1)'});active.add(a);a.finished.catch(()=>{}).finally(()=>active.delete(a));}
  const observer=new MutationObserver(()=>{
   if(!permit()){active.forEach(x=>x.cancel());return}
   const next=root.dataset.workPhase;if(next===phase)return;phase=next;
   // Human-verification and quote controls remain physically stable and immediately actionable.
   if(/challenge|verification|offline|held|identity/.test(next||''))return;
   for(const el of root.querySelectorAll('[data-work-view]:not([hidden])')){
    if(el.contains(document.activeElement)||el.querySelector('#challenge-host:not([hidden])'))continue;
    animate(el,[{opacity:.36,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],310);
   }
  });observer.observe(root,{attributes:true,attributeFilter:['data-work-phase','data-motion']});
  const vis=()=>{if(document.hidden)active.forEach(a=>a.cancel());};document.addEventListener('visibilitychange',vis);
  const api={destroy(){alive=false;observer.disconnect();active.forEach(a=>a.cancel());document.removeEventListener('visibilitychange',vis);roots.delete(root)}};roots.set(root,api);return api;
 }
 function captureEdge(host){
  const face=host.querySelector(host.dataset.flipped==='true'?'.back':'.front');
  const a=face?.querySelector('.jewel-6')?.getAnimations().find(a=>a.animationName==='v44-jewel');
  if(!a||a.currentTime===null)return null;
  const d=Number(a.effect.getTiming().duration);return d>0?(Number(a.currentTime)%d)/d:null;
 }
 function restoreEdge(host,fraction){
  if(fraction===null||reduced()||host.dataset.fx==='static')return;
  for(const el of host.querySelectorAll('.jewel-runner'))for(const a of el.getAnimations())if(a.animationName==='v44-jewel'){
   const d=Number(a.effect.getTiming().duration);if(d>0)a.currentTime=fraction*d;
  }
 }
export default {paint,destroy,install,captureEdge,restoreEdge};
