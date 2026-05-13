import { useMemo, useState, useEffect, useContext, useRef, useCallback } from 'react'
import {
  MapPin,
  BookMarked,
  Headphones,
  Clock3,
  StickyNote,
  ChevronRight,
  LayoutGrid,
  Rows3,
  Pin,
  MessageSquareText,
  CheckCircle2,
  PlayCircle,
  Play,
  Pause,
  Loader,
  MoreHorizontal,
  Edit,
  Trash2,
  EyeOff,

} from 'lucide-react'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import styles from '../../style/library/FavoritesContent.module.css'
import { getToken, getCurrentUser } from '../../utils/auth'
import { getCanonicalPostIdForEngagement } from '../../utils/canonicalPostId'
import { API_BASE_URL } from '../../config/apiBase'
import { PodcastContext } from '../contexts/PodcastContext'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { POST_REMOVED_EVENT, matchesRemovedPost } from '../../utils/postRemoval'
import NotesModal from './NotesModal'
import AllPostsModal from './AllPostsModal'
import CommentModal from '../feed/CommentModal'
import EditPostModal from '../feed/EditPostModal'
import ConfirmModal from '../feed/ConfirmModal'

const COLLECTIONS = [
  { id: 1, name: 'AI cơ bản', count: 6 },
  { id: 2, name: 'Tâm lý học', count: 4 },
  { id: 3, name: 'IELTS', count: 5 },
  { id: 4, name: 'Tài chính cá nhân', count: 3 },
]


function getListenLabel(percent, t) {
  if (percent >= 100) return t('library.content.listenDone')
  if (percent <= 0) return t('library.content.listenNotStarted')
  return t('library.content.listenedPercent', { percent })
}

