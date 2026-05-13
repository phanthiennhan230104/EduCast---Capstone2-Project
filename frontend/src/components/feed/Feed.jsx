import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useLocation } from 'react-router-dom'
import {
  Bookmark,
  Edit,
  EyeOff,
  Flag,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Share2,
  Trash2,
} from 'lucide-react'
import { toast } from 'react-toastify'

import PodcastCard from './PodcastCard'
import ReportPostModal from './ReportPostModal'
import CreatePostBar from './CreatePostBar'
import CommentModal from './CommentModal'
import ShareModal from './ShareModal'
import EditShareCaptionModal from './EditShareCaptionModal'
import ConfirmModal from './ConfirmModal'
import SaveCollectionModal from '../common/SaveCollectionModal'

import styles from '../../style/feed/Feed.module.css'
import { API_BASE_URL, API_ORIGIN } from '../../config/apiBase'
import {
  FEED_MAIN_SCROLL_SESSION_KEY,
  FEED_SCROLL_LEGACY_KEY,
  preserveMainScrollAfterListUpdate,
  writeFeedScrollSessionKeys,
} from '../../utils/feedScrollSession'
import { getInitials } from '../../utils/getInitials'
import { getToken, getCurrentUser } from '../../utils/auth'
import { EDUCAST_PERSONAL_SHARE_SUCCESS, consumePendingFeedReloadFromPersonalShare } from '../../utils/appEvents'
import { publicDisplayName } from '../../utils/publicDisplayName'
import { useTagFilter } from '../contexts/TagFilterContext'
import { PodcastContext } from '../contexts/PodcastContext'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'

const TABS = [
  { label: 'Dành cho bạn', key: 'for_you' },
  { label: 'Đang theo dõi', key: 'following' },
  { label: 'Xu hướng', key: 'trending' },
  { label: 'Mới nhất', key: 'latest' },
]

const POST_SYNC_EVENT = 'post-sync-updated'

const feedScrollKey = FEED_SCROLL_LEGACY_KEY

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

