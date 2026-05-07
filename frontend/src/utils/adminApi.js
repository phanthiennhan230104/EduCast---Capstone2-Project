import { apiRequest } from './api'

export async function getAdminOverview() {
  return apiRequest('/auth/admin/overview/')
}

export async function getAdminUsers() {
  return apiRequest('/auth/admin/users/')
}

export async function lockUser(userId, data) {
  return apiRequest(`/auth/admin/users/${userId}/lock/`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function unlockUser(userId) {
  return apiRequest(`/auth/admin/users/${userId}/unlock/`, {
    method: 'POST',
  })
}

// Posts endpoints
export async function getAdminPosts(filters = {}) {
  const params = new URLSearchParams()

  if (filters.status) params.append('status', filters.status)
  if (filters.visibility) params.append('visibility', filters.visibility)
  if (filters.source_type) params.append('source_type', filters.source_type)
  if (filters.search) params.append('search', filters.search)
  if (filters.page) params.append('page', filters.page)
  if (filters.page_size) params.append('page_size', filters.page_size)

  const query = params.toString()
  const url = `/content/admin/posts/${query ? '?' + query : ''}`

  return apiRequest(url)
}

export async function getAdminPostDetail(postId) {
  return apiRequest(`/content/admin/posts/${postId}/`)
}

export async function hidePost(postId) {
  return apiRequest(`/content/admin/posts/${postId}/hide/`, {
    method: 'POST',
  })
}

export async function restorePost(postId) {
  return apiRequest(`/content/admin/posts/${postId}/restore/`, {
    method: 'POST',
  })
}

export async function openPost(postId) {
  return restorePost(postId);
}

export async function updateReportStatus(reportId, status) {
  return apiRequest(`/content/admin/reports/${reportId}/status/`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  })
}

export async function lockPostWithReport(postId, reportId) {
  return apiRequest(`/content/admin/posts/${postId}/lock-with-report/`, {
    method: 'POST',
    body: JSON.stringify({ report_id: reportId }),
  })
}

export async function rejectReportWithPublish(postId, reportId) {
  return apiRequest(`/content/admin/posts/${postId}/reject-report/`, {
    method: 'POST',
    body: JSON.stringify({ report_id: reportId }),
  })
}

export async function getAdminSystemNotifications() {
  return apiRequest('/auth/admin/system/notifications/')
}

export async function updateAdminSystemNotifications(payload) {
  return apiRequest('/auth/admin/system/notifications/', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}


