import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BadgeCheck,
  Bell,
  BrainCircuit,
  Camera,
  CreditCard,
  Flame,
  Home,
  Link2,
  Lock,
  LogOut,
  Settings,
  ShieldAlert,
  Star,
  Upload,
  UserRound,
  Zap,
} from 'lucide-react'
import MainLayout from '../../components/layout/MainLayout/MainLayout'
import { useAuth } from '../../components/contexts/AuthContext'
import styles from '../../style/pages/SettingsPage/SettingsPage.module.css'

const TABS = [
  { id: 'account', label: 'Tài khoản', icon: UserRound },
  { id: 'notifications', label: 'Thông báo', icon: Bell },
  { id: 'listening', label: 'Nghe & Phát', icon: Zap },
  { id: 'ai', label: 'AI & Nội dung', icon: BrainCircuit },
  { id: 'privacy', label: 'Riêng tư', icon: Lock },
  { id: 'other', label: 'Khác', icon: Settings },
]

function Switch({ defaultChecked = false }) {
  return (
    <label className={styles.switch}>
      <input type="checkbox" defaultChecked={defaultChecked} />
      <span className={styles.slider}></span>
    </label>
  )
}

function AccountSummaryCard() {
  return (
    <div className={styles.accountCard}>
      <div className={styles.accountTop}>
        <div className={styles.accountBadge}>🔥</div>
        <div className={styles.accountMeta}>
          <h4>EduCast Pro</h4>
          <p>Còn 18 ngày · Tự động gia hạn</p>
        </div>
      </div>
      <button className={styles.premiumBtn}>Nâng cấp Premium</button>
    </div>
  )
}

function SettingsRightPanel({ onLogout }) {
  return (
    <aside className={styles.sidePanel}>
      <div className={styles.sideTitle}>
        <Home size={13} />
        <span>Tài khoản của bạn</span>
      </div>

      <AccountSummaryCard />

      <div className={styles.listenCard}>
        <span>Tổng giờ đã nghe</span>
        <strong>142h</strong>
        <small>↑ 12h so với tháng trước</small>
      </div>

      <div className={styles.miniStats}>
        <div className={styles.miniCard}>
          <span>Đã lưu</span>
          <strong>18</strong>
          <small>podcast</small>
        </div>

        <div className={styles.miniCard}>
          <span>Bộ sưu tập</span>
          <strong>4</strong>
          <small>danh sách</small>
        </div>
      </div>

      <div className={styles.streakCard}>
        <div className={styles.streakRow}>
          <Flame size={14} />
          <span>3 ngày liên tiếp</span>
        </div>
      </div>

      <div className={styles.levelCard}>
        <div className={styles.levelPill}>
          <Star size={13} />
          <span>Cấp 12</span>
        </div>
      </div>

      <div className={styles.activityCard}>
        <h4>Hoạt động gần đây</h4>

        <div className={styles.activityList}>
          <div className={styles.activityItem}>
            <Bell size={14} />
            <div>
              <b>Đổi email thành công</b>
              <span>2 ngày trước</span>
            </div>
          </div>

          <div className={styles.activityItem}>
            <BadgeCheck size={14} />
            <div>
              <b>Gia hạn Pro thành công</b>
              <span>12 ngày trước</span>
            </div>
          </div>

          <div className={styles.activityItem}>
            <ShieldAlert size={14} />
            <div>
              <b>Đăng nhập từ thiết bị mới</b>
              <span>18 ngày trước</span>
            </div>
          </div>

          <div className={styles.activityItem}>
            <Link2 size={14} />
            <div>
              <b>Liên kết Google thành công</b>
              <span>12 ngày trước</span>
            </div>
          </div>
        </div>
      </div>

      <button className={styles.logoutBtn} onClick={onLogout}>
        <LogOut size={17} />
        Đăng xuất
      </button>
    </aside>
  )
}

