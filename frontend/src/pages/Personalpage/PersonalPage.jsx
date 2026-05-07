import MainLayout from '../../components/layout/MainLayout/MainLayout'
import PersonalPageComponent from '../../components/PersonalPage/PersonalPage'

export default function PersonalPage() {
  return (
    <MainLayout>
      <PersonalPageComponent />
    </MainLayout>
  )
}

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
import styles from '../../style/pages/PersonalPage.module.css'

const TABS = ['Bài đăng', 'Podcast', 'Giới thiệu', 'Bạn bè', 'Ảnh']

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

  return (
    <div className={styles.container}>
      {/* Cover & Profile Header */}
      <div className={styles.header}>
        {/* Cover Photo */}
        <div className={styles.coverPhoto}>
          <img
            src="https://picsum.photos/seed/cover/1200/400"
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
                  src="https://i.pravatar.cc/300?img=11"
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
                Nguyễn Văn Anh
                <CheckCircle2 size={20} className={styles.verifyBadge} />
              </h1>
              <p className={styles.profileStats}>
                156 Podcast · 24.5k Người theo dõi · 342 Đang theo dõi
              </p>
            </div>

            {/* Actions */}
            <div className={styles.actions}>
              <button className={styles.editBtn}>
                <Edit3 size={16} />
                Chỉnh sửa
              </button>
              <button className={styles.shareBtn}>
                <Share2 size={16} />
                Chia sẻ
              </button>
              <button className={styles.moreBtn}>
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>

          {/* Bio */}
          <p className={styles.bio}>
            Podcaster | AI Enthusiast | Chia sẻ kiến thức công nghệ mỗi ngày
            🎙️🚀
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
              <div className={styles.postsLayout}>
                {/* Left Col */}
                <div className={styles.leftCol}>
                  <div className={styles.introCard}>
                    <h3 className={styles.cardTitle}>Giới thiệu</h3>
                    <div className={styles.introList}>
                      <div className={styles.introItem}>
                        <Briefcase size={18} className={styles.introIcon} />
                        <span>
                          Podcaster tại <strong>EduCast</strong>
                        </span>
                      </div>
                      <div className={styles.introItem}>
                        <GraduationCap size={18} className={styles.introIcon} />
                        <span>
                          Từng học tại <strong>ĐH Bách Khoa HN</strong>
                        </span>
                      </div>
                      <div className={styles.introItem}>
                        <MapPin size={18} className={styles.introIcon} />
                        <span>
                          Sống tại <strong>Hà Nội</strong>
                        </span>
                      </div>
                      <div className={styles.introItem}>
                        <Calendar size={18} className={styles.introIcon} />
                        <span>Tham gia Tháng 3, 2024</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Col */}
                <div className={styles.rightCol}>
                  {/* Create Post */}
                  <div className={styles.createPostCard}>
                    <div className={styles.createPostTop}>
                      <img src="https://i.pravatar.cc/150?img=11" alt="Avatar" className={styles.smallAvatar} />
                      <button className={styles.createPostInput}>Bạn đang nghĩ gì?</button>
                    </div>
                    <div className={styles.createPostBottom}>
                      <div className={styles.createPostActions}>
                        <button className={styles.createPostActionBtn}>
                          <ImageIcon size={18} className={styles.greenIcon} />
                          <span>Ảnh/Video</span>
                        </button>
                        <button className={styles.createPostActionBtn}>
                          <Smile size={18} className={styles.yellowIcon} />
                          <span>Cảm xúc</span>
                        </button>
                      </div>
                      <button className={styles.postBtn}>Đăng</button>
                    </div>
                  </div>

                  {/* Posts */}
                  {SAMPLE_POSTS.map((post) => (
                    <div key={post.id} className={styles.postCard}>
                      <div className={styles.postHeader}>
                        <div className={styles.postAuthor}>
                          <img src={post.avatar} alt={post.author} className={styles.smallAvatar} />
                          <div>
                            <h4 className={styles.authorName}>{post.author}</h4>
                            <p className={styles.postTime}>{post.time}</p>
                          </div>
                        </div>
                        <button className={styles.postMenuBtn}>
                          <MoreHorizontal size={20} />
                        </button>
                      </div>

                      <p className={styles.postContent}>{post.content}</p>

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
                          <span>{post.likes}</span>
                        </div>
                        <div className={styles.otherStats}>
                          <span>{post.comments} bình luận</span>
                          <span>{post.shares} chia sẻ</span>
                        </div>
                      </div>

                      <div className={styles.postActions}>
                        <button className={styles.postActionBtn}>
                          <Heart size={18} />
                          <span>Thích</span>
                        </button>
                        <button className={styles.postActionBtn}>
                          <MessageCircle size={18} />
                          <span>Bình luận</span>
                        </button>
                        <button className={styles.postActionBtn}>
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
                  {SAMPLE_PODCASTS.map((pod) => (
                    <div key={pod.id} className={styles.podcastItem}>
                      <div className={styles.podcastItemThumbnail}>
                        <img src={pod.img} alt={pod.title} className={styles.thumbnailImage} />
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
                  <div className={styles.friendsCount}>342 người</div>
                </div>
                <div className={styles.friendsGrid}>
                  {SAMPLE_FRIENDS.map((friend) => (
                    <div key={friend.name} className={styles.friendCard}>
                      <img src={friend.avatar} alt={friend.name} className={styles.friendAvatar} />
                      <div>
                        <h4 className={styles.friendName}>{friend.name}</h4>
                        <p className={styles.friendMutual}>{friend.mutual} bạn chung</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(activeTab === 'Giới thiệu' || activeTab === 'Ảnh') && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <ImageIcon size={24} />
                </div>
                <h3 className={styles.emptyTitle}>Chưa có nội dung</h3>
                <p className={styles.emptyText}>
                  Nội dung cho tab {activeTab} đang được cập nhật. Vui lòng quay lại sau.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

