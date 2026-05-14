import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "../../style/admin/admin-sidebar.css";
import logoImage from "../../assets/images/educast-logo.png";

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
    path: "/admin/content-moderation",
  },
  {
    label: "Kiểm duyệt báo cáo",
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
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const displayName = user?.display_name || user?.username || user?.email || "Admin";
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const handleLogout = async () => {
    try {
      await logout();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <aside className="admin-sidebar">
      <div className="admin-logo-wrap">
  <img
    src={logoImage}
    alt="EduCast Logo"
    className="admin-sidebar-logo-image"
    onClick={() => navigate("/admin")}
  />
</div>

      <nav className="admin-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`admin-nav-item ${isActive ? "admin-nav-item-active" : ""
                }`}
            >
              <Icon className="admin-nav-icon" size={16} strokeWidth={2} />
              <span className="admin-nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="admin-sidebar-footer">
        <button
          className="admin-collapse-btn"
          type="button"
          onClick={handleLogout}
        >
          <LogOut className="admin-nav-icon" size={16} strokeWidth={2} />
          <span>Đăng Xuất</span>
        </button>

        <div className="admin-profile">
          <div className="admin-avatar">{avatarLetter}</div>
          <div>
            <div className="admin-name">Quản trị viên</div>
            <div className="admin-role">{displayName}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}