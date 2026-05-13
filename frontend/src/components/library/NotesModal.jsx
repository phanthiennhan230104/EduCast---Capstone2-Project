import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import styles from '../../style/library/NotesModal.module.css'
import { getToken } from '../../utils/auth'

export default function NotesModal({ isOpen, onClose, post, onSaveNote, onNoteLoaded }) {
  const { t } = useTranslation()
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Khi modal mở, fetch ghi chú hiện tại
  useEffect(() => {
    if (isOpen && post) {
      setIsLoading(true)
      fetchNote(post.id)
    }
  }, [isOpen, post])

  const fetchNote = async (postId) => {
    try {
      const token = getToken()
      const response = await fetch(`http://127.0.0.1:8000/api/social/posts/${postId}/notes/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data.has_note) {
          setNotes(data.data.note_content || '')
          if (onNoteLoaded) onNoteLoaded(postId, true)
        } else {
          setNotes('')
          if (onNoteLoaded) onNoteLoaded(postId, false)
        }
      }
    } catch (err) {
      console.error(t('library.notes.fetchNoteFailed'), err)
      setNotes('')
      if (onNoteLoaded) onNoteLoaded(postId, false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!post) return

    setIsSaving(true)
    try {
      await onSaveNote(post.id, notes)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {t('library.notes.title', { title: post?.title })}
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t('library.close')}
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.body}>
          {isLoading ? (
            <div className={styles.loadingMessage}>{t('library.notes.loading')}</div>
          ) : (
            <>
              <textarea
                className={styles.textarea}
                placeholder={t('library.notes.placeholder')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
                disabled={isLoading}
              />
              <div className={styles.charCount}>
                {notes.length}/2000
              </div>
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.btnCancel}
            onClick={onClose}
            disabled={isSaving || isLoading}
          >
            {t('library.notes.cancel')}
          </button>
          <button
            type="button"
            className={styles.btnSave}
            onClick={handleSave}
            disabled={isSaving || isLoading}
          >
            {isSaving ? t('library.notes.saving') : t('library.notes.saveNote')}
          </button>
        </div>
      </div>
    </div>
  )
}