function AccountSettings({ profile }) {
  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardTitle}>
          <div className={styles.cardIcon}>
            <UserRound size={16} />
          </div>
          <h3>Thông tin cá nhân</h3>
        </div>

        <div className={styles.profileBox}>
          <img src={profile.avatar} alt={profile.name} className={styles.avatar} />
          <div className={styles.profileInfo}>
            <h4>{profile.name}</h4>
            <p>{profile.email}</p>
            <div className={styles.profileActions}>
              <button className={styles.inlineBtn}>✎ Chỉnh sửa</button>
              <button className={styles.inlineBtn}>
                <Camera size={12} />
                Đổi ảnh
              </button>
            </div>
          </div>
        </div>

        <div className={styles.infoTable}>
          <div className={styles.infoRow}>
            <span>Tên hiển thị</span>
            <strong>{profile.name}</strong>
            <button className={styles.smallBtn}>Sửa</button>
          </div>

          <div className={styles.infoRow}>
            <span>Email</span>
            <strong>{profile.email}</strong>
            <button className={styles.smallBtn}>Sửa</button>
          </div>

          <div className={styles.infoRow}>
            <span>Mật khẩu</span>
            <strong>Đã thiết lập</strong>
            <button className={styles.smallBtn}>Đổi</button>
          </div>

          <div className={styles.infoRow}>
            <span>Bio giới thiệu</span>
            <strong>{profile.bio}</strong>
            <button className={styles.smallBtn}>Sửa</button>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardTitle}>
          <div className={styles.cardIcon}>
            <CreditCard size={16} />
          </div>
          <h3>Gói dịch vụ</h3>
        </div>

        <div className={styles.infoTable}>
          <div className={styles.infoRow}>
            <span>Gói hiện tại</span>
            <strong>🔥 EduCast Pro — Còn 18 ngày</strong>
            <button className={styles.smallBtn}>Gia hạn</button>
          </div>

          <div className={styles.infoRow}>
            <span>Tự động gia hạn</span>
            <strong>Gia hạn mỗi tháng, 49,000đ</strong>
            <Switch defaultChecked />
          </div>

          <div className={styles.infoRow}>
            <span>Lịch sử thanh toán</span>
            <strong>Xem hóa đơn và giao dịch</strong>
            <button className={styles.smallBtn}>Xem</button>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardTitle}>
          <div className={styles.cardIcon}>
            <Link2 size={16} />
          </div>
          <h3>Liên kết tài khoản</h3>
        </div>

        <div className={styles.infoTable}>
          <div className={styles.infoRow}>
            <span>Google</span>
            <strong>Đã liên kết</strong>
            <button className={styles.smallBtn}>Hủy liên kết</button>
          </div>

          <div className={styles.infoRow}>
            <span>Facebook</span>
            <strong>Chưa liên kết</strong>
            <button className={styles.smallBtn}>Liên kết</button>
          </div>
        </div>
      </section>

      <section className={`${styles.card} ${styles.dangerCard}`}>
        <div className={styles.cardTitle}>
          <div className={`${styles.cardIcon} ${styles.dangerIcon}`}>
            <ShieldAlert size={16} />
          </div>
          <h3>Vùng nguy hiểm</h3>
        </div>

        <div className={styles.infoTable}>
          <div className={styles.infoRow}>
            <span>Xuất dữ liệu</span>
            <strong>Tải toàn bộ lịch sử và dữ liệu của bạn</strong>
            <button className={styles.smallBtn}>
              <Upload size={12} />
              Tải xuống
            </button>
          </div>

          <div className={styles.infoRow}>
            <span>Xóa tài khoản</span>
            <strong>Hành động này không thể hoàn tác</strong>
            <button className={styles.deleteBtn}>Xóa tài khoản</button>
          </div>
        </div>
      </section>
    </>
  )
}

function NotificationSettings() {
  return (
    <section className={styles.card}>
      <div className={styles.cardTitle}>
        <div className={styles.cardIcon}>
          <Bell size={16} />
        </div>
        <h3>Thông báo</h3>
      </div>

      <div className={styles.infoTable}>
        <div className={styles.infoRow}>
          <span>Thông báo chung</span>
          <strong>Bật</strong>
          <Switch defaultChecked />
        </div>

        <div className={styles.infoRow}>
          <span>Thông báo email</span>
          <strong>Bật</strong>
          <Switch defaultChecked />
        </div>

        <div className={styles.infoRow}>
          <span>Nhắc lịch phát</span>
          <strong>Bật</strong>
          <Switch defaultChecked />
        </div>
      </div>
    </section>
  )
}

function ListeningSettings() {
  return (
    <section className={styles.card}>
      <div className={styles.cardTitle}>
        <div className={styles.cardIcon}>
          <Zap size={16} />
        </div>
        <h3>Nghe & Phát</h3>
      </div>

      <div className={styles.infoTable}>
        <div className={styles.infoRow}>
          <span>Chất lượng âm thanh</span>
          <strong>Cao</strong>
          <button className={styles.smallBtn}>Thay đổi</button>
        </div>

        <div className={styles.infoRow}>
          <span>Tự động phát tập tiếp</span>
          <strong>Bật</strong>
          <Switch defaultChecked />
        </div>
      </div>
    </section>
  )
}

