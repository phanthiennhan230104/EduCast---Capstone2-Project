import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useLocation } from 'react-router-dom'
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Share2 } from 'lucide-react'
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

const getAccessToken = () =>
  localStorage.getItem('educast_access') ||
  sessionStorage.getItem('educast_access') ||
  localStorage.getItem('access_token') ||
  sessionStorage.getItem('access_token') ||
  localStorage.getItem('access') ||
  sessionStorage.getItem('access') ||
  localStorage.getItem('token') ||
  sessionStorage.getItem('token')

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

function clearEditReturnSession() {
  sessionStorage.removeItem('returnFromEdit')
  sessionStorage.removeItem('feedScrollPosition')
  sessionStorage.removeItem('feedFocusPostId')
  sessionStorage.removeItem('openPostDetailId')
  sessionStorage.removeItem('openPostDetailNoScroll')
  sessionStorage.removeItem('returnToAfterEdit')
}

export default function Feed() {
  const location = useLocation()

  const { selectedTagIds } = useTagFilter()
  const { setSavedPostIds_batch, deletePost, hidePost } =
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
  const [failedAvatarUrls, setFailedAvatarUrls] = useState(new Set())

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

      const nextSync = {
        ...oldSync,
        ...(typeof d.liked === 'boolean' ? { liked: d.liked } : {}),
        ...(typeof d.likeCount === 'number' ? { likeCount: d.likeCount } : {}),
        ...(typeof d.saved === 'boolean' ? { saved: d.saved } : {}),
        ...(typeof d.saveCount === 'number' ? { saveCount: d.saveCount } : {}),
        ...(typeof d.commentCount === 'number'
          ? { commentCount: d.commentCount }
          : {}),
      }

      localStorage.setItem(`post-sync-${d.postId}`, JSON.stringify(nextSync))

      setTimeout(() => {
        setPodcasts((prev) =>
          prev.map((p) =>
            String(p.id) === String(d.postId)
              ? {
                ...p,
                liked: typeof d.liked === 'boolean' ? d.liked : p.liked,
                likes:
                  typeof d.likeCount === 'number'
                    ? d.likeCount
                    : p.likes,
                saved: typeof d.saved === 'boolean' ? d.saved : p.saved,
                saveCount:
                  typeof d.saveCount === 'number'
                    ? d.saveCount
                    : p.saveCount,
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
              likes:
                typeof d.likeCount === 'number'
                  ? d.likeCount
                  : prev.likes,
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
      }, 0)
    }

    window.addEventListener(POST_SYNC_EVENT, handlePostSync)
    return () => window.removeEventListener(POST_SYNC_EVENT, handlePostSync)
  }, [])

  // Fetch feed data
  useEffect(() => {
    const fetchFeed = async () => {
      try {
        setLoading(true)
        setError('')

        const token = getAccessToken()

        if (!token) {
          setError('Bạn cần đăng nhập để xem feed')
          setLoading(false)
          return
        }

        const currentTab = TABS[activeTab]?.key || 'for_you'
        const limit = focusPostId ? 50 : 10

        let url = `http://localhost:8000/api/content/feed/?limit=${limit}&tab=${currentTab}`

        if (selectedTagIds && selectedTagIds.length > 0) {
          url += `&tags=${selectedTagIds.join(',')}`
        }

        const res = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })

        if (!res.ok) {
          const text = await res.text()
          console.error('Feed API failed:', {
            status: res.status,
            tokenExists: Boolean(token),
            tokenPreview: token ? token.slice(0, 20) + '...' : null,
            body: text,
          })
          throw new Error(`HTTP ${res.status}: ${text}`)
        }

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

          const originalPostId = item.post_id || item.id
          const viewId = item.id

          const cachedSync = JSON.parse(
            localStorage.getItem(`post-sync-${originalPostId}`) || '{}'
          )

          const commentCount =
            cachedSync.commentCount ??
            item.stats?.comments ??
            item.comment_count ??
            item.comments ??
            0

          return {
            id: originalPostId,
            viewId,
            type: item.type || 'original',
            post_id: item.post_id || originalPostId,
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
            sharedTimeAgo: item.shared_at ? formatTimeAgo(item.shared_at) : null,
            postTimeAgo: item.post_created_at ? formatTimeAgo(item.post_created_at) : formatTimeAgo(item.created_at),
            sharedBy: item.shared_by || null,
            share_caption: item.share_caption || '',
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

  // Restore scroll position after edit
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

  // Restore scroll position on normal navigation
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

  // Clear scroll on page reload
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

  // Handle open post detail event
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

  // Handle like toggle
  const handleModalToggleLike = async (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()

    if (!selectedPodcast?.id) return

    const token = getAccessToken()

    if (!token) {
      toast.error('Bạn cần đăng nhập để thực hiện thao tác này')
      return
    }

    const currentUser = JSON.parse(
      localStorage.getItem('educast_user') || 'null'
    )

    try {
      const res = await fetch(
        `http://localhost:8000/api/social/posts/${selectedPodcast.id}/like/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
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
    } catch (err) {
      console.error('Like toggle failed:', err)
    }
  }

  // Handle save toggle
  const handleModalToggleSave = async (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()

    if (!selectedPodcast?.id) return

    const token = getAccessToken()

    if (!token) {
      toast.error('Bạn cần đăng nhập để thực hiện thao tác này')
      return
    }

    const currentUser = JSON.parse(
      localStorage.getItem('educast_user') || 'null'
    )

    try {
      const res = await fetch(
        `http://localhost:8000/api/social/posts/${selectedPodcast.id}/save/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
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
    } catch (err) {
      console.error('Save toggle failed:', err)
    }
  }

  const handleOpenPostModal = (podcast) => {
    setDisableModalAutoScroll(false)
    setSelectedPodcast({
      ...podcast,
      timeAgo: podcast.type === 'shared' ? podcast.postTimeAgo : podcast.timeAgo,
    })
  }

  const handleDeletePost = (postId) => {
    pauseTrackIfDeleted(postId)
    deletePost(postId)
    setPodcasts((prev) => prev.filter((p) => String(p.id) !== String(postId)))
  }

  const handleHidePost = (postId) => {
    pauseTrackIfDeleted(postId)
    hidePost(postId)
    setPodcasts((prev) => prev.filter((p) => String(p.id) !== String(postId)))
  }

  const renderSharedPost = (podcast) => {
    const sharedBy = podcast.sharedBy || {}
    const avatarKey = `share-${podcast.viewId || podcast.id}`
    const shareAuthorName = sharedBy.name || sharedBy.username || 'Ẩn danh'
    const shareAuthorInitials = getInitials(sharedBy || shareAuthorName)

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

              <div>
                <h5 className={styles.postShareAuthorName}>{shareAuthorName}</h5>
                <p className={styles.postShareTime}>{podcast.sharedTimeAgo || podcast.timeAgo}</p>
              </div>
            </div>

            <div className={styles.shareMenuWrap}>
              <button
                type="button"
                className={styles.shareMenuBtn}
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenShareMenuId(openShareMenuId === podcast.viewId ? null : podcast.viewId)
                }}
                aria-label="Tùy chọn"
              >
                <MoreHorizontal size={20} />
              </button>

              {openShareMenuId === podcast.viewId && (
                <div className={styles.shareMenuDropdown}>
                  <button
                    type="button"
                    className={styles.shareMenuOption}
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenShareMenuId(null)
                      handleOpenPostModal(podcast)
                    }}
                  >
                    Xem bài gốc
                  </button>
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
            />
          </div>

          <div className={styles.postShareActions}>
            <button
              type="button"
              className={`${styles.shareActionBtn} ${podcast.liked ? styles.liked : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                handleOpenPostModal(podcast)
              }}
            >
              <Heart size={16} fill={podcast.liked ? 'currentColor' : 'none'} />
              <span>{podcast.likes || 0}</span>
            </button>
            <button
              type="button"
              className={styles.shareActionBtn}
              onClick={(e) => {
                e.stopPropagation()
                handleOpenPostModal(podcast)
              }}
            >
              <MessageCircle size={16} />
              <span>{podcast.comments || 0} Bình luận</span>
            </button>
            <button
              type="button"
              className={styles.shareActionBtn}
              onClick={(e) => {
                e.stopPropagation()
                handleOpenPostModal(podcast)
              }}
            >
              <Share2 size={16} />
              <span>{podcast.shares || 0} Chia sẻ</span>
            </button>
            <button
              type="button"
              className={`${styles.shareActionBtn} ${styles.shareActionBtnSave} ${podcast.saved ? styles.saved : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                handleOpenPostModal(podcast)
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