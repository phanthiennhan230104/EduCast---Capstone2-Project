import { useState } from 'react'
import { Target, UserPlus, Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from '../../style/community/CommunityRightPanel.module.css'

const INITIAL_FOLLOWING = [
  { id: 1, name: 'Bạch Thiên', count: '29 người theo dõi', following: true },
  { id: 2, name: 'Trâm', count: '12 người theo dõi', following: true },
  { id: 3, name: 'Tin', count: '20 người theo dõi', following: true },
  { id: 4, name: 'Hoàng', count: '24 người theo dõi', following: true },
  { id: 5, name: 'Nhân', count: '23 người theo dõi', following: true },
]

const INITIAL_SUGGESTIONS = [
  { id: 1, name: 'YongBGTik', desc: 'Lập trình', following: false },
  { id: 2, name: 'Nuzzc', desc: 'Tâm lý học', following: false },
  { id: 3, name: 'LittleBoiz', desc: 'Tâm lý học', following: false },
]

const ACTIVITIES = [
  { id: 1, text: 'Tin vừa đăng podcast mới', time: '24 phút trước' },
  { id: 2, text: 'Bạch Thiên thích bài của Nhân', time: '25 phút trước' },
]

export default function CommunityRightPanel() {
  const { t } = useTranslation()
  const [followingList, setFollowingList] = useState(INITIAL_FOLLOWING)
  const [suggestions, setSuggestions] = useState(INITIAL_SUGGESTIONS)

  const toggleFollowing = id => {
    setFollowingList(prev =>
      prev.map(item =>
        item.id === id ? { ...item, following: !item.following } : item
      )
    )
  }

  const toggleSuggestion = id => {
    setSuggestions(prev =>
      prev.map(item =>
        item.id === id ? { ...item, following: !item.following } : item
      )
    )
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <Target size={16} />
          <span>{t('communityRightPanel.followingTitle')}</span>
          <span className={styles.count}>12</span>
        </h3>

        <div className={styles.userList}>
          {followingList.map(item => (
            <div key={item.id} className={styles.userRow}>
              <div className={styles.avatar} />

              <div className={styles.userInfo}>
                <div className={styles.name}>{item.name}</div>
                <div className={styles.meta}>{item.count}{t('communityRightPanel.followers')}</div>
              </div>

              <button
                className={`${styles.followBtn} ${item.following ? styles.following : ''}`}
                onClick={() => toggleFollowing(item.id)}
              >
                {item.following
  ? t('communityRightPanel.following')
  : t('communityRightPanel.follow')}
              </button>
            </div>
          ))}
        </div>

        <button type="button" className={styles.viewMore}>
          {t('communityRightPanel.viewAllPeople', { count: 12 })}{' '}
<span aria-hidden="true">→</span>
        </button>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <UserPlus size={16} />
          <span>{t('communityRightPanel.suggestionsTitle')}</span>
        </h3>

        <div className={styles.userList}>
          {suggestions.map(item => (
            <div key={item.id} className={styles.userRow}>
              <div className={styles.avatar} />

              <div className={styles.userInfo}>
                <div className={styles.name}>{item.name}</div>
                <div className={styles.meta}>{item.desc}</div>
              </div>

              <button
                className={`${styles.followBtn} ${item.following ? styles.following : ''}`}
                onClick={() => toggleSuggestion(item.id)}
              >
                {item.following ? 'Đang theo dõi' : 'Theo dõi'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <Bell size={16} />
          <span>{t('communityRightPanel.recentActivities')}</span>
        </h3>

        <div className={styles.activityList}>
          {ACTIVITIES.map(item => (
            <div key={item.id} className={styles.activityRow}>
              <div className={styles.dot} />
              <div className={styles.activityContent}>
                <div className={styles.activityText}>{item.text}</div>
                <div className={styles.activityTime}>{item.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}