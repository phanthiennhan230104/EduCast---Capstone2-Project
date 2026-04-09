import { useEffect, useRef, useState } from 'react'
import { Bell, X } from 'lucide-react'
import styles from '../../../style/layout/NotificationPanel.module.css'
import { getNotifications, markAllNotificationsAsRead } from '../../../utils/notificationApi'

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

function formatTime(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes}p`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`

  return date.toLocaleDateString('vi-VN')
}

export default function NotificationPanel() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef(null)

  // Fetch unread count on mount and periodically
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await getNotifications()
        setUnreadCount(response.data?.unread_count || 0)
      } catch (err) {
        console.error('Error fetching unread count:', err)
      }
    }

    fetchUnreadCount()

    // Poll every 10 seconds for new notifications
    const interval = setInterval(() => {
      if (!open) {
        fetchUnreadCount()
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [open])

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
    if (!open) return

    const fetchNotifications = async () => {
      setLoading(true)
      try {
        const response = await getNotifications()
        setNotifications(response.data?.notifications || [])
        // unreadCount already updated by polling
      } catch (err) {
        console.error('Error fetching notifications:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchNotifications()
  }, [open])

  const handleOpenPanel = async () => {
    setOpen(true)
    
    // Fetch notifications immediately for this panel
    const response = await getNotifications()
    setNotifications(response.data?.notifications || [])
    
    // Mark all as read when opening panel
    if (response.data?.unread_count > 0) {
      await markAllNotificationsAsRead()
      setUnreadCount(0)
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, is_read: true }))
      )
    }
  }

  return (
    <div ref={panelRef} className={styles.notificationWrap}>
      <button
        className={styles.bellBtn}
        aria-label="Thông báo"
        type="button"
        onClick={handleOpenPanel}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Thông báo</h3>
            <button
              className={styles.closeBtn}
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <div className={styles.panelBody}>
            {loading ? (
              <div className={styles.empty}>Đang tải...</div>
            ) : notifications.length === 0 ? (
              <div className={styles.empty}>Không có thông báo nào</div>
            ) : (
              <div className={styles.notificationList}>
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`${styles.notificationItem} ${
                      !notif.is_read ? styles.unread : ''
                    }`}
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
                        {formatTime(notif.created_at)}
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
