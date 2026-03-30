import { apiRequest } from '../utils/api'

// Tạo nháp chưa có audio
export const createDraft = async (payload) => {
  return await apiRequest('/content/drafts/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// Tạo audio preview
export const previewAudio = async (payload) => {
  return await apiRequest('/content/drafts/preview-audio/', {
    method: 'POST',
    body: JSON.stringify(payload),
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

// Upload tài liệu để trích xuất text
export const uploadDocument = async (formData) => {
  return await apiRequest('/content/drafts/upload-document/', {
    method: 'POST',
    body: formData,
  })
}