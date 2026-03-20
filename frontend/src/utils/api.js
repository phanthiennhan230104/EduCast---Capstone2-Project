import { getToken } from './auth'

export const API_BASE_URL = 'http://127.0.0.1:8000/api'

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
}