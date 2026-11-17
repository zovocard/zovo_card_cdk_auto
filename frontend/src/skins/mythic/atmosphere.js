/* 东方意象七主题背景氛围（canvas）。移植自 autocard 项目（原作者授权开源使用，2026-11-17）。
 * 本项目改动：去掉对宿主全局策略对象的依赖（darkness 由调用方传入）；导出名改为 mythicArt。 */
/* M1.8 · Seven original atmospheric studies inspired by Eastern mythic imagery.
 * These are poetic visual interpretations, not copies or historical reconstructions.
 * Drawn in the existing decorative canvas. No extra RAF, DOM or business effects. */

 const TAU=Math.PI*2,clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
 const profiles=Object.freeze({
  atelier:{name:'天阙云殿',color:[216,195,153],family:'cloud-terrace'},
  silk:{name:'流霞天绫',color:[235,195,147],family:'celestial-brocade'},
  porcelain:{name:'月魄玉璧',color:[113,153,145],family:'lunar-jade'},
  orbit:{name:'星宿天衡',color:[177,176,224],family:'armillary'},
  astral:{name:'辰海天河',color:[161,193,231],family:'river-of-stars'},
  verdant:{name:'青玉山海',color:[160,193,165],family:'jade-ranges'},
  dawn:{name:'曦羽流霞',color:[174,124,124],family:'dawn-plumes'}
 });
 const rgba=(c,a)=>`rgba(${c[0]},${c[1]},${c[2]},${clamp(a)})`;
 function stroke(ctx,fn,c,a,width=.8){ctx.beginPath();fn(ctx);ctx.strokeStyle=rgba(c,a);ctx.lineWidth=width;ctx.stroke()}
 function etched(ctx,fn,c,a,width=.8){ctx.save();ctx.translate(0,1.1);stroke(ctx,fn,[8,12,17],a*.24,width*1.5);ctx.restore();stroke(ctx,fn,c,a*.13,width*5);stroke(ctx,fn,c,a,width)}
 function mist(ctx,x,y,rx,ry,c,a){ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,rgba(c,a));g.addColorStop(.42,rgba(c,a*.42));g.addColorStop(1,rgba(c,0));ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore()}
 function point(ctx,x,y,c,a,r=1.3){mist(ctx,x,y,r*5,r*5,c,a*.40);ctx.fillStyle=rgba(c,a);ctx.beginPath();ctx.arc(x,y,r*.6,0,TAU);ctx.fill()}
 function cloud(ctx,x,y,scale,c,a){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
  const curl=p=>{p.moveTo(-170,23);p.bezierCurveTo(-134,24,-125,2,-104,3);p.bezierCurveTo(-86,5,-84,17,-65,13);p.bezierCurveTo(-35,9,-44,-29,-16,-36);p.bezierCurveTo(14,-43,38,-26,30,-8);p.bezierCurveTo(23,9,2,8,0,-2);p.bezierCurveTo(-2,-17,18,-19,17,-8);p.moveTo(30,-8);p.bezierCurveTo(52,12,70,-1,101,3);p.bezierCurveTo(128,7,141,26,178,24)};
  etched(ctx,curl,c,a,.75);
  for(let i=0;i<3;i++)stroke(ctx,p=>{p.moveTo(-195-i*9,38+i*9);p.bezierCurveTo(-122,45+i*11,-69,18+i*8,-12,22+i*10);p.bezierCurveTo(39,27+i*8,94,49+i*9,207+i*8,31+i*10)},c,a*(.46-i*.10),.48);
  ctx.restore();
 }
 function terrace(ctx,x,y,scale,c,a){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
  // Eaves and terraces dissolve into cloud; no solid palace blocking the card.
  const roof=p=>{p.moveTo(-157,4);p.bezierCurveTo(-111,9,-79,-3,-40,-11);p.quadraticCurveTo(-9,-17,0,-25);p.quadraticCurveTo(9,-17,40,-11);p.bezierCurveTo(79,-3,111,9,157,4)};
  etched(ctx,roof,c,a,.72);
  stroke(ctx,p=>{p.moveTo(-132,12);p.lineTo(132,12);p.moveTo(-75,17);p.lineTo(-75,49);p.moveTo(75,17);p.lineTo(75,49);p.moveTo(-139,53);p.lineTo(139,53)},c,a*.49,.52);
  for(let i=0;i<3;i++)stroke(ctx,p=>{p.moveTo(-153-i*13,61+i*9);p.lineTo(153+i*13,61+i*9)},c,a*(.38-i*.07),.47);
  ctx.restore();
 }
 function lunar(ctx,x,y,r,c,a,t){ctx.save();ctx.translate(x,y);
  const g=ctx.createRadialGradient(-r*.25,-r*.23,1,0,0,r);g.addColorStop(0,rgba(c,.022*a));g.addColorStop(.68,rgba(c,.008*a));g.addColorStop(.91,rgba(c,.055*a));g.addColorStop(1,rgba(c,0));ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();
  for(let k=0;k<3;k++){const radius=r-k*6;etched(ctx,p=>p.ellipse(k*1.5,0,radius,radius*.96,-.10,.84+k*.06,5.52-k*.13),c,(.24-k*.065)*a,k===0?.90:.55)}
  // Soft cut-jade marks, not numerals, dial labels or writing.
  for(let i=0;i<18;i++){const ang=1.08+i/17*3.25;stroke(ctx,p=>{p.moveTo(Math.cos(ang)*(r-15),Math.sin(ang)*(r-15));p.lineTo(Math.cos(ang)*(r-18),Math.sin(ang)*(r-18))},c,.17*a,.7)}
  const ang=3.7+Math.sin(t*.07)*.35;point(ctx,Math.cos(ang)*r,Math.sin(ang)*r*.96,c,.28*a,1.6);ctx.restore();
 }
 function mountainPath(p,w,h,base,layer,shift){
  p.moveTo(-w*.1,base+h*.04);p.bezierCurveTo(w*.02,base+h*.03,w*.04,base-h*.10,w*.13,base-h*.08);
  p.bezierCurveTo(w*.18,base-h*.03,w*.21,base-h*(.20+layer*.01)+shift,w*.26,base-h*(.22+layer*.02));
  p.bezierCurveTo(w*.31,base-h*.35,w*.35,base-h*.10,w*.41,base-h*.15);
  p.bezierCurveTo(w*.49,base-h*.24,w*.51,base+h*.01,w*.68,base-h*.02);
 }
 function feather(ctx,x,y,len,rot,c,a){ctx.save();ctx.translate(x,y);ctx.rotate(rot);
  const spine=p=>{p.moveTo(-len*.18,len*.54);p.bezierCurveTo(-len*.08,len*.1,len*.24,-len*.14,len*.28,-len*.54)};
  etched(ctx,spine,c,a,.85);
  for(let i=1;i<=12;i++){
   const v=i/14,yy=len*(.5-v*.97),xx=len*(-.18+v*.44),reach=Math.sin(v*Math.PI)*len*.34;
   for(const sign of [-1,1]){const f=p=>{p.moveTo(xx,yy);p.bezierCurveTo(xx+sign*reach*.28,yy-len*.04,xx+sign*reach*.8,yy-len*.04,xx+sign*reach,yy-len*(.18-v*.06))};stroke(ctx,f,c,a*(.56+i/26),.52);}
  }
  ctx.restore();
 }

 /* M1.8 volumetric veils and cut-jade atmospheric geometry.
    All motifs are original, abstract interpretations, not historical diagrams. */
 function veil(ctx,w,h,base,span,c,a,t,seed){
  const points=[],widths=[];
  for(let i=0;i<=48;i++){
   const u=i/48,x=w*(-.12+u*.91),flow=Math.sin(u*5.2+t*.16+seed)*h*.035+Math.sin(u*9.1-t*.11+seed)*h*.012;
   points.push([x,base+Math.sin(u*5.0+seed)*h*.08+flow]);
   widths.push(Math.sin(u*Math.PI)**1.4*span*(.72+.28*Math.sin(u*4+t*.12)));
  }
  const make=(factor,sign)=>points.forEach(([x,y],i)=>i?ctx.lineTo(x,y+sign*widths[i]*factor):ctx.moveTo(x,y+sign*widths[i]*factor));
  const grad=ctx.createLinearGradient(0,base-span*2,0,base+span*2);grad.addColorStop(0,rgba(c,0));grad.addColorStop(.28,rgba(c,a*.36));grad.addColorStop(.47,rgba(c,a));grad.addColorStop(.58,rgba(c,a*.26));grad.addColorStop(1,rgba(c,0));
  ctx.fillStyle=grad;ctx.beginPath();make(1,-1);for(let i=48;i>=0;i--)ctx.lineTo(points[i][0],points[i][1]+widths[i]);ctx.closePath();ctx.fill();
  for(let j=0;j<3;j++){ctx.beginPath();make(.60+j*.20,-1);ctx.strokeStyle=rgba(c,a*(.54-j*.11));ctx.lineWidth=j===0?.68:.38;ctx.stroke();}
 }
 function jadeDisk(ctx,x,y,r,c,a,t){
  ctx.save();ctx.translate(x,y);ctx.rotate(-.10+Math.sin(t*.05)*.014);
  const rad=ctx.createRadialGradient(-r*.3,-r*.4,r*.12,0,0,r);rad.addColorStop(0,rgba(c,a*.08));rad.addColorStop(.67,rgba(c,a*.11));rad.addColorStop(.87,rgba(c,a*.04));rad.addColorStop(.94,rgba(c,a*.30));rad.addColorStop(.97,rgba(c,a*.03));rad.addColorStop(1,rgba(c,0));
  ctx.fillStyle=rad;ctx.beginPath();ctx.ellipse(0,0,r,r*.93,0,0,TAU);ctx.fill();
  // Cut-stone face bands have opposed dark and light edges, not neon rings.
  for(let j=0;j<4;j++){ctx.save();ctx.rotate(j*.017);etched(ctx,p=>p.ellipse(0,0,r*(.79+j*.035),r*(.73+j*.032),0,3.2,6.02),c,a*(.22-j*.027),.6);ctx.restore();}
  for(let j=0;j<7;j++){const x0=r*(-.72+j*.21);stroke(ctx,p=>{p.moveTo(x0,-Math.sqrt(Math.max(0,r*r-x0*x0))*.71);p.bezierCurveTo(x0+r*.05,-r*.3,x0-r*.1,r*.3,x0+r*.06,r*.50);},c,a*.032,.6);}
  ctx.restore();
 }
 function gates(ctx,x,y,s,c,a,t){
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);
  for(let tier=0;tier<3;tier++){
   const yy=tier*26,w=108+tier*34;ctx.beginPath();ctx.moveTo(-w,yy+6);ctx.quadraticCurveTo(-w*.55,yy+10,-w*.28,yy-6);ctx.quadraticCurveTo(0,yy-10,0,yy-16);ctx.quadraticCurveTo(w*.24,yy-1,w*.56,yy+3);ctx.quadraticCurveTo(w*.88,yy+10,w,yy+6);ctx.lineTo(w*.78,yy+14);ctx.lineTo(-w*.78,yy+14);ctx.closePath();ctx.fillStyle=rgba(c,a*(.32-tier*.065));ctx.fill();
   stroke(ctx,p=>{p.moveTo(-w,yy+6);p.quadraticCurveTo(-w*.44,yy+9,0,yy-16);p.quadraticCurveTo(w*.4,yy+8,w,yy+6);},c,a*(.85-tier*.15),.75);
  }
  for(const xx of [-76,-30,30,76]){stroke(ctx,p=>{p.moveTo(xx,67);p.lineTo(xx,107)},c,a*.23,.85);}
  const horizon=ctx.createLinearGradient(-210,0,210,0);horizon.addColorStop(0,rgba(c,0));horizon.addColorStop(.3,rgba(c,a*.55));horizon.addColorStop(.7,rgba(c,a*.55));horizon.addColorStop(1,rgba(c,0));ctx.strokeStyle=horizon;ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(-210,112);ctx.lineTo(210,112);ctx.stroke();
  ctx.restore();
 }
 function worlds(ctx,q,c,amp,t){
  const {w,h,theme}=q,mobile=w<720,k=Math.min(w/1440,h/900)*(mobile?1.35:1),px=q.scene?.x||0,py=q.scene?.y||0;
  const n=q.darkness||0,A=amp*(mobile?.68:1)*(n>.5?1:.95);
  if(theme==='atelier'){
   gates(ctx,w*.32+px*7,h*.105+py*4,k*.98,c,.23*A,t);
   veil(ctx,w,h,h*.23,h*.055,c,.085*A,t,2.8);
   veil(ctx,w,h,h*.87,h*.075,c,.085*A,t,-.7);
   mist(ctx,w*.25,h*.82,w*.42,h*.055,c,.045*A);
  }else if(theme==='silk'){
   for(let i=0;i<4;i++)veil(ctx,w,h,h*(.12+i*.23),h*(.040+i*.008),c,(.105-i*.014)*A,t,i*.61);
   // Brocade threads appear in the fold, not as a static rectangular texture.
   for(let i=0;i<14;i++){const u=i/13,xx=w*(.035+u*.48),yy=h*(.17+.07*Math.sin(u*4+t*.10));stroke(ctx,p=>{p.moveTo(xx-5,yy);p.quadraticCurveTo(xx,yy-6,xx+5,yy);p.quadraticCurveTo(xx,yy+5,xx-5,yy)},c,.10*A,.55);}
  }else if(theme==='porcelain'){
   jadeDisk(ctx,w*(mobile?.46:.30)+px*10,h*.34+py*8,Math.min(w*.265,h*.29),c,.90*A,t);
   veil(ctx,w,h,h*.82,h*.048,c,.09*A,t,1);
   for(let i=0;i<5;i++)stroke(ctx,p=>{p.moveTo(w*.025,h*(.84+i*.014));p.bezierCurveTo(w*.16,h*(.79+i*.014),w*.47,h*(.91+i*.008),w*.67,h*(.81+i*.02));},c,.10*A/(1+i*.3),.65);
  }else if(theme==='orbit'){
   const cx=w*(mobile?.43:.345)+px*20,cy=h*.48+py*13,r=Math.min(w*.365,h*.40);
   ctx.save();ctx.translate(cx,cy);ctx.rotate(-.23+px*.03);ctx.scale(1,.83);
   for(let j=0;j<2;j++)for(let b=0;b<7;b++){const a0=b/7*TAU+.06;stroke(ctx,p=>p.arc(0,0,r+j*6,a0,a0+.49),c,(.27-j*.10)*A,.8-j*.3);}
   for(let b=0;b<12;b++){const a0=b/12*TAU;stroke(ctx,p=>{const rx=Math.cos(a0),ry=Math.sin(a0);p.moveTo(rx*(r-9),ry*(r-9));p.lineTo(rx*(r+10),ry*(r+10));p.lineTo(rx*(r+10)+Math.cos(a0+Math.PI/2)*5,ry*(r+10)+Math.sin(a0+Math.PI/2)*5);},c,.22*A,.65);}
   ctx.restore();veil(ctx,w,h,h*.84,h*.03,c,.06*A,t,.8);
  }else if(theme==='astral'){
   // Braided celestial river; sparse moving dust, no cursor tail.
   for(let i=0;i<3;i++){ctx.save();ctx.translate(w*.12,h*.74);ctx.rotate(-.80);veil(ctx,w*.91,h*.70,h*.04+i*h*.026,h*.026,c,(.12-i*.02)*A,t,i*.42);ctx.restore();}
   for(let i=0;i<22;i++){const u=(i/22+t*.010)%1,xx=w*(.02+u*.65)+px*9,yy=h*(.97-u*1.04)+h*.043*Math.sin(u*7+t*.13);point(ctx,xx,yy,c,Math.sin(u*Math.PI)*.28*A,i%5?1:2.3);}
  }else if(theme==='verdant'){
   for(let b=0;b<3;b++){const base=h*(.86+b*.032),off=px*(4+b*4)+Math.sin(t*.045+b)*6;ctx.save();ctx.translate(off,py*4);ctx.beginPath();mountainPath(ctx,w,h,base,b,Math.sin(t*.04)*9);ctx.lineTo(w*.72,h*.98);ctx.lineTo(-w*.1,h*.98);ctx.closePath();const g=ctx.createLinearGradient(0,base-h*.28,0,h*.97);g.addColorStop(0,rgba(c,(.07-b*.012)*A));g.addColorStop(.46,rgba(c,.025*A));g.addColorStop(1,rgba(c,0));ctx.fillStyle=g;ctx.fill();ctx.restore();}
   veil(ctx,w,h,h*.78,h*.035,c,.12*A,t,2.1);veil(ctx,w,h,h*.24,h*.04,c,.06*A,t,1);
  }else if(theme==='dawn'){
   // Translucent plume vanes. Warm-dusk silhouette, not a literal bird illustration.
   for(let b=0;b<6;b++){ctx.save();ctx.translate(w*.30+px*11,h*.45+py*6);ctx.rotate(-.73+b*.19+Math.sin(t*.06)*.012);const l=Math.min(w*.29,h*.37);ctx.beginPath();ctx.moveTo(0,l*.56);ctx.bezierCurveTo(-l*.25,l*.16,-l*.18,-l*.31,0,-l*.60);ctx.bezierCurveTo(l*.10,-l*.11,l*.22,l*.15,0,l*.56);const g=ctx.createLinearGradient(-l*.2,-l*.5,l*.2,l*.5);g.addColorStop(0,rgba(c,.08*A));g.addColorStop(.5,rgba(c,.022*A));g.addColorStop(1,rgba(c,0));ctx.fillStyle=g;ctx.fill();ctx.restore();}
   veil(ctx,w,h,h*.80,h*.05,c,.10*A,t,.5);
  }
 }
 function draw(ctx,q){
  const {w,h,theme}=q,p=profiles[theme]||profiles.atelier,t=q.staticMode?0:q.t;
  const x=q.scene?.x||0,y=q.scene?.y||0,n=q.darkness??0;
  const quiet=['action','review','unknown','failed'].includes(q.phase),amp=(q.motion==='light'?.65:1)*(quiet?.68:1)*(1-n*.12);
  const mobile=w<720,k=Math.min(w/1440,h/900)*(mobile?1.55:1),c=n>.5&&['porcelain','dawn'].includes(theme)?(theme==='dawn'?[199,174,169]:[170,192,188]):p.color;
  const breath=.95+Math.sin(t*.11)*.05;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.globalCompositeOperation='source-over';
  worlds(ctx,q,c,amp,t);
  // Side-weighted composition leaves the operation column intentionally quiet.
  if(theme==='atelier'){
   const drift=Math.sin(t*.06)*12;
   cloud(ctx,w*.21+x*17,h*.216+y*9,k*1.18,c,.28*amp*breath);
   terrace(ctx,w*.39+x*8,h*.196+y*4,k*.64,c,.18*amp);
   cloud(ctx,w*.29+x*25+drift,h*.813+y*12,k*1.68,c,.24*amp);
   cloud(ctx,w*.035+x*7,h*.59+y*6,k*.78,c,.15*amp);
   mist(ctx,w*.3+x*17,h*.79+y*9,w*.29,h*.07,c,.027*amp);
  }else if(theme==='silk'){
   for(let b=0;b<3;b++){
    const drift=Math.sin(t*.083+b*.65)*h*.024,base=h*(.22+b*.29);
    const ribbon=off=>p=>{p.moveTo(-w*.08,base+off+drift);p.bezierCurveTo(w*.17+x*24,base-h*.27+y*10,w*.24,base+h*.28+drift,w*.66,base+h*.1+off)};
    etched(ctx,ribbon(0),c,(.22-b*.022)*amp,.75);
    for(let j=1;j<=4;j++)stroke(ctx,ribbon(j*4*k),c,(.13-j*.017)*amp,.48);
    // Small cross-thread marks follow the cloud-ribbon, not a square UI grid.
    for(let i=1;i<10;i++){const u=i/10,px=w*(u*.62),py=base+Math.sin(u*5.8-1)*h*.06+drift;stroke(ctx,p=>{p.moveTo(px,py);p.quadraticCurveTo(px+4*k,py-4*k,px+8*k,py)},c,.07*amp,.45)}
   }
   cloud(ctx,w*.20+x*17,h*.805+y*10,k*1.37,c,.18*amp);
  }else if(theme==='porcelain'){
   lunar(ctx,w*(mobile?.35:.31)+x*13,h*.35+y*10,Math.min(w*.255,h*.28),c,amp,t);
   cloud(ctx,w*.245+x*15,h*.78+y*8,k*1.65,c,.21*amp);
   mist(ctx,w*.31+x*15,h*.26,w*.21,h*.22,c,.026*amp);
  }else if(theme==='orbit'){
   const cx=w*(mobile?.43:.345)+x*20,cy=h*.48+y*13,r=Math.min(w*.34,h*.38);
   ctx.save();ctx.translate(cx,cy);ctx.rotate(-.21+x*.036);ctx.scale(1,.83);
   for(let b=0;b<2;b++)etched(ctx,p=>p.arc(0,0,r+b*16,.11+b*.5,5.62-b*.12),c,(.20-b*.085)*amp,.64);
   for(let i=0;i<36;i++){const a=i/36*TAU+t*.007,len=i%9===0?13:i%3===0?7:3;stroke(ctx,p=>{p.moveTo(Math.cos(a)*(r+8),Math.sin(a)*(r+8));p.lineTo(Math.cos(a)*(r+8+len),Math.sin(a)*(r+8+len))},c,(i%9===0?.34:.13)*amp,.65)}
   const stars=[[-.8,-.52],[-.62,-.68],[-.39,-.67],[-.18,-.84],[.08,-.79],[.30,-.62],[.49,-.56]];
   etched(ctx,p=>stars.forEach(([xx,yy],i)=>i?p.lineTo(xx*r,yy*r):p.moveTo(xx*r,yy*r)),c,.19*amp,.6);
   stars.forEach(([xx,yy],i)=>point(ctx,xx*r,yy*r,c,.43*amp*(.86+.14*Math.sin(t*.4+i)),i%3?1.5:2.1));ctx.restore();
  }else if(theme==='astral'){
   for(let j=0;j<7;j++){
    const offset=(j-3)*5*k;
    const river=p=>{p.moveTo(-w*.08,h*.91+offset);p.bezierCurveTo(w*.14+x*12,h*.86+y*8,w*.35,h*.14+Math.sin(t*.071+j*.25)*14,w*.73,h*-.07+offset)};
    etched(ctx,river,c,(.20-Math.abs(j-3)*.028)*amp,j===3?.9:.45);
   }
   for(let i=0;i<18;i++){const u=(i/18+t*.005)%1,px=w*(.03+u*.64)+x*(8+i*.6),py=h*(.93-u*.95)+Math.sin(u*7.5+t*.10)*h*.025+y*10;point(ctx,px,py,c,Math.sin(u*Math.PI)*.40*amp,1+i%3*.2)}
   cloud(ctx,w*.29+x*18,h*.82+y*6,k*1.2,c,.11*amp);
  }else if(theme==='verdant'){
   for(let b=0;b<4;b++){
    const base=h*(.83+b*.027),shift=Math.sin(t*.064+b)*7;
    const outline=p=>mountainPath(p,w,h,base,b,shift);
    ctx.beginPath();outline(ctx);ctx.lineTo(w*.68,h*.92);ctx.lineTo(-w*.1,h*.92);ctx.closePath();const g=ctx.createLinearGradient(0,base-h*.33,0,h*.90);g.addColorStop(0,rgba(c,(.032-b*.005)*amp));g.addColorStop(1,rgba(c,0));ctx.fillStyle=g;ctx.fill();
    etched(ctx,outline,c,(.28-b*.048)*amp,.65);
   }
   cloud(ctx,w*.20+x*21,h*.28+y*8,k*1.32,c,.23*amp);
   stroke(ctx,p=>{p.moveTo(w*.32,h*.10);p.bezierCurveTo(w*.13+x*7,h*.34,w*.43,h*.36,w*.29,h*.65)},c,.09*amp,.6);
  }else if(theme==='dawn'){
   for(let b=0;b<3;b++)feather(ctx,w*(.18+b*.066)+x*(10+b*3),h*(.37+b*.045)+y*10,Math.min(w*.33,h*.43),-.42+b*.29+Math.sin(t*.07+b)*.028,c,(.245-b*.04)*amp);
   cloud(ctx,w*.29+x*15,h*.81+y*9,k*1.6,c,.19*amp);
   mist(ctx,w*.22+x*10,h*.25,w*.27,h*.13,c,.024*amp);
  }
  ctx.restore();return p.name;
 }
export const mythicArt={draw,profiles};
