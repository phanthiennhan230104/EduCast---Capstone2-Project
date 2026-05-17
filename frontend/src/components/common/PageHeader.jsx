import { Link } from 'react-router-dom'

import { useTranslation } from 'react-i18next'
import styles from '../../style/common/PageHeader.module.css'
import logoImage from '../../assets/images/educast-logo.png'


export default function PageHeader({ onOpenLogin, onOpenSignup }) {
  const { t } = useTranslation()

  const handleScroll = (e, id) => {
    e.preventDefault()
    const element = document.getElementById(id)
    if (!element) return

    if (id === 'topics') {
      // Marquee nằm ở mép dưới viewport
      const rect = element.getBoundingClientRect()
      const targetY = window.scrollY + rect.bottom - window.innerHeight
      window.scrollTo({ top: targetY, behavior: 'smooth' })
    } else {
      // Community & Ranking: scroll sao cho phần section bắt đầu cách mép trên cách header
      const rect = element.getBoundingClientRect()
      const targetY = window.scrollY + rect.top - 64
      window.scrollTo({ top: targetY, behavior: 'smooth' })
    }
  }

  return (
    <header className={styles.header}>
      <Link to="/" className={styles.logo}>
        <img
          src={logoImage}
          alt="EduCast Logo"
          className={styles.logoImage}
        />
      </Link>

      <nav className={styles.nav}>
        <a
          href="#topics"
          className={styles.navLink}
          onClick={(e) => handleScroll(e, 'topics')}
        >
          Chủ Đề
        </a>
        <a
          href="#community"
          className={styles.navLink}
          onClick={(e) => handleScroll(e, 'community')}
        >
          Cộng Đồng
        </a>
        <a
          href="#ranking"
          className={styles.navLink}
          onClick={(e) => handleScroll(e, 'ranking')}
        >
          Yêu Thích
        </a>
      </nav>

      <div className={styles.actions}>
        <button type="button" className={styles.loginBtn} onClick={onOpenLogin}>
          Đăng Nhập
        </button>

        <button type="button" className={styles.freeBtn} onClick={onOpenSignup}>
          Dùng miễn phí
        </button>
      </div>
    </header>
  )
}