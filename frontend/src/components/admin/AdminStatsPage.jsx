import { BarChart3, Clock3, Sparkles, TrendingUp } from "lucide-react";
import AdminLayout from "./AdminLayout";
import "../../style/admin/admin-stats-page.css";

function formatSubtitle() {
  const today = new Date();
  const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const dayName = days[today.getDay()];
  const date = String(today.getDate()).padStart(2, "0");
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  return `EduCast · ${dayName}, ${date} tháng ${month}, ${year}`;
}

const mockData = {
  header: {
    title: "THỐNG KÊ",
    subtitle: formatSubtitle(),
    online_users: 1255,
  },
  overview: [
    {
      key: "avg_session",
      title: "THỜI GIAN PHIÊN TB",
      display_value: "14m 22s",
      change: 22.4,
    },
    {
      key: "completion_rate",
      title: "TỈ LỆ NGHE HẾT",
      display_value: "68.4%",
      change: 5.1,
    },
    {
      key: "ai_content_rate",
      title: "TỈ LỆ TẠO NỘI DUNG",
      display_value: "12.7%",
      change: 3.2,
    },
  ],
  topic_distribution: [
    { label: "Công Nghệ", percent: 22 },
    { label: "Ngôn Ngữ", percent: 18 },
    { label: "Kinh Doanh", percent: 14 },
    { label: "Khoa Học", percent: 12 },
    { label: "Nghệ Thuật", percent: 34 },
  ],
  daily_growth: {
    title: "TĂNG TRƯỞNG - NGƯỜI DÙNG HOẠT ĐỘNG MỚI NGÀY",
    week_range: "2-8 Tháng 3, 2026",
    total: 1500,
    growth_percent: 22.4,
    bars: [
      { label: "T2", value: 320 },
      { label: "T3", value: 480 },
      { label: "T4", value: 280 },
      { label: "T5", value: 760 },
      { label: "T6", value: 640 },
      { label: "T7", value: 500 },
      { label: "CN", value: 470, is_today: true },
    ],
  },
};

const BAR_TONES = ["gold", "cyan", "violet", "orange", "peach"];

function OverviewCard({ item, icon: Icon }) {
  return (
    <article className="admin-stats-card">
      <div className="admin-stats-card-top">
        <span className="admin-stats-card-title">{item.title}</span>
        <Icon size={16} className="admin-stats-card-icon" />
      </div>

      <div className="admin-stats-card-value">{item.display_value}</div>

      <div className="admin-stats-card-change-row">
        <span className="admin-stats-card-arrow">↑</span>
        <span className="admin-stats-card-change">{item.change}%</span>
        <span className="admin-stats-card-note">so với tuần trước</span>
      </div>
    </article>
  );
}

export default function AdminStatsPage() {
  const data = mockData;
  const overview = data.overview || [];
  const topicDistribution = data.topic_distribution || [];
  const dailyGrowth = data.daily_growth || { bars: [] };
  const maxBarValue = Math.max(
    ...(dailyGrowth.bars || []).map((item) => item.value || 0),
    1
  );

  return (
    <AdminLayout
      title={data.header.title}
      subtitle={data.header.subtitle}
      onlineUsers={data.header.online_users}
    >
      <div className="admin-stats-page">
        <section className="admin-stats-overview-grid">
          <OverviewCard
            item={overview[0] || { title: "THỜI GIAN PHIÊN TB", display_value: "0m 00s", change: 0 }}
            icon={Clock3}
          />
          <OverviewCard
            item={overview[1] || { title: "TỈ LỆ NGHE HẾT", display_value: "0%", change: 0 }}
            icon={BarChart3}
          />
          <OverviewCard
            item={overview[2] || { title: "TỈ LỆ TẠO NỘI DUNG", display_value: "0%", change: 0 }}
            icon={Sparkles}
          />
        </section>

        <section className="admin-stats-panel">
          <div className="admin-stats-panel-heading">
            PODCAST TẠO TRONG TUẦN THEO CHỦ ĐỀ
          </div>

          <div className="admin-topic-list">
            {topicDistribution.map((item, index) => (
              <div key={`${item.label}-${index}`} className="admin-topic-row">
                <div className="admin-topic-label">{item.label}</div>
                <div className="admin-topic-track">
                  <div
                    className={`admin-topic-fill admin-topic-fill-${BAR_TONES[index % BAR_TONES.length]}`}
                    style={{ width: `${Math.max(item.percent || 0, 6)}%` }}
                  />
                </div>
                <div
                  className={`admin-topic-percent admin-topic-percent-${BAR_TONES[index % BAR_TONES.length]}`}
                >
                  {item.percent}%
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-stats-panel admin-stats-growth-panel">
          <div className="admin-stats-growth-header">
            <div>
              <div className="admin-stats-panel-heading">{dailyGrowth.title}</div>
              <div className="admin-stats-growth-number-row">
                <strong>{(dailyGrowth.total || 0).toLocaleString("vi-VN")}</strong>
                <span>
                  <TrendingUp size={16} /> {dailyGrowth.growth_percent || 0}%
                </span>
              </div>
            </div>

            <div className="admin-stats-growth-range">{dailyGrowth.week_range}</div>
          </div>

          <div className="admin-stats-growth-chart">
            {(dailyGrowth.bars || []).map((item) => (
              <div key={item.label} className="admin-stats-growth-item">
                <div
                  className={`admin-stats-growth-bar ${item.is_today ? "admin-stats-growth-bar-active" : ""}`}
                  style={{
                    height: `${Math.max(
                      ((item.value || 0) / maxBarValue) * 100,
                      item.value ? 26 : 14
                    )}px`,
                  }}
                  title={`${item.label}: ${item.value}`}
                />
                <span className="admin-stats-growth-label">{item.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}