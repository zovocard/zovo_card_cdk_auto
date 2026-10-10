import { xPremiumCredential } from './x-premium'
import { isGrokCredential } from './grok'
// xlsx 约 430 kB（gzip 145 kB）：只在真正读/写 Excel 时才加载，不拖累首屏与其它页面。
const loadXLSX = () => import('xlsx')

/** 批量上限：前端受理条数（并发提交，非同时跑满） */
export const BATCH_MAX_KEYS = 1000
export const AUTO_SUBMIT_CONCURRENCY = 6
export const VERIFY_CONCURRENCY = 6
export const BATCH_POLL_INTERVAL_MS = 3000

export interface ImportedSession {
  email: string
  session: string
  accessToken: string
  gptPassword: string
  emailPassword: string
  source: string
  accountId?: string
}

export interface ImportedMailbox {
  email: string
  password: string
  source: string
}

/** 单行邮箱密码：email----password / email:password / email,password / email password */
export function parseMailboxLine(line: string): ImportedMailbox | null {
  const raw = String(line || '')
    .replace(/^\uFEFF/, '')
    .trim()
  if (!raw || raw.startsWith('#')) return null
  let email = ''
  let password = ''
  if (raw.includes('----')) {
    const [e, ...rest] = raw.split('----')
    email = e.trim()
    password = rest.join('----').trim()
  } else if (raw.includes(',')) {
    const [e, ...rest] = raw.split(',')
    email = e.trim()
    password = rest.join(',').trim()
  } else if (raw.includes(';')) {
    const [e, ...rest] = raw.split(';')
    email = e.trim()
    password = rest.join(';').trim()
  } else if (raw.includes(':') && raw.indexOf('@') < raw.indexOf(':')) {
    const idx = raw.indexOf(':')
    email = raw.slice(0, idx).trim()
    password = raw.slice(idx + 1).trim()
  } else {
    const m = raw.match(/^(\S+@\S+)\s+(.+)$/)
    if (!m) return null
    email = m[1].trim()
    password = m[2].trim()
  }
  email = email.replace(/^["']|["']$/g, '')
  password = password.replace(/^["']|["']$/g, '')
  if (!email.includes('@') || !password) return null
  return { email, password, source: 'line' }
}

export function parseMailboxLines(raw: string): ImportedMailbox[] {
  const seen = new Set<string>()
  const out: ImportedMailbox[] = []
  for (const line of String(raw || '').split(/\r?\n/)) {
    const row = parseMailboxLine(line)
    if (!row) continue
    const key = row.email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

/** Excel/CSV：识别邮箱 + 邮箱密码列（可不含 session） */
export function parseMailboxesFromSheet(rows: unknown[][]): {
  mailboxes: ImportedMailbox[]
  mode: string
  skippedDup: number
} {
  if (!rows.length) return { mailboxes: [], mode: 'empty', skippedDup: 0 }
  const header = (rows[0] || []).map((c) =>
    String(c ?? '')
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase(),
  )
  const isHeader =
    header.some((h) => /邮箱|email|mail|密码|password|账号/.test(h)) && rows.length > 1
  let emailCol = -1
  let passCol = -1
  let mode = 'scan'
  if (isHeader) {
    emailCol = header.findIndex(
      (h) => /^(邮箱|email|e-mail|mail|账号邮箱)$/.test(h) || (h.includes('邮箱') && !h.includes('密码')),
    )
    passCol = header.findIndex((h) =>
      /^(邮箱密码|email.?password|mail.?password|邮箱口令|password|密码)$/.test(h),
    )
    if (passCol < 0) {
      passCol = header.findIndex((h) => h.includes('密码') || h.includes('password'))
    }
    mode = `header:${header[emailCol] || emailCol}/${header[passCol] || passCol}`
  }
  const dataStart = isHeader ? 1 : 0
  const colCount = Math.max(...rows.map((r) => (r ? r.length : 0)), 0)
  if (emailCol < 0 || passCol < 0) {
    // 无表头：优先两列 email / password；或整行 ---- 分隔
    for (let c = 0; c < colCount; c++) {
      let hits = 0
      for (let r = dataStart; r < Math.min(rows.length, dataStart + 20); r++) {
        const v = String((rows[r] || [])[c] ?? '').trim()
        if (v.includes('@') && v.includes('.') && v.length < 120) hits++
      }
      if (hits >= 1 && emailCol < 0) emailCol = c
    }
    if (emailCol >= 0 && passCol < 0) {
      passCol = emailCol + 1 < colCount ? emailCol + 1 : -1
    }
    mode = 'content-scan'
  }

  const mailboxes: ImportedMailbox[] = []
  const seen = new Set<string>()
  let skippedDup = 0
  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r] || []
    // 单列整行：email----password
    if (emailCol >= 0 && passCol < 0) {
      const parsed = parseMailboxLine(String(row[emailCol] ?? ''))
      if (!parsed) continue
      const key = parsed.email.toLowerCase()
      if (seen.has(key)) {
        skippedDup++
        continue
      }
      seen.add(key)
      mailboxes.push({ ...parsed, source: `row${r + 1}` })
      continue
    }
    if (emailCol < 0 || passCol < 0) {
      // 尝试任意单元格整行解析
      let parsed: ImportedMailbox | null = null
      for (const cell of row) {
        parsed = parseMailboxLine(String(cell ?? ''))
        if (parsed) break
      }
      if (!parsed) continue
      const key = parsed.email.toLowerCase()
      if (seen.has(key)) {
        skippedDup++
        continue
      }
      seen.add(key)
      mailboxes.push({ ...parsed, source: `row${r + 1}` })
      continue
    }
    const email = String(row[emailCol] ?? '').trim()
    const password = String(row[passCol] ?? '').trim()
    if (!email.includes('@') || !password) continue
    const key = email.toLowerCase()
    if (seen.has(key)) {
      skippedDup++
      continue
    }
    seen.add(key)
    mailboxes.push({ email, password, source: `row${r + 1}` })
  }
  return { mailboxes, mode, skippedDup }
}

function normalizeAccessToken(raw: string): string {
  return raw.trim().replace(/^Bearer\s+/i, '').replace(/\s+/g, '')
}

function looksLikeJwt(s: string): boolean {
  const t = normalizeAccessToken(s)
  if (!t.startsWith('eyJ')) return false
  return t.split('.').length === 3
}

function decodeBase64UrlJson(part: string): Record<string, unknown> | null {
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
  } catch {
    return null
  }
}

function looksLikeCompactJwe(s: string): boolean {
  const t = normalizeAccessToken(s)
  const parts = t.split('.')
  if (!t.startsWith('eyJ') || parts.length !== 5) return false
  const header = decodeBase64UrlJson(parts[0])
  return !!(header?.alg && header.enc)
}

export function accessTokenFromSession(raw: string): string {
  const normalized = normalizeAccessToken(raw)
  if (looksLikeJwt(normalized)) return normalized
  try {
    const value = JSON.parse(raw.trim()) as Record<string, unknown>
    const account = value.account as Record<string, unknown> | undefined
    const token = value.accessToken || value.access_token || account?.accessToken
    return typeof token === 'string' ? normalizeAccessToken(token) : ''
  } catch {
    return ''
  }
}

/**
 * CDK 凭证规则（与单笔兑换一致）：完整 Session JSON（必须含 sessionToken），
 * 或裸五段 JWE；禁止纯 Access Token。
 */
export function extractCdkSession(raw: string): string {
  if (xPremiumCredential(raw)) return raw.trim()
  // Grok 登录态（sso= cookie）：Grok 码兑换直接带它，不走 GPT 的 sessionToken 规则
  if (isGrokCredential(raw)) return raw.trim()
  const s = raw.trim()
  if (!s) return ''
  if (!s.startsWith('{') && s.split('.').length >= 5) return s
  if (!s.startsWith('{') && s.startsWith('eyJ') && s.split('.').length === 3) return ''
  if (s.startsWith('{')) {
    try {
      const o = JSON.parse(s)
      const st = String(o.sessionToken || o.session_token || o.token?.sessionToken || '').trim()
      if (!st) return ''
      return s
    } catch {
      return ''
    }
  }
  return s.length > 40 ? s : ''
}

export function checkSessionForCdk(raw: string): { ok: boolean; error: string; email: string } {
  const text = raw.trim()
  if (!text || text.length < 20) {
    return { ok: false, error: 'Session 太短', email: '' }
  }
  const session = extractCdkSession(text)
  if (!session) {
    return {
      ok: false,
      error: '请粘贴完整 Session JSON（必须含 sessionToken），不能只用 Access Token',
      email: '',
    }
  }
  if (session.startsWith('{')) {
    try {
      const obj = JSON.parse(session)
      const email = String(obj.user?.email || obj.account?.email || obj.email || '')
      return { ok: true, error: '', email }
    } catch {
      return { ok: false, error: 'Session JSON 无法解析', email: '' }
    }
  }
  return { ok: true, error: '', email: '' }
}

export function parseCdks(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\n\r\t\s,;，；]+/)
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length >= 4),
    ),
  )
}

