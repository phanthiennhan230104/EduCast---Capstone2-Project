import {
  ChevronLeft,
  LayoutDashboard,
  Users,
  ShieldCheck,
  BarChart3,
  Settings,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import "../../style/admin/admin-sidebar.css";

const menuItems = [
  {
    label: "Tổng quan",
    icon: LayoutDashboard,
    path: "/admin",
    
  },
  {
    label: "Quản lý người dùng",
    icon: Users,
    path: "/admin/users",
  },
  {
    label: "Kiểm duyệt nội dung",
    icon: ShieldCheck,
    path: "/admin/moderation",
  },
  {
    label: "Thống kê",
    icon: BarChart3,
    path: "/admin/stats",
  },
  {
    label: "Quản lý hệ thống",
    icon: Settings,
    path: "/admin/system",
  },
];

export default function AdminSidebar() {
  const location = useLocation();

  return (
    <aside className="admin-sidebar">
      <div className="admin-logo-wrap">
        <div className="admin-logo-circle">LOGO</div>
      </div>

      <nav className="admin-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`admin-nav-item ${isActive ? "admin-nav-item-active" : ""}`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="admin-sidebar-footer">
        <button className="admin-collapse-btn" type="button">
          <ChevronLeft size={16} />
          <span>Thu gọn</span>
        </button>

        <div className="admin-profile">
          <div className="admin-avatar">A</div>
          <div>
            <div className="admin-name">Quản trị viên</div>
            <div className="admin-role">Đạt Phạm</div>
          </div>
        </div>
      </div>
    </aside>
  );
}