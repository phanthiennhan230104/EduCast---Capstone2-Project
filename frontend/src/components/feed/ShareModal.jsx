import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { toast } from 'react-toastify'
import { createPortal } from 'react-dom'
import styles from '../../style/feed/ShareModal.module.css'
import { getToken, getCurrentUser } from '../../utils/auth'
import { getInitials } from '../../utils/getInitials'

export default function ShareModal({ podcast, onClose, onShareSuccess }) {
  const [caption, setCaption] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [friends, setFriends] = useState([])
  const [selectedFriends, setSelectedFriends] = useState(new Set())
  const [loadingFriends, setLoadingFriends] = useState(false)

  const currentUser = getCurrentUser()
  const inputRef = useRef(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }, [])

  useEffect(() => {
    fetchFriends()
  }, [])

  const fetchFriends = async () => {
    try {
      setLoadingFriends(true)

      const token = getToken()
      const res = await fetch('http://localhost:8000/api/social/friends/', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || `HTTP ${res.status}`)
      }

      setFriends(data.data?.friends || [])
    } catch (err) {
      console.error('Fetch friends failed:', err)
      toast.error('Lỗi khi tải danh sách bạn bè')
    } finally {
      setLoadingFriends(false)
    }
  }

  const toggleFriendSelection = (userId) => {
    setSelectedFriends((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const handleSendToFriends = async () => {
    if (selectedFriends.size === 0) {
        toast.error('Vui lòng chọn ít nhất một người để gửi')
        return
    }

    const normalizedRecipientIds = Array.from(selectedFriends)
      .map((v) => (v == null ? '' : String(v).trim()))
      .filter(Boolean)

    if (normalizedRecipientIds.length === 0) {
      console.warn('Share aborted: no valid recipient IDs', {
        selectedFriends: Array.from(selectedFriends),
      })
      toast.error('Không tìm thấy người nhận hợp lệ')
      return
    }

    try {
        setSubmitting(true)

        const token = getToken()

        const res = await fetch(`http://localhost:8000/api/social/posts/${podcast.id}/share-to-user/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              target_user_ids: normalizedRecipientIds,
                caption: caption || undefined,
            }),
        })

        const data = await res.json()

        if (!res.ok || !data?.success) {
            console.error('Share failed:', data)
            const errorFromResults = Array.isArray(data?.data?.results)
              ? data.data.results.find((r) => !r?.success)?.error
              : null
            toast.error(errorFromResults || data.message || 'Gửi podcast thất bại')
            return
        }

        const results = Array.isArray(data.data?.results) ? data.data.results : []
        const successResults = results.filter((r) => r?.success)
        const failedResults = results.filter((r) => !r?.success)

        if (successResults.length === 0) {
          const firstError = failedResults[0]?.error
          toast.error(firstError || 'Không gửi được cho người nhận nào')
          return
        }

        toast.success(`Đã gửi cho ${successResults.length} người`)
        if (failedResults.length > 0) {
          toast.warning(`Không gửi được ${failedResults.length} người`)
        }

        const successResult = successResults[0]

        window.dispatchEvent(new CustomEvent('chat-message-sent', {
          detail: {
            roomId: successResult?.room_id,
            roomIds: successResults.map((r) => r.room_id).filter(Boolean),
          },
        }))
        setCaption('')
        setSelectedFriends(new Set())
        onClose()
    } catch (err) {
        console.error('Send failed:', err)
        toast.error('Gửi tin nhắn thất bại')
    } finally {
        setSubmitting(false)
    }
    }

  const handleShareToPersonal = async (e) => {
    e.preventDefault()

    try {
        setSubmitting(true)

        const token = getToken()
        const res = await fetch(
        `http://localhost:8000/api/social/posts/${podcast.id}/share/`,
        {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
            user_id: currentUser?.id,
            share_type: 'personal',
            caption: caption.trim() || null,
            }),
        }
        )

        const data = await res.json()
        if (!res.ok || !data.success) {
        throw new Error(data.message || `HTTP ${res.status}`)
        }

        toast.success('Chia sẻ bài viết về trang cá nhân thành công!')
        setCaption('')
        onClose()
        onShareSuccess?.(data.data)
    } catch (err) {
        console.error('Share failed:', err)
        toast.error(err.message || 'Chia sẻ bài viết thất bại')
    } finally {
        setSubmitting(false)
    }
  }

  const mainModal = createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.topBar}>
          <h2 className={styles.modalTitle}>Chia sẻ</h2>
          <button className={styles.closeBtn} type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.postPreview}>
            <div className={styles.postHeader}>
              <div className={styles.authorBlock}>
                <div className={styles.avatar}>
                  {getInitials({
                    username: podcast.authorUsername,
                    display_name: podcast.author,
                  })}
                </div>
                <div>
                  <div className={styles.author}>{podcast.author}</div>
                  <div className={styles.meta}>{podcast.timeAgo}</div>
                </div>
              </div>
            </div>

            <div className={styles.postBody}>
              <h3 className={styles.title}>{podcast.title}</h3>
              {podcast.description && (
                <p className={styles.description}>{podcast.description}</p>
              )}
              {/* {podcast.cover && (
                <img
                  src={podcast.cover}
                  alt={podcast.title}
                  className={styles.cover}
                />
              )} */}
            </div>
          </div>

          <form className={styles.shareForm} onSubmit={(e) => { e.preventDefault()}}>
            <div className={styles.textareaWrapper}>
              <div className={styles.textareaContainer}>
                <textarea
                  ref={inputRef}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Hãy nói gì đó về nội dung này..."
                  className={styles.textarea}
                  maxLength={500}
                />
              </div>
            </div>

            <div className={styles.charCount}>
              {caption.length}/500
            </div>

            <div className={styles.friendsSection}>
              <div className={styles.friendsTitle}>Chọn người nhận</div>

              {loadingFriends ? (
                <div className={styles.loadingText}>Đang tải danh sách bạn bè...</div>
              ) : friends.length === 0 ? (
                <div className={styles.emptyText}>Bạn chưa có bạn bè</div>
              ) : (
                <div className={styles.friendsCarousel}>
                  {friends.map((friend) => {
                    const recipientId = friend.id || friend.user_id || friend.username
                    const isSelf =
                      String(recipientId || '') === String(currentUser?.id || '') ||
                      String(friend.username || '') === String(currentUser?.username || '')

                    if (isSelf) return null
                    if (!recipientId) return null

                    return (
                    <button
                      key={recipientId}
                      type="button"
                      className={`${styles.friendCard} ${
                        selectedFriends.has(recipientId) ? styles.friendCardSelected : ''
                      }`}
                      onClick={() => toggleFriendSelection(recipientId)}
                    >
                      <div className={styles.friendAvatar}>
                        {getInitials({
                          username: friend.username,
                          display_name: friend.display_name,
                        })}
                      </div>
                      <span className={styles.friendName}>
                        {friend.display_name || friend.username}
                      </span>
                      {selectedFriends.has(recipientId) && (
                        <div className={styles.friendCheckmark}>✓</div>
                      )}
                    </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className={styles.primaryActions}>
                {selectedFriends.size === 0 ? (
                  <button
                    type="button"
                    className={styles.shareBtn}
                    onClick={handleShareToPersonal}
                    disabled={submitting}
                  >
                    {submitting ? 'Đang chia sẻ...' : 'Chia sẻ ngay'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.sendBtn}
                    onClick={handleSendToFriends}
                    disabled={submitting}
                  >
                    {submitting ? 'Đang gửi...' : 'Gửi'}
                  </button>
                )}
            </div>

                <div className={styles.actions}>
                <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={onClose}
                    disabled={submitting}
                >
                    Hủy
                </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  )

  return mainModal
}