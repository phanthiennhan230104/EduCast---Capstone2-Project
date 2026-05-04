  import { useEffect, useRef, useState, useContext } from 'react'
  import { useNavigate } from 'react-router-dom'
  import { createPortal } from 'react-dom'
  import { toast } from 'react-toastify'
  import {
    Play, Pause, Heart, MessageCircle,
    Share2, Bookmark, Sparkles, MoreHorizontal, Edit, Trash2, EyeOff, Flag
  } from 'lucide-react'
  import styles from '../../style/feed/PodcastCard.module.css'
  import { useAudioPlayer } from '../contexts/AudioPlayerContext'
  import { PodcastContext } from '../contexts/PodcastContext'
  import { getToken, getCurrentUser } from '../../utils/auth'
  import CommentModal from './CommentModal'
  import ShareModal from './ShareModal'
  import ConfirmModal from './ConfirmModal'
  import SaveCollectionModal from '../common/SaveCollectionModal'

  function formatTime(seconds) {
    const total = Math.floor(Number(seconds || 0))
    const mins = Math.floor(total / 60)
    const secs = total % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

export default function PodcastCard({ podcast, queue = [], onDelete, onHide }) {
    const currentUser = getCurrentUser()
    const navigate = useNavigate()
    const menuRef = useRef(null)
    
    const [liked, setLiked] = useState(podcast.liked ?? false)
    const [likeCount, setLikeCount] = useState(podcast.likes ?? 0)
    const [loadingLike, setLoadingLike] = useState(false)
    const [saved, setSaved] = useState(
      podcast.saved ?? podcast.viewer_state?.is_saved ?? false
    )
    const [saveCount, setSaveCount] = useState(
      podcast.saveCount ?? podcast.stats?.saves ?? 0
    )
    const [loadingSave, setLoadingSave] = useState(false)
    const [shareCount, setShareCount] = useState(podcast.shares ?? 0)
    const [loadingShare, setLoadingShare] = useState(false)
    const [showCommentModal, setShowCommentModal] = useState(false)
    const [showShareModal, setShowShareModal] = useState(false)
    const [commentCount, setCommentCount] = useState(podcast.comments ?? 0)
    const [menuOpen, setMenuOpen] = useState(false)
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
    const POST_SYNC_EVENT = 'post-sync-updated'

    const dispatchPostSync = (payload) => {
      window.dispatchEvent(new CustomEvent(POST_SYNC_EVENT, { detail: payload }))
    }
    
    const [modal, setModal] = useState({
      isOpen: false,
      type: 'confirm', // 'confirm' | 'alert' | 'prompt'
      title: '',
      message: '',
      confirmText: 'Xác nhận',
      cancelText: 'Hủy',
      isDangerous: false,
      inputValue: '',
      onConfirm: null,
    })

    const isOwner = String(currentUser?.username) === String(podcast.authorUsername) || 
                    String(currentUser?.username) === String(podcast.author) ||
                    String(currentUser?.id) === String(podcast.authorId)

    const { savedPostIds, addSavedPost, removeSavedPost, deletePost, hidePost } = useContext(PodcastContext)

    const {
      playing,
      currentTime,
      duration,
      progressPercent,
      playTrack,
      seekToPercent,
      isCurrentTrack,
      trackProgressMap,
      togglePlay,
    } = useAudioPlayer()

    const prevSavedPostIdsRef = useRef(savedPostIds)

    const saveBookmarkRef = useRef(null)
    const [showCollectionModal, setShowCollectionModal] = useState(false)

    useEffect(() => {
      const wasPreviouslySaved = prevSavedPostIdsRef.current.has(podcast.id)
      const isCurrentlySaved = savedPostIds.has(podcast.id)
      
      if (wasPreviouslySaved && !isCurrentlySaved && saved) {
        setSaveCount(prev => Math.max(prev - 1, 0))
        setSaved(false)
      }
      
      prevSavedPostIdsRef.current = savedPostIds
    }, [savedPostIds, podcast.id, saved])

    const isActive = isCurrentTrack(podcast.id)
    const isPlaying = isActive && playing

    const audioSrc = podcast.audioUrl || podcast.audio_url || ''
    const queueWithAudio = queue.filter((item) => item.audioUrl || item.audio_url)

    const savedProgress = trackProgressMap?.[podcast.id]
    const hasPlayedBefore = Boolean(savedProgress?.hasPlayed)

    const displayCurrent = isActive
      ? formatTime(currentTime)
      : hasPlayedBefore
        ? formatTime(savedProgress?.currentTime || 0)
        : '00:00'

    const displayDuration = isActive
      ? formatTime(duration || podcast.durationSeconds || podcast.duration_seconds || 0)
      : formatTime(savedProgress?.duration || podcast.durationSeconds || podcast.duration_seconds || 0)

    const displayProgress = isActive
      ? progressPercent
      : hasPlayedBefore
        ? Number(savedProgress?.progressPercent || 0)
        : 0

    const {
      title,
      author,
      authorUsername,
      authorInitials = 'A',
      cover,
      tags,
      aiGenerated,
      description,
    } = podcast

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (menuRef.current && !menuRef.current.contains(event.target)) {
          const dropdown = document.querySelector(`.${styles.dropdown}`)
          if (dropdown && dropdown.contains(event.target)) {
            return
          }
          setMenuOpen(false)
        }
      }

      const handleScroll = () => {
        if (menuOpen) {
          setMenuOpen(false)
        }
      }

      if (menuOpen && menuRef.current) {
        const button = menuRef.current.querySelector('button')
        if (button) {
          const rect = button.getBoundingClientRect()
          const dropdownWidth = 130
          const gap = 2

          setDropdownPos({
            top: rect.bottom + gap,
            left: rect.right,
          })
        }
        document.addEventListener('mousedown', handleClickOutside)
        document.querySelector('main')?.addEventListener('scroll', handleScroll)
        return () => {
          document.removeEventListener('mousedown', handleClickOutside)
          document.querySelector('main')?.removeEventListener('scroll', handleScroll)
        }
      }
    }, [menuOpen])

    const showModal = (config) => {
      setModal({
        isOpen: true,
        type: 'confirm',
        title: '',
        message: '',
        confirmText: 'Xác nhận',
        cancelText: 'Hủy',
        isDangerous: false,
        inputValue: '',
        onConfirm: null,
        ...config,
      })
    }

    const closeModal = () => {
      setModal((prev) => ({ ...prev, isOpen: false, onConfirm: null }))
    }

    const saveEditReturnState = () => {
      const mainElement = document.querySelector('main')

      sessionStorage.setItem(
        'returnToAfterEdit',
        window.location.pathname + window.location.search
      )

      sessionStorage.setItem(
        'feedScrollPosition',
        String(mainElement?.scrollTop || 0)
      )

      sessionStorage.setItem('editFocusPostId', String(podcast.id))
      sessionStorage.setItem('returnFromEdit', 'true')
    }

    const handleEdit = () => {
      setMenuOpen(false)
      saveEditReturnState()
      navigate(`/edit/${podcast.id}`)
    }

    const handleDelete = async () => {
      setMenuOpen(false)
      
      showModal({
        type: 'confirm',
        title: 'Xóa bài viết',
        message: 'Bạn chắc chắn muốn xóa bài viết này?\nHành động này không thể hoàn tác.',
        confirmText: 'Xóa',
        isDangerous: true,
        onConfirm: async () => {
          try {
            closeModal()
            await new Promise(resolve => setTimeout(resolve, 300))

            const token = getToken()
            const deleteUrl = `http://localhost:8000/api/content/drafts/${podcast.id}/delete/`

            const res = await fetch(deleteUrl, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            })

            const responseText = await res.text()

            if (!res.ok) {
              throw new Error(`Delete failed: ${res.status} ${responseText}`)
            }

            setTimeout(() => {
              if (onDelete) {
                onDelete(podcast.id)
              }
            }, 450)
          } catch (err) {
            console.error('❌ Delete error:', err)
            toast.error(err.message || 'Xóa bài viết thất bại')
            sessionStorage.removeItem('feedScrollPosition')
          }
        }
      })
    }

    const handleHide = () => {
      setMenuOpen(false)

      showModal({
        type: 'confirm',
        title: 'Ẩn bài viết',
        message: 'Bạn có muốn ẩn bài viết này khỏi feed không?',
        confirmText: 'Ẩn',
        onConfirm: async () => {
          try {
            closeModal()

            const token = getToken()
            const currentUser = getCurrentUser()

            const res = await fetch(`http://localhost:8000/api/social/posts/${podcast.id}/hide/`, {
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

            onHide?.(podcast.id)
          } catch (err) {
            console.error('Hide post error:', err)
            toast.error(err.message || 'Ẩn bài viết thất bại')
          }
        },
      })
    }

    const handleReport = async () => {
      setMenuOpen(false)
      showModal({
        type: 'prompt',
        title: 'Báo cáo bài viết',
        message: 'Vui lòng cho biết lý do báo cáo bài viết này:',
        confirmText: 'Gửi báo cáo',
        isDangerous: true,
        inputValue: '',
        onConfirm: async () => {
          const reason = modal.inputValue.trim()
          if (!reason) {
            showModal({
              type: 'alert',
              title: 'Thông báo',
              message: 'Vui lòng nhập lý do báo cáo',
              confirmText: 'Đóng',
            })
            return
          }

          try {
            closeModal()
            const token = getToken()
            const res = await fetch(`http://localhost:8000/api/social/posts/${podcast.id}/report/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ reason }),
            })

            if (!res.ok) {
              throw new Error('Báo cáo bài viết thất bại')
            }

            showModal({
              type: 'alert',
              title: 'Cảm ơn',
              message: 'Bài viết đã được báo cáo',
              confirmText: 'Đóng',
            })
          } catch (err) {
            console.error('Report failed:', err)
            showModal({
              type: 'alert',
              title: 'Lỗi',
              message: err.message || 'Báo cáo thất bại',
              confirmText: 'Đóng',
            })
          }
        },
      })
    }

    const handlePlayClick = () => {
      if (!audioSrc) return

      if (isActive) {
        togglePlay()
        return
      }

      playTrack(
        {
          ...podcast,
          id: podcast.id,
          postId: podcast.id,
          liked,
          saved,
          audioUrl: audioSrc,
          // Callback để AudioPlayer có thể update trạng thái like lên PodcastCard
          onLikeChange: (result) => {
            setLiked(result.liked)
            setLikeCount(result.likeCount)
          },
        },
        queueWithAudio.map((item) => ({
          ...item,
          audioUrl: item.audioUrl || item.audio_url || '',
        }))
      )
    }

    const handleSeek = (e) => {
      const value = Number(e.target.value)

      if (!audioSrc) return

      if (!isActive) {
        playTrack(
          {
            ...podcast,
            audioUrl: audioSrc,
            // Callback để AudioPlayer có thể update trạng thái like lên PodcastCard
            onLikeChange: (result) => {
              setLiked(result.liked)
              setLikeCount(result.likeCount)
            },
          },
          queueWithAudio.map((item) => ({
            ...item,
            audioUrl: item.audioUrl || item.audio_url || '',
          }))
        )

        setTimeout(() => seekToPercent(value), 0)
        return
      }

      seekToPercent(value)
    }

    const handleToggleLike = async (e) => {
      e.preventDefault()
      e.stopPropagation()

      if (loadingLike) return

      try {
        setLoadingLike(true)

        const token = getToken()
        const currentUser = getCurrentUser()

        const res = await fetch(
          `http://localhost:8000/api/social/posts/${podcast.id}/like/`,
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

        if (!res.ok || !data.success) {
          throw new Error(data.message || `HTTP ${res.status}`)
        }

        const nextLiked = Boolean(data.data?.liked)
        const nextLikeCount = Number(data.data?.like_count || 0)

        setLiked(nextLiked)
        setLikeCount(nextLikeCount)
        dispatchPostSync({
          postId: podcast.id,
          liked: nextLiked,
          likeCount: nextLikeCount,
        })

        window.dispatchEvent(
          new CustomEvent('audio-track-like-updated', {
            detail: {
              postId: podcast.id,
              liked: nextLiked,
              likeCount: nextLikeCount,
            },
          })
        )
        
        setStatsPopupData({
          likes: [],
          comments: [],
          shares: [],
        })
      } catch (err) {
        console.error('Like failed:', err)
      } finally {
        setLoadingLike(false)
      }
    }

    const handleToggleSave = async (e) => {
      e.preventDefault()
      e.stopPropagation()

      if (loadingSave) return

      console.log('🔖 handleToggleSave called, saved:', saved)

      // Nếu đã save -> unsave trực tiếp
      if (saved) {
        try {
          setLoadingSave(true)

          const token = getToken()
          const currentUser = getCurrentUser()

          console.log('🔖 Unsaving post:', podcast.id)

          const res = await fetch(
            `http://localhost:8000/api/social/posts/${podcast.id}/save/`,
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

          const contentType = res.headers.get('content-type')
          if (!contentType?.includes('application/json')) {
            throw new Error('API error: Invalid response')
          }

          const data = await res.json()

          console.log('🔖 Unsave response:', data)

          if (!res.ok || !data.success) {
            throw new Error(data.message || `HTTP ${res.status}`)
          }

          const nextSaveCount = Number(data.data?.save_count || 0)

          setSaved(false)
          setSaveCount(nextSaveCount)
          removeSavedPost(podcast.id)

          dispatchPostSync({
            postId: podcast.id,
            saved: false,
            saveCount: nextSaveCount,
          })
          console.log('🔖 Unsave successful')
        } catch (err) {
          console.error('❌ Unsave failed:', err)
          toast.error('Lỗi khi bỏ lưu: ' + err.message)
        } finally {
          setLoadingSave(false)
        }
        return
      }

      // Nếu chưa save -> show collection picker modal
      console.log('🔖 Showing collection modal')
      setShowCollectionModal(true)
    }

    const handleCollectionModalSave = async (collectionId) => {
      setSaved(true)

      setSaveCount(prev => {
        const next = prev + 1

        dispatchPostSync({
          postId: podcast.id,
          saved: true,
          saveCount: next,
        })

        return next
      })

      addSavedPost(podcast.id)
      setShowCollectionModal(false)
    }

    const handleShare = async (e) => {
      e.preventDefault()
      e.stopPropagation()

      setShowShareModal(true)
    }

    const [statsPopupDirection, setStatsPopupDirection] = useState('down')
    const [statsHoverType, setStatsHoverType] = useState(null) 
    const [statsPopupData, setStatsPopupData] = useState({
      likes: [],
      comments: [],
      shares: [],
    })
    const [statsPopupLoading, setStatsPopupLoading] = useState(false)
    const hoverTimerRef = useRef(null)

    const getUniqueUsersById = (items = []) => {
      const map = new Map()

      items.forEach((item) => {
        const key = item.user_id || item.username
        if (!key || map.has(key)) return
        map.set(key, item)
      })

      return Array.from(map.values())
    }

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
            shares: getUniqueUsersById(data.data?.sharers || []),
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

      updatePopupDirection(type)
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

    const statRefs = useRef({
      likes: null,
      comments: null,
      shares: null,
    })

    const updatePopupDirection = (type) => {
      const triggerEl = statRefs.current[type]
      if (!triggerEl) {
        setStatsPopupDirection('down')
        return
      }

      const rect = triggerEl.getBoundingClientRect()
      const popupHeight = 260
      const gap = 12

      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top

      if (spaceBelow < popupHeight + gap && spaceAbove > popupHeight + gap) {
        setStatsPopupDirection('up')
      } else {
        setStatsPopupDirection('down')
      }
    }

    useEffect(() => {
      const handlePostSync = (event) => {
        const d = event.detail || {}
        if (String(d.postId) !== String(podcast.id)) return

        if (typeof d.liked === 'boolean') setLiked(d.liked)
        if (typeof d.likeCount === 'number') setLikeCount(d.likeCount)
        if (typeof d.saved === 'boolean') setSaved(d.saved)
        if (typeof d.saveCount === 'number') setSaveCount(d.saveCount)
      }

      window.addEventListener(POST_SYNC_EVENT, handlePostSync)
      return () => window.removeEventListener(POST_SYNC_EVENT, handlePostSync)
    }, [podcast.id])

    return (
      <>
        <article
          className={[
            styles.card,
            showCommentModal ? styles.noHover : '',
            isActive ? styles.activeCard : '',
          ].join(' ')}
        >
          <div className={styles.cardHeader}>
            <div className={styles.authorAvatar}>
              {authorInitials}
            </div>

            <div className={styles.authorInfo}>
              <div className={styles.authorMetaRow}>
                <span className={styles.authorName}>{author}</span>
                <span className={styles.metaDot}>•</span>
                <span className={styles.authorMetaText}>{podcast.timeAgo}</span>
                <span className={styles.metaDot}>•</span>
                <span className={styles.authorMetaText}>{podcast.listens}</span>
              </div>

              <div className={styles.tagRow}>
                {(tags || []).map((t) => (
                  <span key={t} className={styles.tag}>{t}</span>
                ))}

                {aiGenerated && (
                  <span className={styles.aiBadge}>
                    <Sparkles size={13} />
                    Được tạo bởi AI
                  </span>
                )}
              </div>
            </div>

            <div className={styles.menuWrap} ref={menuRef}>
              <button
                className={styles.menuBtn}
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Tùy chọn"
              >
                <MoreHorizontal size={18} />
              </button>

              {menuOpen &&
                createPortal(
                  <div 
                    className={styles.dropdown}
                    style={{
                      top: `${dropdownPos.top}px`,
                      left: `${dropdownPos.left}px`,
                    }}
                  >
                    {isOwner ? (
                      <>
                        <button className={styles.dropdownItem} onClick={handleEdit}>
                          <Edit size={16} />
                          <span>Chỉnh sửa</span>
                        </button>
                        <button className={`${styles.dropdownItem} ${styles.danger}`} onClick={handleDelete}>
                          <Trash2 size={16} />
                          <span>Xóa</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button className={styles.dropdownItem} onClick={handleHide}>
                          <EyeOff size={16} />
                          <span>Ẩn bài viết</span>
                        </button>
                        <button className={`${styles.dropdownItem} ${styles.danger}`} onClick={handleReport}>
                          <Flag size={16} />
                          <span>Báo cáo</span>
                        </button>
                      </>
                    )}
                  </div>,
                  document.body
                )}
            </div>
          </div>

          <div className={styles.body}>
            <div className={styles.textContent}>
              <h3 className={styles.title}>{title}</h3>
              <p className={styles.description}>{description}</p>
            </div>

            {cover && (
              <img
                src={cover}
                alt={title}
                className={styles.cover}
              />
            )}
          </div>

          <div className={styles.player}>
            <button
              className={`${styles.playBtn} ${isPlaying ? styles.playing : ''}`}
              onClick={handlePlayClick}
              aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
              disabled={!audioSrc}
              title={!audioSrc ? 'Bài này chưa có audio' : ''}
              type="button"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>

            <div className={styles.progressSection}>
              <span className={styles.time}>{displayCurrent}</span>

              <div className={styles.progressBar}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={displayProgress}
                  onChange={handleSeek}
                  className={styles.range}
                  disabled={!audioSrc}
                />
                <div
                  className={styles.progressFill}
                  style={{ width: `${displayProgress}%` }}
                />
              </div>

              <span className={styles.time}>{displayDuration}</span>
            </div>
          </div>

          <div className={styles.actions}>
            <div
              ref={(el) => { statRefs.current.likes = el }}
              className={styles.statHoverWrap}
            >
              <button
                className={`${styles.actionBtn} ${liked ? styles.liked : ''}`}
                onClick={handleToggleLike}
                disabled={loadingLike}
                type="button"
              >
                <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
                <span
                  onMouseEnter={() => handleStatsMouseEnter('likes')}
                  onMouseLeave={handleStatsMouseLeave}
                  className={styles.statsText}
                >
                  {likeCount}
                </span>
              </button>

              {statsHoverType === 'likes' && (
                <div
                  className={`${styles.statsPopup} ${
                    statsPopupDirection === 'up' ? styles.statsPopupUp : styles.statsPopupDown
                  }`}
                  onMouseEnter={() => handleStatsMouseEnter('likes')}
                  onMouseLeave={handleStatsMouseLeave}
                >
                  {statsPopupLoading ? (
                    <div className={styles.statsPopupEmpty}>Đang tải...</div>
                  ) : statsPopupData.likes.length > 0 ? (
                    statsPopupData.likes.map((user) => (
                      <div key={user.user_id} className={styles.statsPopupItem}>
                        <div className={styles.statsPopupName}>
                          {user.username || user.user_id}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.statsPopupEmpty}>Chưa có lượt thích</div>
                  )}
                </div>
              )}
            </div>

            <div
              ref={(el) => { statRefs.current.comments = el }}
              className={styles.statHoverWrap}
            >
              <button
                className={styles.actionBtn}
                type="button"
                onClick={() => setShowCommentModal(true)}
              >
                <MessageCircle size={16} />
                <span
                  onMouseEnter={() => handleStatsMouseEnter('comments')}
                  onMouseLeave={handleStatsMouseLeave}
                  className={styles.statsText}
                >
                  {commentCount} Bình luận
                </span>
              </button>

              {statsHoverType === 'comments' && (
                <div
                  className={`${styles.statsPopup} ${
                    statsPopupDirection === 'up' ? styles.statsPopupUp : styles.statsPopupDown
                  }`}
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
              ref={(el) => { statRefs.current.shares = el }}
              className={styles.statHoverWrap}
            >
              <button
                className={styles.actionBtn}
                type="button"
                onClick={handleShare}
                disabled={loadingShare}
              >
                <Share2 size={16} />
                <span
                  onMouseEnter={() => handleStatsMouseEnter('shares')}
                  onMouseLeave={handleStatsMouseLeave}
                  className={styles.statsText}
                >
                  {shareCount} Chia sẻ
                </span>
              </button>

              {statsHoverType === 'shares' && (
                <div
                  className={`${styles.statsPopup} ${
                    statsPopupDirection === 'up' ? styles.statsPopupUp : styles.statsPopupDown
                  }`}
                  onMouseEnter={() => handleStatsMouseEnter('shares')}
                  onMouseLeave={handleStatsMouseLeave}
                >
                  {statsPopupLoading ? (
                    <div className={styles.statsPopupEmpty}>Đang tải...</div>
                  ) : statsPopupData.shares.length > 0 ? (
                    statsPopupData.shares.map((user) => (
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

            <button
              ref={saveBookmarkRef}
              type="button"
              className={`${styles.actionBtn} ${saved ? styles.saved : ''}`}
              onClick={handleToggleSave}
              disabled={loadingSave}
            >
              <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
              <span>{saved ? `${saveCount} Lưu` : `${saveCount} Lưu`}</span>
            </button>
          </div>
        </article>

        <ConfirmModal
          isOpen={modal.isOpen}
          type={modal.type}
          title={modal.title}
          message={modal.message}
          confirmText={modal.confirmText}
          cancelText={modal.cancelText}
          isDangerous={modal.isDangerous}
          inputValue={modal.inputValue}
          onInputChange={(value) => setModal((prev) => ({ ...prev, inputValue: value }))}
          onConfirm={() => {
            if (modal.type !== 'alert') {
              modal.onConfirm?.()
            }
          }}
          onCancel={closeModal}
        />

        {showCommentModal && (
          <CommentModal
            podcast={podcast}
            liked={liked}
            saved={saved}
            likeCount={likeCount}
            shareCount={shareCount}
            saveCount={saveCount}
            commentCount={commentCount}
            onClose={() => setShowCommentModal(false)}
            onCommentCountChange={setCommentCount}
            onToggleLike={handleToggleLike}
            onToggleSave={handleToggleSave}
            onShare={handleShare}
            onPostDeleted={() => {
              setShowCommentModal(false)
              onDelete?.(podcast.id)
            }}
          />
        )}

        {showShareModal && (
          <ShareModal
            podcast={podcast}
            onClose={() => setShowShareModal(false)}
            onShareSuccess={(data) => {
              setShareCount(Number(data?.share_count || shareCount + 1))
            }}
          />
        )}

        <SaveCollectionModal
          isOpen={showCollectionModal}
          onClose={() => setShowCollectionModal(false)}
          postId={podcast.id}
          onSave={handleCollectionModalSave}
          triggerRef={saveBookmarkRef}
          isPopup={true}
        />
      </>
    )
  }