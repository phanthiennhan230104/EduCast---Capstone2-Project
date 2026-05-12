import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { toast } from 'react-toastify'
import styles from '../../style/feed/ShareModal.module.css'
import { API_BASE_URL } from '../../config/apiBase'
import { getToken } from '../../utils/auth'

const MAX = 500

export default function EditShareCaptionModal({
  isOpen,
  compositeRowId,
  initialCaption = '',
  onClose,
  onSaved,
}) {
  const [caption, setCaption] = useState(initialCaption || '')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setCaption(initialCaption || '')
    }
  }, [isOpen, initialCaption])

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  if (!isOpen || !compositeRowId) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = caption.trim()
    if (trimmed.length > MAX) {
      toast.error(`Mô tả tối đa ${MAX} ký tự`)
      return
    }

    try {
      setSubmitting(true)
      const token = getToken()
      const url = `${API_BASE_URL}/social/posts/${encodeURIComponent(
        String(compositeRowId).trim()
      )}/share-caption/`
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ caption: trimmed || null }),
      })
      let data = {}
      try {
        data = await res.json()
      } catch {
        data = {}
      }
      if (!res.ok || !data.success) {
        throw new Error(data.message || `HTTP ${res.status}`)
      }
      const next = data.data?.caption != null ? String(data.data.caption) : trimmed
      onSaved?.(next)
      onClose?.()
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Không lưu được mô tả chia sẻ')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(ev) => ev.stopPropagation()}>
        <div className={styles.topBar}>
          <h2 className={styles.modalTitle}>Mô tả khi chia sẻ</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        <form className={styles.shareForm} onSubmit={handleSubmit}>
          <p
            style={{
              margin: '0 0 12px',
              fontSize: 13,
              color: '#94a3b8',
              lineHeight: 1.45,
            }}
          >
            Chỉnh sửa lời nhắn hiển thị trên bài chia sẻ của bạn.
          </p>

          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#e5e7eb',
              marginBottom: 6,
            }}
          >
            Nội dung
          </div>

          <div className={styles.textareaWrapper}>
            <div className={styles.textareaContainer}>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Viết vài dòng về bài này…"
                className={styles.textarea}
                maxLength={MAX}
                rows={5}
                autoFocus
                style={{ resize: 'vertical', maxHeight: 280 }}
              />
            </div>
          </div>

          <div className={styles.charCount}>
            {caption.length}/{MAX}
          </div>

          <div className={styles.primaryActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={submitting}
            >
              Hủy
            </button>
            <button type="submit" className={styles.shareBtn} disabled={submitting}>
              {submitting ? 'Đang lưu…' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
