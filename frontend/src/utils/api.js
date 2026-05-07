import { getToken, forceLogoutToLogin } from './auth'

export const API_BASE_URL = 'http://127.0.0.1:8000/api'

function getFirstError(data) {
  return (
    data.message ||
    data.detail ||
    data.error ||
    Object.values(data)[0]?.[0] ||
    Object.values(data)[0] ||
    'Request failed.'
  )
}

function isAuthOrLockedError(response, message) {
  const normalizedMessage = String(message || '').toLowerCase()

  return (
    response.status === 401 ||
    response.status === 403 ||
    normalizedMessage.includes('token không hợp lệ') ||
    normalizedMessage.includes('đã hết hạn') ||
    normalizedMessage.includes('đang bị khóa') ||
    normalizedMessage.includes('bị khóa') ||
    normalizedMessage.includes('không hoạt động') ||
    normalizedMessage.includes('account locked') ||
    normalizedMessage.includes('inactive')
  )
}

let refreshInFlight = null

async function refreshAccessToken() {
  const refresh = getRefreshToken()
  if (!refresh) return null

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
        credentials: 'omit',
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = getFirstError(data)
        throw new Error(message)
      }

      // SimpleJWT refresh thường trả { access: "..." } (có thể kèm refresh).
      saveAuth(data)
      return data.access || null
    })().finally(() => {
      refreshInFlight = null
    })
  }

  return await refreshInFlight
}


export async function apiRequest(path, options = {}) {
  const token = getToken()
  const isFormData = options.body instanceof FormData
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 10000)

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      body: options.body,
      // Most endpoints use Bearer tokens (not cookies). Opt-in to cookies only when needed.
      credentials: options.credentials ?? 'omit',
      signal: controller.signal,
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const firstError =
        data.message ||
        data.detail ||
        data.error ||
        Object.values(data)[0]?.[0] ||
        Object.values(data)[0] ||
        'Request failed.'

      throw new Error(firstError)
    }

    return data
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your backend connection.')
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
