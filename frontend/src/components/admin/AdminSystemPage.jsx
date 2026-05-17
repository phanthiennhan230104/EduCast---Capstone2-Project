import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import "../../style/admin/adminsystem.css";
import {
  getAdminSystemNotifications,
  updateAdminSystemNotifications,
  getAdminOverview,
} from "../../utils/adminApi";


function formatSubtitle() {
  const today = new Date();
  const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const dayName = days[today.getDay()];
  const date = String(today.getDate()).padStart(2, "0");
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  return `EduCast · ${dayName}, ${date} tháng ${month}, ${year}`;
}

function SettingRow({ label, value }) {
  return (
    <div className="adminsystem-row">
      <span className="adminsystem-row-label">{label}</span>
      <span className="adminsystem-chip">{value}</span>
    </div>
  );
}

function ToggleRow({ label, checked = false, disabled = false, onToggle }) {
  return (
    <div className="adminsystem-row">
      <span className="adminsystem-row-label">{label}</span>

      <button
        type="button"
        className={`adminsystem-switch ${checked ? "is-on" : ""}`}
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={checked}
      >
        <span className="adminsystem-switch-thumb" />
      </button>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="adminsystem-section">
      <div className="adminsystem-section-title">{title}</div>
      <div className="adminsystem-section-body">{children}</div>
    </section>
  );
}

export default function AdminSystemPage() {
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [notificationSettings, setNotificationSettings] = useState({
    email_admin_on_new_report: true,
    daily_statistics_report: true,
    notify_on_new_user: false,
  });

  const [savingNotificationKey, setSavingNotificationKey] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [notificationData, overviewData] = await Promise.all([
          getAdminSystemNotifications(),
          getAdminOverview(),
        ]);

        setNotificationSettings({
          email_admin_on_new_report: Boolean(notificationData.email_admin_on_new_report),
          daily_statistics_report: Boolean(notificationData.daily_statistics_report),
          notify_on_new_user: Boolean(notificationData.notify_on_new_user),
        });

        const overview = overviewData?.overview || overviewData?.data?.overview;
        setOnlineUsers(overview?.users?.active_users || 0);
      } catch (error) {
        console.error("Load admin system data error:", error);
      }
    };

    fetchData();
  }, []);

  const handleNotificationToggle = async (key) => {
    const oldValue = notificationSettings[key];
    const newValue = !oldValue;

    setNotificationSettings((prev) => ({
      ...prev,
      [key]: newValue,
    }));

    setSavingNotificationKey(key);

    try {
      await updateAdminSystemNotifications({
        [key]: newValue,
      });
    } catch (error) {
      console.error("Update admin notification setting error:", error);

      setNotificationSettings((prev) => ({
        ...prev,
        [key]: oldValue,
      }));

      alert(error.message || "Cập nhật thất bại");
    } finally {
      setSavingNotificationKey(null);
    }
  };

  return (
    <AdminLayout
      title="QUẢN LÝ HỆ THỐNG"
      subtitle={formatSubtitle()}
      onlineUsers={onlineUsers}
    >
      <div className="adminsystem-page">
        <Section title="CẤU HÌNH AI">
          <SettingRow label="Thời lượng Podcast tối đa" value="15 phút" />
          <SettingRow label="Mô hình giọng AI" value="Edge" />
          <SettingRow label="Độ nhạy kiểm duyệt tự động" value="Medium" />
        </Section>

        <Section title="QUY TẮC NỀN TẢNG">
          <SettingRow label="Nội dung phải được kiểm duyệt trước khi công khai" value="Bật" />
          <SettingRow label="Dung lượng tải lên tối đa" value="25 MB" />
          <SettingRow label="Nội dung phù hợp cho cộng đồng" value="Công khai" />
        </Section>

        <Section title="THÔNG BÁO">
          <ToggleRow
            label="Email quản trị khi có báo cáo mới"
            checked={notificationSettings.email_admin_on_new_report}
            disabled={savingNotificationKey === "email_admin_on_new_report"}
            onToggle={() => handleNotificationToggle("email_admin_on_new_report")}
          />

          <ToggleRow
            label="Báo cáo thống kê hằng ngày"
            checked={notificationSettings.daily_statistics_report}
            disabled={savingNotificationKey === "daily_statistics_report"}
            onToggle={() => handleNotificationToggle("daily_statistics_report")}
          />

          <ToggleRow
            label="Thông báo người dùng mới"
            checked={notificationSettings.notify_on_new_user}
            disabled={savingNotificationKey === "notify_on_new_user"}
            onToggle={() => handleNotificationToggle("notify_on_new_user")}
          />
        </Section>
      </div>
    </AdminLayout>
  );
}