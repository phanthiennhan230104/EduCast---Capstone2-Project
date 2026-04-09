import { getToken } from './auth'

const API_BASE = 'http://127.0.0.1:8000/api/social'

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
  } catch (err) {
    console.error('Fetch notifications error:', err)
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
  } catch (err) {
    console.error('Mark notifications as read error:', err)
    return false
  }
}
