import { useEffect, useState } from 'react';
import {
  Mic,
  Sparkles,
  Users,
  Flag,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import "../../style/admin/admin-page.css";
import { getAdminOverview } from "../../utils/adminApi";

function formatSubtitle() {
  const today = new Date();
  const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const dayName = days[today.getDay()];
  const date = String(today.getDate()).padStart(2, "0");
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  return `EduCast · ${dayName}, ${date} tháng ${month}, ${year}`;
}

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

function DonutChart({ data }) {
  const total = Object.values(data || {}).reduce((sum, val) => sum + val, 0);
  const entries = Object.entries(data || {}).map(([label, value]) => ({
    label,
    value,
    percentage: total > 0 ? ((value / total) * 100).toFixed(1) : 0,
  }));

  return (
    <div className="admin-donut-wrap">
      <div className="admin-donut-chart">
        <div className="admin-donut-inner" />
      </div>

      <div className="admin-donut-legend">
        {entries.slice(0, 5).map((item, idx) => (
          <div key={item.label} className="admin-legend-item">
            <span className={`admin-legend-dot admin-c${(idx % 5) + 1}`} />
            <span className="admin-legend-label">{item.label}</span>
            <span className="admin-legend-value">{item.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await getAdminOverview();
        setData(response.overview);
        setError(null);
      } catch (err) {
        setError(err.message || 'Lỗi khi tải dữ liệu');
        console.error('Error fetching admin data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <AdminLayout title="TỔNG QUAN" subtitle={formatSubtitle()}>
        <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
          Đang tải dữ liệu...
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="TỔNG QUAN" subtitle={formatSubtitle()}>
        <div style={{ padding: '40px', textAlign: 'center', color: '#e74c3c' }}>
          {error}
        </div>
      </AdminLayout>
    );
  }

  if (!data) {
    return (
      <AdminLayout title="TỔNG QUAN" subtitle={formatSubtitle()}>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          Không có dữ liệu
        </div>
      </AdminLayout>
    );
  }

  const statCards = [
    {
      title: "TỔNG NGƯỜI DÙNG",
      value: (data.users?.total_users || 0).toLocaleString('vi-VN'),
      change: "0%",
      note: "tổng người dùng",
      tone: "green",
      icon: Users,
    },
    {
      title: "PODCASTS ĐÃ TẠO",
      value: (data.posts?.total_posts || 0).toLocaleString('vi-VN'),
      change: "0%",
      note: "tổng nội dung",
      tone: "green",
      icon: Mic,
    },
    {
      title: "TẠO BẰNG AI",
      value: (data.posts?.ai_generated_posts || 0).toLocaleString('vi-VN'),
      change: "0%",
      note: "AI-generated",
      tone: "green",
      icon: Sparkles,
    },
    {
      title: "BÁO CÁO CHỜ DUYỆT",
      value: (data.moderation?.pending_reports || 0).toLocaleString('vi-VN'),
      change: "0%",
      note: "cần xử lý",
      tone: data.moderation?.pending_reports > 0 ? "red" : "green",
      icon: Flag,
    },
  ];

  const getWeeklyBars = () => {
    const days = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
    const maxValue = Math.max(
      ...(data.charts?.new_posts_7d || []).map(d => d.count),
      1
    );
    
    return (data.charts?.new_posts_7d || []).map((item, idx) => {
      const height = maxValue > 0 ? (item.count / maxValue) * 100 : 0;
      return {
        label: days[idx],
        height: Math.max(height, 10),
        active: idx === (data.charts?.new_posts_7d || []).length - 1,
        count: item.count,
      };
    });
  };

  const weeklyBars = getWeeklyBars();

  const topPosts = (data.top_posts || []).map((post, idx) => ({
    title: post.title,
    slug: post.slug,
    author: `Podcast #${idx + 1} • ${post.listen_count} lượt nghe`,
    tags: [
      { label: `👁️ ${post.view_count}`, type: "info" },
      { label: `❤️ ${post.like_count}`, type: "warning" },
      { label: `💬 ${post.comment_count}`, type: "dangerOutline" },
    ],
  }));

  return (
    <AdminLayout
      title="TỔNG QUAN"
      subtitle={formatSubtitle()}
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
                {(data.posts?.new_posts_30d || 0).toLocaleString('vi-VN')} <span>↑ {((data.posts?.new_posts_30d / (data.posts?.total_posts || 1)) * 100).toFixed(1)}%</span>
              </div>
            </div>
            <div className="admin-panel-date">7 ngày gần đây</div>
          </div>

          <div className="admin-weekly-chart">
            {weeklyBars.map((bar) => (
              <div key={bar.label} className="admin-week-bar-item" title={`${bar.label}: ${bar.count}`}>
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
          <div className="admin-panel-title">TRẠNG THÁI BÀI VIẾT</div>
          <DonutChart data={data.posts} />
        </article>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-title">TOP PODCASTS</div>

        <div className="admin-report-list">
          {topPosts.map((item) => (
            <div key={item.slug} className="admin-report-row">
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