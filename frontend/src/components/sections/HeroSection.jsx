import {
  Play,
  ArrowRight,
  SkipBack,
  SkipForward,
  Users,
  Sparkles,
  Headphones,
} from 'lucide-react'
import styles from '../../style/sections/HeroSection.module.css'

export default function HeroSection({ onOpenSignup, onOpenLogin }) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroContent}>
        <div className={styles.heroBadge}>
          <span className={styles.badgePing}></span>
          AI-powered social audio learning
        </div>

        <h1 className={styles.heroTitle}>
          Biến tài liệu dài thành
          <br />
          <span className={styles.lineAccent}>podcast ngắn</span>
          <br />
          để học mọi lúc.
        </h1>

        <p className={styles.heroDesc}>
          EduCast giúp bạn chuyển văn bản hoặc tài liệu thành podcast học tập ngắn,
          dễ nghe, dễ chia sẻ và phù hợp với thói quen học nhanh của sinh viên.
        </p>

        <div className={styles.heroCta}>
          <button className={styles.btnCta} onClick={onOpenSignup}>
            Bắt đầu miễn phí
            <ArrowRight size={16} />
          </button>

          <button className={styles.btnOutlineCta} onClick={onOpenLogin}>
            Đăng nhập
          </button>
        </div>

        <div className={styles.heroStats}>
          <div className={styles.stat}>
            <span className={styles.statNum}>1–3 phút</span>
            <span className={styles.statLabel}>Podcast ngắn</span>
          </div>

          <div className={styles.statDivider}></div>

          <div className={styles.stat}>
            <span className={styles.statNum}>AI</span>
            <span className={styles.statLabel}>Tóm tắt & tạo giọng đọc</span>
          </div>

          <div className={styles.statDivider}></div>

          <div className={styles.stat}>
            <span className={styles.statNum}>Social</span>
            <span className={styles.statLabel}>Like, comment, follow</span>
          </div>
        </div>
      </div>

      <div className={styles.heroVisual}>
        <div className={styles.glowCircle}></div>

        <div className={styles.podcastCardMain}>
          <div className={styles.cardHeader}>
            <div className={styles.cardThumb}>🧠</div>

            <div className={styles.cardMeta}>
              <div className={styles.cardTitleSm}>Tư duy phản biện 101</div>
              <div className={styles.cardAuthor}>
                EduCast Originals · 124K lượt nghe
              </div>
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

        <div className={`${styles.floatCard} ${styles.floatCardOne}`}>
          <div className={styles.floatIconWrap}>
            <Sparkles size={18} />
          </div>
          <div className={styles.floatText}>
            <span className={styles.floatMain}>AI summarize</span>
            <span className={styles.floatSub}>Tóm tắt tài liệu nhanh</span>
          </div>
        </div>

        <div className={`${styles.floatCard} ${styles.floatCardTwo}`}>
          <div className={styles.floatIconWrap}>
            <Users size={18} />
          </div>
          <div className={styles.floatText}>
            <span className={styles.floatMain}>Social learning</span>
            <span className={styles.floatSub}>Học cùng cộng đồng</span>
          </div>
        </div>

        <div className={`${styles.floatCard} ${styles.floatCardThree}`}>
          <div className={styles.floatIconWrap}>
            <Headphones size={18} />
          </div>
          <div className={styles.floatText}>
            <span className={styles.floatMain}>Listen anywhere</span>
            <span className={styles.floatSub}>Nghe khi đi học, đi làm</span>
          </div>
        </div>
      </div>
    </section>
  )
}