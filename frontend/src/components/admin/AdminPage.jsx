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



function DonutChart({ data }) {
  const labelMap = {
    draft_posts: 'Bản nháp',
    processing_posts: 'Chờ duyệt',
    published_posts: 'Đã đăng',
    failed_posts: 'Lỗi',
    archived_posts: 'Đã lưu trữ',
    hidden_posts: 'Đã ẩn',
  };

  const colors = [
  '#f2b233', // vàng - Bản nháp
  '#19c7b3', // xanh ngọc - Chờ duyệt
  '#7c5cff', // tím xanh - Đã đăng
  '#ff4d5c', // đỏ - Lỗi
  '#b998ff', // tím nhạt - Đã lưu trữ
  '#4facfe', // xanh dương - Đã ẩn
];

  const chartKeys = [
    'draft_posts',
    'processing_posts',
    'published_posts',
    'failed_posts',
    'archived_posts',
    'hidden_posts',
  ];

  const filteredData = chartKeys.map((key) => [
    key,
    Number(data?.[key] || 0),
  ]);

  const total = filteredData.reduce((sum, [, value]) => sum + value, 0);

  const entries = filteredData.map(([key, value], idx) => ({
    label: labelMap[key],
    value,
    color: colors[idx],
    percentage: total > 0 ? ((value / total) * 100).toFixed(1) : '0.0',
  }));

  let currentDegree = 0;

  const gradientParts = entries
    .filter((item) => item.value > 0)
    .map((item) => {
      const degree = total > 0 ? (item.value / total) * 360 : 0;
      const start = currentDegree;
      const end = currentDegree + degree;

      currentDegree = end;

      return `${item.color} ${start}deg ${end}deg`;
    });

  const donutBackground =
    gradientParts.length > 0
      ? `conic-gradient(${gradientParts.join(', ')})`
      : 'rgba(255, 255, 255, 0.08)';

  return (
    <div className="admin-donut-wrap">
      <div
        className="admin-donut-chart"
        style={{ background: donutBackground }}
      >
        <div className="admin-donut-inner" />
      </div>

      <div className="admin-donut-legend">
        {entries.map((item) => (
          <div key={item.label} className="admin-legend-item">
            <span
              className="admin-legend-dot"
              style={{ background: item.color }}
            />
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
  const [topPostsPage, setTopPostsPage] = useState(1);

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
      icon: Users,
    },
    {
      title: "PODCASTS ĐÃ TẠO",
      value: (data.posts?.total_posts || 0).toLocaleString('vi-VN'),
      tone: "green",
      icon: Mic,
    },
    {
      title: "TẠO BẰNG AI",
      value: (data.posts?.ai_generated_posts || 0).toLocaleString('vi-VN'),
      tone: "green",
      icon: Sparkles,
    },
    {
      title: "BÁO CÁO CHỜ DUYỆT",
      value: (data.moderation?.pending_reports || 0).toLocaleString('vi-VN'),
      tone: data.moderation?.pending_reports > 0 ? "red" : "green",
      icon: Flag,
    },
  ];
  const newPosts7d = data.charts?.new_posts_7d || []

  const totalNewPosts7d = newPosts7d.reduce(
    (sum, item) => sum + (item.count || 0),
    0
  )

  const getWeeklyBars = () => {
    const weekdayLabels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
    // Map by day of week: 0=CN, 1=T2, ..., 6=T7
    const dayMap = {}
    const todayDayOfWeek = new Date().getDay()

    newPosts7d.forEach((item) => {
      const date = new Date(item.date)
      if (!Number.isNaN(date.getTime())) {
        dayMap[date.getDay()] = item.count || 0
      }
    })

    // Order: T2(1), T3(2), T4(3), T5(4), T6(5), T7(6), CN(0)
    const orderedDays = [1, 2, 3, 4, 5, 6, 0]

    const maxValue = Math.max(
      ...orderedDays.map((d) => dayMap[d] || 0),
      1
    )

    return orderedDays.map((dayIdx) => {
      const count = dayMap[dayIdx] !== undefined ? dayMap[dayIdx] : 0
      const height = maxValue > 0 ? (count / maxValue) * 100 : 0

      return {
        label: weekdayLabels[dayIdx],
        height: count ? Math.max(height, 10) : 6,
        active: dayIdx === todayDayOfWeek,
        count,
      }
    })
  }

  const weeklyBars = getWeeklyBars();

  const topPosts = data.top_posts || [];

  const TOP_POSTS_PER_PAGE = 5;
  const totalTopPostsPages = Math.ceil(topPosts.length / TOP_POSTS_PER_PAGE);

  const paginatedTopPosts = topPosts.slice(
    (topPostsPage - 1) * TOP_POSTS_PER_PAGE,
    topPostsPage * TOP_POSTS_PER_PAGE
  );

  return (
    <AdminLayout
      title="TỔNG QUAN"
      subtitle={formatSubtitle()}
      onlineUsers={data.users?.active_users || 0}
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

              <div className="admin-stat-bottom" />
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
                {totalNewPosts7d.toLocaleString("vi-VN")}
              </div>
            </div>
            <div className="admin-panel-date">Tuần này</div>
          </div>

          <div className="admin-weekly-chart">
            {weeklyBars.map((bar) => (
              <div key={bar.label} className="admin-week-bar-item" title={`${bar.label}: ${bar.count}`}>
                <span className="admin-week-count">{bar.count}</span>
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
          {paginatedTopPosts.map((post, index) => {
  const rank = (topPostsPage - 1) * TOP_POSTS_PER_PAGE + index + 1;

  return (
    <div key={post.slug || post.id} className="admin-report-row">
      <div className="admin-report-left">
        <div className="admin-report-icon">
          <Mic size={14} />
        </div>

        <div>
          <div className="admin-report-title">{post.title}</div>
          <div className="admin-report-meta">
            Podcast #{rank} • {post.listen_count || 0} lượt nghe
          </div>
        </div>
      </div>

      <div className="admin-report-tags">
        <span className="admin-tag admin-tag-warning">
          ❤️ {post.like_count || 0}
        </span>
        <span className="admin-tag admin-tag-dangerOutline">
          💬 {post.comment_count || 0}
        </span>
      </div>
    </div>
  );
})}
        </div>


        <div className="admin-pagination">
          {Array.from({ length: Math.max(totalTopPostsPages, 1) }, (_, index) => {
            const page = index + 1;

            return (
              <button
                key={page}
                type="button"
                className={`admin-page-btn ${topPostsPage === page ? "admin-page-btn-active" : ""
                  }`}
                onClick={() => setTopPostsPage(page)}
              >
                {page}
              </button>
            );
          })}
        </div>

      </section>
    </AdminLayout>
  );
}