import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from '../../style/feed/ConfirmModal.module.css'



export default function ConfirmModal({
  isOpen,
  title,
  message,
  type = 'confirm', 
  onConfirm,
  onCancel,
  inputValue = '',
  onInputChange,
  confirmText,
cancelText,
  isDangerous = false,
  isLoading = false,
  progress = 0,
}) {
  const { t } = useTranslation()
const finalConfirmText = confirmText || t('feed.confirm.defaultConfirm')
const finalCancelText = cancelText || t('feed.confirm.cancel') 
  console.log('ConfirmModal render:', { isOpen, isLoading, progress })
  if (!isOpen) return null

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
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.closeBtn} onClick={onCancel} aria-label={t('feed.confirm.close')}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.message}>{message}</p>
          {type === 'prompt' && (
            <input
              type="text"
              className={styles.input}
              value={inputValue}
              onChange={(e) => onInputChange?.(e.target.value)}
              placeholder={t('feed.confirm.inputPlaceholder')}
              autoFocus
            />
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onCancel} disabled={isLoading}>
            {finalCancelText}
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
            {finalConfirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
