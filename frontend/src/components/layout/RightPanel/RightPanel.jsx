import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, UserPlus, X
} from 'lucide-react'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import styles from '../../../style/layout/RightPanel.module.css'
import { getToken } from '../../../utils/auth'
import { API_BASE_URL } from '../../../config/apiBase'

const FOLLOW_SYNC_EVENT = 'follow-sync-updated'

export default function RightPanel() {
  const { t } = useTranslation()
  const [followed, setFollowed] = useState({})
  const [suggestions, setSuggestions] = useState([])
  const [trending, setTrending] = useState([])
  const [showModal, setShowModal] = useState(false)

  // Load followed status from localStorage on mount
  useEffect(() => {
    const savedFollowed = localStorage.getItem('rightPanelFollowed')
    if (savedFollowed) {
      try {
        setFollowed(JSON.parse(savedFollowed))
      } catch (e) {
        console.error('Failed to parse saved followed:', e)
      }
    }
  }, [])

  // Sync follow state across components
  useEffect(() => {
    const handleFollowSync = (event) => {
      const { userId, followed: isFollowed } = event.detail || {}
      if (!userId) return

      setFollowed(prev => {
        const updated = { ...prev, [userId]: isFollowed }
        localStorage.setItem('rightPanelFollowed', JSON.stringify(updated))
        return updated
      })
    }

    window.addEventListener(FOLLOW_SYNC_EVENT, handleFollowSync)
    return () => window.removeEventListener(FOLLOW_SYNC_EVENT, handleFollowSync)
  }, [])

  // Fetch suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const token = getToken()
        const res = await fetch(`${API_BASE_URL}/social/users/suggestions/`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
        if (!res.ok) throw new Error('Failed to fetch suggestions')
        const data = await res.json()
        if (data.success && data.data && data.data.suggestions) {
          setSuggestions(data.data.suggestions)
        }
      } catch (err) {
        console.error('Failed to fetch suggestions:', err)
      }
    }
    fetchSuggestions()
  }, [])

  // Fetch trending tags
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const token = getToken()
        const res = await fetch(`${API_BASE_URL}/content/trending-tags/`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
        const data = await res.json()
        if (data.success) {
          setTrending(data.data)
        }
      } catch (err) {
        console.error('Fetch trending tags failed:', err)
      }
    }
    fetchTrending()
  }, [])

  const toggleFollow = async (userId, name) => {
    try {
      const token = getToken()
      const isCurrentlyFollowing = followed[userId] || false

      // Backend view toggle_follow_user handles both follow and unfollow at the same endpoint
      const endpoint = `${API_BASE_URL}/social/users/${userId}/follow/`

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      const serverFollowed = data.data?.followed ?? !isCurrentlyFollowing

      // Update local state
      const updated = { ...followed, [userId]: serverFollowed }
      setFollowed(updated)

      // Save to localStorage
      localStorage.setItem('rightPanelFollowed', JSON.stringify(updated))

      // Dispatch sync event for other components (like SearchResultsPage)
      window.dispatchEvent(new CustomEvent(FOLLOW_SYNC_EVENT, {
        detail: { userId, followed: serverFollowed }
      }))

      const action = !serverFollowed
        ? t('buttons.unfollow')
        : t('rightPanel.follow')

      toast.success(t('rightPanel.followSuccess', { action, name }))
    } catch (err) {
      console.error('Toggle follow failed:', err)
      toast.error(t('rightPanel.actionFailed'))
    }
  }

  return (
    <aside className={styles.panel}>

      {/* Xu hướng */}
      <div className={`${styles.widget} ${styles.trendingWidget}`}>
        <h4 className={styles.widgetTitle}>
          <TrendingUp size={15} />
          {t('rightPanel.trendingTitle')}
        </h4>
        {trending.length > 0 ? trending.map(({ tag, count, slug }) => (
          <Link to={`/hashtag/${slug}`} key={tag} className={styles.trendItem}>
            <span className={styles.trendTag}>{tag}</span>
            <span className={styles.trendCount}>
              {t('rightPanel.posts', { count })}
            </span>
          </Link>
        )) : (
          <div style={{ color: '#7f89b2', fontSize: '11px', padding: '5px 0' }}>
            {t('rightPanel.noTrending')}
          </div>
        )}
      </div>

      {/* Gợi ý theo dõi */}
      <div className={`${styles.widget} ${styles.followSuggestionWidget}`}>
        <div className={styles.widgetHeader}>
          <h4 className={styles.widgetTitle}>
            <UserPlus size={15} />
            {t('rightPanel.suggestionsTitle')}
          </h4>
          <button 
            onClick={() => setShowModal(true)} 
            className={styles.seeMoreLink}
          >
            {t('rightPanel.seeMore')}
          </button>
        </div>
        {suggestions.length > 0 ? suggestions.slice(0, 3).map(({ id, name, followers, avatar }) => (
          <div key={id} className={styles.suggestion}>
            <img src={avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${name}`} alt={name} className={styles.suggestionAvatar} />
            <div className={styles.suggestionInfo}>
              <span className={styles.suggestionName}>{name}</span>
              <span className={styles.suggestionFollowers}>
                {t('rightPanel.followers', { count: followers })}
              </span>
            </div>
            <button
              className={`${styles.followBtn} ${followed[id] ? styles.following : ''}`}
              onClick={() => toggleFollow(id, name)}
            >
              {followed[id] ? t('rightPanel.following') : t('rightPanel.follow')}
            </button>
          </div>
        )) : (
          <div style={{ color: '#7f89b2', fontSize: '12px', padding: '10px 0' }}>
            {t('rightPanel.noSuggestions')}
          </div>
        )}
      </div>

      {/* Modal danh sách gợi ý */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>
                <UserPlus size={18} />
                {t('rightPanel.allSuggestions')}
              </h3>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              {suggestions.map(({ id, name, followers, avatar, mutual_friends }) => (
                <div key={id} className={styles.modalSuggestion}>
                  <img 
                    src={avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${name}`} 
                    alt={name} 
                    className={styles.modalAvatar} 
                  />
                  <div className={styles.modalInfo}>
                    <span className={styles.modalName}>{name}</span>
                    <div className={styles.modalMeta}>
                      <span>{t('rightPanel.followers', { count: followers })}</span>
                      {mutual_friends > 0 && (
                        <>
                          <span className={styles.dot}>•</span>
                          <span className={styles.mutualCount}>
                            {t('rightPanel.mutualCount', { count: mutual_friends })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    className={`${styles.modalFollowBtn} ${followed[id] ? styles.following : ''}`}
                    onClick={() => toggleFollow(id, name)}
                  >
                    {followed[id] ? t('rightPanel.following') : t('rightPanel.follow')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
