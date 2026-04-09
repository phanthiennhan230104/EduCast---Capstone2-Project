import { useState } from 'react'
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, Shuffle, Repeat, ListMusic, Heart,
  ChevronDown, ChevronUp
} from 'lucide-react'
import styles from '../../../style/layout/AudioPlayer.module.css'
import { useAudioPlayer } from "../../contexts/AudioPlayerContext";

export default function AudioPlayer() {
  const [liked, setLiked] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const {
    currentTrack,
    playing,
    volume,
    progressPercent,
    formattedCurrentTime,
    formattedDuration,
    togglePlay,
    seekToPercent,
    setVolume,
    playNext,
    playPrev,
  } = useAudioPlayer()

  if (!currentTrack) {
    return (
      <footer className={`${styles.player} ${styles.idle}`}>
        <div className={styles.trackInfo}>
          <div className={styles.meta}>
            <span className={styles.title}>Chưa có audio đang phát</span>
            <span className={styles.author}>Hãy chọn một podcast từ feed</span>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer className={`${styles.player} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.trackInfo}>
        <img
          src={currentTrack.cover || 'https://picsum.photos/seed/default/56/56'}
          alt={currentTrack.title}
          className={styles.cover}
        />

        <div className={styles.meta}>
          <span className={styles.title}>{currentTrack.title}</span>
          <span className={styles.author}>{currentTrack.author}</span>
        </div>

        <button
          type="button"
          className={`${styles.iconBtn} ${liked ? styles.liked : ''}`}
          onClick={() => setLiked(l => !l)}
          aria-label="Yêu thích"
        >
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className={styles.controls}>
        <div className={styles.buttons}>
          <button
            type="button"
            className={`${styles.iconBtn} ${shuffle ? styles.active : ''}`}
            onClick={() => setShuffle(s => !s)}
            aria-label="Xáo trộn"
          >
            <Shuffle size={15} />
          </button>

          <button type="button" className={styles.iconBtn} aria-label="Trước" onClick={playPrev}>
            <SkipBack size={18} />
          </button>

          <button
            type="button"
            className={styles.playBtn}
            onClick={togglePlay}
            aria-label={playing ? 'Tạm dừng' : 'Phát'}
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <button type="button" className={styles.iconBtn} aria-label="Tiếp theo" onClick={playNext}>
            <SkipForward size={18} />
          </button>

          <button
            type="button"
            className={`${styles.iconBtn} ${repeat ? styles.active : ''}`}
            onClick={() => setRepeat(r => !r)}
            aria-label="Lặp lại"
          >
            <Repeat size={15} />
          </button>
        </div>

        <div className={styles.progressRow}>
          <span className={styles.time}>{formattedCurrentTime}</span>

          <div className={styles.progressBar}>
            <input
              type="range"
              min={0}
              max={100}
              value={progressPercent}
              onChange={e => seekToPercent(Number(e.target.value))}
              className={styles.range}
            />
            <div className={styles.fill} style={{ width: `${progressPercent}%` }} />
          </div>

          <span className={styles.time}>{formattedDuration}</span>
        </div>
      </div>

      <div className={styles.extras}>
        <button type="button" className={styles.iconBtn} aria-label="Danh sách phát">
          <ListMusic size={17} />
        </button>

        <div className={styles.volumeRow}>
          <Volume2 size={15} className={styles.volIcon} />
          <div className={`${styles.progressBar} ${styles.volumeBar}`}>
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

        <button
          type="button"
          className={styles.collapseBtn}
          onClick={() => setCollapsed(prev => !prev)}
          aria-label={collapsed ? 'Mở rộng trình phát' : 'Thu gọn trình phát'}
          title={collapsed ? 'Mở rộng' : 'Thu gọn'}
        >
          {collapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>
    </footer>
  )
}