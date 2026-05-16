import Header from '../Header/Header'
import Sidebar from '../Sidebar/Sidebar'
import RightPanel from '../RightPanel/RightPanel'
import AudioPlayer from '../AudioPlayer/AudioPlayer'
import styles from '../../../style/layout/MainLayout.module.css'
import { useCallback, useContext, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { PodcastContext } from '../../contexts/PodcastContext'
import { useAudioPlayer } from '../../contexts/AudioPlayerContext'
import CommentModal from '../../feed/CommentModal'
import { API_BASE_URL } from '../../../config/apiBase'
import { getToken, getCurrentUser } from '../../../utils/auth'
import { getCanonicalPostIdForEngagement } from '../../../utils/canonicalPostId'

const PAGE_HANDLES_OPEN_POST_DETAIL = [
  '/feed',
  '/favorites',
  '/search',
  '/chat',
  '/messages',
]

function mapPostDetail(raw, preview = {}) {
  const author =
    typeof raw.author === 'object' && raw.author
      ? raw.author
      : {
          name:
            raw.author ||
            raw.author_name ||
            raw.author_username ||
            preview.authorDisplayName ||
            preview.authorUsername ||
            'Người dùng',
          username:
            raw.author_username ||
            preview.authorUsername ||
            preview.author_username ||
            '',
          avatar_url:
            raw.author_avatar ||
            raw.author_avatar_url ||
            preview.author_avatar ||
            preview.author_avatar_url ||
            preview.author?.avatar_url ||
            '',
        }

  return {
    id: raw.id,
    postId: raw.id,
    post_id: raw.id,
    title: raw.title,
    description: raw.description || '',
    author,
    author_avatar: author?.avatar_url || '',
    authorUsername: author?.username || '',
    authorId: raw.user_id || raw.author_id || author?.id || '',
    user_id: raw.user_id || raw.author_id || author?.id || '',
    userId: raw.user_id || raw.author_id || author?.id || '',
    cover: raw.thumbnail_url || preview.cover || '',
    thumbnail_url: raw.thumbnail_url || preview.thumbnail_url || preview.cover || '',
    tags: raw.tags || raw.tag_names || raw.tagNames || preview.tags || [],
    audioUrl:
      raw.audio?.audio_url ||
      raw.audio_url ||
      preview.audioUrl ||
      preview.audio_url ||
      '',
    audio_url:
      raw.audio?.audio_url ||
      raw.audio_url ||
      preview.audioUrl ||
      preview.audio_url ||
      '',
    durationSeconds:
      raw.audio?.duration_seconds ||
      raw.duration_seconds ||
      preview.durationSeconds ||
      preview.duration_seconds ||
      0,
    duration_seconds:
      raw.audio?.duration_seconds ||
      raw.duration_seconds ||
      preview.durationSeconds ||
      preview.duration_seconds ||
      0,
    like_count: raw.like_count ?? raw.stats?.likes ?? preview.like_count ?? 0,
    comment_count:
      raw.comment_count ?? raw.stats?.comments ?? preview.comment_count ?? 0,
    share_count: raw.share_count ?? raw.stats?.shares ?? preview.share_count ?? 0,
    save_count: raw.save_count ?? raw.stats?.saves ?? preview.save_count ?? 0,
    is_liked:
      raw.is_liked ??
      raw.viewer_state?.is_liked ??
      preview.is_liked ??
      preview.liked ??
      false,
    is_saved:
      raw.is_saved ??
      raw.viewer_state?.is_saved ??
      preview.is_saved ??
      preview.saved ??
      false,
    saved:
      raw.is_saved ??
      raw.viewer_state?.is_saved ??
      preview.is_saved ??
      preview.saved ??
      false,
    created_at: raw.created_at || preview.created_at,
    timeAgo: raw.timeAgo || preview.timeAgo,
  }
}

export default function MainLayout({
  children,
  rightPanel = true,
  hideGlobalProgress = false,
}) {
  const shouldShowRightPanel =
    rightPanel === true || (rightPanel && rightPanel !== false && rightPanel !== null)
  
  const location = useLocation()
  const { deletedPostIds, hiddenPostIds } = useContext(PodcastContext)
  const { currentTrack, pauseTrackIfDeleted } = useAudioPlayer()
  const [fallbackPostDetail, setFallbackPostDetail] = useState(null)
  const [fallbackLiked, setFallbackLiked] = useState(false)
  const [fallbackSaved, setFallbackSaved] = useState(false)
  const [fallbackLikeCount, setFallbackLikeCount] = useState(0)
  const [fallbackSaveCount, setFallbackSaveCount] = useState(0)
  const [fallbackShareCount, setFallbackShareCount] = useState(0)
  const [fallbackCommentCount, setFallbackCommentCount] = useState(0)
  const scrollStorageKey = `mainScroll:${location.pathname}`
  const shouldUseFallbackPostDetail = !PAGE_HANDLES_OPEN_POST_DETAIL.some((path) =>
    location.pathname.startsWith(path)
  )

  const dispatchPostSync = useCallback((payload) => {
    if (!payload?.postId) return
    try {
      const oldSync = JSON.parse(
        localStorage.getItem(`post-sync-${payload.postId}`) || '{}'
      )
      const nextSync = {
        ...oldSync,
        ...(typeof payload.liked === 'boolean' ? { liked: payload.liked } : {}),
        ...(typeof payload.likeCount === 'number'
          ? { likeCount: payload.likeCount }
          : {}),
        ...(typeof payload.saved === 'boolean' ? { saved: payload.saved } : {}),
        ...(typeof payload.saveCount === 'number'
          ? { saveCount: payload.saveCount }
          : {}),
        ...(typeof payload.commentCount === 'number'
          ? { commentCount: payload.commentCount }
          : {}),
      }
      localStorage.setItem(`post-sync-${payload.postId}`, JSON.stringify(nextSync))
    } catch (err) {
      console.error('MainLayout post sync cache failed:', err)
    }
    window.dispatchEvent(new CustomEvent('post-sync-updated', { detail: payload }))
  }, [])

  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return

    const saveScrollPosition = () => {
      sessionStorage.setItem(scrollStorageKey, String(main.scrollTop || 0))
    }

    // Không gọi save ngay khi mount: lúc đó scroll thường vẫn 0 và sẽ ghi đè
    // giá trị đã lưu (ví dụ quay lại từ /favorites) trước khi Feed khôi phục scroll.
    main.addEventListener('scroll', saveScrollPosition, { passive: true })

    return () => {
      // Không ghi scroll khi unmount: con (Feed, Favorites, …) đã unmount trước,
      // `main` thường trống / scrollTop = 0 và sẽ ghi đè giá trị đúng vừa lưu.
      main.removeEventListener('scroll', saveScrollPosition)
    }
  }, [scrollStorageKey])

  // Pause track if it gets deleted or hidden
  useEffect(() => {
    if (currentTrack?.id) {
      const trackId = String(currentTrack.id)
      const deletedArray = Array.from(deletedPostIds)
      const hiddenArray = Array.from(hiddenPostIds)
      const isDeleted = deletedArray.some(id => String(id) === trackId)
      const isHidden = hiddenArray.some(id => String(id) === trackId)
      
      console.log('🎵 [MainLayout] Effect fired:', {
        trackId,
        currentTrackType: typeof currentTrack?.id,
        deletedCount: deletedArray.length,
        hiddenCount: hiddenArray.length,
        isDeleted,
        isHidden,
        deletedArray,
        hiddenArray
      })
      
      if (isDeleted || isHidden) {
        console.log('🎵 [MainLayout] Detected deleted/hidden, calling pauseTrackIfDeleted')
        pauseTrackIfDeleted(currentTrack.id)
      }
    }
  }, [currentTrack?.id, deletedPostIds, hiddenPostIds, pauseTrackIfDeleted])

  useEffect(() => {
    if (!shouldUseFallbackPostDetail) return

    const handleOpenPostDetail = async (event) => {
      const rowPostId = event.detail?.postId
      if (!rowPostId) return

      const contentPostId =
        event.detail?.canonicalPostId ||
        getCanonicalPostIdForEngagement({
          id: rowPostId,
          postId: rowPostId,
          post_id: rowPostId,
        }) ||
        rowPostId

      if (!contentPostId || String(contentPostId).startsWith('share_')) return

      try {
        const token = getToken()
        const preview = event.detail?.podcastPreview || {}
        const res = await fetch(
          `${API_BASE_URL}/content/posts/${encodeURIComponent(contentPostId)}/`,
          {
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        )
        const json = await res.json()
        const raw = json.data || json
        if (!res.ok || !raw?.id) return

        const detail = mapPostDetail(raw, preview)
        setFallbackPostDetail(detail)
        setFallbackLiked(Boolean(detail.is_liked))
        setFallbackSaved(Boolean(detail.is_saved))
        setFallbackLikeCount(Number(detail.like_count || 0))
        setFallbackSaveCount(Number(detail.save_count || 0))
        setFallbackShareCount(Number(detail.share_count || 0))
        setFallbackCommentCount(Number(detail.comment_count || 0))
      } catch (err) {
        console.error('MainLayout: failed to open post from player', err)
      }
    }

    window.addEventListener('open-post-detail', handleOpenPostDetail)
    return () => {
      window.removeEventListener('open-post-detail', handleOpenPostDetail)
    }
  }, [shouldUseFallbackPostDetail])

  const handleFallbackClosePostDetail = useCallback(() => {
    setFallbackPostDetail(null)
  }, [])

  const handleFallbackToggleLike = useCallback(async (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (!fallbackPostDetail?.id) return null

    const postId = getCanonicalPostIdForEngagement(fallbackPostDetail)
    if (!postId) return null

    const token = getToken()
    const currentUser = getCurrentUser()
    const res = await fetch(
      `${API_BASE_URL}/social/posts/${encodeURIComponent(postId)}/like/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ user_id: currentUser?.id }),
      }
    )
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message || `HTTP ${res.status}`)
    }

    const nextLiked = Boolean(data.data?.liked)
    const nextLikeCount = Number(data.data?.like_count || 0)
    setFallbackLiked(nextLiked)
    setFallbackLikeCount(nextLikeCount)
    setFallbackPostDetail((prev) =>
      prev
        ? {
            ...prev,
            is_liked: nextLiked,
            like_count: nextLikeCount,
          }
        : prev
    )
    dispatchPostSync({
      postId,
      liked: nextLiked,
      likeCount: nextLikeCount,
    })
    return { liked: nextLiked, likeCount: nextLikeCount }
  }, [dispatchPostSync, fallbackPostDetail])

  const handleFallbackToggleSave = useCallback(async (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (!fallbackPostDetail?.id) return null

    const postId = getCanonicalPostIdForEngagement(fallbackPostDetail)
    if (!postId) return null

    const token = getToken()
    const currentUser = getCurrentUser()
    const res = await fetch(
      `${API_BASE_URL}/social/posts/${encodeURIComponent(postId)}/save/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ user_id: currentUser?.id }),
      }
    )
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message || `HTTP ${res.status}`)
    }

    const nextSaved = Boolean(data.data?.saved)
    const nextSaveCount = Number(data.data?.save_count || 0)
    setFallbackSaved(nextSaved)
    setFallbackSaveCount(nextSaveCount)
    setFallbackPostDetail((prev) =>
      prev
        ? {
            ...prev,
            is_saved: nextSaved,
            saved: nextSaved,
            save_count: nextSaveCount,
          }
        : prev
    )
    dispatchPostSync({
      postId,
      saved: nextSaved,
      saveCount: nextSaveCount,
    })
    return { saved: nextSaved, saveCount: nextSaveCount }
  }, [dispatchPostSync, fallbackPostDetail])

  return (
    <div className={styles.layout}>
      <Header hideGlobalProgress={hideGlobalProgress} />
      <Sidebar />

      <main className={`${styles.main} ${!shouldShowRightPanel ? styles.mainExpanded : ''}`}>
        {children}
      </main>

      {shouldShowRightPanel && (rightPanel === true ? <RightPanel /> : rightPanel)}
      {!hideGlobalProgress && <AudioPlayer />}
      {fallbackPostDetail && (
        <CommentModal
          podcast={fallbackPostDetail}
          liked={fallbackLiked}
          saved={fallbackSaved}
          likeCount={fallbackLikeCount}
          shareCount={fallbackShareCount}
          saveCount={fallbackSaveCount}
          commentCount={fallbackCommentCount}
          disableAutoScroll={true}
          onClose={handleFallbackClosePostDetail}
          onCommentCountChange={(nextCount) => {
            setFallbackCommentCount(nextCount)
            const postId = getCanonicalPostIdForEngagement(fallbackPostDetail)
            if (postId) {
              dispatchPostSync({ postId, commentCount: nextCount })
            }
          }}
          onToggleLike={handleFallbackToggleLike}
          onToggleSave={handleFallbackToggleSave}
          onPostDeleted={handleFallbackClosePostDetail}
        />
      )}
    </div>
  )
}
