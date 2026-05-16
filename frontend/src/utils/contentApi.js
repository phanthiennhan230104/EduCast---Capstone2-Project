import { API_BASE_URL } from '../config/apiBase'
import { apiRequest } from '../utils/api'
import { getToken } from './auth'
import i18n from './i18n'

// Tạo nháp chưa có audio
export const createDraft = async (payload) => {
  return await apiRequest('/content/drafts/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// Tạo audio preview
export const previewAudio = async (payload, signal) => {
  return await apiRequest('/content/drafts/preview-audio/', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal,
    timeoutMs: 120000,
  })
}

// Lưu nháp có audio
export const saveDraftWithAudio = async (payload) => {
  return await apiRequest('/content/drafts/save-with-audio/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// Lấy danh sách nháp
export const getMyDrafts = async () => {
  return await apiRequest('/content/drafts/my/')
}

// Lấy chi tiết 1 nháp
export const getDraftDetail = async (postId) => {
  return await apiRequest(`/content/drafts/${postId}/`)
}

// Cập nhật nháp
export const updateDraft = async (postId, payload) => {
  return await apiRequest(`/content/drafts/${postId}/update/`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

// Xóa nháp
export const deleteDraft = async (postId) => {
  return await apiRequest(`/content/drafts/${postId}/delete/`, {
    method: 'DELETE',
  })
}

// Lưu trữ nháp (chuyển sang trạng thái 'archived')
export const archiveDraft = async (postId) => {
  return await apiRequest(`/content/drafts/${postId}/update/`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'archived' }),
  })
}

// Upload tài liệu để trích xuất text
export const uploadDocument = async (formData) => {
  return await apiRequest('/content/drafts/upload-document/', {
    method: 'POST',
    body: formData,
  })
}

// Lấy topics
export const getTopics = async () => {
  return await apiRequest('/content/topics/')
}

// Lấy tags có sẵn (hỗ trợ tìm kiếm ?q=keyword)
export const getTags = async (q = '') => {
  const query = q ? `?q=${encodeURIComponent(q)}` : ''
  return await apiRequest(`/content/tags/${query}`)
}

// Publish post
export const publishPost = async (payload) => {
  return await apiRequest('/content/posts/publish/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// Upload audio file to cloud
export const uploadAudioFile = async (file) => {
  if (!file) throw new Error(i18n.t('contentApi.fileRequired'))
  
  const formData = new FormData()
  formData.append('audio', file)
  
  const token = getToken()
  
  const res = await fetch(`${API_BASE_URL}/content/upload-audio/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || i18n.t('contentApi.uploadFailed'))
  }

  const data = await res.json()
  
  // Ensure we return the correct URL key
  return {
    audio_url: data.audio_url || data.secure_url || data.url,
    public_id: data.public_id,
    duration: data.duration,
  }
}

// Upload thumbnail image to cloud
export const uploadThumbnail = async (file) => {
  if (!file) throw new Error(i18n.t('contentApi.fileRequired'))
  
  const formData = new FormData()
  formData.append('thumbnail', file)
  
  const token = getToken()
  
  const res = await fetch(`${API_BASE_URL}/content/upload-thumbnail/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || i18n.t('contentApi.uploadFailed'))
  }

  const data = await res.json()
  
  // Ensure we return the correct URL key
  return {
    thumbnail_url: data.thumbnail_url || data.secure_url || data.url,
    public_id: data.public_id,
  }
}