import { HelpCircle } from 'lucide-react'
import styles from '../../style/sections/QuestionSection.module.css'

export default function QuestionSection() {
  return (
    <section className={styles.section}>
      <div className={styles.questionSection}>
        <div className={styles.questionIcon}>
          <HelpCircle size={48} />
        </div>
        <h3 className={styles.questionTitle}>Sẵn sàng biến thời gian rảnh<br />thành trí thức?</h3>
        <p className={styles.questionDesc}>Miễn phí hoàn toàn. Bắt đầu ngay hôm nay.</p>
        <div className={styles.questionButtons}>
          <button className={styles.btnPrimary}>Tạo tài khoản miễn phí</button>
          <button className={styles.btnSecondary}>Về đầu trang</button>
        </div>
      </div>
    </section>
  )
}
