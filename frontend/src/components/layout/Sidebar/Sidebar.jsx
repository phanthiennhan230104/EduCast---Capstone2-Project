import { NavLink } from 'react-router-dom'
import {
  Rss, Heart, Users, MessageCircle,
  User, Settings, Plus
} from 'lucide-react'
import styles from '../../../style/layout/Sidebar.module.css'
import TagSelector from '../../../components/feed/TagSelector'

const NAV_MAIN = [
  { icon: Rss,           label: 'Feed của tôi',        to: '/feed' },
  { icon: Heart,         label: 'Thư viện yêu thích',  to: '/favorites' },
  { icon: Users,         label: 'Cộng đồng',           to: '/community' },
]

const NAV_OTHER = [
  { icon: MessageCircle, label: 'Tin nhắn',   to: '/messages' },
  { icon: User,          label: 'Trang cá nhân', to: '/profile' },
  { icon: Plus,          label: 'Tạo Audio AI',   to: '/create-audio' },
  { icon: Settings,      label: 'Cài đặt',    to: '/settings' },
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
      <TagSelector />
    </aside>
  )
}
