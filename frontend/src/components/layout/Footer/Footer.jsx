import { Link } from 'react-router-dom'
import { Music } from 'lucide-react'
import styles from '../../../style/layout/Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.brand}>
          <Link to="/" className={styles.logo}>
            <div className={styles.logoBox}>
              <Music size={20} />
            </div>
            <span>EduCast</span>
          </Link>
        </div>

        <nav className={styles.links}>
          <a href="#about">Giới thiệu</a>
          <a href="#terms">Điều khoản</a>
          <a href="#contact">Liên hệ</a>
        </nav>

        <div className={styles.copyright}>
          <p>© 2026 EduCast. Cách học mới của bạn.</p>
        </div>
      </div>
    </footer>
  )
}
