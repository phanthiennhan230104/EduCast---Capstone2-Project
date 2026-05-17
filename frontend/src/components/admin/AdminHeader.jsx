import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import "../../style/admin/admin-header.css";

const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api/content`;

function getStorageValue(key) {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
}

function getAccessToken() {
  const directToken =
    getStorageValue("access") ||
    getStorageValue("access_token") ||
    getStorageValue("educast_access") ||
    getStorageValue("token") ||
    getStorageValue("jwt") ||
    getStorageValue("authToken");

  if (directToken) {
    return directToken;
  }

  const possibleUserKeys = [
    "user",
    "educast_user",
    "auth_user",
    "auth",
    "educast_auth",
  ];

  for (const key of possibleUserKeys) {
    try {
      const raw = getStorageValue(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);

      const nestedToken =
        parsed?.access ||
        parsed?.access_token ||
        parsed?.token ||
        parsed?.jwt ||
        parsed?.authToken;

      if (nestedToken) {
        return nestedToken;
      }
    } catch {
      // ignore invalid JSON
    }
  }

  return null;
}

export default function AdminHeader({
  title = "TỔNG QUAN",
  subtitle = "EduCast · Chủ Nhật, 08 tháng 3, 2026",
  onlineUsers = 1255,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const dropdownRef = useRef(null);

  const fetchUnreadCount = async () => {
    try {
      const token = getAccessToken();

      console.log("ADMIN NOTI TOKEN:", token);

      const response = await fetch(
        `${API_BASE_URL}/admin/notifications/unread-count/`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      const text = await response.text();
      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      console.log("UNREAD COUNT STATUS:", response.status);
      console.log("UNREAD COUNT DATA:", data);

      if (!response.ok) {
        setNotificationError(
          data.detail || data.error || `Lỗi unread-count: ${response.status}`
        );
        setUnreadCount(0);
        return;
      }

      setUnreadCount(Number(data.unread_count || 0));
      setNotificationError("");
    } catch (error) {
      console.error("Fetch unread notification count failed:", error);
      setNotificationError(error.message || "Không tải được số thông báo.");
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setNotificationError("");

      const token = getAccessToken();

      const response = await fetch(
        `${API_BASE_URL}/admin/notifications/?page=1&page_size=10`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      const text = await response.text();
      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      console.log("NOTIFICATIONS STATUS:", response.status);
      console.log("NOTIFICATIONS DATA:", data);

      if (!response.ok) {
        throw new Error(
          data.detail || data.error || `Không tải được thông báo: ${response.status}`
        );
      }

      setNotifications(data.notifications || []);
      setNotificationError("");
    } catch (error) {
      console.error("Fetch admin notifications failed:", error);
      setNotificationError(error.message || "Không tải được thông báo.");
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleNotifications = async () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen) {
      await fetchNotifications();
      await fetchUnreadCount();
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const token = getAccessToken();

      const response = await fetch(
        `${API_BASE_URL}/admin/notifications/${notificationId}/read/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      const text = await response.text();
      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      console.log("MARK READ STATUS:", response.status);
      console.log("MARK READ DATA:", data);

      if (!response.ok) {
        throw new Error(data.detail || data.error || "Không đánh dấu đã đọc được.");
      }

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId ? { ...item, is_read: true } : item
        )
      );

      await fetchUnreadCount();
    } catch (error) {
      console.error("Mark notification as read failed:", error);
      setNotificationError(error.message || "Không đánh dấu đã đọc được.");
    }
  };

  useEffect(() => {
    fetchUnreadCount();

    const intervalId = setInterval(() => {
      fetchUnreadCount();
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header className="admin-header">
      <div>
        <h1 className="admin-title">{title}</h1>
        <p className="admin-subtitle">{subtitle}</p>
      </div>

      <div className="admin-header-right">
        <div className="admin-online-pill">
          • {Number(onlineUsers || 0).toLocaleString("vi-VN")} online
        </div>

        <div className="admin-notification-wrap" ref={dropdownRef}>
          <button
            className="admin-icon-btn"
            type="button"
            aria-label="Thông báo"
            onClick={handleToggleNotifications}
          >
            <Bell size={16} />

            {unreadCount > 0 && (
              <>
                <span className="admin-notification-dot" />
                <span className="admin-notification-count">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              </>
            )}
          </button>

          {isOpen && (
            <div className="admin-notification-dropdown">
              <div className="admin-notification-dropdown-header">
                <strong>Thông báo</strong>
                <span>{unreadCount} chưa đọc</span>
              </div>

              {notificationError && (
                <div className="admin-notification-empty">
                  {notificationError}
                </div>
              )}

              {!notificationError && loading && (
                <div className="admin-notification-empty">
                  Đang tải thông báo...
                </div>
              )}

              {!notificationError && !loading && notifications.length === 0 && (
                <div className="admin-notification-empty">
                  Chưa có thông báo mới.
                </div>
              )}

              {!notificationError &&
                !loading &&
                notifications.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`admin-notification-item ${
                      item.is_read ? "" : "unread"
                    }`}
                    onClick={() => {
                      markAsRead(item.id);
                      if (item.type === 'report_update') {
                        window.location.href = '/admin/moderation';
                      } else if (item.type === 'new_post') {
                        window.location.href = '/admin/content-moderation';
                      }
                    }}
                  >
                    <div className="admin-notification-item-title">
                      {item.title || "Thông báo mới"}
                    </div>

                    <div className="admin-notification-item-body">
                      {item.body || "Có bài đăng mới cần kiểm tra."}
                    </div>

                    <div className="admin-notification-item-time">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleString("vi-VN")
                        : ""}
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}