import { useMemo, useState } from 'react'
import {
  Sparkles,
  MessageCircle,
  Share2,
  Bookmark,
  Play,
  Pause,
  Heart,
  MoreHorizontal,
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
    category: '#Lậptrình',
    tag: '#AI',
    title: 'Django REST Framework: Xây API chuẩn trong 3 phút',
    description:
      'Từ một file 80 trang tài liệu kỹ thuật, AI đã tóm tắt thành podcast ngắn dễ nghe. Bao gồm Serializers, ViewSets, Permissions và Authentication.',
    likes: 387,
    comments: 42,
    saved: false,
    liked: false,
    ai: true,
    current: '05:12',
    duration: '18:45',
    cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=300&q=80',
    progress: 32,
  },
  {
    id: 2,
    author: 'Yến Nhi',
    initials: 'YN',
    time: '5 giờ trước',
    listens: '2.3k lượt nghe',
    category: '#Lậptrình',
    tag: '#AI',
    title: 'Django REST Framework: Xây API chuẩn trong 3 phút',
    description:
      'Từ một file 80 trang tài liệu kỹ thuật, AI đã tóm tắt thành podcast ngắn dễ nghe. Bao gồm Serializers, ViewSets, Permissions và Authentication.',
    likes: 204,
    comments: 42,
    saved: true,
    liked: false,
    ai: true,
    current: '00:42',
    duration: '03:14',
    cover: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=300&q=80',
    progress: 24,
  },
]

function PostCard({ post, onToggleSave, onToggleLike }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(post.progress ?? 0)

  const handleSeek = e => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setProgress(percent)
  }

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
              <span className={styles.tag}>{post.category}</span>
              <span className={styles.tag}>{post.tag}</span>

              {post.ai && (
                <span className={styles.aiBadgeInline}>
                  <Sparkles size={13} />
                  Được tạo bởi AI
                </span>
              )}
            </div>
          </div>

          <button type="button" className={styles.menuBtn} aria-label="Thêm tùy chọn">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>

      <div className={styles.postBody}>
        <div className={styles.postText}>
          <h3 className={styles.postTitle}>{post.title}</h3>
          <p className={styles.postDesc}>{post.description}</p>
        </div>

        {post.cover && (
          <img
            src={post.cover}
            alt={post.title}
            className={styles.postCover}
          />
        )}
      </div>

      <div className={styles.audioBox}>
        <button
          type="button"
          className={`${styles.audioBtn} ${isPlaying ? styles.audioBtnPlaying : ''}`}
          onClick={() => setIsPlaying(prev => !prev)}
          aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <div className={styles.progressSection}>
          <span className={styles.audioTime}>{post.current}</span>

          <div
            className={styles.progressBar}
            onClick={handleSeek}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            tabIndex={0}
          >
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
        </div>

          <span className={styles.audioTime}>{post.duration}</span>
        </div>
      </div>

      <div className={styles.postFooter}>
        <button
          type="button"
          className={`${styles.actionBtn} ${post.liked ? styles.likedBtn : ''}`}
          onClick={() => onToggleLike(post.id)}
        >
          <Heart size={16} fill={post.liked ? 'currentColor' : 'none'} />
          <span>{post.likes}</span>
        </button>

        <button type="button" className={styles.actionBtn}>
          <MessageCircle size={16} />
          <span>{post.comments} Bình luận</span>
        </button>

        <button type="button" className={styles.actionBtn}>
          <Share2 size={16} />
          <span>Chia sẻ</span>
        </button>

        <button
          type="button"
          className={`${styles.actionBtn} ${styles.saveAction} ${post.saved ? styles.savedBtn : ''}`}
          onClick={() => onToggleSave(post.id)}
        >
          <Bookmark size={16} fill={post.saved ? 'currentColor' : 'none'} />
          <span>{post.saved ? 'Đã lưu' : 'Lưu'}</span>
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
      prev.map(post =>
        post.id === id ? { ...post, saved: !post.saved } : post
      )
    )
  }

  const toggleLikePost = id => {
  setPosts(prev =>
    prev.map(post =>
      post.id === id
        ? {
            ...post,
            liked: !post.liked,
            likes: post.liked ? post.likes - 1 : post.likes + 1,
          }
        : post
    )
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

          <div className={styles.newPostRow}>
            <span className={styles.newPostHint}>
              2 bài viết mới từ lần cuối truy cập
            </span>
            <div className={styles.newPostLine} />
          </div>
        </div>

        <div className={styles.feed}>
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onToggleSave={toggleSavePost}
              onToggleLike={toggleLikePost}
            />
          ))}
        </div>
      </div>
    </section>
  )
}