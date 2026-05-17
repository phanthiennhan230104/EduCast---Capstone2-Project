import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import "../../style/admin/admin-users-page.css";
import { Search, Shield, BarChart3, Users as UsersIcon, UserCog, X } from "lucide-react";
import { apiRequest } from "../../utils/api";
import { getAdminOverview } from "../../utils/adminApi";
import notify from "../../utils/toast";

function formatJoinDate(dateString) {
  if (!dateString) return "-";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateTime(dateString) {
  if (!dateString) return "-";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatSubtitle() {
  const today = new Date();
  const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const dayName = days[today.getDay()];
  const date = String(today.getDate()).padStart(2, "0");
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  return `EduCast · ${dayName}, ${date} tháng ${month}, ${year}`;
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
    case "locked":
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

function UserDetailModal({ user, onClose }) {
  if (!user) return null;

  const status = mapStatus(user.status);

  return (
    <div className="admin-user-modal-overlay" onClick={onClose}>
      <div
        className="admin-user-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-user-modal-header">
          <h3>Thông tin người dùng</h3>
          <button className="admin-user-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="admin-user-modal-body">
          <div className="admin-user-modal-profile">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.display_name || user.username}
                className="admin-user-modal-avatar-image"
              />
            ) : (
              <div className="admin-user-modal-avatar-fallback">
                {getInitial(user.display_name || user.username || user.email)}
              </div>
            )}

            <div>
              <div className="admin-user-modal-name">
                {user.display_name || user.username || "Không có tên"}
              </div>
              <div className="admin-user-modal-email">{user.email || "-"}</div>
              <div className="admin-user-modal-badges">
                <span className={`admin-users-role admin-users-role-${user.role}`}>
                  {roleLabel(user.role)}
                </span>
                <span className={`admin-users-status admin-users-status-${status.type}`}>
                  {status.label}
                </span>
              </div>
            </div>
          </div>

          <div className="admin-user-modal-grid">
            <div className="admin-user-modal-item">
              <span>Email</span>
              <strong>{user.email || "-"}</strong>
            </div>

            <div className="admin-user-modal-item">
              <span>Username</span>
              <strong>{user.username || "-"}</strong>
            </div>

            <div className="admin-user-modal-item">
              <span>Vai trò</span>
              <strong>{roleLabel(user.role)}</strong>
            </div>

            <div className="admin-user-modal-item">
              <span>Đăng nhập gần nhất</span>
              <strong>{formatDateTime(user.last_login_at)}</strong>
            </div>

            <div className="admin-user-modal-item">
              <span>Ngày tạo tài khoản</span>
              <strong>{formatDateTime(user.created_at)}</strong>
            </div>


          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [onlineUsers, setOnlineUsers] = useState(0);
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
  const [selectedUser, setSelectedUser] = useState(null);
  const [usersPage, setUsersPage] = useState(1);
  const [showLockModal, setShowLockModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [lockForm, setLockForm] = useState({
    reason: "",
    preset: "24h",
    locked_until: "",
  });

  const [unlockForm, setUnlockForm] = useState({
    unlock_reason: "",
  });
  async function fetchAdminUsers() {
    try {
      setLoading(true);
      setError("");

      const [usersData, overviewData] = await Promise.all([
        apiRequest("/auth/admin/users/"),
        getAdminOverview(),
      ]);

      setUsers(usersData.users || []);

      const overviewUsers = overviewData?.overview?.users || {};
      setOnlineUsers(overviewUsers.active_users || 0);

      setStats({
        total_users:
          overviewUsers.total_users ??
          usersData.stats?.total_users ??
          0,

        total_admins:
          overviewUsers.total_admins ??
          usersData.stats?.total_admins ??
          0,

        total_active:
          overviewUsers.active_users ??
          usersData.stats?.total_active ??
          0,

        total_locked:
          overviewUsers.locked_users ??
          usersData.stats?.total_locked ??
          0,
      });
    } catch (err) {
      const message = err.message || "Không thể tải danh sách người dùng.";
      setError(message);
      notify.error(message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    fetchAdminUsers();

    const handleAdminUpdate = (event) => {
      console.log(" Admin update received in AdminUsersPage:", event.detail);
      const { type } = event.detail || {};
      if (type === "user_change" || type === "new_post" || type === "post_change") {
        fetchAdminUsers();
      }
    };

    window.addEventListener("admin-update", handleAdminUpdate);
    return () => {
      window.removeEventListener("admin-update", handleAdminUpdate);
    };
  }, []);

  function openLockModal(user) {
    setSelectedUser(user);
    setLockForm({
      reason: "",
      preset: "24h",
      locked_until: "",
    });
    setShowLockModal(true);
  }

  function openUnlockModal(user) {
    setSelectedUser(user);
    setUnlockForm({
      unlock_reason: "",
    });
    setShowUnlockModal(true);
  }

  function closeAllModals() {
    setShowLockModal(false);
    setShowUnlockModal(false);
    setSelectedUser(null);
    setLockForm({
      reason: "",
      preset: "24h",
      locked_until: "",
    });
    setUnlockForm({
      unlock_reason: "",
    });
  }

  async function handleLockUser() {
    if (!selectedUser) return;

    try {
      setActionLoading(true);
      setError("");

      const payload =
        lockForm.preset === "custom"
          ? {
            reason: lockForm.reason,
            preset: "custom",
            locked_until: lockForm.locked_until
              ? new Date(lockForm.locked_until).toISOString()
              : null,
          }
          : {
            reason: lockForm.reason,
            preset: lockForm.preset,
          };

      await apiRequest(`/auth/admin/users/${selectedUser.id}/lock/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      notify.success("Khóa người dùng thành công.");
      closeAllModals();
      await fetchAdminUsers();
    } catch (err) {
      const message = err.message || "Khóa người dùng thất bại.";
      setError(message);
      notify.error(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnlockUser() {
    if (!selectedUser) return;

    try {
      setActionLoading(true);
      setError("");

      await apiRequest(`/auth/admin/users/${selectedUser.id}/unlock/`, {
        method: "POST",
        body: JSON.stringify(unlockForm),
      });

      notify.success("Mở khóa người dùng thành công.");
      closeAllModals();
      await fetchAdminUsers();
    } catch (err) {
      const message = err.message || "Mở khóa người dùng thất bại.";
      setError(message);
      notify.error(message);
    } finally {
      setActionLoading(false);
    }
  }

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


  const USERS_PER_PAGE = 6;

  const totalUsersPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);

  const paginatedUsers = filteredUsers.slice(
    (usersPage - 1) * USERS_PER_PAGE,
    usersPage * USERS_PER_PAGE
  );
  return (
    <AdminLayout
      title="QUẢN LÝ NGƯỜI DÙNG"
      subtitle={formatSubtitle()}
      onlineUsers={onlineUsers}
    >
      <div className="admin-users-page">
        <div className="admin-users-topbar">
          <div className="admin-users-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Tìm kiếm người dùng"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setUsersPage(1);
              }}
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
                    <th>PODCAST</th>
                    <th>NGƯỜI THEO DÕI</th>
                    <th>TRẠNG THÁI</th>
                    <th>NGÀY THAM GIA</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedUsers.map((user) => {
                    const status = mapStatus(user.status);

                    return (
                      <tr key={user.id}>
                        <td>
                          <div className="admin-users-user-cell">
                            <div className="admin-users-avatar blue">
                              {user.avatar_url ? (
                                <img
                                  src={user.avatar_url}
                                  alt={user.display_name || user.username || "avatar"}
                                  className="admin-users-avatar-image"
                                />
                              ) : (
                                getInitial(user.display_name || user.username || user.email)
                              )}
                            </div>

                            <div className="admin-users-user-info">
                              <div className="admin-users-user-name">
                                {user.display_name || user.username}
                              </div>
                              <div className="admin-users-user-email">{user.email}</div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className={`admin-users-role admin-users-role-${user.role}`}>
                            {roleLabel(user.role)}
                          </span>
                        </td>

                        <td className="admin-users-center">
                          {user.podcast_count ?? 0}
                        </td>

                        <td className="admin-users-center">
                          {user.followers_count ?? 0}
                        </td>

                        <td>
                          <span className={`admin-users-status admin-users-status-${status.type}`}>
                            {status.label}
                          </span>
                        </td>

                        <td className="admin-users-date">
                          {formatJoinDate(user.created_at)}
                        </td>

                        <td>
                          <div className="admin-users-actions">
                            <button
                              className="admin-users-btn admin-users-btn-view"
                              onClick={() => setSelectedUser(user)}
                            >
                              Xem
                            </button>

                            <button
                              className={`admin-users-btn ${status.type === "locked"
                                ? "admin-users-btn-restore"
                                : "admin-users-btn-lock"
                                }`}
                              onClick={() =>
                                status.type === "locked"
                                  ? openUnlockModal(user)
                                  : openLockModal(user)
                              }
                            >
                              {status.type === "locked" ? "Khôi phục" : "Khóa"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredUsers.length > 0 && (
                <div className="admin-users-pagination">
                  {Array.from({ length: Math.max(totalUsersPages, 1) }, (_, index) => {
                    const page = index + 1;

                    return (
                      <button
                        key={page}
                        type="button"
                        className={`admin-users-page-btn ${usersPage === page ? "admin-users-page-btn-active" : ""
                          }`}
                        onClick={() => setUsersPage(page)}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {!showLockModal && !showUnlockModal && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
      {showLockModal && selectedUser && (
        <div className="admin-user-modal-overlay" onClick={closeAllModals}>
          <div className="admin-user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-user-modal-header">
              <h3>Khóa người dùng</h3>
              <button className="admin-user-modal-close" onClick={closeAllModals}>
                <X size={18} />
              </button>
            </div>

            <div className="admin-user-modal-body">
              <div className="admin-user-modal-item">
                <span>Người dùng</span>
                <strong>{selectedUser.display_name || selectedUser.username}</strong>
              </div>

              <div className="admin-form-group">
                <label>Lý do khóa</label>
                <textarea
                  value={lockForm.reason}
                  onChange={(e) => setLockForm({ ...lockForm, reason: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="admin-form-group">
                <label>Thời gian khóa</label>
                <select
                  value={lockForm.preset}
                  onChange={(e) =>
                    setLockForm({ ...lockForm, preset: e.target.value })
                  }
                >
                  <option value="24h">Khóa 24 giờ</option>
                  <option value="1d">Khóa 1 ngày</option>
                  <option value="3d">Khóa 3 ngày</option>
                  <option value="7d">Khóa 7 ngày</option>
                  <option value="permanent">Khóa vĩnh viễn</option>
                  <option value="custom">Chọn ngày giờ khác</option>
                </select>
              </div>

              {lockForm.preset === "custom" && (
                <div className="admin-form-group">
                  <label>Khóa đến</label>
                  <input
                    type="datetime-local"
                    value={lockForm.locked_until}
                    onChange={(e) =>
                      setLockForm({ ...lockForm, locked_until: e.target.value })
                    }
                  />
                </div>
              )}

              <div className="admin-users-actions">
                <button
                  className="admin-users-btn admin-users-btn-view"
                  onClick={closeAllModals}
                >
                  Hủy
                </button>
                <button
                  className="admin-users-btn admin-users-btn-lock"
                  onClick={handleLockUser}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Đang xử lý..." : "Xác nhận khóa"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showUnlockModal && selectedUser && (
        <div className="admin-user-modal-overlay" onClick={closeAllModals}>
          <div className="admin-user-modal admin-user-modal-lock" onClick={(e) => e.stopPropagation()}>
            <div className="admin-user-modal-header">
              <h3>Mở khóa người dùng</h3>
              <button className="admin-user-modal-close" onClick={closeAllModals}>
                <X size={18} />
              </button>
            </div>

            <div className="admin-user-modal-body">
              <div className="admin-user-modal-user-box">
                <span>Người dùng</span>
                <strong>{selectedUser.display_name || selectedUser.username}</strong>
              </div>

              <div className="admin-form-group">
                <label>Lý do mở khóa</label>
                <textarea
                  value={unlockForm.unlock_reason}
                  onChange={(e) =>
                    setUnlockForm({ ...unlockForm, unlock_reason: e.target.value })
                  }
                  rows={4}
                />
              </div>

              <div className="admin-user-modal-actions">
                <button
                  className="admin-users-btn admin-users-btn-view"
                  onClick={closeAllModals}
                >
                  Hủy
                </button>
                <button
                  className="admin-users-btn admin-users-btn-restore"
                  onClick={handleUnlockUser}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Đang xử lý..." : "Xác nhận mở khóa"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );

}