function formatTime(seconds) {
  const total = Math.floor(Number(seconds || 0))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function SavedCard({ item, viewMode, onToggleSaved, onOpenNotes, onOpenDetail }) {
  const { t } = useTranslation()
  const {
    playTrack,
    currentTrack,
    playing,
    togglePlay,
    currentTime,
    duration,
    trackProgressMap,
    seekToPercent,
    isSeeking,
  } = useAudioPlayer()

  const progressBarRef = useRef(null)
  const draggingRef = useRef(false)
  const menuRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const handlePlayClick = () => {
    if (!item.audioUrl) {
      alert(t('library.content.noAudioAlert'))
      return
    }

    if (currentTrack?.id === item.id) {
      togglePlay()
      return
    }

    playTrack({
      id: item.id,
      postId: item.id,
      title: item.title,
      author: authorName,
      audioUrl: item.audioUrl,
      durationSeconds: item.durationSeconds,
      thumbnail_url: item.thumbnail_url,
      liked: item.is_liked,
      saved: item.saved,
    })
  }

  const handleProgressBarClick = (e) => {
    const safeDuration = Number(item.durationSeconds) || 0
    if (safeDuration <= 0) return

    const barRect = progressBarRef.current?.getBoundingClientRect()
    if (!barRect) return


    const clickX = e.clientX - barRect.left
    const percentage = Math.max(
      0,
      Math.min(100, (clickX / barRect.width) * 100)
    )

    if (currentTrack?.id === item.id) {
      seekToPercent(percentage)
    } else {
      playTrack({
        id: item.id,
        postId: item.id,
        title: item.title,
        author: authorName,
        audioUrl: item.audioUrl,
        durationSeconds: item.durationSeconds,
        thumbnail_url: item.thumbnail_url,
        liked: item.is_liked,
        saved: item.saved,
      })

      setTimeout(() => {
        seekToPercent(percentage)
      }, 150)
    }
  }

  const handlePointerMove = (clientX) => {
    const safeDuration = Number(item.durationSeconds) || 0
    if (safeDuration <= 0) return
    const barRect = progressBarRef.current?.getBoundingClientRect()
    if (!barRect) return

    const clickX = clientX - barRect.left
    const percentage = Math.max(0, Math.min(100, (clickX / barRect.width) * 100))

    if (currentTrack?.id === item.id) {
      seekToPercent(percentage)
    }
  }

  const handlePointerDown = (e) => {
    e.stopPropagation()
    draggingRef.current = true
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    handlePointerMove(clientX)

    const onMove = (ev) => handlePointerMove(ev.touches ? ev.touches[0].clientX : ev.clientX)
    const onUp = () => {
      draggingRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchend', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchmove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchend', onUp)
  }

  const isCurrentTrack = currentTrack?.id === item.id
  const isCurrentPlaying = isCurrentTrack && playing

  const savedProgress = trackProgressMap?.[item.id]

  const safeDuration = Number(
    isCurrentTrack
      ? duration || item.durationSeconds
      : savedProgress?.duration || item.durationSeconds
  ) || 0

  const safeCurrentTime = Number(
    isCurrentTrack
      ? currentTime
      : savedProgress?.currentTime || 0
  ) || 0

  const displayProgress = Math.min(
    100,
    Math.max(
      0,
      isCurrentTrack
        ? safeDuration > 0
          ? (safeCurrentTime / safeDuration) * 100
          : 0
        : Number(savedProgress?.progressPercent || 0)
    )
  )

  const displayDuration = formatTime(safeDuration)
  const authorName =
    typeof item.author === 'object'
      ? item.author?.name || item.author?.username || 'Người dùng'
      : item.author || 'Người dùng'
  return (
    <article className={`${styles.savedCard} ${viewMode === 'list' ? styles.savedCardList : ''}`}>
      <div className={styles.savedTop}>
        {item.pinned ? (
          <span className={styles.savedBadge}>
            <Pin size={11} />
            {t('library.content.pinned')}
          </span>
        ) : (
          <span />
        )}

        <div className={styles.savedMenuWrap} ref={menuRef}>
          <button
            type="button"
            className={styles.savedMoreBtn}
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((prev) => !prev)
            }}
            aria-label="Tùy chọn"
          >
            <MoreHorizontal size={16} />
          </button>

          {menuOpen && (
            <div className={styles.savedDropdown}>
              {isOwner ? (
                <>
                  <button
                    type="button"
                    className={styles.savedDropdownItem}
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpen(false)
                      onEdit?.(item)
                    }}
                  >
                    <Edit size={14} />
                    <span>Chỉnh sửa</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.savedDropdownItem} ${styles.savedDropdownItemDanger}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpen(false)
                      onDelete?.(item)
                    }}
                  >
                    <Trash2 size={14} />
                    <span>Xóa</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.savedDropdownItem}
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen(false)
                    onHide?.(item)
                  }}
                >
                  <EyeOff size={14} />
                  <span>Ẩn bài viết</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.savedBody} onClick={() => onOpenDetail(item)}>
        <div className={styles.savedMain} style={{ cursor: 'pointer' }}>
          <h4 className={styles.savedTitle}>{item.title}</h4>

          <p className={styles.savedMeta}>
            {authorName} · {item.listens}
          </p>

          <div className={styles.tagsContainer}>
            {item.tags && item.tags.length > 0 && (
              <p className={styles.tags}>
                {item.tags.slice(0, 2).map((tag, idx) => (
                  <span key={idx} className={styles.tag}>
                    {tag}
                  </span>
                ))}

                {item.tags.length > 2 && (
                  <span className={styles.tag}>
                    +{item.tags.length - 2}
                  </span>
                )}
              </p>
            )}
          </div>

          <div className={styles.player}>
            <button
              className={`${styles.playBtn} ${isCurrentPlaying ? styles.playing : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                handlePlayClick()
              }}
              type="button"
              disabled={!item.audioUrl}
              aria-label={isCurrentPlaying ? t('buttons.pause') : t('buttons.play')}
              title={!item.audioUrl ? t('library.content.noAudioTitle') : ''}
            >
              {isCurrentPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>

            <div className={styles.progressSection}>
              <span className={styles.time}>
                {formatTime(safeCurrentTime)}
              </span>

              <div
                className={styles.progressBar}
                ref={progressBarRef}
                onClick={(e) => {
                  e.stopPropagation()
                  handleProgressBarClick(e)
                }}
                onMouseDown={handlePointerDown}
                onTouchStart={handlePointerDown}
                role="progressbar"
                tabIndex={0}
                aria-label="Seek bar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(displayProgress)}
              >
                <div
                  className={styles.progressFill}
                  style={{ width: `${displayProgress}%` }}
                />

                {isCurrentTrack && isSeeking && (
                  <div className={styles.seekingIndicator}>
                    <Loader size={14} />
                  </div>
                )}
              </div>

              <span className={styles.time}>
                {displayDuration}
              </span>
            </div>
          </div>

          <div className={styles.savedFooter}>
            <button
              type="button"
              className={`${styles.metaPill} ${styles.metaPillInfo}`}
            >
              {item.listenedPercent >= 100 ? (
                <CheckCircle2 size={14} />
              ) : (
                <PlayCircle size={14} />
              )}

              <span>{getListenLabel(item.listenedPercent, t)}</span>
            </button>

            <button
              type="button"
              className={`${styles.metaPill} ${item.hasNote ? styles.metaPillNoted : styles.metaPillMuted
                }`}
              onClick={(e) => {
                e.stopPropagation()
                onOpenNotes(item)
              }}
            >
              <MessageSquareText size={14} />
              <span>{t('library.content.notes')}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function FavoritesContent() {
  const { t } = useTranslation()
  console.log('🎵 FavoritesContent RENDER')
  const [viewMode, setViewMode] = useState('grid')
  const [podcasts, setPodcasts] = useState([])
  const [collections, setCollections] = useState([])
  const [showAllCollections, setShowAllCollections] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState(null)
  const [collectionPosts, setCollectionPosts] = useState([])
  const [loadingCollections, setLoadingCollections] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')
  const [notesModalOpen, setNotesModalOpen] = useState(false)
  const [selectedPostForNotes, setSelectedPostForNotes] = useState(null)
  const [showAllPostsModal, setShowAllPostsModal] = useState(false)
  const [showPostDetail, setShowPostDetail] = useState(false)
  const [selectedPostDetail, setSelectedPostDetail] = useState(null)
  const [likeCount, setLikeCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(true)
  const [editPostModalOpen, setEditPostModalOpen] = useState(false)
  const [editingPostId, setEditingPostId] = useState(null)
  const [deletePostConfirmOpen, setDeletePostConfirmOpen] = useState(false)
  const [deletingPost, setDeletingPost] = useState(null)
  const [isDeletingPost, setIsDeletingPost] = useState(false)
  const [hidePostConfirmOpen, setHidePostConfirmOpen] = useState(false)
  const [hidingPost, setHidingPost] = useState(null)
  const [isHidingPost, setIsHidingPost] = useState(false)
  const currentUser = getCurrentUser()
  const POST_SYNC_EVENT = 'post-sync-updated'

  const computeIsOwner = useCallback((post) => {
    if (!post) return false
    if (post.isOwner === true || post.is_owner === true) return true
    const candidateIds = [
      post.author_id,
      post.authorId,
      post.user_id,
      post.userId,
      post.author?.id,
    ].filter((id) => id != null && id !== '')
    return candidateIds.some(
      (id) => String(id) === String(currentUser?.id ?? '')
    )
  }, [currentUser?.id])

  const { pauseTrackIfDeleted } = useAudioPlayer()

  const dispatchPostSync = (payload) => {
    if (payload?.postId) {
      const oldSync = JSON.parse(localStorage.getItem(`post-sync-${payload.postId}`) || '{}')
      const nextSync = { ...oldSync, ...payload }
      localStorage.setItem(`post-sync-${payload.postId}`, JSON.stringify(nextSync))
    }

    window.dispatchEvent(new CustomEvent(POST_SYNC_EVENT, { detail: payload }))
  }

  const { removeSavedPost, hidePost, deletePost, isPostHidden, isPostDeleted, hiddenPostIds, deletedPostIds, deletedPostsVersion, hiddenPostsVersion } = useContext(PodcastContext)

  const fetchCollections = useCallback(async () => {
    console.log('🎯 fetchCollections called')
    try {
      const token = getToken()
      console.log('🔑 Token:', token ? `${token.substring(0, 20)}...` : 'NOT FOUND')
      console.log('📡 Fetching /api/social/collections/')

      const response = await fetch('http://127.0.0.1:8000/api/social/collections/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      console.log('📊 Response Status:', response.status)

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()

      console.log('✅ Collections fetched:', data.data?.collections?.length || 0)

      if (data.success && data.data.collections) {
        setCollections(data.data.collections)
      } else {
        console.warn('⚠️ Empty collections response')
      }
    } catch (err) {
      console.error('❌ Failed to fetch collections:', err)
      setCollections([])
    }
  }, [])

  const fetchCollectionPosts = useCallback(async (collectionId) => {
    try {
      setLoadingCollections(true)
      const token = getToken()
      // Fetch từ bảng collection_items để get posts của collection
      const response = await fetch(`http://127.0.0.1:8000/api/social/collections/${collectionId}/posts/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()

      if (data.success && data.data.posts) {
        // Transform posts
        const transformedPosts = data.data.posts.map(post => ({
          id: post.id,
          pinned: false,
          title: post.title,
          author:
            typeof post.author === 'object'
              ? post.author
              : {
                name: post.author || 'Người dùng',
                username: post.author_username || '',
                avatar_url: post.author_avatar || '',
              },

          author_avatar:
            post.author?.avatar_url ||
            post.author_avatar ||
            '',

          authorUsername:
            post.author?.username ||
            post.author_username ||
            '',
          authorId: post.user_id,
          author_id: post.user_id,
          user_id: post.user_id,
          userId: post.user_id,
          isOwner: post.is_owner || false,
          topic: post.tags && post.tags.length > 0 ? post.tags[0] : t('library.content.general'),
          tags: post.tags || [],
          like_count: post.like_count || 0,
          comment_count: post.comment_count || 0,
          share_count: post.share_count || 0,
          is_liked: post.is_liked || false,
          listens: t('library.content.listens', {
            count: post.listen_count
              ? post.listen_count >= 1000
                ? `${Math.floor(post.listen_count / 1000)}k`
                : post.listen_count
              : 0,
          }),
          duration: post.duration_seconds
            ? `${Math.floor(post.duration_seconds / 60)}:${String(post.duration_seconds % 60).padStart(2, '0')}`
            : '0:00',
          durationSeconds: post.duration_seconds || 0,
          description: post.description,
          noteCount: post.has_note ? 1 : 0,
          hasNote: post.has_note || false,
          saved: true,
          listenedPercent: post.playback_history?.completed_ratio
            ? Math.round(post.playback_history.completed_ratio * 100)
            : 0,
          audioUrl: post.audio_url || '',
          thumbnail_url: post.thumbnail_url || '',
          created_at: post.created_at,
          timeAgo: post.timeAgo,
        }))
        setCollectionPosts(transformedPosts)
        setShowAllPostsModal(true)
      }
    } catch (err) {
      console.error('Failed to fetch collection posts:', err)
      setCollectionPosts([])
    } finally {
      setLoadingCollections(false)
    }
  }, [t])

  const handleCollectionClick = useCallback((collection) => {
    setSelectedCollection(collection)
    fetchCollectionPosts(collection.id)
  }, [fetchCollectionPosts])

  const fetchSavedPosts = useCallback(async () => {
    try {
      setLoading(true)
      const token = getToken()
      const response = await fetch('http://127.0.0.1:8000/api/social/saved-posts/my/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.data.saved_posts) {
        // Transform API data to match UI format
        const transformedPodcasts = data.data.saved_posts.map(post => {
          // Get listen percentage from playback history if available
          const listenedPercent = post.playback_history?.completed_ratio
            ? Math.round(post.playback_history.completed_ratio * 100)
            : 0

          return {
            id: post.id,
            pinned: false,
            title: post.title,
            author:
              typeof post.author === 'object'
                ? post.author
                : {
                  name: post.author || 'Người dùng',
                  username: post.author_username || '',
                  avatar_url: post.author_avatar || '',
                },

            author_avatar:
              post.author?.avatar_url ||
              post.author_avatar ||
              '',

            authorUsername:
              post.author?.username ||
              post.author_username ||
              '',
            authorId: post.user_id,
            author_id: post.user_id,
            user_id: post.user_id,
            userId: post.user_id,
            isOwner: post.is_owner || false,
            topic: post.tags && post.tags.length > 0 ? post.tags[0] : t('library.content.general'),
            tags: post.tags || [],
            like_count: post.like_count || 0,
            comment_count: post.comment_count || 0,
            share_count: post.share_count || 0,
            is_liked: post.is_liked || false,
            listens: t('library.content.listens', {
              count: post.listen_count
                ? post.listen_count >= 1000
                  ? `${Math.floor(post.listen_count / 1000)}k`
                  : post.listen_count
                : 0,
            }),
            duration: post.duration_seconds
              ? `${Math.floor(post.duration_seconds / 60)}:${String(post.duration_seconds % 60).padStart(2, '0')}`
              : '0:00',
            durationSeconds: post.duration_seconds || 0,
            description: post.description,
            noteCount: post.has_note ? 1 : 0,
            hasNote: post.has_note || false,
            saved: true,
            listenedPercent,
            audioUrl: post.audio_url || '',
            thumbnail_url: post.thumbnail_url || '',
            created_at: post.created_at,
            timeAgo: post.timeAgo,
          }
        })

        setPodcasts(transformedPodcasts)
      }
    } catch (err) {
      console.error('Failed to fetch saved posts:', err)
      setPodcasts([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    const handlePostSync = (event) => {
      const d = event.detail || {}
      if (!d.postId) return

      setPodcasts(prev =>
        prev.map(item =>
          String(item.id) === String(d.postId)
            ? {
              ...item,
              is_liked: typeof d.liked === 'boolean' ? d.liked : item.is_liked,
              like_count: typeof d.likeCount === 'number' ? d.likeCount : item.like_count,
              saved: typeof d.saved === 'boolean' ? d.saved : item.saved,
              ...(typeof d.title === 'string' ? { title: d.title } : {}),
              ...(typeof d.description === 'string'
                ? { description: d.description }
                : {}),
            }
            : item
        )
      )

      setSelectedPostDetail(prev =>
        prev && String(prev.id) === String(d.postId)
          ? {
            ...prev,
            is_liked: typeof d.liked === 'boolean' ? d.liked : prev.is_liked,
            like_count: typeof d.likeCount === 'number' ? d.likeCount : prev.like_count,
            saved: typeof d.saved === 'boolean' ? d.saved : prev.saved,
            ...(typeof d.title === 'string' ? { title: d.title } : {}),
            ...(typeof d.description === 'string'
              ? { description: d.description }
              : {}),
          }
          : prev
      )

      if (selectedPostDetail && String(selectedPostDetail.id) === String(d.postId)) {
        if (typeof d.liked === 'boolean') setLiked(d.liked)
        if (typeof d.likeCount === 'number') setLikeCount(d.likeCount)
        if (typeof d.saved === 'boolean') setSaved(d.saved)
      }
    }

    window.addEventListener(POST_SYNC_EVENT, handlePostSync)
    return () => window.removeEventListener(POST_SYNC_EVENT, handlePostSync)
  }, [selectedPostDetail])

  // Đồng bộ liên trang khi 1 bài bị xoá/ẩn ở nơi khác.
  useEffect(() => {
    const handleRemoved = (event) => {
      const removedId = event.detail?.postId
      if (!removedId) return
      setPodcasts((prev) => prev.filter((item) => !matchesRemovedPost(item, removedId)))
      setCollectionPosts((prev) =>
        prev.filter((item) => !matchesRemovedPost(item, removedId))
      )
      setSelectedPostDetail((prev) =>
        prev && matchesRemovedPost(prev, removedId) ? null : prev
      )
    }
    window.addEventListener(POST_REMOVED_EVENT, handleRemoved)
    return () => window.removeEventListener(POST_REMOVED_EVENT, handleRemoved)
  }, [])

  // Fetch danh sách saved posts và collections từ API khi component mount
  useEffect(() => {
    console.log('🔥 MOUNT EFFECT: Calling fetchSavedPosts and fetchCollections')
    fetchSavedPosts()
    fetchCollections()
  }, [fetchSavedPosts, fetchCollections])

  useEffect(() => {
    if (loading || podcasts.length === 0) return
    if (sessionStorage.getItem('returnFromEdit') !== 'true') return

    const openPostId = sessionStorage.getItem('openPostDetailId')
    if (!openPostId) return

    const post = podcasts.find(p => String(p.id) === String(openPostId))
    if (!post) return

    handleOpenPostDetail(post)

    sessionStorage.removeItem('returnFromEdit')
    sessionStorage.removeItem('returnToAfterEdit')
    sessionStorage.removeItem('openPostDetailId')
    sessionStorage.removeItem('openPostDetailNoScroll')
  }, [loading, podcasts])

  const decreaseCollectionCountByPostId = useCallback((postId) => {
    setCollections(prev =>
      prev.map(collection => {
        const hasPost =
          collection.post_ids?.some(id => String(id) === String(postId)) ||
          collection.posts?.some(post => String(post.id) === String(postId))

        if (!hasPost) return collection

        return {
          ...collection,
          post_count: Math.max((collection.post_count || 0) - 1, 0),
        }
      })
    )
  }, [])

  const toggleSaved = useCallback(async id => {
    console.log('🎁 [Favorites] toggleSaved called:', { id, type: typeof id })
    const removedItem = podcasts.find(item => item.id === id)
    console.log('🎁 [Favorites] Calling pauseTrackIfDeleted')
    pauseTrackIfDeleted(id)
    console.log('🎁 [Favorites] Calling removeSavedPost')
    setPodcasts(prev => {
      const filtered = prev.filter(item => item.id !== id)
      console.log('🎁 [Favorites] UI updated (toggleSaved):', prev.length, '->', filtered.length)
      return filtered
    })

    removeSavedPost(id)
    decreaseCollectionCountByPostId(id)

    try {
      const token = getToken()
      const response = await fetch(`http://127.0.0.1:8000/api/social/posts/${id}/save/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        fetchCollections()

        dispatchPostSync({
          postId: id,
          saved: false,
          saveCount: Number(data.data?.save_count || 0),
        })
      } else {
        throw new Error(data.message || t('library.content.unsaveFailed'))
      }
    } catch (err) {
      console.error('❌ API error:', err)
      toast.error(err.message || t('library.content.unsavePostFailed'))
      if (removedItem) {
        setPodcasts(prev => [...prev, removedItem])
      }
    }
  }, [podcasts, removeSavedPost, decreaseCollectionCountByPostId, fetchCollections, t])

  const handleOpenNotes = (post) => {
    setSelectedPostForNotes(post)
    setNotesModalOpen(true)
  }

  const handleOpenPostDetail = (post) => {
    setSelectedPostDetail(post)
    setLikeCount(post.like_count || post.likes || 0)
    setCommentCount(post.comment_count || post.comments || 0)
    setLiked(post.is_liked || post.liked || false)

    setSaved(Boolean(
      post.saved ??
      post.is_saved ??
      post.viewer_state?.is_saved ??
      false
    ))

    setShowPostDetail(true)
  }

  const handleSelectPostFromAllModal = (post) => {
    setShowAllPostsModal(false)
    handleOpenPostDetail(post)
  }

  const handleToggleLike = async () => {
    try {
      const token = getToken()
      const response = await fetch(`http://127.0.0.1:8000/api/social/posts/${selectedPostDetail?.id}/like/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()

      if (data.success) {
        const nextLiked = Boolean(data.data?.liked)
        const nextLikeCount = Number(data.data?.like_count || 0)

        setLiked(nextLiked)
        setLikeCount(nextLikeCount)

        setPodcasts(prev =>
          prev.map(item =>
            String(item.id) === String(selectedPostDetail?.id)
              ? { ...item, is_liked: nextLiked, like_count: nextLikeCount }
              : item
          )
        )

        dispatchPostSync({
          postId: selectedPostDetail.id,
          liked: nextLiked,
          likeCount: nextLikeCount,
        })
      }
    } catch (err) {
      console.error('Failed to toggle like:', err)
    }
  }

  const handleToggleSave = async () => {
    const removedItem = podcasts.find(item => item.id === selectedPostDetail?.id)

    try {
      const token = getToken()

      setPodcasts(prev => prev.filter(item => item.id !== selectedPostDetail?.id))
      removeSavedPost(selectedPostDetail?.id)
      decreaseCollectionCountByPostId(selectedPostDetail?.id)

      const response = await fetch(`http://127.0.0.1:8000/api/social/posts/${selectedPostDetail?.id}/save/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      if (data.success) {
        const nextSaved = Boolean(data.data?.saved)
        const nextSaveCount = Number(data.data?.save_count || 0)

        setSaved(nextSaved)
        fetchCollections()

        dispatchPostSync({
          postId: selectedPostDetail.id,
          saved: nextSaved,
          saveCount: nextSaveCount,
        })
      } else {
        throw new Error(t('library.content.unsaveFailed'))
      }
    } catch (err) {
      console.error('Failed to toggle save:', err)
      toast.error(t('library.content.unsavePostFailed'))
      // Restore if API fails
      if (removedItem) {
        setPodcasts(prev => [...prev, removedItem])
      }
    }
  }

  const handleShare = async () => {
    try {
      console.log('Share post:', selectedPostDetail?.id)
    } catch (err) {
      console.error('Failed to share:', err)
    }
  }

  const handlePostDeleted = (postId) => {
    const id = postId || selectedPostDetail?.id
    console.log('🎁 [Favorites] handlePostDeleted called:', { id, type: typeof id })

    if (id) {
      console.log('🎁 [Favorites] Calling pauseTrackIfDeleted')
      pauseTrackIfDeleted(id)
      console.log('🎁 [Favorites] Calling deletePost')
      deletePost(id)
      console.log('🎁 [Favorites] Calling removeSavedPost')
      removeSavedPost(id)

      setPodcasts(prev => {
        const filtered = prev.filter(item => String(item.id) !== String(id))
        console.log('🎁 [Favorites] Filtered podcasts:', prev.length, '->', filtered.length)
        return filtered
      })

      setCollectionPosts(prev =>
        prev.filter(item => String(item.id) !== String(id))
      )

      fetchCollections()
    }

    setShowPostDetail(false)
    setSelectedPostDetail(null)
  }

  const handleEditPost = useCallback((post) => {
    const postId =
      getCanonicalPostIdForEngagement(post) || String(post?.id ?? '')
    if (!postId) return
    setEditingPostId(postId)
    setEditPostModalOpen(true)
  }, [])

  const handlePostEdited = useCallback((next) => {
    if (!editingPostId || !next) return
    setPodcasts((prev) =>
      prev.map((item) =>
        String(item.id) === String(editingPostId)
          ? {
              ...item,
              ...(typeof next.title === 'string' ? { title: next.title } : {}),
              ...(typeof next.description === 'string'
                ? { description: next.description }
                : {}),
            }
          : item
      )
    )
    setCollectionPosts((prev) =>
      prev.map((item) =>
        String(item.id) === String(editingPostId)
          ? {
              ...item,
              ...(typeof next.title === 'string' ? { title: next.title } : {}),
              ...(typeof next.description === 'string'
                ? { description: next.description }
                : {}),
            }
          : item
      )
    )
    window.dispatchEvent(
      new CustomEvent(POST_SYNC_EVENT, {
        detail: {
          postId: editingPostId,
          title: next.title,
          description: next.description,
        },
      })
    )
  }, [editingPostId])

  const handleRequestDeletePost = useCallback((post) => {
    if (!post?.id) return
    setDeletingPost(post)
    setDeletePostConfirmOpen(true)
  }, [])

  const handleRequestHidePost = useCallback((post) => {
    if (!post?.id) return
    setHidingPost(post)
    setHidePostConfirmOpen(true)
  }, [])

  const handleConfirmHidePost = useCallback(async () => {
    if (!hidingPost) return
    const postId =
      getCanonicalPostIdForEngagement(hidingPost) ||
      String(hidingPost?.id ?? '')
    if (!postId) return

    try {
      setIsHidingPost(true)
      const token = getToken()
      const res = await fetch(
        `${API_BASE_URL}/social/posts/${encodeURIComponent(postId)}/hide/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ user_id: currentUser?.id }),
        }
      )

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`Hide failed: ${res.status} ${errText}`)
      }

      pauseTrackIfDeleted(postId)
      hidePost(postId)

      setPodcasts((prev) =>
        prev.filter((item) => String(item.id) !== String(postId))
      )
      setCollectionPosts((prev) =>
        prev.filter((item) => String(item.id) !== String(postId))
      )

      toast.success('Đã ẩn bài viết')
      setHidePostConfirmOpen(false)
      setHidingPost(null)
    } catch (err) {
      console.error('Hide post failed:', err)
      toast.error('Không thể ẩn bài viết')
    } finally {
      setIsHidingPost(false)
    }
  }, [hidingPost, currentUser?.id, pauseTrackIfDeleted, hidePost])

  const handleConfirmDeletePost = useCallback(async () => {
    if (!deletingPost) return
    const postId =
      getCanonicalPostIdForEngagement(deletingPost) ||
      String(deletingPost?.id ?? '')
    if (!postId) return

    try {
      setIsDeletingPost(true)
      const token = getToken()
      const res = await fetch(
        `${API_BASE_URL}/content/drafts/${encodeURIComponent(postId)}/delete/`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      )

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`Delete failed: ${res.status} ${errText}`)
      }

      pauseTrackIfDeleted(postId)
      deletePost(postId)
      removeSavedPost(postId)

      setPodcasts((prev) =>
        prev.filter((item) => String(item.id) !== String(postId))
      )
      setCollectionPosts((prev) =>
        prev.filter((item) => String(item.id) !== String(postId))
      )

      fetchCollections()

      toast.success('Đã xóa bài viết')
      setDeletePostConfirmOpen(false)
      setDeletingPost(null)
    } catch (err) {
      console.error('Delete post failed:', err)
      toast.error('Không thể xóa bài viết')
    } finally {
      setIsDeletingPost(false)
    }
  }, [deletingPost, pauseTrackIfDeleted, deletePost, removeSavedPost, fetchCollections])

  const handleNoteLoaded = (postId, hasNote) => {
    // Cập nhật hasNote khi ghi chú được tải từ backend
    setPodcasts(prev =>
      prev.map(item =>
        item.id === postId
          ? { ...item, hasNote }
          : item
      )
    )
  }

  const handleSaveNote = async (postId, noteContent) => {
    try {
      const token = getToken()
      const response = await fetch(`http://127.0.0.1:8000/api/social/posts/${postId}/notes/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: noteContent }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (data.success) {
        // Update podcasts with hasNote flag
        setPodcasts(prev =>
          prev.map(item =>
            item.id === postId
              ? { ...item, hasNote: noteContent ? true : false, noteCount: noteContent ? 1 : 0 }
              : item
          )
        )
      }
    } catch (err) {
      console.error('Failed to save note:', err)
      alert(t('library.content.saveNoteError'))
    }
  }

  const stats = useMemo(() => {
    console.log('📊 Recalc stats - podcasts:', podcasts.length, 'deleted:', deletedPostIds.size, 'hidden:', hiddenPostIds.size, 'deletedVer:', deletedPostsVersion)
    const activePostcasts = podcasts.filter(item => {
      const isDeleted = deletedPostIds.has(String(item.id))
      const isHidden = hiddenPostIds.has(String(item.id))
      if (isDeleted || isHidden) {
        console.log(`  ❌ Filtering out ${item.title} (deleted:${isDeleted}, hidden:${isHidden})`)
      }
      return !isDeleted && !isHidden
    })
    console.log('  ✅ Active posts after filter:', activePostcasts.length)
    const saved = activePostcasts.filter(item => item.saved).length
    const listened = activePostcasts.filter(item => item.listenedPercent > 0).length
    const unheard = activePostcasts.filter(item => item.listenedPercent === 0).length
    const notes = activePostcasts.filter(item => item.noteCount > 0).length

    return [
      { key: 'saved', icon: BookMarked, value: saved, sub: t('library.content.saved') },
      { key: 'listened', icon: Headphones, value: listened, sub: t('library.content.listened') },
      { key: 'unheard', icon: Clock3, value: unheard, sub: t('library.content.unheard') },
      { key: 'notes', icon: StickyNote, value: notes, sub: t('library.content.notes') },
    ]
  }, [podcasts, hiddenPostIds, deletedPostIds, deletedPostsVersion, hiddenPostsVersion, t])

  const visiblePodcasts = useMemo(() => {
    console.log('🔄 Recalc visiblePodcasts - podcasts:', podcasts.length, 'deleted:', deletedPostIds.size, 'hidden:', hiddenPostIds.size, 'deletedVer:', deletedPostsVersion, 'hiddenVer:', hiddenPostsVersion)
    const filtered = podcasts.filter(item => !deletedPostIds.has(String(item.id)) && !hiddenPostIds.has(String(item.id)))
    console.log('  📋 After filter:', filtered.length)

    switch (activeFilter) {
      case 'saved':
        return filtered.filter(item => item.saved)
      case 'listened':
        return filtered.filter(item => item.listenedPercent > 0)
      case 'unheard':
        return filtered.filter(item => item.listenedPercent === 0)
      case 'notes':
        return filtered.filter(item => item.noteCount > 0)
      default:
        return filtered
    }
  }, [activeFilter, podcasts, hiddenPostIds, deletedPostIds, deletedPostsVersion, hiddenPostsVersion])

  const sortedCollections = useMemo(() => {
    return [...collections].sort((a, b) => {
      const countDiff = (b.post_count || 0) - (a.post_count || 0)
      if (countDiff !== 0) return countDiff

      return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
    })
  }, [collections])

  useEffect(() => {
    const handleOpenPostDetailFromPlayer = async (event) => {
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

      let post = podcasts.find(p => String(p.id) === String(contentPostId))

      if (!post) {
        try {
          const token = getToken()

          const res = await fetch(
            `${API_BASE_URL}/content/posts/${encodeURIComponent(contentPostId)}/`,
            {
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            }
          )

          const data = await res.json()
          const raw = data.data || data
          if (!res.ok || !raw?.id) return

          post = {
            id: raw.id,
            postId: raw.id,
            title: raw.title,
            description: raw.description,
            author:
              typeof raw.author === 'object'
                ? raw.author
                : {
                  name: post.author || 'Người dùng',
                  username: post.author_username || '',
                  avatar_url: post.author_avatar || '',
                },

            author_avatar:
              post.author?.avatar_url ||
              post.author_avatar ||
              '',

            authorUsername:
              post.author?.username ||
              post.author_username ||
              '',
            authorId: raw.user_id || raw.author_id,
            user_id: raw.user_id || raw.author_id,
            userId: raw.user_id || raw.author_id,
            isOwner: raw.is_owner || false,
            cover: raw.thumbnail_url || '',
            thumbnail_url: raw.thumbnail_url || '',
            audioUrl: raw.audio?.audio_url || raw.audio_url || '',
            audio_url: raw.audio?.audio_url || raw.audio_url || '',
            durationSeconds: raw.audio?.duration_seconds || raw.duration_seconds || 0,
            duration_seconds: raw.audio?.duration_seconds || raw.duration_seconds || 0,
            like_count: raw.like_count ?? raw.stats?.likes ?? 0,
            comment_count: raw.comment_count ?? raw.stats?.comments ?? 0,
            share_count: raw.share_count ?? raw.stats?.shares ?? 0,
            save_count: raw.save_count ?? raw.stats?.saves ?? 0,
            is_liked: raw.is_liked ?? raw.viewer_state?.is_liked ?? false,
            is_saved: raw.is_saved ?? raw.viewer_state?.is_saved ?? false,
            saved: raw.is_saved ?? raw.viewer_state?.is_saved ?? false,
            created_at: raw.created_at,
            timeAgo: raw.timeAgo,
          }
        } catch (err) {
          console.error('Fetch post detail failed:', err)
          return
        }
      }

      if (!post) return

      handleOpenPostDetail(post)
    }

    window.addEventListener('open-post-detail', handleOpenPostDetailFromPlayer)

    return () => {
      window.removeEventListener('open-post-detail', handleOpenPostDetailFromPlayer)
    }
  }, [podcasts])

  if (loading) {
    return (
      <section className={styles.wrapper}>
        <div className={styles.mainCol}>
          <div className={styles.sectionCard}>
            <div className={styles.pageHeader}>
              {t('library.content.loading')}
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className={styles.wrapper}>
      <div className={styles.mainCol}>
        <div className={styles.sectionCard}>
          <div className={styles.pageHeader}>
            <div className={styles.titleRow}>
              <div className={styles.pinIcon}>
                <MapPin size={14} />
              </div>
              <div className={styles.titleCopy}>
                <h1 className={styles.pageTitle}>{t('library.content.pageTitle')}</h1>
                <p className={styles.pageSub}>
                  {t('library.content.pageSubtitle')}
                </p>
              </div>
            </div>

            <div className={styles.headerActions}>
              <button
                type="button"
                className={`${styles.iconBtn} ${viewMode === 'grid' ? styles.iconBtnActive : ''
                  }`}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid size={15} />
              </button>

              <button
                type="button"
                className={`${styles.iconBtn} ${viewMode === 'list' ? styles.iconBtnActive : ''
                  }`}
                onClick={() => setViewMode('list')}
              >
                <Rows3 size={15} />
              </button>
            </div>
          </div>

          <div className={styles.statsGrid}>
            {stats.map(({ key, icon: Icon, value, sub }) => (
              <button
                key={key}
                type="button"
                className={`${styles.statCard} ${activeFilter === key ? styles.statCardActive : ''
                  }`}
                onClick={() =>
                  setActiveFilter(prev => (prev === key ? 'all' : key))
                }
              >
                <div className={styles.statIcon}>
                  <Icon size={15} />
                </div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>{value}</div>
                  <div className={styles.statSub}>{sub}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <div>
              <h3 className={styles.sectionTitle}>{t('library.content.collections')}</h3>
              <p className={styles.sectionSub}>
                {t('library.content.collectionCount', { count: sortedCollections.length })}
              </p>
            </div>

            {sortedCollections.length > 4 && (
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => setShowAllCollections(prev => !prev)}
              >
                {showAllCollections ? t('library.content.collapse') : t('library.content.viewAll')} <ChevronRight size={15} />
              </button>
            )}
          </div>

          <div className={styles.collectionGrid}>
            {sortedCollections.length > 0 ? (
              (showAllCollections ? sortedCollections : sortedCollections.slice(0, 4)).map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.collectionCard}
                  onClick={() => handleCollectionClick(item)}
                >
                  <span className={styles.collectionName}>{item.name}</span>
                  <span className={styles.collectionCount}>
                    {t('library.content.podcastCount', { count: item.post_count || 0 })}
                  </span>
                </button>
              ))
            ) : (
              <p className={styles.emptyMessage}>{t('library.content.noCollections')}</p>
            )}
          </div>
        </div>

        <div className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <div>
              <h3 className={styles.sectionTitle}>{t('library.content.savedPodcasts')}</h3>
              <p className={styles.sectionSub}>
                {t('library.content.podcastCount', { count: visiblePodcasts.length })}
              </p>
            </div>
            {visiblePodcasts.length > 4 && (
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => {
                  setSelectedCollection(null)
                  setCollectionPosts([])
                  setShowAllPostsModal(true)
                }}
              >
                {t('library.content.viewAll')} <ChevronRight size={15} />
              </button>
            )}
          </div>

          <div className={`${styles.savedGrid} ${viewMode === 'list' ? styles.savedGridList : ''}`}>
            {visiblePodcasts.slice(0, 4).length > 0 ? (
              visiblePodcasts.slice(0, 4).map(item => (
                <SavedCard
                  key={item.id}
                  item={item}
                  viewMode={viewMode}
                  onToggleSaved={toggleSaved}
                  onOpenNotes={handleOpenNotes}
                  onOpenDetail={handleOpenPostDetail}
                  isOwner={computeIsOwner(item)}
                  onEdit={handleEditPost}
                  onDelete={handleRequestDeletePost}
                  onHide={handleRequestHidePost}
                  t={t}
                />
              ))
            ) : (
              <p style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: '#999' }}>
                {t('library.noSavedPodcasts')}
              </p>
            )}
          </div>
        </div>
      </div>

      <NotesModal
        isOpen={notesModalOpen}
        onClose={() => {
          setNotesModalOpen(false)
          setSelectedPostForNotes(null)
        }}
        post={selectedPostForNotes}
        onSaveNote={handleSaveNote}
        onNoteLoaded={handleNoteLoaded}
      />


      <AllPostsModal
        isOpen={showAllPostsModal}
        onClose={() => {
          setShowAllPostsModal(false)
          setSelectedCollection(null)
          setCollectionPosts([])
        }}
        posts={selectedCollection ? collectionPosts : visiblePodcasts}
        title={
          selectedCollection
            ? t('library.content.collectionTitle', { name: selectedCollection.name })
            : t('library.allSavedPodcasts', { count: visiblePodcasts.length })
        }
        onSelectPost={handleSelectPostFromAllModal}
        isOwner={computeIsOwner}
        onEditPost={handleEditPost}
        onDeletePost={handleRequestDeletePost}
        onHidePost={handleRequestHidePost}
      />

      <EditPostModal
        isOpen={editPostModalOpen}
        postId={editingPostId}
        onClose={() => {
          setEditPostModalOpen(false)
          setEditingPostId(null)
        }}
        onSaved={handlePostEdited}
      />

      <ConfirmModal
        isOpen={deletePostConfirmOpen}
        onCancel={() => {
          if (isDeletingPost) return
          setDeletePostConfirmOpen(false)
          setDeletingPost(null)
        }}
        onConfirm={handleConfirmDeletePost}
        title="Xóa bài viết"
        message="Bạn có chắc muốn xóa bài viết này? Hành động này không thể hoàn tác."
        confirmText={isDeletingPost ? 'Đang xóa…' : 'Xóa bài viết'}
        cancelText="Hủy"
        isDangerous
        isLoading={isDeletingPost}
      />

      <ConfirmModal
        isOpen={hidePostConfirmOpen}
        onCancel={() => {
          if (isHidingPost) return
          setHidePostConfirmOpen(false)
          setHidingPost(null)
        }}
        onConfirm={handleConfirmHidePost}
        title="Ẩn bài viết"
        message="Bạn có muốn ẩn bài viết này khỏi danh sách?"
        confirmText={isHidingPost ? 'Đang ẩn…' : 'Ẩn bài viết'}
        cancelText="Hủy"
        isLoading={isHidingPost}
      />

      {showPostDetail && selectedPostDetail && (
        <CommentModal
          podcast={selectedPostDetail}
          liked={liked}
          saved={saved}
          likeCount={likeCount}
          shareCount={selectedPostDetail?.share_count || 0}
          saveCount={0}
          commentCount={commentCount}
          onClose={() => {
            setShowPostDetail(false)
            setSelectedPostDetail(null)
          }}
          onCommentCountChange={setCommentCount}
          onToggleLike={handleToggleLike}
          onToggleSave={handleToggleSave}
          onShare={handleShare}
          onPostDeleted={handlePostDeleted}
          disableAutoScroll={true}
        />
      )}
    </section>
  )
}
