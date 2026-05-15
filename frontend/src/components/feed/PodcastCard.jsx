import { useEffect, useRef, useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { toast } from 'react-toastify'
import {
  Play, Pause, Heart, MessageCircle,
  Share2, Bookmark, Sparkles, MoreHorizontal, Edit, Trash2, EyeOff, Flag, X
} from 'lucide-react'
import styles from '../../style/feed/PodcastCard.module.css'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { PodcastContext } from '../contexts/PodcastContext'
import { getToken, getCurrentUser } from '../../utils/auth'
import { getInitials } from '../../utils/getInitials'
import { API_BASE_URL } from '../../config/apiBase'
import { getCanonicalPostIdForEngagement } from '../../utils/canonicalPostId'
import { publicDisplayName } from '../../utils/publicDisplayName'
import CommentModal from './CommentModal'
import ShareModal from './ShareModal'
import ConfirmModal from './ConfirmModal'
import EditPostModal from './EditPostModal'
import SaveCollectionModal from '../common/SaveCollectionModal'
import { useTranslation } from 'react-i18next'

function formatTime(seconds) {
  const total = Math.floor(Number(seconds || 0))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function statsHoverEmptyLabel(kind, t) {
  if (kind === 'likes') return t('feed.noLikes')
  if (kind === 'comments') return t('feed.noComments')
  return t('feed.noShares')
}

export default function PodcastCard({
  podcast,
  queue = [],
  onDelete,
  onHide,
  hideMenu = false,
  hideActions = false,
  /** Bài nhúng trong card share trên feed — like/lưu/chia sẻ/bình luận theo bài gốc (post_id). */
  embedInShare = false,
  onPlayClick = null,
  onSeek = null,
  onEditPost = null,
}) {
  const { t } = useTranslation()
  const currentUser = getCurrentUser()
  const navigate = useNavigate()
  const menuRef = useRef(null)

  const engagementPostId =
    getCanonicalPostIdForEngagement(podcast) ||
    String(podcast.post_id ?? podcast.id ?? '').trim()

  const isFeedShareRow =
    podcast.type === 'shared' || String(podcast.id || '').startsWith('share_')

  const shareModalPodcast =
    isFeedShareRow && embedInShare
      ? {
          ...podcast,
          id: engagementPostId,
          post_id: engagementPostId,
          type: 'original',
        }
      : podcast

  const commentModalPodcast = shareModalPodcast

  const [liked, setLiked] = useState(podcast.liked ?? false)
  const [likeCount, setLikeCount] = useState(podcast.likes ?? 0)
  const [loadingLike, setLoadingLike] = useState(false)
  const [saved, setSaved] = useState(
    podcast.saved ?? podcast.viewer_state?.is_saved ?? false
  )
  const [saveCount, setSaveCount] = useState(
    podcast.saveCount ?? podcast.stats?.saves ?? 0
  )
  const [loadingSave, setLoadingSave] = useState(false)
  const [shareCount, setShareCount] = useState(podcast.shares ?? 0)
  const [loadingShare, setLoadingShare] = useState(false)
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [commentCount, setCommentCount] = useState(podcast.comments ?? 0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const [showReportModal, setShowReportModal] = useState(false)
  const [editPostModalOpen, setEditPostModalOpen] = useState(false)
  const [livePostMeta, setLivePostMeta] = useState({
    title: podcast?.title,
    description: podcast?.description,
  })

  useEffect(() => {
    setLivePostMeta({
      title: podcast?.title,
      description: podcast?.description,
    })
  }, [podcast?.id, podcast?.title, podcast?.description])

  useEffect(() => {
    const handlePostSync = (event) => {
      const d = event.detail || {}
      if (!d.postId) return
      const canonical =
        getCanonicalPostIdForEngagement(podcast) ||
        podcast?.post_id ||
        podcast?.id
      if (String(d.postId) !== String(canonical)) return

      if (typeof d.title === 'string' || typeof d.description === 'string') {
        setLivePostMeta((prev) => ({
          title: typeof d.title === 'string' ? d.title : prev.title,
          description:
            typeof d.description === 'string' ? d.description : prev.description,
        }))
      }

      if (typeof d.liked === 'boolean') setLiked(d.liked)
      if (typeof d.likeCount === 'number') setLikeCount(d.likeCount)
      if (typeof d.saved === 'boolean') setSaved(d.saved)
      if (typeof d.saveCount === 'number') setSaveCount(d.saveCount)
    }

    window.addEventListener('post-sync-updated', handlePostSync)
    return () => {
      window.removeEventListener('post-sync-updated', handlePostSync)
    }
  }, [engagementPostId, podcast?.id, podcast?.post_id])

  const POST_SYNC_EVENT = 'post-sync-updated'

  const dispatchPostSync = (payload) => {
    window.dispatchEvent(new CustomEvent(POST_SYNC_EVENT, { detail: payload }))
  }

  const [modal, setModal] = useState({
    isOpen: false,
    type: 'confirm',
    title: '',
    message: '',
    confirmText: t('feed.confirm.defaultConfirm'),
    cancelText: t('common.cancel'),
    isDangerous: false,
    inputValue: '',
    onConfirm: null,
  })

  const isOwner =
    String(currentUser?.username) === String(podcast.authorUsername) ||
    String(currentUser?.username) === String(podcast.author) ||
    String(currentUser?.id) === String(podcast.authorId)

  const { savedPostIds, addSavedPost, removeSavedPost } = useContext(PodcastContext)

  const {
    playing,
    currentTime,
    duration,
    progressPercent,
    playTrack,
    seekToPercent,
    isCurrentTrack,
    trackProgressMap,
    togglePlay,
  } = useAudioPlayer()

  const prevSavedPostIdsRef = useRef(savedPostIds)
  const saveBookmarkRef = useRef(null)
  const [showCollectionModal, setShowCollectionModal] = useState(false)

  useEffect(() => {
    const savedKey = String(engagementPostId || podcast.id)
    const wasPreviouslySaved = prevSavedPostIdsRef.current.has(savedKey)
    const isCurrentlySaved = savedPostIds.has(savedKey)

    if (isCurrentlySaved && !saved) {
      setSaved(true)
      setSaveCount((prev) => Math.max(prev, podcast.saveCount ?? 1))
    }

    if (wasPreviouslySaved && !isCurrentlySaved && saved) {
      setSaveCount(prev => Math.max(prev - 1, 0))
      setSaved(false)
    }

    prevSavedPostIdsRef.current = savedPostIds
  }, [engagementPostId, savedPostIds, podcast.id, podcast.saveCount, saved])

  const isActive = isCurrentTrack(podcast.id)
  const isPlaying = isActive && playing

  const audioSrc =
    podcast.audio?.audio_url ||
    podcast.audioUrl ||
    podcast.audio_url ||
    ''
  const queueWithAudio = queue.filter(
    (item) =>
      item.audio?.audio_url ||
      item.audioUrl ||
      item.audio_url
  )

  const savedProgress = trackProgressMap?.[podcast.id]
  const hasPlayedBefore = Boolean(savedProgress?.hasPlayed)

  const displayCurrent = isActive
    ? formatTime(currentTime)
    : hasPlayedBefore
      ? formatTime(savedProgress?.currentTime || 0)
      : '00:00'

  const displayDuration = isActive
    ? formatTime(duration || podcast.durationSeconds || podcast.duration_seconds || 0)
    : formatTime(savedProgress?.duration || podcast.durationSeconds || podcast.duration_seconds || 0)

  const displayProgress = isActive
    ? progressPercent
    : hasPlayedBefore
      ? Number(savedProgress?.progressPercent || 0)
      : 0

  const {
    title,
    author: authorProp,
    authorUsername,
    authorInitials,
    cover,
    tags,
    aiGenerated,
    description,
  } = podcast

  const authorDetails =
    authorProp && typeof authorProp === 'object' ? authorProp : null

  const authorDisplayName =
    authorDetails?.name ||
    (typeof authorProp === 'string' && authorProp.trim() ? authorProp : '') ||
    podcast.author_name ||
    podcast.authorDisplayName ||
    authorUsername ||
    t('feed.anonymous')

  const authorProfileTarget =
    podcast.authorId ||
    authorDetails?.id ||
    podcast.user_id ||
    podcast.user?.id ||
    authorDetails?.username ||
    authorUsername ||
    podcast.author_username ||
    ''

  const openAuthorProfile = (event) => {
    event?.stopPropagation?.()
    if (!authorProfileTarget) return
    navigate(`/profile/${authorProfileTarget}`)
  }

  const authorAvatarUrl =
    authorDetails?.avatar_url ||
    podcast.author?.avatar_url ||
    podcast.author_avatar ||
    podcast.author_avatar_url ||
    podcast.user_profile?.avatar_url ||
    podcast.author_profile?.avatar_url ||
    podcast.user?.profile?.avatar_url ||
    ''

  const authorInitialsValue = authorInitials || getInitials(authorDisplayName)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        const dropdown = document.querySelector(`.${styles.dropdown}`)
        if (dropdown && dropdown.contains(event.target)) {
          return
        }
        setMenuOpen(false)
      }
    }

    const handleScroll = () => {
      setMenuOpen(false)
    }

    if (menuOpen && menuRef.current) {
      const button = menuRef.current.querySelector('button')
      if (button) {
        const rect = button.getBoundingClientRect()
        const gap = 6

        setDropdownPos({
          top: rect.bottom + gap,
          left: rect.right,
        })
      }

      const main = document.querySelector('main')

      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('pointerdown', handleClickOutside, true)
      main?.addEventListener('scroll', handleScroll, { passive: true })
      window.addEventListener('scroll', handleScroll, true)
      document.addEventListener('wheel', handleScroll, { capture: true, passive: true })
      document.addEventListener('touchmove', handleScroll, { capture: true, passive: true })

      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('pointerdown', handleClickOutside, true)
        main?.removeEventListener('scroll', handleScroll)
        window.removeEventListener('scroll', handleScroll, true)
        document.removeEventListener('wheel', handleScroll, true)
        document.removeEventListener('touchmove', handleScroll, true)
      }
    }
  }, [menuOpen])

  const showModal = (config) => {
    setModal({
      isOpen: true,
      type: 'confirm',
      title: '',
      message: '',
      confirmText: t('feed.confirm.defaultConfirm'),
      cancelText: t('common.cancel'),
      isDangerous: false,
      inputValue: '',
      onConfirm: null,
      ...config,
    })
  }

  const closeModal = () => {
    setModal((prev) => ({ ...prev, isOpen: false, onConfirm: null }))
  }

  const handleEdit = () => {
    setMenuOpen(false)
    if (typeof onEditPost === 'function') {
      onEditPost(podcast)
      return
    }
    setEditPostModalOpen(true)
  }

  const handlePostEdited = (next) => {
    if (!next) return
    setLivePostMeta({
      title: next.title ?? livePostMeta.title,
      description: next.description ?? livePostMeta.description,
    })
    const syncPostId =
      getCanonicalPostIdForEngagement(podcast) ||
      podcast.post_id ||
      podcast.id
    window.dispatchEvent(
      new CustomEvent('post-sync-updated', {
        detail: {
          postId: syncPostId,
          title: next.title,
          description: next.description,
        },
      })
    )
  }

  const handleDelete = async () => {
    setMenuOpen(false)

    showModal({
      type: 'confirm',
      title: t('feed.confirm.deletePostTitle'),
      message: t('feed.confirm.deletePostMessage'),
      confirmText: t('common.delete'),
      isDangerous: true,
      onConfirm: async () => {
        try {
          closeModal()
          await new Promise(resolve => setTimeout(resolve, 300))

          const token = getToken()
          const deleteUrl = `http://localhost:8000/api/content/drafts/${podcast.id}/delete/`

          const res = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          })

          const responseText = await res.text()

          if (!res.ok) {
            throw new Error(`Delete failed: ${res.status} ${responseText}`)
          }

          setTimeout(() => {
            onDelete?.(podcast.id)
          }, 450)
        } catch (err) {
          console.error('Delete error:', err)
          toast.error(err.message || t('feed.comment.deletePostFailed'))
          sessionStorage.removeItem('feedScrollPosition')
        }
      },
    })
  }

  const handleHide = () => {
    setMenuOpen(false)

    showModal({
      type: 'confirm',
      title: t('feed.confirm.hidePostTitle'),
      message: t('feed.confirm.hidePostFeedMessage'),
      confirmText: t('feed.confirm.hide'),
      onConfirm: async () => {
        try {
          closeModal()

          const token = getToken()
          const currentUser = getCurrentUser()

          const res = await fetch(`http://localhost:8000/api/social/posts/${podcast.id}/hide/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              user_id: currentUser?.id,
            }),
          })

          if (!res.ok) {
            throw new Error(t('feed.hidePostFailed'))
          }

          onHide?.(podcast.id)
        } catch (err) {
          console.error('Hide post error:', err)
          toast.error(err.message || t('feed.hidePostFailed'))
        }
      },
    })
  }

  const handleReport = () => {
    setMenuOpen(false)
    setShowReportModal(true)
  }

  const handlePlayClick = (e) => {
    if (onPlayClick) {
      e?.stopPropagation?.()
      e?.preventDefault?.()
      onPlayClick(e)
      return
    }

    if (!audioSrc) return

    if (isActive) {
      togglePlay()
      return
    }

    playTrack(
      {
        ...podcast,
        id: podcast.id,
        postId: podcast.id,
        liked,
        saved,
        audioUrl: audioSrc,
        onLikeChange: (result) => {
          setLiked(result.liked)
          setLikeCount(result.likeCount)
        },
      },
      queueWithAudio.map((item) => ({
        ...item,
        audioUrl: item.audioUrl || item.audio_url || '',
      }))
    )
  }

  const handleSeek = (e) => {
    if (onSeek) {
      e?.stopPropagation?.()
      e?.preventDefault?.()
      onSeek(e)
      return
    }

    const value = Number(e.target.value)

    if (!audioSrc) return

    if (!isActive) {
      playTrack(
        {
          ...podcast,
          audioUrl: audioSrc,
          onLikeChange: (result) => {
            setLiked(result.liked)
            setLikeCount(result.likeCount)
          },
        },
        queueWithAudio.map((item) => ({
          ...item,
          audioUrl: item.audioUrl || item.audio_url || '',
        }))
      )

      setTimeout(() => seekToPercent(value), 0)
      return
    }

    seekToPercent(value)
  }

  const handleToggleLike = async (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (loadingLike) return

    try {
      setLoadingLike(true)

      const token = getToken()
      const currentUser = getCurrentUser()

      const res = await fetch(
        `http://localhost:8000/api/social/posts/${engagementPostId}/like/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            user_id: currentUser?.id,
          }),
        }
      )

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || `HTTP ${res.status}`)
      }

      const nextLiked = Boolean(data.data?.liked)
      const nextLikeCount = Number(data.data?.like_count || 0)

      setLiked(nextLiked)
      setLikeCount(nextLikeCount)

      dispatchPostSync({
        postId: engagementPostId,
        liked: nextLiked,
        likeCount: nextLikeCount,
      })

      window.dispatchEvent(
        new CustomEvent('audio-track-like-updated', {
          detail: {
            postId: engagementPostId,
            liked: nextLiked,
            likeCount: nextLikeCount,
          },
        })
      )

      setStatsPopupData({
        likes: [],
        comments: [],
        shares: [],
      })
    } catch (err) {
      console.error('Like failed:', err)
    } finally {
      setLoadingLike(false)
    }
  }

  const handleToggleSave = async (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (loadingSave) return

    if (saved) {
      try {
        setLoadingSave(true)

        const token = getToken()
        const currentUser = getCurrentUser()

        const res = await fetch(
          `http://localhost:8000/api/social/posts/${engagementPostId}/save/`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              user_id: currentUser?.id,
            }),
          }
        )

        const contentType = res.headers.get('content-type')
        if (!contentType?.includes('application/json')) {
          throw new Error('API error: Invalid response')
        }

        const data = await res.json()

        if (!res.ok || !data.success) {
          throw new Error(data.message || `HTTP ${res.status}`)
        }

        const nextSaveCount = Number(data.data?.save_count || 0)

        setSaved(false)
        setSaveCount(nextSaveCount)
        removeSavedPost(engagementPostId)

        dispatchPostSync({
          postId: engagementPostId,
          saved: false,
          saveCount: nextSaveCount,
        })
      } catch (err) {
        console.error('Unsave failed:', err)
        toast.error(`${t('library.content.unsaveFailed')}: ${err.message}`)
      } finally {
        setLoadingSave(false)
      }

      return
    }

    setShowCollectionModal(true)
  }

  const handleCollectionModalSave = async () => {
    setSaved(true)

    setSaveCount(prev => {
      const next = prev + 1

      dispatchPostSync({
        postId: engagementPostId,
        saved: true,
        saveCount: next,
      })

      return next
    })

    addSavedPost(engagementPostId)
    setShowCollectionModal(false)
  }

  const handleShare = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setShowShareModal(true)
  }

  const [statsPopupDirection, setStatsPopupDirection] = useState('down')
  const [statsHoverType, setStatsHoverType] = useState(null)
  const [statsPopupData, setStatsPopupData] = useState({
    likes: [],
    comments: [],
    shares: [],
  })
  const [statsPopupLoading, setStatsPopupLoading] = useState(false)
  const hoverTimerRef = useRef(null)

  const getUniqueUsersById = (items = []) => {
    const map = new Map()

    items.forEach((item) => {
      const key = item.user_id || item.username
      if (!key || map.has(key)) return
      map.set(key, item)
    })

    return Array.from(map.values())
  }

  const fetchStatsPopupData = async (type) => {
    try {
      setStatsPopupLoading(true)

      const token = getToken()
      const rawId =
        type === 'shares' &&
          (podcast.type === 'shared' ||
            String(podcast.id || '').startsWith('share_'))
          ? String(podcast.id || '').trim()
          : getCanonicalPostIdForEngagement(podcast) ??
          String(podcast.post_id ?? podcast.id ?? '').trim()
      const postIdEnc = encodeURIComponent(String(engagementPostId || '').trim())
      if (!postIdEnc) return

      let endpoint = ''

      if (type === 'likes') {
        endpoint = `${API_BASE_URL}/social/posts/${postIdEnc}/likers/`
      } else if (type === 'comments') {
        endpoint = `${API_BASE_URL}/social/posts/${postIdEnc}/commenters/`
      } else if (type === 'shares') {
        endpoint = `${API_BASE_URL}/social/posts/${postIdEnc}/sharers/`
      } else {
        return
      }

      const res = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      const ct = res.headers.get('content-type') || ''
      if (!ct.includes('application/json')) {
        throw new Error(`Phản hồi không phải JSON (HTTP ${res.status})`)
      }

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || `HTTP ${res.status}`)
      }

      if (type === 'likes') {
        setStatsPopupData((prev) => ({
          ...prev,
          likes: data.data?.likers || [],
        }))
      }

      if (type === 'comments') {
        setStatsPopupData((prev) => ({
          ...prev,
          comments: data.data?.commenters || [],
        }))
      }

      if (type === 'shares') {
        if (typeof data.data?.share_count === 'number') {
          setShareCount(Number(data.data.share_count))
        }

        setStatsPopupData((prev) => ({
          ...prev,
          shares: getUniqueUsersById(data.data?.sharers || []),
        }))
      }
    } catch (err) {
      console.error(`Fetch ${type} popup failed:`, err)
    } finally {
      setStatsPopupLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    }
  }, [])

  const handleStatsMouseEnter = (type) => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
    }

    updatePopupDirection(type)
    setStatsHoverType(type)

    const hasData =
      (type === 'likes' && statsPopupData.likes.length > 0) ||
      (type === 'comments' && statsPopupData.comments.length > 0) ||
      (type === 'shares' && statsPopupData.shares.length > 0)

    if (!hasData) {
      fetchStatsPopupData(type)
    }
  }

  const handleStatsMouseLeave = () => {
    hoverTimerRef.current = setTimeout(() => {
      setStatsHoverType(null)
    }, 120)
  }

  const handleStatsPopupMouseEnter = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }

  const statRefs = useRef({
    likes: null,
    comments: null,
    shares: null,
  })

  const updatePopupDirection = (type) => {
    const triggerEl = statRefs.current[type]
    if (!triggerEl) {
      setStatsPopupDirection('down')
      return
    }

    const rect = triggerEl.getBoundingClientRect()
    const popupHeight = 260
    const gap = 12

    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top

    if (spaceBelow < popupHeight + gap && spaceAbove > popupHeight + gap) {
      setStatsPopupDirection('up')
    } else {
      setStatsPopupDirection('down')
    }
  }

  useEffect(() => {
    const handlePostSync = (event) => {
      const d = event.detail || {}
      if (String(d.postId) !== String(podcast.id)) return

      if (typeof d.liked === 'boolean') setLiked(d.liked)
      if (typeof d.likeCount === 'number') setLikeCount(d.likeCount)
      if (typeof d.saved === 'boolean') setSaved(d.saved)
      if (typeof d.saveCount === 'number') setSaveCount(d.saveCount)
      if (typeof d.shareCount === 'number') setShareCount(d.shareCount)
    }

    window.addEventListener(POST_SYNC_EVENT, handlePostSync)
    return () => window.removeEventListener(POST_SYNC_EVENT, handlePostSync)
  }, [podcast.id])

  return (
    <>
      <article
        className={[
          styles.card,
          embedInShare ? styles.cardShareEmbed : '',
          showCommentModal ? styles.noHover : '',
          isActive ? styles.activeCard : '',
        ].join(' ')}
      >
        <div className={styles.cardHeader}>
          <div
            className={styles.authorAvatar}
            role="button"
            tabIndex={0}
            onClick={openAuthorProfile}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && authorProfileTarget) {
                e.preventDefault()
                openAuthorProfile(e)
              }
            }}
          >
            {authorAvatarUrl ? (
              <>
                <img
                  className={styles.authorAvatarImage}
                  src={authorAvatarUrl}
                  alt={authorDisplayName}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling.style.display = 'flex'
                  }}
                />

                <span
                  className={styles.authorAvatarInitials}
                  style={{ display: 'none' }}
                >
                  {authorInitialsValue}
                </span>
              </>
            ) : (
              <span className={styles.authorAvatarInitials}>
                {authorInitialsValue}
              </span>
            )}
          </div>

          <div className={styles.authorInfo}>
            <div className={styles.authorMetaRow}>
              <span
                className={styles.authorName}
                role="button"
                tabIndex={0}
                onClick={openAuthorProfile}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && authorProfileTarget) {
                    e.preventDefault()
                    openAuthorProfile(e)
                  }
                }}
              >
                {authorDisplayName}
              </span>
              <span className={styles.metaDot}>•</span>
              <span className={styles.authorMetaText}>{podcast.timeAgo}</span>
              <span className={styles.metaDot}>•</span>
              <span className={styles.authorMetaText}>{podcast.listens}</span>
            </div>

            <div className={styles.tagRow}>
              {(tags || []).map((t) => (
                <span key={t} className={styles.tag}>{t}</span>
              ))}

              {aiGenerated && (
                <span className={styles.aiBadge}>
                  <Sparkles size={13} />
                  {t('feed.aiGenerated')}
                </span>
              )}
            </div>
          </div>

          {!hideMenu && (
            <div className={styles.menuWrap} ref={menuRef}>
              <button
                className={styles.menuBtn}
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label={t('feed.options')}
              >
                <MoreHorizontal size={20} />
              </button>

              {menuOpen &&
                createPortal(
                  <div
                    className={styles.dropdown}
                    style={{
                      top: `${dropdownPos.top}px`,
                      left: `${dropdownPos.left}px`,
                    }}
                  >
                    {isOwner ? (
                      <>
                        <button className={styles.dropdownItem} onClick={handleEdit}>
                          <Edit size={14} />
                          <span>{t('feed.edit')}</span>
                        </button>
                        <button className={`${styles.dropdownItem} ${styles.danger}`} onClick={handleDelete}>
                          <Trash2 size={14} />
                          <span>{t('feed.delete')}</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button className={styles.dropdownItem} onClick={handleHide}>
                          <EyeOff size={14} />
                          <span>{t('feed.hidePost')}</span>
                        </button>
                        <button className={`${styles.dropdownItem} ${styles.danger}`} onClick={handleReport}>
                          <Flag size={14} />
                          <span>{t('feed.report')}</span>
                        </button>
                      </>
                    )}
                  </div>,
                  document.body
                )}
            </div>
          )}
        </div>

        <div className={styles.body}>
          <div className={styles.textContent}>
            <h3 className={styles.title}>{livePostMeta.title ?? title}</h3>
            <p className={styles.description}>
              {livePostMeta.description ?? description}
            </p>
          </div>

          {cover && (
            <img
              src={cover}
              alt={title}
              className={styles.cover}
            />
          )}
        </div>

        <div
          className={styles.player}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={`${styles.playBtn} ${isPlaying ? styles.playing : ''}`}
            onClick={handlePlayClick}
            aria-label={isPlaying ? t('feed.pause') : t('feed.play')}
            disabled={!audioSrc}
            title={!audioSrc ? t('feed.noAudio') : ''}
            type="button"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>

          <div className={styles.progressSection}>
            <span className={styles.time}>{displayCurrent}</span>

            <div className={styles.progressBar}>
              <input
                type="range"
                min={0}
                max={100}
                value={displayProgress}
                onChange={handleSeek}
                className={styles.range}
                disabled={!audioSrc}
              />
              <div
                className={styles.progressFill}
                style={{ width: `${displayProgress}%` }}
              />
            </div>

            <span className={styles.time}>{displayDuration}</span>
          </div>
        </div>

        {!hideActions && (
          <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
            <div
              ref={(el) => { statRefs.current.likes = el }}
              className={styles.statHoverWrap}
            >
              <button
                className={`${styles.actionBtn} ${liked ? styles.liked : ''}`}
                onClick={handleToggleLike}
                disabled={loadingLike}
                type="button"
              >
                <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
                <span
                  onMouseEnter={() => handleStatsMouseEnter('likes')}
                  onMouseLeave={handleStatsMouseLeave}
                  className={styles.statsText}
                >
                  {likeCount}
                </span>
              </button>
              {statsHoverType === 'likes' && (
                <div
                  className={`${styles.statsPopup} ${statsPopupDirection === 'up' ? styles.statsPopupUp : styles.statsPopupDown
                    }`}
                  onMouseEnter={handleStatsPopupMouseEnter}
                  onMouseLeave={handleStatsMouseLeave}
                >
                  {statsPopupLoading ? (
                    <div className={styles.statsPopupEmpty}>{t('common.loading')}</div>
                  ) : statsPopupData.likes.length > 0 ? (
                    statsPopupData.likes.map((user) => (
                      <div key={user.user_id || user.username} className={styles.statsPopupItem}>
                        <span className={styles.statsPopupName}>{publicDisplayName(user)}</span>
                      </div>
                    ))
                  ) : (
                    <div className={styles.statsPopupEmpty}>{statsHoverEmptyLabel('likes', t)}</div>
                  )}
                </div>
              )}
            </div>

            <div
              ref={(el) => { statRefs.current.comments = el }}
              className={styles.statHoverWrap}
            >
              <button
                className={styles.actionBtn}
                type="button"
                onClick={() => setShowCommentModal(true)}
              >
                <MessageCircle size={16} />
                <span
                  onMouseEnter={() => handleStatsMouseEnter('comments')}
                  onMouseLeave={handleStatsMouseLeave}
                  className={styles.statsText}
                >
                  {t('feed.comments', { count: commentCount })}
                </span>
              </button>
              {statsHoverType === 'comments' && (
                <div
                  className={`${styles.statsPopup} ${statsPopupDirection === 'up' ? styles.statsPopupUp : styles.statsPopupDown
                    }`}
                  onMouseEnter={handleStatsPopupMouseEnter}
                  onMouseLeave={handleStatsMouseLeave}
                >
                  {statsPopupLoading ? (
                    <div className={styles.statsPopupEmpty}>Đang tải...</div>
                  ) : statsPopupData.comments.length > 0 ? (
                    statsPopupData.comments.map((user) => (
                      <div key={user.user_id || user.username} className={styles.statsPopupItem}>
                        <span className={styles.statsPopupName}>{publicDisplayName(user)}</span>
                      </div>
                    ))
                  ) : (
                    <div className={styles.statsPopupEmpty}>{statsHoverEmptyLabel('comments', t)}</div>
                  )}
                </div>
              )}
            </div>

            <div
              ref={(el) => { statRefs.current.shares = el }}
              className={styles.statHoverWrap}
            >
              <button
                className={styles.actionBtn}
                type="button"
                onClick={handleShare}
                disabled={loadingShare}
              >
                <Share2 size={16} />
                <span
                  onMouseEnter={() => handleStatsMouseEnter('shares')}
                  onMouseLeave={handleStatsMouseLeave}
                  className={styles.statsText}
                >
                  {t('feed.share', { count: shareCount })}
                </span>
              </button>
              {statsHoverType === 'shares' && (
                <div
                  className={`${styles.statsPopup} ${statsPopupDirection === 'up' ? styles.statsPopupUp : styles.statsPopupDown
                    }`}
                  onMouseEnter={handleStatsPopupMouseEnter}
                  onMouseLeave={handleStatsMouseLeave}
                >
                  {statsPopupLoading ? (
                    <div className={styles.statsPopupEmpty}>Đang tải...</div>
                  ) : statsPopupData.shares.length > 0 ? (
                    statsPopupData.shares.map((user) => (
                      <div key={user.user_id || user.username} className={styles.statsPopupItem}>
                        <span className={styles.statsPopupName}>{publicDisplayName(user)}</span>
                      </div>
                    ))
                  ) : (
                    <div className={styles.statsPopupEmpty}>{statsHoverEmptyLabel('shares', t)}</div>
                  )}
                </div>
              )}
            </div>

            <button
              ref={saveBookmarkRef}
              type="button"
              className={`${styles.actionBtn} ${saved ? styles.saved : ''}`}
              onClick={handleToggleSave}
              disabled={loadingSave}
            >
              <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
              <span>{t('feed.save', { count: saveCount })}</span>
            </button>
          </div>
        )}
      </article>

      <ConfirmModal
        isOpen={modal.isOpen}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        confirmText={modal.confirmText}
        cancelText={modal.cancelText}
        isDangerous={modal.isDangerous}
        inputValue={modal.inputValue}
        onInputChange={(value) => setModal((prev) => ({ ...prev, inputValue: value }))}
        onConfirm={() => {
          if (modal.type !== 'alert') {
            modal.onConfirm?.()
          }
        }}
        onCancel={closeModal}
      />

      {showCommentModal && (
        <CommentModal
          podcast={commentModalPodcast}
          liked={liked}
          saved={saved}
          likeCount={likeCount}
          shareCount={shareCount}
          saveCount={saveCount}
          commentCount={commentCount}
          disableAutoScroll={false}
          onClose={() => setShowCommentModal(false)}
          onCommentCountChange={setCommentCount}
          onToggleLike={handleToggleLike}
          onToggleSave={handleToggleSave}
          onShare={handleShare}
          onPostDeleted={() => {
            setShowCommentModal(false)
            onDelete?.(engagementPostId)
          }}
        />
      )}

      {showShareModal && (
        <ShareModal
          podcast={shareModalPodcast}
          onClose={() => setShowShareModal(false)}
          onShareSuccess={(data) => {
            const inc = Number(data?.share_count_increment || 0)
            const nextCount =
              typeof data?.share_count === 'number'
                ? Number(data.share_count)
                : shareCount + (inc > 0 ? inc : 1)
            setShareCount(nextCount)
            dispatchPostSync({
              postId: engagementPostId,
              shareCount: nextCount,
            })
          }}
        />
      )}

      <SaveCollectionModal
        isOpen={showCollectionModal}
        onClose={() => setShowCollectionModal(false)}
        postId={engagementPostId}
        onSave={handleCollectionModalSave}
        triggerRef={saveBookmarkRef}
        isPopup={false}
      />

      {showReportModal && (
        <ReportModal
          postId={engagementPostId}
          postTitle={podcast.title}
          authorId={podcast.authorId || podcast.author?.id}
          authorName={authorDisplayName}
          onClose={() => setShowReportModal(false)}
          onReportSuccess={() => {
            console.log('Report submitted successfully')
          }}
        />
      )}

      <EditPostModal
        isOpen={editPostModalOpen}
        postId={engagementPostId}
        onClose={() => setEditPostModalOpen(false)}
        onSaved={handlePostEdited}
      />
    </>
  )
}

