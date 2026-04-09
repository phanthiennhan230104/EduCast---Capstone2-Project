import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { X, MoreHorizontal, Heart, MessageCircle, Share2, Bookmark } from 'lucide-react'
import styles from '../../style/feed/CommentModal.module.css'
import { getToken, getCurrentUser } from '../../utils/auth'
import { getInitials } from '../../utils/getInitials'
import { createPortal } from 'react-dom'

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
      style={level > 1 ? { marginLeft: `${(level - 1) * 24}px` } : undefined}
    >
      <div className={avatarClass}>{getInitials(item.username)}</div>

      <div className={mainClass}>
        <div className={styles.commentRow}>
          <div className={styles.commentBubbleWrap}>
            <div className={bubbleClass}>
              <div className={authorClass}>
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
                        disabled={editingSubmitting || !editingInput.trim()}
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
            onSubmit={(e) => handleSubmitReply(e, replyingTarget)}
          >
            <div className={avatarClass}>{getInitials(replyingTarget?.username)}</div>

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

        {Array.isArray(item.replies) && item.replies.length > 0 && (
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
}) {
  const [comments, setComments] = useState([])
  const [commentInput, setCommentInput] = useState('')
  const [loadingComments, setLoadingComments] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [commentCount, setCommentCount] = useState(initialCommentCount ?? podcast.comments ?? 0)

  const [openMenuId, setOpenMenuId] = useState(null)
  const [replyingTarget, setReplyingTarget] = useState(null)
  const [replyInput, setReplyInput] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)

  const contentScrollRef = useRef(null)
  const commentListRef = useRef(null)
  const commentInputRef = useRef(null)
  const replyInputRef = useRef(null)
  const menuRefs = useRef({})
  const [didInitialScroll, setDidInitialScroll] = useState(false)

  const currentUser = getCurrentUser()

  useEffect(() => {
    fetchComments()
  }, [])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
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

  useLayoutEffect(() => {
    if (!loadingComments && !didInitialScroll) {
      requestAnimationFrame(() => {
        scrollToComments('auto', false)
        setDidInitialScroll(true)
      })
    }
  }, [loadingComments, didInitialScroll])

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
          replies: [...(item.replies || []), newReply],
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
      alert(err.message || 'Gửi bình luận thất bại')
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
      alert(err.message || 'Không thể thích bình luận')
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
        setComments((prev) => insertReplyIntoTree(prev, targetComment.id, newReply))
      }

      setCommentCount(nextCount)
      onCommentCountChange?.(nextCount)
      closeReplyBox()
    } catch (err) {
      console.error('Reply comment failed:', err)
      alert(err.message || 'Gửi phản hồi thất bại')
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
      alert(err.message || 'Sửa bình luận thất bại')
    } finally {
      setEditingSubmitting(false)
    }
  }

  const handleDeleteComment = async (comment) => {
    const confirmed = window.confirm('Bạn có chắc muốn xóa bình luận này không?')
    if (!confirmed) return

    try {
      const token = getToken()
      const user = getCurrentUser()

      const res = await fetch(
        `http://localhost:8000/api/social/comments/${comment.id}/delete/`,
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

      setComments((prev) => removeCommentFromTree(prev, comment.id))
      setCommentCount(nextCount)
      onCommentCountChange?.(nextCount)

      if (editingCommentId === comment.id) {
        cancelEditComment()
      }

      if (replyingTarget?.id === comment.id) {
        closeReplyBox()
      }

      setOpenMenuId(null)
    } catch (err) {
      console.error('Delete comment failed:', err)
      alert(err.message || 'Xóa bình luận thất bại')
    }
  }

  const [statsHoverType, setStatsHoverType] = useState(null) // 'likes' | 'comments' | 'shares' | null
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

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.topBar}>
          <h2 className={styles.modalTitle}>Bài viết của {podcast.author}</h2>
          <button className={styles.closeBtn} type="button" onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        <div ref={contentScrollRef} className={styles.contentScroll}>
          <div className={styles.postHeader}>
            <div className={styles.authorBlock}>
              <div className={styles.avatar}>
                {getInitials({ username: podcast.authorUsername, display_name: podcast.author })}
              </div>
              <div>
                <div className={styles.author}>{podcast.author}</div>
                <div className={styles.meta}>{podcast.timeAgo}</div>
              </div>
            </div>

            <button className={styles.moreBtn} type="button">
              <MoreHorizontal size={20} />
            </button>
          </div>

          <div className={styles.postBody}>
            <h3 className={styles.title}>{podcast.title}</h3>
            <p className={styles.description}>{podcast.description}</p>

            {podcast.cover && (
              <img src={podcast.cover} alt={podcast.title} className={styles.cover} />
            )}
          </div>

          <div className={styles.statsRow}>
            <div className={styles.leftStats}>
              <div
                className={styles.statHoverWrap}
                onMouseEnter={() => handleStatsMouseEnter('likes')}
                onMouseLeave={handleStatsMouseLeave}
              >
                <button type="button" className={styles.statItemButton}>
                  <Heart size={14} />
                  <span>{likeCount ?? 0}</span>
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
                onMouseEnter={() => handleStatsMouseEnter('comments')}
                onMouseLeave={handleStatsMouseLeave}
              >
                <button type="button" className={styles.statTextButton}>
                  {commentCount} bình luận
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
                onMouseEnter={() => handleStatsMouseEnter('shares')}
                onMouseLeave={handleStatsMouseLeave}
              >
                <button type="button" className={styles.statTextButton}>
                  {shareCount ?? 0} lượt chia sẻ
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
              onClick={onToggleLike}
            >
              <Heart size={17} fill={liked ? 'currentColor' : 'none'} />
              <span>Thích</span>
            </button>

            <button type="button" className={styles.actionBtn} onClick={scrollToComments}>
              <MessageCircle size={17} />
              <span>Bình luận</span>
            </button>

            <button type="button" className={styles.actionBtn} onClick={onShare}>
              <Share2 size={17} />
              <span>Chia sẻ</span>
            </button>

            <button
              type="button"
              className={`${styles.actionBtn} ${saved ? styles.activeSave : ''}`}
              onClick={onToggleSave}
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
  )
}