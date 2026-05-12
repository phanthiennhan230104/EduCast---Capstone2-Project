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
        <a href="#explore" className={styles.navLink}>{t('landingHeader.explore')}</a>
        <a href="#topics" className={styles.navLink}>{t('landingHeader.topics')}</a>
        <a href="#community" className={styles.navLink}>{t('landingHeader.community')}</a>
        <a href="#ranking" className={styles.navLink}>{t('landingHeader.ranking')}</a>
      </nav>

      <div className={styles.actions}>
        <button type="button" className={styles.loginBtn} onClick={onOpenLogin}>
          {t('landingHeader.login')}
        </button>

        <button type="button" className={styles.freeBtn} onClick={onOpenSignup}>
          {t('landingHeader.signupFree')}
        </button>
      </div>
    </header>
  )
}