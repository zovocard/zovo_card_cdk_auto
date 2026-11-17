/* M1.8 / Hue-kept dusk projection. R17Tone is the stable integration API.
 * Original sRGB palettes -> OKLCH -> lower lightness / gamut-safe chroma.
 * No generic gray tint and no full-page filter. Pure view math, no clock or I/O. */
'use strict';
 const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
 const rgb=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
 const hex=a=>'#'+a.map(n=>Math.round(clamp(n,0,255)).toString(16).padStart(2,'0')).join('');
 const mix=(a,b,q)=>{const x=rgb(a),y=rgb(b);return hex(x.map((v,i)=>v+(y[i]-v)*clamp(q)))};
 const lin=x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4};
 const srgb=x=>255*(x<=.0031308?12.92*x:1.055*Math.pow(x,1/2.4)-.055);
 function toLCH(c){const [r,g,b]=rgb(c).map(lin),l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b),L=.2104542553*l+.793617785*m-.0040720468*s,A=1.9779984951*l-2.428592205*m+.4505937099*s,B=.0259040371*l+.7827717662*m-.808675766*s;return [L,Math.hypot(A,B),Math.atan2(B,A)];}
 function linearLCH(L,C,h){const A=C*Math.cos(h),B=C*Math.sin(h),l=(L+.3963377774*A+.2158037573*B)**3,m=(L-.1055613458*A-.0638541728*B)**3,s=(L-.0894841775*A-1.291485548*B)**3;return [4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];}
 function fromLCH(L,C,h){L=clamp(L);let v=linearLCH(L,C,h);if(v.some(x=>x<0||x>1)){let a=0,b=C;for(let i=0;i<16;i++){const c=(a+b)/2,w=linearLCH(L,c,h);if(w.every(x=>x>=0&&x<=1)){a=c;v=w}else b=c}}return hex(v.map(srgb));}
 const luminance=c=>rgb(c).map(lin).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
 const profiles=Object.freeze({
  atelier:{base:'#1c1915',surface:'#29241d',accent:'#d7bc88',ink:'#eee6d5',muted:'#bfb198',ramp:['#14120f','#30271b','#56432b','#967344'],hue:78},
  silk:{base:'#211711',surface:'#30221a',accent:'#dfb181',ink:'#f0e4d5',muted:'#c5ad97',ramp:['#19110d','#3b281a','#654428','#a67a4b'],hue:65},
  porcelain:{base:'#192923',surface:'#263931',accent:'#b9d0bd',ink:'#e3eee5',muted:'#b0c4b6',ramp:['#14231e','#293f35','#496353','#79967b'],hue:157},
  orbit:{base:'#211c30',surface:'#2e2841',accent:'#c2b4e3',ink:'#eee8f7',muted:'#bdb1cf',ramp:['#151223','#302545','#53406f','#9273ac'],hue:304},
  astral:{base:'#121e2e',surface:'#1e2d42',accent:'#a9c5e7',ink:'#e5edf6',muted:'#adbed2',ramp:['#0d1624','#1c3048','#355877','#7399bb'],hue:249},
  verdant:{base:'#10281f',surface:'#19372b',accent:'#b1cba4',ink:'#e6eedc',muted:'#a7bfac',ramp:['#0c2019','#1b3c2b','#325d3e','#749363'],hue:156},
  dawn:{base:'#302024',surface:'#402c30',accent:'#dfb7aa',ink:'#f1e5df',muted:'#d0b6b1',ramp:['#24171e','#462b35','#714554','#ad7a7b'],hue:15}
 });
 const scene=theme=>profiles[theme]||profiles.atelier;
 function compressForInk(base,deep,prefer){const candidate=[prefer,prefer==='#f5f1e8'?'#141917':'#f5f1e8'];let best=null;
  for(const ink of candidate){const target=ink==='#141917'?.95:.17;for(let n=0;n<=40;n++){const q=n/40;
   const change=c=>{const [L,C,H]=toLCH(c);return fromLCH(L+(target-L)*q,C*(1-q*.25),H)};
   const a=change(base),b=change(deep);if(Math.min(contrast(ink,a),contrast(ink,b))>=4.65){if(!best||q<best.q)best={q,base:a,deep:b,ink};break;}
  }}return best||{base,deep,ink:prefer};}
 function card(p,theme,d){if(d<.001)return p;d=clamp(d);const pr=scene(theme);
  function target(c,deep){let [L,C,H]=toLCH(c);if(C<.011){H=pr.hue*Math.PI/180;C=.015;}const nt=(deep?.185:.235)+L*(deep?.22:.23);return fromLCH(nt,Math.min(.105,C*.87),H);}
  // Interpolate in OKLab-derived polar coordinates: hue is inherited, not replaced.
  function toward(c,t,q){const [L,C,H]=toLCH(c),[l,cc,hh]=toLCH(t);let dh=Math.atan2(Math.sin(hh-H),Math.cos(hh-H));return fromLCH(L+(l-L)*q,C+(cc-C)*q,H+dh*q);}
  let base=toward(p.base,target(p.base,false),d),deep=toward(p.deep,target(p.deep,true),d);
  const score=c=>Math.min(contrast(c,base),contrast(c,deep));let ink=p.ink,muted=p.muted;
  if(score(ink)<4.6){const pref=score('#f5f1e8')>score('#141917')?'#f5f1e8':'#141917';const z=compressForInk(base,deep,pref);base=z.base;deep=z.deep;ink=z.ink;}
  if(d>.55&&score(pr.ink)>=4.65)ink=pr.ink;
  if(score(muted)<4.5){muted=score(pr.muted)>=4.5?pr.muted:ink;}
  let [eL,eC,eH]=toLCH(p.edge);const edge=toward(p.edge,fromLCH(clamp(eL,.68,.86),Math.min(eC,.09),eH),d);
  return {...p,base,deep,ink,muted,edge,reflector:toward(p.reflector||'#fffef4',fromLCH(.9,.022,pr.hue*Math.PI/180),d*.72),shadow:pr.base,light:luminance(ink)<luminance(base)};
 }
 const tableCache=new Map();
 function fieldWriter(theme,d){const pr=scene(theme),pale=['porcelain','dawn'].includes(theme),q=clamp(d);let lut=tableCache.get(theme);
  if(!lut){const cols=pr.ramp.map(rgb);lut=Array.from({length:256},(_,i)=>{const x=Math.pow(i/255,.86)*3,k=Math.min(2,Math.floor(x)),f=x-k;return cols[k].map((v,j)=>v+(cols[k+1][j]-v)*f)});tableCache.set(theme,lut);}
  return(out,i,R,G,B)=>{if(q<.001){out[i]=R;out[i+1]=G;out[i+2]=B;out[i+3]=255;return;}
   const L=R*.2126+G*.7152+B*.0722,energy=pale?clamp((L-202)/62)*.64:clamp((L-4)/136),t=lut[Math.round(energy*255)];
   // A small source-colour remainder preserves local pearlescence without gray fog.
   out[i]=R+(t[0]+(R-L)*.10-R)*q;out[i+1]=G+(t[1]+(G-L)*.10-G)*q;out[i+2]=B+(t[2]+(B-L)*.10-B)*q;out[i+3]=255;
  };
 }
export default {profiles,scene,card,fieldWriter,contrast,luminance,mix};
