import { Briefcase, BookOpen, Lightbulb, Code } from 'lucide-react'
import styles from '../../style/sections/CategoryBadges.module.css'

const BADGES = [
  { icon: Briefcase, label: 'KINH DOANH KHỞI NGHIỆP' },
  { icon: BookOpen, label: 'TIẾNG ANH THỰC CHIẾN' },
  { icon: Lightbulb, label: 'PHÁT TRIỂN BẢN THÂN' },
  { icon: Code, label: 'LẬP TRÌNH & CÔNG NGHỆ' }
]

export default function CategoryBadges() {
  return (
    <div className={styles.badgesContainer}>
      {BADGES.map(({ icon: Icon, label }, index) => (
        <div key={label} className={styles.badgeWrapper}>
          <div className={styles.badgeIcon}>
            <Icon size={16} />
          </div>
          <span className={styles.badge}>{label}</span>
        </div>
      ))}
    </div>
  )
}