function normalizeSessionCell(raw: string): string {
  let t = String(raw ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
  if (!t) return ''
  if (t.startsWith("'")) t = t.slice(1).trim()
  if (
    (t.startsWith('"') && t.endsWith('"') && t.length > 2) ||
    (t.startsWith("'") && t.endsWith("'") && t.length > 2)
  ) {
    t = t.slice(1, -1)
  }
  if (t.includes('""') && (t.includes('accessToken') || t.includes('access_token') || t.startsWith('{'))) {
    const undoubled = t.replace(/""/g, '"')
    try {
      JSON.parse(undoubled)
      return undoubled
    } catch {
      /* keep original */
    }
  }
  return t
}

function looksLikeSessionJson(s: string): boolean {
  if (xPremiumCredential(s)) return true
  if (isGrokCredential(s)) return true
  const t = normalizeSessionCell(s)
  if (!t.startsWith('{') || t.length < 80) return false
  if (!t.includes('accessToken') && !t.includes('access_token') && !t.includes('sessionToken')) {
    return false
  }
  try {
    const o = JSON.parse(t)
    return !!(
      o.accessToken ||
      o.access_token ||
      o.sessionToken ||
      o.session_token ||
      o.account?.accessToken
    )
  } catch {
    return false
  }
}

function looksLikeSessionCredential(s: string): boolean {
  const t = normalizeAccessToken(s)
  if (looksLikeCompactJwe(t)) return true
  if (!looksLikeJwt(t)) return false
  const payload = decodeBase64UrlJson(t.split('.')[1])
  return !!(payload?.exp || payload?.['https://api.openai.com/profile'] || payload?.email)
}

function extractAccountId(sessionRaw: string): string {
  try {
    const t = sessionRaw.trim()
    if (!t.startsWith('{')) return ''
    const o = JSON.parse(t) as Record<string, unknown>
    const direct = o.account_id || o.accountId
    if (typeof direct === 'string' && direct.trim()) return direct.trim()
    const accounts = o.accounts as Record<string, unknown> | undefined
    if (accounts && typeof accounts === 'object') {
      const def = (accounts.default || Object.values(accounts)[0]) as Record<string, unknown> | undefined
      if (def) {
        const acc = def.account as Record<string, unknown> | undefined
        const id = acc?.account_id || acc?.id || def.account_id || def.id
        if (typeof id === 'string' && id.trim()) return id.trim()
      }
    }
    const user = o.user as Record<string, unknown> | undefined
    if (user && typeof user.id === 'string' && user.id.trim()) return user.id.trim()
  } catch {
    /* ignore */
  }
  return ''
}

export function parseSessionsFromSheet(rows: unknown[][]): {
  sessions: ImportedSession[]
  emailCol: number
  sessionCol: number
  mode: string
  skippedDup: number
} {
  if (!rows.length) {
    return { sessions: [], emailCol: -1, sessionCol: -1, mode: 'empty', skippedDup: 0 }
  }

  const header = (rows[0] || []).map((c) =>
    String(c ?? '')
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase(),
  )
  const isHeader =
    header.some((h) => /邮箱|email|mail|session|会话|token|密码|password|账号|gpt/.test(h)) &&
    rows.length > 1

  let emailCol = -1
  let sessionCol = -1
  let tokenCol = -1
  let gptPasswordCol = -1
  let emailPasswordCol = -1
  let strictSessionColumn = false
  let mode = 'scan'

  if (isHeader) {
    emailCol = header.findIndex(
      (h) => /^(邮箱|email|e-mail|mail|账号邮箱)$/.test(h) || h.includes('邮箱') || h === 'email',
    )
    gptPasswordCol = header.findIndex((h) =>
      /^(gpt密码|gpt.?password|chatgpt密码|chatgpt.?password)$/.test(h),
    )
    emailPasswordCol = header.findIndex((h) =>
      /^(邮箱密码|email.?password|mail.?password|邮箱口令)$/.test(h),
    )
    tokenCol = header.findIndex(
      (h) =>
        /^(at|token|accesstoken|access_token|access token)$/.test(h) ||
        h.includes('accesstoken') ||
        h.includes('access_token'),
    )
    sessionCol = header.findIndex(
      (h) => /^(session|sessions|会话|chatgpt.?session)$/.test(h) || h === 'session',
    )
    if (sessionCol < 0) {
      sessionCol = header.findIndex((h) => h.includes('session') || h.includes('会话'))
    }
    strictSessionColumn = sessionCol >= 0
    if (sessionCol < 0) sessionCol = tokenCol
    mode = sessionCol >= 0 ? `header:${header[sessionCol] || sessionCol}` : 'header-miss'
  }

  const dataStart = isHeader ? 1 : 0
  const colCount = Math.max(...rows.map((r) => (r ? r.length : 0)), 0)

  if (sessionCol < 0) {
    const scores = new Array(colCount).fill(0)
    for (let r = dataStart; r < Math.min(rows.length, dataStart + 40); r++) {
      const row = rows[r] || []
      for (let c = 0; c < colCount; c++) {
        const v = normalizeSessionCell(String(row[c] ?? ''))
        if (looksLikeSessionJson(v)) scores[c] += 5
        else if (looksLikeSessionCredential(v)) scores[c] += 1
      }
    }
    let best = -1
    let bestScore = 0
    for (let c = 0; c < scores.length; c++) {
      if (scores[c] > bestScore) {
        bestScore = scores[c]
        best = c
      }
    }
    if (best >= 0 && bestScore > 0) {
      sessionCol = best
      mode = 'content-scan'
    }
  }

  if (emailCol < 0) {
    for (let c = 0; c < colCount; c++) {
      if (c === sessionCol) continue
      let hits = 0
      for (let r = dataStart; r < Math.min(rows.length, dataStart + 20); r++) {
        const v = String((rows[r] || [])[c] ?? '').trim()
        if (v.includes('@') && v.includes('.') && v.length < 120) hits++
      }
      if (hits >= 1) {
        emailCol = c
        break
      }
    }
  }

  const sessions: ImportedSession[] = []
  if (sessionCol < 0) {
    return { sessions, emailCol, sessionCol, mode: 'not-found', skippedDup: 0 }
  }

  const seenKeys = new Set<string>()
  let skippedDup = 0

  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r] || []
    let raw = normalizeSessionCell(String(row[sessionCol] ?? ''))
    if (!raw) continue

    let session = ''
    const emailFromCell = emailCol >= 0 ? String(row[emailCol] ?? '').trim() : ''
    const gptPassword = gptPasswordCol >= 0 ? String(row[gptPasswordCol] ?? '').trim() : ''
    const emailPassword = emailPasswordCol >= 0 ? String(row[emailPasswordCol] ?? '').trim() : ''

    if (looksLikeSessionJson(raw)) {
      session = normalizeSessionCell(raw)
    } else if (looksLikeSessionCredential(raw)) {
      session = raw.replace(/^Bearer\s+/i, '').replace(/\s+/g, '')
    } else if (!strictSessionColumn) {
      for (let c = 0; c < row.length; c++) {
        const v = normalizeSessionCell(String(row[c] ?? ''))
        if (looksLikeSessionJson(v)) {
          session = v
          break
        }
      }
    }
    if (!session) continue

    // 导入阶段宽松识别；提交时再按 CDK 严格规则校验
    const emailQuick = (() => {
      try {
        if (!session.startsWith('{')) return ''
        const obj = JSON.parse(session)
        return String(obj.user?.email || obj.account?.email || obj.email || '')
      } catch {
        return ''
      }
    })()

    const email = (emailQuick || emailFromCell || '').trim().toLowerCase()
    const accountId = extractAccountId(session)
    const keys: string[] = []
    if (email) keys.push(`email:${email}`)
    if (accountId) keys.push(`acct:${accountId}`)
    if (!email && !accountId) keys.push(`sess:${session.slice(0, 80)}:${session.length}`)
    if (keys.some((k) => seenKeys.has(k))) {
      skippedDup++
      continue
    }
    for (const k of keys) seenKeys.add(k)

    sessions.push({
      email: emailQuick || emailFromCell || '',
      session,
      accessToken:
        (tokenCol >= 0 ? normalizeAccessToken(String(row[tokenCol] ?? '')) : '') ||
        accessTokenFromSession(session),
      gptPassword,
      emailPassword,
      source: `row${r + 1}`,
      accountId: accountId || undefined,
    })
  }

  return { sessions, emailCol, sessionCol, mode, skippedDup }
}

