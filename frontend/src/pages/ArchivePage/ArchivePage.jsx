import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spin, Empty, Button } from 'antd'
import { ArrowLeft, Archive, RotateCcw, Clock } from 'lucide-react'
import { apiRequest } from '../../utils/api'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../components/layout/MainLayout/MainLayout'
import PodcastCard from '../../components/feed/PodcastCard'
import styles from '../../style/pages/ArchivePage.module.css'

export default function ArchivePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('PODCASTS')

  useEffect(() => {
    fetchArchivedPosts()
  }, [])

  const fetchArchivedPosts = async () => {
    try {
      setLoading(true)
      const response = await apiRequest('/content/posts/my/archived/')
      if (response.success) {
        setPosts(response.data || [])
      }
    } catch (err) {
      console.error('Fetch archived posts failed:', err)
      toast.error(t('personal.fetchArchivedFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async (postId) => {
    try {
      const response = await apiRequest(`/content/drafts/${postId}/update/`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'published' })
      })
      
      if (response.success) {
        toast.success(t('personal.restoreSuccess'))
        setPosts(prev => prev.filter(p => p.id !== postId))
      }
    } catch (err) {
      console.error('Restore post failed:', err)
      toast.error(t('personal.restoreFailed'))
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  return (
    <MainLayout rightPanel={false}>
      <div className={styles.archiveContainer}>
        <header className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            <ArrowLeft size={24} />
          </button>
          <h1 className={styles.title}>{t('personal.archived')}</h1>
        </header>

        <div className={styles.tabs}>
          <button 
            className={`${styles.tabItem} ${activeTab === 'PODCASTS' ? styles.active : ''}`}
            onClick={() => setActiveTab('PODCASTS')}
          >
            <Clock size={16} />
            <span>{t('personal.tabs.podcasts').toUpperCase()}</span>
          </button>
        </div>

        <div className={styles.subHeader}>
          <p className={styles.subTitle}>
            {t('personal.archiveDescription') || 'Only you can see your archived podcasts unless you choose to share them.'}
          </p>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>
              <Spin size="large" />
            </div>
          ) : posts.length === 0 ? (
            <div className={styles.emptyWrap}>
              <Empty
                description={t('personal.noArchived')}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          ) : (
            <div className={styles.archiveGrid}>
              {posts.map(post => {
                const dateStr = formatDate(post.created_at)
                return (
                  <div key={post.id} className={styles.archiveItem}>
                    <div className={styles.dateBadge}>
                      {dateStr}
                    </div>
                    <div className={styles.cardContainer}>
                      <PodcastCard 
                        podcast={post} 
                        isArchivedView={true}
                        hideMenu={true}
                        onRestore={() => handleRestore(post.id)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
