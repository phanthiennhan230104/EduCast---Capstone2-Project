import { X } from 'lucide-react'
import styles from '../../style/feed/ConfirmModal.module.css'

/** Tránh crash khi caller nhầm truyền object (vd. author) thay vì chuỗi. */
function toModalText(value, fallback = '') {
  if (value == null || value === '') return fallback
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (typeof value === 'object') {
    const label =
      value.name ??
      value.display_name ??
      value.username ??
      value.title ??
      null
    if (label != null && label !== '') return String(label)
    try {
      return JSON.stringify(value)
    } catch {
      return fallback
    }
  }
  return String(value)
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  type = 'confirm', 
  onConfirm,
  onCancel,
  inputValue = '',
  onInputChange,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  isDangerous = false,
  isLoading = false,
  progress = 0,
}) {
  if (!isOpen) return null

  const safeTitle = toModalText(title, 'Xác nhận')
  const safeMessage = toModalText(message, '')
  const safeConfirm = toModalText(confirmText, 'Xác nhận')
  const safeCancel = toModalText(cancelText, 'Hủy')

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {isLoading && (
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill}
              style={{
                width: `${progress}%`,
                backgroundColor: '#ff7b7b'
              }}
            />
          </div>
        )}
        <div className={styles.header}>
          <h2 className={styles.title}>{safeTitle}</h2>
          <button className={styles.closeBtn} onClick={onCancel} aria-label="Đóng">
            <X size={20} />
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.message}>{safeMessage}</p>
          {type === 'prompt' && (
            <input
              type="text"
              className={styles.input}
              value={inputValue}
              onChange={(e) => onInputChange?.(e.target.value)}
              placeholder="Nhập nội dung..."
              autoFocus
            />
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onCancel} disabled={isLoading}>
            {safeCancel}
          </button>
          <button
            className={`${styles.confirmBtn} ${isDangerous ? styles.danger : ''}`}
            onClick={() => {
              if (type === 'alert') {
                onCancel()
              } else {
                if (!isLoading) onConfirm()
              }
            }}
            disabled={isLoading}
          >
            {safeConfirm}
          </button>
        </div>
      </div>
    </div>
  )
}
