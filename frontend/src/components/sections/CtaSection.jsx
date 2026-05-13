import styles from "../../style/sections/CtaSection.module.css";


export default function CtaSection({ onOpenSignup, onOpenLogin }) {
  return (
    <section className={styles.ctaSection}>
      <h2 className={styles.ctaTitle}>
        Sẵn sàng biến <br />
        <span>thời gian rảnh</span> <br />
        thành tri thức?
      </h2>

      <p className={styles.ctaSub}>
        Miễn phí hoàn toàn. Không cần thẻ tín dụng. Bắt đầu ngay hôm nay.
      </p>

      <div className={styles.ctaButtons}>
        <button
          type="button"
          className={styles.btnCtaLg}
          onClick={onOpenSignup}
        >
          Tạo tài khoản miễn phí
        </button>

        
      </div>
    </section>
  )
}