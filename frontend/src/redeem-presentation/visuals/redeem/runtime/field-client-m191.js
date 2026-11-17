/* 仅传递装饰参数；一个在途请求与一个最新候选。故障后由调用方使用同核同步绘制。 */
const FRAME_TIMEOUT_MS = 3000;

export function create(onFrame) {
 let worker = null, dead = false, flight = null, pending = null, recycle = null, timer = null, seq = 0, generation = 0;
 const stats = {mode:'main-thread', submitted:0, completed:0, failed:0, computeMs:0, inFlight:0, maxInFlight:0};
 function clearTimer() { if (timer !== null) clearTimeout(timer); timer = null; }
 function stop() {
  clearTimer();
  const old = worker; worker = null;
  if (old) { old.onmessage = old.onerror = old.onmessageerror = null; old.terminate(); }
  flight = pending = recycle = null; stats.inFlight = 0;
 }
 function fail() { if (dead) return; stats.failed++; stop(); stats.mode = 'main-thread'; }
 function send(item) {
  if (!worker || dead) return false;
  const buffer = recycle; recycle = null;
  flight = {...item, id:++seq, generation};
  stats.inFlight = 1; stats.maxInFlight = Math.max(stats.maxInFlight, 1); stats.submitted++;
  timer = setTimeout(fail, FRAME_TIMEOUT_MS);
  try { worker.postMessage({type:'frame', id:flight.id, key:item.key, job:item.job, buffer}, buffer ? [buffer] : []); return true; }
  catch { fail(); return false; }
 }
 if (typeof Worker === 'function') try {
  const current = new Worker(new URL('./field-worker-m191.js', import.meta.url), {type:'module', name:'RedeemAI-material-field'});
  worker = current; stats.mode = 'worker';
  current.onerror = event => { event.preventDefault?.(); if (worker === current) fail(); };
  current.onmessageerror = () => { if (worker === current) fail(); };
  current.onmessage = ({data}) => {
   if (dead || worker !== current) return;
   const sent = flight;
   if (!sent || !data || data.type !== 'frame' || data.id !== sent.id || data.key !== sent.key ||
       data.width !== sent.job.width || data.height !== sent.job.height ||
       !(data.buffer instanceof ArrayBuffer) || data.buffer.byteLength !== sent.job.width * sent.job.height * 4) { fail(); return; }
   clearTimer(); flight = null; stats.inFlight = 0; stats.completed++;
   stats.computeMs = Number.isFinite(data.computeMs) ? data.computeMs : 0;
   try { if (sent.generation === generation) onFrame(data); }
   catch { fail(); return; }
   if (dead || worker !== current) return;
   recycle = data.buffer;
   if (pending) { const next = pending; pending = null; send(next); }
  };
 } catch { fail(); }
 return {
  request(job, key) {
   if (!worker || dead) return false;
   // 白名单投影，不能把调用方对象中的卡密、任务或账号字段送入装饰线程。
   const {width, height, viewWidth, viewHeight, time, theme, night, motion, scene} = job;
   const item = {key, job:{width, height, viewWidth, viewHeight, time, theme, night, motion,
    scene:scene ? {x:scene.x, y:scene.y, depth:scene.depth} : null}};
   if (flight) { pending = item; return true; }
   return send(item);
  },
  clear() { generation++; pending = null; },
  info: () => ({...stats}),
  destroy() { if (dead) return; dead = true; generation++; stop(); },
 };
}
