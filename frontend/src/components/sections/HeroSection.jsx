import { Play, ArrowRight, SkipBack, SkipForward, Users, Sparkles } from 'lucide-react'
import styles from "../../style/sections/HeroSection.module.css";
export default function HeroSection() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroContent}>
        <div className={styles.heroBadge}>
          <span className={styles.badgePing}></span>
          Mạng xã hội học tập #1 Việt Nam
        </div>

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
          <button className={styles.btnCta}>
            Bắt đầu học ngay
            <ArrowRight size={16} />
          </button>

          <button className={styles.btnOutlineCta}>
            <Play size={16} />
            Xem demo
          </button>
        </div>

        <div className={styles.heroStats}>
          <div className={styles.stat}>
            <span className={styles.statNum}>120K+</span>
            <span className={styles.statLabel}>Người học</span>
          </div>

          <div className={styles.statDivider}></div>

          <div className={styles.stat}>
            <span className={styles.statNum}>8.400+</span>
            <span className={styles.statLabel}>Tập podcast</span>
          </div>

          <div className={styles.statDivider}></div>

          <div className={styles.stat}>
            <span className={styles.statNum}>340+</span>
            <span className={styles.statLabel}>Chủ đề</span>
          </div>
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

        

        <div className={`${styles.floatCard} ${styles.floatCardTwo}`}>
  <div className={styles.floatIconWrap}>
    <Users size={15} />
  </div>

  <div className={styles.floatText}>
    <div className={styles.floatMain}>2.341 người đang nghe</div>
    <div className={styles.floatSub}>Cùng chủ đề với bạn</div>
  </div>
</div>
      </div>
    </section>
  )
}