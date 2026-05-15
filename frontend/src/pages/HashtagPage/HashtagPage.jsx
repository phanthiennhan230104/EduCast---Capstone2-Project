import { useState, useEffect, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Hash, Play, Headphones, MessageCircle, Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import MainLayout from '../../components/layout/MainLayout/MainLayout'
import styles from '../../style/hashtag/HashtagPage.module.css'
import { getToken, getCurrentUser } from '../../utils/auth'
import { API_BASE_URL } from '../../config/apiBase'
import CommentModal from '../../components/feed/CommentModal'
import { PodcastContext } from '../../components/contexts/PodcastContext'
import { useAudioPlayer } from '../../components/contexts/AudioPlayerContext'

export default function HashtagPage() {
  const { t } = useTranslation()
  const { slug } = useParams()
  const navigate = useNavigate()
  const [tagInfo, setTagInfo] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState(null)

  const { toggleLikePost, toggleSavePost } = useContext(PodcastContext)
  const { playTrack } = useAudioPlayer()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const token = getToken()
        
        // 1. Fetch tag details
        const tagRes = await fetch(`${API_BASE_URL}/content/tags/${slug}/detail/`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
        const tagData = await tagRes.json()
        
        if (tagData.success) {
          setTagInfo(tagData.data)
          
          // 2. Fetch posts for this tag, sorted by views (tag_trending)
          const postsRes = await fetch(
            `${API_BASE_URL}/content/feed/?tab=tag_trending&tag_slugs=${slug}&limit=50`,
            {
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            }
          )
          const postsData = await postsRes.json()
          
          // Map data for CommentModal compatibility
          const mapped = (postsData.items || []).map(item => ({
            ...item,
            liked: item.viewer_state?.is_liked || false,
            saved: item.viewer_state?.is_saved || false,
            likes: item.stats?.likes || 0,
            comments: item.stats?.comments || 0,
            saves: item.stats?.saves || 0,
            shares: item.stats?.shares || 0,
          }))
          
          setPosts(mapped)
        }
      } catch (err) {
        console.error('Fetch hashtag data failed:', err)
      } finally {
        setLoading(false)
      }
    }

    if (slug) fetchData()
  }, [slug])

  const formatCount = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count
  }

  const handlePostClick = (post) => {
    setSelectedPost(post)
  }

  const handleToggleLike = async (e, post) => {
    e?.stopPropagation()
    const result = await toggleLikePost(post.id)
    if (result) {
      setPosts(prev => prev.map(p => 
        p.id === post.id ? { ...p, liked: result.liked, likes: result.like_count } : p
      ))
      if (selectedPost && selectedPost.id === post.id) {
        setSelectedPost(prev => ({ ...prev, liked: result.liked, likes: result.like_count }))
      }
    }
  }

  const handleToggleSave = async (e, post) => {
    e?.stopPropagation()
    const result = await toggleSavePost(post.id)
    if (result) {
      setPosts(prev => prev.map(p => 
        p.id === post.id ? { ...p, saved: result.saved, saves: result.save_count } : p
      ))
      if (selectedPost && selectedPost.id === post.id) {
        setSelectedPost(prev => ({ ...prev, saved: result.saved, saves: result.save_count }))
      }
    }
  }

  return (
    <MainLayout>
      <div className={styles.container}>
        {loading ? (
          <div className={styles.loading}>{t('common.loading')}</div>
        ) : tagInfo ? (
          <>
            <header className={styles.header}>
              <div className={styles.tagIconWrap}>
                <Hash size={40} />
              </div>
              <div className={styles.tagMeta}>
                <h1 className={styles.tagName}>#{tagInfo.name}</h1>
                <p className={styles.tagStats}>
                  <strong>{formatCount(tagInfo.usage_count)}</strong> {t('hashtag.posts')}
                </p>
              </div>
            </header>

            <div className={styles.grid}>
              {posts.length > 0 ? (
                posts.map((post) => (
                  <div 
                    key={post.id} 
                    className={styles.postCard}
                    onClick={() => handlePostClick(post)}
                  >
                    <div className={styles.thumbnailWrap}>
                      <img 
                        src={post.thumbnail_url || post.cover || `https://api.dicebear.com/7.x/shapes/svg?seed=${post.id}`} 
                        alt={post.title} 
                        className={styles.thumbnail}
                      />
                      <div className={styles.overlay}>
                        <div className={styles.overlayTop}>
                          <span className={styles.viewCount}>
                            <Play size={12} fill="currentColor" />
                            {formatCount(post.listen_count || 0)}
                          </span>
                        </div>
                        <div className={styles.overlayBottom}>
                           <div className={styles.engagement}>
                              <span><Heart size={12} fill="currentColor" /> {formatCount(post.likes || 0)}</span>
                              <span><MessageCircle size={12} fill="currentColor" /> {formatCount(post.comments || 0)}</span>
                           </div>
                        </div>
                      </div>
                    </div>
                    <div className={styles.postInfo}>
                      <h3 className={styles.postTitle}>{post.title}</h3>
                      <div className={styles.postAuthor}>
                        <img 
                          src={post.author?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${post.author?.name}`} 
                          alt={post.author?.name} 
                          className={styles.authorAvatar}
                        />
                        <span>{post.author?.name}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.empty}>{t('hashtag.noPosts')}</div>
              )}
            </div>
          </>
        ) : (
          <div className={styles.error}>{t('hashtag.notFound')}</div>
        )}
      </div>

      {selectedPost && (
        <CommentModal
          podcast={selectedPost}
          liked={selectedPost.liked}
          saved={selectedPost.saved}
          likeCount={selectedPost.likes}
          saveCount={selectedPost.saves}
          commentCount={selectedPost.comments}
          shareCount={selectedPost.shares}
          onClose={() => setSelectedPost(null)}
          onToggleLike={(e) => handleToggleLike(e, selectedPost)}
          onToggleSave={(e) => handleToggleSave(e, selectedPost)}
          onCommentCountChange={(count) => {
            setPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, comments: count } : p))
            setSelectedPost(prev => ({ ...prev, comments: count }))
          }}
        />
      )}
    </MainLayout>
  )
}
