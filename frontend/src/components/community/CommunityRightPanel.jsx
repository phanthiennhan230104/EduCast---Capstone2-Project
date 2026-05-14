import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Target, UserPlus, Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../utils/api'
import styles from '../../style/community/CommunityRightPanel.module.css'

function formatTimeAgo(raw) {
  if (!raw) return ''
  const date = new Date(raw)
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000))
  if (diffMinutes < 1) return 'Vừa xong'
  if (diffMinutes < 60) return `${diffMinutes} phút trước`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} giờ trước`
  return `${Math.floor(diffHours / 24)} ngày trước`
}

function UserRow({ item, onToggle }) {
  const navigate = useNavigate()

  return (
    <div className={styles.userRow}>
      <button
        type="button"
        className={styles.avatarButton}
        onClick={() => item.id && navigate(`/profile/${item.id}`)}
        aria-label="Mở trang cá nhân"
      >
        {item.avatar_url ? (
          <img src={item.avatar_url} alt={item.name} className={styles.avatarImg} />
        ) : (
          <span>{item.initials || 'U'}</span>
        )}
      </button>

      <button
        type="button"
        className={styles.userInfoButton}
        onClick={() => item.id && navigate(`/profile/${item.id}`)}
      >
        <div className={styles.name}>{item.name || item.display_name || item.username}</div>
        <div className={styles.meta}>{item.followers_count || 0} người theo dõi</div>
      </button>

      <button
        type="button"
        className={`${styles.followBtn} ${item.is_following ? styles.following : ''}`}
        onClick={() => onToggle(item.id)}
      >
        {item.is_following ? 'Đang theo dõi' : 'Theo dõi'}
      </button>
    </div>
  )
}

export default function CommunityRightPanel() {
  const { t } = useTranslation()
  const [followingList, setFollowingList] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [activities, setActivities] = useState([])
  const [followingCount, setFollowingCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    const loadPanel = async () => {
      try {
        const response = await apiRequest('/social/community/?limit=5')
        if (cancelled) return

        const data = response.data || {}
        setFollowingList(Array.isArray(data.following_people) ? data.following_people : [])
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
        setActivities(Array.isArray(data.activities) ? data.activities : [])
        setFollowingCount(Number(data.following_count || 0))
      } catch (error) {
        if (!cancelled) {
          console.error('Load community panel failed:', error)
          setFollowingList([])
          setSuggestions([])
          setActivities([])
          setFollowingCount(0)
        }
      }
    }

    loadPanel()
    return () => {
      cancelled = true
    }
  }, [])

  const toggleUser = async (id) => {
    const update = (items, followed) =>
      items.map((item) =>
        String(item.id) === String(id)
          ? { ...item, is_following: followed }
          : item
      )

    const target =
      followingList.find((item) => String(item.id) === String(id)) ||
      suggestions.find((item) => String(item.id) === String(id))
    if (!target) return

    const nextFollowed = !target.is_following
    setFollowingList((prev) => update(prev, nextFollowed))
    setSuggestions((prev) => update(prev, nextFollowed))

    try {
      const response = await apiRequest(`/social/users/${encodeURIComponent(id)}/follow/`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const followed = Boolean(response.data?.followed)
      setFollowingList((prev) => update(prev, followed))
      setSuggestions((prev) => update(prev, followed))
      setFollowingCount((prev) =>
        Math.max(0, prev + (followed === target.is_following ? 0 : followed ? 1 : -1))
      )
    } catch (error) {
      console.error('Toggle community follow failed:', error)
      setFollowingList((prev) => update(prev, target.is_following))
      setSuggestions((prev) => update(prev, target.is_following))
    }
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <Target size={16} />
          <span>{t('communityRightPanel.followingTitle')}</span>
          <span className={styles.count}>{followingCount}</span>
        </h3>

        <div className={styles.userList}>
          {followingList.map((item) => (
            <UserRow key={item.id} item={item} onToggle={toggleUser} />
          ))}
          {followingList.length === 0 && (
            <div className={styles.emptyText}>Bạn chưa theo dõi ai</div>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <UserPlus size={16} />
          <span>{t('communityRightPanel.suggestionsTitle')}</span>
        </h3>

        <div className={styles.userList}>
          {suggestions.map((item) => (
            <UserRow key={item.id} item={item} onToggle={toggleUser} />
          ))}
          {suggestions.length === 0 && (
            <div className={styles.emptyText}>Chưa có gợi ý phù hợp</div>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <Bell size={16} />
          <span>{t('communityRightPanel.recentActivities')}</span>
        </h3>

        <div className={styles.activityList}>
          {activities.map((item) => (
            <div key={item.id} className={styles.activityRow}>
              <div className={styles.dot} />
              <div className={styles.activityContent}>
                <div className={styles.activityText}>{item.text}</div>
                <div className={styles.activityTime}>{formatTimeAgo(item.created_at)}</div>
              </div>
            </div>
          ))}
          {activities.length === 0 && (
            <div className={styles.emptyText}>Chưa có hoạt động mới</div>
          )}
        </div>
      </div>
    </aside>
  )
}
