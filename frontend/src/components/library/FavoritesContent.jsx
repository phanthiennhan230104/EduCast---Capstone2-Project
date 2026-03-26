import { useMemo, useState } from 'react'
import {
  MapPin,
  BookMarked,
  Headphones,
  Clock3,
  StickyNote,
  ChevronRight,
  LayoutGrid,
  Rows3,
  Pin,
  BookmarkCheck,
  Bookmark,
  MessageSquareText,
  CheckCircle2,
  PlayCircle,
} from 'lucide-react'
import styles from '../../style/library/FavoritesContent.module.css'

const COLLECTIONS = [
  { id: 1, name: 'AI cơ bản', count: 6 },
  { id: 2, name: 'Tâm lý học', count: 4 },
  { id: 3, name: 'IELTS', count: 5 },
  { id: 4, name: 'Tài chính cá nhân', count: 3 },
]

const INITIAL_PODCASTS = [
  {
    id: 1,
    pinned: true,
    title: 'Neural Network từ A-Z: Không cần toán phức tạp',
    author: 'Lê Thị Thanh Trâm',
    topic: 'Lập trình',
    listens: '4.2k lượt nghe',
    duration: '3:30',
    noteCount: 1,
    saved: true,
    listenedPercent: 100,
  },
  {
    id: 2,
    pinned: true,
    title: 'Hiệu ứng Dunning Kruger: Tại sao biết ít lại tự tin hơn?',
    author: 'Phan Thiện Nhân',
    topic: 'Tâm lý học',
    listens: '3.8k lượt nghe',
    duration: '4:05',
    noteCount: 1,
    saved: true,
    listenedPercent: 55,
  },
  {
    id: 3,
    pinned: true,
    title: 'IELTS Speaking Part 2: Kể chuyện bằng tiếng Anh tự nhiên',
    author: 'Tấn Tín',
    topic: 'IELTS',
    listens: '3.4k lượt nghe',
    duration: '3:20',
    noteCount: 0,
    saved: true,
    listenedPercent: 0,
  },
  {
    id: 4,
    pinned: true,
    title: 'Quy tắc 50-30-20: Quản lý tiền lương hiệu quả',
    author: 'Minh Hoàng',
    topic: 'Tài chính cá nhân',
    listens: '5.7k lượt nghe',
    duration: '3:14',
    noteCount: 2,
    saved: true,
    listenedPercent: 35,
  },
]

function getListenLabel(percent) {
  if (percent >= 100) return 'Đã nghe xong'
  if (percent <= 0) return 'Chưa nghe'
  return `Đã nghe ${percent}%`
}

