import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  MessageCircle,
  Share2,
  Bookmark,
  Play,
  Pause,
  Heart,
  MoreHorizontal,
} from 'lucide-react'
import { apiRequest } from '../../utils/api'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import styles from '../../style/community/Community.module.css'

const LAST_VISIT_KEY = 'educast:community:lastVisitAt'

function formatSeconds(value) {
  const total = Math.max(0, Math.floor(Number(value) || 0))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatCount(value) {
  const n = Number(value) || 0
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatTimeAgo(raw) {
  if (!raw) return ''
  const date = new Date(raw)
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000))
  if (diffMinutes < 1) return 'Vừa xong'
  if (diffMinutes < 60) return `${diffMinutes} phút trước`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} giờ trước`
  return `${Math.floor(diffHours / 24)} ngày trước`
}

function PostCard({ post, queue, onToggleSave, onToggleLike }) {
  const navigate = useNavigate()
  const {
    playTrack,
    togglePlay,
    isCurrentTrack,
    playing,
    currentTime,
    duration,
    seekToPercent,
  } = useAudioPlayer()

  const postId = post.post_id || post.id
  const isCurrent = isCurrentTrack(postId)
  const isPlaying = isCurrent && playing
  const totalDuration = isCurrent
    ? duration || post.audio?.duration_seconds || post.duration_seconds
    : post.audio?.duration_seconds || post.duration_seconds
  const displayCurrent = isCurrent
    ? currentTime
    : post.viewer_state?.progress_seconds || 0
  const progress = totalDuration
    ? Math.min(100, Math.max(0, (displayCurrent / totalDuration) * 100))
    : 0

  const author = post.author || {}
  const tags = Array.isArray(post.tags) ? post.tags.slice(0, 2) : []

  const handlePlay = () => {
    const audioUrl = post.audio?.audio_url
    if (!audioUrl) return

    if (isCurrent) {
      togglePlay()
      return
    }

    playTrack(
      {
        id: postId,
        post_id: postId,
        postId,
        title: post.title,
        author: author.name || author.username,
        cover: post.thumbnail_url,
        audioUrl,
        durationSeconds: post.audio?.duration_seconds || post.duration_seconds,
        liked: post.viewer_state?.is_liked,
        likeCount: post.stats?.likes || 0,
      },
      queue
    )
  }

  const handleSeek = (event) => {
    if (!isCurrent || !totalDuration) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    seekToPercent(Math.max(0, Math.min(100, (x / rect.width) * 100)))
  }

  return (
    <article className={styles.postCard}>
      <div className={styles.postHead}>
        <div className={styles.authorRow}>
          <button
            type="button"
            className={styles.avatarButton}
            onClick={() => author.id && navigate(`/profile/${author.id}`)}
            aria-label="Mở trang cá nhân"
          >
            {author.avatar_url ? (
              <img src={author.avatar_url} alt={author.name} className={styles.avatarImg} />
            ) : (
              <span>{author.initials || 'U'}</span>
            )}
          </button>

          <div className={styles.authorMeta}>
            <div className={styles.authorTop}>
              <button
                type="button"
                className={styles.authorNameButton}
                onClick={() => author.id && navigate(`/profile/${author.id}`)}
              >
                {author.name || author.username || 'Người dùng'}
              </button>
              <span className={styles.dot}>•</span>
              <span>{formatTimeAgo(post.created_at)}</span>
              <span className={styles.dot}>•</span>
              <span>{formatCount(post.listen_count)} lượt nghe</span>
            </div>

            <div className={styles.authorTags}>
              {tags.map((tag) => (
                <span key={tag.id || tag.slug || tag.name} className={styles.tag}>
                  #{tag.name}
                </span>
              ))}

              {post.is_ai_generated && (
                <span className={styles.aiBadgeInline}>
                  <Sparkles size={13} />
                  Được tạo bởi AI
                </span>
              )}
            </div>
          </div>

          <button type="button" className={styles.menuBtn} aria-label="Thêm tùy chọn">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>

      <div className={styles.postBody}>
        <div className={styles.postText}>
          <h3 className={styles.postTitle}>{post.title}</h3>
          <p className={styles.postDesc}>{post.description}</p>
        </div>

        {post.thumbnail_url && (
          <img
            src={post.thumbnail_url}
            alt={post.title}
            className={styles.postCover}
          />
        )}
      </div>

      {post.audio?.audio_url && (
        <div className={styles.audioBox}>
          <button
            type="button"
            className={`${styles.audioBtn} ${isPlaying ? styles.audioBtnPlaying : ''}`}
            onClick={handlePlay}
            aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>

          <div className={styles.progressSection}>
            <span className={styles.audioTime}>{formatSeconds(displayCurrent)}</span>

            <div
              className={styles.progressBar}
              onClick={handleSeek}
              role="slider"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
              tabIndex={0}
            >
              <div
                className={styles.progressFill}
                style={{ width: `${progress}%` }}
              />
            </div>

            <span className={styles.audioTime}>{formatSeconds(totalDuration)}</span>
          </div>
        </div>
      )}

      <div className={styles.postFooter}>
        <button
          type="button"
          className={`${styles.actionBtn} ${post.viewer_state?.is_liked ? styles.likedBtn : ''}`}
          onClick={() => onToggleLike(postId)}
        >
          <Heart size={16} fill={post.viewer_state?.is_liked ? 'currentColor' : 'none'} />
          <span>{formatCount(post.stats?.likes)}</span>
        </button>

        <button type="button" className={styles.actionBtn}>
          <MessageCircle size={16} />
          <span>{formatCount(post.stats?.comments)} Bình luận</span>
        </button>

        <button type="button" className={styles.actionBtn}>
          <Share2 size={16} />
          <span>Chia sẻ</span>
        </button>

        <button
          type="button"
          className={`${styles.actionBtn} ${styles.saveAction} ${post.viewer_state?.is_saved ? styles.savedBtn : ''}`}
          onClick={() => onToggleSave(postId)}
        >
          <Bookmark size={16} fill={post.viewer_state?.is_saved ? 'currentColor' : 'none'} />
          <span>{post.viewer_state?.is_saved ? 'Đã lưu' : 'Lưu'}</span>
        </button>
      </div>
    </article>
  )
}

export default function Community() {
  const [activeTab, setActiveTab] = useState('all')
  const [posts, setPosts] = useState([])
  const [followingPreview, setFollowingPreview] = useState([])
  const [followingCount, setFollowingCount] = useState(0)
  const [newPostsCount, setNewPostsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const tabMeta = useMemo(
    () => [
      { key: 'all', label: 'Tất cả bài viết mới' },
      { key: 'today', label: 'Hôm nay' },
      { key: 'week', label: 'Tuần này' },
    ],
    []
  )

  useEffect(() => {
    let cancelled = false

    const loadCommunity = async () => {
      try {
        setLoading(true)
        const since = localStorage.getItem(LAST_VISIT_KEY)
        const query = new URLSearchParams({ tab: activeTab, limit: '30' })
        if (since) query.set('since', since)

        const response = await apiRequest(`/social/community/?${query}`)
        if (cancelled) return

        const data = response.data || {}
        setPosts(Array.isArray(data.posts) ? data.posts : [])
        setFollowingPreview(Array.isArray(data.following_preview) ? data.following_preview : [])
        setFollowingCount(Number(data.following_count || 0))
        setNewPostsCount(Number(data.new_posts_count || 0))
        localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString())
      } catch (error) {
        if (!cancelled) {
          console.error('Load community failed:', error)
          setPosts([])
          setFollowingPreview([])
          setFollowingCount(0)
          setNewPostsCount(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadCommunity()
    return () => {
      cancelled = true
    }
  }, [activeTab])

  const audioQueue = useMemo(
    () =>
      posts
        .filter((post) => post.audio?.audio_url)
        .map((post) => ({
          id: post.post_id || post.id,
          post_id: post.post_id || post.id,
          postId: post.post_id || post.id,
          title: post.title,
          author: post.author?.name || post.author?.username,
          cover: post.thumbnail_url,
          audioUrl: post.audio.audio_url,
          durationSeconds: post.audio.duration_seconds || post.duration_seconds,
          liked: post.viewer_state?.is_liked,
          likeCount: post.stats?.likes || 0,
        })),
    [posts]
  )

  const toggleSavePost = async (id) => {
    const previous = posts
    setPosts((prev) =>
      prev.map((post) =>
        String(post.post_id || post.id) === String(id)
          ? {
              ...post,
              stats: {
                ...post.stats,
                saves: Math.max(
                  0,
                  Number(post.stats?.saves || 0) +
                    (post.viewer_state?.is_saved ? -1 : 1)
                ),
              },
              viewer_state: {
                ...post.viewer_state,
                is_saved: !post.viewer_state?.is_saved,
              },
            }
          : post
      )
    )

    try {
      const response = await apiRequest(`/social/posts/${encodeURIComponent(id)}/save/`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const saved = Boolean(response.data?.saved)
      const count = Number(response.data?.save_count || 0)
      setPosts((prev) =>
        prev.map((post) =>
          String(post.post_id || post.id) === String(id)
            ? {
                ...post,
                stats: { ...post.stats, saves: count },
                viewer_state: { ...post.viewer_state, is_saved: saved },
              }
            : post
        )
      )
    } catch (error) {
      console.error('Community save failed:', error)
      setPosts(previous)
    }
  }

  const toggleLikePost = async (id) => {
    const previous = posts
    setPosts((prev) =>
      prev.map((post) =>
        String(post.post_id || post.id) === String(id)
          ? {
              ...post,
              stats: {
                ...post.stats,
                likes: Math.max(
                  0,
                  Number(post.stats?.likes || 0) +
                    (post.viewer_state?.is_liked ? -1 : 1)
                ),
              },
              viewer_state: {
                ...post.viewer_state,
                is_liked: !post.viewer_state?.is_liked,
              },
            }
          : post
      )
    )

    try {
      const response = await apiRequest(`/social/posts/${encodeURIComponent(id)}/like/`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const liked = Boolean(response.data?.liked)
      const count = Number(response.data?.like_count || 0)
      setPosts((prev) =>
        prev.map((post) =>
          String(post.post_id || post.id) === String(id)
            ? {
                ...post,
                stats: { ...post.stats, likes: count },
                viewer_state: { ...post.viewer_state, is_liked: liked },
              }
            : post
        )
      )
    } catch (error) {
      console.error('Community like failed:', error)
      setPosts(previous)
    }
  }

  const followingItems = useMemo(() => {
    const visible = followingPreview.slice(0, 7)
    if (followingCount > visible.length) {
      visible.push({
        id: 'more',
        name: `+${followingCount - visible.length}`,
        initials: `+${followingCount - visible.length}`,
        more: true,
      })
    }
    return visible
  }, [followingCount, followingPreview])

  return (
    <section className={styles.wrapper}>
      <div className={styles.content}>
        <div className={styles.topCard}>
          <div className={styles.sectionTitleRow}>
            <h2 className={styles.sectionTitle}>Đang theo dõi</h2>
            <div className={styles.sectionLine} />
          </div>

          <div className={styles.followingRow}>
            {followingItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.followingItem} ${item.more ? styles.followingMore : ''}`}
                onClick={() => !item.more && item.id && navigate(`/profile/${item.id}`)}
              >
                <div className={styles.followingAvatar}>
                  {item.avatar_url ? (
                    <img src={item.avatar_url} alt={item.name} className={styles.avatarImg} />
                  ) : (
                    item.initials
                  )}
                </div>
                <span className={styles.followingName}>{item.name}</span>
                {!item.more && item.is_following && <span className={styles.activeDot} />}
              </button>
            ))}
          </div>

          <div className={styles.tabs}>
            {tabMeta.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={styles.newPostRow}>
            <span className={styles.newPostHint}>
              {newPostsCount} bài viết mới từ lần cuối truy cập
            </span>
            <div className={styles.newPostLine} />
          </div>
        </div>

        <div className={styles.feed}>
          {loading && <div className={styles.emptyState}>Đang tải cộng đồng...</div>}
          {!loading && posts.length === 0 && (
            <div className={styles.emptyState}>Chưa có bài viết cộng đồng</div>
          )}
          {!loading &&
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                queue={audioQueue}
                onToggleSave={toggleSavePost}
                onToggleLike={toggleLikePost}
              />
            ))}
        </div>
      </div>
    </section>
  )
}
