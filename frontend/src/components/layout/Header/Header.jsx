import { useState } from 'react'
import { Search, Bell, Plus, ChevronDown } from 'lucide-react'
import styles from '../../../style/layout/Header.module.css'

export default function Header() {
  const [query, setQuery] = useState('')

  return (
    <header className={styles.header}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M9 19V6l12-3v13" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="6" cy="19" r="3" stroke="#fff" strokeWidth="2"/>
            <circle cx="18" cy="16" r="3" stroke="#fff" strokeWidth="2"/>
          </svg>
        </div>
        <span className={styles.logoText}>EduCast</span>
      </div>

      {/* Search */}
      <div className={styles.searchWrap}>
        <Search size={15} className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Tìm kiếm podcast, khóa học, tác giả..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {/* Right actions */}
      <div className={styles.actions}>
        <button className={styles.iconBtn} aria-label="Thông báo">
          <Bell size={18} />
          <span className={styles.badge}>3</span>
        </button>

        <button className={styles.createBtn}>
          <Plus size={16} />
          Tạo Podcast
        </button>

        <button className={styles.langBtn}>
          <span className={styles.flag}>🇻🇳</span>
          <ChevronDown size={13} />
        </button>

        <button className={styles.avatar} aria-label="Trang cá nhân">
          <img
            src="https://i.pravatar.cc/36?img=12"
            alt="avatar"
            width={36}
            height={36}
          />
        </button>
      </div>
    </header>
  )
}