function ReportModal({ postId, postTitle, authorId, authorName, onClose, onReportSuccess }) {
  const { t } = useTranslation()
  const [selectedReason, setSelectedReason] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const currentUser = getCurrentUser()

  useEffect(() => {
    if (currentUser?.id === authorId) {
      toast.error(t('feed.reportModal.ownPostError'))
      onClose()
    }
  }, [currentUser?.id, authorId, onClose])

  const REPORT_REASONS = [
    { value: 'spam', label: t('feed.reportModal.reasons.spam') },
    { value: 'inappropriate_content', label: t('feed.reportModal.reasons.inappropriate_content') },
    { value: 'harassment', label: t('feed.reportModal.reasons.harassment') },
    { value: 'misinformation', label: t('feed.reportModal.reasons.misinformation') },
    { value: 'copyright', label: t('feed.reportModal.reasons.copyright') },
    { value: 'other', label: t('feed.reportModal.reasons.other') },
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedReason) {
      toast.error(t('feed.reportModal.requiredReason'))
      return
    }

    if (!description.trim()) {
      toast.error(t('feed.reportModal.requiredDescription'))
      return
    }

    if (description.trim().length < 10) {
      toast.error(t('feed.reportModal.descriptionMin'))
      return
    }

    try {
      setLoading(true)

      const token = getToken()

      const res = await fetch('http://localhost:8000/api/social/reports/create/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          user_id: currentUser?.id,
          target_type: 'post',
          target_id: postId,
          reason: selectedReason,
          description: description.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || `HTTP ${res.status}`)
      }

      toast.success(t('feed.reportModal.success'))
      setSelectedReason('')
      setDescription('')
      onClose()
      onReportSuccess?.()
    } catch (err) {
      console.error('Report failed:', err)
      toast.error(err.message || t('feed.reportModal.failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.reportOverlay} onClick={onClose}>
      <div className={styles.reportModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.reportHeader}>
          <h2>{t('feed.reportModal.title')}</h2>
          <button
            className={styles.reportCloseBtn}
            onClick={onClose}
            type="button"
            aria-label={t('feed.confirm.close')}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.reportForm}>
          <div className={styles.reportPostInfo}>
            <p className={styles.reportPostTitle}>
              <strong>{t('feed.reportModal.post')}</strong> {postTitle}
            </p>
            <p className={styles.reportPostAuthor}>
              <strong>{t('feed.reportModal.author')}</strong> {authorName}
            </p>
          </div>

          <div className={styles.reportFormGroup}>
            <label htmlFor="reason" className={styles.reportLabel}>
              {t('feed.reportModal.reasonLabel')} <span className={styles.reportRequired}>*</span>
            </label>
            <select
              id="reason"
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className={styles.reportSelect}
              disabled={loading}
            >
              <option value="">{t('feed.reportModal.reasonPlaceholder')}</option>
              {REPORT_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.reportFormGroup}>
            <label htmlFor="description" className={styles.reportLabel}>
              {t('feed.reportModal.descriptionLabel')} <span className={styles.reportRequired}>*</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={styles.reportTextarea}
              placeholder={t('feed.reportModal.descriptionPlaceholder')}
              rows="4"
              disabled={loading}
            />
            <p className={styles.reportCharCount}>
              {description.length}/500
            </p>
          </div>

          <div className={styles.reportActions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.reportCancelBtn}
              disabled={loading}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className={styles.reportSubmitBtn}
              disabled={loading || !selectedReason || !description.trim()}
            >
              {loading ? t('feed.reportModal.submitting') : t('feed.reportModal.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
