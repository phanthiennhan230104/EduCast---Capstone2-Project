import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import "../../style/admin/admin-users-page.css";
import { Search, Shield, BarChart3, Users as UsersIcon, UserCog } from "lucide-react";
import { apiRequest } from "../../utils/api";

function formatJoinDate(dateString) {
  if (!dateString) return "-";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function getInitial(value = "U") {
  return value.trim().charAt(0).toUpperCase() || "U";
}

function mapStatus(status) {
  switch (status) {
    case "active":
      return { label: "Hoạt động", type: "active" };
    case "inactive":
      return { label: "Không hoạt động", type: "inactive" };
    case "suspended":
    case "banned":
      return { label: "Đã khóa", type: "locked" };
    default:
      return { label: status || "Không rõ", type: "inactive" };
  }
}

function roleLabel(role) {
  return role === "admin" ? "Admin" : "User";
}

function StatBox({ icon: Icon, label, value }) {
  return (
    <div className="admin-users-stat-box">
      <div className="admin-users-stat-icon">
        <Icon size={14} />
      </div>
      <div>
        <div className="admin-users-stat-label">{label}</div>
        <div className="admin-users-stat-value">{value}</div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    total_users: 0,
    total_admins: 0,
    total_active: 0,
    total_locked: 0,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function fetchAdminUsers() {
      try {
        setLoading(true);
        setError("");
        const data = await apiRequest("/auth/admin/users/");

        if (!mounted) return;
        setUsers(data.users || []);
        setStats(data.stats || {});
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Không thể tải danh sách người dùng.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchAdminUsers();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return users;

    return users.filter((user) => {
      const name = (user.display_name || "").toLowerCase();
      const email = (user.email || "").toLowerCase();
      const username = (user.username || "").toLowerCase();
      return name.includes(keyword) || email.includes(keyword) || username.includes(keyword);
    });
  }, [search, users]);

  return (
    <AdminLayout
      title="QUẢN LÝ NGƯỜI DÙNG"
      subtitle="Chỉ tài khoản admin mới có thể truy cập trang này"
    >
      <div className="admin-users-page">
        <div className="admin-users-topbar">
          <div className="admin-users-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Tìm kiếm người dùng"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="admin-users-stats-row">
          <StatBox icon={UsersIcon} label="Tổng người dùng" value={stats.total_users ?? 0} />
          <StatBox icon={UserCog} label="Quản trị viên" value={stats.total_admins ?? 0} />
          <StatBox icon={Shield} label="Tài khoản khóa" value={stats.total_locked ?? 0} />
          <StatBox icon={BarChart3} label="Đang hoạt động" value={stats.total_active ?? 0} />
        </div>

        <section className="admin-users-table-card">
          {loading ? (
            <div style={{ padding: 16 }}>Đang tải dữ liệu người dùng...</div>
          ) : error ? (
            <div style={{ padding: 16, color: "#ff6b6b" }}>{error}</div>
          ) : (
            <div className="admin-users-table-wrap">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>NGƯỜI DÙNG</th>
                    <th>VAI TRÒ</th>
                    <th>TRẠNG THÁI</th>
                    <th>XÁC THỰC</th>
                    <th>ĐĂNG NHẬP GẦN NHẤT</th>
                    <th>NGÀY THAM GIA</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((user) => {
                    const status = mapStatus(user.status);
                    return (
                      <tr key={user.id}>
                        <td>
                          <div className="admin-users-user-cell">
                            <div className="admin-users-avatar blue">
                              {getInitial(user.display_name || user.username || user.email)}
                            </div>

                            <div className="admin-users-user-info">
                              <div className="admin-users-user-name">{user.display_name || user.username}</div>
                              <div className="admin-users-user-email">{user.email}</div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className={`admin-users-role admin-users-role-${user.role}`}>
                            {roleLabel(user.role)}
                          </span>
                        </td>

                        <td>
                          <span className={`admin-users-status admin-users-status-${status.type}`}>
                            {status.label}
                          </span>
                        </td>

                        <td className="admin-users-center">
                          {user.is_verified ? "Đã xác thực" : "Chưa xác thực"}
                        </td>
                        <td className="admin-users-date">
                          {user.last_login_at ? new Date(user.last_login_at).toLocaleString("vi-VN") : "-"}
                        </td>
                        <td className="admin-users-date">{formatJoinDate(user.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}