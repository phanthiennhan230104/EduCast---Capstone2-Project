import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import styles from '../../style/feed/CreatePostBar.module.css'
import { getInitials } from '../../utils/getInitials'

export default function CreatePostBar() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [showDraftModal, setShowDraftModal] = useState(false)
  const [drafts, setDrafts] = useState([])
  const [loadingDrafts, setLoadingDrafts] = useState(false)
  const fileInputRef = useRef(null)

  // Load user info
  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      try {
        setUser(JSON.parse(userData))
      } catch (error) {
        console.error('Failed to parse user data:', error)
      }
    }
  }, [])

  // Load drafts
  const loadDrafts = async () => {
    try {
      setLoadingDrafts(true)
      const token = localStorage.getItem('educast_access')

      const res = await fetch('http://localhost:8000/api/content/drafts/my/', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) throw new Error('Failed to load drafts')

      const data = await res.json()
      const draftList = Array.isArray(data) ? data : data.results || data.data || []
      setDrafts(draftList.filter((d) => d?.id)) // Filter valid drafts
    } catch (error) {
      console.error('Load drafts error:', error)
      toast.error('Không tải được bản nháp')
    } finally {
      setLoadingDrafts(false)
    }
  }

  const handleDraftsClick = async () => {
    setShowDraftModal(true)
    await loadDrafts()
  }

  const handleDraftSelect = (draft) => {
    setShowDraftModal(false)
    navigate('/publish-post', {
      state: { draftData: draft },
    })
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      toast.error('Vui lòng chọn tệp audio')
      return
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('Tệp quá lớn. Tối đa 5MB')
      return
    }

    // For now, navigate to publish with file info
    // In a real app, you might upload to backend first
    const audioUrl = URL.createObjectURL(file)
    navigate('/publish-post', {
      state: {
        draftData: {
          title: '',
          description: '',
          audioUrl,
          fileName: file.name,
          fileSize: file.size,
          isDirectUpload: true,
        },
      },
    })
  }

  return (
    <>
      <div className={styles.createPostBar}>
        <div className={styles.container}>
          {/* User Avatar */}
          <div className={styles.avatar}>
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} />
            ) : (
              <div className={styles.avatarInitials}>
                {getInitials(user || 'A')}
              </div>
            )}
          </div>

          {/* Input and actions */}
          <div className={styles.content}>
            <div className={styles.inputWrapper}>
              <input
                type="text"
                className={styles.input}
                placeholder={`Tín gì nào, ${user?.name || 'bạn'}?`}
                readOnly
                onClick={() => navigate('/publish-post')}
              />
            </div>

            <div className={styles.actions}>
              <button
                className={styles.actionButton}
                onClick={handleUploadClick}
                title="Tải audio từ thiết bị"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 13v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6" />
                  <path d="M12 2v7M9 6l3 3 3-3" />
                </svg>
              </button>

              <button
                className={styles.actionButton}
                onClick={handleDraftsClick}
                title="Chọn từ bản nháp"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="19" x2="12" y2="13" />
                  <line x1="9" y1="16" x2="15" y2="16" />
                </svg>
              </button>

              <button
                className={styles.actionButton}
                onClick={() => navigate('/create')}
                title="Tạo audio mới"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Draft Selection Modal */}
      {showDraftModal && (
        <div className={styles.modalOverlay} onClick={() => setShowDraftModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Chọn bản nháp</h2>
              <button className={styles.closeButton} onClick={() => setShowDraftModal(false)}>
                ✕
              </button>
            </div>

            <div className={styles.modalContent}>
              {loadingDrafts ? (
                <div className={styles.loading}>Đang tải bản nháp...</div>
              ) : drafts.length === 0 ? (
                <div className={styles.empty}>
                  <p>Không có bản nháp nào</p>
                  <button
                    className={styles.createButton}
                    onClick={() => {
                      setShowDraftModal(false)
                      navigate('/create')
                    }}
                  >
                    + Tạo bản nháp mới
                  </button>
                </div>
              ) : (
                <div className={styles.draftsList}>
                  {drafts.map((draft) => (
                    <div
                      key={draft.id}
                      className={styles.draftItem}
                      onClick={() => handleDraftSelect(draft)}
                    >
                      <div className={styles.draftThumbnail}>
                        {draft.thumbnail_url ? (
                          <img src={draft.thumbnail_url} alt={draft.title} />
                        ) : (
                          <div className={styles.draftPlaceholder}>🎙️</div>
                        )}
                      </div>
                      <div className={styles.draftInfo}>
                        <h3 className={styles.draftTitle}>{draft.title || 'Không có tiêu đề'}</h3>
                        <p className={styles.draftStatus}>
                          {draft.status === 'draft'
                            ? 'Bản nháp'
                            : draft.status === 'processing'
                              ? 'Đang xử lý'
                              : draft.status === 'published'
                                ? 'Đã xuất bản'
                                : draft.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </>
  )
}
