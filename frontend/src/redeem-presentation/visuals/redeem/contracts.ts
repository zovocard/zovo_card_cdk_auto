/** Normalized presentation contract; NOT claims about current backend field names. */
export type Stage = 'atelier' | 'silk' | 'porcelain' | 'orbit' | 'astral' | 'verdant' | 'dawn'
export type Palette = { base: string; deep: string; ink: string; muted: string; edge: string }
export type CardExperience = { timerEnabled: boolean; stageLabelEnabled: boolean; edgeIntensity: number; successSettle: boolean; themeAdaptation: boolean }
export interface ProductView {
 id: string
 family: 'openai' | 'claude' | 'codex' | 'grok' | 'x' | 'redeemai'
 displayLabel: string
 overview?: { name: string; caption: string; formerPlan?: string }
 cardCaption?: string
 officialLabel?: string
 legacyLabel?: string
 cardUsageMultiplier?: number
 description?: string
 rank: string
 edition: string
 kind: 'subscription' | 'credits' | 'provisional' | 'unknown'
 pattern: string
 palette: Palette
 themePalettes?: Partial<Record<Stage, Palette>>
}
export interface CardView {
 phase: 'idle' | 'verifying' | 'identified' | 'review' | 'submitting' | 'processing' | 'success' | 'failed' | 'unknown' | 'action'
 statusLabel: string
 brand: string
 productData: ProductView
 account?: string
 requestId?: string
 identity?: string
 quantity?: number
 verificationStartedAt?: number | null
 taskStartedAt?: number | null
 taskCompletedAt?: number | null
 taskStoppedAt?: number | null
 serverTime?: number | null
 clockCopy?: Record<'verification' | 'success' | 'failed' | 'unknown' | 'action' | 'processing' | 'pending' | 'pendingDetail' | 'stoppedDetail' | 'terminalDetail' | 'runningDetail', string>
}
/** Third-party state/actions stay in the existing provider controller. Do not infer them from CSS. */
export interface OperationView {
 stage: 'entry' | 'credentials' | 'prechecking' | 'review' | 'submitting' | 'task'
 businessStatus?: string
 verificationMode?: 'external' | 'embedded'
 verificationVisible: boolean
 canSubmit: boolean
 canQueryOriginal: boolean
 canOpenVerification: boolean
}

/** Strict allowlist: only navigation/display actions, never a payment/challenge API. */
export type SurfaceAction = 'link' | 'redeem' | 'guide' | 'video' | 'challenge-guide' | 'tier-guide'
export interface SurfaceLink {id:string; label:string; description:string; url:string; target:'_self'|'_blank'; enabled:boolean; action?:SurfaceAction}
export interface SurfaceDetails {productionOrigin:string; menuLabel:string; tierLabel:string;videoTitle:string;videoDescription:string;videoURL:string;posterURL:string;captionURL:string;videoVersion:string;videoHasVoice:boolean;tierNotice:string}

/** M1.5 content fields: safe display defaults, no visitor theme selection. */
export interface FrontReadingDefaults {fontStyle: 'editorial' | 'modern' | 'system';onlineFonts:boolean;light:'auto' | 'system' | 'day' | 'night';musicVolume:number}
export interface FrontMediaPolicy {allowStageSwitch:false;videoHasVoice:false;visitorDefaults:FrontReadingDefaults}
