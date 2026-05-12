import { NavLink, useLocation } from 'react-router-dom'
import {
  Rss, Heart, Users, MessageCircle,
  User, Settings, Plus
} from 'lucide-react'
import styles from '../../../style/layout/Sidebar.module.css'
import { useTranslation } from "react-i18next";
import TagSelector from '../../../components/feed/TagSelector'


  const NAV_MAIN = [
    { icon: Rss,           labelKey: 'navigation.main.feed',        to: '/feed' },
    { icon: Heart,         labelKey: 'navigation.main.favorites',  to: '/favorites' },
    { icon: Users,         labelKey: 'navigation.main.community',           to: '/community' },
  ]

const NAV_OTHER = [
  { icon: MessageCircle, label: 'Tin nhắn',   to: '/messages' },
  { icon: User,          label: 'Trang cá nhân', to: '/profile' },
  { icon: Plus,          label: 'Tạo Audio AI',   to: '/create-audio' },
  { icon: Settings,      label: 'Cài đặt',    to: '/settings' },
]

export default function Sidebar() {
  const { t } = useTranslation();
  const location = useLocation()

  const handleFeedClick = (event, to) => {
    if (location.pathname === to) {
      event.preventDefault()
      sessionStorage.removeItem(`mainScroll:${to}`)
      window.location.reload()
    }
  }

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        <p className={styles.sectionLabel}>{t('navigation.main.label')}</p>
        {NAV_MAIN.map(({ icon: Icon, labelKey, to }) => (
          <NavLink
            key={to}
            to={to}
            onClick={(event) => handleFeedClick(event, to)}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            <Icon size={17} />
            <span>{t(labelKey)}</span>
          </NavLink>
        ))}

        <p className={styles.sectionLabel}>{t('navigation.other.label')}</p>
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