function AISettings() {
  return (
    <section className={styles.card}>
      <div className={styles.cardTitle}>
        <div className={styles.cardIcon}>
          <BrainCircuit size={16} />
        </div>
        <h3>AI & Nội dung</h3>
      </div>

      <div className={styles.infoTable}>
        <div className={styles.infoRow}>
          <span>Khuyến nghị AI</span>
          <strong>Bật</strong>
          <Switch defaultChecked />
        </div>

        <div className={styles.infoRow}>
          <span>Tạo nội dung bằng AI</span>
          <strong>Cho phép</strong>
          <button className={styles.smallBtn}>Quản lý</button>
        </div>
      </div>
    </section>
  )
}

function PrivacySettings() {
  return (
    <section className={styles.card}>
      <div className={styles.cardTitle}>
        <div className={styles.cardIcon}>
          <Lock size={16} />
        </div>
        <h3>Riêng tư</h3>
      </div>

      <div className={styles.infoTable}>
        <div className={styles.infoRow}>
          <span>Hồ sơ công khai</span>
          <strong>Tắt</strong>
          <Switch />
        </div>

        <div className={styles.infoRow}>
          <span>Hiển thị trạng thái nghe</span>
          <strong>Bật</strong>
          <Switch defaultChecked />
        </div>
      </div>
    </section>
  )
}

function OtherSettings() {
  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardTitle}>
          <div className={styles.cardIcon}>
            <Settings size={16} />
          </div>
          <h3>Khác</h3>
        </div>

        <div className={styles.infoTable}>
          <div className={styles.infoRow}>
            <span>Ngôn ngữ</span>
            <strong>Tiếng Việt</strong>
            <button className={styles.smallBtn}>Thay đổi</button>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardTitle}>
          <div className={styles.cardIcon}>
            <Link2 size={16} />
          </div>
          <h3>Liên kết tài khoản</h3>
        </div>

        <div className={styles.infoTable}>
          <div className={styles.infoRow}>
            <span>Google</span>
            <strong>Đã liên kết</strong>
            <button className={styles.smallBtn}>Hủy liên kết</button>
          </div>

          <div className={styles.infoRow}>
            <span>Facebook</span>
            <strong>Chưa liên kết</strong>
            <button className={styles.smallBtn}>Liên kết</button>
          </div>
        </div>
      </section>

      <section className={`${styles.card} ${styles.dangerCard}`}>
        <div className={styles.cardTitle}>
          <div className={`${styles.cardIcon} ${styles.dangerIcon}`}>
            <ShieldAlert size={16} />
          </div>
          <h3>Vùng nguy hiểm</h3>
        </div>

        <div className={styles.infoTable}>
          <div className={styles.infoRow}>
            <span>Xuất dữ liệu</span>
            <strong>Tải toàn bộ lịch sử và dữ liệu của bạn</strong>
            <button className={styles.smallBtn}>
              <Upload size={12} />
              Tải xuống
            </button>
          </div>

          <div className={styles.infoRow}>
            <span>Xóa tài khoản</span>
            <strong>Hành động này không thể hoàn tác</strong>
            <button className={styles.deleteBtn}>Xóa tài khoản</button>
          </div>
        </div>
      </section>
    </>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState('account')

  const profile = useMemo(() => {
    const fallbackName =
      user?.full_name ||
      user?.name ||
      user?.display_name ||
      user?.username ||
      (user?.email ? user.email.split('@')[0] : 'huhu')

    return {
      name: fallbackName,
      email: user?.email || 'le7024863@gmail.com',
      avatar: user?.avatar || user?.avatar_url || 'https://i.pravatar.cc/120?img=12',
      bio: user?.bio || 'Tâm lý học · Lập trình · Khởi nghiệp',
    }
  }, [user])

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'account':
        return <AccountSettings profile={profile} />
      case 'notifications':
        return <NotificationSettings />
      case 'listening':
        return <ListeningSettings />
      case 'ai':
        return <AISettings />
      case 'privacy':
        return <PrivacySettings />
      case 'other':
        return <OtherSettings />
      default:
        return <AccountSettings profile={profile} />
    }
  }

  return (
  <MainLayout rightPanel={<SettingsRightPanel onLogout={handleLogout} />}>
    <div className={styles.page}>
      <div className={styles.headerLine}>
        <div className={styles.pageTitle}>
          <span className={styles.pageIcon}>⚙</span>
          <h2>Cài đặt</h2>
        </div>
      </div>

      <div className={styles.tabsContainer}>
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tabBtn} ${activeTab === tab.id ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.contentArea}>{renderContent()}</div>
    </div>
  </MainLayout>
)
}