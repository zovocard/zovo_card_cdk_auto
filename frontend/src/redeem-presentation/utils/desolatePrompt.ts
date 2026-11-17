import { nextTick, ref } from 'vue'

// 多行共用一个当前提醒，队列仅保存组件标识，不持久化订单或访问票据。
export const desolatePromptOwner = ref<symbol | null>(null)
export const desolatePromptPending = ref(false)
const waiting: symbol[] = []
let scheduled = false
function advance() {
  if (scheduled || desolatePromptOwner.value || !waiting.length) return
  scheduled = true
  // 等原 Modal 完成关闭和焦点归还后，再打开下一项。
  void nextTick(() => {
    scheduled = false
    if (!desolatePromptOwner.value) desolatePromptOwner.value = waiting.shift() || null
    desolatePromptPending.value = !!desolatePromptOwner.value || waiting.length > 0
  })
}
export function requestDesolatePrompt(owner: symbol) {
  if (desolatePromptOwner.value === owner || waiting.includes(owner)) return
  waiting.push(owner)
  // 让非业务弹窗先关闭；advance 的 nextTick 再交给验证弹窗。
  desolatePromptPending.value = true
  advance()
}
export function releaseDesolatePrompt(owner: symbol) {
  const index = waiting.indexOf(owner)
  if (index >= 0) waiting.splice(index, 1)
  if (desolatePromptOwner.value === owner) desolatePromptOwner.value = null
  desolatePromptPending.value = !!desolatePromptOwner.value || waiting.length > 0
  advance()
}
