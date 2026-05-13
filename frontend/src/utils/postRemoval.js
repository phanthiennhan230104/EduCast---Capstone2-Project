import { getCanonicalPostIdForEngagement } from './canonicalPostId'

/**
 * Tên sự kiện được phát từ `PodcastContext` (cũng export sẵn `POST_REMOVED_EVENT`).
 * Payload: { postId: string, reason: 'deleted' | 'hidden' }
 */
export const POST_REMOVED_EVENT = 'post-removed'

/**
 * Trả về true nếu `item` (bài gốc hoặc dòng share) tương ứng với bài bị xoá/ẩn.
 * - Bài gốc: so id trực tiếp.
 * - Dòng share id dạng `share_<shareId>_<postId>`: lấy canonical về post id gốc rồi so.
 */
export const matchesRemovedPost = (item, removedPostId) => {
  if (!item || !removedPostId) return false
  const target = String(removedPostId)

  if (String(item.id ?? '') === target) return true
  if (String(item.post_id ?? '') === target) return true
  if (String(item.postId ?? '') === target) return true

  const canonical = getCanonicalPostIdForEngagement(item)
  return canonical != null && String(canonical) === target
}
