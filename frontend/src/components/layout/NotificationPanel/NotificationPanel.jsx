import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import styles from '../../../style/layout/NotificationPanel.module.css'
import { getNotifications, markAllNotificationsAsRead } from '../../../utils/notificationApi'
import { getToken } from '../../../utils/auth'

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
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef(null)

  // Fetch unread count on mount and connect WebSocket
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

    const token = getToken()
    if (!token) return

    const wsUrl = `ws://127.0.0.1:8000/ws/notifications/?token=${token}`
    const ws = new WebSocket(wsUrl)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'new_notification' && data.notification) {
          const newNotif = data.notification
          setUnreadCount((prev) => prev + 1)
          
          setNotifications((prev) => {
            if (prev.length > 0) {
              return [newNotif, ...prev]
            }
            return prev
          })
        } else if (data.type === 'social_update') {
          // Broadcast social updates (like follow/unfollow) to other components
          window.dispatchEvent(new CustomEvent('social-update', { 
            detail: data.social_update 
          }));
        }
      } catch (err) {
        console.error('Error parsing notification message', err)
      }
    }

    return () => {
      ws.close()
    }
  }, [])

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

  const handleTogglePanel = async (e) => {
    e.stopPropagation()
    setOpen(!open)
    
    if (!open) {
      // Khi mở panel, fetch notifications và mark as read
      const response = await getNotifications()
      setNotifications(response.data?.notifications || [])
      
      if (response.data?.unread_count > 0) {
        await markAllNotificationsAsRead()
        setUnreadCount(0)
        setNotifications(prev =>
          prev.map(notif => ({ ...notif, is_read: true }))
        )
      }
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
