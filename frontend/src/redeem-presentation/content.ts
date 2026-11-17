// 展示内容：原项目从 GET /api/v1/recharge/appearance 读；本站不加后端端点，直接用随包的
// data/default-content.json（原项目后端的默认内容），再按本站情况覆盖少量字段：
//  - 品牌字样 RedeemAI → 本站品牌（siteBrand），避免在本站页面上出现别家品牌；
//  - 导航改成本站路由（/recharge /batch /history /billing），并放一条禁用的 /help，
//    阻止原导航逻辑自动补「教程中心」（本站没有 /help 页）；
//  - 图文教程改写成本站兑换流程（原文讲的是原项目的界面）；
//  - 英文界面下把标题、说明、按钮文案换成英文（原项目的内容只有中文）。
import raw from './presets/default-content.json'
import type { RedeemContent, ContentLink } from './utils/redeemPresentation'

type GuideStep = { id: string; title: string; body: string; note?: string }

const baseContent = raw as unknown as RedeemContent

function navigation(locale: 'zh' | 'en'): ContentLink[] {
  const zh = locale === 'zh'
  return [
    { id: 'redeem', label: zh ? '卡密兑换' : 'Redeem', description: zh ? '回到当前兑换步骤，不清空输入' : 'Back to the current step; nothing is cleared', url: '/recharge', target: '_self', enabled: true },
    { id: 'batch', label: zh ? '批量兑换' : 'Batch', description: zh ? '多张卡密逐张配对账号后提交' : 'Pair several codes with accounts and submit', url: '/batch', target: '_self', enabled: true },
    { id: 'status', label: zh ? '售后查询' : 'Status', description: zh ? '用卡密查询兑换进度与处理结果' : 'Look up a redemption by its code', url: '/history', target: '_self', enabled: true },
    { id: 'subscription', label: zh ? '订阅账单' : 'Billing', description: zh ? '查询账号订阅状态与账单链接' : 'Check subscription status and invoice links', url: '/billing', target: '_self', enabled: true },
    // 禁用的 /help：只为让 publicNavigationLinks 认为已配置教程入口，不再自动追加。
    { id: 'tutorial', label: '使用教程', description: '', url: '/help', target: '_self', enabled: false },
  ]
}

const guideZh: { title: string; intro: string; steps: GuideStep[]; faq: RedeemContent['guide']['faq'] } = {
  title: '跟着走一遍，就会了',
  intro: '先验证卡密，再填写要开通的账号并预检，核对无误后确认兑换。需要人机验证时，页面会给出入口。',
  steps: [
    { id: 'code', title: '先验证卡密', body: '在“CDK / 兑换码”里粘贴整段卡密，点“验证”。识别成功后，左侧卡片会显示对应套餐，并自动进入下一步。', note: '提示已兑换？页面会尝试恢复这张卡的原进度；也可以在顶部“售后查询”里查。不要反复提交。' },
    { id: 'account', title: '填对账号', body: '登录要开通的 ChatGPT 账号，打开 Session 页面，复制完整 JSON（必须含 sessionToken）粘贴进来，再点“预检账号并继续”。Grok、X 卡密按页面提示填对应凭据。', note: '凭据只用于本次兑换，不要发到聊天里，也不要放进公开截图。' },
    { id: 'review', title: '看一眼再确认', body: '核对账号邮箱、目标套餐和当前套餐。账号已满足该套餐时按钮会置灰，避免重复购买。确认无误后点一次“确认本次兑换”。', note: '原订阅处于宽限期或欠费时，先按页面提示处理，再重新检测账号。' },
    { id: 'wait', title: '留在这一页', body: '提交后页面每 3 秒左右刷新一次进度，处理明细会逐条出现。结果未出来前不要重复提交。', note: '关掉页面也不会丢单：回到本页或用“售后查询”输入原卡密即可继续查看。' },
    { id: 'challenge', title: '需要验证时，点这里', body: '出现“点此完成人机验证”时，点击按钮，在 180 秒内于当前浏览器完成验证，完成后会自动继续。', note: '超时或两次都未通过时本单失效且不扣款，可重新兑换。' },
    { id: 'result', title: '完成后，去账号里确认', body: '显示完成后，到 ChatGPT（或对应平台）账号里确认套餐。要查订阅到期与账单，用顶部“订阅账单”。', note: '官网仍显示免费时，退出后重新登录该账号再看。' },
  ],
  faq: [
    { id: 'f1', question: '我只是想查结果，要重新兑换吗？', answer: '不用。顶部“售后查询”用原卡密即可查到原记录。' },
    { id: 'f2', question: '验证完成后，为什么还在等？', answer: '人机验证和订单完成是两件事。留在本页，等订单返回明确结果。' },
    { id: 'f3', question: '为什么兑换按钮是灰的？', answer: '预检发现账号当前套餐已满足所购档位，或预检已失效。返回上一步重新预检即可。' },
  ],
}

