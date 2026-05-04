import { getToken } from './auth'

const API_BASE = 'http://127.0.0.1:8000/api/auth'

/**
 * Fetch all user's favorite tag preferences
 */
export const fetchUserTagPreferences = async () => {
  try {
    const token = getToken()
    const response = await fetch(`${API_BASE}/me/tag-preferences/`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (!response.ok) throw new Error('Failed to fetch tag preferences')
    const data = await response.json()
    console.log('📡 fetchUserTagPreferences API Response:', data)
    const prefs = data.data?.preferences || []
    console.log('📦 Extracted preferences:', prefs)
    return prefs
  } catch (err) {
    console.error('❌ Error fetching tag preferences:', err)
    throw err
  }
}

/**
 * Update user's tag preferences (replace all)
 */
export const updateUserTagPreferences = async (tagIds) => {
  try {
    const token = getToken()
    const response = await fetch(`${API_BASE}/me/tag-preferences/update/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ tag_ids: tagIds }),
    })

    if (!response.ok) throw new Error('Failed to update tag preferences')
    const data = await response.json()
    return data.data.preferences || []
  } catch (err) {
    console.error('Error updating tag preferences:', err)
    throw err
  }
}

/**
 * Add a single tag to preferences
 */
export const addTagPreference = async (tagId) => {
  try {
    const token = getToken()
    const response = await fetch(`${API_BASE}/me/tag-preferences/add/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ tag_id: tagId }),
    })

    if (!response.ok) throw new Error('Failed to add tag preference')
    const data = await response.json()
    return data.data
  } catch (err) {
    console.error('Error adding tag preference:', err)
    throw err
  }
}

/**
 * Remove a tag from preferences
 */
export const removeTagPreference = async (tagId) => {
  try {
    const token = getToken()
    const response = await fetch(`${API_BASE}/me/tag-preferences/${tagId}/delete/`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (!response.ok) throw new Error('Failed to remove tag preference')
    return true
  } catch (err) {
    console.error('Error removing tag preference:', err)
    throw err
  }
}

/**
 * Fetch all available tags in system
 */
export const fetchAvailableTags = async () => {
  try {
    const response = await fetch(`${API_BASE}/tags/available/`, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) throw new Error('Failed to fetch available tags')
    const data = await response.json()
    console.log('📡 fetchAvailableTags API Response:', data)
    const tags = Array.isArray(data.data) ? data.data : (data.data?.tags || [])
    console.log('📦 Extracted tags:', tags)
    return tags
  } catch (err) {
    console.error('❌ Error fetching available tags:', err)
    throw err
  }
}
