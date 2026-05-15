import { useEffect, useLayoutEffect, useRef, useState, useContext } from 'react'
import { X, MoreHorizontal, Heart, MessageCircle, Share2, Bookmark, Edit, Trash2, EyeOff, Flag, Play, Pause } from 'lucide-react'
import { toast } from 'react-toastify'
import ConfirmModal from './ConfirmModal'
import ShareModal from './ShareModal'
import EditPostModal from './EditPostModal'
import EditShareCaptionModal from './EditShareCaptionModal'
import ReportPostModal from './ReportPostModal'
import SaveCollectionModal from '../common/SaveCollectionModal'
import { API_BASE_URL } from '../../config/apiBase'
import styles from '../../style/feed/CommentModal.module.css'
import { getToken, getCurrentUser } from '../../utils/auth'
import { getCanonicalPostIdForEngagement } from '../../utils/canonicalPostId'
import { writeFeedScrollSessionKeys } from '../../utils/feedScrollSession'
import { publicDisplayName } from '../../utils/publicDisplayName'
import { getInitials } from '../../utils/getInitials'
import { createPortal } from 'react-dom'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { PodcastContext } from '../contexts/PodcastContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

function Avatar({ src, name, username, className, imageClassName, onOpenProfile }) {
  const displayName = name || username || 'Người dùng'

  return (
    <div
      className={`${className} ${onOpenProfile ? styles.profileAvatarLink : ''}`}
      role={onOpenProfile ? 'button' : undefined}
      tabIndex={onOpenProfile ? 0 : undefined}
      onClick={onOpenProfile}
      onKeyDown={(event) => {
        if (!onOpenProfile) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpenProfile(event)
        }
      }}
    >
      {src ? (
        <img
          src={src}
          alt={displayName}
          className={imageClassName}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            e.currentTarget.nextElementSibling.style.display = 'flex'
          }}
        />
      ) : null}

      <span style={{ display: src ? 'none' : 'flex' }}>
        {getInitials({
          username,
          display_name: displayName,
        })}
      </span>
    </div>
  )
}

