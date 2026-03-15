import { useState } from 'react'
import {
  Play, Pause, Heart, MessageCircle,
  Share2, Bookmark, Bot, MoreHorizontal
} from 'lucide-react'
import styles from '../../style/feed/PodcastCard.module.css'

export default function PodcastCard({ podcast }) {
  const [playing, setPlaying] = useState(false)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [progress, setProgress] = useState(podcast.progress ?? 30)

  const {
    title, author, avatar, cover,
    duration, current, tags, aiGenerated,
    likes, comments, description
  } = podcast

  return (
    <article className={styles.card}>
      {/* Card header */}
      <div className={styles.cardHeader}>
        <img src={avatar} alt={author} className={styles.authorAvatar} />
        <div className={styles.authorInfo}>
          <span className={styles.authorName}>{author}</span>
          <div className={styles.tagRow}>
            {tags.map(t => (
              <span key={t} className={styles.tag}>{t}</span>
            ))}
            {aiGenerated && (
              <span className={styles.aiBadge}>
                <Bot size={11} />
                Được tạo bởi AI
              </span>
            )}
          </div>
        </div>
        <button className={styles.menuBtn}><MoreHorizontal size={18} /></button>
      </div>

      {/* Main content */}
      <div className={styles.body}>
        <div className={styles.textContent}>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.description}>{description}</p>
        </div>
        {cover && (
          <img src={cover} alt={title} className={styles.cover} />
        )}
      </div>

      {/* Audio player */}
      <div className={styles.player}>
        <button
          className={`${styles.playBtn} ${playing ? styles.playing : ''}`}
          onClick={() => setPlaying(p => !p)}
          aria-label={playing ? 'Tạm dừng' : 'Phát'}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <div className={styles.progressSection}>
          <span className={styles.time}>{current}</span>
          <div className={styles.progressBar}>
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={e => setProgress(Number(e.target.value))}
              className={styles.range}
            />
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className={styles.time}>{duration}</span>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button
          className={`${styles.actionBtn} ${liked ? styles.liked : ''}`}
          onClick={() => setLiked(l => !l)}
        >
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
          <span>{liked ? likes + 1 : likes}</span>
        </button>
        <button className={styles.actionBtn}>
          <MessageCircle size={16} />
          <span>{comments} Bình luận</span>
        </button>
        <button className={styles.actionBtn}>
          <Share2 size={16} />
          <span>Chia sẻ</span>
        </button>
        <button
          className={`${styles.actionBtn} ${saved ? styles.saved : ''}`}
          onClick={() => setSaved(s => !s)}
        >
          <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
          <span>{saved ? 'Đã lưu' : 'Lưu'}</span>
        </button>
      </div>
    </article>
  )
}
