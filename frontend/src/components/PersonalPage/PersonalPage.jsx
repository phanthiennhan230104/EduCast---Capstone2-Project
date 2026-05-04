import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../../utils/api'
import { toast } from 'react-toastify'
import {
  CheckCircle2,
  Edit3,
  Share2,
  MoreHorizontal,
  Image as ImageIcon,
  Smile,
  MapPin,
  Briefcase,
  GraduationCap,
  Calendar,
  Heart,
  MessageCircle,
  PlayCircle,
  Clock,
} from 'lucide-react'
import styles from '../../style/personal/PersonalPage.module.css'

const TABS = ['Bài đăng', 'Podcast', 'Bạn bè']

const SAMPLE_POSTS = [
  {
    id: 1,
    author: 'Nguyễn Văn Anh',
    avatar: 'https://i.pravatar.cc/150?img=11',
    time: '2 giờ trước',
    content:
      'Vừa hoàn thành xong series Podcast về "Ứng dụng AI trong giáo dục". Mọi người cùng đón nghe nhé! 🎧🚀',
    likes: 245,
    comments: 42,
    shares: 12,
    podcastEmbed: {
      title: 'Tập 1: AI đang thay đổi cách chúng ta học như thế nào?',
      duration: '45:20',
      thumbnail: 'https://picsum.photos/seed/podcast1/400/225',
    },
  },
  {
    id: 2,
    author: 'Nguyễn Văn Anh',
    avatar: 'https://i.pravatar.cc/150?img=11',
    time: 'Hôm qua lúc 14:30',
    content:
      'Góc chia sẻ: Để duy trì thói quen làm podcast mỗi tuần, mình thường dành riêng sáng Chủ Nhật để lên kịch bản và thu âm. Các bạn creator khác quản lý thời gian thế nào? 👇',
    likes: 189,
    comments: 56,
    shares: 4,
  },
]

const SAMPLE_PODCASTS = [
  {
    id: 1,
    title: 'Bắt đầu với Machine Learning',
    duration: '32:15',
    plays: '12.5k',
    date: '2 ngày trước',
    img: 'https://picsum.photos/seed/p1/300/300',
  },
  {
    id: 2,
    title: 'Tương lai của ReactJS 2026',
    duration: '45:00',
    plays: '8.2k',
    date: '1 tuần trước',
    img: 'https://picsum.photos/seed/p2/300/300',
  },
  {
    id: 3,
    title: 'Phỏng vấn: Hành trình làm Dev',
    duration: '55:30',
    plays: '15.1k',
    date: '2 tuần trước',
    img: 'https://picsum.photos/seed/p3/300/300',
  },
  {
    id: 4,
    title: 'Giải mã thuật toán AI',
    duration: '28:40',
    plays: '9.3k',
    date: '3 tuần trước',
    img: 'https://picsum.photos/seed/p4/300/300',
  },
]

const SAMPLE_FRIENDS = [
  {
    name: 'Trần Minh',
    mutual: 12,
    avatar: 'https://i.pravatar.cc/150?img=33',
  },
  {
    name: 'Lê Hoa',
    mutual: 8,
    avatar: 'https://i.pravatar.cc/150?img=44',
  },
  {
    name: 'Phạm Hùng',
    mutual: 24,
    avatar: 'https://i.pravatar.cc/150?img=55',
  },
  {
    name: 'Đặng Linh',
    mutual: 5,
    avatar: 'https://i.pravatar.cc/150?img=5',
  },
  {
    name: 'Vũ Trâm',
    mutual: 18,
    avatar: 'https://i.pravatar.cc/150?img=9',
  },
  {
    name: 'Hoàng Nam',
    mutual: 2,
    avatar: 'https://i.pravatar.cc/150?img=12',
  },
]

