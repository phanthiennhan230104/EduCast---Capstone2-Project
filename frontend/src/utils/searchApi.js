import { API_BASE_URL } from '../config/apiBase'
import { getToken } from './auth'

export const searchContent = async (query, type = 'all', limit = 20, offset = 0) => {
  const token = getToken()
  
  if (!token) {
    throw new Error('Authentication required')
  }

  try {
    const params = new URLSearchParams({
      q: query,
      type,
      limit,
      offset,
    })

    const response = await fetch(`${API_BASE_URL}/content/search/?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Search failed:', error)
    throw error
  }
}
