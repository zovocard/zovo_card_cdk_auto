// Kept separate from content so ordinary redemption pages never import the tutorial corpus.
export const chapterHref = (id: string) => `/help/${id}`
export function legacyTutorialLocation(hash: string): { path: string; hash?: string } {
  const match = /^#(ch\d{2})(?:\/(h\d+))?$/.exec(hash)
  return match ? { path: chapterHref(match[1]), ...(match[2] ? { hash: `#${match[2]}` } : {}) } : { path: '/help' }
}
export function isTutorialLink(value: string): boolean {
  try {
    const url = new URL(value, window.location.origin)
    return url.origin === window.location.origin && (/^\/help(?:\/|$)/.test(url.pathname) || ['/learn.html', '/chatgpt_codex_guide/guide.html'].includes(url.pathname))
  } catch { return false }
}
