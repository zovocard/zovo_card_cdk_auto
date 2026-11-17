/* M1.9.1 — exact M1.9 field equations; usable on the UI thread or in a worker.
 * No lower resolution, fewer octaves, reduced particle count, or timing changes. */
import R17Tone from './tone-m17.js';
'use strict';
 const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
 function create(){
  let seed=93117; const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  const noise=new Float32Array(256*256);for(let i=0;i<noise.length;i++)noise[i]=rand();
 function n(x,y){const a=Math.floor(x),b=Math.floor(y);let u=x-a,z=y-b;u=u*u*(3-2*u);z=z*z*(3-2*z);const i=(a&255)+((b&255)*256),j=((a+1)&255)+((b&255)*256),k=(a&255)+(((b+1)&255)*256),l=((a+1)&255)+(((b+1)&255)*256);return (noise[i]*(1-u)+noise[j]*u)*(1-z)+(noise[k]*(1-u)+noise[l]*u)*z}
 function fbm(x,y){return n(x,y)*.62+n(x*2.03+21,y*2.03+73)*.27+n(x*4.07+13,y*4.07-19)*.11}

 let fieldValues=null;
 function render(job,buffer){
  const fw=job.width,fh=job.height,kind=job.theme;
  const v={w:job.viewWidth,h:job.viewHeight,t:job.time,night:job.night,motion:job.motion};
  const scene=job.scene||null,strength=()=>v.motion==='light'?.55:1;
  const bytes=fw*fh*4;
  const output=buffer&&buffer.byteLength===bytes?new Uint8ClampedArray(buffer):new Uint8ClampedArray(bytes);
  const writePixel=R17Tone?.fieldWriter(kind,v.night),a=output,t=v.t*strength(),aspect=v.w/v.h;
  const form=({atelier:[1.08,1.12,.35,0],silk:[.89,1.35,-.42,7.7],porcelain:[.84,1.05,.22,15.3],orbit:[1.09,.98,-.28,24.1],astral:[1.0,1.03,.35,39.7],verdant:[.68,1.26,.52,51.4],dawn:[.90,1.09,-.56,69.2]})[kind];
  const ca=Math.cos(form[2]),sa=Math.sin(form[2]);
  const dx=(scene?.x||0)*(scene?.depth||1)*.08,dy=(scene?.y||0)*(scene?.depth||1)*.06;
  if(!fieldValues||fieldValues.length!==fw*fh)fieldValues=new Float32Array(fw*fh);
  // Nested spatial warps, rather than moving a background image or rigid stripes.
  for(let iy=0;iy<fh;iy++)for(let ix=0;ix<fw;ix++){
   const ox=(ix/fw-.5)*aspect+dx,oy=iy/fh-.5+dy,x=(ox*ca-oy*sa)*form[0]+form[3],y=(ox*sa+oy*ca)*form[1]+form[3]*.39;
   const u=fbm(x*1.42+t*.090,y*1.6-t*.051);
   const z=fbm(x*1.58+9.13-t*.073,y*1.44+6.87+t*.060);
   const w=fbm(x*2.13+u*2.15+t*.055,y*2.36+z*2.55-t*.087);
   fieldValues[iy*fw+ix]=fbm(x*2.83+z*3.10+w*1.40-t*.026,y*2.56+u*2.82+w*1.18+t*.043);
  }
  const lampX=-.38+(scene?.x||0)*.32,lampY=-.72+(scene?.y||0)*.26;
  for(let iy=0;iy<fh;iy++)for(let ix=0;ix<fw;ix++){
   const k=iy*fw+ix,x=ix/fw,y=iy/fh,f=fieldValues[k];
   const sx=(fieldValues[iy*fw+Math.min(fw-1,ix+1)]-fieldValues[iy*fw+Math.max(0,ix-1)])*13;
   const sy=(fieldValues[Math.min(fh-1,iy+1)*fw+ix]-fieldValues[Math.max(0,iy-1)*fw+ix])*13;
   const normal=(-sx*lampX-sy*lampY+.78)/Math.sqrt(sx*sx+sy*sy+1);
   const crest=Math.exp(-Math.abs(f-.515)*30),body=Math.exp(-Math.abs(f-.49)*7);
   const recess=clamp((f-.30)*1.62),shine=Math.pow(Math.max(0,normal),10);
   const quiet=1-.46*Math.exp(-((x-.81)**2*29+(y-.53)**2*5.5));
   const light=(crest*.69+body*.15+shine*.19)*quiet;let R,G,B;
   if(kind==='atelier'){R=9+light*112;G=10+light*91;B=14+light*63;}
   else if(kind==='silk'){R=17+light*168;G=13+light*119;B=12+light*66;}
   else if(kind==='porcelain'){R=209+body*24+crest*19-recess*12;G=222+body*19+crest*15-recess*8;B=214+body*22+crest*20-recess*11;}
   else if(kind==='verdant'){const vein=crest*.63+shine*.16;R=6+body*12+vein*43;G=24+body*30+vein*81;B=19+body*25+vein*43;}
   else if(kind==='dawn'){R=213+body*21+crest*18;G=187+body*24+crest*30;B=187+body*25+crest*28;}
   else if(kind==='astral'){const d=y-(1.01-x*.97+Math.sin(t*.12+x*3)*.03),band=Math.exp(-d*d*11),nebula=(crest*.19+body*.27+recess*.22)*band;R=5+nebula*62;G=11+nebula*96;B=24+nebula*157;}
   else{const air=(body*.33+crest*.19+recess*.16)*quiet;R=12+air*54;G=13+air*39;B=31+air*105;}
   const p=k*4;if(writePixel)writePixel(a,p,R,G,B);else{a[p]=R;a[p+1]=G;a[p+2]=B;a[p+3]=255;}
  }

  return output;
 }
 return {render};
 }

export {create};
