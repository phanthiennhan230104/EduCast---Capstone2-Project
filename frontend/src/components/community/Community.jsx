import { useContext, useEffect, useMemo, useRef, useState } from 'react'
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
  EyeOff,
  Flag,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../utils/api'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { PodcastContext } from '../contexts/PodcastContext'
import CommentModal from '../feed/CommentModal'
import ShareModal from '../feed/ShareModal'
import ReportPostModal from '../feed/ReportPostModal'
import SaveCollectionModal from '../common/SaveCollectionModal'
import styles from '../../style/community/Community.module.css'
import { COMMUNITY_FOLLOW_CHANGED_EVENT } from './CommunityRightPanel'

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

function formatTimeAgo(raw, t) {
  if (!raw) return ''
  const date = new Date(raw)
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000))
  if (diffMinutes < 1) return t('feed.time.justNow')
  if (diffMinutes < 60) return t('feed.time.minutesAgo', { count: diffMinutes })
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return t('feed.time.hoursAgo', { count: diffHours })
  return t('feed.time.daysAgo', { count: Math.floor(diffHours / 24) })
}

function toCommentPodcast(post) {
  const postId = post.post_id || post.id
  const author = post.author || {}
  return {
    ...post,
    id: postId,
    post_id: postId,
    type: 'original',
    author,
    authorId: author.id,
    author_id: author.id,
    authorUsername: author.username,
    author_avatar: author.avatar_url,
    authorInitials: author.initials,
    cover: post.thumbnail_url,
    audioUrl: post.audio?.audio_url || '',
    durationSeconds: post.audio?.duration_seconds || post.duration_seconds || 0,
    liked: Boolean(post.viewer_state?.is_liked),
    saved: Boolean(post.viewer_state?.is_saved),
    likes: Number(post.stats?.likes || 0),
    comments: Number(post.stats?.comments || 0),
    shares: Number(post.stats?.shares || 0),
    saveCount: Number(post.stats?.saves || 0),
  }
}

