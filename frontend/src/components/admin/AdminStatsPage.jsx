import { useEffect, useState } from "react"
import { BarChart3, Clock3, Sparkles, TrendingUp } from "lucide-react"
import AdminLayout from "./AdminLayout"
import { getAdminOverview } from "../../utils/adminApi"
import { toast } from "react-toastify"
import "../../style/admin/admin-stats-page.css"

function formatSubtitle() {
  const today = new Date()
  const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"]
  const dayName = days[today.getDay()]
  const date = String(today.getDate()).padStart(2, "0")
  const month = today.getMonth() + 1
  const year = today.getFullYear()
  return `EduCast · ${dayName}, ${date} tháng ${month}, ${year}`
}

const mockData = {
  header: {
    title: "THỐNG KÊ",
    subtitle: formatSubtitle(),
    online_users: 0,
  },
  overview: [
    {
      key: "avg_session",
      title: "THỜI GIAN PHIÊN TB",
      display_value: "0m 00s",
      change: 0,
    },
    {
      key: "completion_rate",
      title: "TỈ LỆ NGHE HẾT",
      display_value: "0%",
      change: 0,
    },
    {
      key: "ai_content_rate",
      title: "TỈ LỆ TẠO NỘI DUNG",
      display_value: "0%",
      change: 0,
    },
  ],
  post_distribution: [],
  daily_growth: {
    title: "TĂNG TRƯỞNG - NGƯỜI DÙNG HOẠT ĐỘNG MỚI NGÀY",
    week_range: "Đang tải...",
    total: 0,
    growth_percent: 0,
    bars: Array(7).fill(null).map((_, i) => ({ label: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"][i], value: 0 })),
  },
}

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
  const [data, setData] = useState(mockData)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAdminStats()
  }, [])

  const fetchAdminStats = async () => {
    try {
      setLoading(true)

      const response = await getAdminOverview()
      const overview = response?.overview || response?.data?.overview

      if (!overview) {
        throw new Error("Dữ liệu thống kê không hợp lệ")
      }

      const totalPosts = overview.posts?.total_posts || 0
      const aiPosts = overview.posts?.ai_generated_posts || 0
      const totalListens = overview.engagement?.total_listens || 0
      const totalViews = overview.engagement?.total_views || 0

      const avgCompletion =
        totalViews > 0 ? ((totalListens / totalViews) * 100).toFixed(1) : 0

      const aiContentRate =
        totalPosts > 0 ? ((aiPosts / totalPosts) * 100).toFixed(1) : 0

      const overviewCards = [
        {
          key: "total_posts",
          title: "TỔNG PODCAST",
          display_value: totalPosts.toLocaleString("vi-VN"),
          change: (
            ((overview.posts?.new_posts_30d || 0) / Math.max(totalPosts, 1)) *
            100
          ).toFixed(1),
        },
        {
          key: "completion_rate",
          title: "TỈ LỆ NGHE / XEM",
          display_value: `${avgCompletion}%`,
          change: 0,
        },
        {
          key: "ai_content_rate",
          title: "TỈ LỆ AI TẠO",
          display_value: `${aiContentRate}%`,
          change: 0,
        },
      ]

      const newUsers7d = overview.charts?.new_users_7d || []

      const weekdayLabels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]

      const today = new Date()
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

      const bars = newUsers7d.map((item, index) => {
        const date = new Date(item.date)
        const label = Number.isNaN(date.getTime())
          ? `Ngày ${index + 1}`
          : weekdayLabels[date.getDay()]

        return {
          label,
          value: item.count || 0,
          is_today: item.date === todayKey,
        }
      })

      const totalNewUsers = bars.reduce((sum, item) => sum + item.value, 0)

      const firstDate = newUsers7d[0]?.date ? new Date(newUsers7d[0].date) : new Date()
      const lastDate = newUsers7d[newUsers7d.length - 1]?.date
        ? new Date(newUsers7d[newUsers7d.length - 1].date)
        : new Date()

      const dateRange = `${firstDate.getDate()} - ${lastDate.getDate()} tháng ${lastDate.getMonth() + 1
        }, ${lastDate.getFullYear()}`

      setData({
        header: {
          title: "THỐNG KÊ",
          subtitle: formatSubtitle(),
          online_users: overview.users?.active_users || 0,
        },
        overview: overviewCards,
        post_distribution: [
          {
            label: "Công Khai",
            percent: Math.round(
              ((overview.posts?.public_posts || 0) / Math.max(totalPosts, 1)) * 100
            ),
          },
          {
            label: "Riêng Tư",
            percent: Math.round(
              ((overview.posts?.private_posts || 0) / Math.max(totalPosts, 1)) * 100
            ),
          },
          {
            label: "Không Liệt Kê",
            percent: Math.round(
              ((overview.posts?.unlisted_posts || 0) / Math.max(totalPosts, 1)) * 100
            ),
          },
          {
            label: "Xuất Bản",
            percent: Math.round(
              ((overview.posts?.published_posts || 0) / Math.max(totalPosts, 1)) * 100
            ),
          },
          {
            label: "Nháp",
            percent: Math.round(
              ((overview.posts?.draft_posts || 0) / Math.max(totalPosts, 1)) * 100
            ),
          },
        ],
        daily_growth: {
          title: "TĂNG TRƯỞNG - NGƯỜI DÙNG MỚI TRONG TUẦN",
          week_range: dateRange,
          total: totalNewUsers,
          growth_percent: 0,
          bars,
        },
      })
    } catch (error) {
      console.error("Failed to fetch admin stats:", error)
      toast.error("Lỗi tải dữ liệu thống kê", { position: "top-center" })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout
        title="THỐNG KÊ"
        subtitle={formatSubtitle()}
        onlineUsers={0}
      >
        <div className="admin-stats-page">
          <div style={{ textAlign: "center", padding: "40px", color: "#888" }}>
            Đang tải dữ liệu thống kê...
          </div>
        </div>
      </AdminLayout>
    )
  }

  const overview = data.overview || []
  const postDistribution = data.post_distribution || []
  const dailyGrowth = data.daily_growth || { bars: [] }
  const maxBarValue = Math.max(
    ...(dailyGrowth.bars || []).map((item) => item.value || 0),
    1
  )

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
            PHÂN BỐ PODCAST THEO TRẠNG THÁI
          </div>

          <div className="admin-topic-list">
            {postDistribution.map((item, index) => (
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