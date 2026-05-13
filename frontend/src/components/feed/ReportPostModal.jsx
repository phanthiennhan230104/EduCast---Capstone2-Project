import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { X } from 'lucide-react'
import styles from '../../style/feed/PodcastCard.module.css'
import { API_BASE_URL } from '../../config/apiBase'
import { getToken, getCurrentUser } from '../../utils/auth'
import { useTranslation } from 'react-i18next'

function displayAuthorLabel(value, t) {
  if (value == null || value === '') return t('feed.anonymous')
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object') {
    const n = value.name || value.display_name || value.username
    if (n != null && String(n).trim()) return String(n).trim()
  }
  return t('feed.anonymous')
}

// const REPORT_REASONS = [
//   { value: 'spam', label: 'Spam' },
//   { value: 'inappropriate_content', label: 'Nội dung không phù hợp' },
//   { value: 'harassment', label: 'Quấy rối' },
//   { value: 'misinformation', label: 'Thông tin sai lệch' },
//   { value: 'copyright', label: 'Vi phạm bản quyền' },
//   { value: 'other', label: 'Khác' },
// ]

export default function ReportPostModal({
  postId,
  postTitle,
  authorId,
  authorName,
  onClose,
  onReportSuccess,
}) {
  const { t } = useTranslation()
  const authorLabel = displayAuthorLabel(authorName, t)

  const REPORT_REASONS = [
    { value: 'spam', label: t('feed.reportModal.reasons.spam') },
    { value: 'inappropriate_content', label: t('feed.reportModal.reasons.inappropriate_content') },
    { value: 'harassment', label: t('feed.reportModal.reasons.harassment') },
    { value: 'misinformation', label: t('feed.reportModal.reasons.misinformation') },
    { value: 'copyright', label: t('feed.reportModal.reasons.copyright') },
    { value: 'other', label: t('feed.reportModal.reasons.other') },
  ]

  const [selectedReason, setSelectedReason] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const currentUser = getCurrentUser()

  useEffect(() => {
    if (currentUser?.id && authorId != null && String(currentUser.id) === String(authorId)) {
      toast.error(t('feed.reportModal.ownPostError'))
      onClose()
    }
  }, [currentUser?.id, authorId, onClose])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedReason) {
      toast.error(t('feed.reportModal.requiredReason'))
      return
    }

    if (!description.trim()) {
      toast.error(t('feed.reportModal.descriptionMin'))
      return
    }

    if (description.trim().length < 10) {
      toast.error('Mô tả phải có ít nhất 10 ký tự')
      return
    }

    try {
      setLoading(true)

      const token = getToken()

      const res = await fetch(`${API_BASE_URL}/social/reports/create/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          user_id: currentUser?.id,
          target_type: 'post',
          target_id: postId,
          reason: selectedReason,
          description: description.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || `HTTP ${res.status}`)
      }

      toast.success(t('feed.reportModal.success'))
      setSelectedReason('')
      setDescription('')
      onClose()
      onReportSuccess?.()
    } catch (err) {
      console.error('Report failed:', err)
      toast.error(err.message || t('feed.reportModal.failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.reportOverlay} onClick={onClose}>
      <div className={styles.reportModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.reportHeader}>
          <h2>{t('feed.reportModal.title')}</h2>
          <button
            className={styles.reportCloseBtn}
            onClick={onClose}
            type="button"
            aria-label={t('feed.confirm.close')}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.reportForm}>
          <div className={styles.reportPostInfo}>
            <p className={styles.reportPostTitle}>
              <strong>{t('feed.reportModal.post')}</strong> {postTitle}
            </p>
            <p className={styles.reportPostAuthor}>
              <strong>{t('feed.reportModal.author')}</strong> {authorLabel}
            </p>
          </div>

          <div className={styles.reportFormGroup}>
            <label htmlFor="report-reason" className={styles.reportLabel}>
              {t('feed.reportModal.reasonLabel')} <span className={styles.reportRequired}>*</span>
            </label>
            <select
              id="report-reason"
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className={styles.reportSelect}
              disabled={loading}
            >
              <option value="">{t('feed.reportModal.reasonPlaceholder')}</option>
              {REPORT_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.reportFormGroup}>
            <label htmlFor="report-description" className={styles.reportLabel}>
              {t('feed.reportModal.descriptionLabel')} <span className={styles.reportRequired}>*</span>
            </label>
            <textarea
              id="report-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={styles.reportTextarea}
              placeholder={t('feed.reportModal.descriptionPlaceholder')}
              rows="4"
              disabled={loading}
            />
            <p className={styles.reportCharCount}>{description.length}/500</p>
          </div>

          <div className={styles.reportActions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.reportCancelBtn}
              disabled={loading}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className={styles.reportSubmitBtn}
              disabled={loading || !selectedReason || !description.trim()}
            >
              {loading ? t('feed.reportModal.submitting') : t('feed.reportModal.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
