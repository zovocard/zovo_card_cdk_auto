import { ref, readonly } from 'vue'
import type { RedeemContent } from './redeemPresentation'
const volumePreference = ref(.2)
const playing = ref(false), pendingPlay = ref(false), notice = ref<'blocked'|'error'|''>('')
let lastVolume = .2
let audio: HTMLAudioElement | undefined, attempted = false, generation = 0, stopped = false
let channel: BroadcastChannel | undefined
const blockers = new Set<string>()
const stoppedKey = 'redeemai.music.stopped'
function sessionStopped() { try { return sessionStorage.getItem(stoppedKey) === '1' } catch { return false } }
const onVisibility=()=>{if(document.hidden)pauseRedeemMusic()}
export function destroyRedeemMusic(){pauseRedeemMusic();document.removeEventListener('visibilitychange',onVisibility);channel?.close();channel=undefined;if(audio){audio.removeAttribute('src');audio.load();audio=undefined}blockers.clear()}
export function initializeRedeemMusic() {
  if (audio) return
  stopped = sessionStopped()
  audio = new Audio('/media/redeem/m19/Soft_Current_Loop.mp3')
  audio.preload = 'none'; audio.loop = true; audio.volume = lastVolume
  audio.addEventListener('playing', () => {
    if (stopped || blockers.size || document.hidden) { audio?.pause(); return }
    playing.value = true; notice.value = ''; channel?.postMessage({type:'playing'})
  })
  audio.addEventListener('pause', () => { playing.value = false })
  audio.addEventListener('ended', () => { playing.value = false })
  audio.addEventListener('error', () => { playing.value = false; notice.value = 'error' })
  document.addEventListener('visibilitychange',onVisibility)
  try { channel = new BroadcastChannel('redeemai-music'); channel.onmessage = event => { if (event.data?.type === 'playing') pauseRedeemMusic() } } catch {}
}
export function configureRedeemMusic(defaults: RedeemContent['visitorDefaults']) {
  initializeRedeemMusic()
  let volume = defaults.musicVolume
  try { const raw = localStorage.getItem('redeemai.music.volume'); if (raw !== null && Number.isFinite(Number(raw))) volume = Math.min(.5, Math.max(0, Number(raw))) } catch {}
  lastVolume = volume
  volumePreference.value = volume
  if (audio) audio.volume = volume
  if (attempted) return
  attempted = true
  if (defaults.musicAutoplay && !stopped && !blockers.size && !document.hidden) void playRedeemMusic(false)
}
export async function playRedeemMusic(user = true) {
  initializeRedeemMusic()
  if (blockers.size || document.hidden || !user && stopped) return
  if (user) { stopped = false; try { sessionStorage.removeItem(stoppedKey) } catch {} }
  const request = ++generation
  pendingPlay.value = true
  try {
    await audio!.play()
    if (request !== generation) return
    if (stopped || blockers.size || document.hidden) { audio!.pause(); return }
    playing.value = true; notice.value = ''; channel?.postMessage({type:'playing'})
  } catch (error) {
    if (request !== generation) return
    playing.value = false; notice.value = error instanceof DOMException && error.name === 'NotAllowedError' ? 'blocked' : 'error'
  } finally { if(request===generation)pendingPlay.value=false }
}
export function pauseRedeemMusic(user = false) {
  generation++; pendingPlay.value=false; audio?.pause(); playing.value = false
  if (user) { stopped = true; notice.value = ''; try { sessionStorage.setItem(stoppedKey,'1') } catch {} }
}
export function blockRedeemMusic(reason: string, blocked: boolean) {
  if (blocked) { blockers.add(reason); pauseRedeemMusic() } else blockers.delete(reason)
}
export function setRedeemMusicVolume(value: number) {
  if (!Number.isFinite(value)) return
  lastVolume = Math.min(.5, Math.max(0, value))
  volumePreference.value = lastVolume
  if (audio) audio.volume = lastVolume
  try { localStorage.setItem('redeemai.music.volume', String(lastVolume)) } catch {}
}
export function toggleRedeemMusic() { if (playing.value || pendingPlay.value) pauseRedeemMusic(true); else void playRedeemMusic(true) }
export const redeemMusic = { playing:readonly(playing), pending:readonly(pendingPlay), notice:readonly(notice), volume:readonly(volumePreference) }