function parseCsvTextToRows(text: string): unknown[][] {
  const src = text.replace(/^\uFEFF/, '')
  const compactRows = src
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (compactRows.length > 0 && compactRows.every((line) => line.split('----').length === 4)) {
    return [
      ['邮箱', 'GPT密码', '邮箱密码', 'token'],
      ...compactRows.map((line) => line.split('----')),
    ]
  }
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      row.push(cur)
      cur = ''
      continue
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cur)
      cur = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
      continue
    }
    cur += ch
  }
  row.push(cur)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

export async function readWorkbookRows(file: File): Promise<unknown[][]> {
  const name = (file.name || '').toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = await file.text()
    const manual = parseCsvTextToRows(text)
    if (manual.length > 0) {
      const hasJson = manual.some((r) => r.some((c) => looksLikeSessionJson(String(c ?? ''))))
      if (hasJson || manual[0]?.some((h) => /session|会话|token|\bat\b/i.test(String(h)))) {
        return manual
      }
    }
    try {
      const XLSX = await loadXLSX()
      const wb = XLSX.read(text, { type: 'string', raw: false })
      const sheetName = wb.SheetNames[0]
      const sheet = wb.Sheets[sheetName]
      if (sheet) {
        return XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          raw: false,
        }) as unknown[][]
      }
    } catch {
      /* fall through */
    }
    return manual
  }

  const [buf, XLSX] = await Promise.all([file.arrayBuffer(), loadXLSX()])
  const wb = XLSX.read(buf, { type: 'array', cellText: true, cellDates: false })
  const sheetName =
    wb.SheetNames.find((n) => /数据|data|session|账号|account/i.test(n)) || wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][]
}

export async function exportSuccessWorkbook(
  rows: Array<[string, string, string, string]>,
  filenamePrefix = 'batch_success',
) {
  const XLSX = await loadXLSX()
  const sheet = XLSX.utils.aoa_to_sheet([['邮箱', 'GPT密码', '邮箱密码', 'at'], ...rows])
  sheet['!cols'] = [{ wch: 32 }, { wch: 24 }, { wch: 24 }, { wch: 72 }]
  sheet['!autofilter'] = { ref: `A1:D${rows.length + 1}` }
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '账号')
  XLSX.writeFile(workbook, `${filenamePrefix}_${Date.now()}.xlsx`, { compression: true })
}

export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) || 1 }, async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      results[i] = await worker(items[i], i)
    }
  })
  await Promise.all(runners)
  return results
}
