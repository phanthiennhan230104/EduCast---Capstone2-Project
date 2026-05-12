import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, ChevronDown, Settings, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from '../../../style/layout/Header.module.css'
import { useAuth } from '../../contexts/AuthContext'
import { getInitials } from '../../../utils/getInitials'
import NotificationPanel from '../NotificationPanel/NotificationPanel'

export default function Header({ hideGlobalProgress = false }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { i18n, t } = useTranslation()
  const [query, setQuery] = useState('')
  const [openMenu, setOpenMenu] = useState(false)
  const [openLangMenu, setOpenLangMenu] = useState(false)
  const menuRef = useRef(null)
  const langMenuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenu(false)
      }
      if (langMenuRef.current && !langMenuRef.current.contains(event.target)) {
        setOpenLangMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const displayName = useMemo(
    () => user?.full_name || user?.name || user?.display_name || user?.username || t('feed.comment.user'),
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

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('i18nextLng', lang)
    setOpenLangMenu(false)
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
          placeholder={t('header.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearch}
        />
      </div>

      <div className={styles.actions}>
        <NotificationPanel />

        <button
          className={styles.createBtn}
          type="button"
          onClick={() => navigate('/create-audio')}
        >
          <Plus size={16} />
          {t('header.create_podcast')}
        </button>

        <div className={styles.langMenuWrap} ref={langMenuRef}>
          <button 
            className={styles.langBtn} 
            type="button"
            onClick={() => setOpenLangMenu((prev) => !prev)}
            aria-label={t('header.chooseLanguage')}
          >
            <span className={styles.flag}>
              {i18n.language === 'en' ? '🇬🇧' : '🇻🇳'}
            </span>
          </button>

          <div className={`${styles.langDropdown} ${openLangMenu ? styles.langDropdownOpen : ''}`}>
            <button 
              type="button" 
              className={`${styles.langOption} ${i18n.language === 'vi' ? styles.langOptionActive : ''}`}
              onClick={() => handleLanguageChange('vi')}
            >
              <span>🇻🇳</span>
              <span>Tiếng Việt</span>
            </button>
            <button 
              type="button" 
              className={`${styles.langOption} ${i18n.language === 'en' ? styles.langOptionActive : ''}`}
              onClick={() => handleLanguageChange('en')}
            >
              <span>EN</span>
              <span>English</span>
            </button>
          </div>
        </div>

        <div className={styles.userMenuWrap} ref={menuRef}>
          <button
            className={styles.userTrigger}
            aria-label={t('header.openUserMenu')}
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
                <span>{user?.email || t('header.educastAccount')}</span>
              </div>
            </div>

            <button type="button" className={styles.dropdownItem} onClick={handleGoSettings}>
              <Settings size={16} />
              <span>{t('header.settings')}</span>
            </button>

            <button
              type="button"
              className={`${styles.dropdownItem} ${styles.logoutItem}`}
              onClick={handleLogout}
            >
              <LogOut size={16} />
              <span>{t('header.logout')}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
    
  )
}