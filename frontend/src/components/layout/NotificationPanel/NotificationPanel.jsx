import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNotifications } from '../../contexts/NotificationContext'
import styles from '../../../style/layout/NotificationPanel.module.css'

function getNotificationIcon(type) {
  switch (type) {
    case 'follow':
      return '👤'
    case 'like':
      return '❤️'
    case 'comment':
      return '💬'
    case 'share':
      return '📤'
    default:
      return '📢'
  }
}

function formatTime(dateString, t, i18n) {
  if (!dateString) return ''

  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return t('notification.justNow')
  if (minutes < 60) return t('notification.minutesShort', { count: minutes })
  if (hours < 24) return t('notification.hoursShort', { count: hours })
  if (days < 7) return t('notification.daysShort', { count: days })

  return date.toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'vi-VN')
}

export default function NotificationPanel() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const { notifications, unreadCount, loading, fetchNotifications, markAllAsRead } = useNotifications()
  const panelRef = useRef(null)


  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      fetchNotifications()
    }
  }, [open])

  const handleTogglePanel = async (e) => {
    e.stopPropagation()
    const nextOpen = !open
    setOpen(nextOpen)

    if (nextOpen) {
      await fetchNotifications()
      if (unreadCount > 0) {
        await markAllAsRead()
      }
    }
  }

  const handleNotificationClick = (notif) => {
    // Chúng ta chỉ xử lý click cho các loại liên quan đến bài viết
    if (['like', 'comment', 'share', 'new_post'].includes(notif.type) && notif.reference_id) {
      // Bắn một Custom Event để các trang (Feed, PersonalPage) có thể lắng nghe và mở Modal
      const event = new CustomEvent('openPostModal', {
        detail: {
          postId: notif.reference_id,
          notifType: notif.type
        }
      })
      window.dispatchEvent(event)
      setOpen(false) // Đóng panel sau khi click
    }
  }

  return (
    <div ref={panelRef} className={styles.notificationWrap}>
      <button
        className={styles.bellBtn}
        aria-label={t('notification.ariaLabel')}
        type="button"
        onClick={handleTogglePanel}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>{t('notification.title')}</h3>
          </div>

          <div className={styles.panelBody}>
            {loading ? (
              <div className={styles.empty}>{t('notification.loading')}</div>
            ) : notifications.length === 0 ? (
              <div className={styles.empty}>{t('notification.empty')}</div>
            ) : (
              <div className={styles.notificationList}>
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`${styles.notificationItem} ${!notif.is_read ? styles.unread : ''
                      } ${notif.reference_id ? styles.clickable : ''}`}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <div className={styles.notificationIcon}>
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className={styles.notificationContent}>
                      <div className={styles.notificationTitle}>
                        {notif.title}
                      </div>
                      <div className={styles.notificationBody}>
                        {notif.body}
                      </div>
                      <div className={styles.notificationTime}>
                        {formatTime(notif.created_at, t, i18n)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
