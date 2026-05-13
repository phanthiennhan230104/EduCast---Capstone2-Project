import { Link } from 'react-router-dom'
import { Music } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from '../../style/common/PageHeader.module.css'


export default function PageHeader({ onOpenLogin, onOpenSignup }) {
  const { t } = useTranslation()
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.logo}>
        <div className={styles.logoBox}>
          <Music size={20} />
        </div>
        <span className={styles.logoText}>EduCast</span>
      </Link>

      <nav className={styles.nav}>
        <a href="#explore" className={styles.navLink}>Khám Phá</a>
        <a href="#topics" className={styles.navLink}>Chủ Đề</a>
        <a href="#community" className={styles.navLink}>Cộng Đồng</a>
        <a href="#ranking" className={styles.navLink}>Xếp Hạng</a>
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