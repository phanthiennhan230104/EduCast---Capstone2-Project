import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
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

const TABS = ['posts', 'podcasts', 'about', 'friends', 'photos']

const DEFAULT_AVATAR = 'https://i.pravatar.cc/300?img=11'
const DEFAULT_COVER = 'https://picsum.photos/seed/cover/1200/400'

const SAMPLE_POSTS = []
const SAMPLE_PODCASTS = []
const SAMPLE_FRIENDS = []

export default function PersonalPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('posts')
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
        throw new Error(t('personal.userIdNotFound'))
      }

      const profileRes = await apiRequest(`/auth/${userId}/profile/`)
      setProfile(profileRes?.data)
    } catch (err) {
      console.error(t('personal.fetchProfileFailed'), err)
      setError(t('personal.fetchProfileFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className={styles.container}>{t('personal.loadingProfile')}</div>
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
            alt={t('personal.coverAlt')}
            className={styles.coverImage}
          />

          <button className={styles.editCoverBtn}>
            <ImageIcon size={16} />
            <span className={styles.editCoverText}>{t('personal.editCover')}</span>
          </button>
        </div>

        <div className={styles.profileSection}>
          <div className={styles.profileRow}>
            <div className={styles.avatarWrapper}>
              <div className={styles.avatar}>
                <img
                  src={profile?.avatar_url || DEFAULT_AVATAR}
                  alt={t('personal.avatarAlt')}
                  className={styles.avatarImage}
                />
              </div>

              <button className={styles.editAvatarBtn}>
                <ImageIcon size={16} />
              </button>
            </div>

            <div className={styles.profileInfo}>
              <h1 className={styles.profileName}>
                {profile?.display_name || profile?.username || t('personal.userFallback')}
                <CheckCircle2 size={20} className={styles.verifyBadge} />
              </h1>

              <p className={styles.profileStats}>
                {t('personal.podcastCount', { count: profile?.podcast_count || 0 })} ·{' '}
                {t('personal.followersCount', { count: profile?.followers_count || 0 })} ·{' '}
                {t('personal.followingCount', { count: profile?.following_count || 0 })}
              </p>
            </div>

            <div className={styles.actions}>
              <button className={styles.editBtn}>
                <Edit3 size={16} />
                {t('personal.edit')}
              </button>

              <button className={styles.shareBtn}>
                <Share2 size={16} />
                {t('personal.share')}
              </button>

              <button className={styles.moreBtn}>
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>

          <p className={styles.bio}>
            {profile?.bio || t('personal.noBio')}
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
            {activeTab === 'posts' && (
              <div className={styles.postsLayout}>
                <div className={styles.leftCol}>
                  <div className={styles.introCard}>
                    <h3 className={styles.cardTitle}>{t('personal.introTitle')}</h3>

                    <div className={styles.introList}>
                      <div className={styles.introItem}>
                        <Briefcase size={18} className={styles.introIcon} />
                        <span>
                          {t('personal.introWork')} <strong>EduCast</strong>
                        </span>
                      </div>

                      <div className={styles.introItem}>
                        <GraduationCap size={18} className={styles.introIcon} />
                        <span>
                          {t('personal.introStudy')}
                        </span>
                      </div>

                      <div className={styles.introItem}>
                        <MapPin size={18} className={styles.introIcon} />
                        <span>
                          {t('personal.introLocation')} <strong>{t('personal.vietnam')}</strong>
                        </span>
                      </div>

                      <div className={styles.introItem}>
                        <Calendar size={18} className={styles.introIcon} />
                        <span>{t('personal.memberEduCast')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.rightCol}>
                  <div className={styles.createPostCard}>
                    <div className={styles.createPostTop}>
                      <img
                        src={profile?.avatar_url || DEFAULT_AVATAR}
                        alt={t('personal.avatarAlt')}
                        className={styles.smallAvatar}
                      />
                      <button className={styles.createPostInput}>
                        {t('personal.createPostPlaceholder')}
                      </button>
                    </div>

                    <div className={styles.createPostBottom}>
                      <div className={styles.createPostActions}>
                        <button className={styles.createPostActionBtn}>
                          <ImageIcon size={18} className={styles.greenIcon} />
                          <span>{t('personal.photoVideo')}</span>
                        </button>

                        <button className={styles.createPostActionBtn}>
                          <Smile size={18} className={styles.yellowIcon} />
                          <span>{t('personal.feeling')}</span>
                        </button>
                      </div>

                      <button className={styles.postBtn}>{t('personal.post')}</button>
                    </div>
                  </div>

                  {SAMPLE_POSTS.length === 0 ? (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>
                        <ImageIcon size={24} />
                      </div>
                      <h3 className={styles.emptyTitle}>{t('personal.noPosts')}</h3>
                      <p className={styles.emptyText}>
                        {t('personal.noPostsDescription')}
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
                            <span>{t('personal.like')}</span>
                          </button>

                          <button className={styles.postActionBtn}>
                            <MessageCircle size={18} />
                            <span>{t('personal.comment')}</span>
                          </button>

                          <button className={styles.postActionBtn}>
                            <Share2 size={18} />
                            <span>{t('personal.share')}</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'podcasts' && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <PlayCircle size={24} />
                </div>
                <h3 className={styles.emptyTitle}>{t('personal.noPodcasts')}</h3>
                <p className={styles.emptyText}>
                  {t('personal.noPodcastsDescription')}
                </p>
              </div>
            )}

            {activeTab === 'friends' && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <Heart size={24} />
                </div>
                <h3 className={styles.emptyTitle}>{t('personal.noFriends')}</h3>
                <p className={styles.emptyText}>
                  {t('personal.noFriendsDescription')}
                </p>
              </div>
            )}

            {(activeTab === 'about' || activeTab === 'photos') && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <ImageIcon size={24} />
                </div>
                <h3 className={styles.emptyTitle}>{t('personal.noContent')}</h3>
                <p className={styles.emptyText}>
                 {t('personal.tabContentUpdating', { tab: t(`personal.tabs.${activeTab}`) })}
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}