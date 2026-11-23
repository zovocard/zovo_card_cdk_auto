// 强制关闭 Stripe.js handleNextAction 弹出的验证码浮窗。
//
// 客户自过的图片验证码只给 180 秒，但 clientSecret 在 Stripe 那边不会随之失效：到点后若浮窗还开着，
// 客户继续点完 Stripe 照样扣款，而订单已按「未扣款」判失败。Stripe.js 不提供取消 handleNextAction 的接口，
// 只能把它插进页面的 iframe 直接移除。
//
// Stripe.js 把挑战浮窗与控制 iframe 作为 <body> 的直接子容器插入（iframe name 以 __privateStripe 开头，
// src 在 *.stripe.com / *.stripe.network）。只摘这些容器；万一 iframe 落在应用根节点里，只摘 iframe 本身，绝不动页面。
// 摘除后本页的 Stripe 实例已不可用：同时卸掉 Stripe.js，调用方下次需要时重新加载。
const STRIPE_FRAME_SRC = /^https:\/\/[a-z0-9.-]*\.stripe\.(com|network)\//i

export function forceCloseStripeChallenge(): number {
  if (typeof document === 'undefined') return 0
  const appRoot = document.getElementById('app')
  let removed = 0
  document.querySelectorAll('iframe').forEach((frame) => {
    const name = frame.getAttribute('name') || ''
    const src = frame.getAttribute('src') || ''
    if (!name.startsWith('__privateStripe') && !STRIPE_FRAME_SRC.test(src)) return
    let top: Element = frame
    while (top.parentElement && top.parentElement !== document.body) top = top.parentElement
    const insideApp = !!appRoot && (top === appRoot || top.contains(appRoot) || appRoot.contains(frame))
    const target = insideApp || top.parentElement !== document.body ? frame : top
    if (target.isConnected) {
      target.remove()
      removed++
    }
  })
  document.querySelectorAll('script[src^="https://js.stripe.com/"]').forEach((s) => s.remove())
  try {
    delete (window as any).Stripe
  } catch {
    ;(window as any).Stripe = undefined
  }
  return removed
}
