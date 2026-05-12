/** Đồng bộ với Feed.jsx — lưu scroll `main` để quay lại từ trang chỉnh sửa hoặc giữ vị trí khi xóa dòng. */
export const FEED_MAIN_SCROLL_SESSION_KEY = 'educast:feedMainScrollPosition'
export const FEED_SCROLL_LEGACY_KEY = 'mainScroll:/feed'

export function readMainScrollTop() {
  const main = document.querySelector('main')
  return main?.scrollTop ?? 0
}

export function writeFeedScrollSessionKeys(y) {
  const s = String(y)
  sessionStorage.setItem(FEED_MAIN_SCROLL_SESSION_KEY, s)
  sessionStorage.setItem(FEED_SCROLL_LEGACY_KEY, s)
}

/**
 * Trước khi navigate sang /edit/... — lưu scroll + cờ returnFromEdit + returnToAfterEdit.
 * Ghi cả `feedScrollPosition` và hai key session Feed dùng để restore (tránh nhảy top).
 */
export function saveScrollAndMarkReturnFromEdit(options = {}) {
  const y = readMainScrollTop()
  sessionStorage.setItem(
    'returnToAfterEdit',
    window.location.pathname + window.location.search
  )
  sessionStorage.setItem('feedScrollPosition', String(y))
  writeFeedScrollSessionKeys(y)
  sessionStorage.setItem('returnFromEdit', 'true')
  if (options.editFocusPostId != null && options.editFocusPostId !== '') {
    sessionStorage.setItem('editFocusPostId', String(options.editFocusPostId))
  }
}

/**
 * Gọi setState xóa/gỡ dòng feed rồi khôi phục scroll — bài dưới đẩy lên, không kéo về đầu trang.
 * Ghi session scroll trước khi setState để useLayoutEffect restore trong Feed không đọc nhầm 0/cũ.
 */
export function preserveMainScrollAfterListUpdate(setStateFn) {
  const y = readMainScrollTop()
  writeFeedScrollSessionKeys(y)
  setStateFn()
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const main = document.querySelector('main')
      if (!main) return
      const maxY = Math.max(0, main.scrollHeight - main.clientHeight)
      const next = Math.min(y, maxY)
      main.scrollTop = next
      main.scrollTo({ top: next, behavior: 'auto' })
      writeFeedScrollSessionKeys(next)
    })
  })
}
