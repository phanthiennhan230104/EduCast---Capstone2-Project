import { Link } from 'react-router-dom'
import { Flag, Music } from 'lucide-react'
import styles from '../../style/common/PageHeader.module.css'

export default function PageHeader() {
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.logo}>
        <div className={styles.logoBox}>
          <Music size={20} />
        </div>
        <span className={styles.logoText}>EduCast</span>
      </Link>
      <nav className={styles.nav}>
        <a href="#explore" className={styles.navLink}>Khám phá</a>
        <a href="#topics" className={styles.navLink}>Chủ đề</a>
        <a href="#community" className={styles.navLink}>Cộng đồng</a>
      </nav>
      <Link to="/feed" className={styles.ctaBtn}>
        Tham gia ngay
        <Flag size={16} />
      </Link>
    </header>
  )
}
