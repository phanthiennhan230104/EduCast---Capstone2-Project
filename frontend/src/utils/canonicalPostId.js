/**
 * ID dùng cho like/lưu/post-sync bài gốc (giống engagementPostId ở Feed, post_id trong feed item).
 * Với bài share, `id` là `share_<shareId>_<postId>`; hàm này trả về ULID bài gốc.
 */
export function getCanonicalPostIdForEngagement(entity) {
  if (!entity) return null
  if (entity.post_id != null && entity.post_id !== '') {
    return String(entity.post_id)
  }
  if (entity.postId != null && entity.postId !== '') {
    const s = String(entity.postId)
    if (!s.startsWith('share_')) return s
  }
  if (entity.id != null) {
    const s = String(entity.id)
    if (s.startsWith('share_')) {
      const parts = s.split('_')
      if (parts.length >= 3) return parts[parts.length - 1]
    }
    return s
  }
  return null
}
