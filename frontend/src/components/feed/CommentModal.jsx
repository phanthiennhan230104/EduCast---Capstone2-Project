import { useEffect, useLayoutEffect, useRef, useState, useContext } from 'react'
import { X, MoreHorizontal, Heart, MessageCircle, Share2, Bookmark, Edit, Trash2, EyeOff, Flag, Play, Pause } from 'lucide-react'
import { toast } from 'react-toastify'
import ConfirmModal from './ConfirmModal'
import ShareModal from './ShareModal'
import SaveCollectionModal from '../common/SaveCollectionModal'
import styles from '../../style/feed/CommentModal.module.css'
import { getToken, getCurrentUser } from '../../utils/auth'
import { getInitials } from '../../utils/getInitials'
import { createPortal } from 'react-dom'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { PodcastContext } from '../contexts/PodcastContext'
import { useNavigate, useLocation } from 'react-router-dom'


function CommentNode({
  item,
  level = 0,
  currentUser,
  podcast,
  openMenuId,
  setOpenMenuId,
  menuRefs,
  isOwnComment,
  formatCommentTime,
  handleToggleCommentLike,
  openReplyBox,
  closeReplyBox,
  replyingTarget,
  replyInput,
  setReplyInput,
  replyInputRef,
  replySubmitting,
  handleSubmitReply,
  getDisplayName,
  editingCommentId,
  editingInput,
  setEditingInput,
  editingSubmitting,
  openEditComment,
  cancelEditComment,
  handleUpdateComment,
  handleDeleteComment,
  hiddenCommentIds,
  hideCommentLocally,
}) {
  const own = isOwnComment(item)
  const isMenuOpen = openMenuId === item.id
  const isReplyingHere = replyingTarget?.id === item.id
  const isTopLevel = level === 0

  const wrapperClass = isTopLevel ? styles.commentItem : styles.replyItem
  const avatarClass = isTopLevel ? styles.commentAvatar : styles.replyAvatar
  const mainClass = isTopLevel ? styles.commentMain : styles.replyMain
  const bubbleClass = isTopLevel ? styles.commentBubble : styles.replyBubble
  const authorClass = isTopLevel ? styles.commentAuthor : styles.replyAuthor
  const contentClass = isTopLevel ? styles.commentContent : styles.replyContent
  const metaClass = isTopLevel ? styles.commentMeta : styles.replyMeta
  const isEditingHere = editingCommentId === item.id

  return (
    <div
      className={wrapperClass}
      style={level > 2 ? { marginLeft: `${(level - 2) * 24}px` } : undefined}
    >
      <div className={avatarClass}>{getInitials(item.username)}</div>

      <div className={mainClass}>
        <div className={styles.commentRow}>
          <div className={styles.commentBubbleWrap}>
            <div className={bubbleClass}>
              <div
                className={authorClass}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/profile/${item.username || item.user_id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/profile/${item.username || item.user_id}`) }}
              >
                {item.username || item.user_id}
              </div>

              <div className={contentClass}>
                {isEditingHere ? (
                  <div className={styles.editBox}>
                    <input
                      type="text"
                      value={editingInput}
                      onChange={(e) => setEditingInput(e.target.value)}
                      className={styles.editInput}
                      placeholder="Nhập nội dung mới..."
                    />

                    <div className={styles.editActions}>
                      <button
                        type="button"
                        className={styles.editActionBtn}
                        onClick={() => handleUpdateComment(item.id)}
                        disabled={editingSubmitting || !editingInput.trim() || editingInput === item.content}
                      >
                        Lưu
                      </button>

                      <button
                        type="button"
                        className={styles.editActionBtnSecondary}
                        onClick={cancelEditComment}
                        disabled={editingSubmitting}
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : item.reply_to_username ? (
                  <>
                    <span className={styles.replyMentionInline}>
                      @{item.reply_to_username}
                    </span>{' '}
                    {item.content}
                  </>
                ) : (
                  item.content
                )}
              </div>
            </div>
          </div>

          <div
            ref={(el) => {
              if (el) menuRefs.current[item.id] = el
              else delete menuRefs.current[item.id]
            }}
            className={styles.commentMenuWrap}
          >
            <button
              type="button"
              className={styles.commentMoreBtn}
              aria-label="Tùy chọn bình luận"
              onClick={(e) => {
                e.stopPropagation()
                setOpenMenuId(isMenuOpen ? null : item.id)
              }}
            >
              <MoreHorizontal size={18} />
            </button>

            {isMenuOpen && (
              <div className={styles.commentDropdown}>
                {own ? (
                  <>
                    <button
                      type="button"
                      className={styles.commentDropdownItem}
                      onClick={() => openEditComment(item)}
                    >
                      Chỉnh sửa
                    </button>

                    <button
                      type="button"
                      className={`${styles.commentDropdownItem} ${styles.commentDropdownItemDanger}`}
                      onClick={() => handleDeleteComment(item)}
                    >
                      Xóa
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={styles.commentDropdownItem}
                    onClick={() => hideCommentLocally(item.id)}
                  >
                    Ẩn
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={metaClass}>
          <span className={styles.commentTime}>{formatCommentTime(item)}</span>

          <button
            type="button"
            className={`${styles.commentMetaBtn} ${item.is_liked ? styles.commentMetaBtnActive : ''}`}
            onClick={() => handleToggleCommentLike(item.id)}
          >
            Thích
          </button>

          <button
            type="button"
            className={styles.commentMetaBtn}
            onClick={() => openReplyBox(item)}
          >
            Trả lời
          </button>

          {((item.like_count || 0) > 0 || item.is_liked) && (
            <div className={styles.commentLikeBadgeInline}>
              <span>{item.like_count || 1}</span>
              <Heart size={13} fill="#ff7b94" />
            </div>
          )}
        </div>

        {isReplyingHere && (
          <form
            className={styles.replyComposer}
            style={level > 1 ? { marginLeft: `-${(level - 1) * 24}px` } : undefined}
            onSubmit={(e) => handleSubmitReply(e, replyingTarget)}
          >
            <div className={avatarClass}>{getInitials(currentUser?.username)}</div>

            <div className={styles.replyInputWrap}>
              <div className={styles.replyTagLine}>
                <span className={styles.replyTagLabel}>Trả lời</span>
                <span className={styles.replyMention}>
                  @{getDisplayName(replyingTarget)}
                </span>
              </div>

              <div className={styles.replyInputRow}>
                <input
                  ref={replyInputRef}
                  type="text"
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  placeholder={`Viết phản hồi cho ${getDisplayName(replyingTarget)}...`}
                  className={styles.replyInput}
                />
                <button
                  type="submit"
                  className={styles.replySendBtn}
                  disabled={replySubmitting || !replyInput.trim()}
                >
                  Gửi
                </button>
              </div>
            </div>

            <button
              type="button"
              className={styles.replyCancelBtn}
              onClick={closeReplyBox}
            >
              Hủy
            </button>
          </form>
        )}

        {Array.isArray(item.replies) && item.replies.length > 0 && level < 2 && (
          <div className={styles.replyList}>
            {item.replies
              .filter((child) => !hiddenCommentIds.includes(child.id))
              .map((child) => (
              <CommentNode
                key={child.id}
                item={child}
                level={level + 1}
                currentUser={currentUser}
                podcast={podcast}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
                menuRefs={menuRefs}
                isOwnComment={isOwnComment}
                formatCommentTime={formatCommentTime}
                handleToggleCommentLike={handleToggleCommentLike}
                openReplyBox={openReplyBox}
                closeReplyBox={closeReplyBox}
                replyingTarget={replyingTarget}
                replyInput={replyInput}
                setReplyInput={setReplyInput}
                replyInputRef={replyInputRef}
                replySubmitting={replySubmitting}
                handleSubmitReply={handleSubmitReply}
                getDisplayName={getDisplayName}
                editingCommentId={editingCommentId}
                editingInput={editingInput}
                setEditingInput={setEditingInput}
                editingSubmitting={editingSubmitting}
                openEditComment={openEditComment}
                cancelEditComment={cancelEditComment}
                handleUpdateComment={handleUpdateComment}
                handleDeleteComment={handleDeleteComment}
                hiddenCommentIds={hiddenCommentIds}
                hideCommentLocally={hideCommentLocally}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatTimeAgo(date) {
  if (!date) return 'Vừa đăng'

  const created = new Date(date)
  const now = new Date()
  const diffMs = now - created
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) return 'Vừa đăng'
  if (diffMinutes < 60) return `${diffMinutes} phút trước`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} giờ trước`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays} ngày trước`

  const months = Math.floor(diffDays / 30)
  if (months < 12) return `${months} tháng trước`

  return `${Math.floor(months / 12)} năm trước`
}

export default function CommentModal({
  podcast,
  liked,
  saved,
  likeCount,
  shareCount,
  saveCount,
  commentCount: initialCommentCount,
  onClose,
  onCommentCountChange,
  onToggleLike,
  onToggleSave,
  onShare,
  onPostDeleted,
  disableAutoScroll = false,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { playTrack, currentTrack, playing, togglePlay, currentTime, formattedCurrentTime, trackProgressMap, seekToPercent, isSeeking } = useAudioPlayer()
  const { deletePost, hidePost, removeSavedPost } = useContext(PodcastContext)
  const progressBarRef = useRef(null)
  
  const [comments, setComments] = useState([])
  const [commentInput, setCommentInput] = useState('')
  const [loadingComments, setLoadingComments] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [commentCount, setCommentCount] = useState(initialCommentCount ?? podcast.comments ?? 0)

  const [openMenuId, setOpenMenuId] = useState(null)
  const [replyingTarget, setReplyingTarget] = useState(null)
  const [replyInput, setReplyInput] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [commentToDelete, setCommentToDelete] = useState(null)
  const [showShareModal, setShowShareModal] = useState(false)
  
  const [postMenuOpen, setPostMenuOpen] = useState(false)
  const [deletePostModalOpen, setDeletePostModalOpen] = useState(false)
  const [hidePostModalOpen, setHidePostModalOpen] = useState(false)
  const [showCollectionModal, setShowCollectionModal] = useState(false)
  const [postMoreMenuOpen, setPostMoreMenuOpen] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const postMenuRef = useRef(null)
  const postMoreMenuRef = useRef(null)
  const saveButtonRef = useRef(null)

  const contentScrollRef = useRef(null)
  const commentListRef = useRef(null)
  const commentInputRef = useRef(null)
  const replyInputRef = useRef(null)
  const menuRefs = useRef({})
  const [didInitialScroll, setDidInitialScroll] = useState(false)
  const scrollPositionRef = useRef(0)

  const currentUser = getCurrentUser()

  useEffect(() => {
    console.log('🔍 DEBUG CommentModal - FULL PODCAST OBJECT:', podcast)
    console.log('🔍 DEBUG - Podcast fields:', {
      id: podcast.id,
      title: podcast.title,
      duration_seconds: podcast.duration_seconds,
      audio_url: podcast.audio_url,
      audioUrl: podcast.audioUrl,
      all_keys: Object.keys(podcast),
    })
    console.log('🔍 DEBUG - currentUser:', currentUser)
  }, [currentUser, podcast])

  useEffect(() => {
    fetchComments()
  }, [])

  useEffect(() => {
    // Save scroll position when modal opens
    const main = document.querySelector('main')
    if (main) {
      scrollPositionRef.current = main.scrollTop
      console.log('💾 [CommentModal] Saved scroll position:', scrollPositionRef.current)
    }
    
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      // Restore scroll position when modal closes
      if (main) {
        setTimeout(() => {
          main.scrollTop = scrollPositionRef.current
          console.log('🔄 [CommentModal] Restored scroll position:', scrollPositionRef.current)
        }, 0)
      }
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = () => {
      setOpenMenuId(null)
    }

    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    const handleClickOutsidePostMenu = (e) => {
      if (postMenuRef.current && !postMenuRef.current.contains(e.target)) {
        setPostMenuOpen(false)
      }
      if (postMoreMenuRef.current && !postMoreMenuRef.current.contains(e.target)) {
        setPostMoreMenuOpen(false)
      }
    }

    const handleScroll = () => {
      setPostMenuOpen(false)
      setPostMoreMenuOpen(false)
    }

    if (postMenuOpen || postMoreMenuOpen) {
      document.addEventListener('click', handleClickOutsidePostMenu, true)
      const scrollElement = contentScrollRef.current
      if (scrollElement) {
        scrollElement.addEventListener('scroll', handleScroll)
      }
      return () => {
        document.removeEventListener('click', handleClickOutsidePostMenu, true)
        if (scrollElement) {
          scrollElement.removeEventListener('scroll', handleScroll)
        }
      }
    }
  }, [postMenuOpen, postMoreMenuOpen])

  useEffect(() => {
    const handlePointerDown = (e) => {
      if (openMenuId === null) return

      const activeMenuNode = menuRefs.current[openMenuId]
      if (activeMenuNode && !activeMenuNode.contains(e.target)) {
        setOpenMenuId(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [openMenuId])

  useEffect(() => {
    const handleScroll = () => {
      setOpenMenuId(null)
    }

    const scrollElement = contentScrollRef.current
    if (scrollElement && openMenuId !== null) {
      scrollElement.addEventListener('scroll', handleScroll)
      return () => {
        scrollElement.removeEventListener('scroll', handleScroll)
      }
    }
  }, [openMenuId])

  useLayoutEffect(() => {
    if (!loadingComments && !didInitialScroll && !disableAutoScroll) {
      requestAnimationFrame(() => {
        scrollToComments('auto', false)
        setDidInitialScroll(true)
      })
    }
  }, [loadingComments, didInitialScroll, disableAutoScroll])

  const fetchComments = async () => {
    try {
      setLoadingComments(true)

      const token = getToken()
      const user = getCurrentUser()

      const res = await fetch(
        `http://localhost:8000/api/social/posts/${podcast.id}/comments/?user_id=${user?.id || ''}`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      )

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || `HTTP ${res.status}`)
      }

      const nextComments = data.data?.comments || []
      const nextCount = Number(data.data?.comment_count || 0)

      setComments(nextComments)
      setCommentCount(nextCount)
      onCommentCountChange?.(nextCount)
    } catch (err) {
      console.error('Fetch comments failed:', err)
    } finally {
      setLoadingComments(false)
    }
  }

  const scrollToComments = (behavior = 'smooth', shouldFocus = true) => {
    const container = contentScrollRef.current
    const commentsSection = commentListRef.current
    const topBar = document.querySelector(`.${styles.topBar}`)

    if (!container || !commentsSection) return

    const topBarHeight = topBar?.offsetHeight || 66
    const extraOffset = 12
    const top = Math.max(commentsSection.offsetTop - topBarHeight - extraOffset, 0)

    container.scrollTo({
      top,
      behavior,
    })

    if (shouldFocus) {
      setTimeout(() => {
        commentInputRef.current?.focus()
      }, behavior === 'smooth' ? 220 : 80)
    }
  }

  const getFullAudioUrl = (url) => {
    if (!url) return ''

    if (url.startsWith('http')) return url

    if (url.startsWith('/')) {
      return `http://127.0.0.1:8000${url}`
    }

    return `http://127.0.0.1:8000/${url}`
  }

  const handlePlayClick = async () => {
    let finalAudioUrl = getFullAudioUrl(
      podcast.audioUrl ||
      podcast.audio_url ||
      podcast.audio?.audio_url ||
      podcast.audio?.audioUrl
    )

    let finalDuration = Number(
      podcast.durationSeconds ||
      podcast.duration_seconds ||
      podcast.audio?.duration_seconds ||
      podcast.audio?.durationSeconds ||
      0
    )

    // Search không có audio_url thì lấy lại từ FEED, vì Feed đang phát được
    if (!finalAudioUrl) {
      try {
        const token = getToken()

        const res = await fetch(
          `http://127.0.0.1:8000/api/content/feed/?limit=100&tab=for_you`,
          {
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        )

        const data = await res.json()
        const items = data.items || []

        const found = items.find(
          item => String(item.id) === String(podcast.id)
        )

        finalAudioUrl = getFullAudioUrl(
          found?.audio?.audio_url ||
          found?.audio_url ||
          ''
        )

        finalDuration = Number(
          found?.audio?.duration_seconds ||
          found?.duration_seconds ||
          finalDuration ||
          0
        )
      } catch (err) {
        console.error('Fetch audio from feed failed:', err)
      }
    }

    console.log('PLAY FROM COMMENT MODAL:', {
      id: podcast.id,
      finalAudioUrl,
      finalDuration,
    })

    if (!finalAudioUrl) {
      alert('Bài này chưa có file audio')
      return
    }

    if (String(currentTrack?.id) === String(podcast.id)) {
      togglePlay()
      return
    }

    playTrack({
      id: podcast.id,
      postId: podcast.id,
      title: podcast.title,
      author: podcast.author || podcast.authorUsername || 'Unknown',
      audioUrl: finalAudioUrl,
      audio_url: finalAudioUrl,
      durationSeconds: finalDuration,
      duration_seconds: finalDuration,
      cover: podcast.cover || podcast.thumbnail_url || podcast.thumbnailUrl || '',
      thumbnail_url: podcast.cover || podcast.thumbnail_url || podcast.thumbnailUrl || '',
      liked,
      saved,
    })
  }

  const handleProgressBarClick = (e) => {
    if (!durationSeconds || durationSeconds === 0) return
    
    const barRect = progressBarRef.current?.getBoundingClientRect()
    if (!barRect) return
    
    const clickX = e.clientX - barRect.left
    const percentage = Math.max(0, Math.min(100, (clickX / barRect.width) * 100))
    
    if (currentTrack?.id === podcast.id) {
      seekToPercent(percentage)
    } else {
      playTrack({
        id: podcast.id,
        postId: podcast.id,
        title: podcast.title,
        author: podcast.author || podcast.authorUsername || 'Unknown',
        audioUrl: getFullAudioUrl(audioUrl),
        audio_url: getFullAudioUrl(audioUrl),
        durationSeconds: Number(durationSeconds || 0),
        duration_seconds: Number(durationSeconds || 0),
        cover: podcast.cover || podcast.thumbnail_url || podcast.thumbnailUrl || '',
        thumbnail_url: podcast.cover || podcast.thumbnail_url || podcast.thumbnailUrl || '',
        liked,
        saved,
      })
      setTimeout(() => seekToPercent(percentage), 100)
    }
  }

  const isCurrentTrack = currentTrack?.id === podcast.id
  const isCurrentPlaying = isCurrentTrack && playing
  const savedProgress = trackProgressMap?.[podcast.id]
  
  const audioUrl = podcast.audio_url || podcast.audio?.audio_url || podcast.audioUrl || podcast.audio?.audioUrl
  const durationSeconds = podcast.duration_seconds || podcast.audio?.duration_seconds || podcast.durationSeconds || podcast.audio?.durationSeconds
  const displayDuration = durationSeconds || 0
  
  const displayTime = currentTrack?.id === podcast.id ? currentTime : (savedProgress?.currentTime || 0)
  const displayProgress = currentTrack?.id === podcast.id 
    ? (displayDuration ? (currentTime / displayDuration) * 100 : 0)
    : (savedProgress?.progressPercent || 0)

  const isOwnComment = (comment) => {
    if (!currentUser) return false
    return (
      String(comment.user_id) === String(currentUser.id) ||
      String(comment.username) === String(currentUser.username)
    )
  }

  const getDisplayName = (comment) => comment?.username || comment?.user_id || 'Người dùng'

  const formatCommentTime = (comment) => {
    if (comment.time_ago && typeof comment.time_ago === 'string') {
      return comment.time_ago
    }

    const raw = comment.created_at
    if (!raw) return 'Vừa xong'

    const created = new Date(raw)
    if (Number.isNaN(created.getTime())) return 'Vừa xong'

    const diffMs = Date.now() - created.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)

    if (diffMinutes < 1) return 'Vừa xong'
    if (diffMinutes < 60) return `${diffMinutes} phút trước`

    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours} giờ trước`

    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays} ngày trước`

    const diffWeeks = Math.floor(diffDays / 7)
    if (diffWeeks < 5) return `${diffWeeks} tuần trước`

    const diffMonths = Math.floor(diffDays / 30)
    if (diffMonths < 12) return `${diffMonths} tháng trước`

    const diffYears = Math.floor(diffDays / 365)
    return `${diffYears} năm trước`
  }

  const updateCommentTree = (items, targetId, updater) =>
    items.map((item) => {
      if (item.id === targetId) return updater(item)

      if (Array.isArray(item.replies) && item.replies.length > 0) {
        return {
          ...item,
          replies: updateCommentTree(item.replies, targetId, updater),
        }
      }

      return item
    })

  const insertReplyIntoTree = (items, parentId, newReply) =>
    items.map((item) => {
      if (item.id === parentId) {
        return {
          ...item,
          replies: [newReply, ...(item.replies || [])],
        }
      }

      if (Array.isArray(item.replies) && item.replies.length > 0) {
        return {
          ...item,
          replies: insertReplyIntoTree(item.replies, parentId, newReply),
        }
      }

      return item
    })

  const openReplyBox = (comment) => {
    setReplyingTarget(comment)
    setReplyInput('')
    setTimeout(() => {
      replyInputRef.current?.focus()
    }, 0)
  }

  const closeReplyBox = () => {
    setReplyingTarget(null)
    setReplyInput('')
  }

  const handleSubmitComment = async (e) => {
    e.preventDefault()

    if (!commentInput.trim() || submitting) return

    try {
      setSubmitting(true)

      const token = getToken()
      const user = getCurrentUser()

      const res = await fetch(
        `http://localhost:8000/api/social/posts/${podcast.id}/comments/create/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            user_id: user?.id,
            content: commentInput.trim(),
          }),
        }
      )

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || `HTTP ${res.status}`)
      }

      const newComment = data.data?.comment
      const nextCount = Number(data.data?.comment_count || 0)

      if (newComment) {
        setComments((prev) => [newComment, ...prev])
      }

      setCommentCount(nextCount)
      onCommentCountChange?.(nextCount)
      setCommentInput('')

      setTimeout(() => {
        scrollToComments()
      }, 60)
    } catch (err) {
      console.error('Create comment failed:', err)
      toast.error(err.message || 'Gửi bình luận thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleCommentLike = async (commentId) => {
    try {
      const token = getToken()
      const user = getCurrentUser()

      const res = await fetch(
        `http://localhost:8000/api/social/comments/${commentId}/toggle-like/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            user_id: user?.id,
          }),
        }
      )

      const rawText = await res.text()
      let data = null

      try {
        data = JSON.parse(rawText)
      } catch {
        console.error('Toggle comment like returned non-JSON:', rawText)
        throw new Error(`Backend không trả JSON. Status: ${res.status}`)
      }

      if (!res.ok || !data.success) {
        throw new Error(data.message || `HTTP ${res.status}`)
      }

      setComments((prev) =>
        updateCommentTree(prev, commentId, (item) => ({
          ...item,
          is_liked: data.data.liked,
          like_count: data.data.like_count,
        }))
      )
    } catch (err) {
      console.error('Toggle comment like failed:', err)
      toast.error(err.message || 'Không thể thích bình luận')
    }
  }

  const handleSubmitReply = async (e, targetComment) => {
    e.preventDefault()

    if (!replyInput.trim() || replySubmitting) return

    try {
      setReplySubmitting(true)

      const token = getToken()
      const user = getCurrentUser()

      const res = await fetch(
        `http://localhost:8000/api/social/comments/${targetComment.id}/reply/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            user_id: user?.id,
            content: replyInput.trim(),
          }),
        }
      )

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || `HTTP ${res.status}`)
      }

      const newReply = data.data?.comment
      const nextCount = Number(data.data?.comment_count || 0)

      if (newReply) {
        const parentId = newReply.parent_comment_id
        setComments((prev) => insertReplyIntoTree(prev, parentId, newReply))
      }

      setCommentCount(nextCount)
      onCommentCountChange?.(nextCount)
      closeReplyBox()
    } catch (err) {
      console.error('Reply comment failed:', err)
      toast.error(err.message || 'Gửi phản hồi thất bại')
    } finally {
      setReplySubmitting(false)
    }
  }

  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingInput, setEditingInput] = useState('')
  const [editingSubmitting, setEditingSubmitting] = useState(false)

  const removeCommentFromTree = (items, targetId) =>
    items
      .filter((item) => item.id !== targetId)
      .map((item) => ({
        ...item,
        replies: Array.isArray(item.replies)
          ? removeCommentFromTree(item.replies, targetId)
          : [],
      }))

  const openEditComment = (comment) => {
    if (!isOwnComment(comment)) return
    setOpenMenuId(null)
    setReplyingTarget(null)
    setEditingCommentId(comment.id)
    setEditingInput(comment.content || '')
  }

  const cancelEditComment = () => {
    setEditingCommentId(null)
    setEditingInput('')
  }

  const handleUpdateComment = async (commentId) => {
    if (!editingInput.trim() || editingSubmitting) return

    try {
      setEditingSubmitting(true)

      const token = getToken()
      const user = getCurrentUser()

      const res = await fetch(
        `http://localhost:8000/api/social/comments/${commentId}/update/`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            user_id: user?.id,
            content: editingInput.trim(),
          }),
        }
      )

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || `HTTP ${res.status}`)
      }

      const updatedComment = data.data?.comment

      setComments((prev) =>
        updateCommentTree(prev, commentId, (item) => ({
          ...item,
          ...(updatedComment || {}),
          content: updatedComment?.content ?? editingInput.trim(),
          updated_at: updatedComment?.updated_at ?? item.updated_at,
        }))
      )

      cancelEditComment()
    } catch (err) {
      console.error('Update comment failed:', err)
      toast.error(err.message || 'Sửa bình luận thất bại')
    } finally {
      setEditingSubmitting(false)
    }
  }

  const handleDeleteComment = (comment) => {
    setCommentToDelete(comment)
    setDeleteModalOpen(true)
    setOpenMenuId(null)
  }

  const confirmDeleteComment = async () => {
    if (!commentToDelete) return

    try {
      const token = getToken()
      const user = getCurrentUser()

      const res = await fetch(
        `http://localhost:8000/api/social/comments/${commentToDelete.id}/delete/`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            user_id: user?.id,
          }),
        }
      )

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || `HTTP ${res.status}`)
      }

      const nextCount = Number(data.data?.comment_count ?? Math.max(commentCount - 1, 0))

      setComments((prev) => removeCommentFromTree(prev, commentToDelete.id))
      setCommentCount(nextCount)
      onCommentCountChange?.(nextCount)

      if (editingCommentId === commentToDelete.id) {
        cancelEditComment()
      }

      if (replyingTarget?.id === commentToDelete.id) {
        closeReplyBox()
      }

      setDeleteModalOpen(false)
      setCommentToDelete(null)
    } catch (err) {
      console.error('Delete comment failed:', err)
      toast.error(err.message || 'Xóa bình luận thất bại')
    }
  }

  const handleEditPost = () => {
    setPostMenuOpen(false)

    const mainElement = document.querySelector('main')

    sessionStorage.setItem('returnToAfterEdit', location.pathname + location.search)
    sessionStorage.setItem('feedScrollPosition', String(mainElement?.scrollTop || 0))
    sessionStorage.setItem('feedFocusPostId', String(podcast.id))
    sessionStorage.setItem('openPostDetailId', String(podcast.id))
    sessionStorage.setItem('openPostDetailNoScroll', 'true')
    sessionStorage.setItem('returnFromEdit', 'true')

    navigate(`/edit/${podcast.id}`)
  }

  const handleDeletePost = () => {
    setDeletePostModalOpen(true)
    setPostMenuOpen(false)
    const mainElement = document.querySelector('main')
    if (mainElement) {
      const scrollPos = mainElement.scrollTop
      sessionStorage.setItem('feedScrollPosition', scrollPos)
    }
  }

  const confirmDeletePost = async () => {
    try {
      console.log('🗑️ confirmDeletePost called!')
      console.log('Before setIsDeleting - isDeleting state:', isDeleting)
      setIsDeleting(true)
      console.log('After setIsDeleting(true)')
      setDeleteProgress(10)
      console.log('After setDeleteProgress(10)')
      
      const token = getToken()
      const deleteUrl = `http://localhost:8000/api/content/drafts/${podcast.id}/delete/`
      console.log('🗑️ Deleting post:', podcast.id, 'URL:', deleteUrl)

      const progressInterval = setInterval(() => {
        setDeleteProgress(prev => Math.min(prev + Math.random() * 30, 90))
      }, 300)

      const res = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      clearInterval(progressInterval)
      setDeleteProgress(95)

      console.log('API Response status:', res.status)
      const responseText = await res.text()
      console.log('API Response:', responseText)

      if (!res.ok) {
        throw new Error(`Delete failed: ${res.status} ${responseText}`)
      }

      setDeleteProgress(100)
      setTimeout(() => {
        setIsDeleting(false)
        setDeleteProgress(0)
        setDeletePostModalOpen(false)
        console.log('🗑️ deletePost called with id:', podcast.id, 'type:', typeof podcast.id)
        deletePost(podcast.id)
        removeSavedPost(podcast.id)
        // XÓA POST TRƯỚC
        onPostDeleted?.(podcast.id)

        // SAU ĐÓ MỚI ĐÓNG MODAL
        onClose()
      }, 800)
    } catch (err) {
      console.error('❌ Delete error:', err)
      setDeleteProgress(0)
      setIsDeleting(false)
      toast.error(err.message || 'Xóa bài viết thất bại')
      sessionStorage.removeItem('feedScrollPosition')
    }
  }

  const handleHide = () => {
    setPostMoreMenuOpen(false)
    setHidePostModalOpen(true)
  }

  const confirmHidePost = async () => {
    try {
      const token = getToken()
      const user = getCurrentUser()

      const res = await fetch(`http://localhost:8000/api/social/posts/${podcast.id}/hide/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          user_id: user?.id,
        }),
      })

      if (!res.ok) {
        throw new Error('Ẩn bài viết thất bại')
      }

      hidePost(podcast.id)
      removeSavedPost(podcast.id)
      setHidePostModalOpen(false)
      onPostDeleted?.(podcast.id)
      onClose()
    } catch (err) {
      console.error('Hide post error:', err)
      toast.error(err.message || 'Ẩn bài viết thất bại')
    }
  }

  const handleCollectionModalSave = async (collectionId) => {
    // SaveCollectionModal đã make API call, chỉ cần update local state
    setShowCollectionModal(false)
  }

  const handleReport = () => {
    setPostMoreMenuOpen(false)
    toast.info('Tính năng báo cáo bài viết sắp có')
  }

  const [statsHoverType, setStatsHoverType] = useState(null) 
  const [statsPopupData, setStatsPopupData] = useState({
    likes: [],
    comments: [],
    shares: [],
  })
  const [statsPopupLoading, setStatsPopupLoading] = useState(false)
  const hoverTimerRef = useRef(null)

  const fetchStatsPopupData = async (type) => {
    try {
      setStatsPopupLoading(true)

      const token = getToken()
      let endpoint = ''

      if (type === 'likes') {
        endpoint = `http://localhost:8000/api/social/posts/${podcast.id}/likers/`
      } else if (type === 'comments') {
        endpoint = `http://localhost:8000/api/social/posts/${podcast.id}/commenters/`
      } else if (type === 'shares') {
        endpoint = `http://localhost:8000/api/social/posts/${podcast.id}/sharers/`
      } else {
        return
      }

      const res = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

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
        setStatsPopupData((prev) => ({
          ...prev,
          shares: data.data?.sharers || [],
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

  const getUniqueUsersById = (items = []) => {
    const map = new Map()

    items.forEach((item) => {
      const key = item.user_id || item.username
      if (!key || map.has(key)) return
      map.set(key, item)
    })

    return Array.from(map.values())
  }

  const [hiddenCommentIds, setHiddenCommentIds] = useState([])

  const hideCommentLocally = (commentId) => {
    setHiddenCommentIds((prev) =>
      prev.includes(commentId) ? prev : [...prev, commentId]
    )
    setOpenMenuId(null)
  }

  // Wrapper for onClose to restore scroll position before closing
  const handleClose = () => {
    const main = document.querySelector('main')
    if (main) {
      main.scrollTop = scrollPositionRef.current
      console.log('🔄 [CommentModal] Restoring scroll on close:', scrollPositionRef.current)
    }
    onClose?.()
  }

  const coverImage = podcast.cover || podcast.thumbnail_url || podcast.thumbnailUrl
  const isOwnerPost =
  podcast?.isOwner === true ||
  String(currentUser?.id) === String(podcast.authorId) ||
  String(currentUser?.id) === String(podcast.author_id) ||
  String(currentUser?.id) === String(podcast.userId) ||
  String(currentUser?.id) === String(podcast.user_id) ||
  String(currentUser?.username) === String(podcast.authorUsername)

  return [
      createPortal(
        <div className={styles.overlay} onClick={handleClose}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.topBar}>
          <h2 className={styles.modalTitle}>Bài viết của {podcast.author}</h2>
          <div className={styles.topBarRight}>
            <button className={styles.closeBtn} type="button" onClick={handleClose}>
              <X size={22} />
            </button>
          </div>
        </div>

        <div ref={contentScrollRef} className={styles.contentScroll}>
          <div className={styles.postHeader}>
            <div className={styles.authorBlock}>
              <div className={styles.avatar}>
                {getInitials({ username: podcast.authorUsername, display_name: podcast.author })}
              </div>
              <div>
                <div className={styles.author}>{podcast.author}</div>
                <div className={styles.meta}>
                  {podcast.timeAgo || formatTimeAgo(podcast.created_at)}
                </div>
              </div>
            </div>

            {isOwnerPost && (
            <div className={styles.postMenuWrap} ref={postMenuRef}>
              <button 
                className={styles.moreBtn} 
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setPostMenuOpen(!postMenuOpen)
                }}
              >
                <MoreHorizontal size={20} />
              </button>
              
              {postMenuOpen && (
                <div className={styles.postDropdown}>
                  <button
                    type="button"
                    className={styles.postDropdownItem}
                    onClick={handleEditPost}
                  >
                    <Edit size={16} />
                    <span>Chỉnh sửa</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.postDropdownItem} ${styles.postDropdownItemDanger}`}
                    onClick={handleDeletePost}
                  >
                    <Trash2 size={16} />
                    <span>Xóa</span>
                  </button>
                </div>
              )}
            </div>
            )}

            {!isOwnerPost && (
            <div className={styles.postMenuWrap} ref={postMoreMenuRef}>
              <button 
                className={styles.moreBtn} 
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setPostMoreMenuOpen(!postMoreMenuOpen)
                }}
              >
                <MoreHorizontal size={20} />
              </button>
              
              {postMoreMenuOpen && (
                <div className={styles.postDropdown}>
                  <button
                    type="button"
                    className={styles.postDropdownItem}
                    onClick={handleHide}
                  >
                    <EyeOff size={16} />
                    <span>Ẩn bài viết</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.postDropdownItem} ${styles.postDropdownItemDanger}`}
                    onClick={handleReport}
                  >
                    <Flag size={16} />
                    <span>Báo cáo</span>
                  </button>
                </div>
              )}
            </div>
            )}
          </div>

          <div className={styles.postBody}>
            <h3 className={styles.title}>{podcast.title}</h3>
            <p className={styles.description}>{podcast.description}</p>

            {coverImage ? (
              <div className={styles.mediaWrap}>
                {(durationSeconds || audioUrl) && (
                  <>
                    {!isCurrentTrack && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handlePlayClick()
                        }}
                        className={styles.centerPlayBtn}
                      >
                        <Play size={34} />
                      </button>
                    )}

                    {isCurrentTrack && (
                      <div className={styles.youtubeControls}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handlePlayClick()
                          }}
                          className={styles.youtubePlayBtn}
                        >
                          {isCurrentPlaying ? <Pause size={18} /> : <Play size={18} />}
                        </button>

                        <span className={styles.youtubeTime}>
                          {String(Math.floor(displayTime / 60)).padStart(2, '0')}:
                          {String(Math.floor(displayTime) % 60).padStart(2, '0')}
                        </span>

                        <div ref={progressBarRef} onClick={handleProgressBarClick} className={styles.youtubeProgressBar}>
                          <div
                            className={styles.youtubeProgressFill}
                            style={{
                              width: `${displayProgress}%`,
                              transition: isSeeking ? 'none' : 'width 0.1s linear',
                            }}
                          />
                        </div>

                        <span className={styles.youtubeTime}>
                          {String(Math.floor(displayDuration / 60)).padStart(2, '0')}:
                          {String(Math.floor(displayDuration) % 60).padStart(2, '0')}
                        </span>
                      </div>
                    )}
                  </>
                )}

                <img src={coverImage} alt={podcast.title} className={styles.cover} />
              </div>
            ) : (
              (durationSeconds || audioUrl) && (
                <div className={styles.audioOnlyPlayer}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handlePlayClick()
                    }}
                    className={styles.audioOnlyPlayBtn}
                  >
                    {isCurrentPlaying ? <Pause size={18} /> : <Play size={18} />}
                  </button>

                  <span className={styles.audioOnlyTime}>
                    {String(Math.floor(displayTime / 60)).padStart(2, '0')}:
                    {String(Math.floor(displayTime) % 60).padStart(2, '0')}
                  </span>

                  <div ref={progressBarRef} onClick={handleProgressBarClick} className={styles.audioOnlyProgress}>
                    <div
                      className={styles.audioOnlyProgressFill}
                      style={{
                        width: `${displayProgress}%`,
                        transition: isSeeking ? 'none' : 'width 0.1s linear',
                      }}
                    />
                  </div>

                  <span className={styles.audioOnlyTime}>
                    {String(Math.floor(displayDuration / 60)).padStart(2, '0')}:
                    {String(Math.floor(displayDuration) % 60).padStart(2, '0')}
                  </span>
                </div>
              )
            )}
          </div>

          <div className={styles.statsRow}>
            <div className={styles.leftStats}>
              <div
                className={styles.statHoverWrap}
              >
                <button type="button" className={styles.statItemButton}>
                  <Heart size={14} />
                  <span
                    onMouseEnter={() => handleStatsMouseEnter('likes')}
                    onMouseLeave={handleStatsMouseLeave}
                    className={styles.statsText}
                  >
                    {likeCount ?? 0}
                  </span>
                </button>

                {statsHoverType === 'likes' && (
                  <div
                    className={styles.statsPopup}
                    onMouseEnter={() => handleStatsMouseEnter('likes')}
                    onMouseLeave={handleStatsMouseLeave}
                  >

                    {statsPopupLoading ? (
                      <div className={styles.statsPopupEmpty}>Đang tải...</div>
                    ) : statsPopupData.likes.length > 0 ? (
                      statsPopupData.likes.map((user) => (
                        <div key={user.user_id} className={styles.statsPopupItem}>
                          <span className={styles.statsPopupName}>
                            {user.username || user.user_id}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className={styles.statsPopupEmpty}>Chưa có lượt thích</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.rightStats}>
              <div
                className={styles.statHoverWrap}
              >
                <button type="button" className={styles.statTextButton}>
                  <span
                    onMouseEnter={() => handleStatsMouseEnter('comments')}
                    onMouseLeave={handleStatsMouseLeave}
                    className={styles.statsText}
                  >
                    {commentCount} bình luận
                  </span>
                </button>

                {statsHoverType === 'comments' && (
                  <div
                    className={`${styles.statsPopup} ${styles.statsPopupRight}`}
                    onMouseEnter={() => handleStatsMouseEnter('comments')}
                    onMouseLeave={handleStatsMouseLeave}
                  >

                    {statsPopupLoading ? (
                      <div className={styles.statsPopupEmpty}>Đang tải...</div>
                    ) : statsPopupData.comments.length > 0 ? (
                      statsPopupData.comments.map((user) => (
                        <div key={user.user_id} className={styles.statsPopupItem}>
                          <div className={styles.statsPopupName}>
                            {user.username || user.user_id}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className={styles.statsPopupEmpty}>Chưa có bình luận</div>
                    )}
                  </div>
                )}
              </div>

              <div
                className={styles.statHoverWrap}
              >
                <button type="button" className={styles.statTextButton}>
                  <span
                    onMouseEnter={() => handleStatsMouseEnter('shares')}
                    onMouseLeave={handleStatsMouseLeave}
                    className={styles.statsText}
                  >
                    {shareCount ?? 0} lượt chia sẻ
                  </span>
                </button>

                {statsHoverType === 'shares' && (
                  <div
                    className={`${styles.statsPopup} ${styles.statsPopupRight}`}
                    onMouseEnter={() => handleStatsMouseEnter('shares')}
                    onMouseLeave={handleStatsMouseLeave}
                  >

                    {statsPopupLoading ? (
                      <div className={styles.statsPopupEmpty}>Đang tải...</div>
                    ) : getUniqueUsersById(statsPopupData.shares).length > 0 ? (
                      getUniqueUsersById(statsPopupData.shares).map((user) => (
                        <div key={user.user_id || user.username} className={styles.statsPopupItem}>
                          <div className={styles.statsPopupName}>
                            {user.username || user.user_id}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className={styles.statsPopupEmpty}>Chưa có lượt chia sẻ</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={styles.actionRow}>
            <button
              type="button"
              className={`${styles.actionBtn} ${liked ? styles.activeLike : ''}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onToggleLike?.(e)
              }}
            >
              <Heart size={17} fill={liked ? 'currentColor' : 'none'} />
              <span>Thích</span>
            </button>

            <button type="button" className={styles.actionBtn} onClick={scrollToComments}>
              <MessageCircle size={17} />
              <span>Bình luận</span>
            </button>

            <button type="button" className={styles.actionBtn} onClick={() => setShowShareModal(true)}>
              <Share2 size={17} />
              <span>Chia sẻ</span>
            </button>

            <button
              ref={saveButtonRef}
              type="button"
              className={`${styles.actionBtn} ${saved ? styles.activeSave : ''}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (saved) {
                  // Nếu đã save -> unsave trực tiếp
                  onToggleSave(e)
                } else {
                  // Nếu chưa save -> show collection picker
                  setShowCollectionModal(true)
                }
              }}
            >
              <Bookmark size={17} fill={saved ? 'currentColor' : 'none'} />
              <span>Lưu</span>
            </button>
          </div>

          <div className={styles.commentSection}>
            <div ref={commentListRef} className={styles.commentList}>
              {loadingComments ? (
                <p className={styles.empty}>Đang tải bình luận...</p>
              ) : comments.length === 0 ? (
                <p className={styles.empty}>Chưa có bình luận nào.</p>
              ) : (
                comments
                  .filter((comment) => !hiddenCommentIds.includes(comment.id))
                  .map((comment) => (
                    <CommentNode
                      key={comment.id}
                      item={comment}
                      level={0}
                      currentUser={currentUser}
                      podcast={podcast}
                      openMenuId={openMenuId}
                      setOpenMenuId={setOpenMenuId}
                      menuRefs={menuRefs}
                      isOwnComment={isOwnComment}
                      formatCommentTime={formatCommentTime}
                      handleToggleCommentLike={handleToggleCommentLike}
                      openReplyBox={openReplyBox}
                      closeReplyBox={closeReplyBox}
                      replyingTarget={replyingTarget}
                      replyInput={replyInput}
                      setReplyInput={setReplyInput}
                      replyInputRef={replyInputRef}
                      replySubmitting={replySubmitting}
                      handleSubmitReply={handleSubmitReply}
                      getDisplayName={getDisplayName}
                      editingCommentId={editingCommentId}
                      editingInput={editingInput}
                      setEditingInput={setEditingInput}
                      editingSubmitting={editingSubmitting}
                      openEditComment={openEditComment}
                      cancelEditComment={cancelEditComment}
                      handleUpdateComment={handleUpdateComment}
                      handleDeleteComment={handleDeleteComment}
                      hiddenCommentIds={hiddenCommentIds}
                      hideCommentLocally={hideCommentLocally}
                    />
                  )
                )
              )}
            </div>
          </div>
        </div>

        <form className={styles.commentComposer} onSubmit={handleSubmitComment}>
          <div className={styles.composerAvatar}>{getInitials(currentUser?.username || currentUser?.display_name)}</div>

          <div className={styles.inputWrap}>
            <input
              ref={commentInputRef}
              id={`comment-input-${podcast.id}`}
              type="text"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Viết bình luận..."
              className={styles.commentInput}
            />
            <button
              type="submit"
              className={styles.sendBtn}
              disabled={submitting || !commentInput.trim()}
            >
              Gửi
            </button>
          </div>
        </form>
      </div>
    </div>,
        document.body
      ),
      createPortal(
        <ConfirmModal
          isOpen={deleteModalOpen}
          title="Xóa bình luận"
          message="Bạn có chắc muốn xóa bình luận này không?
Hành động này không thể hoàn tác."
          confirmText="Xóa"
          cancelText="Hủy"
          isDangerous={true}
          onConfirm={confirmDeleteComment}
          onCancel={() => {
            setDeleteModalOpen(false)
            setCommentToDelete(null)
          }}
        />,
        document.body
      ),
      createPortal(
        <ConfirmModal
          isOpen={deletePostModalOpen}
          title="Xóa bài viết"
          message="Bạn chắc chắn muốn xóa bài viết này?
Hành động này không thể hoàn tác."
          confirmText="Xóa"
          cancelText="Hủy"
          isDangerous={true}
          isLoading={isDeleting}
          progress={deleteProgress}
          onConfirm={confirmDeletePost}
          onCancel={() => {
            setDeletePostModalOpen(false);
            setCommentToDelete(null);
          }}
        />,
        document.body
      ),
      showShareModal ? createPortal(
        <ShareModal
          podcast={podcast}
          onClose={() => setShowShareModal(false)}
          onShareSuccess={(data) => {}}
        />,
        document.body
      ) : null,

      createPortal(
        <ConfirmModal
          isOpen={hidePostModalOpen}
          title="Ẩn bài viết"
          message="Bạn có muốn ẩn bài viết này không?"
          confirmText="Ẩn"
          cancelText="Hủy"
          onConfirm={confirmHidePost}
          onCancel={() => setHidePostModalOpen(false)}
        />,
        document.body
      ),

      createPortal(
        <SaveCollectionModal
          isOpen={showCollectionModal}
          onClose={() => setShowCollectionModal(false)}
          postId={podcast.id}
          onSave={handleCollectionModalSave}
          triggerRef={saveButtonRef}
          isPopup={true}
        />,
        document.body
      ),
    ].filter(Boolean)
}