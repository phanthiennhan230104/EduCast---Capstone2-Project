import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import styles from '../../style/feed/CreatePostBar.module.css'
import { getInitials } from '../../utils/getInitials'
import { getToken } from '../../utils/auth'
import { API_BASE_URL } from '../../config/apiBase'
import { useAuth } from '../contexts/AuthContext'
import { useTranslation } from 'react-i18next'

export default function CreatePostBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [showDraftModal, setShowDraftModal] = useState(false)
  const [drafts, setDrafts] = useState([])
  const [loadingDrafts, setLoadingDrafts] = useState(false)
  const fileInputRef = useRef(null)

  const displayName =
    user?.full_name ||
    user?.name ||
    user?.display_name ||
    user?.username ||
    t('createPostBar.you')

  const avatarFallback = getInitials(user)

  const loadDrafts = async () => {
    try {
      setLoadingDrafts(true)
      const token = getToken()

      const res = await fetch(`${API_BASE_URL}/content/drafts/my/`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) throw new Error('Failed to load drafts')

      const data = await res.json()
      const draftList = Array.isArray(data)
        ? data
        : data.results || data.data || []

      setDrafts(draftList.filter((d) => d?.id))
    } catch (error) {
      console.error('Load drafts error:', error)
      toast.error(t('createPostBar.loadDraftsFailed'))
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

    if (!file.type.startsWith('audio/')) {
      toast.error(t('createPostBar.selectAudioFile'))
      return
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error(t('createPostBar.fileTooLarge'))
      return
    }

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
          <div className={styles.avatar}>
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={displayName}
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  e.currentTarget.nextElementSibling.style.display = 'flex'
                }}
              />
            ) : null}

            <div
              className={styles.avatarInitials}
              style={{ display: user?.avatar_url ? 'none' : 'flex' }}
            >
              {avatarFallback}
            </div>
          </div>

          <div className={styles.content}>
            <div className={styles.inputWrapper}>
              <input
                type="text"
                className={styles.input}
                placeholder={t('createPostBar.placeholder', { name: displayName })}
                readOnly
                onClick={() => navigate('/publish-post')}
              />
            </div>

            <div className={styles.actions}>
              <button
                className={styles.actionButton}
                onClick={handleUploadClick}
                title={t('createPostBar.uploadAudioTitle')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 13v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6" />
                  <path d="M12 2v7M9 6l3 3 3-3" />
                </svg>
              </button>

              <button
                className={styles.actionButton}
                onClick={handleDraftsClick}
                title={t('createPostBar.chooseDraftTitle')}
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
                title={t('createPostBar.createAudioTitle')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showDraftModal && (
        <div className={styles.modalOverlay} onClick={() => setShowDraftModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{t('createPostBar.chooseDraft')}</h2>
              <button className={styles.closeButton} onClick={() => setShowDraftModal(false)}>
                ✕
              </button>
            </div>

            <div className={styles.modalContent}>
              {loadingDrafts ? (
                <div className={styles.loading}>{t('createPostBar.loadingDrafts')}</div>
              ) : drafts.length === 0 ? (
                <div className={styles.empty}>
                  <p>{t('createPostBar.noDrafts')}</p>
                  <button
                    className={styles.createButton}
                    onClick={() => {
                      setShowDraftModal(false)
                      navigate('/create')
                    }}
                  >
                    {t('createPostBar.createNewDraft')}
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
                          <img src={draft.thumbnail_url} alt={draft.title || t('createPostBar.untitledDraft')} />
                        ) : (
                          <div className={styles.draftPlaceholder}>🎙️</div>
                        )}
                      </div>

                      <div className={styles.draftInfo}>
                        <h3 className={styles.draftTitle}>
                          {draft.title || t('createPostBar.untitledDraft')}
                        </h3>
                        <p className={styles.draftStatus}>
                          {t(`createPostBar.status.${draft.status}`, { defaultValue: draft.status })}
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