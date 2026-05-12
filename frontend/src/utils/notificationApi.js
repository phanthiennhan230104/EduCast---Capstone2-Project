import { API_BASE_URL } from '../config/apiBase'
import { getToken } from './auth'

const API_BASE = `${API_BASE_URL}/social`

export async function getNotifications() {
  const token = getToken()
  if (!token) return { data: { notifications: [], unread_count: 0 } }

  try {
    const response = await fetch(`${API_BASE}/notifications/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (response.ok) {
      const result = await response.json()
      return result
    }
    return { data: { notifications: [], unread_count: 0 } }
  } catch {
    /* Backend không chạy / mất mạng — trả rỗng, không spam console */
    return { data: { notifications: [], unread_count: 0 } }
  }
}

export async function markAllNotificationsAsRead() {
  const token = getToken()
  if (!token) return false

  try {
    const response = await fetch(`${API_BASE}/notifications/mark-all-read/`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    return response.ok
  } catch {
    return false
  }
}
