import { useState } from "react";
import AdminLayout from "./AdminLayout";
import "../../style/admin/adminsystem.css";

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

function ToggleRow({ label, checked: initialChecked = false }) {
  const [checked, setChecked] = useState(initialChecked);

  return (
    <div className="adminsystem-row">
      <span className="adminsystem-row-label">{label}</span>

      <button
        type="button"
        className={`adminsystem-switch ${checked ? "is-on" : ""}`}
        onClick={() => setChecked((prev) => !prev)}
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
  return (
    <AdminLayout
      title="QUẢN LÝ HỆ THỐNG"
      subtitle={formatSubtitle()}
      onlineUsers={1255}
    >
      <div className="adminsystem-page">
        <Section title="CẤU HÌNH AI">
          <SettingRow label="Thời lượng Podcast tối đa" value="3 phút" />
          <SettingRow label="Mô hình giọng AI" value="ElevenLabs v2" />
          <SettingRow label="Độ nhạy kiểm duyệt tự động" value="Medium" />
        </Section>

        <Section title="QUY TẮC NỀN TẢNG">
          <SettingRow label="Độ tuổi tối thiểu" value="16" />
          <SettingRow label="Dung lượng tải lên tối đa" value="25 MB" />
          <SettingRow label="Ngưỡng báo cáo tự động đánh dấu" value="10" />
        </Section>

        <Section title="THÔNG BÁO">
          <ToggleRow label="Email quản trị khi có báo cáo mới" checked />
          <ToggleRow label="Báo cáo thống kê hằng ngày" checked />
          <ToggleRow label="Thông báo người dùng mới" checked={false} />
        </Section>
      </div>
    </AdminLayout>
  );
}