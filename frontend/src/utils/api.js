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

export async function apiRequest(path, options = {}) {
  const token = getToken()
  const isFormData = options.body instanceof FormData

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body,
    credentials: 'include',
    signal: options.signal,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const firstError = getFirstError(data)

    if (isAuthOrLockedError(response, firstError)) {
      forceLogoutToLogin(firstError)
    }

    throw new Error(firstError)
  }

  return data
}