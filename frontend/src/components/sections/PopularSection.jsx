import styles from '../../style/sections/PopularSection.module.css'

const POPULAR = [
  {
    cover: 'https://picsum.photos/seed/pop1/280/280',
    title: 'Series Python AI nâng cao',
    author: 'Minh Khoa',
    listeners: '12.5K'
  },
  {
    cover: 'https://picsum.photos/seed/pop2/280/280',
    title: 'Tâm lý hành vi hiện đại',
    author: 'Dr. Anh',
    listeners: '8.3K'
  },
  {
    cover: 'https://picsum.photos/seed/pop3/280/280',
    title: 'Web3 & Blockchain cơ bản',
    author: 'CryptoViet',
    listeners: '15.2K'
  }
]

export default function PopularSection() {
  return (
    <section className={styles.section}>
      <div className={styles.content}>
        <h2 className={styles.title}>ĐƯỢC YÊU THÍCH BỠI<br />200+ NGƯỜI DÙNG</h2>
        <p className={styles.subtitle}>Những podcast được lựa chọn nhiều nhất bởi cộng đồng EduCast</p>

        <div className={styles.cards}>
          {POPULAR.map((item, i) => (
            <div key={i} className={styles.card}>
              <img src={item.cover} alt={item.title} className={styles.cover} />
              <h3 className={styles.cardTitle}>{item.title}</h3>
              <p className={styles.author}>{item.author}</p>
              <p className={styles.listeners}>{item.listeners} người nghe</p>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.banner}>
        <div className={styles.bannerContent}>
          <h3 className={styles.bannerTitle}>Sẵn sàng khám phá?</h3>
          <p className={styles.bannerText}>Tham gia ngay để bắt đầu hành trình học tập</p>
          <button className={styles.bannerBtn}>Tham gia ngay</button>
        </div>
      </div>
    </section>
  )
}
