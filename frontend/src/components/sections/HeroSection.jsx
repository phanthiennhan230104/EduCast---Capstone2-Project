import { Play, ArrowRight, SkipBack, SkipForward, Users, Sparkles } from 'lucide-react'
import styles from "../../style/sections/HeroSection.module.css";
export default function HeroSection({ id, onOpenLogin }) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroContent} id={id}>
        

        <h1 className={styles.heroTitle}>
          Nghe · Học <br />
          <span className={styles.lineAccent}>Kết nối</span> &amp; <br />
          <span className={styles.lineTeal}>Phát triển.</span>
        </h1>

        <p className={styles.heroDesc}>
          EduCast biến podcast thành hành trình học tập cộng đồng —
          nơi bạn vừa lắng nghe kiến thức, vừa chia sẻ và kết nối với
          người học khác.
        </p>

        <div className={styles.heroCta}>
          <button className={styles.btnCta} onClick={onOpenLogin}>
            Bắt đầu học ngay
            <ArrowRight size={16} />
          </button>

          
        </div>

        
      </div>

      <div className={styles.heroVisual}>
        <div className={styles.podcastCardMain}>
          <div className={styles.cardHeader}>
            <div className={styles.cardThumb}>🧠</div>

            <div className={styles.cardMeta}>
              <div className={styles.cardTitleSm}>Tư duy phản biện 101</div>
              <div className={styles.cardAuthor}>EduCast Originals · 124K lượt nghe</div>
            </div>

            <span className={styles.cardTag}>Tâm lý học</span>
          </div>

          <div className={styles.waveform}>
            {Array.from({ length: 20 }).map((_, index) => (
              <div
                key={index}
                className={`${styles.waveBar} ${index < 7 ? styles.active : ''}`}
              ></div>
            ))}
          </div>

          <div className={styles.cardControls}>
            <button className={styles.ctrlBtn}>
              <SkipBack size={18} />
            </button>

            <button className={styles.ctrlPlay}>
              <Play size={18} fill="currentColor" />
            </button>

            <button className={styles.ctrlBtn}>
              <SkipForward size={18} />
            </button>
          </div>
        </div>

        

        

      </div>
    </section>
  )
}