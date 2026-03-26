import { useMemo, useState } from 'react'
import {
  Sparkles,
  MessageCircle,
  Share2,
  Bookmark,
  BookmarkCheck,
  Play,
  Pause,
} from 'lucide-react'
import styles from '../../style/community/Community.module.css'

const FOLLOWING = [
  { id: 1, name: 'T. Trâm', initials: 'TT', active: true },
  { id: 2, name: 'P. Nhân', initials: 'PN', active: true },
  { id: 3, name: 'T. Tín', initials: 'TT', active: false },
  { id: 4, name: 'M. Hoàng', initials: 'MH', active: true },
  { id: 5, name: 'B. Thiên', initials: 'BT', active: true },
  { id: 6, name: 'Y. Nhi', initials: 'YN', active: true },
  { id: 7, name: 'Rye', initials: 'R', active: false },
  { id: 8, name: '+5', initials: '+5', active: false, more: true },
]

const POSTS = [
  {
    id: 1,
    author: 'Thanh Trâm',
    initials: 'TT',
    time: '3 giờ trước',
    listens: '6.1k lượt nghe',
    category: 'Lập trình',
    tag: 'AI',
    title: 'Django REST Framework: Xây API chuẩn trong 3 phút',
    description:
      'Từ một file 80 trang tài liệu kỹ thuật, AI đã tóm tắt thành podcast ngắn dễ nghe. Bao gồm Serializers, ViewSets, Permissions và Authentication.',
    likes: 387,
    comments: 42,
    saved: false,
    ai: true,
  },
  {
    id: 2,
    author: 'Yến Nhi',
    initials: 'YN',
    time: '5 giờ trước',
    listens: '2.3k lượt nghe',
    category: 'Lập trình',
    tag: 'AI',
    title: 'Django REST Framework: Xây API chuẩn trong 3 phút',
    description:
      'Từ một file 80 trang tài liệu kỹ thuật, AI đã tóm tắt thành podcast ngắn dễ nghe. Bao gồm Serializers, ViewSets, Permissions và Authentication.',
    likes: 204,
    comments: 42,
    saved: true,
    ai: true,
  },
]

function FeedWave() {
  const bars = [
    14, 12, 9, 10, 15, 14, 17, 8, 12, 18, 13, 9, 15, 12, 8, 14, 11, 10, 9, 12,
  ]

  return (
    <div className={styles.wave}>
      {bars.map((h, i) => (
        <span
          key={i}
          className={`${styles.waveBar} ${i < 10 ? styles.waveBarActive : ''}`}
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  )
}

function PostCard({ post, onToggleSave }) {
  const [isPlaying, setIsPlaying] = useState(false)

  return (
    <article className={styles.postCard}>
      <div className={styles.postHead}>
        <div className={styles.authorRow}>
          <div className={styles.avatar}>{post.initials}</div>

          <div className={styles.authorMeta}>
            <div className={styles.authorTop}>
              <span className={styles.authorName}>{post.author}</span>
              <span className={styles.dot}>•</span>
              <span>{post.time}</span>
              <span className={styles.dot}>•</span>
              <span>{post.listens}</span>
            </div>

            <div className={styles.authorTags}>
              <span className={styles.categoryPill}>{post.category}</span>
              <span className={styles.aiPill}>{post.tag}</span>
            </div>
          </div>
        </div>
      </div>

      {post.ai && (
        <div className={styles.aiBadge}>
          <Sparkles size={13} />
          Được tạo bởi AI
        </div>
      )}

      <h3 className={styles.postTitle}>{post.title}</h3>
      <p className={styles.postDesc}>{post.description}</p>

      <div className={styles.audioBox}>
        <button
          type="button"
          className={styles.audioBtn}
          onClick={() => setIsPlaying(prev => !prev)}
          aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>

        <FeedWave />

        <span className={styles.audioTime}>3:14</span>
      </div>

      <div className={styles.postFooter}>
        <button type="button" className={styles.actionBtn}>
          <span className={styles.likeIcon}>❤</span>
          {post.likes}
        </button>

        <button type="button" className={styles.actionBtn}>
          <MessageCircle size={15} />
          {post.comments} Bình luận
        </button>

        <button type="button" className={styles.actionBtn}>
          <Share2 size={15} />
          Chia sẻ
        </button>

        <button
          type="button"
          className={`${styles.actionBtn} ${post.saved ? styles.savedBtn : ''}`}
          onClick={() => onToggleSave(post.id)}
        >
          {post.saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
          {post.saved ? 'Đã lưu' : 'Lưu'}
        </button>
      </div>
    </article>
  )
}

export default function Community() {
  const [activeTab, setActiveTab] = useState('all')
  const [posts, setPosts] = useState(POSTS)

  const tabMeta = useMemo(
    () => [
      { key: 'all', label: 'Tất cả bài viết mới' },
      { key: 'today', label: 'Hôm nay' },
      { key: 'week', label: 'Tuần này' },
    ],
    []
  )

  const toggleSavePost = id => {
    setPosts(prev =>
      prev.map(post => (post.id === id ? { ...post, saved: !post.saved } : post))
    )
  }

  return (
    <section className={styles.wrapper}>
      <div className={styles.content}>
        <div className={styles.topCard}>
          <div className={styles.sectionTitleRow}>
            <h2 className={styles.sectionTitle}>Đang theo dõi</h2>
            <div className={styles.sectionLine} />
          </div>

          <div className={styles.followingRow}>
            {FOLLOWING.map(item => (
              <button
                key={item.id}
                type="button"
                className={`${styles.followingItem} ${item.more ? styles.followingMore : ''}`}
              >
                <div className={styles.followingAvatar}>{item.initials}</div>
                <span className={styles.followingName}>{item.name}</span>
                {!item.more && item.active && <span className={styles.activeDot} />}
              </button>
            ))}
          </div>

          <div className={styles.tabs}>
            {tabMeta.map(tab => (
              <button
                key={tab.key}
                type="button"
                className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={styles.newPostHint}>2 bài viết mới từ lần cuối truy cập</div>
        </div>

        <div className={styles.feed}>
          {posts.map(post => (
            <PostCard key={post.id} post={post} onToggleSave={toggleSavePost} />
          ))}
        </div>
      </div>
    </section>
  )
}