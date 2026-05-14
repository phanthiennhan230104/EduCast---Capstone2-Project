import { NavLink, useLocation } from 'react-router-dom'
import {
  Heart,
  MessageCircle,
  Plus,
  Rss,
  Settings,
  User,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import styles from '../../../style/layout/Sidebar.module.css'
import {
  clearFeedScrollSessionKeys,
  readMainScrollTop,
  writeFeedScrollSessionKeys,
} from '../../../utils/feedScrollSession'
import FeedFilterSidebar from './FeedFilterSidebar'

const NAV_MAIN = [
  { icon: Rss, labelKey: 'navigation.main.feed', to: '/feed' },
  { icon: Heart, labelKey: 'navigation.main.favorites', to: '/favorites' },
  { icon: Users, labelKey: 'navigation.main.community', to: '/community' },
]

const NAV_OTHER = [
  {
    icon: MessageCircle,
    labelKey: 'navigation.other.messages',
    to: '/messages',
  },
  {
    icon: User,
    labelKey: 'navigation.other.profile',
    to: '/profile',
  },
  {
    icon: Plus,
    labelKey: 'navigation.other.createAudio',
    to: '/create-audio',
  },
  {
    icon: Settings,
    labelKey: 'navigation.other.settings',
    to: '/settings',
  },
]

export default function Sidebar() {
  const { t } = useTranslation()
  const location = useLocation()

  const showFeedFilters = location.pathname.startsWith('/feed')

  const handleSidebarClick = (event, to) => {
    if (location.pathname === to) {
      event.preventDefault()

      if (to === '/feed') {
        clearFeedScrollSessionKeys()
      } else {
        sessionStorage.removeItem(`mainScroll:${to}`)
      }

      window.location.reload()
      return
    }

    if (location.pathname.startsWith('/feed') && to !== '/feed') {
      writeFeedScrollSessionKeys(readMainScrollTop())
    }
  }

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        <p className={styles.sectionLabel}>
          {t('navigation.main.label')}
        </p>

        {NAV_MAIN.map(({ icon: Icon, labelKey, to }) => (
          <NavLink
            key={to}
            to={to}
            onClick={(event) => handleSidebarClick(event, to)}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            <Icon size={17} />
            <span>{t(labelKey)}</span>
          </NavLink>
        ))}

        <p className={styles.sectionLabel}>
          {t('navigation.other.label')}
        </p>

        {NAV_OTHER.map(({ icon: Icon, labelKey, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            <Icon size={17} />
            <span>{t(labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      {showFeedFilters && <FeedFilterSidebar />}
    </aside>
  )
}