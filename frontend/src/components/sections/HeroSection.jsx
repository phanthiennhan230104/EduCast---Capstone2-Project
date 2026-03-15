import { Play, Download, Users } from 'lucide-react'
import styles from '../../style/sections/HeroSection.module.css'

export default function HeroSection() {
  return (
    <div className={styles.hero}>
      <div className={styles.left}>
        <h1 className={styles.title}>
          Nghe - Học <span className={styles.highlight}>Kết nối</span><br />
          & Phát triển bản thân
        </h1>
        <p className={styles.subtitle}>
          PodLearn biến podcast thành hành trình 
học tập cộng đồng — nơi bạn vừa lắng 
nghe kiến thức, vừa chia sẻ và kết nối với 
hàng triệu người học trên toàn quốc.
        </p>
        <div className={styles.buttons}>
          <button className={styles.ctaPrimary}>
            <Download size={18} /> Bắt đầu ngay
          </button>
          <button className={styles.ctaSecondary}>
            <Play size={18} />
          </button>
        </div>
        <div className={styles.badge}>
          <Users size={16} />
          <span>29 người dùng đang trực tuyến</span>
        </div>
      </div>

      <div className={styles.right}>
        <img
          src="https://picsum.photos/seed/player_mockup/380/520"
          alt="Player Mockup"
          className={styles.mockup}
        />
      </div>
    </div>
  )
}
