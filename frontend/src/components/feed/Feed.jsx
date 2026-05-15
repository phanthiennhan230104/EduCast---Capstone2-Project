import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Edit,
  EyeOff,
  Flag,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'
import { toast } from 'react-toastify'

import PodcastCard from './PodcastCard'
import ReportPostModal from './ReportPostModal'
import CreatePostBar from './CreatePostBar'
import CommentModal from './CommentModal'
import EditShareCaptionModal from './EditShareCaptionModal'
import ConfirmModal from './ConfirmModal'
import { useTranslation } from 'react-i18next'

import styles from '../../style/feed/Feed.module.css'
import { API_BASE_URL, API_ORIGIN } from '../../config/apiBase'
import {
  FEED_MAIN_SCROLL_SESSION_KEY,
  preserveMainScrollAfterListUpdate,
  writeFeedScrollSessionKeys,
} from '../../utils/feedScrollSession'
import { getInitials } from '../../utils/getInitials'
import { getToken, getCurrentUser } from '../../utils/auth'
import {
  EDUCAST_PERSONAL_SHARE_SUCCESS,
  consumePendingFeedReloadFromPersonalShare,
} from '../../utils/appEvents'
import { publicDisplayName } from '../../utils/publicDisplayName'
import { useTagFilter } from '../contexts/TagFilterContext'
import { PodcastContext } from '../contexts/PodcastContext'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { POST_REMOVED_EVENT, matchesRemovedPost } from '../../utils/postRemoval'

const TABS = [
  { labelKey: 'feed.tabs.forYou', key: 'for_you' },
  { labelKey: 'feed.tabs.following', key: 'following' },
  { labelKey: 'feed.tabs.trending', key: 'trending' },
  { labelKey: 'feed.tabs.latest', key: 'latest' },
]

const POST_SYNC_EVENT = 'post-sync-updated'

let didHandleFeedReloadScrollReset = false

function engagementPostId(podcast) {
  if (!podcast) return null
  if (podcast.post_id != null && podcast.post_id !== '') {
    return podcast.post_id
  }
  return podcast.id
}

function feedRowMatchesCanonicalPost(row, canonicalId) {
  if (canonicalId == null) return false
  return (
    String(row.post_id) === String(canonicalId) ||
    String(row.id) === String(canonicalId)
  )
}

function resolvePlaybackAudioUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw) || raw.startsWith('blob:')) return raw
  if (raw.startsWith('//')) return `${window.location.protocol}${raw}`
  const base = String(API_ORIGIN || '').replace(/\/+$/, '')
  if (raw.startsWith('/') && base) return `${base}${raw}`
  return raw
}

