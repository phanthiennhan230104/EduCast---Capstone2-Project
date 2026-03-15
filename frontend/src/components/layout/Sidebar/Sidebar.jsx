import { NavLink } from 'react-router-dom'
import {
  Rss, Heart, Users, MessageCircle,
  User, Settings, Plus, Flame
} from 'lucide-react'
import styles from '../../../style/layout/Sidebar.module.css'

const NAV_MAIN = [
  { icon: Rss,           label: 'Feed của tôi',        to: '/feed' },
  { icon: Heart,         label: 'Thư viện yêu thích',  to: '/favorites' },
  { icon: Users,         label: 'Cộng đồng',           to: '/community' },
]

const NAV_OTHER = [
  { icon: MessageCircle, label: 'Tin nhắn',   to: '/messages' },
  { icon: User,          label: 'Trang cá nhân', to: '/profile' },
  { icon: Settings,      label: 'Cài đặt',    to: '/settings' },
]

const TAGS = ['#TâmAnh', '#ChuaLành', '#HoàiNguyện']

const STREAK_DAYS = [
  { label: 'T2', done: true  },
  { label: 'T3', done: true  },
  { label: 'T4', done: true  },
  { label: 'T5', done: false },
  { label: 'T6', done: false },
  { label: 'T7', done: false },
  { label: 'CN', done: false },
]

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        <p className={styles.sectionLabel}>CHÍNH</p>
        {NAV_MAIN.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            <Icon size={17} />
            <span>{label}</span>
          </NavLink>
        ))}

        <p className={styles.sectionLabel}>KHÁC</p>
        {NAV_OTHER.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            <Icon size={17} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Favourite tags */}
      <div className={styles.tagsSection}>
        <p className={styles.sectionLabel}>CHỦ ĐỀ YÊU THÍCH</p>
        <div className={styles.tags}>
          {TAGS.map(tag => (
            <button key={tag} className={styles.tag}>{tag}</button>
          ))}
          <button className={styles.tagAdd}>
            <Plus size={12} /> Thêm
          </button>
        </div>
      </div>

      {/* Streak */}
      <div className={styles.streak}>
        <div className={styles.streakHeader}>
          <Flame size={16} color="#f97316" />
          <span className={styles.streakTitle}>3 ngày liên tiếp</span>
        </div>
        <div className={styles.streakDays}>
          {STREAK_DAYS.map(({ label, done }) => (
            <div
              key={label}
              className={`${styles.streakPill} ${done ? styles.done : ''}`}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
