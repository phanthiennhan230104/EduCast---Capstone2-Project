import { apiRequest } from './api'

export async function updateUserProfile(data) {
  return apiRequest('/auth/profile/update/', {
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data),
    headers: data instanceof FormData ? {} : { 'Content-Type': 'application/json' },
  })
}

export async function updateUserSettings(settings) {
  // Only send valid fields from user_settings table
  const validFields = {
    'email_notifications': settings.email_notifications,
    'push_notifications': settings.push_notifications,
    'notify_likes': settings.notify_likes,
    'notify_comments': settings.notify_comments,
    'notify_follows': settings.notify_follows,
    'notify_messages': settings.notify_messages,
    'profile_visibility': settings.profile_visibility,
    'allow_messages_from': settings.allow_messages_from,
    'autoplay_audio': settings.autoplay_audio,
    'theme_mode': settings.theme_mode,
    'language_code': settings.language_code,
  }

  // Remove undefined values
  const payload = Object.fromEntries(
    Object.entries(validFields).filter(([_, v]) => v !== undefined)
  )

  return apiRequest('/auth/settings/update/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getUserSettings() {
  return apiRequest('/auth/settings/')
}

export async function changePassword(oldPassword, newPassword) {
  return apiRequest('/auth/change-password/', {
    method: 'POST',
    body: JSON.stringify({
      old_password: oldPassword,
      new_password: newPassword,
    }),
  })
}

export async function unlinkSocialAccount(provider) {
  return apiRequest(`/auth/social-accounts/${provider}/unlink/`, {
    method: 'POST',
  })
}

export async function linkSocialAccount(provider, code) {
  return apiRequest(`/auth/social-accounts/${provider}/link/`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export async function deleteAccount(password) {
  return apiRequest('/auth/delete-account/', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  })
}

export async function exportUserData() {
  return apiRequest('/auth/export-data/', {
    method: 'GET',
  })
}

export async function getAdminOverview() {
  return apiRequest('/auth/admin/overview/', {
    method: 'GET',
  })
}

export async function getLoginHistory() {
  return apiRequest('/auth/login-history/', {
    method: 'GET',
  })
}

export async function getActivityLogs() {
  return apiRequest('/social/activity-logs/', {
    method: 'GET',
  })
}
