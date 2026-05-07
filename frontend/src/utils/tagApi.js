import { apiRequest } from './api'

/**
 * Fetch all user's favorite tag preferences
 */
export const fetchUserTagPreferences = async () => {
  try {
    const data = await apiRequest('/auth/me/tag-preferences/')
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
    const data = await apiRequest('/auth/me/tag-preferences/update/', {
      method: 'POST',
      body: JSON.stringify({ tag_ids: tagIds }),
    })
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
    const data = await apiRequest('/auth/me/tag-preferences/add/', {
      method: 'POST',
      body: JSON.stringify({ tag_id: tagId }),
    })
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
    await apiRequest(`/auth/me/tag-preferences/${tagId}/delete/`, {
      method: 'DELETE',
    })
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
    const data = await apiRequest('/auth/tags/available/')
    console.log('📡 fetchAvailableTags API Response:', data)
    const tags = Array.isArray(data.data) ? data.data : (data.data?.tags || [])
    console.log('📦 Extracted tags:', tags)
    return tags
  } catch (err) {
    console.error('❌ Error fetching available tags:', err)
    throw err
  }
}
