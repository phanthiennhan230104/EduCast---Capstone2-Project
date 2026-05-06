import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, ChevronDown, Settings, LogOut } from 'lucide-react'
import styles from '../../../style/layout/Header.module.css'
import { useAuth } from '../../contexts/AuthContext'
import { getInitials } from '../../../utils/getInitials'
import NotificationPanel from '../NotificationPanel/NotificationPanel'

export default function Header({ hideGlobalProgress = false }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [query, setQuery] = useState('')
  const [openMenu, setOpenMenu] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const displayName = useMemo(
    () => user?.full_name || user?.name || user?.display_name || user?.username || 'Người dùng',
    [user]
  )

  const avatarFallback = getInitials(user)

  const handleGoSettings = () => {
    setOpenMenu(false)
    navigate('/settings')
  }

  const handleLogout = async () => {
    await logout()
    setOpenMenu(false)
    navigate('/', { replace: true })
  }

  const handleSearch = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`)
      setQuery('')
    }
  }

  const handleSearchClick = () => {
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`)
      setQuery('')
    }
  }

  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 19V6l12-3v13"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="6" cy="19" r="3" stroke="#fff" strokeWidth="2" />
            <circle cx="18" cy="16" r="3" stroke="#fff" strokeWidth="2" />
          </svg>
        </div>
        <span className={styles.logoText}>EduCast</span>
      </div>

      <div className={styles.searchWrap}>
        <Search size={15} className={styles.searchIcon} onClick={handleSearchClick} />
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Tìm kiếm Podcast, chủ đề, người tạo..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearch}
        />
      </div>

      <div className={styles.actions}>
        <NotificationPanel />

        <button className={styles.createBtn} type="button">
          <Plus size={16} />
          Tạo Podcast
        </button>

        <button className={styles.langBtn} type="button">
          <span className={styles.flag}>🇻🇳</span>
        </button>

        <div className={styles.userMenuWrap} ref={menuRef}>
          <button
            className={styles.userTrigger}
            aria-label="Mở menu người dùng"
            onClick={() => setOpenMenu((prev) => !prev)}
            type="button"
          >
            <div className={styles.avatar}>
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                <span className={styles.avatarFallback}>{avatarFallback}</span>
              )}
            </div>
            <ChevronDown
              size={14}
              className={`${styles.userChevron} ${openMenu ? styles.userChevronOpen : ''}`}
            />
          </button>

          <div className={`${styles.dropdownMenu} ${openMenu ? styles.dropdownMenuOpen : ''}`}>
            <div className={styles.dropdownHeader}>
              <div className={styles.dropdownAvatar}>
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                ) : (
                  <span className={styles.avatarFallback}>{avatarFallback}</span>
                )}
              </div>
              <div className={styles.dropdownMeta}>
                <strong>{displayName}</strong>
                <span>{user?.email || 'Tài khoản EduCast'}</span>
              </div>
            </div>

            <button type="button" className={styles.dropdownItem} onClick={handleGoSettings}>
              <Settings size={16} />
              <span>Cài đặt</span>
            </button>

            <button
              type="button"
              className={`${styles.dropdownItem} ${styles.logoutItem}`}
              onClick={handleLogout}
            >
              <LogOut size={16} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </div>
    </header>
    
  )
}