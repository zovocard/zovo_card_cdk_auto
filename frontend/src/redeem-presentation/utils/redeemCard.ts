import visualProducts from '../visuals/redeem/products.json'
import proSeries from '../presets/products/pro-series.json'
import grokSeries from '../presets/products/grok-series.json'
import xSeries from '../presets/products/x-series.json'
import { PRO_DISPLAY_NAMES } from '../lib/plans'
import type { ProductView, CardView } from '../visuals/redeem/contracts'
import type { RedeemPhase } from './redeemPresentation'
const ids: Record<string,string> = {go:'go',plus:'plus',pro5x:'pro-standard',pro20x:'pro-more',pro50x:'pro-500',claude_pro:'claude-pro',claude_max5x:'claude-5x',claude_max20x:'claude-20x'}
export const redeemProducts = (visualProducts as ProductView[]).map(product => {
 const pro = proSeries.find(plan => ids[plan.plan_type] === product.id)
 if (!pro) return product
 const name = pro.plan_display_name
 return {...product,displayLabel:name,officialLabel:name,cardCaption:name,description:name,cardUsageMultiplier:Number.parseFloat(pro.display_multiplier),overview:pro.overview}
})
const neutral:ProductView = {id:'unidentified',family:'redeemai',displayLabel:'等待识别',officialLabel:'REDEMPTION KEY',kind:'unknown',rank:'—',edition:'DIGITAL REDEMPTION',pattern:'contour',palette:{base:'#29333f',deep:'#0d1520',ink:'#eae8e1',muted:'#a6b0bd',edge:'#c5d9ec'}}
// Grok 与 X 没有卡面色板时会落回“等待识别”的中性卡；按档位给出由浅入深的金属色阶（仅显示，不表示权益）。
const platformFaces: Record<string, Pick<ProductView,'rank'|'pattern'|'edition'|'palette'>> = {
 grok_xai_plus:{rank:'I',pattern:'mist',edition:'GRAPHITE / EVENT HORIZON',palette:{base:'#353b45',deep:'#13161c',ink:'#eef2f8',muted:'#b3bcc9',edge:'#d4dff0'}},
 grok_xai_premium:{rank:'II',pattern:'contour',edition:'INDIGO / EVENT HORIZON',palette:{base:'#2c2e44',deep:'#0e0f1d',ink:'#efecff',muted:'#bab5da',edge:'#cbc2ff'}},
 grok_xai_super:{rank:'III',pattern:'facets',edition:'CYAN / ACCRETION',palette:{base:'#1d3036',deep:'#071417',ink:'#e2f8f9',muted:'#a2c6c9',edge:'#94e6ea'}},
 grok_xai_ultra:{rank:'IV',pattern:'prism',edition:'GOLD / SINGULARITY',palette:{base:'#2e2818',deep:'#0f0c05',ink:'#f8e9c4',muted:'#cdbd92',edge:'#f2d17e'}},
 x_basic:{rank:'I',pattern:'mist',edition:'SLATE / MERIDIAN',palette:{base:'#30333a',deep:'#101114',ink:'#eef0f2',muted:'#adb2b9',edge:'#d9dee4'}},
 x_premium:{rank:'II',pattern:'contour',edition:'COBALT / MERIDIAN',palette:{base:'#232835',deep:'#07090e',ink:'#e9edf6',muted:'#a8afc4',edge:'#b9c8ff'}},
 x_premium_plus:{rank:'III',pattern:'prism',edition:'ONYX / MERIDIAN',palette:{base:'#1d1c1a',deep:'#030303',ink:'#f5ecd5',muted:'#c6bb9b',edge:'#eacf8b'}},
}
const platformFace = (plan: string) => platformFaces[plan] || platformFaces[plan.replace(/_(monthly|yearly)$/,'')] || {}
export function maskRedeemCode(code: string) { const value=code.trim(); return value.length >= 12 ? `••••  ••••  ${value.slice(-4).replace(/[^a-zA-Z0-9]/g,'•')}` : '••••  ••••  ••••' }
export function productForPlan(plan: string):ProductView {
 const x = xSeries.find(product=>product.plan_type===plan)
 if (x) return {...neutral,...platformFace(x.plan_type),id:x.plan_type,family:'x',displayLabel:x.plan_display_name,officialLabel:x.plan_display_name,cardCaption:x.plan_display_name,kind:'subscription'}
 const grok = grokSeries.find(product=>product.plan_type===plan)
 if (grok) return {...neutral,...platformFace(grok.plan_type),id:grok.plan_type,family:'grok',displayLabel:grok.plan_display_name,officialLabel:grok.plan_display_name,cardCaption:grok.plan_display_name,kind:'subscription'}
 const product = redeemProducts.find(p=>p.id === (plan.startsWith('codex_') ? 'codex-credits' : ids[plan === 'plus_half' ? 'plus' : plan]))
 if (product && plan === 'plus_half') return {...product,displayLabel:'Plus半价',cardCaption:'Plus半价',overview:{name:'Plus半价',caption:product.officialLabel || 'ChatGPT Plus'}}
 return product || {...neutral,displayLabel:plan?'等待套餐确认':neutral.displayLabel}
}
export function cardForTask(input: {phase:RedeemPhase;plan?:string;identity?:string;taskId?:string;createdAt?:number|null;completedAt?:number|null;stoppedAt?:number|null;serverTime?:number|null;verificationStartedAt?:number|null;quantity?:number;identified?:boolean;step?:number;prechecking?:boolean;account?:string;verificationState?:string}):CardView {
 const phase = input.phase === 'focused' ? 'idle' : input.phase === 'review' && input.step === 2 ? 'identified' : input.phase === 'idle' && input.identified ? 'identified' : input.phase
 return {phase,brand:'RedeemAI',statusLabel:({idle:'待填写',identified:'已识别',review:'待核对',verifying:input.prechecking?'检查中':'识别中',success:'已完成',unknown:'待确认',action:input.verificationState==='awaiting_user_verification'?'待验证':'待操作',failed:'未完成',submitting:'提交中',processing:'处理中'} as Record<string,string>)[phase],productData:productForPlan(input.plan||''),identity:input.identity,requestId:input.taskId,account:input.account,verificationStartedAt:input.verificationStartedAt,taskStartedAt:input.createdAt,taskCompletedAt:input.completedAt,taskStoppedAt:input.stoppedAt,quantity:input.quantity,...(input.serverTime ? {serverTime:input.serverTime}:{})}
}

export function planFromSubscription(value:string) {const key=value.trim().toLowerCase();const exact:Record<string,string>={...Object.fromEntries(Object.entries(PRO_DISPLAY_NAMES).flatMap(([plan,name])=>[[name.toLowerCase(),plan],[`chatgpt ${name}`.toLowerCase(),plan]])),go:'go',chatgptgoplan:'go','chatgpt go':'go',plus:'plus',chatgptplusplan:'plus','chatgpt plus':'plus',chatgpt_plus:'plus',pro5x:'pro5x',chatgptprolite:'pro5x',prolite:'pro5x',pro_lite:'pro5x',chatgpt_pro_lite:'pro5x','chatgpt pro 100':'pro5x','pro 100':'pro5x',pro20x:'pro20x','chatgpt pro 200':'pro20x','pro 200':'pro20x',pro50x:'pro50x',pro_50x:'pro50x',chatgptpromax:'pro50x','chatgpt pro 500':'pro50x','pro 500':'pro50x'};return exact[key]||''}
