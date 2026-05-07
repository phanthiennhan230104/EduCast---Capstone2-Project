import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'

import PodcastCard from './PodcastCard'
import CreatePostBar from './CreatePostBar'
import CommentModal from './CommentModal'

import styles from '../../style/feed/Feed.module.css'
import { getInitials } from '../../utils/getInitials'

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

export default function Feed() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const { selectedTagIds } = useTagFilter()
  const {
    setSavedPostIds_batch,
    deletePost,
    hidePost,
  } = useContext(PodcastContext)

  const { pauseTrackIfDeleted, currentTrack } = useAudioPlayer()

  const [activeTab, setActiveTab] = useState(() => {
    const saved = sessionStorage.getItem('feedActiveTab')
    return saved ? parseInt(saved, 10) : 0
  })

  const [disableModalAutoScroll, setDisableModalAutoScroll] = useState(false)
  const [selectedPodcast, setSelectedPodcast] = useState(null)
  const [podcasts, setPodcasts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isRestoringRef = useRef(false)
  const feedScrollKey = 'mainScroll:/feed'
  const focusPostId = sessionStorage.getItem('feedFocusPostId')

  const dispatchPostSync = (payload) => {
    window.dispatchEvent(new CustomEvent(POST_SYNC_EVENT, { detail: payload }))
  }

  useEffect(() => {
    sessionStorage.setItem('feedActiveTab', String(activeTab))
  }, [activeTab])

  useEffect(() => {
    if (!location.state?.toast) return

    const { type, message } = location.state.toast

    if (type === 'success') toast.success(message)
    else if (type === 'error') toast.error(message)
    else if (type === 'info') toast.info(message)
    else if (type === 'warning') toast.warning(message)
  }, [location.state?.toast])

  useEffect(() => {
    const handlePostSync = (event) => {
      const d = event.detail || {}
      if (!d.postId) return

      const oldSync = JSON.parse(
        localStorage.getItem(`post-sync-${d.postId}`) || '{}'
      )

      const nextSync = { ...oldSync }

      if (typeof d.liked === 'boolean') nextSync.liked = d.liked
      if (typeof d.likeCount === 'number') nextSync.likeCount = d.likeCount
      if (typeof d.saved === 'boolean') nextSync.saved = d.saved
      if (typeof d.saveCount === 'number') nextSync.saveCount = d.saveCount
      if (typeof d.commentCount === 'number') nextSync.commentCount = d.commentCount

      localStorage.setItem(`post-sync-${d.postId}`, JSON.stringify(nextSync))

      setPodcasts((prev) =>
        prev.map((p) =>
          String(p.id) === String(d.postId)
            ? {
                ...p,
                liked: typeof d.liked === 'boolean' ? d.liked : p.liked,
                likes: typeof d.likeCount === 'number' ? d.likeCount : p.likes,
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
              }
            : p
        )
      )

      setSelectedPodcast((prev) =>
        prev && String(prev.id) === String(d.postId)
          ? {
              ...prev,
              liked: typeof d.liked === 'boolean' ? d.liked : prev.liked,
              likes: typeof d.likeCount === 'number' ? d.likeCount : prev.likes,
              saved: typeof d.saved === 'boolean' ? d.saved : prev.saved,
              saveCount:
                typeof d.saveCount === 'number'
                  ? d.saveCount
                  : prev.saveCount,
              comments:
                typeof d.commentCount === 'number'
                  ? d.commentCount
                  : prev.comments,
              comment_count:
                typeof d.commentCount === 'number'
                  ? d.commentCount
                  : prev.comment_count,
            }
          : prev
      )
    }

    window.addEventListener(POST_SYNC_EVENT, handlePostSync)
    return () => window.removeEventListener(POST_SYNC_EVENT, handlePostSync)
  }, [])

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        setLoading(true)
        setError('')

        const token = localStorage.getItem('educast_access')
        const currentTab = TABS[activeTab]?.key || 'for_you'
        const limit = focusPostId ? 50 : 10

        let url = `http://localhost:8000/api/content/feed/?limit=${limit}&tab=${currentTab}`

        if (selectedTagIds && selectedTagIds.length > 0) {
          url += `&tags=${selectedTagIds.join(',')}`
        }

        const res = await fetch(url, {
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

          const cachedSync = JSON.parse(
            localStorage.getItem(`post-sync-${item.id}`) || '{}'
          )

          const commentCount =
            cachedSync.commentCount ??
            item.stats?.comments ??
            item.comment_count ??
            item.comments ??
            0

          return {
            id: item.id,
            title: item.title,
            author: item.author?.name || 'Ẩn danh',
            authorUsername: item.author?.username || '',
            authorInitials: getInitials(item.author || 'A'),
            cover: item.thumbnail_url,
            description: item.description || '',
            tags: (item.tags || []).map((tag) => `#${tag.name}`),
            aiGenerated: false,

            duration: formatSeconds(durationSeconds),
            durationSeconds,
            current: formatSeconds(progressSeconds),
            currentSeconds: progressSeconds,
            progress: calcProgress(progressSeconds, durationSeconds),

            likes: cachedSync.likeCount ?? item.stats?.likes ?? 0,
            liked: cachedSync.liked ?? item.viewer_state?.is_liked ?? false,

            saved: cachedSync.saved ?? item.viewer_state?.is_saved ?? false,
            saveCount: cachedSync.saveCount ?? item.stats?.saves ?? 0,

            comments: commentCount,
            comment_count: commentCount,

            timeAgo: formatTimeAgo(item.created_at),
            listens: `${item.listen_count || 0} lượt nghe`,
            shares: item.stats?.shares || 0,

            audioUrl: item.audio?.audio_url || '',
            audioId: item.audio?.id || '',
            voiceName: item.audio?.voice_name || '',
          }
        })

        setPodcasts(mapped)
        setSavedPostIds_batch(mapped.filter((p) => p.saved).map((p) => p.id))
      } catch (err) {
        console.error('Fetch feed failed:', err)
        setError('Không tải được feed')
      } finally {
        setLoading(false)
      }
    }

    fetchFeed()
  }, [activeTab, selectedTagIds, focusPostId, setSavedPostIds_batch])

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
    if (loading || podcasts.length === 0) return
    if (sessionStorage.getItem('returnFromEdit') === 'true') return

    const savedScroll = Number(sessionStorage.getItem(feedScrollKey) || 0)
    if (!savedScroll) return

    const restore = () => {
      const main = document.querySelector('main')
      if (!main) return

      main.scrollTop = savedScroll
      main.scrollTo({ top: savedScroll, behavior: 'auto' })
    }

    requestAnimationFrame(() => {
      restore()
      setTimeout(restore, 50)
      setTimeout(restore, 150)
    })
  }, [loading, podcasts.length])

  useEffect(() => {
    const navType = performance.getEntriesByType('navigation')[0]?.type
    const returnFromEdit = sessionStorage.getItem('returnFromEdit') === 'true'

    if (navType === 'reload' && !returnFromEdit) {
      sessionStorage.removeItem('feedScrollPosition')
      sessionStorage.removeItem('feedFocusPostId')
      sessionStorage.removeItem('openPostDetailId')
      sessionStorage.removeItem('openPostDetailNoScroll')

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

    const token = localStorage.getItem('educast_access')
    const currentUser = JSON.parse(
      localStorage.getItem('educast_user') || 'null'
    )

    const res = await fetch(
      `http://localhost:8000/api/social/posts/${selectedPodcast.id}/like/`,
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
      prev.map((p) =>
        p.id === selectedPodcast.id
          ? { ...p, liked: nextLiked, likes: nextLikeCount }
          : p
      )
    )

    dispatchPostSync({
      postId: selectedPodcast.id,
      liked: nextLiked,
      likeCount: nextLikeCount,
    })

    window.dispatchEvent(
      new CustomEvent('audio-track-like-updated', {
        detail: {
          postId: selectedPodcast.id,
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

    const token = localStorage.getItem('educast_access')
    const currentUser = JSON.parse(
      localStorage.getItem('educast_user') || 'null'
    )

    const res = await fetch(
      `http://localhost:8000/api/social/posts/${selectedPodcast.id}/save/`,
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
      prev.map((p) =>
        p.id === selectedPodcast.id
          ? { ...p, saved: nextSaved, saveCount: nextSaveCount }
          : p
      )
    )

    dispatchPostSync({
      postId: selectedPodcast.id,
      saved: nextSaved,
      saveCount: nextSaveCount,
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
          podcasts.map((podcast) => (
            <div key={podcast.id} data-post-id={podcast.id}>
              <PodcastCard
                podcast={podcast}
                queue={podcasts}
                onDelete={(postId) => {
                  console.log(
                    '[Feed] onDelete:',
                    postId,
                    'currentTrack:',
                    currentTrack?.id
                  )

                  pauseTrackIfDeleted(postId)
                  deletePost(postId)
                  setPodcasts((prev) => prev.filter((p) => p.id !== postId))
                }}
                onHide={(postId) => {
                  console.log(
                    '[Feed] onHide:',
                    postId,
                    'currentTrack:',
                    currentTrack?.id
                  )

                  pauseTrackIfDeleted(postId)
                  hidePost(postId)
                  setPodcasts((prev) => prev.filter((p) => p.id !== postId))
                }}
              />
            </div>
          ))}
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
          onClose={() => {
            setSelectedPodcast(null)
            setDisableModalAutoScroll(false)
          }}
          onPostDeleted={(postId) => {
            setPodcasts((prev) => prev.filter((p) => p.id !== postId))
            setSelectedPodcast(null)
          }}
        />
      )}
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