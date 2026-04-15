import { Bell, Circle } from "lucide-react";
import "../../style/admin/admin-header.css";

export default function AdminHeader({
  title = "TỔNG QUAN",
  subtitle = "EduCast · Chủ Nhật, 08 tháng 3, 2026",
  onlineUsers = 1255,
}) {
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

        <button className="admin-icon-btn" type="button" aria-label="Thông báo">
          <Bell size={16} />
          <span className="admin-notification-dot" />
        </button>

        <button className="admin-icon-btn" type="button" aria-label="Chế độ">
          <Circle size={16} />
        </button>

        <button className="admin-lang-btn" type="button" aria-label="Ngôn ngữ">
          <span className="admin-flag-box">🇻🇳</span>
        </button>
      </div>
    </header>
  );
}