export default function Feed() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const location = useLocation()

  const { selectedTagIds, selectedTopicIds, updateSelectedTags } = useTagFilter()
  const selectedTagIdsRef = useRef(selectedTagIds)
  selectedTagIdsRef.current = selectedTagIds

  const {
    savedPostIds,
    setSavedPostIds_batch,
    deletePost,
    hidePost,
    deletedPostIds,
    hiddenPostIds,
  } = useContext(PodcastContext)

  const { pauseTrackIfDeleted } = useAudioPlayer()

  const [activeTab, setActiveTab] = useState(() => {
    const saved = sessionStorage.getItem('feedActiveTab')
    return saved ? parseInt(saved, 10) : 0
  })

  const [disableModalAutoScroll, setDisableModalAutoScroll] = useState(true)
  const [selectedPodcast, setSelectedPodcast] = useState(null)
  const [podcasts, setPodcasts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openShareMenuId, setOpenShareMenuId] = useState(null)
  const [sharedRowConfirm, setSharedRowConfirm] = useState({
    open: false,
    mode: null,
    podcast: null,
  })
  const [failedAvatarUrls, setFailedAvatarUrls] = useState(new Set())
  const [reportSharePodcast, setReportSharePodcast] = useState(null)
  const [editShareCaptionPodcast, setEditShareCaptionPodcast] = useState(null)
  const [feedReloadNonce, setFeedReloadNonce] = useState(0)
  const [sharedActionHover, setSharedActionHover] = useState({
    rowKey: null,
    kind: null,
    items: [],
    loading: false,
  })

  const sharedActionHoverLeaveTimerRef = useRef(null)
  const feedLastMainScrollRef = useRef(0)
  const pendingScrollFeedTopAfterShareRef = useRef(false)

  useLayoutEffect(() => {
    const { reload, scrollToTop } = consumePendingFeedReloadFromPersonalShare()
    if (!reload) return

    const hasTagFilter =
      Array.isArray(selectedTagIdsRef.current) &&
      selectedTagIdsRef.current.length > 0

    if (!hasTagFilter && scrollToTop) {
      pendingScrollFeedTopAfterShareRef.current = true
      writeFeedScrollSessionKeys(0)
      feedLastMainScrollRef.current = 0
    }

    queueMicrotask(() => setFeedReloadNonce((n) => n + 1))
  }, [])

  const feedScrollKey = 'mainScroll:/feed'
  const resetScrollOnBrowserReloadRef = useRef(
    !didHandleFeedReloadScrollReset &&
    typeof performance !== 'undefined' &&
    performance.getEntriesByType('navigation')[0]?.type === 'reload' &&
    sessionStorage.getItem('returnFromEdit') !== 'true'
  )
  const focusPostId = sessionStorage.getItem('feedFocusPostId')

  const dispatchPostSync = (payload) => {
    window.dispatchEvent(new CustomEvent(POST_SYNC_EVENT, { detail: payload }))
  }

  useEffect(() => {
    selectedTagIdsRef.current = selectedTagIds
  }, [selectedTagIds])

  useEffect(() => {
    sessionStorage.setItem('feedActiveTab', String(activeTab))
  }, [activeTab])

  useEffect(() => {
    const onPersonalShareSuccess = () => {
      const hasTagFilter =
        Array.isArray(selectedTagIds) && selectedTagIds.length > 0

      if (hasTagFilter) {
        setFeedReloadNonce((n) => n + 1)
        return
      }

      pendingScrollFeedTopAfterShareRef.current = true
      writeFeedScrollSessionKeys(0)
      feedLastMainScrollRef.current = 0
      setFeedReloadNonce((n) => n + 1)
    }

    window.addEventListener(EDUCAST_PERSONAL_SHARE_SUCCESS, onPersonalShareSuccess)
    return () => {
      window.removeEventListener(
        EDUCAST_PERSONAL_SHARE_SUCCESS,
        onPersonalShareSuccess
      )
    }
  }, [feedScrollKey, selectedTagIds])

  useEffect(() => {
    if (!openShareMenuId) return

    const close = () => setOpenShareMenuId(null)

    const isInsideMenu = (target) => {
      if (!target || typeof target.closest !== 'function') return false
      return Boolean(target.closest('[data-share-feed-menu]'))
    }

    const onPointerDown = (e) => {
      if (!isInsideMenu(e.target)) close()
    }

    const onScroll = () => close()
    const onWheel = () => close()
    const onTouchMove = () => close()

    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('scroll', onScroll, true)
    document.addEventListener('wheel', onWheel, { capture: true, passive: true })
    document.addEventListener('touchmove', onTouchMove, {
      capture: true,
      passive: true,
    })

    const main = document.querySelector('main')
    main?.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('wheel', onWheel, true)
      document.removeEventListener('touchmove', onTouchMove, true)
      main?.removeEventListener('scroll', onScroll)
    }
  }, [openShareMenuId])

  useEffect(() => {
    return () => {
      if (sharedActionHoverLeaveTimerRef.current) {
        clearTimeout(sharedActionHoverLeaveTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!location.state?.toast) return

    const { type, message } = location.state.toast

    if (type === 'success') toast.success(message)
    else if (type === 'error') toast.error(message)
    else if (type === 'info') toast.info(message)
    else if (type === 'warning') toast.warning(message)
  }, [location.state?.toast])

  const appliedShareTagFocusRef = useRef(false)

  useEffect(() => {
    if (appliedShareTagFocusRef.current) return

    const raw = sessionStorage.getItem('feedFocusTagIdsFromShare')
    if (!raw) return

    let focusIds = []
    try {
      focusIds = JSON.parse(raw) || []
    } catch {
      focusIds = []
    }

    if (
      Array.isArray(selectedTagIds) &&
      selectedTagIds.length > 0 &&
      focusIds.length > 0
    ) {
      const next = selectedTagIds.filter((id) => focusIds.includes(id))
      if (next.length > 0) {
        updateSelectedTags(next)
        sessionStorage.setItem(FEED_MAIN_SCROLL_SESSION_KEY, '0')
        sessionStorage.setItem(feedScrollKey, '0')
      }
    }

    sessionStorage.removeItem('feedFocusTagIdsFromShare')
    appliedShareTagFocusRef.current = true
  }, [selectedTagIds, updateSelectedTags])

  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return

    const primary = sessionStorage.getItem(FEED_MAIN_SCROLL_SESSION_KEY)
    const legacy = sessionStorage.getItem(feedScrollKey)
    const raw = primary !== null ? primary : legacy

    if (raw !== null) {
      const n = Number(raw)
      if (Number.isFinite(n) && n >= 0) feedLastMainScrollRef.current = n
    }

    const save = () => {
      const y = main.scrollTop || 0
      feedLastMainScrollRef.current = y
      sessionStorage.setItem(FEED_MAIN_SCROLL_SESSION_KEY, String(y))
      sessionStorage.setItem(feedScrollKey, String(y))
    }

    main.addEventListener('scroll', save, { passive: true })

    return () => {
      const y = feedLastMainScrollRef.current
      sessionStorage.setItem(FEED_MAIN_SCROLL_SESSION_KEY, String(y))
      sessionStorage.setItem(feedScrollKey, String(y))
      main.removeEventListener('scroll', save)
    }
  }, [])

  useEffect(() => {
    const handlePostSync = (event) => {
      const d = event.detail || {}
      if (!d.postId) return

      const oldSync = JSON.parse(
        localStorage.getItem(`post-sync-${d.postId}`) || '{}'
      )

      const nextSync = {
        ...oldSync,
        ...(typeof d.liked === 'boolean' ? { liked: d.liked } : {}),
        ...(typeof d.likeCount === 'number' ? { likeCount: d.likeCount } : {}),
        ...(typeof d.saved === 'boolean' ? { saved: d.saved } : {}),
        ...(typeof d.saveCount === 'number' ? { saveCount: d.saveCount } : {}),
        ...(typeof d.commentCount === 'number'
          ? { commentCount: d.commentCount }
          : {}),
        ...(typeof d.shareCount === 'number' ? { shareCount: d.shareCount } : {}),
      }

      localStorage.setItem(`post-sync-${d.postId}`, JSON.stringify(nextSync))

      setTimeout(() => {
        const mergeEngagement = (p) => ({
          ...p,
          liked: typeof d.liked === 'boolean' ? d.liked : p.liked,
          likes: typeof d.likeCount === 'number' ? d.likeCount : p.likes,
          saved: typeof d.saved === 'boolean' ? d.saved : p.saved,
          saveCount:
            typeof d.saveCount === 'number' ? d.saveCount : p.saveCount,
          comments:
            typeof d.commentCount === 'number' ? d.commentCount : p.comments,
          comment_count:
            typeof d.commentCount === 'number'
              ? d.commentCount
              : p.comment_count,
          shares: typeof d.shareCount === 'number' ? d.shareCount : p.shares,
          ...(typeof d.title === 'string' ? { title: d.title } : {}),
          ...(typeof d.description === 'string'
            ? { description: d.description }
            : {}),
        })

        setPodcasts((prev) =>
          prev.map((p) => {
            if (String(p.id) === String(d.postId)) {
              const next = mergeEngagement(p)
              if (p.type === 'shared' && d.shareCaption !== undefined) {
                next.share_caption =
                  d.shareCaption === '' || d.shareCaption == null
                    ? ''
                    : String(d.shareCaption)
              }
              return next
            }

            if (p.type === 'shared') return p

            if (feedRowMatchesCanonicalPost(p, d.postId)) {
              return mergeEngagement(p)
            }

            return p
          })
        )

        setSelectedPodcast((prev) => {
          if (!prev) return prev

          if (String(prev.id) === String(d.postId)) {
            const nextSel = mergeEngagement(prev)
            if (prev.type === 'shared' && d.shareCaption !== undefined) {
              nextSel.share_caption =
                d.shareCaption === '' || d.shareCaption == null
                  ? ''
                  : String(d.shareCaption)
            }
            return nextSel
          }

          if (
            prev.type === 'shared' &&
            prev.post_id != null &&
            String(prev.post_id) === String(d.postId)
          ) {
            return mergeEngagement(prev)
          }

          return prev
        })
      }, 0)
    }

    window.addEventListener(POST_SYNC_EVENT, handlePostSync)
    return () => window.removeEventListener(POST_SYNC_EVENT, handlePostSync)
  }, [])

  useEffect(() => {
    const handleRemoved = (event) => {
      const removedId = event.detail?.postId
      if (!removedId) return

      setPodcasts((prev) =>
        prev.filter((p) => !matchesRemovedPost(p, removedId))
      )
      setSelectedPodcast((prev) =>
        prev && matchesRemovedPost(prev, removedId) ? null : prev
      )
    }

    window.addEventListener(POST_REMOVED_EVENT, handleRemoved)
    return () => window.removeEventListener(POST_REMOVED_EVENT, handleRemoved)
  }, [])

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        setLoading(true)
        setError('')

        const token = getToken()
        const currentTab = TABS[activeTab]?.key || 'for_you'
        const hasTagFilter =
          Array.isArray(selectedTagIds) && selectedTagIds.length > 0
        const hasTopicFilter =
          Array.isArray(selectedTopicIds) && selectedTopicIds.length > 0

        const limit = focusPostId
          ? 60
          : hasTagFilter || hasTopicFilter
            ? 40
            : 150

        let url = `${API_BASE_URL}/content/feed/?limit=${limit}&tab=${currentTab}`

        if (selectedTagIds && selectedTagIds.length > 0) {
          url += `&tags=${selectedTagIds.join(',')}`
        }

        if (selectedTopicIds && selectedTopicIds.length > 0) {
          url += `&topics=${selectedTopicIds.join(',')}`
        }

        const res = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const data = await res.json()

        const mapped = (data.items || []).map((item) => {
          const durationSeconds = Number(
            item.audio?.duration_seconds ||
            item.viewer_state?.duration_seconds ||
            0
          )

          const progressSeconds = Number(
            item.viewer_state?.progress_seconds || 0
          )

          const rowId = item.id
          const underlyingPostId = item.post_id || item.id

          const cachedSync = JSON.parse(
            localStorage.getItem(`post-sync-${rowId}`) || 'null'
          )

          const originalCachedSync = item.post_id
            ? JSON.parse(
              localStorage.getItem(`post-sync-${item.post_id}`) || 'null'
            )
            : null

          const syncState =
            item.type === 'shared'
              ? cachedSync || {}
              : cachedSync || originalCachedSync || {}

          const commentCount =
            syncState.commentCount ??
            item.stats?.comments ??
            item.comment_count ??
            item.comments ??
            0

          const savedFromContext = savedPostIds.has(String(underlyingPostId))
          const savedFromSource =
            syncState.saved ?? item.viewer_state?.is_saved ?? false
          const saveCount = syncState.saveCount ?? item.stats?.saves ?? 0

          return {
            id: rowId,
            viewId: rowId,
            type: item.type || 'original',
            post_id: underlyingPostId,
            share_id: item.share_id || null,
            title: item.title,

            author: item.author || {
              name: t('feed.anonymous'),
              username: '',
              avatar_url: '',
            },

            author_avatar: item.author?.avatar_url || '',
            authorUsername: item.author?.username || '',
            authorId: item.author?.id || '',
            authorInitials: getInitials(item.author || 'A'),
            cover: item.thumbnail_url,
            description: item.description || '',
            tags: (item.tags || [])
              .map((tag) => {
                if (tag == null) return ''
                if (typeof tag === 'string') {
                  return tag.startsWith('#') ? tag : `#${tag}`
                }
                const n = tag.name ?? tag.slug ?? ''
                return n ? `#${n}` : ''
              })
              .filter(Boolean),
            tagIds: (item.tags || [])
              .map((tag) => (tag && typeof tag === 'object' ? tag.id : null))
              .filter(Boolean),
            aiGenerated: false,

            duration: formatSeconds(durationSeconds),
            durationSeconds,
            current: formatSeconds(progressSeconds),
            currentSeconds: progressSeconds,
            progress: calcProgress(progressSeconds, durationSeconds),

            likes: syncState.likeCount ?? item.stats?.likes ?? 0,
            liked: syncState.liked ?? item.viewer_state?.is_liked ?? false,

            saved: savedFromContext || savedFromSource,
            saveCount: savedFromContext
              ? Math.max(Number(saveCount || 0), 1)
              : saveCount,

            comments: commentCount,
            comment_count: commentCount,

            timeAgo: formatTimeAgo(item.created_at, t),
            sharedTimeAgo: item.shared_at ? formatTimeAgo(item.shared_at, t) : null,
            postTimeAgo: item.post_created_at
              ? formatTimeAgo(item.post_created_at, t)
              : formatTimeAgo(item.created_at, t),

            sharedBy: item.shared_by || null,
            share_caption: item.share_caption || '',
            listens: t('feed.listens', { count: item.listen_count || 0 }),
            shares: item.stats?.shares || 0,

            audioUrl: resolvePlaybackAudioUrl(item.audio?.audio_url || ''),
            audioId: item.audio?.id || '',
            voiceName: item.audio?.voice_name || '',
          }
        })

        const removedDeletedIds = Array.from(deletedPostIds || [])
        const removedHiddenIds = Array.from(hiddenPostIds || [])

        const visibleMapped = mapped.filter(
          (p) =>
            !removedDeletedIds.some((id) => matchesRemovedPost(p, id)) &&
            !removedHiddenIds.some((id) => matchesRemovedPost(p, id))
        )

        setPodcasts(visibleMapped)

        setSavedPostIds_batch(
          [
            ...new Set([
              ...Array.from(savedPostIds || []),
              ...visibleMapped
                .filter((p) => p.saved && p.type !== 'shared')
                .map((p) => engagementPostId(p))
                .filter(Boolean),
            ]),
          ]
        )
      } catch (err) {
        console.error('Fetch feed failed:', err)
        setError(t('feed.loadError'))
      } finally {
        setLoading(false)

        if (pendingScrollFeedTopAfterShareRef.current) {
          pendingScrollFeedTopAfterShareRef.current = false
          writeFeedScrollSessionKeys(0)
          feedLastMainScrollRef.current = 0

          queueMicrotask(() => {
            requestAnimationFrame(() => {
              const main = document.querySelector('main')
              if (main) {
                main.scrollTop = 0
                main.scrollTo({ top: 0, behavior: 'auto' })
              }
            })
          })
        }
      }
    }

    fetchFeed()
  }, [
    activeTab,
    feedReloadNonce,
    focusPostId,
    i18n.language,
    selectedTagIds,
    selectedTopicIds,
    setSavedPostIds_batch,
  ])

  useEffect(() => {
    if (!savedPostIds?.size) return

    setPodcasts((prev) =>
      prev.map((podcast) => {
        const key = engagementPostId(podcast)
        if (!key || !savedPostIds.has(String(key)) || podcast.saved) {
          return podcast
        }

        return {
          ...podcast,
          saved: true,
          saveCount: Math.max(Number(podcast.saveCount || 0), 1),
        }
      })
    )

    setSelectedPodcast((prev) => {
      if (!prev) return prev
      const key = engagementPostId(prev)
      if (!key || !savedPostIds.has(String(key)) || prev.saved) return prev

      return {
        ...prev,
        saved: true,
        saveCount: Math.max(Number(prev.saveCount || 0), 1),
      }
    })
  }, [savedPostIds])

  useLayoutEffect(() => {
    if (loading || podcasts.length === 0) return
    if (sessionStorage.getItem('returnFromEdit') !== 'true') return

    const scrollTop = Number(sessionStorage.getItem('feedScrollPosition') || 0)
    const openPostId = sessionStorage.getItem('openPostDetailId')

    const restore = () => {
      const main = document.querySelector('main')

      if (main) {
        main.scrollTop = scrollTop
        main.scrollTo({ top: scrollTop, behavior: 'auto' })
        sessionStorage.setItem(FEED_MAIN_SCROLL_SESSION_KEY, String(scrollTop))
        sessionStorage.setItem(feedScrollKey, String(scrollTop))
        feedLastMainScrollRef.current = scrollTop
      }

      if (openPostId) {
        const target = podcasts.find((p) => String(p.id) === String(openPostId))

        if (target) {
          setDisableModalAutoScroll(true)
          setSelectedPodcast(target)
        }
      }

      clearEditReturnSession()
    }

    requestAnimationFrame(() => {
      restore()
      setTimeout(restore, 80)
      setTimeout(restore, 250)
    })
  }, [loading, podcasts, feedScrollKey])

  useLayoutEffect(() => {
    if (loading) return
    if (resetScrollOnBrowserReloadRef.current) return
    if (sessionStorage.getItem('returnFromEdit') === 'true') return

    const primary = sessionStorage.getItem(FEED_MAIN_SCROLL_SESSION_KEY)
    const legacy = sessionStorage.getItem(feedScrollKey)
    const raw = primary !== null && primary !== '' ? primary : legacy

    if (raw === null || raw === '') return

    const savedScroll = Number(raw)
    if (!Number.isFinite(savedScroll) || savedScroll < 0) return

    let cancelled = false
    let rafId = 0
    let attempts = 0
    const maxRafAttempts = 80

    const applyScroll = () => {
      const main = document.querySelector('main')
      if (!main || cancelled) return

      const maxY = Math.max(0, main.scrollHeight - main.clientHeight)
      const y = Math.min(savedScroll, maxY)

      main.scrollTop = y
      main.scrollTo({ top: y, behavior: 'auto' })
      feedLastMainScrollRef.current = y

      attempts += 1

      if (!cancelled && attempts < maxRafAttempts && maxY < savedScroll - 1) {
        rafId = requestAnimationFrame(applyScroll)
      }
    }

    const kick = () => {
      if (cancelled) return
      rafId = requestAnimationFrame(applyScroll)
    }

    kick()

    const timeouts = [50, 120, 240, 400, 700, 1100].map((ms) =>
      setTimeout(kick, ms)
    )

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      timeouts.forEach(clearTimeout)
    }
  }, [loading, podcasts.length, feedScrollKey])

  useEffect(() => {
    if (didHandleFeedReloadScrollReset) return

    const returnFromEdit = sessionStorage.getItem('returnFromEdit') === 'true'

    didHandleFeedReloadScrollReset = true

    if (resetScrollOnBrowserReloadRef.current && !returnFromEdit) {
      sessionStorage.removeItem('feedScrollPosition')
      sessionStorage.removeItem('feedFocusPostId')
      sessionStorage.removeItem('openPostDetailId')
      sessionStorage.removeItem('openPostDetailNoScroll')
      sessionStorage.removeItem(FEED_MAIN_SCROLL_SESSION_KEY)
      sessionStorage.removeItem(feedScrollKey)

      setTimeout(() => {
        const main = document.querySelector('main')
        if (main) {
          main.scrollTop = 0
          main.scrollTo({ top: 0, behavior: 'auto' })
        }
      }, 100)
    }
  }, [feedScrollKey])

  useEffect(() => {
    const handleOpenPostDetail = (event) => {
      const postId = event.detail?.postId
      if (!postId) return

      let target = podcasts.find((p) => String(p.id) === String(postId))

      if (!target && event.detail?.post) {
        // Fallback to post data provided in event
        target = event.detail.post
      }

      if (target) {
        setDisableModalAutoScroll(event.detail?.disableAutoScroll !== false)
        setSelectedPodcast(target)
      }
    }

    window.addEventListener('open-post-detail', handleOpenPostDetail)
    return () => window.removeEventListener('open-post-detail', handleOpenPostDetail)
  }, [podcasts])

  const handleModalToggleLike = async (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()

    if (!selectedPodcast?.id) return

    const canonicalId = engagementPostId(selectedPodcast)
    if (!canonicalId) return

    const isShareCommentModal =
      selectedPodcast?.type === 'shared' &&
      selectedPodcast?.commentModalScope === 'share'

    const apiId = isShareCommentModal ? selectedPodcast.id : canonicalId

    const token = getToken()
    const currentUser = JSON.parse(
      localStorage.getItem('educast_user') ||
      sessionStorage.getItem('educast_user') ||
      'null'
    )

    const res = await fetch(`http://localhost:8000/api/social/posts/${apiId}/like/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ user_id: currentUser?.id }),
    })

    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message || `HTTP ${res.status}`)
    }

    const nextLiked = Boolean(data.data?.liked)
    const nextLikeCount = Number(data.data?.like_count || 0)

    setSelectedPodcast((prev) =>
      prev ? { ...prev, liked: nextLiked, likes: nextLikeCount } : prev
    )

    setPodcasts((prev) =>
      prev.map((p) => {
        if (isShareCommentModal) {
          return String(p.id) === String(selectedPodcast.id)
            ? { ...p, liked: nextLiked, likes: nextLikeCount }
            : p
        }

        if (!feedRowMatchesCanonicalPost(p, canonicalId) || p.type === 'shared') {
          return p
        }

        return { ...p, liked: nextLiked, likes: nextLikeCount }
      })
    )

    dispatchPostSync({
      postId: isShareCommentModal ? selectedPodcast.id : canonicalId,
      liked: nextLiked,
      likeCount: nextLikeCount,
    })

    if (!isShareCommentModal) {
      window.dispatchEvent(
        new CustomEvent('audio-track-like-updated', {
          detail: {
            postId: canonicalId,
            liked: nextLiked,
            likeCount: nextLikeCount,
          },
        })
      )
    }

    return { liked: nextLiked, likeCount: nextLikeCount }
  }

  const handleModalToggleSave = async (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()

    if (!selectedPodcast?.id) return
    if (selectedPodcast.type === 'shared') return

    const canonicalId = engagementPostId(selectedPodcast)
    if (!canonicalId) return

    const token = getToken()
    const currentUser = JSON.parse(
      localStorage.getItem('educast_user') ||
      sessionStorage.getItem('educast_user') ||
      'null'
    )

    const res = await fetch(
      `http://localhost:8000/api/social/posts/${canonicalId}/save/`,
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

    setSelectedPodcast((prev) =>
      prev ? { ...prev, saved: nextSaved, saveCount: nextSaveCount } : prev
    )

    setPodcasts((prev) =>
      prev.map((p) => {
        if (!feedRowMatchesCanonicalPost(p, canonicalId) || p.type === 'shared') {
          return p
        }

        return { ...p, saved: nextSaved, saveCount: nextSaveCount }
      })
    )

    dispatchPostSync({
      postId: canonicalId,
      saved: nextSaved,
      saveCount: nextSaveCount,
    })

    return { saved: nextSaved, saveCount: nextSaveCount }
  }

  const handleFeedSharedLike = async (postId) => {
    try {
      const token = getToken()
      const currentUser = getCurrentUser()
      const post = podcasts.find((p) => p.id === postId)

      if (!post) return

      const canonicalId = engagementPostId(post)
      if (!canonicalId) return

      const apiId = post.type === 'shared' ? post.id : canonicalId

      const res = await fetch(`http://localhost:8000/api/social/posts/${apiId}/like/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ user_id: currentUser?.id }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || `HTTP ${res.status}`)
      }

      const nextLiked = Boolean(data.data?.liked)
      const nextLikeCount = Number(data.data?.like_count || 0)

      setPodcasts((prev) =>
        prev.map((p) => {
          if (post.type === 'shared') {
            return String(p.id) === String(post.id)
              ? { ...p, liked: nextLiked, likes: nextLikeCount }
              : p
          }

          if (!feedRowMatchesCanonicalPost(p, canonicalId) || p.type === 'shared') {
            return p
          }

          return { ...p, liked: nextLiked, likes: nextLikeCount }
        })
      )

      dispatchPostSync({
        postId: post.type === 'shared' ? post.id : canonicalId,
        liked: nextLiked,
        likeCount: nextLikeCount,
      })

      if (post.type !== 'shared') {
        window.dispatchEvent(
          new CustomEvent('audio-track-like-updated', {
            detail: {
              postId: canonicalId,
              liked: nextLiked,
              likeCount: nextLikeCount,
            },
          })
        )
      }
    } catch (err) {
      console.error('Like (share card) failed:', err)
      toast.error(t('personal.likeError'))
    }
  }

  const clearSharedActionHoverLeaveTimer = () => {
    if (sharedActionHoverLeaveTimerRef.current) {
      clearTimeout(sharedActionHoverLeaveTimerRef.current)
      sharedActionHoverLeaveTimerRef.current = null
    }
  }

  const hoverUserLabel = (u) => publicDisplayName(u)

  const handleSharedRowStatsEnter = (podcast, kind) => {
    const rowKey = String(podcast.viewId || podcast.id)

    clearSharedActionHoverLeaveTimer()
    setSharedActionHover({ rowKey, kind, items: [], loading: true })

    const token = getToken()

    void (async () => {
      let url = ''

      if (kind === 'likes') {
        url = `${API_BASE_URL}/social/posts/${encodeURIComponent(
          podcast.id
        )}/likers/`
      } else if (kind === 'comments') {
        url = `${API_BASE_URL}/social/posts/${encodeURIComponent(
          podcast.id
        )}/commenters/`
      } else {
        return
      }

      try {
        const res = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })

        const data = await res.json()

        let items = []
        if (kind === 'likes') {
          items = Array.isArray(data.data?.likers) ? data.data.likers : []
        } else if (kind === 'comments') {
          items = Array.isArray(data.data?.commenters)
            ? data.data.commenters
            : []
        }

        setSharedActionHover((prev) =>
          prev.rowKey !== rowKey || prev.kind !== kind
            ? prev
            : { rowKey, kind, items, loading: false }
        )
      } catch {
        setSharedActionHover((prev) =>
          prev.rowKey !== rowKey || prev.kind !== kind
            ? prev
            : { rowKey, kind, items: [], loading: false }
        )
      }
    })()
  }

  const handleSharedRowStatsLeave = (podcast) => {
    const rowKey = String(podcast.viewId || podcast.id)

    clearSharedActionHoverLeaveTimer()

    sharedActionHoverLeaveTimerRef.current = setTimeout(() => {
      setSharedActionHover((prev) =>
        prev.rowKey === rowKey
          ? { rowKey: null, kind: null, items: [], loading: false }
          : prev
      )
    }, 140)
  }

  const handleSharedRowStatsPopupEnter = () => {
    clearSharedActionHoverLeaveTimer()
  }

  const sharedHoverEmptyLabel = (kind) => {
    if (kind === 'likes') return t('feed.noLikes')
    if (kind === 'comments') return t('feed.noComments')
    return t('feed.noShares')
  }

  const handleOpenPostModal = (podcast) => {
    setDisableModalAutoScroll(true)
    setSelectedPodcast({
      ...podcast,
      commentModalScope: 'original',
      timeAgo: podcast.type === 'shared' ? podcast.postTimeAgo : podcast.timeAgo,
    })
  }

  const closeSharedRowConfirm = () => {
    setSharedRowConfirm({ open: false, mode: null, podcast: null })
  }

  const executeUnshareFeedPost = async (podcast) => {
    if (!podcast) return

    try {
      const token = getToken()
      const user = getCurrentUser()

      const res = await fetch(
        `${API_BASE_URL}/social/posts/${podcast.post_id}/unshare/`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ user_id: user?.id }),
        }
      )

      let data = {}
      try {
        data = await res.json()
      } catch {
        data = {}
      }

      if (!res.ok) {
        throw new Error(data.message || `HTTP ${res.status}`)
      }

      preserveMainScrollAfterListUpdate(() => {
        pauseTrackIfDeleted(podcast.id)
        deletePost(podcast.id)
        setPodcasts((prev) =>
          prev.filter((p) => String(p.id) !== String(podcast.id))
        )
      })

      setOpenShareMenuId(null)
    } catch (err) {
      console.error(err)
      toast.error(err.message || t('feed.unshareFailed'))
    }
  }

  const executeHideSharedFeedRow = async (podcast) => {
    if (!podcast) return

    preserveMainScrollAfterListUpdate(() => {
      pauseTrackIfDeleted(podcast.id)
      hidePost(podcast.id)
      setPodcasts((prev) =>
        prev.filter((p) => String(p.id) !== String(podcast.id))
      )
    })

    setOpenShareMenuId(null)
  }

  const renderSharedPost = (podcast) => {
    const sharedBy = podcast.sharedBy || {}
    const rowKey = String(podcast.viewId || podcast.id)
    const avatarKey = `share-${podcast.viewId || podcast.id}`
    const shareAuthorName = sharedBy.name || sharedBy.username || t('feed.anonymous')
    const shareAuthorInitials = getInitials(sharedBy || shareAuthorName)
    const currentUser = getCurrentUser()

    const sharedByUserId =
      sharedBy.id ?? sharedBy.user_id ?? sharedBy.pk ?? sharedBy.userId

    const currentUserId =
      currentUser?.id ??
      currentUser?.user_id ??
      currentUser?.pk ??
      currentUser?.userId

    const isShareRowOwner =
      sharedByUserId != null &&
      currentUserId != null &&
      String(currentUserId) === String(sharedByUserId)

    const openSharedAuthorProfile = (event) => {
      event?.stopPropagation?.()
      if (sharedByUserId == null || sharedByUserId === '') return
      navigate(`/profile/${sharedByUserId}`)
    }

    return (
      <div
        key={podcast.viewId || podcast.id}
        className={styles.postShareContainer}
        data-post-id={podcast.id}
      >
        <div className={styles.postShareWrapper}>
          <div className={styles.postShareInfo}>
            <div
              className={styles.postShareAuthor}
            >
              {sharedBy.avatar_url && !failedAvatarUrls.has(avatarKey) ? (
                <div 
                  className={`${styles.postShareAvatarWrapper} ${sharedByUserId ? styles.postShareAuthorClickable : ''}`}
                  role={sharedByUserId ? 'button' : undefined}
                  tabIndex={sharedByUserId ? 0 : undefined}
                  onClick={openSharedAuthorProfile}
                  onKeyDown={(event) => {
                    if ((event.key === 'Enter' || event.key === ' ') && sharedByUserId) {
                      event.preventDefault()
                      openSharedAuthorProfile(event)
                    }
                  }}
                >
                  <img
                    src={sharedBy.avatar_url}
                    alt={shareAuthorName}
                    className={styles.postShareAvatar}
                    onError={() => {
                      setFailedAvatarUrls((prev) => new Set([...prev, avatarKey]))
                    }}
                  />
                </div>
              ) : (
                <div 
                  className={`${styles.postShareAvatarWrapper} ${sharedByUserId ? styles.postShareAuthorClickable : ''}`}
                  role={sharedByUserId ? 'button' : undefined}
                  tabIndex={sharedByUserId ? 0 : undefined}
                  onClick={openSharedAuthorProfile}
                  onKeyDown={(event) => {
                    if ((event.key === 'Enter' || event.key === ' ') && sharedByUserId) {
                      event.preventDefault()
                      openSharedAuthorProfile(event)
                    }
                  }}
                >
                  <div className={styles.postShareAvatarInitials}>
                    {shareAuthorInitials}
                  </div>
                </div>
              )}

              <div className={styles.postShareAuthorInfo}>
                <div className={styles.postShareAuthorMetaRow}>
                  <span className={styles.postShareAuthorName}>
                    {shareAuthorName}
                  </span>
                  <span className={styles.postShareMetaDot}>•</span>
                  <span className={styles.postShareMetaText}>
                    {podcast.sharedTimeAgo || podcast.timeAgo}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.shareMenuWrap} data-share-feed-menu>
              <button
                type="button"
                className={styles.shareMenuBtn}
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenShareMenuId(openShareMenuId === rowKey ? null : rowKey)
                }}
                aria-label={t('feed.options')}
              >
                <MoreHorizontal size={20} />
              </button>

              {openShareMenuId === rowKey && (
                <div className={styles.shareMenuDropdown}>
                  {isShareRowOwner ? (
                    <>
                      <button
                        type="button"
                        className={styles.shareMenuOption}
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          setOpenShareMenuId(null)
                          setEditShareCaptionPodcast(podcast)
                        }}
                      >
                        <Edit size={14} />
                        <span>{t('feed.edit')}</span>
                      </button>

                      <button
                        type="button"
                        className={`${styles.shareMenuOption} ${styles.shareMenuOptionDanger}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenShareMenuId(null)
                          setSharedRowConfirm({
                            open: true,
                            mode: 'unshare',
                            podcast,
                          })
                        }}
                      >
                        <Trash2 size={14} />
                        <span>{t('feed.delete')}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={styles.shareMenuOption}
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenShareMenuId(null)
                          setSharedRowConfirm({
                            open: true,
                            mode: 'hide',
                            podcast,
                          })
                        }}
                      >
                        <EyeOff size={14} />
                        <span>{t('feed.hidePost')}</span>
                      </button>

                      <button
                        type="button"
                        className={`${styles.shareMenuOption} ${styles.shareMenuOptionDanger}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenShareMenuId(null)
                          setReportSharePodcast(podcast)
                        }}
                      >
                        <Flag size={14} />
                        <span>{t('feed.report')}</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {podcast.share_caption && (
            <div className={styles.shareCaption}>
              <p>{podcast.share_caption}</p>
            </div>
          )}

          <div
            className={styles.postShareCard}
            onClick={() => handleOpenPostModal(podcast)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleOpenPostModal(podcast)
            }}
            title={t('feed.viewOriginalPost')}
          >
            <PodcastCard
              podcast={{
                ...podcast,
                timeAgo: podcast.postTimeAgo || podcast.timeAgo,
              }}
              queue={podcasts}
              onDelete={handleDeletePost}
              onHide={handleHidePost}
              hideMenu={true}
              hideActions={true}
              embedInShare={true}
            />
          </div>

          <div className={styles.postShareActions}>
            <div className={styles.shareStatWrap}>
              <button
                type="button"
                className={`${styles.shareActionBtn} ${podcast.liked ? styles.liked : ''
                  }`}
                onClick={(e) => {
                  e.stopPropagation()
                  handleFeedSharedLike(podcast.id)
                }}
              >
                <Heart size={16} fill={podcast.liked ? 'currentColor' : 'none'} />
                <span
                  onMouseEnter={() => handleSharedRowStatsEnter(podcast, 'likes')}
                  onMouseLeave={() => handleSharedRowStatsLeave(podcast)}
                >
                  {podcast.likes ?? 0}
                </span>
              </button>

              {sharedActionHover.rowKey === rowKey &&
                sharedActionHover.kind === 'likes' && (
                  <div
                    className={styles.shareSharerPopup}
                    onMouseEnter={handleSharedRowStatsPopupEnter}
                    onMouseLeave={() => handleSharedRowStatsLeave(podcast)}
                  >
                    {sharedActionHover.loading ? (
                      <div className={styles.shareSharerEmpty}>
                        {t('common.loading')}
                      </div>
                    ) : sharedActionHover.items.length > 0 ? (
                      sharedActionHover.items.map((u) => (
                        <div
                          key={u.user_id || u.username}
                          className={styles.shareSharerRow}
                        >
                          {hoverUserLabel(u)}
                        </div>
                      ))
                    ) : (
                      <div className={styles.shareSharerEmpty}>
                        {sharedHoverEmptyLabel('likes')}
                      </div>
                    )}
                  </div>
                )}
            </div>

            <div className={styles.shareStatWrap}>
              <button
                type="button"
                className={styles.shareActionBtn}
                onClick={(e) => {
                  e.stopPropagation()
                  setDisableModalAutoScroll(false)
                  setSelectedPodcast({
                    ...podcast,
                    commentModalScope: 'share',
                  })
                }}
              >
                <MessageCircle size={16} />
                <span
                  onMouseEnter={() => handleSharedRowStatsEnter(podcast, 'comments')}
                  onMouseLeave={() => handleSharedRowStatsLeave(podcast)}
                >
                  {t('feed.comments', { count: podcast.comments || 0 })}
                </span>
              </button>

              {sharedActionHover.rowKey === rowKey &&
                sharedActionHover.kind === 'comments' && (
                  <div
                    className={styles.shareSharerPopup}
                    onMouseEnter={handleSharedRowStatsPopupEnter}
                    onMouseLeave={() => handleSharedRowStatsLeave(podcast)}
                  >
                    {sharedActionHover.loading ? (
                      <div className={styles.shareSharerEmpty}>
                        {t('common.loading')}
                      </div>
                    ) : sharedActionHover.items.length > 0 ? (
                      sharedActionHover.items.map((u) => (
                        <div
                          key={u.user_id || u.username}
                          className={styles.shareSharerRow}
                        >
                          {hoverUserLabel(u)}
                        </div>
                      ))
                    ) : (
                      <div className={styles.shareSharerEmpty}>
                        {sharedHoverEmptyLabel('comments')}
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const handleDeletePost = (postId) => {
    preserveMainScrollAfterListUpdate(() => {
      pauseTrackIfDeleted(postId)
      deletePost(postId)
      setPodcasts((prev) =>
        prev.filter((p) => !matchesRemovedPost(p, postId))
      )
    })
  }

  const handleHidePost = (postId) => {
    preserveMainScrollAfterListUpdate(() => {
      pauseTrackIfDeleted(postId)
      hidePost(postId)
      setPodcasts((prev) =>
        prev.filter((p) => !matchesRemovedPost(p, postId))
      )
    })
  }

  const topicOptions = []
  const tagOptions = []
  const filtersLoading = false
  const hasActiveFilters = false
  const handleToggleTopicFilter = () => undefined
  const handleToggleTagFilter = () => undefined
  const handleClearFilters = () => undefined

  return (
    <section className={styles.feed}>
      <CreatePostBar />

      <div className={styles.feedFilters}>
        <div className={styles.filterGroup}>
          <div className={styles.filterHeader}>
            <span>Topic</span>
          </div>

          <div className={styles.filterChips}>
            {topicOptions.map((topic) => {
              const active = (selectedTopicIds || [])
                .map(String)
                .includes(String(topic.id))

              return (
                <button
                  key={topic.id}
                  type="button"
                  className={`${styles.filterChip} ${active ? styles.filterChipActive : ''
                    }`}
                  onClick={() => handleToggleTopicFilter(topic.id)}
                >
                  {topic.name}
                </button>
              )
            })}

            {!filtersLoading && topicOptions.length === 0 && (
              <span className={styles.filterEmpty}>Chưa có topic</span>
            )}
          </div>
        </div>

        <div className={styles.filterGroup}>
          <div className={styles.filterHeader}>
            <span>Tag</span>

            {hasActiveFilters && (
              <button
                type="button"
                className={styles.clearFiltersBtn}
                onClick={handleClearFilters}
              >
                Bỏ lọc
              </button>
            )}
          </div>

          <div className={styles.filterChips}>
            {tagOptions.map((tag) => {
              const active = (selectedTagIds || [])
                .map(String)
                .includes(String(tag.id))

              return (
                <button
                  key={tag.id}
                  type="button"
                  className={`${styles.filterChip} ${active ? styles.filterChipActive : ''
                    }`}
                  onClick={() => handleToggleTagFilter(tag.id)}
                >
                  #{tag.name}
                </button>
              )
            })}

            {!filtersLoading && tagOptions.length === 0 && (
              <span className={styles.filterEmpty}>Chưa có tag</span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.tabs}>
        {TABS.map((tab, i) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === i ? styles.active : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <div className={styles.cards}>
        {loading && <div className={styles.feedState}>{t('feed.loading')}</div>}

        {error && <div className={styles.feedError}>{error}</div>}

        {!loading &&
          !error &&
          podcasts.map((podcast) =>
            podcast.type === 'shared' ? (
              renderSharedPost(podcast)
            ) : (
              <div key={podcast.viewId || podcast.id} data-post-id={podcast.id}>
                <PodcastCard
                  podcast={podcast}
                  queue={podcasts}
                  onDelete={handleDeletePost}
                  onHide={handleHidePost}
                />
              </div>
            )
          )}
      </div>

      {selectedPodcast && (
        <CommentModal
          podcast={selectedPodcast}
          disableAutoScroll={disableModalAutoScroll}
          liked={selectedPodcast.liked}
          saved={selectedPodcast.saved}
          likeCount={selectedPodcast.likes}
          shareCount={selectedPodcast.shares}
          saveCount={selectedPodcast.saveCount}
          commentCount={selectedPodcast.comments}
          onToggleLike={handleModalToggleLike}
          onToggleSave={handleModalToggleSave}
          onCommentCountChange={(newCount) => {
            const canonicalId = engagementPostId(selectedPodcast)
            const isShareCommentModal =
              selectedPodcast?.type === 'shared' &&
              selectedPodcast?.commentModalScope === 'share'

            if (isShareCommentModal && selectedPodcast?.id != null) {
              setPodcasts((prev) =>
                prev.map((p) =>
                  String(p.id) === String(selectedPodcast.id)
                    ? {
                      ...p,
                      comments: newCount,
                      comment_count: newCount,
                    }
                    : p
                )
              )

              setSelectedPodcast((prev) =>
                prev
                  ? { ...prev, comments: newCount, comment_count: newCount }
                  : prev
              )

              dispatchPostSync({
                postId: selectedPodcast.id,
                commentCount: newCount,
              })

              return
            }

            if (canonicalId == null) return

            setPodcasts((prev) =>
              prev.map((p) =>
                feedRowMatchesCanonicalPost(p, canonicalId) &&
                  p.type !== 'shared'
                  ? { ...p, comments: newCount, comment_count: newCount }
                  : p
              )
            )

            setSelectedPodcast((prev) =>
              prev && feedRowMatchesCanonicalPost(prev, canonicalId)
                ? { ...prev, comments: newCount, comment_count: newCount }
                : prev
            )

            dispatchPostSync({
              postId: canonicalId,
              commentCount: newCount,
            })
          }}
          onClose={() => {
            setSelectedPodcast(null)
            setDisableModalAutoScroll(true)
          }}
          onPostDeleted={(deletedId) => {
            preserveMainScrollAfterListUpdate(() => {
              pauseTrackIfDeleted(deletedId)
              setPodcasts((prev) =>
                prev.filter(
                  (p) => !matchesRemovedPost(p, deletedId)
                )
              )
              setSelectedPodcast(null)
            })
          }}
        />
      )}

      <EditShareCaptionModal
        isOpen={Boolean(editShareCaptionPodcast)}
        compositeRowId={editShareCaptionPodcast?.id}
        initialCaption={editShareCaptionPodcast?.share_caption ?? ''}
        onClose={() => setEditShareCaptionPodcast(null)}
        onSaved={(caption) => {
          const row = editShareCaptionPodcast
          if (!row) return

          dispatchPostSync({
            postId: row.viewId || row.id,
            shareCaption: caption,
          })
        }}
      />

      {reportSharePodcast && (
        <ReportPostModal
          postId={reportSharePodcast.post_id}
          postTitle={reportSharePodcast.title}
          authorId={reportSharePodcast.authorId}
          authorName={
            typeof reportSharePodcast.author === 'object' &&
              reportSharePodcast.author != null
              ? reportSharePodcast.author.name ||
              reportSharePodcast.author.username ||
              t('feed.anonymous')
              : reportSharePodcast.author || t('feed.anonymous')
          }
          onClose={() => setReportSharePodcast(null)}
        />
      )}

      <ConfirmModal
        isOpen={sharedRowConfirm.open}
        type="confirm"
        title={
          sharedRowConfirm.mode === 'hide'
            ? t('feed.confirm.hidePostTitle')
            : t('feed.confirm.deletePostTitle')
        }
        message={
          sharedRowConfirm.mode === 'hide'
            ? t('feed.confirm.hideSharedFeedMessage')
            : t('feed.confirm.deletePostMessage')
        }
        confirmText={
          sharedRowConfirm.mode === 'hide'
            ? t('feed.confirm.hide')
            : t('common.delete')
        }
        cancelText={t('common.cancel')}
        isDangerous={sharedRowConfirm.mode !== 'hide'}
        onCancel={closeSharedRowConfirm}
        onConfirm={() => {
          const p = sharedRowConfirm.podcast
          const m = sharedRowConfirm.mode

          if (!p || !m) return

          closeSharedRowConfirm()

          if (m === 'unshare') void executeUnshareFeedPost(p)
          else if (m === 'hide') void executeHideSharedFeedRow(p)
        }}
      />
    </section>
  )
}

function clearEditReturnSession() {
  sessionStorage.removeItem('returnFromEdit')
  sessionStorage.removeItem('feedScrollPosition')
  sessionStorage.removeItem('feedFocusPostId')
  sessionStorage.removeItem('openPostDetailId')
  sessionStorage.removeItem('openPostDetailNoScroll')
  sessionStorage.removeItem('returnToAfterEdit')
}

function formatSeconds(seconds) {
  const total = Number(seconds || 0)
  const mins = Math.floor(total / 60)
  const secs = total % 60

  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function calcProgress(current, duration) {
  const c = Number(current || 0)
  const d = Number(duration || 0)

  if (!d) return 0

  return Math.min(100, Math.round((c / d) * 100))
}

function formatTimeAgo(dateString, t) {
  if (!dateString) return t('feed.time.justNow')

  const created = new Date(dateString)
  const now = new Date()
  const diffMs = now - created
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return t('feed.time.justNow')
  if (diffMinutes < 60) return t('feed.time.minutesAgo', { count: diffMinutes })
  if (diffHours < 24) return t('feed.time.hoursAgo', { count: diffHours })

  return t('feed.time.daysAgo', { count: diffDays })
}
