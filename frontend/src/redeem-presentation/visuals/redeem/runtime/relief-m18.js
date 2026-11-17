/* M1.8 — shallow-relief normal shading from our original SVG geometry.
 * One-time height-map preparation per emblem. No remote images, fonts or user data.
 * The existing environment clock calls paint(); no additional animation loop.
 * This is Canvas2D normal-map shading, not path tracing / WebGL / physical simulation. */
import V45Emblems from './card-emblems.js';
'use strict';
 const N=288,cache=new Map(),mounted=new WeakMap(),clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
 const rgb=s=>/^#[0-9a-f]{6}$/i.test(s)?[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)):[207,193,163];
 const cnv=()=>{const c=document.createElement('canvas');c.width=c.height=N;return c;};
 function shape(ctx,el){ctx.save();const tr=el.getAttribute?.('transform'),rotation=/rotate\(([-.\d]+)/.exec(tr||'');if(rotation)ctx.rotate(Number(rotation[1])*Math.PI/180);
  if(el.tagName==='path') {const path=new Path2D(el.getAttribute('d')||''),low=el.classList.contains('low-facet');ctx.fillStyle=low?'#aaaaaa':'#ffffff';ctx.strokeStyle='#ffffff';if(el.classList.contains('open-line')){ctx.lineWidth=1.1;ctx.stroke(path);}else ctx.fill(path);}
  for(const child of el.children||[])shape(ctx,child);ctx.restore();
 }
 function prepare(name){if(cache.has(name))return cache.get(name);const def=V45Emblems?.definitions[name];if(!def||name==='neutral')return null;
  const a=cnv(),g=a.getContext('2d',{willReadFrequently:true});g.translate(N/2,N/2);g.scale(N/240,N/240);
  const svg=new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">'+def.body+'</svg>','image/svg+xml').documentElement;shape(g,svg);
  const wide=cnv(),wg=wide.getContext('2d',{willReadFrequently:true});wg.filter='blur(2.3px)';wg.drawImage(a,0,0);const blurred=wg.getImageData(0,0,N,N).data;
  const fine=cnv(),fg=fine.getContext('2d',{willReadFrequently:true});fg.filter='blur(.65px)';fg.drawImage(a,0,0);const small=fg.getImageData(0,0,N,N).data,source=g.getImageData(0,0,N,N).data;
  const height=new Float32Array(N*N);for(let i=0;i<height.length;i++){const j=i*4;height[i]=(.72*small[j]+.28*blurred[j])/255*(.72*small[j+3]+.28*blurred[j+3])/255;}
  const pts=[];
  for(let y=2;y<N-2;y++)for(let x=2;x<N-2;x++){const i=y*N+x,k=i*4,alpha=source[k+3]/255;if(alpha<.005)continue;
   // Smooth raised bevel + low-amplitude faceting across each petal/plate.
   let nx=-(height[i+1]-height[i-1])*14,ny=-(height[i+N]-height[i-N])*14,nz=1;
   const u=(x-N/2)/(N*.4),v=(y-N/2)/(N*.4),a=Math.atan2(v,u),r=Math.hypot(u,v);
   if(['reserve','aperture','signet','circuit'].includes(name)){const n=name==='reserve'?8:name==='aperture'?6:name==='signet'?8:4,sector=Math.floor((a+Math.PI)/(2*Math.PI/n)),ang=sector*2*Math.PI/n+Math.PI/n;nx+=Math.cos(ang)*.24*(source[k]<220?1.45:1);ny+=Math.sin(ang)*.24*(source[k]<220?1.45:1);}
   else{nx+=u*.22;ny+=v*.22;}
   const norm=Math.hypot(nx,ny,nz);pts.push([k,nx/norm,ny/norm,nz/norm,alpha,source[k]/255,r,a]);
  }
  const packed=new Float64Array(pts.length*8);for(let j=0;j<pts.length;j++){const [k,nx,ny,nz,alpha,mask]=pts[j],b=j*8;packed[b]=k;packed[b+1]=nx;packed[b+2]=ny;packed[b+3]=nz;packed[b+4]=Math.round(alpha*246);packed[b+5]=mask<.75?.86:1;packed[b+6]=(Math.sin(k*.618)*.5+.5)*.012;}
  const v={name,points:packed,count:pts.length};cache.set(name,v);return v;
 }
 function paint(host,q,metalColor,reflector){if(!host?.isConnected)return;const name=host.dataset.emblem||'neutral',normal=prepare(name);if(!normal)return;
  let state=mounted.get(host);if(!state){state={last:-99,signature:'',frames:0,image:new ImageData(N,N),bufferName:''};mounted.set(host,state);}
  const signature=name+'|'+metalColor.join(',')+'|'+reflector.join(',')+'|'+Math.round((q.scene?.x||0)*45)+':'+Math.round((q.scene?.y||0)*45);if(!q.staticMode&&state.signature===signature&&q.t-state.last<1/(q.motion==='light'?12:22))return;
  state.signature=signature;state.last=q.t;const roots=[...host.querySelectorAll('.couture-motif')];
  const visible=host.dataset.flipped==='true'?1:0;
  const rig=q.scene||{},aut=q.staticMode?0:Math.sin(q.t*.24)*.20;
  let lx=-.44+(rig.x||0)*.65+aut,ly=-.66+(rig.y||0)*.52,lz=.85,nm=Math.hypot(lx,ly,lz);lx/=nm;ly/=nm;lz/=nm;
  const hx=lx,hy=ly,hz=lz+1,hn=Math.hypot(hx,hy,hz),level=Number(host.dataset.craftLevel||1);
  const ink=rgb(host.style.getPropertyValue('--card-deep')),out=state.image.data,shadowWeight=host.dataset.projectedTone==='light'?.58:.52;
  if(state.bufferName!==name){out.fill(0);state.bufferName=name;}
  const points=normal.points,power=44+level*7,specular=.52+level*.055;
  for(let p=0;p<points.length;p+=8){const i=points[p],nx=points[p+1],ny=points[p+2],nz=points[p+3];
   const diffuse=Math.max(0,nx*lx+ny*ly+nz*lz),spec=Math.pow(Math.max(0,(nx*hx+ny*hy+nz*hz)/hn),power),broad=Math.pow(diffuse,3.5);
   const energy=.22+diffuse*.48+broad*.13+points[p+6],cut=points[p+5];
   for(let c=0;c<3;c++)out[i+c]=ink[c]*shadowWeight+metalColor[c]*energy*cut+reflector[c]*spec*specular;
   out[i+3]=points[p+4];
  }
  for(let j=0;j<roots.length;j++){const el=roots[j];if(j!==visible&&host.dataset.phase!=='verifying')continue;
   let canvas=el.querySelector('canvas.relief18');if(!canvas){canvas=cnv();canvas.className='relief18';canvas.setAttribute('aria-hidden','true');el.prepend(canvas);}
   canvas.getContext('2d').putImageData(state.image,0,0);el.dataset.reliefReady='true';
  }
  state.frames++;state.light=[lx,ly,lz];state.name=name;state.sampleCount=normal.count;
 }
 function destroy(host){host.querySelectorAll('.relief18').forEach(c=>c.remove());mounted.delete(host);}
 function info(host){const s=mounted.get(host);return s?{frames:s.frames,name:s.name,samples:s.sampleCount,light:s.light,normalBuffer:[N,N]}:null;}

export default {paint,destroy,info,prepare};
