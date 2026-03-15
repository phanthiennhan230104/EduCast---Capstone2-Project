import { ChevronRight } from 'lucide-react'
import styles from '../../style/sections/CategoryFilter.module.css'

const CATEGORIES = [
  'Podcast hành trình',
  'Được tìm kiếm',
  'Phát triển bản thân',
  'Tâm lý học',
  'Công nghệ',
  'Kinh doanh',
  'Sức khỏe'
]

export default function CategoryFilter() {
  return (
    <div className={styles.categoriesWrap}>
      <div className={styles.categories}>
        {CATEGORIES.map(cat => (
          <button key={cat} className={cat === 'Podcast hành trình' ? styles.categoryBadgeActive : styles.categoryBadge}>
            {cat}
          </button>
        ))}
      </div>
      <button className={styles.scrollBtn}>
        <ChevronRight size={20} />
      </button>
    </div>
  )
}
