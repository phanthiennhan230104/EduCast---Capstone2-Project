import React, { useEffect, useState } from 'react'
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
import { apiRequest } from '../../utils/api'

const TABS = ['Bài đăng', 'Podcast', 'Giới thiệu', 'Bạn bè', 'Ảnh']

const DEFAULT_AVATAR = 'https://i.pravatar.cc/300?img=11'
const DEFAULT_COVER = 'https://picsum.photos/seed/cover/1200/400'

const SAMPLE_POSTS = []
const SAMPLE_PODCASTS = []
const SAMPLE_FRIENDS = []

export default function PersonalPage() {
  const [activeTab, setActiveTab] = useState('Bài đăng')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchUserProfile()
  }, [])

  const fetchUserProfile = async () => {
    try {
      setLoading(true)
      setError('')

      const meRes = await apiRequest('/auth/me/')
      const userId = meRes?.user?.id

      if (!userId) {
        throw new Error('Không tìm thấy user id.')
      }

      const profileRes = await apiRequest(`/auth/${userId}/profile/`)
      setProfile(profileRes?.data)
    } catch (err) {
      console.error('Failed to fetch user profile:', err)
      setError('Không thể tải hồ sơ người dùng.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className={styles.container}>Đang tải hồ sơ...</div>
  }

  if (error) {
    return <div className={styles.container}>{error}</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.coverPhoto}>
          <img
            src={profile?.cover_url || DEFAULT_COVER}
            alt="Cover"
            className={styles.coverImage}
          />

          <button className={styles.editCoverBtn}>
            <ImageIcon size={16} />
            <span className={styles.editCoverText}>Chỉnh sửa ảnh bìa</span>
          </button>
        </div>

        <div className={styles.profileSection}>
          <div className={styles.profileRow}>
            <div className={styles.avatarWrapper}>
              <div className={styles.avatar}>
                <img
                  src={profile?.avatar_url || DEFAULT_AVATAR}
                  alt="Avatar"
                  className={styles.avatarImage}
                />
              </div>

              <button className={styles.editAvatarBtn}>
                <ImageIcon size={16} />
              </button>
            </div>

            <div className={styles.profileInfo}>
              <h1 className={styles.profileName}>
                {profile?.display_name || profile?.username || 'Người dùng'}
                <CheckCircle2 size={20} className={styles.verifyBadge} />
              </h1>

              <p className={styles.profileStats}>
                {profile?.podcast_count || 0} Podcast ·{' '}
                {profile?.followers_count || 0} Người theo dõi ·{' '}
                {profile?.following_count || 0} Đang theo dõi
              </p>
            </div>

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

          <p className={styles.bio}>
            {profile?.bio || 'Chưa có giới thiệu.'}
          </p>
        </div>

        <div className={styles.tabsContainer}>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${styles.tabBtn} ${
                activeTab === tab ? styles.activeTab : ''
              }`}
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="activeTab"
                  className={styles.tabIndicator}
                />
              )}
            </button>
          ))}
        </div>
      </div>

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
                          Học tập và chia sẻ kiến thức
                        </span>
                      </div>

                      <div className={styles.introItem}>
                        <MapPin size={18} className={styles.introIcon} />
                        <span>
                          Sống tại <strong>Việt Nam</strong>
                        </span>
                      </div>

                      <div className={styles.introItem}>
                        <Calendar size={18} className={styles.introIcon} />
                        <span>Thành viên EduCast</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.rightCol}>
                  <div className={styles.createPostCard}>
                    <div className={styles.createPostTop}>
                      <img
                        src={profile?.avatar_url || DEFAULT_AVATAR}
                        alt="Avatar"
                        className={styles.smallAvatar}
                      />
                      <button className={styles.createPostInput}>
                        Bạn đang nghĩ gì?
                      </button>
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

                  {SAMPLE_POSTS.length === 0 ? (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>
                        <ImageIcon size={24} />
                      </div>
                      <h3 className={styles.emptyTitle}>Chưa có bài đăng</h3>
                      <p className={styles.emptyText}>
                        Khi bạn đăng podcast hoặc nội dung mới, chúng sẽ xuất hiện ở đây.
                      </p>
                    </div>
                  ) : (
                    SAMPLE_POSTS.map((post) => (
                      <div key={post.id} className={styles.postCard}>
                        <div className={styles.postHeader}>
                          <div className={styles.postAuthor}>
                            <img
                              src={post.avatar}
                              alt={post.author}
                              className={styles.smallAvatar}
                            />
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
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'Podcast' && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <PlayCircle size={24} />
                </div>
                <h3 className={styles.emptyTitle}>Chưa có podcast</h3>
                <p className={styles.emptyText}>
                  Podcast bạn tạo sẽ xuất hiện tại đây.
                </p>
              </div>
            )}

            {activeTab === 'Bạn bè' && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <Heart size={24} />
                </div>
                <h3 className={styles.emptyTitle}>Chưa có bạn bè</h3>
                <p className={styles.emptyText}>
                  Danh sách bạn bè sẽ được cập nhật sau.
                </p>
              </div>
            )}

            {(activeTab === 'Giới thiệu' || activeTab === 'Ảnh') && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <ImageIcon size={24} />
                </div>
                <h3 className={styles.emptyTitle}>Chưa có nội dung</h3>
                <p className={styles.emptyText}>
                  Nội dung cho tab {activeTab} đang được cập nhật.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}