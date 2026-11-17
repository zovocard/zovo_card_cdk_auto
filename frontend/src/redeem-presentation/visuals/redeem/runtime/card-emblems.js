/* V4.5 — original vector hallmarks. No numerals, letters, logos or font assets.
 * Decorative identifiers only; neither plan eligibility nor status is encoded here.
 * One renderer is used by the live card, picker, atlas and Vue runtime.
 */
'use strict';
 let serial=0;
 const P=(d,c='')=>`<path class="${c}" d="${d}"/>`;
 const rotate=(n,path,offset=0)=>Array.from({length:n},(_,i)=>`<g transform="rotate(${offset+i*360/n})">${path}</g>`).join('');
 const definitions={
  neutral:{name:'Unmarked',family:'neutral',body:P('M-58 12C-19 -26 19 -26 58 12M-38 24C-12 0 12 0 38 24','open-line'),detail:''},
  horizon:{name:'Horizon',family:'openai',body:P('M-75 21C-55 -18 -25 -40 9 -47C-11 -26 -20 -10 -23 6C-42 5 -59 10 -75 21Z')+P('M-15 48C13 16 39 5 75 7C56 24 30 44 -15 48Z')+P('M23 -29L41 -10L23 9L5 -10Z'),detail:P('M-65 17C-45 -5 -26 -20 -6 -28M-4 40C22 20 44 13 65 12','hairline')},
  lustre:{name:'Lustre',family:'openai',body:rotate(4,P('M0 -78C25 -61 42 -35 40 -9C29 -7 19 -1 14 9C-4 -14 -12 -49 0 -78Z')),detail:rotate(4,P('M0 -64C11 -48 21 -33 25 -19','hairline'))+P('M0 -10L10 0L0 10L-10 0Z','centre')},
  aperture:{name:'Aperture',family:'openai',body:rotate(3,P('M0 -82L67 -43L52 20L27 -4L32 -31L0 -48Z'))+rotate(3,P('M0 -82L0 -48L-32 -31L-52 -7L-67 -43Z','low-facet')),detail:rotate(3,P('M0 -73L57 -40L46 3M0 -56L-53 -32','hairline'))+P('M0 -17L15 -8V9L0 18L-15 9V-8Z','centre')},
  signet:{name:'Signet',family:'openai',body:rotate(8,P('M0 -94L19 -46L0 -22L-19 -46Z'))+rotate(8,P('M0 -94V-22L-19 -46Z','low-facet')),detail:rotate(8,P('M0 -81V-31M0 -31L14 -47','hairline'))+P('M0 -25L18 -18L25 0L18 18L0 25L-18 18L-25 0L-18 -18Z','centre')},
  reserve:{name:'Prism',family:'openai',body:P('M0 -94L49 -53L78 0L49 53L0 94L-49 53L-78 0L-49 -53Z')+P('M0 -94L0 -24L-30 -39L-49 -53Z M78 0L24 0L39 30L49 53Z M0 94V24L30 39L49 53Z M-78 0H-24L-39 -30L-49 -53Z','low-facet'),detail:P('M0 -94L0 -24L49 -53L24 0L78 0M0 94V24L-49 53L-24 0H-78M-49 -53L0 -24L24 0L49 53L0 24L-24 0Z M0 -24V24M-24 0H24','hairline')+P('M0 -74L37 -43L58 0L37 43L0 74L-37 43L-58 0L-37 -43Z','open-line')},
  folio:{name:'Folio',family:'claude',body:rotate(5,P('M0 -71C28 -47 32 -19 9 6C-8 -11 -17 -37 0 -71Z')),detail:rotate(5,P('M0 -57C6 -34 7 -19 4 -8','hairline'))},
  rosette:{name:'Rosette',family:'claude',body:rotate(7,P('M0 -79C26 -66 38 -28 11 3C-10 -12 -16 -47 0 -79Z')),detail:rotate(7,P('M0 -66C11 -43 13 -25 7 -10','hairline'))+rotate(7,P('M0 -31Q17 -17 3 0Q-8 -14 0 -31Z','centre'),25.7)},
  nocturne:{name:'Nocturne',family:'claude',body:rotate(9,P('M0 -85C23 -71 35 -34 11 0C-9 -18 -16 -55 0 -85Z'))+rotate(9,P('M0 -49Q16 -29 3 -2Q-13 -22 0 -49Z','low-facet'),20),detail:rotate(9,P('M0 -72Q13 -45 8 -24','hairline'))+P('M0 -16Q20 -16 16 0Q16 20 0 16Q-20 16 -16 0Q-16 -20 0 -16Z','centre')},
  meridian:{name:'Meridian',family:'x',body:P('M-64 -30C-30 -64 30 -64 64 -30C30 -46 -30 -46 -64 -30Z')+P('M-64 30C-30 64 30 64 64 30C30 46 -30 46 -64 30Z')+P('M-30 -64C-64 -30 -64 30 -30 64C-46 30 -46 -30 -30 -64Z','low-facet')+P('M30 -64C64 -30 64 30 30 64C46 30 46 -30 30 -64Z','low-facet')+'<circle cx="0" cy="0" r="7" class="node"/>',detail:rotate(4,P('M0 -84V-94','open-line')+'<circle cx="0" cy="-98" r="2.8" class="node"/>')},
  eclipse:{name:'Eclipse',family:'grok',body:P('M0 -74A74 74 0 1 1 -0.1 -74ZM0 -54A54 54 0 1 0 0.1 -54Z')+P('M-92 70L66 -88L80 -74L-78 84Z'),detail:P('M0 -40A40 40 0 1 1 -0.1 -40Z','hairline')+P('M-57 42L44 -59','open-line')+'<circle cx="0" cy="0" r="6" class="node"/>'},
  circuit:{name:'Circuit',family:'codex',body:P('M-35 -53H35L53 -35V35L35 53H-35L-53 35V-35Z')+P('M-28 -35H28L35 -28V28L28 35H-28L-35 28V-28Z','low-facet'),detail:rotate(4,P('M-24 -53V-66L-35 -77M0 -53V-83M24 -53V-66L35 -77','open-line')+'<circle cx="0" cy="-84" r="3" class="node"/><circle cx="-36" cy="-78" r="2.7" class="node"/>')+['-11 -11','11 -11','-11 11','11 11'].map(s=>{const[x,y]=s.split(' ');return `<rect x="${+x-5}" y="${+y-5}" width="10" height="10" rx="2" class="node"/>`;}).join('')}
 };
 function field(motif){
  const line=d=>P(d);
  if(motif==='prism')return line('M0 -111L111 0L0 111L-111 0Z');
  if(motif==='engine')return rotate(12,line('M0 -103V-109'));
  if(motif==='circuit')return rotate(4,line('M-43 -96H-76V-64'));
  if(motif==='horizon')return line('M-68 67Q0 110 68 67M-63 75Q0 112 63 75');
  if(motif==='pearl')return line('M-87 -34A94 94 0 0 1 70 -62M87 34A94 94 0 0 1 -70 62');
  if(motif==='rosette')return rotate(4,line('M-27 -104Q0 -116 27 -104'));
  if(motif==='bloom')return rotate(9,'<circle cx="0" cy="-103" r="1.5"/>');
  if(motif==='petal')return rotate(7,line('M-6 -95Q0 -103 6 -95'));
  if(motif==='sun')return rotate(10,line('M0 -87V-94'));
  return '';
 }
 function engraving(name,level){
  const tier=Number.isInteger(level)?Math.max(0,Math.min(5,level)):{neutral:0,horizon:1,lustre:2,aperture:3,signet:4,reserve:5,folio:1,rosette:2,nocturne:4,circuit:3,meridian:3,eclipse:2}[name]||0;
  if(!tier)return '';
  const count=[0,12,24,36,48,64][tier],parts=[];
  for(let i=0;i<count;i++){
   const a=i/count*Math.PI*2,major=i%Math.max(3,Math.round(count/8))===0;
   // Open quadrants leave negative space; not a clock face or a dial with numerals.
   if(!major&&Math.abs(Math.cos(a))>.96)continue;
   const r=109,len=major?5.3:tier<3?2:2.8;
   parts.push(P(`M${(Math.cos(a)*r).toFixed(2)} ${(Math.sin(a)*r).toFixed(2)}L${(Math.cos(a)*(r+len)).toFixed(2)} ${(Math.sin(a)*(r+len)).toFixed(2)}`,major?'major':'minor'));
  }
  let guilloche='';
  if(tier>=3){
   for(let band=0;band<(tier>=4?3:1);band++){
    let d='';const teeth=tier===5?32:tier===4?24:18;
    for(let i=0;i<=240;i++){const a=i/240*Math.PI*2,r=100.4+band*1.8+Math.sin(a*teeth+band*.8)*1.25;d+=(i?'L':'M')+(Math.cos(a)*r).toFixed(2)+' '+(Math.sin(a)*r).toFixed(2);}
    guilloche+=P(d,'turning');
   }
  }
  return `<g class="engraving17" data-engraving-level="${tier}"><g class="engraving17-turns">${guilloche}</g><g class="engraving17-scale">${parts.join('')}</g></g>`;
 }
 function render(name='neutral',motif='',level){
  const d=definitions[name]||definitions.neutral,id='r45-hallmark-'+(++serial);
  // Variable fallbacks also support the existing mini-card color contract.
  return `<svg class="couture-crest emblem45" data-emblem="${name}" data-pattern-detail="${String(motif).replace(/[^a-z-]/g,'')}" viewBox="-120 -120 240 240" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0%" y1="0%" x2="94%" y2="100%"><stop offset="0" stop-color="var(--emblem-shadow,#333e48)"/><stop offset=".27" stop-color="var(--emblem-metal,currentColor)"/><stop offset=".44" stop-color="var(--emblem-highlight,#f5eee0)"/><stop offset=".52" stop-color="var(--emblem-metal,currentColor)"/><stop offset=".76" stop-color="var(--emblem-shadow,#333e48)"/><stop offset="1" stop-color="var(--emblem-metal,currentColor)"/></linearGradient></defs><g class="emblem45-field">${field(motif)}</g>${engraving(name,level)}<g class="emblem17-recess" aria-hidden="true">${d.body}</g><g class="emblem45-relief" aria-hidden="true">${d.body}</g><g class="emblem45-body" fill="url(#${id})">${d.body}</g><g class="emblem17-lip" aria-hidden="true">${d.body}</g><g class="emblem45-detail">${d.detail}</g>${name==='neutral'?'':`<g class="emblem45-register"><path d="M-103 -19V-30M103 19V30M-19 103H-30M19 -103H30"/></g>`}</svg>`;
 }
export default {render,definitions};
