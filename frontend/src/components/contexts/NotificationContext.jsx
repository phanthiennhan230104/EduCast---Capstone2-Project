import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { getNotifications, markAllNotificationsAsRead } from '../../utils/notificationApi';
import { getToken } from '../../utils/auth';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const wsRef = useRef(null);

  const fetchUnreadCount = async () => {
    try {
      const response = await getNotifications();
      setUnreadCount(response.data?.unread_count || 0);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await getNotifications();
      setNotifications(response.data?.notifications || []);
      setUnreadCount(response.data?.unread_count || 0);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount > 0) {
      try {
        await markAllNotificationsAsRead();
        setUnreadCount(0);
        setNotifications(prev =>
          prev.map(notif => ({ ...notif, is_read: true }))
        );
      } catch (err) {
        console.error('Error marking notifications as read:', err);
      }
    }
  };

  const token = getToken();

  useEffect(() => {
    if (!token) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    fetchUnreadCount();

    const connectWS = () => {
      if (wsRef.current) wsRef.current.close();

      const wsUrl = `ws://127.0.0.1:8000/ws/notifications/?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_notification' && data.notification) {
            const newNotif = data.notification;
            setUnreadCount((prev) => prev + 1);
            setNotifications((prev) => [newNotif, ...prev]);

            if (newNotif.reference_type === 'post' && newNotif.post_counts) {
              const counts = newNotif.post_counts;
              const payload = {
                postId: String(newNotif.reference_id),
                likeCount: counts.like_count,
                commentCount: counts.comment_count,
                saveCount: counts.save_count,
                shareCount: counts.share_count,
              };
              window.dispatchEvent(new CustomEvent('post-sync-updated', { detail: payload }));

              if (newNotif.canonical_post_id) {
                window.dispatchEvent(new CustomEvent('post-sync-updated', {
                  detail: { ...payload, postId: String(newNotif.canonical_post_id) }
                }));
              }
            }
          } else if (data.type === 'social_update') {
            window.dispatchEvent(new CustomEvent('social-update', {
              detail: data.social_update
            }));
          }
        } catch (err) {
          console.error('Error parsing notification message', err);
        }
      };

      ws.onclose = () => {
        // Tự động kết nối lại sau 5 giây nếu bị ngắt và vẫn còn token
        if (getToken()) {
          setTimeout(connectWS, 5000);
        }
      };
    };

    connectWS();

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAllAsRead,
        setNotifications,
        setUnreadCount
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