/** Đảm bảo audio tải từ backend, không resolve /media... lên origin Vite. */
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
  const location = useLocation()

  const { selectedTagIds, updateSelectedTags } = useTagFilter()
  const selectedTagIdsRef = useRef(selectedTagIds)
  selectedTagIdsRef.current = selectedTagIds
  const { setSavedPostIds_batch, deletePost, hidePost, addSavedPost, removeSavedPost } =
    useContext(PodcastContext)

  const { pauseTrackIfDeleted } = useAudioPlayer()

  const [activeTab, setActiveTab] = useState(() => {
    const saved = sessionStorage.getItem('feedActiveTab')
    return saved ? parseInt(saved, 10) : 0
  })

  const [disableModalAutoScroll, setDisableModalAutoScroll] = useState(false)
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

  const [shareModalPodcast, setShareModalPodcast] = useState(null)
  const [editShareCaptionPodcast, setEditShareCaptionPodcast] = useState(null)
  const [showCollectionModal, setShowCollectionModal] = useState(false)
  const [collectionTargetPodcast, setCollectionTargetPodcast] = useState(null)
  const sharedSaveBtnRef = useRef(null)
  const [feedReloadNonce, setFeedReloadNonce] = useState(0)
  const [sharedActionHover, setSharedActionHover] = useState({
    rowKey: null,
    kind: null,
    items: [],
    loading: false,
  })
  const sharedActionHoverLeaveTimerRef = useRef(null)
  /** Tránh ghi scroll=0 khi unmount: lúc đó main đã trống, scrollTop bị reset. */
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
    setFeedReloadNonce((n) => n + 1)
  }, [])

  const feedScrollKey = 'mainScroll:/feed'
  const focusPostId = sessionStorage.getItem('feedFocusPostId')

  const dispatchPostSync = (payload) => {
    window.dispatchEvent(new CustomEvent(POST_SYNC_EVENT, { detail: payload }))
  }

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
      window.removeEventListener(EDUCAST_PERSONAL_SHARE_SUCCESS, onPersonalShareSuccess)
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
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: true })
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

  // Nếu vừa share về trang cá nhân xong, ta có thể lưu tag của bài viết gốc.
  // Khi quay lại /feed, chỉ áp dụng filter theo các tag đó nếu tag nằm trong bộ tag user đang lọc.
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

    // Chỉ áp dụng nếu user đang có filter tag trên feed (selectedTagIds != []).
    // Nếu không có filter, đừng auto lọc (để tránh "chỉ còn 1 bài").
    if (Array.isArray(selectedTagIds) && selectedTagIds.length > 0 && focusIds.length > 0) {
      const next = selectedTagIds.filter((id) => focusIds.includes(id))
      if (next.length > 0) {
        updateSelectedTags(next)
        // Khi focus tag theo bài gốc, ưu tiên kéo lên đầu feed.
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
          likes:
            typeof d.likeCount === 'number' ? d.likeCount : p.likes,
          saved: typeof d.saved === 'boolean' ? d.saved : p.saved,
          saveCount:
            typeof d.saveCount === 'number' ? d.saveCount : p.saveCount,
          comments:
            typeof d.commentCount === 'number'
              ? d.commentCount
              : p.comments,
          comment_count:
            typeof d.commentCount === 'number'
              ? d.commentCount
              : p.comment_count,
          shares:
            typeof d.shareCount === 'number' ? d.shareCount : p.shares,
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
    const fetchFeed = async () => {
      try {
        setLoading(true)
        setError('')

        const token = getToken()
        const currentTab = TABS[activeTab]?.key || 'for_you'
        const hasTagFilter =
          Array.isArray(selectedTagIds) && selectedTagIds.length > 0
        // Không lọc tag: tải nhiều dòng hơn để vừa bài gốc vừa share không bị “cắt” còn vài bài.
        const limit = focusPostId
          ? 60
          : hasTagFilter
            ? 40
            : 150

        let url = `${API_BASE_URL}/content/feed/?limit=${limit}&tab=${currentTab}`

        if (selectedTagIds && selectedTagIds.length > 0) {
          url += `&tags=${selectedTagIds.join(',')}`
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

          // Id duy nhất mỗi dòng feed — bài share dùng composite share_<shareId>_<postId>;
          // like/save/API và post-sync dùng post_id (bài gốc).
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
          // Card share (ngoài): chỉ cache theo id dòng share — không gộp trạng thái bài gốc.
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

          return {
            id: rowId,
            viewId: rowId,
            type: item.type || 'original',
            post_id: underlyingPostId,
            share_id: item.share_id || null,
            title: item.title,

            author: item.author || {
              name: 'Ẩn danh',
              username: '',
              avatar_url: '',
            },

            author_avatar: item.author?.avatar_url || '',
            authorUsername: item.author?.username || '',
            authorId: item.author?.id || '',
            authorInitials: getInitials(item.author || 'A'),
            cover: item.thumbnail_url,
            description: item.description || '',
            tags: (item.tags || []).map((tag) => {
              if (tag == null) return ''
              if (typeof tag === 'string') return tag.startsWith('#') ? tag : `#${tag}`
              const n = tag.name ?? tag.slug ?? ''
              return n ? `#${n}` : ''
            }).filter(Boolean),
            tagIds: (item.tags || []).map((tag) =>
              tag && typeof tag === 'object' ? tag.id : null
            ).filter(Boolean),
            aiGenerated: false,

            duration: formatSeconds(durationSeconds),
            durationSeconds,
            current: formatSeconds(progressSeconds),
            currentSeconds: progressSeconds,
            progress: calcProgress(progressSeconds, durationSeconds),

            likes:
              syncState.likeCount ??
              item.stats?.likes ??
              0,
            liked:
              syncState.liked ?? item.viewer_state?.is_liked ?? false,

            saved:
              syncState.saved ?? item.viewer_state?.is_saved ?? false,
            saveCount:
              syncState.saveCount ?? item.stats?.saves ?? 0,

            comments: commentCount,
            comment_count: commentCount,

            timeAgo: formatTimeAgo(item.created_at),
            sharedTimeAgo: item.shared_at ? formatTimeAgo(item.shared_at) : null,
            postTimeAgo: item.post_created_at ? formatTimeAgo(item.post_created_at) : formatTimeAgo(item.created_at),
            sharedBy: item.shared_by || null,
            share_caption: item.share_caption || '',
            listens: `${item.listen_count || 0} lượt nghe`,
            shares: item.stats?.shares || 0,

            audioUrl: resolvePlaybackAudioUrl(item.audio?.audio_url || ''),
            audioId: item.audio?.id || '',
            voiceName: item.audio?.voice_name || '',
          }
        })

        setPodcasts(mapped)
        setSavedPostIds_batch(
          [
            ...new Set(
              mapped
                .filter((p) => p.saved)
                .map((p) =>
                  p.type === 'shared' ? p.id : engagementPostId(p)
                )
                .filter(Boolean)
            ),
          ]
        )
      } catch (err) {
        console.error('Fetch feed failed:', err)
        setError('Không tải được feed')
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
  }, [activeTab, selectedTagIds, focusPostId, setSavedPostIds_batch, feedReloadNonce])

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
        const target = podcasts.find(
          (p) => String(p.id) === String(openPostId)
        )

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
  }, [loading, podcasts])

  useLayoutEffect(() => {
    if (loading) return
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
      if (
        !cancelled &&
        attempts < maxRafAttempts &&
        maxY < savedScroll - 1
      ) {
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
    const navType = performance.getEntriesByType('navigation')[0]?.type
    const returnFromEdit = sessionStorage.getItem('returnFromEdit') === 'true'

    if (navType === 'reload' && !returnFromEdit) {
      sessionStorage.removeItem('feedScrollPosition')
      sessionStorage.removeItem('feedFocusPostId')
      sessionStorage.removeItem('openPostDetailId')
      sessionStorage.removeItem('openPostDetailNoScroll')
      sessionStorage.removeItem(FEED_MAIN_SCROLL_SESSION_KEY)
      sessionStorage.removeItem(feedScrollKey)

      setTimeout(() => {
        const main = document.querySelector('main')
        if (main) main.scrollTop = 0
      }, 100)
    }
  }, [])

  useEffect(() => {
    const handleOpenPostDetail = (event) => {
      const postId = event.detail?.postId
      if (!postId) return

      const target = podcasts.find((p) => String(p.id) === String(postId))

      if (target) {
        setDisableModalAutoScroll(Boolean(event.detail?.disableAutoScroll))
        setSelectedPodcast(target)
      }
    }

    window.addEventListener('open-post-detail', handleOpenPostDetail)
    return () =>
      window.removeEventListener('open-post-detail', handleOpenPostDetail)
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
    const syncPostId = isShareCommentModal ? selectedPodcast.id : canonicalId

    const token = getToken()
    const currentUser = JSON.parse(
      localStorage.getItem('educast_user') || sessionStorage.getItem('educast_user') || 'null'
    )

    const res = await fetch(
      `http://localhost:8000/api/social/posts/${apiId}/like/`,
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
    if (!res.ok || !data.success) return

    const nextLiked = Boolean(data.data?.liked)
    const nextLikeCount = Number(data.data?.like_count || 0)

    setSelectedPodcast((prev) =>
      prev ? { ...prev, liked: nextLiked, likes: nextLikeCount } : prev
    )

    setPodcasts((prev) =>
      prev.map((p) => {
        if (
          isShareCommentModal &&
          p.type === 'shared' &&
          String(p.id) === String(selectedPodcast.id)
        ) {
          return { ...p, liked: nextLiked, likes: nextLikeCount }
        }
        if (p.type === 'shared') return p
        if (!feedRowMatchesCanonicalPost(p, canonicalId)) return p
        return { ...p, liked: nextLiked, likes: nextLikeCount }
      })
    )

    dispatchPostSync({
      postId: syncPostId,
      liked: nextLiked,
      likeCount: nextLikeCount,
    })

    window.dispatchEvent(
      new CustomEvent('audio-track-like-updated', {
        detail: {
          postId: syncPostId,
          liked: nextLiked,
          likeCount: nextLikeCount,
        },
      })
    )
  }

  const handleModalToggleSave = async (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()

    if (!selectedPodcast?.id) return

    const canonicalId = engagementPostId(selectedPodcast)
    if (!canonicalId) return

    const isShareCommentModal =
      selectedPodcast?.type === 'shared' &&
      selectedPodcast?.commentModalScope === 'share'
    const apiId = isShareCommentModal ? selectedPodcast.id : canonicalId
    const syncPostId = isShareCommentModal ? selectedPodcast.id : canonicalId

    const token = getToken()
    const currentUser = JSON.parse(
      localStorage.getItem('educast_user') || sessionStorage.getItem('educast_user') || 'null'
    )

    const res = await fetch(
      `http://localhost:8000/api/social/posts/${apiId}/save/`,
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
    if (!res.ok || !data.success) return

    const nextSaved = Boolean(data.data?.saved)
    const nextSaveCount = Number(data.data?.save_count || 0)

    setSelectedPodcast((prev) =>
      prev ? { ...prev, saved: nextSaved, saveCount: nextSaveCount } : prev
    )

    setPodcasts((prev) =>
      prev.map((p) => {
        if (
          isShareCommentModal &&
          p.type === 'shared' &&
          String(p.id) === String(selectedPodcast.id)
        ) {
          return { ...p, saved: nextSaved, saveCount: nextSaveCount }
        }
        if (p.type === 'shared') return p
        if (!feedRowMatchesCanonicalPost(p, canonicalId)) return p
        return { ...p, saved: nextSaved, saveCount: nextSaveCount }
      })
    )

    dispatchPostSync({
      postId: syncPostId,
      saved: nextSaved,
      saveCount: nextSaveCount,
    })
  }

  const handleFeedSharedLike = async (postId) => {
    try {
      const token = getToken()
      const currentUser = getCurrentUser()
      const post = podcasts.find((p) => p.id === postId)
      if (!post) return

      const apiId = post.type === 'shared' ? post.id : engagementPostId(post)
      if (!apiId) return

      const res = await fetch(
        `http://localhost:8000/api/social/posts/${apiId}/like/`,
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

      setPodcasts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, liked: nextLiked, likes: nextLikeCount } : p
        )
      )

      dispatchPostSync({
        postId,
        liked: nextLiked,
        likeCount: nextLikeCount,
      })

      window.dispatchEvent(
        new CustomEvent('audio-track-like-updated', {
          detail: {
            postId,
            liked: nextLiked,
            likeCount: nextLikeCount,
          },
        })
      )
    } catch (err) {
      console.error('Like (share card) failed:', err)
      toast.error('Lỗi khi thích bài viết')
    }
  }

  const handleFeedSharedSave = async (postId) => {
    try {
      const podcast = podcasts.find((p) => p.id === postId)
      if (!podcast) return

      const apiId =
        podcast.type === 'shared' ? podcast.id : engagementPostId(podcast)
      if (!apiId) return

      if (podcast.saved) {
        const token = getToken()
        const currentUser = getCurrentUser()

        const res = await fetch(
          `http://localhost:8000/api/social/posts/${apiId}/save/`,
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

        const nextSaveCount = Number(data.data?.save_count || 0)

        setPodcasts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, saved: false, saveCount: nextSaveCount }
              : p
          )
        )

        removeSavedPost(apiId)

        dispatchPostSync({
          postId,
          saved: false,
          saveCount: nextSaveCount,
        })
      } else {
        setCollectionTargetPodcast(podcast)
        setShowCollectionModal(true)
      }
    } catch (err) {
      console.error('Save (share card) failed:', err)
      toast.error('Lỗi khi lưu bài viết')
    }
  }

  const handleFeedCollectionSave = () => {
    const target = collectionTargetPodcast
    if (!target) return
    const rowId = target.id
    const apiId =
      target.type === 'shared' ? target.id : engagementPostId(target)
    if (!apiId) return

    const prevCount =
      podcasts.find((p) => p.id === rowId)?.saveCount || 0
    const newSaveCount = prevCount + 1

    setPodcasts((prev) =>
      prev.map((p) =>
        p.id === rowId ? { ...p, saved: true, saveCount: newSaveCount } : p
      )
    )

    addSavedPost(apiId)

    dispatchPostSync({
      postId: rowId,
      saved: true,
      saveCount: newSaveCount,
    })

    setShowCollectionModal(false)
    setCollectionTargetPodcast(null)
  }

  const handleFeedShareSuccess = (sourcePodcast, data) => {
    const newShareCount = Number(data?.share_count ?? NaN)
    if (Number.isNaN(newShareCount)) return
    if (!sourcePodcast) return

    const rowKey = String(sourcePodcast.viewId ?? sourcePodcast.id ?? '')
    const isSharedRow =
      sourcePodcast.type === 'shared' ||
      /^share_/i.test(String(sourcePodcast.id ?? ''))

    if (isSharedRow && rowKey) {
      setPodcasts((prev) =>
        prev.map((p) =>
          String(p.viewId ?? p.id) === rowKey ? { ...p, shares: newShareCount } : p
        )
      )
      dispatchPostSync({
        postId: rowKey,
        shareCount: newShareCount,
      })
      setShareModalPodcast(null)
      return
    }

    const canonicalId = engagementPostId(sourcePodcast)

    setPodcasts((prev) =>
      prev.map((p) => {
        if (canonicalId == null) return p
        const samePost = feedRowMatchesCanonicalPost(p, canonicalId)
        if (!samePost) return p
        if (p.type === 'shared' || /^share_/i.test(String(p.id ?? ''))) return p
        return { ...p, shares: newShareCount }
      })
    )

    dispatchPostSync({
      postId: canonicalId,
      shareCount: newShareCount,
    })

    setShareModalPodcast(null)
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
        url = `${API_BASE_URL}/social/posts/${encodeURIComponent(podcast.id)}/likers/`
      } else if (kind === 'comments') {
        url = `${API_BASE_URL}/social/posts/${encodeURIComponent(podcast.id)}/commenters/`
      } else if (kind === 'shares') {
        const pid =
          podcast.type === 'shared' ||
            String(podcast.id || '').startsWith('share_')
            ? String(podcast.id || '').trim()
            : engagementPostId(podcast)
        if (!pid) {
          setSharedActionHover((prev) =>
            prev.rowKey !== rowKey ? prev : { rowKey, kind, items: [], loading: false }
          )
          return
        }
        url = `${API_BASE_URL}/social/posts/${encodeURIComponent(pid)}/sharers/`
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
        if (kind === 'likes') items = Array.isArray(data.data?.likers) ? data.data.likers : []
        else if (kind === 'comments')
          items = Array.isArray(data.data?.commenters) ? data.data.commenters : []
        else items = Array.isArray(data.data?.sharers) ? data.data.sharers : []

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
    if (kind === 'likes') return 'Chưa có lượt thích'
    if (kind === 'comments') return 'Chưa có bình luận'
    return 'Chưa có lượt chia sẻ'
  }


  const handleOpenPostModal = (podcast) => {
    // Bài gốc trong card share: mở modal không auto cuộn xuống phần bình luận.
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
      const res = await fetch(`${API_BASE_URL}/social/posts/${podcast.post_id}/unshare/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ user_id: user?.id }),
      })
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
      toast.error(err.message || 'Gỡ chia sẻ thất bại')
    }
  }

  const executeHideSharedFeedRow = async (podcast) => {
    if (!podcast) return
    try {
      const token = getToken()
      const user = getCurrentUser()
      const canonicalId = engagementPostId(podcast)
      const res = await fetch(`${API_BASE_URL}/social/posts/${canonicalId}/hide/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ user_id: user?.id }),
      })
      let errBody = {}
      try {
        errBody = await res.json()
      } catch {
        errBody = {}
      }
      if (!res.ok) {
        throw new Error(errBody.message || `HTTP ${res.status}`)
      }
      preserveMainScrollAfterListUpdate(() => {
        pauseTrackIfDeleted(podcast.id)
        hidePost(canonicalId)
        setPodcasts((prev) =>
          prev.filter((p) => String(p.id) !== String(podcast.id))
        )
      })
      setOpenShareMenuId(null)
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Ẩn bài viết thất bại')
    }
  }

  const renderSharedPost = (podcast) => {
    const sharedBy = podcast.sharedBy || {}
    const rowKey = String(podcast.viewId || podcast.id)
    const avatarKey = `share-${podcast.viewId || podcast.id}`
    const shareAuthorName = sharedBy.name || sharedBy.username || 'Ẩn danh'
    const shareAuthorInitials = getInitials(sharedBy || shareAuthorName)
    const currentUser = getCurrentUser()
    const sharedByUserId =
      sharedBy.id ?? sharedBy.user_id ?? sharedBy.pk ?? sharedBy.userId
    const currentUserId =
      currentUser?.id ?? currentUser?.user_id ?? currentUser?.pk ?? currentUser?.userId
    const isShareRowOwner =
      sharedByUserId != null &&
      currentUserId != null &&
      String(currentUserId) === String(sharedByUserId)

    return (
      <div
        key={podcast.viewId || podcast.id}
        className={styles.postShareContainer}
        data-post-id={podcast.id}
      >
        <div className={styles.postShareWrapper}>
          <div className={styles.postShareInfo}>
            <div className={styles.postShareAuthor}>
              {sharedBy.avatar_url && !failedAvatarUrls.has(avatarKey) ? (
                <div className={styles.postShareAvatarWrapper}>
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
                <div className={styles.postShareAvatarWrapper}>
                  <div className={styles.postShareAvatarInitials}>{shareAuthorInitials}</div>
                </div>
              )}

              <div className={styles.postShareAuthorInfo}>
                <div className={styles.postShareAuthorMetaRow}>
                  <span className={styles.postShareAuthorName}>{shareAuthorName}</span>
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
                aria-label="Tùy chọn"
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
                        <span>Chỉnh sửa</span>
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
                        <span>Xóa</span>
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
                        <span>Ẩn bài viết</span>
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
                        <span>Báo cáo</span>
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
            title="Click để xem bài đăng gốc"
          >
            <PodcastCard
              podcast={{ ...podcast, timeAgo: podcast.postTimeAgo || podcast.timeAgo }}
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
                className={`${styles.shareActionBtn} ${podcast.liked ? styles.liked : ''}`}
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
                      <div className={styles.shareSharerEmpty}>Đang tải...</div>
                    ) : sharedActionHover.items.length > 0 ? (
                      sharedActionHover.items.map((u) => (
                        <div key={u.user_id || u.username} className={styles.shareSharerRow}>
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
                  {podcast.comments || 0} Bình luận
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
                      <div className={styles.shareSharerEmpty}>Đang tải...</div>
                    ) : sharedActionHover.items.length > 0 ? (
                      sharedActionHover.items.map((u) => (
                        <div key={u.user_id || u.username} className={styles.shareSharerRow}>
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
            <div className={styles.shareStatWrap}>
              <button
                type="button"
                className={styles.shareActionBtn}
                onClick={(e) => {
                  e.stopPropagation()
                  setShareModalPodcast(podcast)
                }}
              >
                <Share2 size={16} />
                <span
                  onMouseEnter={() => handleSharedRowStatsEnter(podcast, 'shares')}
                  onMouseLeave={() => handleSharedRowStatsLeave(podcast)}
                >
                  {podcast.shares || 0} Chia sẻ
                </span>
              </button>
              {sharedActionHover.rowKey === rowKey &&
                sharedActionHover.kind === 'shares' && (
                  <div
                    className={styles.shareSharerPopup}
                    onMouseEnter={handleSharedRowStatsPopupEnter}
                    onMouseLeave={() => handleSharedRowStatsLeave(podcast)}
                  >
                    {sharedActionHover.loading ? (
                      <div className={styles.shareSharerEmpty}>Đang tải...</div>
                    ) : sharedActionHover.items.length > 0 ? (
                      sharedActionHover.items.map((u) => (
                        <div key={u.user_id || u.username} className={styles.shareSharerRow}>
                          {hoverUserLabel(u)}
                        </div>
                      ))
                    ) : (
                      <div className={styles.shareSharerEmpty}>
                        {sharedHoverEmptyLabel('shares')}
                      </div>
                    )}
                  </div>
                )}
            </div>
            <button
              type="button"
              ref={sharedSaveBtnRef}
              className={`${styles.shareActionBtn} ${styles.shareActionBtnSave} ${podcast.saved ? styles.saved : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                handleFeedSharedSave(podcast.id)
              }}
            >
              <Bookmark size={16} fill={podcast.saved ? 'currentColor' : 'none'} />
              <span>{podcast.saveCount || 0} Lưu</span>
            </button>
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
        prev.filter((p) => String(p.id) !== String(postId))
      )
    })
  }

  const handleHidePost = (postId) => {
    preserveMainScrollAfterListUpdate(() => {
      pauseTrackIfDeleted(postId)
      hidePost(postId)
      setPodcasts((prev) =>
        prev.filter((p) => String(p.id) !== String(postId))
      )
    })
  }

  return (
    <section className={styles.feed}>
      <CreatePostBar />

      <div className={styles.tabs}>
        {TABS.map((tab, i) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === i ? styles.active : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.cards}>
        {loading && (
          <div className={styles.feedState}>Đang tải dữ liệu...</div>
        )}

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
                prev ? { ...prev, comments: newCount, comment_count: newCount } : prev
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
            setDisableModalAutoScroll(false)
          }}
          onPostDeleted={(deletedId) => {
            setPodcasts((prev) =>
              prev.filter(
                (p) =>
                  String(p.id) !== String(deletedId) &&
                  String(p.post_id) !== String(deletedId)
              )
            )
            setSelectedPodcast(null)
          }}
        />
      )}

      {shareModalPodcast && (
        <ShareModal
          podcast={shareModalPodcast}
          onClose={() => setShareModalPodcast(null)}
          onShareSuccess={(data) =>
            handleFeedShareSuccess(shareModalPodcast, data)
          }
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

      <SaveCollectionModal
        isOpen={showCollectionModal}
        onClose={() => {
          setShowCollectionModal(false)
          setCollectionTargetPodcast(null)
        }}
        postId={
          collectionTargetPodcast?.type === 'shared'
            ? collectionTargetPodcast.id
            : engagementPostId(collectionTargetPodcast)
        }
        onSave={handleFeedCollectionSave}
        triggerRef={sharedSaveBtnRef}
        isPopup={false}
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
              'Ẩn danh'
              : reportSharePodcast.author || 'Ẩn danh'
          }
          onClose={() => setReportSharePodcast(null)}
        />
      )}

      <ConfirmModal
        isOpen={sharedRowConfirm.open}
        type="confirm"
        title={
          sharedRowConfirm.mode === 'hide' ? 'Ẩn bài viết' : 'Xóa bài viết'
        }
        message={
          sharedRowConfirm.mode === 'hide'
            ? 'Bạn chắc chắn muốn ẩn bài viết này khỏi feed?\nBài gốc vẫn hiển thị với người khác.'
            : 'Bạn chắc chắn muốn xóa bài viết này?\nHành động này không thể hoàn tác.'
        }
        confirmText={sharedRowConfirm.mode === 'hide' ? 'Ẩn' : 'Xóa'}
        cancelText="Hủy"
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

function formatTimeAgo(dateString) {
  if (!dateString) return 'Vừa xong'

  const created = new Date(dateString)
  const now = new Date()
  const diffMs = now - created
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return 'Vừa xong'
  if (diffMinutes < 60) return `${diffMinutes} phút trước`
  if (diffHours < 24) return `${diffHours} giờ trước`

  return `${diffDays} ngày trước`
}