function CommentNode({
  item,
  level = 0,
  currentUser,
  podcast,
  navigate,
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
  t,
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
  const commentUserId =
    item.user_id ?? item.user?.id ?? item.author_id ?? item.author?.id ?? item.created_by_id
  const openCommentAuthorProfile = (event) => {
    event?.stopPropagation?.()
    const target = commentUserId || item.username
    if (!target) return
    navigate(`/profile/${target}`)
  }

  return (
    <div
      className={wrapperClass}
      style={level > 2 ? { marginLeft: `${(level - 2) * 24}px` } : undefined}
    >
      <Avatar
        src={item.avatar_url || item.user_avatar || item.user?.avatar_url}
        name={item.display_name || item.name || item.username}
        username={item.username || item.user_id}
        className={avatarClass}
        imageClassName={styles.avatarImage}
        onOpenProfile={openCommentAuthorProfile}
      />

      <div className={mainClass}>
        <div className={styles.commentRow}>
          <div className={styles.commentBubbleWrap}>
            <div className={bubbleClass}>
              <div
                className={authorClass}
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
                      placeholder={t('feed.comment.editPlaceholder')}

                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      name={`edit-comment-input-${item.id}`}
                    />

                    <div className={styles.editActions}>
                      <button
                        type="button"
                        className={styles.editActionBtn}
                        onClick={() => handleUpdateComment(item.id)}
                        disabled={editingSubmitting || !editingInput.trim() || editingInput === item.content}
                      >
                        {t('feed.comment.save')}
                      </button>

                      <button
                        type="button"
                        className={styles.editActionBtnSecondary}
                        onClick={cancelEditComment}
                        disabled={editingSubmitting}
                      >
                        {t('feed.comment.cancel')}
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
              aria-label={t('feed.comment.commentOptions')}
              onClick={(e) => {
                e.stopPropagation()
                setOpenMenuId(isMenuOpen ? null : item.id)
              }}
            >
              <MoreHorizontal size={16} />
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
                      {t('feed.comment.edit')}
                    </button>

                    <button
                      type="button"
                      className={`${styles.commentDropdownItem} ${styles.commentDropdownItemDanger}`}
                      onClick={() => handleDeleteComment(item)}
                    >
                      {t('feed.comment.delete')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={styles.commentDropdownItem}
                    onClick={() => hideCommentLocally(item.id)}
                  >
                    {t('feed.comment.hide')}
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
            {t('feed.comment.like')}
          </button>

          <button
            type="button"
            className={styles.commentMetaBtn}
            onClick={() => openReplyBox(item)}
          >
            {t('feed.comment.reply')}
          </button>

          {((item.like_count || 0) > 0 || item.is_liked) && (
            <div className={styles.commentLikeBadgeInline}>
              <span>{item.like_count || 1}</span>
              <Heart size={12} fill="#ff7b94" />
            </div>
          )}
        </div>

        {isReplyingHere && (
          <form
            className={styles.replyComposer}
            style={level > 1 ? { marginLeft: `-${(level - 1) * 24}px` } : undefined}
            onSubmit={(e) => handleSubmitReply(e, replyingTarget)}
          >
            <Avatar
              src={currentUser?.avatar_url || currentUser?.avatar}
              name={currentUser?.display_name || currentUser?.name}
              username={currentUser?.username}
              className={avatarClass}
              imageClassName={styles.avatarImage}
            />

            <div className={styles.replyInputWrap}>
              <div className={styles.replyTagLine}>
                <span className={styles.replyTagLabel}>{t('feed.comment.replyTo')}</span>
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
                  placeholder={t('feed.comment.replyPlaceholder', {
                    name: getDisplayName(replyingTarget),
                  })}
                  className={styles.replyInput}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  name={`reply-input-${item.id}`}
                />
                <button
                  type="submit"
                  className={styles.replySendBtn}
                  disabled={replySubmitting || !replyInput.trim()}
                >
                  {t('feed.comment.send')}
                </button>
              </div>
            </div>

            <button
              type="button"
              className={styles.replyCancelBtn}
              onClick={closeReplyBox}
            >
              {t('feed.comment.cancel')}
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
                  navigate={navigate}
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
                  t={t}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatTimeAgo(date, t) {
  if (!date) return t('feed.comment.justPosted')

  const created = new Date(date)
  const now = new Date()
  const diffMs = now - created
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) return t('feed.comment.justPosted')
  if (diffMinutes < 60) return t('feed.comment.minutesAgo', { count: diffMinutes })

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return t('feed.comment.hoursAgo', { count: diffHours })

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return t('feed.comment.daysAgo', { count: diffDays })

  const months = Math.floor(diffDays / 30)
  if (months < 12) return t('feed.comment.monthsAgo', { count: months })

  return t('feed.comment.yearsAgo', { count: Math.floor(months / 12) })
}

function normalizePostTags(post) {
  const rawTags = [
    post?.tags,
    post?.tag_names,
    post?.tagNames,
    post?.post_tags,
    post?.audio?.tags,
  ]
    .flatMap((value) => (Array.isArray(value) ? value : value ? [value] : []))
    .flatMap((value) =>
      typeof value === 'string' && value.includes(',')
        ? value.split(',')
        : [value]
    )

  const seen = new Set()
  return rawTags
    .map((tag) => {
      if (typeof tag === 'string') return tag
      return tag?.name || tag?.tag_name || tag?.label || tag?.slug || ''
    })
    .map((tag) => String(tag || '').trim().replace(/^#/, ''))
    .filter((tag) => {
      if (!tag) return false
      const key = tag.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
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
  disableAutoScroll = true,
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { playTrack, currentTrack, playing, togglePlay, currentTime, formattedCurrentTime, trackProgressMap, seekToPercent, isSeeking } = useAudioPlayer()
  const { deletePost, hidePost, addSavedPost, removeSavedPost } = useContext(PodcastContext)
  const canonicalPostId =
    getCanonicalPostIdForEngagement(podcast) ?? String(podcast.id ?? '')
  /** Modal mở từ nút bình luận trên card share — API comment/social theo instance chia sẻ (id composite). */
  const isShareCommentModal =
    podcast.type === 'shared' && podcast.commentModalScope === 'share'
  const commentsApiPostId = isShareCommentModal ? podcast.id : canonicalPostId
  /** Like/lưu trong modal: theo scope (share row vs bài gốc). */
  const saveApiPostId = isShareCommentModal ? podcast.id : canonicalPostId
  const progressBarRef = useRef(null)

  const makeEngagementState = (overrides = {}) => ({
    liked: Boolean(liked),
    likeCount: Number(likeCount ?? 0),
    shareCount: Number(shareCount ?? 0),
    saveCount: Number(saveCount ?? 0),
    saved: Boolean(saved),
    ...overrides,
  })
  const [modalEngagement, setModalEngagement] = useState(() =>
    makeEngagementState()
  )
  const [engagementBusy, setEngagementBusy] = useState({
    like: false,
    save: false,
  })

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
  const [reportPostModalOpen, setReportPostModalOpen] = useState(false)
  const [editPostModalOpen, setEditPostModalOpen] = useState(false)
  const [livePostMeta, setLivePostMeta] = useState({
    title: podcast.title,
    description: podcast.description,
  })

  useEffect(() => {
    setLivePostMeta({
      title: podcast.title,
      description: podcast.description,
    })
  }, [podcast?.id, podcast?.title, podcast?.description])

  // Đồng bộ tiêu đề/mô tả khi bài viết bị chỉnh sửa ở nơi khác (Feed/Search/Favorites)
  useEffect(() => {
    const handleExternalPostSync = (event) => {
      const d = event.detail || {}
      if (!d.postId) return
      const syncId = isShareCommentModal ? commentsApiPostId : canonicalPostId
      if (String(d.postId) !== String(syncId)) return

      if (typeof d.title === 'string' || typeof d.description === 'string') {
        setLivePostMeta((prev) => ({
          title: typeof d.title === 'string' ? d.title : prev.title,
          description:
            typeof d.description === 'string' ? d.description : prev.description,
        }))
      }

      if (
        typeof d.liked === 'boolean' ||
        typeof d.likeCount === 'number' ||
        typeof d.saved === 'boolean' ||
        typeof d.saveCount === 'number' ||
        typeof d.shareCount === 'number'
      ) {
        setModalEngagement((prev) => {
          const base = prev || makeEngagementState()
          return {
            ...base,
            liked: typeof d.liked === 'boolean' ? d.liked : base.liked,
            likeCount:
              typeof d.likeCount === 'number' ? d.likeCount : base.likeCount,
            saved: typeof d.saved === 'boolean' ? d.saved : base.saved,
            saveCount:
              typeof d.saveCount === 'number' ? d.saveCount : base.saveCount,
            shareCount:
              typeof d.shareCount === 'number' ? d.shareCount : base.shareCount,
          }
        })
      }
    }
    window.addEventListener('post-sync-updated', handleExternalPostSync)
    return () =>
      window.removeEventListener('post-sync-updated', handleExternalPostSync)
  }, [
    canonicalPostId,
    commentsApiPostId,
    isShareCommentModal,
    liked,
    likeCount,
    saved,
    saveCount,
    shareCount,
  ])

  useEffect(() => {
    setModalEngagement(makeEngagementState())
  }, [
    podcast?.id,
    podcast?.commentModalScope,
    liked,
    likeCount,
    saved,
    saveCount,
    shareCount,
  ])
  const [showCollectionModal, setShowCollectionModal] = useState(false)
  // store both top and height to compensate for layout changes when child modal opens
  const collectionModalSavedScroll = useRef({ top: 0, height: 0 })
  const [postMoreMenuOpen, setPostMoreMenuOpen] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editShareCaptionOpen, setEditShareCaptionOpen] = useState(false)
  const [deleteShareConfirmOpen, setDeleteShareConfirmOpen] = useState(false)
  const [liveShareCaption, setLiveShareCaption] = useState(
    podcast?.share_caption || ''
  )

  useEffect(() => {
    setLiveShareCaption(podcast?.share_caption || '')
  }, [podcast?.id, podcast?.share_caption])
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
    fetchComments()
  }, [podcast?.id, podcast?.commentModalScope])

  useEffect(() => {
    setDidInitialScroll(false)
  }, [podcast?.id, podcast?.commentModalScope, disableAutoScroll])

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
    if (loadingComments || didInitialScroll) return

    requestAnimationFrame(() => {
      if (disableAutoScroll) {
        contentScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
      } else {
        scrollToComments('auto', false)
      }
      setDidInitialScroll(true)
    })
  }, [loadingComments, didInitialScroll, disableAutoScroll])

  const fetchComments = async () => {
    try {
      setLoadingComments(true)

      const token = getToken()
      const user = getCurrentUser()

      const res = await fetch(
        `http://localhost:8000/api/social/posts/${commentsApiPostId}/comments/?user_id=${user?.id || ''}`,
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

      setModalEngagement((prev) => ({
        ...prev,
        liked:
          typeof data.data?.is_liked === 'boolean'
            ? Boolean(data.data.is_liked)
            : prev.liked,
        saved:
          typeof data.data?.is_saved === 'boolean'
            ? Boolean(data.data.is_saved)
            : prev.saved,
        likeCount: Number(data.data?.like_count ?? prev.likeCount),
        saveCount: Number(data.data?.save_count ?? prev.saveCount),
        shareCount: Number(data.data?.share_count ?? prev.shareCount),
      }))
    } catch (err) {
      console.error('Fetch comments failed:', err)
    } finally {
      setLoadingComments(false)
    }
  }

  const handleLikeWithRefetch = async (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (engagementBusy.like) return

    const previous = modalEngagement
    const optimisticLiked = !previous.liked
    setEngagementBusy((prev) => ({ ...prev, like: true }))
    setModalEngagement({
      ...previous,
      liked: optimisticLiked,
      likeCount: Math.max(
        0,
        Number(previous.likeCount || 0) + (optimisticLiked ? 1 : -1)
      ),
    })

    try {
      const result = await onToggleLike?.(e)
      if (result && typeof result.liked === 'boolean') {
        setModalEngagement((prev) => ({
          ...prev,
          liked: result.liked,
          likeCount: Number(result.likeCount ?? prev.likeCount),
        }))
      }
    } catch (err) {
      setModalEngagement(previous)
      console.error('Toggle like failed:', err)
      toast.error(err.message || t('feed.comment.likePostFailed'))
    } finally {
      setEngagementBusy((prev) => ({ ...prev, like: false }))
    }
  }

  const handleSaveWithRefetch = async (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (engagementBusy.save) return
    const previous = modalEngagement
    const optimisticSaved = !previous.saved
    setEngagementBusy((prev) => ({ ...prev, save: true }))
    setModalEngagement({
      ...previous,
      saved: optimisticSaved,
      saveCount: Math.max(
        0,
        Number(previous.saveCount || 0) + (optimisticSaved ? 1 : -1)
      ),
    })

    try {
      const result = await onToggleSave?.(e)
      if (result && typeof result.saved === 'boolean') {
        setModalEngagement((prev) => ({
          ...prev,
          saved: result.saved,
          saveCount: Number(result.saveCount ?? prev.saveCount),
        }))
      }
    } catch (err) {
      setModalEngagement(previous)
      console.error('Toggle save failed:', err)
      toast.error(err.message || t('feed.comment.savePostFailed'))
    } finally {
      setEngagementBusy((prev) => ({ ...prev, save: false }))
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
    const trackLiked = modalEngagement.liked
    const trackSaved = modalEngagement.saved

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
          (item) =>
            String(item.id) === String(podcast.id) ||
            String(item.post_id) === String(canonicalPostId)
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
      alert(t('feed.comment.noAudioAlert'))
      return
    }

    if (String(currentTrack?.id) === String(podcast.id)) {
      togglePlay()
      return
    }

    playTrack({
      id: podcast.id,
      postId: canonicalPostId,
      title: podcast.title,
      author: authorName,
      audioUrl: finalAudioUrl,
      audio_url: finalAudioUrl,
      durationSeconds: finalDuration,
      duration_seconds: finalDuration,
      cover: podcast.cover || podcast.thumbnail_url || podcast.thumbnailUrl || '',
      thumbnail_url: podcast.cover || podcast.thumbnail_url || podcast.thumbnailUrl || '',
      liked: trackLiked,
      saved: trackSaved,
    })
  }

  const handleProgressBarClick = (e) => {
    if (!durationSeconds || durationSeconds === 0) return

    const trackLiked = modalEngagement.liked
    const trackSaved = modalEngagement.saved

    const barRect = progressBarRef.current?.getBoundingClientRect()
    if (!barRect) return

    const clickX = e.clientX - barRect.left
    const percentage = Math.max(0, Math.min(100, (clickX / barRect.width) * 100))

    if (currentTrack?.id === podcast.id) {
      seekToPercent(percentage)
    } else {
      playTrack({
        id: podcast.id,
        postId: canonicalPostId,
        title: podcast.title,
        author: authorName,
        audioUrl: getFullAudioUrl(audioUrl),
        audio_url: getFullAudioUrl(audioUrl),
        durationSeconds: Number(durationSeconds || 0),
        duration_seconds: Number(durationSeconds || 0),
        cover: podcast.cover || podcast.thumbnail_url || podcast.thumbnailUrl || '',
        thumbnail_url: podcast.cover || podcast.thumbnail_url || podcast.thumbnailUrl || '',
        liked: trackLiked,
        saved: trackSaved,
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

  const getDisplayName = (comment) =>
    publicDisplayName({
      display_name: comment?.display_name,
      username: comment?.username,
      user_id: comment?.user_id,
    }) || t('feed.comment.user')

  const formatCommentTime = (comment) => {
    if (comment.time_ago && typeof comment.time_ago === 'string') {
      return comment.time_ago
    }

    const raw = comment.created_at
    if (!raw) return t('feed.comment.justNow')

    const created = new Date(raw)
    if (Number.isNaN(created.getTime())) return t('feed.comment.justNow')

    const now = new Date()
    const diffMs = now - created
    const diffMinutes = Math.floor(diffMs / 60000)

    if (diffMinutes < 1) return t('feed.comment.justNow')
    if (diffMinutes < 60) return t('feed.comment.minutesAgo', { count: diffMinutes })

    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return t('feed.comment.hoursAgo', { count: diffHours })

    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return t('feed.comment.daysAgo', { count: diffDays })

    const diffWeeks = Math.floor(diffDays / 7)
    if (diffWeeks < 5) return t('feed.comment.weeksAgo', { count: diffWeeks })

    const diffMonths = Math.floor(diffDays / 30)
    if (diffMonths < 12) return t('feed.comment.monthsAgo', { count: diffMonths })

    const diffYears = Math.floor(diffDays / 365)
    return t('feed.comment.yearsAgo', { count: diffYears })
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
        `http://localhost:8000/api/social/posts/${commentsApiPostId}/comments/create/`,
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
        // Preserve current scroll position: measure before/after to compensate
        const container = contentScrollRef.current
        let prevScrollTop = 0
        let prevScrollHeight = 0
        if (container) {
          prevScrollTop = container.scrollTop
          prevScrollHeight = container.scrollHeight
        }

        setComments((prev) => [newComment, ...prev])

        // After DOM updates, restore scroll so the viewport doesn't jump
        requestAnimationFrame(() => {
          if (!container) return
          const newScrollHeight = container.scrollHeight
          const delta = newScrollHeight - prevScrollHeight
          // Increase scrollTop by delta so visual position remains
          container.scrollTop = prevScrollTop + delta
          // keep input focused
          commentInputRef.current?.focus()
        })
      }

      setCommentCount(nextCount)
      onCommentCountChange?.(nextCount)
      setCommentInput('')
    } catch (err) {
      console.error('Create comment failed:', err)
      toast.error(err.message || t('feed.comment.sendCommentFailed'))
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
        throw new Error(t('feed.comment.backendNotJson', { status: res.status }))
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
      toast.error(err.message || t('feed.comment.toggleLikeFailed'))
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
      toast.error(err.message || t('feed.comment.sendReplyFailed'))
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
      toast.error(err.message || t('feed.comment.updateCommentFailed'))
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
      toast.error(err.message || t('feed.comment.deleteCommentFailed'))
    }
  }

  const handleEditPost = () => {
    setPostMenuOpen(false)
    setEditPostModalOpen(true)
  }

  const handlePostEdited = (next) => {
    if (!next) return
    setLivePostMeta({
      title: next.title ?? livePostMeta.title,
      description: next.description ?? livePostMeta.description,
    })
    // Đồng bộ feed/card khác đang hiển thị bài này
    window.dispatchEvent(
      new CustomEvent('post-sync-updated', {
        detail: {
          postId: canonicalPostId,
          title: next.title,
          description: next.description,
        },
      })
    )
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
      const deleteUrl = `http://localhost:8000/api/content/drafts/${canonicalPostId}/delete/`
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
        deletePost(canonicalPostId)
        removeSavedPost(canonicalPostId)
        // XÓA POST TRƯỚC
        onPostDeleted?.(canonicalPostId)

        // SAU ĐÓ MỚI ĐÓNG MODAL
        onClose()
      }, 800)
    } catch (err) {
      console.error('❌ Delete error:', err)
      setDeleteProgress(0)
      setIsDeleting(false)
      toast.error(err.message || t('feed.comment.deletePostFailed'))
      sessionStorage.removeItem('feedScrollPosition')
    }
  }

  const handleHide = () => {
    setPostMoreMenuOpen(false)
    setHidePostModalOpen(true)
  }

  const confirmHidePost = async () => {
    if (isShareCommentModal) {
      hidePost(podcast.id)
      setHidePostModalOpen(false)
      onPostDeleted?.(podcast.id)
      onClose()
      return
    }

    try {
      const token = getToken()
      const user = getCurrentUser()

      const res = await fetch(`http://localhost:8000/api/social/posts/${canonicalPostId}/hide/`, {
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
        throw new Error(t('feed.comment.hidePostFailed'))
      }

      hidePost(canonicalPostId)
      removeSavedPost(canonicalPostId)
      setHidePostModalOpen(false)
      onPostDeleted?.(canonicalPostId)
      onClose()
    } catch (err) {
      console.error('Hide post error:', err)
      toast.error(err.message || t('feed.comment.hidePostFailed'))
    }
  }
  const handleCollectionModalSave = async (_collectionId, saveData = {}) => {
    const nextSaveCount = Number(
      saveData.save_count ?? modalEngagement.saveCount + 1
    )
    setModalEngagement((prev) => ({
      ...prev,
      saved: true,
      saveCount: nextSaveCount,
    }))
    addSavedPost(canonicalPostId)
    window.dispatchEvent(
      new CustomEvent('post-sync-updated', {
        detail: {
          postId: canonicalPostId,
          saved: true,
          saveCount: nextSaveCount,
        },
      })
    )
    setShowCollectionModal(false)
  }

  // Preserve comment modal scroll when opening/closing child modals (like SaveCollectionModal)
  useEffect(() => {
    const container = contentScrollRef.current
    if (showCollectionModal) {
      if (container) {
        collectionModalSavedScroll.current = {
          top: container.scrollTop,
          height: container.scrollHeight,
        }
      }
      return
    }

    // closed -> restore by compensating for any change in scrollHeight
    requestAnimationFrame(() => {
      if (!container) return
      const prev = collectionModalSavedScroll.current || { top: 0, height: 0 }
      const delta = Math.max(0, (container.scrollHeight || 0) - (prev.height || 0))
      container.scrollTop = (prev.top || 0) + delta
    })
  }, [showCollectionModal])
  const handleReport = () => {
    setPostMoreMenuOpen(false)
    setReportPostModalOpen(true)
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
        endpoint = `http://localhost:8000/api/social/posts/${commentsApiPostId}/likers/`
      } else if (type === 'comments') {
        endpoint = `http://localhost:8000/api/social/posts/${commentsApiPostId}/commenters/`
      } else if (type === 'shares') {
        endpoint = `http://localhost:8000/api/social/posts/${commentsApiPostId}/sharers/`
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

  /* Sau khi thêm/xóa/trả lời cmt: xóa cache danh sách người bình luận trong popup */
  useEffect(() => {
    setStatsPopupData((prev) => ({ ...prev, comments: [] }))
  }, [commentCount])

  /* Mỗi lần mở hover "bình luận" hoặc đổi số lượng khi đang mở — luôn gọi API mới */
  useEffect(() => {
    if (statsHoverType !== 'comments') return
    void fetchStatsPopupData('comments')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ cần refetch theo hover + đếm, fetchStatsPopupData ổn định theo commentsApiPostId
  }, [statsHoverType, commentCount])

  const handleStatsMouseEnter = (type) => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
    }

    setStatsHoverType(type)

    if (type === 'comments') {
      return
    }

    const hasData =
      (type === 'likes' && statsPopupData.likes.length > 0) ||
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

  const engagement = modalEngagement
  const displayLiked = engagement.liked
  const displayLikeCount = engagement.likeCount
  const displayShareCount = engagement.shareCount
  const displaySaveCount = engagement.saveCount
  const displaySaved = engagement.saved

  const coverImage = podcast.cover || podcast.thumbnail_url || podcast.thumbnailUrl
  const shareAuthorLabel =
    podcast.sharedBy?.name || podcast.sharedBy?.username || t('feed.comment.user')
  const sharedBy = podcast.sharedBy || {}
  const sharerInitials = getInitials(
    sharedBy.username || sharedBy.name || shareAuthorLabel
  )
  const listensDisplay =
    typeof podcast.listens === 'string' && podcast.listens.trim()
      ? podcast.listens
      : t('feed.listens', { count: Number(podcast.listen_count ?? 0) })

  const displayTags = normalizePostTags(podcast)

  const isOwnerPost =
    podcast?.isOwner === true ||
    String(currentUser?.id) === String(podcast.authorId) ||
    String(currentUser?.id) === String(podcast.author_id) ||
    String(currentUser?.id) === String(podcast.userId) ||
    String(currentUser?.id) === String(podcast.user_id) ||
    String(currentUser?.username) === String(podcast.authorUsername)

  const sharedByUserId =
    sharedBy?.id ?? sharedBy?.user_id ?? sharedBy?.pk ?? sharedBy?.userId
  const isShareOwner =
    isShareCommentModal &&
    sharedByUserId != null &&
    currentUser?.id != null &&
    String(currentUser.id) === String(sharedByUserId)

  const handleEditShareCaption = (e) => {
    e?.stopPropagation?.()
    e?.preventDefault?.()
    setPostMenuOpen(false)
    setEditShareCaptionOpen(true)
  }

  const handleShareCaptionSaved = (nextCaption) => {
    setLiveShareCaption(nextCaption || '')
    setEditShareCaptionOpen(false)
    window.dispatchEvent(
      new CustomEvent('post-sync-updated', {
        detail: {
          postId: podcast.id,
          shareCaption: nextCaption ?? '',
        },
      })
    )
  }

  const handleDeleteShareClick = (e) => {
    e?.stopPropagation?.()
    e?.preventDefault?.()
    setPostMenuOpen(false)
    setDeleteShareConfirmOpen(true)
  }

  const confirmDeleteShare = async () => {
    try {
      const token = getToken()
      const user = getCurrentUser()
      const res = await fetch(
        `${API_BASE_URL}/social/posts/${canonicalPostId}/unshare/`,
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
      toast.success(t('feed.comment.deletePostSuccess'))
      setDeleteShareConfirmOpen(false)
      onPostDeleted?.(podcast.id)
      handleClose()
    } catch (err) {
      console.error('Unshare failed:', err)
      toast.error(err.message || t('feed.comment.deletePostFailed'))
    }
  }

  const authorName =
    typeof podcast.author === 'object'
      ? podcast.author?.name || podcast.author?.username || t('feed.anonymous')
      : podcast.author || t('feed.anonymous')

  const authorUsername =
    typeof podcast.author === 'object'
      ? podcast.author?.username || podcast.authorUsername || ''
      : podcast.authorUsername || ''

  const authorAvatarUrl =
    typeof podcast.author === 'object'
      ? podcast.author?.avatar_url || ''
      : podcast.author_avatar || ''

  return [
    createPortal(
      <div className={styles.overlay} onClick={handleClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.topBar}>
            <h2 className={styles.modalTitle}>
              {isShareCommentModal
                ? t('feed.comment.sharedPostBy', { author: shareAuthorLabel })
                : t('feed.comment.postBy', { author: authorName })}
            </h2>
            <div className={styles.topBarRight}>
              <button className={styles.closeBtn} type="button" onClick={handleClose}>
                <X size={22} />
              </button>
            </div>
          </div>

          <div ref={contentScrollRef} className={styles.contentScroll}>
            {isShareCommentModal && (
              <div
                className={[
                  styles.shareIntroBlock,
                  liveShareCaption?.trim()
                    ? ''
                    : styles.shareIntroBlockNoCaption,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className={styles.shareIntroRow}>
                  <Avatar
                    src={sharedBy.avatar_url}
                    name={shareAuthorLabel}
                    username={sharedBy.username || sharedBy.user_id}
                    className={styles.avatar}
                    imageClassName={styles.avatarImage}
                  />
                  <div className={styles.shareIntroInfo}>
                    <div
                      className={styles.shareIntroName}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        navigate(`/profile/${sharedBy.username || sharedBy.user_id || ''}`)
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          navigate(`/profile/${sharedBy.username || sharedBy.user_id || ''}`)
                        }
                      }}
                    >
                      {shareAuthorLabel}
                    </div>
                    <div className={styles.shareIntroMeta}>
                      {podcast.sharedTimeAgo || podcast.timeAgo || t('feed.comment.justNow')}
                    </div>
                  </div>

                  {isShareOwner && (
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
                            onClick={(e) => handleEditShareCaption(e)}
                          >
                            <Edit size={14} />
                            <span>{t('feed.edit')}</span>
                          </button>
                          <button
                            type="button"
                            className={`${styles.postDropdownItem} ${styles.postDropdownItemDanger}`}
                            onClick={(e) => handleDeleteShareClick(e)}
                          >
                            <Trash2 size={14} />
                            <span>{t('feed.delete')}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {isShareCommentModal && !isShareOwner && (
                    <div className={styles.postMenuWrap} ref={postMoreMenuRef}>
                      <button
                        className={styles.moreBtn}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPostMenuOpen(false)
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
                            <EyeOff size={14} />
                            <span>{t('feed.hidePost')}</span>
                          </button>
                          <button
                            type="button"
                            className={`${styles.postDropdownItem} ${styles.postDropdownItemDanger}`}
                            onClick={handleReport}
                          >
                            <Flag size={14} />
                            <span>{t('feed.report')}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {liveShareCaption && (
                  <p className={styles.shareIntroCaption}>{liveShareCaption}</p>
                )}
              </div>
            )}

            <div className={isShareCommentModal ? styles.sharedPostCard : undefined}>
              <div className={styles.postHeader}>
                <div className={styles.authorBlock}>
                  <Avatar
                    src={authorAvatarUrl}
                    name={authorName}
                    username={authorUsername}
                    className={styles.avatar}
                    imageClassName={styles.avatarImage}
                  />
                  <div>
                    <div className={styles.author}>{authorName}</div>
                    <div className={styles.meta}>
                      {(isShareCommentModal ? podcast.postTimeAgo : podcast.timeAgo) ||
                        formatTimeAgo(podcast.created_at, t)}
                      {isShareCommentModal && Number(podcast.listen_count ?? 0) > 0 && (
                        <> · {listensDisplay}</>
                      )}
                    </div>
                  </div>
                </div>

                {isOwnerPost && !isShareCommentModal && (
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
                          <Edit size={14} />
                          <span>Chỉnh sửa</span>
                        </button>
                        <button
                          type="button"
                          className={`${styles.postDropdownItem} ${styles.postDropdownItemDanger}`}
                          onClick={handleDeletePost}
                        >
                          <Trash2 size={14} />
                          <span>{t('feed.delete')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}


                {!isOwnerPost && !isShareCommentModal && (
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
                          <EyeOff size={14} />
                          <span>{t('feed.hidePost')}</span>
                        </button>
                        <button
                          type="button"
                          className={`${styles.postDropdownItem} ${styles.postDropdownItemDanger}`}
                          onClick={handleReport}
                        >
                          <Flag size={14} />
                          <span>{t('feed.report')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className={styles.postBody}>
                {displayTags.length > 0 && (
                  <div className={styles.postTags}>
                    {displayTags.map((tag) => (
                      <span key={tag} className={styles.postTag}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <h3 className={styles.title}>{livePostMeta.title}</h3>
                <p className={styles.description}>{livePostMeta.description}</p>

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
            </div>

            <div className={`${styles.statsRow} ${isShareCommentModal ? styles.statsRowShareFeed : ''}`}>
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
                      {displayLikeCount ?? 0}
                    </span>
                  </button>

                  {statsHoverType === 'likes' && (
                    <div
                      className={styles.statsPopup}
                      onMouseEnter={() => handleStatsMouseEnter('likes')}
                      onMouseLeave={handleStatsMouseLeave}
                    >

                      {statsPopupLoading ? (
                        <div className={styles.statsPopupEmpty}>{t('feed.loadingText')}</div>
                      ) : statsPopupData.likes.length > 0 ? (
                        statsPopupData.likes.map((user) => (
                          <div key={user.user_id} className={styles.statsPopupItem}>
                            <span className={styles.statsPopupName}>
                              {publicDisplayName(user)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className={styles.statsPopupEmpty}>{t('feed.noLikes')}</div>
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
                      {t('feed.commentsLower', { count: commentCount })}
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
                              {publicDisplayName(user)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className={styles.statsPopupEmpty}>{t('feed.noComments')}</div>
                      )}
                    </div>
                  )}
                </div>

                {!isShareCommentModal && (
                  <div
                    className={styles.statHoverWrap}
                  >
                    <button type="button" className={styles.statTextButton}>
                      <span
                        onMouseEnter={() => handleStatsMouseEnter('shares')}
                        onMouseLeave={handleStatsMouseLeave}
                        className={styles.statsText}
                      >
                        {displayShareCount ?? 0} lượt chia sẻ
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
                                {publicDisplayName(user)}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className={styles.statsPopupEmpty}>{t('feed.noShares')}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className={`${styles.actionRow} ${isShareCommentModal ? styles.actionRowShareFeed : ''}`}>
              <button
                type="button"
                className={`${styles.actionBtn} ${displayLiked ? styles.activeLike : ''}`}
                disabled={engagementBusy.like}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleLikeWithRefetch(e)
                }}
              >
                <Heart size={17} fill={displayLiked ? 'currentColor' : 'none'} />
                <span>{t('feed.like')}</span>
              </button>

              <button type="button" className={styles.actionBtn} onClick={scrollToComments}>
                <MessageCircle size={17} />
                <span>{t('feed.commentAction')}</span>
              </button>

              {!isShareCommentModal && (
                <button type="button" className={styles.actionBtn} onClick={() => setShowShareModal(true)}>
                  <Share2 size={17} />
                  <span>{t('shareModal.title')}</span>
                </button>
              )}

              {!isShareCommentModal && (
                <button
                  ref={saveButtonRef}
                  type="button"
                  className={`${styles.actionBtn} ${displaySaved ? styles.activeSave : ''}`}
                  disabled={engagementBusy.save}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (displaySaved) {
                      handleSaveWithRefetch(e)
                    } else {
                      setShowCollectionModal(true)
                    }
                  }}
                >
                  <Bookmark size={17} fill={displaySaved ? 'currentColor' : 'none'} />
                  <span>{t('library.postDetail.save')}</span>
                </button>
              )}
            </div>

            <div
              className={
                isShareCommentModal ? styles.shareCommentsBlock : styles.commentSection
              }
            >
              {isShareCommentModal ? (
                <p className={styles.shareCommentsLabel}>
                  {t('feed.comment.sharedPostComments')}
                </p>
              ) : null}

              <div
                ref={commentListRef}
                className={`${styles.commentList} ${isShareCommentModal ? styles.commentListShare : ''}`}
              >
                {loadingComments ? (
                  <p className={styles.empty}>{t('feed.comment.loadingComments')}</p>
                ) : comments.length === 0 ? (
                  <p className={styles.empty}>{t('feed.comment.noComments')}</p>
                ) : (
                  comments
                    .filter((comment) => !hiddenCommentIds.includes(comment.id))
                    .map((comment) => (
                      <CommentNode
                        key={comment.id}
                        navigate={navigate}
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
                        t={t}
                      />
                    )
                    )
                )}
              </div>
            </div>
          </div>

          <form className={styles.commentComposer} onSubmit={handleSubmitComment}>
            <Avatar
              src={currentUser?.avatar_url || currentUser?.avatar}
              name={currentUser?.display_name || currentUser?.name}
              username={currentUser?.username}
              className={styles.composerAvatar}
              imageClassName={styles.avatarImage}
            />

            <div className={styles.inputWrap}>
              <input
                ref={commentInputRef}
                id={`comment-input-${podcast.id}`}
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder={t('feed.comment.writeComment')}
                className={styles.commentInput}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                name={`comment-input-${podcast.id}`}
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
        title={t('feed.confirm.deleteCommentTitle')}
        message={t('feed.confirm.deleteCommentMessage')}
        confirmText={t('feed.comment.delete')}
        cancelText={t('feed.confirm.cancel')}
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
        title={t('feed.confirm.deletePostTitle')}
        message={t('feed.confirm.deletePostMessage')}
        confirmText={t('feed.comment.delete')}
        cancelText={t('feed.confirm.cancel')}
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
        onShareSuccess={(data) => { }}
      />,
      document.body
    ) : null,

    createPortal(
      <ConfirmModal
        isOpen={hidePostModalOpen}
        title={t('feed.confirm.hidePostTitle')}
        message={t('feed.confirm.hidePostMessage')}
        confirmText={t('feed.confirm.hide')}
        cancelText={t('feed.confirm.cancel')}
        onConfirm={confirmHidePost}
        onCancel={() => setHidePostModalOpen(false)}
      />,
      document.body
    ),

    createPortal(
      <SaveCollectionModal
        isOpen={showCollectionModal}
        onClose={() => setShowCollectionModal(false)}
        postId={saveApiPostId}
        onSave={handleCollectionModalSave}
        triggerRef={saveButtonRef}
        isPopup={false}
      />,
      document.body
    ),

    reportPostModalOpen ? createPortal(
      <ReportPostModal
        postId={canonicalPostId}
        postTitle={livePostMeta.title}
        authorId={podcast.authorId || podcast.author_id || podcast.userId || podcast.user_id}
        authorName={authorName}
        onClose={() => setReportPostModalOpen(false)}
      />,
      document.body
    ) : null,

    <EditPostModal
      key="edit-post-modal"
      isOpen={editPostModalOpen}
      postId={canonicalPostId}
      onClose={() => setEditPostModalOpen(false)}
      onSaved={handlePostEdited}
    />,

    <EditShareCaptionModal
      key="edit-share-caption-modal"
      isOpen={editShareCaptionOpen}
      compositeRowId={podcast?.id}
      initialCaption={liveShareCaption}
      onClose={() => setEditShareCaptionOpen(false)}
      onSaved={handleShareCaptionSaved}
    />,

    createPortal(
      <ConfirmModal
        title={t('feed.confirm.deletePostTitle')}
        message={t('feed.confirm.deletePostMessage')}
        confirmText={t('feed.comment.delete')}
        cancelText={t('feed.confirm.cancel')}
        isDangerous={true}
        onConfirm={confirmDeleteShare}
        onCancel={() => setDeleteShareConfirmOpen(false)}
      />,
      document.body
    ),
  ].filter(Boolean)
}