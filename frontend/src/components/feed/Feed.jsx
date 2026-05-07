  import { useEffect, useLayoutEffect, useRef, useState, useContext } from 'react'
  import PodcastCard from './PodcastCard'
  import styles from '../../style/feed/Feed.module.css'
  import { getInitials } from '../../utils/getInitials'
  import { useTagFilter } from '../contexts/TagFilterContext'
  import { PodcastContext } from '../contexts/PodcastContext'
  import { useAudioPlayer } from '../contexts/AudioPlayerContext'
  import { useSearchParams } from 'react-router-dom'
  import CommentModal from './CommentModal'
  import ShareModal from './ShareModal'
  import { Heart, MessageCircle, Share2, Bookmark, Loader2, MoreHorizontal, Edit, Trash2, EyeOff, Flag } from 'lucide-react'
  import { getToken, getCurrentUser } from '../../utils/auth'
  import { apiRequest } from '../../utils/api'

  // Avatar người chia sẻ: hiển thị ảnh nếu load được, fallback sang initials
  function SharedByAvatar({ user, className, initialsClassName }) {
    const [imgError, setImgError] = useState(false)
    const avatarUrl = user?.avatar_url
    const displayName = user?.name || user?.username || 'User'
    const initials = getInitials(user?.username || user?.name || 'User')

    if (avatarUrl && !imgError) {
      return (
        <div className={className}>
          <img
            src={avatarUrl}
            alt={displayName}
            className={styles.postShareAvatar}
            onError={() => setImgError(true)}
          />
        </div>
      )
    }

    return (
      <div className={className}>
        <div className={initialsClassName}>
          {initials}
        </div>
      </div>
    )
  }

  // Component bài chia sẻ - cấu trúc giống trang /profile
  function SharedPostCard({ podcast, podcasts, setPodcasts, dispatchPostSync }) {
    const [liked, setLiked] = useState(podcast.liked ?? false)
    const [likeCount, setLikeCount] = useState(podcast.likes ?? 0)
    const [saved, setSaved] = useState(podcast.saved ?? false)
    const [saveCount, setSaveCount] = useState(podcast.saveCount ?? 0)
    const [commentCount, setCommentCount] = useState(podcast.comments ?? 0)
    const [shareCount, setShareCount] = useState(podcast.shares ?? 0)
    const [showCommentModal, setShowCommentModal] = useState(false)
    const [showShareModal, setShowShareModal] = useState(false)
    // State cho bài gốc khi click vào card
    const [originalPost, setOriginalPost] = useState(null)
    const [showOriginalModal, setShowOriginalModal] = useState(false)
    const [loadingOriginal, setLoadingOriginal] = useState(false)
    // State cho menu 3 chấm
    const [menuOpen, setMenuOpen] = useState(false)
    const menuRef = useRef(null)
    const { addSavedPost, removeSavedPost } = useContext(PodcastContext)
    const POST_SYNC_EVENT = 'post-sync-updated'

    // Kiểm tra xem bài chia sẻ này có phải của user hiện tại không
    const currentUser = getCurrentUser()
    const isOwner = String(currentUser?.id) === String(podcast.sharedBy?.id) ||
                    String(currentUser?.username) === String(podcast.sharedBy?.username)

    // Đóng menu khi click ra ngoài
    useEffect(() => {
      if (!menuOpen) return
      const handleClickOutside = (e) => {
        if (menuRef.current && !menuRef.current.contains(e.target)) {
          setMenuOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [menuOpen])

    // Sync với post-sync event từ Feed
    useEffect(() => {
      const handler = (e) => {
        const d = e.detail || {}
        if (String(d.postId) !== String(podcast.id)) return
        if (typeof d.liked === 'boolean') setLiked(d.liked)
        if (typeof d.likeCount === 'number') setLikeCount(d.likeCount)
        if (typeof d.saved === 'boolean') setSaved(d.saved)
        if (typeof d.saveCount === 'number') setSaveCount(d.saveCount)
      }
      window.addEventListener(POST_SYNC_EVENT, handler)
      return () => window.removeEventListener(POST_SYNC_EVENT, handler)
    }, [podcast.id])

    const handleToggleLike = async (e) => {
      e.preventDefault()
      e.stopPropagation()
      try {
        const token = getToken()
        const user = getCurrentUser()
        const res = await fetch(`http://localhost:8000/api/social/posts/${podcast.id}/like/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ user_id: user?.id }),
        })
        const data = await res.json()
        if (!res.ok || !data.success) return
        const nextLiked = Boolean(data.data?.liked)
        const nextLikeCount = Number(data.data?.like_count || 0)
        setLiked(nextLiked)
        setLikeCount(nextLikeCount)
        dispatchPostSync({ postId: podcast.id, liked: nextLiked, likeCount: nextLikeCount })
      } catch (err) {
        console.error('Like failed:', err)
      }
    }

    const handleToggleSave = async (e) => {
      e.preventDefault()
      e.stopPropagation()
      try {
        const token = getToken()
        const user = getCurrentUser()
        const res = await fetch(`http://localhost:8000/api/social/posts/${podcast.id}/save/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ user_id: user?.id }),
        })
        const data = await res.json()
        if (!res.ok || !data.success) return
        const nextSaved = Boolean(data.data?.saved)
        const nextSaveCount = Number(data.data?.save_count || 0)
        setSaved(nextSaved)
        setSaveCount(nextSaveCount)
        if (nextSaved) addSavedPost(podcast.id)
        else removeSavedPost(podcast.id)
        dispatchPostSync({ postId: podcast.id, saved: nextSaved, saveCount: nextSaveCount })
      } catch (err) {
        console.error('Save failed:', err)
      }
    }

    // Fetch và hiển thị bài viết gốc khi click vào card - giống /profile
    const handleOpenOriginalPost = async () => {
      const postId = podcast.postId || podcast.post_id
      if (!postId) return

      try {
        setLoadingOriginal(true)
        const data = await apiRequest(`/content/posts/${postId}/`)
        if (data && data.data) {
          const orig = data.data
          setOriginalPost({
            ...orig,
            id: orig.id,
            title: orig.title,
            description: orig.description,
            author: orig.author || '',
            authorUsername: orig.author_username || '',
            authorId: orig.author_id || '',
            authorInitials: orig.author ? orig.author.substring(0, 2).toUpperCase() : 'A',
            audioUrl: orig.audio_url || '',
            durationSeconds: orig.duration_seconds || 0,
            cover: orig.thumbnail_url,
            thumbnail_url: orig.thumbnail_url,
            tags: (orig.tags || []).map(t => `#${t.name || t}`),
            aiGenerated: orig.is_ai_generated || false,
            timeAgo: new Date(orig.created_at).toLocaleDateString('vi-VN'),
            listens: `${orig.listen_count || 0} lượt nghe`,
            likes: orig.like_count || 0,
            comments: orig.comment_count || 0,
            shares: orig.share_count || 0,
            saveCount: orig.save_count || 0,
            liked: orig.is_liked || false,
            saved: orig.is_saved || false,
          })
          setShowOriginalModal(true)
        }
      } catch (err) {
        console.error('Failed to fetch original post:', err)
      } finally {
        setLoadingOriginal(false)
      }
    }

    // Xóa (unshare) bài chia sẻ
    const handleDeleteShare = async () => {
      setMenuOpen(false)
      const postId = podcast.postId || podcast.post_id
      if (!postId) return
      if (!window.confirm('Bạn muốn xóa bài chia sẻ này?')) return
      try {
        const token = getToken()
        const user = getCurrentUser()
        const res = await fetch(`http://localhost:8000/api/social/posts/${postId}/unshare/`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ user_id: user?.id }),
        })
        if (res.ok) {
          setPodcasts(prev => prev.filter(p => p.id !== podcast.id))
        } else {
          const data = await res.json()
          console.error('Unshare failed:', data)
        }
      } catch (err) {
        console.error('Delete share failed:', err)
      }
    }

    // Chỉnh sửa: mở ShareModal để chỉnh caption
    const handleEditShare = () => {
      setMenuOpen(false)
      setShowShareModal(true)
    }

    // Ẩn bài viết chia sẻ
    const handleHideShare = async () => {
      setMenuOpen(false)
      if (!window.confirm('Bạn có muốn ẩn bài viết này khỏi feed không?')) return
      try {
        const token = getToken()
        const currentUser = getCurrentUser()
        const postId = podcast.id // Dùng ID của bài share

        const res = await fetch(`http://localhost:8000/api/social/posts/${postId}/hide/`, {
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
          throw new Error('Ẩn bài viết thất bại')
        }

        setPodcasts(prev => prev.filter(p => p.id !== podcast.id))
      } catch (err) {
        console.error('Hide post error:', err)
        alert(err.message || 'Ẩn bài viết thất bại')
      }
    }

    // Báo cáo bài viết chia sẻ
    const handleReportShare = () => {
      setMenuOpen(false)
      const reason = window.prompt('Vui lòng cho biết lý do báo cáo bài viết này:')
      if (reason === null) return // User cancelled
      if (!reason.trim()) {
        alert('Vui lòng nhập lý do báo cáo')
        return
      }
      
      // Giả lập API gọi thành công
      alert('Đã gửi báo cáo thành công. Cảm ơn bạn đã phản hồi!')
    }

    return (
      <div className={styles.postShareContainer}>
        <div className={styles.postShareWrapper}>
          {/* Header: avatar + tên người chia sẻ + thời gian + menu 3 chấm */}
          <div className={styles.postShareInfo}>
            <div className={styles.postShareAuthor}>
              <SharedByAvatar
                user={podcast.sharedBy}
                className={styles.postShareAvatarWrapper}
                initialsClassName={styles.postShareAvatarInitials}
              />
              <div>
                <h5 className={styles.postShareAuthorName}>
                  {podcast.sharedBy?.name || podcast.sharedBy?.username || 'Ẩn danh'}
                </h5>
                <p className={styles.postShareTime}>
                  {podcast.sharedTimeAgo || podcast.timeAgo}
                </p>
              </div>
            </div>

            {/* Menu 3 chấm - hiện cho tất cả (tùy chọn khác nhau theo isOwner) */}
            <div className={styles.shareMenuWrap} ref={menuRef}>
              <button
                className={styles.shareMenuBtn}
                onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
                title="Tùy chọn"
              >
                <MoreHorizontal size={18} />
              </button>

              {menuOpen && (
                <div className={styles.shareMenuDropdown}>
                  {isOwner ? (
                    <>
                      <button
                        className={styles.shareMenuOption}
                        onClick={handleEditShare}
                      >
                        <Edit size={15} />
                        <span>Chỉnh sửa</span>
                      </button>
                      <button
                        className={`${styles.shareMenuOption} ${styles.shareMenuOptionDanger}`}
                        onClick={handleDeleteShare}
                      >
                        <Trash2 size={15} />
                        <span>Xóa</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className={styles.shareMenuOption}
                        onClick={handleHideShare}
                      >
                        <EyeOff size={15} />
                        <span>Ẩn bài viết</span>
                      </button>
                      <button
                        className={`${styles.shareMenuOption} ${styles.shareMenuOptionDanger}`}
                        onClick={handleReportShare}
                      >
                        <Flag size={15} />
                        <span>Báo cáo</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Caption của người chia sẻ */}
          {podcast.shareCaption && (
            <div className={styles.shareCaption}>
              <p>{podcast.shareCaption}</p>
            </div>
          )}

          {/* Nội dung bài gốc - dùng postTimeAgo để hiện đúng thời gian đăng bài gốc */}
          <div
            className={styles.postShareCard}
            onClick={(e) => {
              // Không mở modal nếu click vào interactive element bên trong card
              const tag = e.target.tagName.toLowerCase()
              if (['button', 'input', 'a', 'select', 'textarea'].includes(tag)) return
              if (e.target.closest('button, input, a, [role="button"]')) return
              handleOpenOriginalPost()
            }}
            style={{ cursor: loadingOriginal ? 'wait' : 'pointer' }}
            title="Click để xem bài viết gốc"
          >
            {loadingOriginal && (
              <div className={styles.postShareCardLoading}>
                <Loader2 size={18} className={styles.spinnerIcon} />
                <span>Đang tải...</span>
              </div>
            )}
            <PodcastCard
              podcast={{ ...podcast, timeAgo: podcast.postTimeAgo || podcast.timeAgo }}
              queue={podcasts}
              onDelete={(postId) => setPodcasts(prev => prev.filter(p => p.id !== postId))}
              onHide={(postId) => setPodcasts(prev => prev.filter(p => p.id !== postId))}
              hideMenu={true}
              hideActions={true}
            />
          </div>

          {/* Action bar riêng - giống profile */}
          <div className={styles.postShareActions}>
            <button
              className={`${styles.shareActionBtn} ${liked ? styles.liked : ''}`}
              onClick={handleToggleLike}
            >
              <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
              <span>{likeCount}</span>
            </button>
            <button
              className={styles.shareActionBtn}
              onClick={() => setShowCommentModal(true)}
            >
              <MessageCircle size={16} />
              <span>{commentCount} Bình luận</span>
            </button>
            <button
              className={styles.shareActionBtn}
              onClick={() => setShowShareModal(true)}
            >
              <Share2 size={16} />
              <span>{shareCount} Chia sẻ</span>
            </button>
            <button
              className={`${styles.shareActionBtn} ${styles.shareActionBtnSave} ${saved ? styles.saved : ''}`}
              onClick={handleToggleSave}
            >
              <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
              <span>{saveCount} Lưu</span>
            </button>
          </div>
        </div>

        {/* Comment Modal */}
        {showCommentModal && (
          <CommentModal
            podcast={{ ...podcast, liked, saved, likes: likeCount, saveCount, shares: shareCount, comments: commentCount }}
            liked={liked}
            saved={saved}
            likeCount={likeCount}
            shareCount={shareCount}
            saveCount={saveCount}
            commentCount={commentCount}
            onClose={() => setShowCommentModal(false)}
            onCommentCountChange={(newCount) => setCommentCount(newCount)}
            onToggleLike={handleToggleLike}
            onToggleSave={handleToggleSave}
            onPostDeleted={(postId) => setPodcasts(prev => prev.filter(p => p.id !== postId))}
          />
        )}

        {/* Share Modal */}
        {showShareModal && (
          <ShareModal
            podcast={podcast}
            onClose={() => setShowShareModal(false)}
            onShareSuccess={(data) => {
              const newShareCount = Number(data?.share_count || 0)
              setShareCount(newShareCount)
              dispatchPostSync({ postId: podcast.id, shareCount: newShareCount })
            }}
          />
        )}

        {/* Modal bài viết gốc khi click vào card - giống /profile */}
        {showOriginalModal && originalPost && (
          <CommentModal
            podcast={originalPost}
            liked={originalPost.liked}
            saved={originalPost.saved}
            likeCount={originalPost.likes}
            shareCount={originalPost.shares}
            saveCount={originalPost.saveCount}
            commentCount={originalPost.comments}
            onClose={() => {
              setShowOriginalModal(false)
              setOriginalPost(null)
            }}
            onToggleLike={async (e) => {
              e?.preventDefault?.()
              e?.stopPropagation?.()
              try {
                const token = getToken()
                const user = getCurrentUser()
                const res = await fetch(`http://localhost:8000/api/social/posts/${originalPost.id}/like/`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({ user_id: user?.id }),
                })
                const data = await res.json()
                if (!res.ok || !data.success) return
                setOriginalPost(prev => ({
                  ...prev,
                  liked: Boolean(data.data?.liked),
                  likes: Number(data.data?.like_count || 0),
                }))
              } catch (err) {
                console.error('Like original post failed:', err)
              }
            }}
            onToggleSave={async (e) => {
              e?.preventDefault?.()
              e?.stopPropagation?.()
              try {
                const token = getToken()
                const user = getCurrentUser()
                const res = await fetch(`http://localhost:8000/api/social/posts/${originalPost.id}/save/`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({ user_id: user?.id }),
                })
                const data = await res.json()
                if (!res.ok || !data.success) return
                setOriginalPost(prev => ({
                  ...prev,
                  saved: Boolean(data.data?.saved),
                  saveCount: Number(data.data?.save_count || 0),
                }))
              } catch (err) {
                console.error('Save original post failed:', err)
              }
            }}
            onPostDeleted={(postId) => {
              setShowOriginalModal(false)
              setOriginalPost(null)
              setPodcasts(prev => prev.filter(p => p.id !== postId))
            }}
          />
        )}
      </div>
    )
  }

  const TABS = [
    { label: 'Dành cho bạn', key: 'for_you' },
    { label: 'Đang theo dõi', key: 'following' },
    { label: 'Xu hướng', key: 'trending' },
    { label: 'Mới nhất', key: 'latest' },
  ]

  export default function Feed() {
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
    const { selectedTagIds } = useTagFilter()
    const { setSavedPostIds_batch, deletePost, hidePost } = useContext(PodcastContext)
    const [searchParams, setSearchParams] = useSearchParams()
    const { pauseTrackIfDeleted, currentTrack } = useAudioPlayer()
    const feedScrollKey = 'mainScroll:/feed'
    const focusPostId = sessionStorage.getItem('feedFocusPostId')
    const POST_SYNC_EVENT = 'post-sync-updated'

    const dispatchPostSync = (payload) => {
      window.dispatchEvent(new CustomEvent(POST_SYNC_EVENT, { detail: payload }))
    }

    useEffect(() => {
      const handlePostSync = (event) => {
        const d = event.detail || {}

        if (!d.postId) return
        const oldSync = JSON.parse(
          localStorage.getItem(`post-sync-${d.postId}`) || '{}'
        )

        const nextSync = {
          ...oldSync,
        }

        if (typeof d.liked === 'boolean') {
          nextSync.liked = d.liked
        }

        if (typeof d.likeCount === 'number') {
          nextSync.likeCount = d.likeCount
        }

        if (typeof d.saved === 'boolean') {
          nextSync.saved = d.saved
        }

        if (typeof d.saveCount === 'number') {
          nextSync.saveCount = d.saveCount
        }

        localStorage.setItem(`post-sync-${d.postId}`, JSON.stringify(nextSync))

        setPodcasts(prev =>
          prev.map(p =>
            String(p.id) === String(d.postId)
              ? {
                  ...p,
                  liked: typeof d.liked === 'boolean' ? d.liked : p.liked,
                  likes: typeof d.likeCount === 'number' ? d.likeCount : p.likes,
                  saved: typeof d.saved === 'boolean' ? d.saved : p.saved,
                  saveCount: typeof d.saveCount === 'number' ? d.saveCount : p.saveCount,
                }
              : p
          )
        )

        setSelectedPodcast(prev =>
          prev && String(prev.id) === String(d.postId)
            ? {
                ...prev,
                liked: typeof d.liked === 'boolean' ? d.liked : prev.liked,
                likes: typeof d.likeCount === 'number' ? d.likeCount : prev.likes,
                saved: typeof d.saved === 'boolean' ? d.saved : prev.saved,
                saveCount: typeof d.saveCount === 'number' ? d.saveCount : prev.saveCount,
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

          const currentTab = TABS[activeTab]?.key || 'for_you'
          const limit = focusPostId ? 50 : 10

          let path = `/content/feed/?limit=${limit}&tab=${encodeURIComponent(currentTab)}`
          if (selectedTagIds && selectedTagIds.length > 0) {
            path += `&tags=${encodeURIComponent(selectedTagIds.join(','))}`
            console.log('🎯 Fetching feed with tags:', selectedTagIds)
          }

          const data = await apiRequest(path)

          const mapped = (data.items || []).map((item) => {
            const durationSeconds =
              Number(item.audio?.duration_seconds || item.viewer_state?.duration_seconds || 0)

            const progressSeconds =
              Number(item.viewer_state?.progress_seconds || 0)
            
            const cachedSync = JSON.parse(
              localStorage.getItem(`post-sync-${item.id}`) || '{}'
            )

            const isShared = item.type === 'shared' || Boolean(item.share_id)

            return {
              id: item.id,
              postId: item.post_id || item.id,
              shareId: item.share_id || null,
              type: isShared ? 'shared' : 'original',
              title: item.title,
              author: item.author?.name || 'Ẩn danh',
              authorUsername: item.author?.username || '',
              authorInitials: getInitials(item.author || 'A'),
              sharedBy: item.shared_by || null,
              sharedAt: item.shared_at || null,
              shareCaption: item.share_caption || '',
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
              // Ensure comment counts are present on feed items so cards show correct counts
              comments: cachedSync.commentCount ?? item.stats?.comments ?? item.comment_count ?? item.comments ?? 0,
              comment_count: cachedSync.commentCount ?? item.stats?.comments ?? item.comment_count ?? item.comments ?? 0,
              timeAgo: formatTimeAgo(item.created_at),           // Thời gian chia sẻ
              sharedTimeAgo: item.shared_at ? formatTimeAgo(item.shared_at) : formatTimeAgo(item.created_at),
              postTimeAgo: item.post_created_at ? formatTimeAgo(item.post_created_at) : formatTimeAgo(item.created_at), // Thời gian đăng bài gốc
              listens: `${item.listen_count || 0} lượt nghe`,
              shares: item.stats?.shares || 0,
              audioUrl: item.audio?.audio_url || '',
              audioId: item.audio?.id || '',
              voiceName: item.audio?.voice_name || '',
            }
          })

          setPodcasts(mapped)
          
          const savedPostIds = mapped
            .filter(p => p.saved)
            .map(p => p.id)
          setSavedPostIds_batch(savedPostIds)
        } catch (err) {
          console.error('Fetch feed failed:', err)
          setError('Không tải được feed')
        } finally {
          setLoading(false)
        }
      }

      fetchFeed()
    }, [activeTab, selectedTagIds])

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
          const target = podcasts.find(p => String(p.id) === String(openPostId))
          if (target) {
            setDisableModalAutoScroll(true)
            setSelectedPodcast(target)
          }
        }

        sessionStorage.removeItem('returnFromEdit')
        sessionStorage.removeItem('feedScrollPosition')
        sessionStorage.removeItem('feedFocusPostId')
        sessionStorage.removeItem('openPostDetailId')
        sessionStorage.removeItem('openPostDetailNoScroll')
        sessionStorage.removeItem('returnToAfterEdit')
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
    }, [loading, podcasts.length, feedScrollKey])

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

        const target = podcasts.find(p => String(p.id) === String(postId))
        if (target) {
          setDisableModalAutoScroll(Boolean(event.detail?.disableAutoScroll))
          setSelectedPodcast(target)
        }
      }

      window.addEventListener('open-post-detail', handleOpenPostDetail)

      return () => {
        window.removeEventListener('open-post-detail', handleOpenPostDetail)
      }
    }, [podcasts])

    const handleModalToggleLike = async (e) => {
      e?.preventDefault?.()
      e?.stopPropagation?.()

      if (!selectedPodcast?.id) return

      const token = localStorage.getItem('educast_access')
      const currentUser = JSON.parse(localStorage.getItem('educast_user') || 'null')

      const res = await fetch(
        `http://localhost:8000/api/social/posts/${selectedPodcast.id}/like/`,
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
      if (!res.ok || !data.success) return

      const nextLiked = Boolean(data.data?.liked)
      const nextLikeCount = Number(data.data?.like_count || 0)

      setSelectedPodcast(prev => ({
        ...prev,
        liked: nextLiked,
        likes: nextLikeCount,
      }))

      setPodcasts(prev =>
        prev.map(p =>
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
      const currentUser = JSON.parse(localStorage.getItem('educast_user') || 'null')

      const res = await fetch(
        `http://localhost:8000/api/social/posts/${selectedPodcast.id}/save/`,
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
      if (!res.ok || !data.success) return

      const nextSaved = Boolean(data.data?.saved)
      const nextSaveCount = Number(data.data?.save_count || 0)

      setSelectedPodcast(prev => ({
        ...prev,
        saved: nextSaved,
        saveCount: nextSaveCount,
      }))

      setPodcasts(prev =>
        prev.map(p =>
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

    useLayoutEffect(() => {
      if (loading || podcasts.length === 0) return
      if (sessionStorage.getItem('returnFromEdit') !== 'true') return

      const scrollTop = Number(sessionStorage.getItem('feedScrollPosition') || 0)
      const openPostId = sessionStorage.getItem('openPostDetailId')

      requestAnimationFrame(() => {
        const main = document.querySelector('main')
        main?.scrollTo({
          top: scrollTop,
          behavior: 'auto',
        })

        if (openPostId) {
          const target = podcasts.find(p => String(p.id) === String(openPostId))
          if (target) {
            setDisableModalAutoScroll(true)
            setSelectedPodcast(target)
          }
        }

        sessionStorage.removeItem('returnFromEdit')
        sessionStorage.removeItem('feedScrollPosition')
        sessionStorage.removeItem('feedFocusPostId')
        sessionStorage.removeItem('openPostDetailId')
        sessionStorage.removeItem('openPostDetailNoScroll')
        sessionStorage.removeItem('returnToAfterEdit')
      })
    }, [loading, podcasts])

    return (
      <section className={styles.feed}>
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
          {loading && <div className={styles.feedState}>Đang tải dữ liệu...</div>}
          {error && <div className={styles.feedError}>{error}</div>}
          {!loading && !error && podcasts.map((podcast) => (
            <div key={podcast.id} data-post-id={podcast.id}>
              {podcast.type === 'shared' ? (
                <SharedPostCard
                  podcast={podcast}
                  podcasts={podcasts}
                  setPodcasts={setPodcasts}
                  dispatchPostSync={dispatchPostSync}
                />
              ) : (
                <PodcastCard
                  podcast={podcast}
                  queue={podcasts}
                  onDelete={(postId) => {
                    setPodcasts(prev => prev.filter(p => p.id !== postId))
                  }}
                  onHide={(postId) => {
                    setPodcasts(prev => prev.filter(p => p.id !== postId))
                  }}
                />
              )}
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
              setPodcasts(prev => prev.filter(p => p.id !== postId))
              setSelectedPodcast(null)
            }}
          />
        )}
      </section>
    )
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