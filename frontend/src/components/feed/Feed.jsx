import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import PodcastCard from './PodcastCard'
import styles from '../../style/feed/Feed.module.css'
import { getInitials } from '../../utils/getInitials'

const TABS = [
  { label: 'Dành cho bạn', key: 'for_you' },
  { label: 'Đang theo dõi', key: 'following' },
  { label: 'Xu hướng', key: 'trending' },
  { label: 'Mới nhất', key: 'latest' },
]

export default function Feed() {
  const location = useLocation()
  const scrolledPostRef = useRef(null)
  const [activeTab, setActiveTab] = useState(0)
  const [podcasts, setPodcasts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        setLoading(true)
        setError('')

        const token = localStorage.getItem('educast_access')

        const currentTab = TABS[activeTab]?.key || 'for_you'

        const res = await fetch(
          `http://localhost:8000/api/content/feed/?limit=10&tab=${currentTab}`,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }

        const data = await res.json()

        const mapped = (data.items || []).map((item) => {
          const durationSeconds =
            Number(item.audio?.duration_seconds || item.viewer_state?.duration_seconds || 0)

          const progressSeconds =
            Number(item.viewer_state?.progress_seconds || 0)

          return {
            id: item.id,
            title: item.title,
            author: item.author?.name || 'Ẩn danh',
            authorUsername: item.author?.username || '',
            authorInitials: getInitials(item.author || 'A'),
            cover: item.thumbnail_url,
            description: item.description || '',
            tags: (item.tags || []).map((tag) => `#${tag.name}`),
            aiGenerated: false,
            duration: formatSeconds(durationSeconds),
            durationSeconds,
            current: formatSeconds(progressSeconds),
            currentSeconds: progressSeconds,
            progress: calcProgress(progressSeconds, durationSeconds),
            likes: item.stats?.likes || 0,
            liked: item.viewer_state?.is_liked || false,
            comments: item.stats?.comments || 0,
            saved: item.viewer_state?.is_saved || false,
            saveCount: item.stats?.saves || 0,
            timeAgo: formatTimeAgo(item.created_at),
            listens: `${item.listen_count || 0} lượt nghe`,
            shares: item.stats?.shares || 0,
            audioUrl: item.audio?.audio_url || '',
            audioId: item.audio?.id || '',
            voiceName: item.audio?.voice_name || '',
          }
        })

        setPodcasts(mapped)
      } catch (err) {
        console.error('Fetch feed failed:', err)
        setError('Không tải được feed')
      } finally {
        setLoading(false)
      }
    }

    fetchFeed()
  }, [activeTab])

  // Scroll to specific post if provided in location state (only on "for_you" tab)
  useEffect(() => {
    // Only scroll if on the first tab ("Dành cho bạn") and not already scrolled to this post
    if (
      activeTab === 0 &&
      location.state?.scrollToPostId &&
      scrolledPostRef.current !== location.state.scrollToPostId &&
      !loading &&
      podcasts.length > 0
    ) {
      const element = document.getElementById(`podcast-${location.state.scrollToPostId}`)
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
          // Mark that we've scrolled to this post
          scrolledPostRef.current = location.state.scrollToPostId
        }, 100)
      }
    }
  }, [activeTab, loading, podcasts, location.state?.scrollToPostId])

  return (
    <section className={styles.feed}>
      <div className={styles.tabs}>
        {TABS.map((tab, i) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === i ? styles.active : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.cards}>
        {loading && <div className={styles.feedState}>Đang tải dữ liệu...</div>}
        {error && <div className={styles.feedError}>{error}</div>}
        {!loading && !error && podcasts.map((podcast) => (
          <div key={podcast.id} id={`podcast-${podcast.id}`}>
            <PodcastCard
              podcast={podcast}
              queue={podcasts}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

function formatSeconds(seconds) {
  const total = Number(seconds || 0)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function calcProgress(current, duration) {
  const c = Number(current || 0)
  const d = Number(duration || 0)
  if (!d) return 0
  return Math.min(100, Math.round((c / d) * 100))
}

function formatTimeAgo(dateString) {
  if (!dateString) return 'Vừa xong'

  const created = new Date(dateString)
  const now = new Date()
  const diffMs = now - created
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return 'Vừa xong'
  if (diffMinutes < 60) return `${diffMinutes} phút trước`
  if (diffHours < 24) return `${diffHours} giờ trước`
  return `${diffDays} ngày trước`
}