import { useState } from 'react'
import {
  Target, TrendingUp, UserPlus,
  Bot, Send, CheckCircle2
} from 'lucide-react'
import styles from '../../../style/layout/RightPanel.module.css'

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
  { name: 'Linh Đặng Tech', followers: '24.5k', avatar: 'https://i.pravatar.cc/36?img=5' },
  { name: 'AI Minh Trâm',   followers: '18.3k', avatar: 'https://i.pravatar.cc/36?img=9' },
  { name: 'Code with Hoa',  followers: '11.8k', avatar: 'https://i.pravatar.cc/36?img=16' },
]

export default function RightPanel() {
  const [followed, setFollowed] = useState({})
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Xin chào! Tôi có thể giúp bạn tìm kiếm podcast, giải thích khái niệm, hoặc lập lộ trình học tập. Bạn muốn học gì hôm nay?' }
  ])

  const sendMessage = () => {
    if (!chatInput.trim()) return
    setMessages(m => [
      ...m,
      { role: 'user', text: chatInput },
      { role: 'ai',  text: 'Câu hỏi hay! Hãy để tôi tìm kiếm các podcast liên quan cho bạn...' }
    ])
    setChatInput('')
  }

  const toggleFollow = name =>
    setFollowed(f => ({ ...f, [name]: !f[name] }))

  return (
    <aside className={styles.panel}>

      {/* Lộ trình hôm nay */}
      <div className={styles.widget}>
        <h4 className={styles.widgetTitle}>
          <Target size={15} />
          Lộ trình hôm nay
        </h4>
        <p className={styles.roadmapSub}>Python for AI – Sprint 1/3</p>
        <div className={styles.roadmapList}>
          {ROADMAP.map(item => (
            <div
              key={item.label}
              className={`${styles.roadmapItem} ${item.done ? styles.done : ''} ${item.active ? styles.active : ''}`}
            >
              <CheckCircle2 size={14} className={styles.check} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Xu hướng */}
      <div className={styles.widget}>
        <h4 className={styles.widgetTitle}>
          <TrendingUp size={15} />
          Xu hướng
        </h4>
        {TRENDING.map(({ tag, count }) => (
          <div key={tag} className={styles.trendItem}>
            <span className={styles.trendTag}>{tag}</span>
            <span className={styles.trendCount}>{count}</span>
          </div>
        ))}
      </div>

      {/* Gợi ý theo dõi */}
      <div className={styles.widget}>
        <h4 className={styles.widgetTitle}>
          <UserPlus size={15} />
          Gợi ý theo dõi
        </h4>
        {SUGGESTIONS.map(({ name, followers, avatar }) => (
          <div key={name} className={styles.suggestion}>
            <img src={avatar} alt={name} className={styles.suggestionAvatar} />
            <div className={styles.suggestionInfo}>
              <span className={styles.suggestionName}>{name}</span>
              <span className={styles.suggestionFollowers}>{followers} người theo dõi</span>
            </div>
            <button
              className={`${styles.followBtn} ${followed[name] ? styles.following : ''}`}
              onClick={() => toggleFollow(name)}
            >
              {followed[name] ? 'Đang theo dõi' : 'Theo dõi'}
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
              {msg.text}
            </div>
          ))}
        </div>
        <div className={styles.chatInput}>
          <input
            type="text"
            placeholder="Hỏi AI về podcast..."
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