export default function PersonalPage() {
  const [activeTab, setActiveTab] = useState('Bài đăng')
  const [posts, setPosts] = useState([])
  const [podcasts, setPodcasts] = useState([])
  const [friends, setFriends] = useState([])
  const [userProfile, setUserProfile] = useState(null)
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [likedPosts, setLikedPosts] = useState(new Set())
  const [playingPostId, setPlayingPostId] = useState(null)
  const { user } = useAuth()
  const navigate = useNavigate()

  React.useEffect(() => {
    if (!user?.id) return
    fetchUserProfile()
    fetchUserPosts()
    fetchUserPodcasts()
    fetchUserFriends()
  }, [user?.id])

  const fetchUserProfile = async () => {
    try {
      const data = await apiRequest(`/users/${user.id}/profile/`)
      setUserProfile(data.data || {})
    } catch (err) {
      console.error('Failed to fetch user profile:', err)
    }
  }

  const fetchUserPosts = async () => {
    try {
      setLoadingPosts(true)
      const data = await apiRequest(`/content/users/${user?.id}/posts/?limit=100`)
      setPosts(data.data?.posts || [])
    } catch (err) {
      console.error('Failed to fetch posts:', err)
      setPosts([])
    } finally {
      setLoadingPosts(false)
    }
  }

  const fetchUserPodcasts = async () => {
    try {
      const data = await apiRequest(`/content/drafts/my/?limit=100`)
      setPodcasts(data.data?.results || data.data?.drafts || [])
    } catch (err) {
      console.error('Failed to fetch podcasts:', err)
      setPodcasts([])
    }
  }

  const fetchUserFriends = async () => {
    try {
      const data = await apiRequest('/social/follow-list/')
      setFriends(data.data?.following || [])
    } catch (err) {
      console.error('Failed to fetch friends:', err)
      setFriends([])
    }
  }

  const handleEditProfile = () => {
    navigate('/settings?tab=profile')
  }

  const handleShareProfile = async () => {
    if (!user?.username) return
    const profileUrl = `${window.location.origin}/profile/${user.username}`
    if (navigator.share) {
      await navigator.share({
        title: `${user.username}'s EduCast Profile`,
        text: `Xem trang cá nhân của ${user.username} trên EduCast`,
        url: profileUrl,
      })
    } else {
      navigator.clipboard.writeText(profileUrl)
      toast.success('Đã sao chép liên kết')
    }
  }

  const handleMoreOptions = () => {
    toast.info('Các tùy chọn khác')
  }

  const handleLikePost = async (postId) => {
    try {
      setLikedPosts((prev) => {
        const next = new Set(prev)
        if (next.has(postId)) {
          next.delete(postId)
        } else {
          next.add(postId)
        }
        return next
      })
      // TODO: Call API to persist like
    } catch (err) {
      console.error('Failed to like post:', err)
    }
  }

  const handleCommentPost = (postId) => {
    toast.info('Mở modal bình luận')
    // TODO: Open comment modal
  }

  const handleSharePost = (post) => {
    toast.info('Chia sẻ bài đăng')
    // TODO: Open share modal or share to friends
  }

  const displayPosts = posts.length > 0 ? posts : SAMPLE_POSTS
  const displayPodcasts = podcasts.length > 0 ? podcasts : SAMPLE_PODCASTS
  const displayFriends = friends.length > 0 ? friends : SAMPLE_FRIENDS

  return (
    <div className={styles.container}>
      {/* Cover & Profile Header */}
      <div className={styles.header}>
        {/* Cover Photo */}
        <div className={styles.coverPhoto}>
          <img
            src={userProfile?.cover_url || "https://picsum.photos/seed/cover/1200/400"}
            alt="Cover"
            className={styles.coverImage}
          />
          <button className={styles.editCoverBtn}>
            <ImageIcon size={16} />
            <span className={styles.editCoverText}>Chỉnh sửa ảnh bìa</span>
          </button>
        </div>

        {/* Profile Info Row */}
        <div className={styles.profileSection}>
          <div className={styles.profileRow}>
            {/* Avatar */}
            <div className={styles.avatarWrapper}>
              <div className={styles.avatar}>
                <img
                  src={userProfile?.avatar_url || user?.avatar_url || "https://i.pravatar.cc/300?img=11"}
                  alt="Avatar"
                  className={styles.avatarImage}
                />
              </div>
              <button className={styles.editAvatarBtn}>
                <ImageIcon size={16} />
              </button>
            </div>

            {/* Name & Stats */}
            <div className={styles.profileInfo}>
              <h1 className={styles.profileName}>
                {userProfile?.display_name || user?.username || 'User'}
                <CheckCircle2 size={20} className={styles.verifyBadge} />
              </h1>
              <p className={styles.profileStats}>
                {displayPodcasts.length || 0} Podcast · {userProfile?.followers_count || 0} Người theo dõi · {userProfile?.following_count || 0} Đang theo dõi
              </p>
            </div>

            {/* Actions */}
            <div className={styles.actions}>
              <button className={styles.editBtn} onClick={handleEditProfile}>
                <Edit3 size={16} />
                Chỉnh sửa
              </button>
              <button className={styles.shareBtn} onClick={handleShareProfile}>
                <Share2 size={16} />
                Chia sẻ
              </button>
              <button className={styles.moreBtn} onClick={handleMoreOptions}>
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>

          {/* Bio */}
          <p className={styles.bio}>
            {userProfile?.bio || user?.bio || 'Podcaster | AI Enthusiast | Chia sẻ kiến thức công nghệ mỗi ngày 🎙️🚀'}
          </p>
        </div>

        {/* Tabs */}
        <div className={styles.tabsContainer}>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${styles.tabBtn} ${activeTab === tab ? styles.activeTab : ''}`}
            >
              {tab}
              {activeTab === tab && <motion.div layoutId="activeTab" className={styles.tabIndicator} />}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className={styles.contentWrapper}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'Bài đăng' && (
              <div className={styles.tabContent}>
                <div className={styles.postsLayout}>
                  {displayPosts.map((post) => (
                    <div key={post.id} className={styles.postCard}>
                      <div className={styles.postHeader}>
                        <div className={styles.postAuthor}>
                          <img src={post.avatar || userProfile?.avatar_url || "https://i.pravatar.cc/150?img=1"} alt={post.author} className={styles.smallAvatar} />
                          <div>
                            <h4 className={styles.authorName}>{post.author || user?.username}</h4>
                            <p className={styles.postTime}>{post.timeAgo || post.time || post.created_at}</p>
                          </div>
                        </div>
                        <button className={styles.postMenuBtn}>
                          <MoreHorizontal size={20} />
                        </button>
                      </div>

                      <p className={styles.postContent}>{post.description || post.content}</p>

                      {/* Audio Player */}
                      {post.audio_url && (
                        <div className={styles.audioPlayer}>
                          <div className={styles.audioControls}>
                            <button 
                              className={styles.playBtn}
                              onClick={() => setPlayingPostId(playingPostId === post.id ? null : post.id)}
                            >
                              {playingPostId === post.id ? '⏸' : '▶'}
                            </button>
                            <div className={styles.audioProgressBar}>
                              <div className={styles.progress}></div>
                              <span className={styles.duration}>{post.duration_seconds ? `${Math.floor(post.duration_seconds / 60)}:${String(post.duration_seconds % 60).padStart(2, '0')}` : '00:00'}</span>
                            </div>
                          </div>
                          {post.thumbnail_url && (
                            <img src={post.thumbnail_url} alt="Thumbnail" className={styles.audioCover} />
                          )}
                        </div>
                      )}

                      {post.podcastEmbed && (
                        <div className={styles.podcastEmbed}>
                          <div className={styles.podcastThumbnail}>
                            <img src={post.podcastEmbed.thumbnail} alt="Podcast" className={styles.thumbnailImage} />
                            <div className={styles.podcastOverlay}>
                              <PlayCircle size={48} className={styles.playIcon} />
                            </div>
                            <div className={styles.durationBadge}>
                              <Clock size={12} />
                              {post.podcastEmbed.duration}
                            </div>
                          </div>
                          <div className={styles.podcastInfo}>
                            <h5 className={styles.podcastTitle}>{post.podcastEmbed.title}</h5>
                            <p className={styles.podcastLabel}>Podcast • EduCast</p>
                          </div>
                        </div>
                      )}

                      <div className={styles.postStats}>
                        <div className={styles.likeCount}>
                          <div className={styles.likeBadge}>
                            <Heart size={10} className={styles.likeIcon} />
                          </div>
                          <span>{post.like_count || post.likes || 0}</span>
                        </div>
                        <div className={styles.otherStats}>
                          <span>{post.comment_count || post.comments || 0} bình luận</span>
                          <span>{post.share_count || post.shares || 0} chia sẻ</span>
                        </div>
                      </div>

                      <div className={styles.postActions}>
                        <button 
                          className={`${styles.postActionBtn} ${likedPosts.has(post.id) ? styles.liked : ''}`}
                          onClick={() => handleLikePost(post.id)}
                        >
                          <Heart size={18} fill={likedPosts.has(post.id) ? 'currentColor' : 'none'} />
                          <span>Thích</span>
                        </button>
                        <button 
                          className={styles.postActionBtn}
                          onClick={() => handleCommentPost(post.id)}
                        >
                          <MessageCircle size={18} />
                          <span>Bình luận</span>
                        </button>
                        <button 
                          className={styles.postActionBtn}
                          onClick={() => handleSharePost(post)}
                        >
                          <Share2 size={18} />
                          <span>Chia sẻ</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'Podcast' && (
              <div className={styles.tabContent}>
                <h3 className={styles.cardTitle}>Podcast của tôi</h3>
                <div className={styles.podcastsGrid}>
                  {displayPodcasts.map((pod) => (
                    <div key={pod.id} className={styles.podcastItem}>
                      <div className={styles.podcastItemThumbnail}>
                        <img src={pod.img || pod.thumbnail_url} alt={pod.title} className={styles.thumbnailImage} />
                        <div className={styles.podcastItemOverlay}>
                          <PlayCircle size={24} className={styles.playIcon} />
                        </div>
                      </div>
                      <div className={styles.podcastItemInfo}>
                        <h4 className={styles.podcastItemTitle}>{pod.title}</h4>
                        <div className={styles.podcastItemMeta}>
                          <span className={styles.metaItem}>
                            <Clock size={12} /> {pod.duration}
                          </span>
                          <span className={styles.metaItem}>
                            <PlayCircle size={12} /> {pod.plays}
                          </span>
                        </div>
                        <p className={styles.podcastItemDate}>{pod.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'Bạn bè' && (
              <div className={styles.tabContent}>
                <div className={styles.tabContentHeader}>
                  <h3 className={styles.cardTitle}>Bạn bè</h3>
                  <div className={styles.friendsCount}>{displayFriends.length} người</div>
                </div>
                <div className={styles.friendsGrid}>
                  {displayFriends.map((friend) => (
                    <div key={friend.name || friend.username} className={styles.friendCard}>
                      <img src={friend.avatar_url || friend.avatar} alt={friend.name || friend.username} className={styles.friendAvatar} />
                      <div>
                        <h4 className={styles.friendName}>{friend.name || friend.display_name || friend.username}</h4>
                        <p className={styles.friendMutual}>{friend.mutual || 0} bạn chung</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