const guideEn: typeof guideZh = {
  title: 'Walk through it once',
  intro: 'Verify the code, enter the account to activate and run the check, then confirm. If human verification is needed, the page shows the entry.',
  steps: [
    { id: 'code', title: 'Verify the code', body: 'Paste the whole code into “CDK / redemption code” and select Verify. Once recognized, the card on the left shows the plan and the page moves to the next step.', note: 'Already redeemed? The page tries to restore that code’s progress; you can also use Status at the top. Do not submit repeatedly.' },
    { id: 'account', title: 'Enter the right account', body: 'Sign in to the ChatGPT account to activate, open the Session page, copy the full JSON (it must include sessionToken), paste it here and select Check account and continue. For Grok or X codes, follow the prompt for that credential.', note: 'Credentials are used only for this redemption. Do not share them in chats or public screenshots.' },
    { id: 'review', title: 'Review, then confirm', body: 'Check the account email, the target plan and the current plan. If the account already has the plan, the button is disabled to prevent a duplicate purchase. Then select Confirm this redemption once.', note: 'If the original subscription is in a grace period or past due, follow the prompt first and check the account again.' },
    { id: 'wait', title: 'Stay on this page', body: 'After submitting, progress refreshes about every 3 seconds and processing details appear one by one. Do not submit again before a result arrives.', note: 'Closing the page does not lose the order: come back here or use Status with the original code.' },
    { id: 'challenge', title: 'When verification is needed', body: 'When “Complete human verification” appears, select it and finish within 180 seconds in this browser. Processing continues automatically.', note: 'If it times out or fails twice, the order is void and nothing is charged. You can redeem again.' },
    { id: 'result', title: 'Confirm on your account', body: 'When it shows completed, check the plan on your ChatGPT (or other platform) account. For expiry and invoices, use Billing at the top.', note: 'If the site still shows Free, sign out and sign in to that account again.' },
  ],
  faq: [
    { id: 'f1', question: 'I only want the result. Do I redeem again?', answer: 'No. Use Status at the top with the original code to find the original record.' },
    { id: 'f2', question: 'Verification is done. Why is it still waiting?', answer: 'Human verification and order completion are separate. Stay on this page until the order returns a clear result.' },
    { id: 'f3', question: 'Why is the redeem button disabled?', answer: 'The check found the account already covers this plan, or the check has expired. Go back and check the account again.' },
  ],
}

// 英文界面：标题与说明。eyebrow / caption 原本就是英文，保留原文。
const templatesEn: Record<string, { titleFirst: string; titleSecond: string; description: string }> = {
  atelier: { titleFirst: 'One card,', titleSecond: 'the next journey.', description: 'Paste the code. Recognition, review and receipt all stay around this card.' },
  silk: { titleFirst: 'From a single code', titleSecond: 'to what comes next.', description: 'Light moves across the card. Every step stays clear.' },
  porcelain: { titleFirst: 'Activation,', titleSecond: 'made lighter.', description: 'Start with the input. The system takes the complexity; the card keeps it clear.' },
  orbit: { titleFirst: 'The next journey', titleSecond: 'starts here.', description: 'Recognize your card and connect to the next possibility.' },
  astral: { titleFirst: 'One card,', titleSecond: 'to the stars.', description: 'Enter the code. Every step gets a clear answer.' },
  verdant: { titleFirst: 'Leave the hassle to us,', titleSecond: 'keep the time for you.', description: 'Paste the code and continue from here.' },
  dawn: { titleFirst: 'A new day,', titleSecond: 'an easy start.', description: 'One card, carrying on with your every day.' },
}

function rebrand<T>(value: T, brand: string): T {
  const upper = brand.toUpperCase()
  return JSON.parse(JSON.stringify(value).replace(/REDEEMAI/g, upper).replace(/RedeemAI/g, brand)) as T
}

export function buildPresentationContent(brandName: string, locale: string): RedeemContent {
  const brand = (brandName || '').trim() || 'CDK Portal'
  const en = !String(locale || '').startsWith('zh')
  const content: RedeemContent = JSON.parse(JSON.stringify(baseContent))
  content.navigation = navigation(en ? 'en' : 'zh')
  content.footerLinks = []
  content.guide = (en ? guideEn : guideZh) as RedeemContent['guide']
  // 本站不带背景音乐（未随包分发音频文件），关闭自动播放。
  content.visitorDefaults = { ...content.visitorDefaults, musicAutoplay: false }
  // 本站不做按周轮换：主题由用户在本站皮肤里选。
  content.themeRotation = { ...content.themeRotation, enabled: false }
  if (en) {
    content.footerText = '© RedeemAI · Every step accounted for.'
    content.copy = { ...content.copy, inputLabel: 'CDK / redemption code', placeholder: 'Enter your CDK / redemption code', verifyLabel: 'Verify', confirmLabel: 'Confirm this redemption', guideLabel: 'Guide', appearanceLabel: 'Today’s theme', reviewIntro: 'Check the account and plan. Nothing is submitted until you confirm.' }
    for (const [key, copy] of Object.entries(templatesEn)) {
      const template = (content.templates as Record<string, any>)[key]
      if (template) Object.assign(template, copy)
    }
  }
  return rebrand(content, brand)
}
