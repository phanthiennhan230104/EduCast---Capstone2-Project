import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { X } from 'lucide-react'
import styles from '../../style/feed/PodcastCard.module.css'
import { API_BASE_URL } from '../../config/apiBase'
import { getToken, getCurrentUser } from '../../utils/auth'

function displayAuthorLabel(value) {
  if (value == null || value === '') return 'Ẩn danh'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object') {
    const n = value.name || value.display_name || value.username
    if (n != null && String(n).trim()) return String(n).trim()
  }
  return 'Ẩn danh'
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'inappropriate_content', label: 'Nội dung không phù hợp' },
  { value: 'harassment', label: 'Quấy rối' },
  { value: 'misinformation', label: 'Thông tin sai lệch' },
  { value: 'copyright', label: 'Vi phạm bản quyền' },
  { value: 'other', label: 'Khác' },
]

export default function ReportPostModal({
  postId,
  postTitle,
  authorId,
  authorName,
  onClose,
  onReportSuccess,
}) {
  const authorLabel = displayAuthorLabel(authorName)
  const [selectedReason, setSelectedReason] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const currentUser = getCurrentUser()

  useEffect(() => {
    if (currentUser?.id && authorId != null && String(currentUser.id) === String(authorId)) {
      toast.error('Bạn không thể báo cáo bài viết của chính mình.')
      onClose()
    }
  }, [currentUser?.id, authorId, onClose])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedReason) {
      toast.error('Vui lòng chọn lý do báo cáo')
      return
    }

    if (!description.trim()) {
      toast.error('Vui lòng nhập mô tả chi tiết')
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

      toast.success('Báo cáo đã gửi thành công!')
      setSelectedReason('')
      setDescription('')
      onClose()
      onReportSuccess?.()
    } catch (err) {
      console.error('Report failed:', err)
      toast.error(err.message || 'Báo cáo thất bại. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.reportOverlay} onClick={onClose}>
      <div className={styles.reportModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.reportHeader}>
          <h2>Báo cáo bài viết</h2>
          <button
            className={styles.reportCloseBtn}
            onClick={onClose}
            type="button"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.reportForm}>
          <div className={styles.reportPostInfo}>
            <p className={styles.reportPostTitle}>
              <strong>Bài viết:</strong> {postTitle}
            </p>
            <p className={styles.reportPostAuthor}>
              <strong>Tác giả:</strong> {authorLabel}
            </p>
          </div>

          <div className={styles.reportFormGroup}>
            <label htmlFor="report-reason" className={styles.reportLabel}>
              Lý do báo cáo <span className={styles.reportRequired}>*</span>
            </label>
            <select
              id="report-reason"
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className={styles.reportSelect}
              disabled={loading}
            >
              <option value="">-- Chọn lý do --</option>
              {REPORT_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.reportFormGroup}>
            <label htmlFor="report-description" className={styles.reportLabel}>
              Mô tả chi tiết <span className={styles.reportRequired}>*</span>
            </label>
            <textarea
              id="report-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={styles.reportTextarea}
              placeholder="Hãy cho chúng tôi biết tại sao bạn báo cáo bài viết này..."
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
              Hủy
            </button>
            <button
              type="submit"
              className={styles.reportSubmitBtn}
              disabled={loading || !selectedReason || !description.trim()}
            >
              {loading ? 'Đang gửi...' : 'Gửi báo cáo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
