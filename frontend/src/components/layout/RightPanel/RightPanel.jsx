import { useState, useEffect } from 'react'
import {
  Target, TrendingUp, UserPlus,
  Bot, Send, CheckCircle2
} from 'lucide-react'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import styles from '../../../style/layout/RightPanel.module.css'
import { getToken } from '../../../utils/auth'

const ROADMAP = [
  { label: 'Python Cơ Bản – Tập 1', done: true },
  { label: 'Python Cơ Bản – Tập 2', done: true },
  { label: 'Python cho AI – Tập 3', done: false, active: true },
  { label: 'NumPy & Pandas – Tập 4', done: false },
]

const TRENDING = [
  { tag: '#Python', count: '12.4k bài' },
  { tag: '#AIViệtNam', count: '8.7k bài' },
  { tag: '#MachineLearning', count: '6.2k bài' },
  { tag: '#ReactJS', count: '5.9k bài' },
  { tag: '#StartupVN', count: '4.1k bài' },
]

const SUGGESTIONS = [
  { id: 1, name: 'Linh Đặng Tech', followers: '24.5k', avatar: 'https://i.pravatar.cc/36?img=5' },
  { id: 2, name: 'AI Minh Trâm',   followers: '18.3k', avatar: 'https://i.pravatar.cc/36?img=9' },
  { id: 3, name: 'Code with Hoa',  followers: '11.8k', avatar: 'https://i.pravatar.cc/36?img=16' },
]

export default function RightPanel() {
  const { t } = useTranslation()
  const [followed, setFollowed] = useState({})
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState([
  { role: 'ai', textKey: 'rightPanel.aiGreeting' }
])

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

  const sendMessage = () => {
    if (!chatInput.trim()) return
    setMessages(m => [
      ...m,
      { role: 'user', text: chatInput },
      { role: 'ai', textKey: 'rightPanel.aiReply' }
    ])
    setChatInput('')
  }

  const toggleFollow = async (userId, name) => {
    try {
      const token = getToken()
      const isCurrentlyFollowing = followed[name] || false

      const endpoint = isCurrentlyFollowing
        ? `http://localhost:8000/api/social/users/${userId}/unfollow/`
        : `http://localhost:8000/api/social/users/${userId}/follow/`

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

      // Update local state
      const updated = { ...followed, [name]: !isCurrentlyFollowing }
      setFollowed(updated)
      
      // Save to localStorage
      localStorage.setItem('rightPanelFollowed', JSON.stringify(updated))
      
      const action = isCurrentlyFollowing
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
        {TRENDING.map(({ tag, count }) => (
          <div key={tag} className={styles.trendItem}>
            <span className={styles.trendTag}>{tag}</span>
            <span className={styles.trendCount}>
  {t('rightPanel.posts', { count })}
</span>
          </div>
        ))}
      </div>

      {/* Gợi ý theo dõi */}
      <div className={`${styles.widget} ${styles.followSuggestionWidget}`}>
        <h4 className={styles.widgetTitle}>
          <UserPlus size={15} />
          {t('rightPanel.suggestionsTitle')}
        </h4>
        {SUGGESTIONS.map(({ name, followers, avatar }) => (
          <div key={name} className={styles.suggestion}>
            <img src={avatar} alt={name} className={styles.suggestionAvatar} />
            <div className={styles.suggestionInfo}>
              <span className={styles.suggestionName}>{name}</span>
              <span className={styles.suggestionFollowers}>
  {t('rightPanel.followers', { count: followers })}
</span>
            </div>
            <button
              className={`${styles.followBtn} ${followed[name] ? styles.following : ''}`}
              onClick={() => toggleFollow(name)}
            >
              {followed[name] ? t('rightPanel.following') : t('rightPanel.follow')}
            </button>
          </div>
        ))}
      </div>

      {/* AI Learning Assistant */}
      <div className={`${styles.widget} ${styles.chatWidget}`}>
        <h4 className={styles.widgetTitle}>
          <Bot size={15} />
          AI Learning Assistant
        </h4>
        <div className={styles.chatMessages}>
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`${styles.msg} ${msg.role === 'user' ? styles.msgUser : styles.msgAi}`}
            >
              {msg.textKey ? t(msg.textKey) : msg.text}
            </div>
          ))}
        </div>
        <div className={styles.chatInput}>
          <input
            type="text"
            placeholder={t('rightPanel.aiPlaceholder')}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
          />
          <button className={styles.sendBtn} onClick={sendMessage}>
            <Send size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
