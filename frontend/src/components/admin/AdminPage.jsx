import {
  Mic,
  Sparkles,
  Users,
  Flag,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import "../../style/admin/admin-page.css";

const statCards = [
  {
    title: "TỔNG NGƯỜI DÙNG",
    value: "1,500",
    change: "22.4%",
    note: "so với tuần trước",
    tone: "green",
    icon: Users,
    
  },
  {
    title: "PODCASTS ĐÃ TẠO",
    value: "500",
    change: "22.4%",
    note: "so với tuần trước",
    tone: "green",
    icon: Mic,
  },
  {
    title: "TẠO BẰNG AI",
    value: "200",
    change: "22.4%",
    note: "so với tuần trước",
    tone: "green",
    icon: Sparkles,
  },
  {
    title: "BÁO CÁO CHỜ DUYỆT",
    value: "3",
    change: "22.4%",
    note: "so với tuần trước",
    tone: "red",
    icon: Flag,
  },
];

const weeklyBars = [
  { label: "T2", height: 30, active: false },
  { label: "T3", height: 46, active: false },
  { label: "T4", height: 28, active: false },
  { label: "T5", height: 44, active: false },
  { label: "T6", height: 62, active: false },
  { label: "T7", height: 72, active: false },
  { label: "CN", height: 44, active: true },
];

const recentReports = [
  {
    title: "Học lập trình Python cơ bản",
    author: "bởi Minh Hoàng • 2 phút trước",
    tags: [
      { label: "Spam", type: "danger" },
      { label: "Chờ duyệt", type: "warning" },
      { label: "# 12", type: "dangerOutline" },
    ],
  },
  {
    title: "Tài chính cá nhân cho sinh viên",
    author: "bởi Thanh Tâm • 30 phút trước",
    tags: [
      { label: "Misleading", type: "danger" },
      { label: "Chờ duyệt", type: "warning" },
      { label: "# 7", type: "dangerOutline" },
    ],
  },
  {
    title: "English Speaking Practice #5",
    author: "bởi Tiến Tin • 2 giờ trước",
    tags: [
      { label: "Off-topic", type: "danger" },
      { label: "Đã duyệt", type: "success" },
      { label: "# 3", type: "dangerOutline" },
    ],
  },
];

function MiniTrend({ tone = "green" }) {
  return (
    <div className={`admin-mini-trend ${tone === "red" ? "admin-red" : "admin-green"}`}>
      <span style={{ height: 14 }} />
      <span style={{ height: 11 }} />
      <span style={{ height: 24 }} />
      <span style={{ height: 19 }} />
      <span style={{ height: 37 }} />
      <span style={{ height: 35 }} />
      <span style={{ height: 49 }} />
      <span style={{ height: 54 }} />
    </div>
  );
}

function DonutChart() {
  return (
    <div className="admin-donut-wrap">
      <div className="admin-donut-chart">
        <div className="admin-donut-inner" />
      </div>

      <div className="admin-donut-legend">
        <div className="admin-legend-item">
          <span className="admin-legend-dot admin-c1" />
          <span className="admin-legend-label">Công Nghệ</span>
          <span className="admin-legend-value">22%</span>
        </div>
        <div className="admin-legend-item">
          <span className="admin-legend-dot admin-c2" />
          <span className="admin-legend-label">Ngôn Ngữ</span>
          <span className="admin-legend-value">18%</span>
        </div>
        <div className="admin-legend-item">
          <span className="admin-legend-dot admin-c3" />
          <span className="admin-legend-label">Kinh Doanh</span>
          <span className="admin-legend-value">14%</span>
        </div>
        <div className="admin-legend-item">
          <span className="admin-legend-dot admin-c4" />
          <span className="admin-legend-label">Khoa Học</span>
          <span className="admin-legend-value">12%</span>
        </div>
        <div className="admin-legend-item">
          <span className="admin-legend-dot admin-c5" />
          <span className="admin-legend-label">Nghệ Thuật</span>
          <span className="admin-legend-value">34%</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminLayout
      title="TỔNG QUAN"
      subtitle="EduCast · Chủ Nhật, 08 tháng 3, 2026"
    >
      <section className="admin-stats-grid">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} className="admin-stat-card">
              <div className="admin-stat-top">
                <span className="admin-stat-title">{card.title}</span>
                <Icon size={14} className="admin-stat-top-icon" />
              </div>

              <div className="admin-stat-value">{card.value}</div>

              <div className="admin-stat-bottom">
                <div className="admin-stat-change-block">
                  <span
                    className={`admin-stat-arrow ${
                      card.tone === "red" ? "admin-red-text" : "admin-green-text"
                    }`}
                  >
                    ↑
                  </span>
                  <span
                    className={`admin-stat-change ${
                      card.tone === "red" ? "admin-red-text" : "admin-green-text"
                    }`}
                  >
                    {card.change}
                  </span>
                  <span className="admin-stat-note">{card.note}</span>
                </div>

                <MiniTrend tone={card.tone} />
              </div>
            </article>
          );
        })}
      </section>

      <section className="admin-middle-grid">
        <article className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <div className="admin-panel-title">PODCAST MỚI TRONG TUẦN</div>
              <div className="admin-panel-big-number">
                1,500 <span>↑ 22,4%</span>
              </div>
            </div>
            <div className="admin-panel-date">2-8 Tháng 3, 2026</div>
          </div>

          <div className="admin-weekly-chart">
            {weeklyBars.map((bar) => (
              <div key={bar.label} className="admin-week-bar-item">
                <div
                  className={`admin-week-bar ${bar.active ? "admin-week-bar-active" : ""}`}
                  style={{ height: `${bar.height}px` }}
                />
                <span className="admin-week-label">{bar.label}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="admin-panel">
          <div className="admin-panel-title">PHÂN LOẠI NỘI DUNG</div>
          <DonutChart />
        </article>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-title">NỘI DUNG ĐƯỢC BÁO CÁO GẦN ĐÂY</div>

        <div className="admin-report-list">
          {recentReports.map((item) => (
            <div key={item.title} className="admin-report-row">
              <div className="admin-report-left">
                <div className="admin-report-icon">
                  <Mic size={14} />
                </div>

                <div>
                  <div className="admin-report-title">{item.title}</div>
                  <div className="admin-report-meta">{item.author}</div>
                </div>
              </div>

              <div className="admin-report-tags">
                {item.tags.map((tag) => (
                  <span key={tag.label} className={`admin-tag admin-tag-${tag.type}`}>
                    {tag.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </AdminLayout>
  );
}