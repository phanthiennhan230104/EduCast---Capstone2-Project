import styles from "../../style/sections/MarqueeSection.module.css";
const items = [
  'Kinh doanh & Khởi nghiệp',
  'Tâm lý học ứng dụng',
  'Lập trình & Công nghệ',
  'Tiếng Anh thực chiến',
  'Tài chính cá nhân',
  'Lịch sử & Văn hóa',
  'Phát triển bản thân',
  'Khoa học & Vũ trụ',
]

export default function MarqueeSection({ id, onOpenLogin }) {
  const loopItems = [...items, ...items]

  return (
    <div className={styles.marqueeSection} id={id}>
      <div className={styles.marqueeTrack}>
        {loopItems.map((item, index) => (
          <span 
            key={index} 
            className={styles.marqueeItem} 
            onClick={() => onOpenLogin && onOpenLogin(item)}
          >
            <span className={styles.marqueeDot}></span>
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}