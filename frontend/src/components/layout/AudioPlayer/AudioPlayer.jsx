import { useState } from 'react'
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, Shuffle, Repeat, ListMusic, Heart
} from 'lucide-react'
import styles from '../../../style/layout/AudioPlayer.module.css'

const NOW_PLAYING = {
  title: 'Python cho AI: Từ cơ bản đến nâng cao – Tập 3',
  author: 'Minh Khoa AI',
  cover: 'https://picsum.photos/seed/py3/56/56',
  duration: 1125, // seconds
  current: 312,
}

function formatTime(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function AudioPlayer() {
  const [playing, setPlaying] = useState(false)
  const [liked, setLiked] = useState(false)
  const [progress, setProgress] = useState(
    Math.round((NOW_PLAYING.current / NOW_PLAYING.duration) * 100)
  )
  const [volume, setVolume] = useState(80)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState(false)

  const currentSec = Math.round((progress / 100) * NOW_PLAYING.duration)

  return (
    <footer className={styles.player}>
      {/* Track info */}
      <div className={styles.trackInfo}>
        <img src={NOW_PLAYING.cover} alt={NOW_PLAYING.title} className={styles.cover} />
        <div className={styles.meta}>
          <span className={styles.title}>{NOW_PLAYING.title}</span>
          <span className={styles.author}>{NOW_PLAYING.author}</span>
        </div>
        <button
          className={`${styles.iconBtn} ${liked ? styles.liked : ''}`}
          onClick={() => setLiked(l => !l)}
          aria-label="Yêu thích"
        >
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Controls + progress */}
      <div className={styles.controls}>
        <div className={styles.buttons}>
          <button
            className={`${styles.iconBtn} ${shuffle ? styles.active : ''}`}
            onClick={() => setShuffle(s => !s)}
            aria-label="Xáo trộn"
          >
            <Shuffle size={16} />
          </button>
          <button className={styles.iconBtn} aria-label="Trước">
            <SkipBack size={20} />
          </button>
          <button
            className={styles.playBtn}
            onClick={() => setPlaying(p => !p)}
            aria-label={playing ? 'Tạm dừng' : 'Phát'}
          >
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button className={styles.iconBtn} aria-label="Tiếp theo">
            <SkipForward size={20} />
          </button>
          <button
            className={`${styles.iconBtn} ${repeat ? styles.active : ''}`}
            onClick={() => setRepeat(r => !r)}
            aria-label="Lặp lại"
          >
            <Repeat size={16} />
          </button>
        </div>

        <div className={styles.progressRow}>
          <span className={styles.time}>{formatTime(currentSec)}</span>
          <div className={styles.progressBar}>
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={e => setProgress(Number(e.target.value))}
              className={styles.range}
            />
            <div className={styles.fill} style={{ width: `${progress}%` }} />
          </div>
          <span className={styles.time}>{formatTime(NOW_PLAYING.duration)}</span>
        </div>
      </div>

      {/* Volume + extras */}
      <div className={styles.extras}>
        <button className={styles.iconBtn} aria-label="Danh sách phát">
          <ListMusic size={18} />
        </button>
        <div className={styles.volumeRow}>
          <Volume2 size={16} className={styles.volIcon} />
          <div className={styles.progressBar} style={{ width: 80 }}>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              className={styles.range}
            />
            <div className={styles.fill} style={{ width: `${volume}%` }} />
          </div>
        </div>
      </div>
    </footer>
  )
}
