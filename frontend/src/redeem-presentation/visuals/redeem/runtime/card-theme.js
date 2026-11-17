/* 卡面主题层：同一张卡在不同主题下带该主题的印记与刻线景，不改变卡片业务 DOM。
 * 图形只来自包内主题 SVG（identity/scenes、identity/seals），平台徽记仍由 card-platform 负责。 */
import { artwork } from '../identity/artwork';
import names from '../theme-names.json';
'use strict';
const THEMES=new Set(Object.keys(names));
const SUBTITLE={atelier:'重阙 · 云阶',silk:'绫带 · 云锦',porcelain:'玉璧 · 月弧',orbit:'星群 · 衡仪',astral:'星河 · 潮汐',verdant:'玉峰 · 山岚',dawn:'凤翎 · 曦轮'};
function mount(host){
 for(const face of host.querySelectorAll('.face')){
  const scene=document.createElement('div');scene.className='card-theme-scene';scene.setAttribute('aria-hidden','true');
  const craft=face.querySelector('.couture-craft');craft?craft.after(scene):face.prepend(scene);
  const footer=face.querySelector('.card-footer');if(!footer)continue;
  const mark=document.createElement('div');mark.className='card-theme-hallmark';mark.setAttribute('aria-hidden','true');
  mark.innerHTML='<span class="hallmark-seal"></span><span class="hallmark-text"><b></b><small></small></span>';
  footer.firstElementChild?.after(mark);
 }
}
function apply(host,stage){
 const theme=THEMES.has(stage)?stage:'atelier';
 if(host.dataset.themeMark===theme)return;
 host.dataset.themeMark=theme;
 host.querySelectorAll('.card-theme-scene').forEach(el=>{el.innerHTML=artwork(theme,'scene');});
 host.querySelectorAll('.card-theme-hallmark').forEach(el=>{
  el.querySelector('.hallmark-seal').innerHTML=artwork(theme,'seal');
  el.querySelector('b').textContent=names[theme];
  el.querySelector('small').textContent=SUBTITLE[theme];
 });
}
export default { mount, apply };
