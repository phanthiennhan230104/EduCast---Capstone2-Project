function trimTrailingSlashes(url) {
  return String(url || '').replace(/\/+$/, '')
}

/** Gốc backend, ví dụ http://127.0.0.1:8000 — ghi đè bằng VITE_API_URL */
export const API_ORIGIN =
  trimTrailingSlashes(import.meta.env.VITE_API_URL) || 'http://127.0.0.1:8000'

export const API_BASE_URL = `${API_ORIGIN}/api`

function toWsOrigin(httpOrigin) {
  if (httpOrigin.startsWith('https://')) return httpOrigin.replace(/^https/, 'wss')
  return httpOrigin.replace(/^http/, 'ws')
}

export const WS_ORIGIN = toWsOrigin(API_ORIGIN)
