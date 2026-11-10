import { describe, expect, it } from 'vitest'
import {
  checkSessionForCdk,
  extractCdkSession,
  parseSessionJsonLenient,
} from '../batch-session'

const JWE = 'eyJ0.a.b.c.d' // 五段 JWE 占位(sessionToken 形态)

describe('格式化多行 Session JSON 容错', () => {
  it('标准 pretty 多行(含 sessionToken)照常通过', () => {
    const raw = `{
  "user": { "name": "张三", "email": "a@b.com" },
  "accessToken": "eyJa.b.c",
  "sessionToken": "${JWE}"
}`
    const s = extractCdkSession(raw)
    expect(s).not.toBe('')
    expect(() => JSON.parse(s)).not.toThrow() // 回传给后端的必须是严格合法 JSON
  })

  it('带尾逗号的多行 JSON 现在能解析(原来 JSON.parse 直接抛→误报)', () => {
    const raw = `{
  "accessToken": "eyJa.b.c",
  "sessionToken": "${JWE}",
}`
    const s = extractCdkSession(raw)
    expect(s).not.toBe('')
    // 回传的必须已清洗成严格合法 JSON(后端 Go 的 json.Unmarshal 才能过)
    const obj = JSON.parse(s)
    expect(obj.sessionToken).toBe(JWE)
    expect(checkSessionForCdk(raw).ok).toBe(true)
  })

  it('数组/嵌套对象的尾逗号也清理', () => {
    const raw = `{
  "sessionToken": "${JWE}",
  "arr": [1, 2, 3,],
  "nested": { "a": 1, },
}`
    const parsed = parseSessionJsonLenient(raw)
    expect(parsed).not.toBeNull()
    expect(() => JSON.parse(parsed!.canonical)).not.toThrow()
  })

  it('字符串内部的逗号/花括号绝不被动', () => {
    const raw = `{
  "sessionToken": "${JWE}",
  "note": "a,b,}] not json",
}`
    const parsed = parseSessionJsonLenient(raw)
    expect(parsed).not.toBeNull()
    expect((parsed!.obj as any).note).toBe('a,b,}] not json')
  })

  it('无 sessionToken 仍拒(规则不放松)', () => {
    const raw = `{
  "user": { "email": "a@b.com" },
  "accessToken": "eyJa.b.c",
}`
    expect(extractCdkSession(raw)).toBe('')
  })

  it('彻底非法 JSON 返回 null / 空', () => {
    expect(parseSessionJsonLenient('{ not json at all ')).toBeNull()
    expect(extractCdkSession('{ nope')).toBe('')
  })
})
