import { Zap, Radio, Users, TrendingUp, Award, Headphones, ArrowRight } from 'lucide-react'
import FeatureCard from '../cards/FeatureCard'
import CategoryBadges from './CategoryBadges'
import styles from '../../style/sections/FeaturesSection.module.css'

const FEATURES = [
  { icon: Zap, title: 'Streaming nhanh', description: 'Phát trực tiếp mượt mà bất kể tốc độ mạng' },
  { icon: Radio, title: 'Chất lượng cao', description: 'Âm thanh sắc nét với chất lượng studio' },
  { icon: Users, title: 'Cộng đồng', description: 'Kết nối với người cùng sở thích' },
  { icon: TrendingUp, title: 'Xu hướng', description: 'Khám phá những podcast nổi tiếng' },
  { icon: Award, title: 'Được lựa chọn', description: 'Nội dung được biên tập chọn lọc' },
  { icon: Headphones, title: '24/7 Support', description: 'Hỗ trợ khách hàng suốt ngày đêm' }
]

export default function FeaturesSection() {
  return (
    <section className={styles.section}>
      <CategoryBadges />
      <div className={styles.header}>
        <ArrowRight size={24} className={styles.icon} />
        <h2 className={styles.title}>TÍNH NĂNG NỔI BẬT</h2>
      </div>
      <div className={styles.grid}>
        {FEATURES.map(({ icon, title, description }, i) => (
          <FeatureCard key={i} icon={icon} title={title} description={description} />
        ))}
      </div>
    </section>
  )
}
