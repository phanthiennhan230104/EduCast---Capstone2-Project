import { apiRequest } from './api'
import i18n from './i18n'

/**
 * Fetch all user's favorite tag preferences
 */
export const fetchUserTagPreferences = async () => {
  try {
    const data = await apiRequest('/auth/me/tag-preferences/')
    console.log(i18n.t('tagPreferences.fetchPreferencesResponseLog'), data)
    const prefs = data.data?.preferences || []
    console.log(i18n.t('tagPreferences.extractedPreferencesLog'), prefs)
    return prefs
  } catch (err) {
    console.error(i18n.t('tagPreferences.fetchPreferencesErrorLog'), err)
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
    console.error(i18n.t('tagPreferences.updatePreferencesErrorLog'), err)
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
    console.error(i18n.t('tagPreferences.addPreferenceErrorLog'), err)
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
    console.error(i18n.t('tagPreferences.removePreferenceErrorLog'), err)
    throw err
  }
}

/**
 * Fetch all available tags in system
 */
export const fetchAvailableTags = async () => {
  try {
    const data = await apiRequest('/auth/tags/available/')
    console.log(i18n.t('tagPreferences.fetchAvailableTagsResponseLog'), data)
    const tags = Array.isArray(data.data) ? data.data : (data.data?.tags || [])
    console.log(i18n.t('tagPreferences.extractedTagsLog'), tags)
    return tags
  } catch (err) {
    console.error(i18n.t('tagPreferences.fetchAvailableTagsErrorLog'), err)
    throw err
  }
}
