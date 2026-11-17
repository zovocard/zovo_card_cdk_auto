// 后台界面偏好（只是本机便利设置，存 localStorage；读写失败时退回默认值）。
import { ref } from 'vue'

export type TableDensity = 'compact' | 'default'
const DENSITY_KEY = 'admin-table-density'

function readDensity(): TableDensity {
  try {
    return localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'default'
  } catch {
    return 'default'
  }
}

/** 表格行高：紧凑 36px / 默认 40px */
export const tableDensity = ref<TableDensity>(readDensity())

export function setTableDensity(v: TableDensity) {
  tableDensity.value = v === 'compact' ? 'compact' : 'default'
  try {
    localStorage.setItem(DENSITY_KEY, tableDensity.value)
  } catch { /* 隐私模式等 */ }
}

/** 读一份 JSON 偏好；坏数据 / 不可用时返回 fallback */
export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const v = JSON.parse(raw)
    return v && typeof v === 'object' ? { ...fallback, ...v } : fallback
  } catch {
    return fallback
  }
}

export function writePref(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* ignore */ }
}