function MiniWave() {
  const bars = [
    14, 20, 16, 24, 30, 18, 26, 22, 14, 20, 24, 28, 16, 18, 22, 26, 14, 18,
    22, 26, 30, 18, 14, 20, 24, 30, 18, 26, 22, 14, 20, 24, 28, 16, 18, 22,
    26, 14, 18, 22, 26, 30, 18, 14, 20,
  ]

  return (
    <div className={styles.wave}>
      {bars.map((h, i) => (
        <span
          key={i}
          className={`${styles.bar} ${i < 8 ? styles.activeBar : ''}`}
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  )
}

function SavedCard({ item, viewMode, onToggleSaved }) {
  const [isPlaying, setIsPlaying] = useState(false)
  return (
    <article className={`${styles.savedCard} ${viewMode === 'list' ? styles.savedCardList : ''}`}>
      <div className={styles.savedTop}>
        {item.pinned && (
          <span className={styles.savedBadge}>
            <Pin size={11} />
            Đã ghim
          </span>
        )}
      </div>

      <div className={styles.savedBody}>
        <div className={styles.savedMain}>
          <h4 className={styles.savedTitle}>{item.title}</h4>
          <p className={styles.savedMeta}>
            {item.author} · {item.listens} · {item.topic}
          </p>

          <div className={styles.playerMock}>
            <button
              className={`${styles.playBtn} ${isPlaying ? styles.playing : ''}`}
              type="button"
              aria-label={isPlaying ? `Tạm dừng ${item.title}` : `Phát ${item.title}`}
              onClick={() => setIsPlaying(prev => !prev)}
            >
              {isPlaying ? '❚❚' : '▶'}
            </button>
            <div className={styles.waveWrap}>
              <MiniWave />
            </div>
            <span className={styles.duration}>{item.duration}</span>
          </div>

          <div className={styles.savedFooter}>
            <button
              type="button"
                className={`${styles.metaPill} ${
                  item.saved ? styles.metaPillSaved : styles.metaPillSave
                }`}
                onClick={() => onToggleSaved(item.id)}
              >
              {item.saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
              <span>{item.saved ? 'Đã lưu' : 'Lưu'}</span>
            </button>

            {item.noteCount > 0 && (
              <button type="button" className={`${styles.metaPill} ${styles.metaPillMuted}`}>
                <MessageSquareText size={14} />
                <span>Ghi chú +{item.noteCount}</span>
              </button>
            )}

            <button type="button" className={`${styles.metaPill} ${styles.metaPillInfo}`}>
              {item.listenedPercent >= 100 ? <CheckCircle2 size={14} /> : <PlayCircle size={14} />}
              <span>{getListenLabel(item.listenedPercent)}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function FavoritesContent() {
  const [viewMode, setViewMode] = useState('grid')
  const [podcasts, setPodcasts] = useState(INITIAL_PODCASTS)
  const [activeFilter, setActiveFilter] = useState('all')

  const stats = useMemo(() => {
    const saved = podcasts.filter(item => item.saved).length
    const listened = podcasts.filter(item => item.listenedPercent > 0).length
    const unheard = podcasts.filter(item => item.listenedPercent === 0).length
    const notes = podcasts.filter(item => item.noteCount > 0).length

    return [
      { key: 'saved', icon: BookMarked, value: saved, sub: 'Đã lưu' },
      { key: 'listened', icon: Headphones, value: listened, sub: 'Đã nghe' },
      { key: 'unheard', icon: Clock3, value: unheard, sub: 'Chưa nghe' },
      { key: 'notes', icon: StickyNote, value: notes, sub: 'Ghi chú' },
    ]
  }, [podcasts])

  const visiblePodcasts = useMemo(() => {
    switch (activeFilter) {
      case 'saved':
        return podcasts.filter(item => item.saved)
      case 'listened':
        return podcasts.filter(item => item.listenedPercent > 0)
      case 'unheard':
        return podcasts.filter(item => item.listenedPercent === 0)
      case 'notes':
        return podcasts.filter(item => item.noteCount > 0)
      default:
        return podcasts
    }
  }, [activeFilter, podcasts])

  const toggleSaved = id => {
    setPodcasts(prev =>
      prev.map(item => (item.id === id ? { ...item, saved: !item.saved } : item))
    )
  }

  return (
    <section className={styles.wrapper}>
      <div className={styles.mainCol}>
        <div className={styles.sectionCard}>
          <div className={styles.pageHeader}>
            <div className={styles.titleRow}>
              <div className={styles.pinIcon}>
                <MapPin size={14} />
              </div>
              <div className={styles.titleCopy}>
                <h1 className={styles.pageTitle}>Thư viện yêu thích</h1>
                <p className={styles.pageSub}>
                  Podcast đã lưu, ghi chú và ghim lại
                </p>
              </div>
            </div>

            <div className={styles.headerActions}>
              <button
                type="button"
                className={`${styles.iconBtn} ${
                  viewMode === 'grid' ? styles.iconBtnActive : ''
                }`}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid size={15} />
              </button>

              <button
                type="button"
                className={`${styles.iconBtn} ${
                  viewMode === 'list' ? styles.iconBtnActive : ''
                }`}
                onClick={() => setViewMode('list')}
              >
                <Rows3 size={15} />
              </button>
            </div>
          </div>

          <div className={styles.statsGrid}>
            {stats.map(({ key, icon: Icon, value, sub }) => (
              <button
                key={key}
                type="button"
                className={`${styles.statCard} ${
                  activeFilter === key ? styles.statCardActive : ''
                }`}
                onClick={() =>
                  setActiveFilter(prev => (prev === key ? 'all' : key))
                }
              >
                <div className={styles.statIcon}>
                  <Icon size={15} />
                </div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>{value}</div>
                  <div className={styles.statSub}>{sub}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <div>
              <h3 className={styles.sectionTitle}>Bộ sưu tập</h3>
              <p className={styles.sectionSub}>{COLLECTIONS.length} bộ</p>
            </div>
            <button type="button" className={styles.linkBtn}>
              Xem tất cả <ChevronRight size={15} />
            </button>
          </div>

          <div className={styles.collectionGrid}>
            {COLLECTIONS.map(item => (
              <button key={item.id} type="button" className={styles.collectionCard}>
                <span className={styles.collectionName}>{item.name}</span>
                <span className={styles.collectionCount}>{item.count} podcast</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <div>
              <h3 className={styles.sectionTitle}>Podcast đã lưu</h3>
              <p className={styles.sectionSub}>
                {visiblePodcasts.length} podcast{activeFilter !== 'all' ? ' đang hiển thị' : ''}
              </p>
            </div>
            <button type="button" className={styles.linkBtn}>
              Xem tất cả <ChevronRight size={15} />
            </button>
          </div>

          <div className={`${styles.savedGrid} ${viewMode === 'list' ? styles.savedGridList : ''}`}>
            {visiblePodcasts.map(item => (
              <SavedCard
                key={item.id}
                item={item}
                viewMode={viewMode}
                onToggleSaved={toggleSaved}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
