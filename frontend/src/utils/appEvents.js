/** Sau khi chia sẻ về trang cá nhân — Feed (đang mount) refetch; Personal refetch */
export const EDUCAST_PERSONAL_SHARE_SUCCESS = 'educast-personal-share-success'

const SS_FEED_RELOAD_AFTER_PERSONAL_SHARE = 'educastFeedReloadAfterPersonalShare'
const SS_SCROLL_FEED_TOP_AFTER_PERSONAL_SHARE = 'educastScrollFeedTopAfterPersonalShare'

/** Khi không ở /feed, Feed chưa mount — lưu cờ để lần vào /feed refetch + (tuỳ) cuộn đầu trang. */
export function markPersonalSharePendingFeedRefresh({ scrollToTop = true } = {}) {
  try {
    sessionStorage.setItem(SS_FEED_RELOAD_AFTER_PERSONAL_SHARE, '1')
    if (scrollToTop) {
      sessionStorage.setItem(SS_SCROLL_FEED_TOP_AFTER_PERSONAL_SHARE, '1')
    } else {
      sessionStorage.removeItem(SS_SCROLL_FEED_TOP_AFTER_PERSONAL_SHARE)
    }
  } catch (_) {}
}

/** Đọc và xóa cờ pending (dùng khi Feed mount sau khi share ngoài /feed). */
export function consumePendingFeedReloadFromPersonalShare() {
  try {
    if (sessionStorage.getItem(SS_FEED_RELOAD_AFTER_PERSONAL_SHARE) !== '1') {
      return { reload: false, scrollToTop: false }
    }
    sessionStorage.removeItem(SS_FEED_RELOAD_AFTER_PERSONAL_SHARE)
    const scrollToTop =
      sessionStorage.getItem(SS_SCROLL_FEED_TOP_AFTER_PERSONAL_SHARE) === '1'
    sessionStorage.removeItem(SS_SCROLL_FEED_TOP_AFTER_PERSONAL_SHARE)
    return { reload: true, scrollToTop }
  } catch (_) {
    return { reload: false, scrollToTop: false }
  }
}
