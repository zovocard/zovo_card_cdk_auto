import type { ContentLink } from './redeemPresentation'

export const tutorialNavigationCopy = {
  label: '使用教程',
  description: 'Chat、Work、Codex 使用与排障',
} as const

const stockTutorialCopy: Record<keyof typeof tutorialNavigationCopy, readonly string[]> = {
  label: ['使用教程', '教程中心'],
  description: [
    'Chat、Work、Codex 使用与排障',
    'Chat、Work、Codex、Grok 和 X 的用法与排障',
    'Chat、Work、Codex、Claude、Grok 和 X 的用法与排障',
  ],
}

const fallbackNavigation: ContentLink[] = [
  { id: 'redeem', label: '卡密兑换', description: '回到当前兑换步骤，不清空输入', url: '/recharge', target: '_self', enabled: true },
  { id: 'subscription', label: '订阅查询', description: '核对账号订阅、到期时间与账单', url: '/billing', target: '_blank', enabled: true },
  { id: 'status', label: '状态查询', description: '查询兑换订单、原任务进度与处理结果', url: '/history', target: '_blank', enabled: true },
  { id: 'tutorial', ...tutorialNavigationCopy, url: '/help', target: '_blank', enabled: true },
]

// Translate the supplied tutorial wording only. Configuration still owns the
// entry, its order and visibility; an administrator's custom text wins.
export function tutorialNavigationText(
  link: Pick<ContentLink, 'url' | 'label' | 'description'>,
  field: keyof typeof tutorialNavigationCopy,
  translated: string,
): string {
  return link.url === '/help' && stockTutorialCopy[field].includes(link[field]) && !translated.startsWith('learn.')
    ? translated
    : link[field]
}

// Supply the default Tutorial Center entry when public navigation still holds
// the legacy 3-item stock list, while honoring explicit admin ordering or
// `enabled: false` hiding whenever `/help` is already present in configuration.
export function publicNavigationLinks(links?: readonly ContentLink[] | null): ContentLink[] {
  if (!links) return fallbackNavigation
  const hasTutorial = links.some(link => link.url === '/help' || /^\/help(?:\/|$)/.test(link.url))
  const visible = links.filter(link => link.enabled)
  if (hasTutorial || links.length >= 12) return visible
  return [
    ...visible,
    { id: 'tutorial', ...tutorialNavigationCopy, url: '/help', target: '_blank', enabled: true },
  ]
}