function PostCard({
  post,
  queue,
  onToggleSave,
  onToggleLike,
  onOpenComments,
  onShare,
  onHide,
  onReport,
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
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

  useEffect(() => {
    if (!menuOpen) return
    const close = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', close, true)
    return () => document.removeEventListener('pointerdown', close, true)
  }, [menuOpen])

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
              <span
                className={styles.authorNameText}
              >
                {author.name || author.username || t('personal.userFallback')}
              </span>
              <span className={styles.dot}>•</span>
              <span>{formatTimeAgo(post.created_at, t)}</span>
              <span className={styles.dot}>•</span>
              <span>{t('library.content.listens', { count: formatCount(post.listen_count) })}</span>
            </div>

            <div className={styles.authorTags}>
              {tags.map((tag) => (
                <span key={tag.id || tag.slug || tag.name} className={styles.tag}>
                  #{tag.name}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.menuWrap} ref={menuRef}>
            <button
              type="button"
              className={styles.menuBtn}
              aria-label="Thêm tùy chọn"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreHorizontal size={18} />
            </button>

            {menuOpen && (
              <div className={styles.postDropdown}>
                <button
                  type="button"
                  className={styles.postDropdownItem}
                  onClick={() => {
                    setMenuOpen(false)
                    onHide(postId)
                  }}
                >
                  <EyeOff size={14} />
                  <span>{t('feed.hidePost')}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.postDropdownItem} ${styles.postDropdownItemDanger}`}
                  onClick={() => {
                    setMenuOpen(false)
                    onReport(post)
                  }}
                >
                  <Flag size={14} />
                  <span>{t('feed.report')}</span>
                </button>
              </div>
            )}
          </div>
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
            aria-label={t(isPlaying ? 'feed.pause' : 'feed.play')}
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

        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => onOpenComments(post)}
        >
          <MessageCircle size={16} />
          <span>{t('feed.comments', { count: formatCount(post.stats?.comments) })}</span>
        </button>

        <button type="button" className={styles.actionBtn} onClick={() => onShare(post)}>
          <Share2 size={16} />
          <span>{t('feed.shareCount', { count: '' }).trim()}</span>
        </button>

        <button
          type="button"
          className={`${styles.actionBtn} ${styles.saveAction} ${post.viewer_state?.is_saved ? styles.savedBtn : ''}`}
          onClick={() => onToggleSave(postId)}
        >
          <Bookmark size={16} fill={post.viewer_state?.is_saved ? 'currentColor' : 'none'} />
          <span>{post.viewer_state?.is_saved ? t('library.content.saved') : t('library.content.save', { count: '' }).trim()}</span>
        </button>
      </div>
    </article>
  )
}

export default function Community() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('all')
  const [posts, setPosts] = useState([])
  const [followingPreview, setFollowingPreview] = useState([])
  const [followingCount, setFollowingCount] = useState(0)
  const [newPostsCount, setNewPostsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState(null)
  const [sharingPost, setSharingPost] = useState(null)
  const [reportPost, setReportPost] = useState(null)
  const [savingPost, setSavingPost] = useState(null)
  const saveButtonRef = useRef(null)
  const { addSavedPost, removeSavedPost } = useContext(PodcastContext)
  const navigate = useNavigate()

  const tabMeta = useMemo(
    () => [
      { key: 'all', label: t('pages.community.allNewPosts') },
      { key: 'today', label: t('pages.community.today') },
      { key: 'week', label: t('pages.community.thisWeek') },
    ],
    [t]
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

  useEffect(() => {
    const handleFollowChanged = (event) => {
      const { user, followed } = event.detail || {}
      if (!user?.id) return

      setFollowingPreview((prev) => {
        const exists = prev.some((item) => String(item.id) === String(user.id))
        if (followed) {
          if (exists) {
            return prev.map((item) =>
              String(item.id) === String(user.id)
                ? { ...item, ...user, is_following: true }
                : item
            )
          }
          return [{ ...user, is_following: true }, ...prev].slice(0, 8)
        }

        return prev.filter((item) => String(item.id) !== String(user.id))
      })

      setFollowingCount((prev) =>
        Math.max(0, prev + (followed ? 1 : -1))
      )
    }

    window.addEventListener(COMMUNITY_FOLLOW_CHANGED_EVENT, handleFollowChanged)
    return () => {
      window.removeEventListener(COMMUNITY_FOLLOW_CHANGED_EVENT, handleFollowChanged)
    }
  }, [])

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
    const target = posts.find((post) => String(post.post_id || post.id) === String(id))
    if (target && !target.viewer_state?.is_saved) {
      setSavingPost(target)
      return
    }

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
      if (saved) addSavedPost(id)
      else removeSavedPost(id)
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

  const handleSavedToCollection = (_collectionId, saveData = {}) => {
    const id = savingPost?.post_id || savingPost?.id
    if (!id) return
    const count = Number(saveData.save_count ?? (savingPost.stats?.saves || 0) + 1)
    addSavedPost(id)
    setPosts((prev) =>
      prev.map((post) =>
        String(post.post_id || post.id) === String(id)
          ? {
              ...post,
              stats: { ...post.stats, saves: count },
              viewer_state: { ...post.viewer_state, is_saved: true },
            }
          : post
      )
    )
    setSavingPost(null)
  }

  const handleCommentCountChange = (postId, nextCount) => {
    setPosts((prev) =>
      prev.map((post) =>
        String(post.post_id || post.id) === String(postId)
          ? { ...post, stats: { ...post.stats, comments: nextCount } }
          : post
      )
    )
    setSelectedPost((prev) =>
      prev && String(prev.post_id || prev.id) === String(postId)
        ? { ...prev, stats: { ...prev.stats, comments: nextCount } }
        : prev
    )
  }

  const handleShareSuccess = (postId, data = {}) => {
    const nextCount =
      typeof data.share_count === 'number'
        ? Number(data.share_count)
        : null
    setPosts((prev) =>
      prev.map((post) =>
        String(post.post_id || post.id) === String(postId)
          ? {
              ...post,
              stats: {
                ...post.stats,
                shares: nextCount ?? Number(post.stats?.shares || 0) + 1,
              },
            }
          : post
      )
    )
    setSharingPost(null)
  }

  const hidePost = async (id) => {
    const previous = posts
    setPosts((prev) => prev.filter((post) => String(post.post_id || post.id) !== String(id)))
    try {
      await apiRequest(`/social/posts/${encodeURIComponent(id)}/hide/`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
    } catch (error) {
      console.error('Community hide failed:', error)
      setPosts(previous)
    }
  }

  const handleModalToggleLike = async () => {
    const id = selectedPost?.post_id || selectedPost?.id
    if (!id) return null
    const response = await apiRequest(`/social/posts/${encodeURIComponent(id)}/like/`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const liked = Boolean(response.data?.liked)
    const likeCount = Number(response.data?.like_count || 0)
    setPosts((prev) =>
      prev.map((post) =>
        String(post.post_id || post.id) === String(id)
          ? {
              ...post,
              stats: { ...post.stats, likes: likeCount },
              viewer_state: { ...post.viewer_state, is_liked: liked },
            }
          : post
      )
    )
    setSelectedPost((prev) =>
      prev
        ? {
            ...prev,
            stats: { ...prev.stats, likes: likeCount },
            viewer_state: { ...prev.viewer_state, is_liked: liked },
          }
        : prev
    )
    return { liked, likeCount }
  }

  const handleModalToggleSave = async () => {
    const id = selectedPost?.post_id || selectedPost?.id
    if (!id) return null
    const response = await apiRequest(`/social/posts/${encodeURIComponent(id)}/save/`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const saved = Boolean(response.data?.saved)
    const saveCount = Number(response.data?.save_count || 0)
    if (saved) addSavedPost(id)
    else removeSavedPost(id)
    setPosts((prev) =>
      prev.map((post) =>
        String(post.post_id || post.id) === String(id)
          ? {
              ...post,
              stats: { ...post.stats, saves: saveCount },
              viewer_state: { ...post.viewer_state, is_saved: saved },
            }
          : post
      )
    )
    setSelectedPost((prev) =>
      prev
        ? {
            ...prev,
            stats: { ...prev.stats, saves: saveCount },
            viewer_state: { ...prev.viewer_state, is_saved: saved },
          }
        : prev
    )
    return { saved, saveCount }
  }

  const followingItems = useMemo(() => {
    return followingPreview
  }, [followingPreview])

  return (
    <section className={styles.wrapper}>
      <div className={styles.content}>
        <div className={styles.topCard}>
          <div className={styles.sectionTitleRow}>
            <h2 className={styles.sectionTitle}>{t('pages.community.following')}</h2>
            <div className={styles.sectionLine} />
          </div>

          <div className={styles.followingRow}>
            {followingItems.map((item) => (
              <div
                key={item.id}
                className={`${styles.followingItem} ${item.more ? styles.followingMore : ''}`}
              >
                <div 
                  className={styles.followingAvatar}
                  style={{ cursor: (!item.more && item.id) ? 'pointer' : 'default' }}
                  role={(!item.more && item.id) ? 'button' : undefined}
                  tabIndex={(!item.more && item.id) ? 0 : undefined}
                  onClick={() => !item.more && item.id && navigate(`/profile/${item.id}`)}
                  onKeyDown={(event) => {
                    if ((event.key === 'Enter' || event.key === ' ') && !item.more && item.id) {
                      event.preventDefault()
                      navigate(`/profile/${item.id}`)
                    }
                  }}
                >
                  {item.avatar_url ? (
                    <img src={item.avatar_url} alt={item.name} className={styles.avatarImg} />
                  ) : (
                    item.initials
                  )}
                </div>
                <span className={styles.followingName}>{item.name}</span>
                {!item.more && item.is_following && <span className={styles.activeDot} />}
              </div>
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
              {t('pages.community.newPostsSinceLastVisit', { count: newPostsCount })}
            </span>
            <div className={styles.newPostLine} />
          </div>
        </div>

        <div className={styles.feed}>
          {loading && <div className={styles.emptyState}>{t('common.loading')}</div>}
          {!loading && posts.length === 0 && (
            <div className={styles.emptyState}>{t('pages.community.noCommunityPosts')}</div>
          )}
          {!loading &&
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                queue={audioQueue}
                onToggleSave={toggleSavePost}
                onToggleLike={toggleLikePost}
                onOpenComments={(post) => setSelectedPost(post)}
                onShare={(post) => setSharingPost(post)}
                onHide={hidePost}
                onReport={(post) => setReportPost(post)}
              />
            ))}
        </div>
      </div>

      {selectedPost && (
        <CommentModal
          podcast={toCommentPodcast(selectedPost)}
          liked={selectedPost.viewer_state?.is_liked}
          saved={selectedPost.viewer_state?.is_saved}
          likeCount={selectedPost.stats?.likes}
          shareCount={selectedPost.stats?.shares}
          saveCount={selectedPost.stats?.saves}
          commentCount={selectedPost.stats?.comments}
          disableAutoScroll={false}
          onClose={() => setSelectedPost(null)}
          onToggleLike={handleModalToggleLike}
          onToggleSave={handleModalToggleSave}
          onCommentCountChange={(count) =>
            handleCommentCountChange(selectedPost.post_id || selectedPost.id, count)
          }
          onPostDeleted={(id) => {
            setPosts((prev) =>
              prev.filter((post) => String(post.post_id || post.id) !== String(id))
            )
            setSelectedPost(null)
          }}
        />
      )}

      {sharingPost && (
        <ShareModal
          podcast={toCommentPodcast(sharingPost)}
          onClose={() => setSharingPost(null)}
          onShareSuccess={(data) =>
            handleShareSuccess(sharingPost.post_id || sharingPost.id, data)
          }
        />
      )}

      {reportPost && (
        <ReportPostModal
          postId={reportPost.post_id || reportPost.id}
          postTitle={reportPost.title}
          authorId={reportPost.author?.id}
          authorName={reportPost.author?.name || reportPost.author?.username}
          onClose={() => setReportPost(null)}
        />
      )}

      <SaveCollectionModal
        isOpen={Boolean(savingPost)}
        onClose={() => setSavingPost(null)}
        postId={savingPost?.post_id || savingPost?.id}
        onSave={handleSavedToCollection}
        triggerRef={saveButtonRef}
        isPopup={false}
      />
    </section>
  )
}
