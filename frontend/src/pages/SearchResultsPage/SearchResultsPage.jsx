import { useEffect, useState, useContext } from 'react'
import { useSearchParams } from 'react-router-dom'
import MainLayout from '../../components/layout/MainLayout/MainLayout'
import { searchContent } from '../../utils/searchApi'
import SearchPostCard from '../../components/common/SearchPostCard'
import { useAuth } from '../../components/contexts/AuthContext'
import { getInitials } from '../../utils/getInitials'
import { getToken, getCurrentUser } from '../../utils/auth'
import { PodcastContext } from '../../components/contexts/PodcastContext'
import CommentModal from '../../components/feed/CommentModal'
import styles from '../../style/pages/SearchResultPage/SearchResults.module.css'

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams()
  const { user: currentUser } = useAuth()
  const authUser = getCurrentUser()
  const currentUserId = currentUser?.id || authUser?.id
  const { removeSavedPost, hidePost, deletePost, isPostHidden, isPostDeleted, deletedPostsVersion, hiddenPostsVersion } = useContext(PodcastContext)
  const query = searchParams.get('q') || ''
  const type = searchParams.get('type') || 'all'
  
  const [results, setResults] = useState({
    posts: [],
    authors: [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState(type || 'all')
  const [followingIds, setFollowingIds] = useState(new Set())
  const [loadingFollow, setLoadingFollow] = useState({})
  
  // State for CommentModal
  const [showPostDetail, setShowPostDetail] = useState(false)
  const [selectedPostDetail, setSelectedPostDetail] = useState(null)
  const [likeCount, setLikeCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const POST_SYNC_EVENT = 'post-sync-updated'

  const dispatchPostSync = (payload) => {
    window.dispatchEvent(new CustomEvent(POST_SYNC_EVENT, { detail: payload }))
  }

  useEffect(() => {
    const handlePostSync = (event) => {
      const d = event.detail || {}

      if (!d.postId) return
      const oldSync = JSON.parse(
        localStorage.getItem(`post-sync-${d.postId}`) || '{}'
      )

      const nextSync = {
        ...oldSync,
      }

      if (typeof d.liked === 'boolean') {
        nextSync.liked = d.liked
      }

      if (typeof d.likeCount === 'number') {
        nextSync.likeCount = d.likeCount
      }

      if (typeof d.saved === 'boolean') {
        nextSync.saved = d.saved
      }

      if (typeof d.saveCount === 'number') {
        nextSync.saveCount = d.saveCount
      }

      localStorage.setItem(`post-sync-${d.postId}`, JSON.stringify(nextSync))

      setResults(prev => ({
        ...prev,
        posts: prev.posts.map(post =>
          String(post.id) === String(d.postId)
            ? {
                ...post,
                is_liked: typeof d.liked === 'boolean' ? d.liked : post.is_liked,
                like_count: typeof d.likeCount === 'number' ? d.likeCount : post.like_count,
                is_saved: typeof d.saved === 'boolean' ? d.saved : post.is_saved,
                save_count: typeof d.saveCount === 'number' ? d.saveCount : post.save_count,
              }
            : post
        ),
      }))

      setSelectedPostDetail(prev =>
        prev && String(prev.id) === String(d.postId)
          ? {
              ...prev,
              is_liked: typeof d.liked === 'boolean' ? d.liked : prev.is_liked,
              like_count: typeof d.likeCount === 'number' ? d.likeCount : prev.like_count,
              is_saved: typeof d.saved === 'boolean' ? d.saved : prev.is_saved,
              save_count: typeof d.saveCount === 'number' ? d.saveCount : prev.save_count,
            }
          : prev
      )

      if (selectedPostDetail && String(selectedPostDetail.id) === String(d.postId)) {
        if (typeof d.liked === 'boolean') setLiked(d.liked)
        if (typeof d.likeCount === 'number') setLikeCount(d.likeCount)
        if (typeof d.saved === 'boolean') setSaved(d.saved)
      }
    }

    window.addEventListener(POST_SYNC_EVENT, handlePostSync)

    return () => {
      window.removeEventListener(POST_SYNC_EVENT, handlePostSync)
    }
  }, [selectedPostDetail])

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults({ posts: [], authors: [] })
      return
    }

    const fetchResults = async () => {
      try {
        setLoading(true)
        setError('')
        const data = await searchContent(query, 'all', 50, 0)
        setResults(data || { posts: [], authors: [] })
      } catch (err) {
        setError('Lỗi khi tìm kiếm. Vui lòng thử lại.')
        console.error('Search error:', err)
        setResults({ posts: [], authors: [] })
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [query])

  // Fetch danh sách người đang follow
  useEffect(() => {
    if (!currentUserId) return

    const fetchFollowing = async () => {
      try {
        const token = localStorage.getItem('educast_access')

        const response = await fetch('http://127.0.0.1:8000/api/social/follow-list/', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const data = await response.json()
        console.log('FOLLOW LIST:', data)

        const followingList = data.data?.following || []

        setFollowingIds(
          new Set(followingList.map(item => String(item.id)))
        )
      } catch (err) {
        console.error('Fetch following list error:', err)
      }
    }

    fetchFollowing()
  }, [currentUserId])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
  }

  const handleFollowClick = async (authorId) => {
    if (!currentUserId) return

    setLoadingFollow(prev => ({ ...prev, [authorId]: true }))

    try {
      const token = localStorage.getItem('educast_access')

      const response = await fetch(
        `http://127.0.0.1:8000/api/social/users/${authorId}/follow/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setFollowingIds(prev => {
          const newSet = new Set(prev)

          const followed = data.data?.followed ?? data.followed

          if (followed) {
            newSet.add(String(authorId))
          } else {
            newSet.delete(String(authorId))
          }

          return newSet
        })
      }
    } catch (err) {
      console.error('Follow/Unfollow error:', err)
    } finally {
      setLoadingFollow(prev => ({ ...prev, [authorId]: false }))
    }
  }

  const handleOpenPostDetail = (post) => {
    setSelectedPostDetail(post)
    setLikeCount(post.like_count || 0)
    setCommentCount(post.comment_count || 0)
    setLiked(post.is_liked || false)
    setSaved(post.is_saved || false)
    setShowPostDetail(true)
  }

  useEffect(() => {
    if (loading || results.posts.length === 0) return
    if (sessionStorage.getItem('returnFromEdit') !== 'true') return

    const openPostId = sessionStorage.getItem('openPostDetailId')
    if (!openPostId) return

    const post = results.posts.find(p => String(p.id) === String(openPostId))
    if (!post) return

    handleOpenPostDetail({
      id: post.id,
      postId: post.id,
      title: post.title,
      description: post.description,
      author: post.author,
      authorUsername: post.author_username || post.username || '',
      authorId: post.author_id,
      user_id: post.author_id,
      userId: post.author_id,
      isOwner: String(currentUser?.id) === String(post.author_id),
      cover: post.thumbnail_url || '',
      thumbnail_url: post.thumbnail_url || '',
      duration: post.duration_seconds || post.audio?.duration_seconds || 0,
      duration_seconds: post.duration_seconds || post.audio?.duration_seconds || 0,
      durationSeconds: post.duration_seconds || post.audio?.duration_seconds || 0,
      like_count: post.like_count || 0,
      comment_count: post.comment_count || 0,
      share_count: post.share_count || 0,
      save_count: post.save_count || 0,
      is_liked: post.is_liked || false,
      is_saved: post.is_saved || false,
      audio_url: post.audio_url || post.audio?.audio_url || '',
      audioUrl: post.audio_url || post.audio?.audio_url || '',
      created_at: post.created_at,
      timeAgo: post.timeAgo,
    })

    sessionStorage.removeItem('returnFromEdit')
    sessionStorage.removeItem('returnToAfterEdit')
    sessionStorage.removeItem('openPostDetailId')
    sessionStorage.removeItem('openPostDetailNoScroll')
  }, [loading, results.posts])

  const handleToggleLike = async () => {
    if (!selectedPostDetail?.id) return

    try {
      const token = getToken()
      const user = getCurrentUser()

      const response = await fetch(
        `http://127.0.0.1:8000/api/social/posts/${selectedPostDetail.id}/like/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            user_id: user?.id,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || `HTTP ${response.status}`)
      }

      const nextLiked = Boolean(data.data?.liked)
      const nextLikeCount = Number(data.data?.like_count || 0)

      setLiked(nextLiked)
      setLikeCount(nextLikeCount)

      setSelectedPostDetail(prev =>
        prev
          ? {
              ...prev,
              is_liked: nextLiked,
              like_count: nextLikeCount,
            }
          : prev
      )

      setResults(prev => ({
        ...prev,
        posts: prev.posts.map(p =>
          String(p.id) === String(selectedPostDetail.id)
            ? {
                ...p,
                is_liked: nextLiked,
                like_count: nextLikeCount,
              }
            : p
        ),
      }))

      dispatchPostSync({
        postId: selectedPostDetail.id,
        liked: nextLiked,
        likeCount: nextLikeCount,
      })
    } catch (err) {
      console.error('Failed to toggle like:', err)
    }
  }

  const handleToggleSave = async () => {
    if (!selectedPostDetail?.id) return

    try {
      const token = getToken()

      const user = getCurrentUser()

      const response = await fetch(
        `http://127.0.0.1:8000/api/social/posts/${selectedPostDetail.id}/save/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            user_id: user?.id,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || `HTTP ${response.status}`)
      }

      const nextSaved = Boolean(data.data?.saved)
      const nextSaveCount = Number(data.data?.save_count || 0)

      setSaved(nextSaved)

      setSelectedPostDetail(prev =>
        prev
          ? {
              ...prev,
              is_saved: nextSaved,
              save_count: nextSaveCount,
            }
          : prev
      )

      setResults(prev => ({
        ...prev,
        posts: prev.posts.map(p =>
          String(p.id) === String(selectedPostDetail.id)
            ? {
                ...p,
                is_saved: nextSaved,
                save_count: nextSaveCount,
              }
            : p
        ),
      }))

      dispatchPostSync({
        postId: selectedPostDetail.id,
        saved: nextSaved,
        saveCount: nextSaveCount,
      })
    } catch (err) {
      console.error('Failed to toggle save:', err)
    }
  }

  const handleShare = async () => {
    try {
      const token = getToken()
      const response = await fetch(`http://127.0.0.1:8000/api/social/posts/${selectedPostDetail?.id}/share/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          share_type: 'personal',
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      alert('Chia sẻ thành công!')
    } catch (err) {
      console.error('Failed to share:', err)
      alert('Lỗi khi chia sẻ')
    }
  }

  const handlePostDeleted = () => {
    setShowPostDetail(false)
    setSelectedPostDetail(null)
  }

  return (
    <MainLayout>
      <div className={styles.searchResultsContainer}>
        <div className={styles.header}>
          <h1 className={styles.title}>Kết quả tìm kiếm</h1>
          {query && (
            <p className={styles.query}>
              Tìm kiếm cho: <strong>"{query}"</strong>
            </p>
          )}
        </div>

        {!query && (
          <div className={styles.emptyState}>
            <p>Hãy nhập từ khóa để tìm kiếm</p>
          </div>
        )}

        {query && loading && (
          <div className={styles.loadingState}>
            <p>Đang tìm kiếm...</p>
          </div>
        )}

        {query && error && (
          <div className={styles.errorState}>
            <p>{error}</p>
          </div>
        )}

        {query && !loading && (
          <>
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${activeTab === 'all' ? styles.active : ''}`}
                onClick={() => handleTabChange('all')}
              >
                Tất cả
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'posts' ? styles.active : ''}`}
                onClick={() => handleTabChange('posts')}
              >
                Podcast ({results.posts.length})
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'authors' ? styles.active : ''}`}
                onClick={() => handleTabChange('authors')}
              >
                Tác giả ({results.authors.length})
              </button>
            </div>

            {/* Podcasts */}
            {(activeTab === 'all' || activeTab === 'posts') && (
              <div className={styles.section}>
                {results.posts.length === 0 ? (
                  <p className={styles.noResults}>Không tìm thấy podcast nào</p>
                ) : (
                  <div className={styles.podcastsGrid}>
                    {results.posts.filter(post => !isPostHidden(post.id) && !isPostDeleted(post.id)).map((post) => (
                      <SearchPostCard
                        key={post.id}
                        post={{
                          id: post.id,
                          title: post.title,
                          description: post.description,

                          author: post.author,
                          authorUsername: post.author_username || post.username || '',
                          authorId: post.author_id,  

                          cover: post.thumbnail_url,
                          thumbnail_url: post.thumbnail_url,

                          duration: post.duration_seconds || post.audio?.duration_seconds || 0,
                          duration_seconds: post.duration_seconds || post.audio?.duration_seconds || 0,
                          durationSeconds: post.duration_seconds || post.audio?.duration_seconds || 0,

                          like_count: post.like_count ?? JSON.parse(localStorage.getItem(`post-sync-${post.id}`) || '{}').likeCount ?? 0,
                          comment_count: post.comment_count || 0,
                          share_count: post.share_count || 0,

                          is_liked: post.is_liked ?? JSON.parse(localStorage.getItem(`post-sync-${post.id}`) || '{}').liked ?? false,
                          is_saved: post.is_saved ?? JSON.parse(localStorage.getItem(`post-sync-${post.id}`) || '{}').saved ?? false,

                          audio_url: post.audio_url || post.audio?.audio_url || '',
                          audioUrl: post.audio_url || post.audio?.audio_url || '',

                          created_at: post.created_at,
                          timeAgo: post.timeAgo,
                        }}

                        onClick={() => handleOpenPostDetail({
                          id: post.id,
                          postId: post.id,

                          title: post.title,
                          description: post.description,

                          author: post.author,
                          authorUsername: post.author_username || post.username || '',
                          authorId: post.author_id,
                          user_id: post.author_id,
                          userId: post.author_id,

                          isOwner: String(currentUser?.id) === String(post.author_id),

                          cover: post.thumbnail_url || '',
                          thumbnail_url: post.thumbnail_url || '',

                          audio_url: post.audio_url || post.audio?.audio_url || '',
                          audioUrl: post.audio_url || post.audio?.audio_url || '',
                          audioId: post.audio_id || post.audio?.id || '',

                          duration: post.duration_seconds || post.audio?.duration_seconds || 0,
                          duration_seconds: post.duration_seconds || post.audio?.duration_seconds || 0,
                          durationSeconds: post.duration_seconds || post.audio?.duration_seconds || 0,

                          like_count: post.like_count || 0,
                          comment_count: post.comment_count || 0,
                          share_count: post.share_count || 0,

                          is_liked: post.is_liked || false,
                          is_saved: post.is_saved || false,

                          created_at: post.created_at,
                          timeAgo: post.timeAgo,
                        })}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Divider */}
            {activeTab === 'all' && results.posts.length > 0 && results.authors.length > 0 && (
              <div className={styles.divider}></div>
            )}

            {/* Authors */}
            {(activeTab === 'all' || activeTab === 'authors') && results.authors.length > 0 && (
              <div className={styles.section}>
                <div className={styles.authorsList}>
                  {results.authors.map((author) => {
                    const displayName = author.display_name || author.username
                    const initials = getInitials(author)

                    // Generate avatar URL nếu chưa có
                    const avatarUrl = author.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff&size=96`

                    return (
                      <div key={author.id} className={styles.authorCard}>
                        {author.avatar_url ? (
                          <img
                            src={avatarUrl}
                            alt={displayName}
                            className={styles.authorAvatar}
                            onError={(e) => {
                              e.target.style.display = 'none'
                            }}
                          />
                        ) : (
                          <img
                            src={avatarUrl}
                            alt={displayName}
                            className={styles.authorAvatar}
                            onError={(e) => {
                              // Fallback khi avatar URL fail
                              e.target.style.display = 'none'
                            }}
                          />
                        )}
                        {!author.avatar_url && (
                          <div className={styles.authorAvatarFallback}>
                            {initials}
                          </div>
                        )}
                        <h4 className={styles.authorName}>{displayName}</h4>
                        <p className={styles.authorUsername}>@{author.username}</p>
                        
                        {String(currentUserId) === String(author.id) ? (
                          <button 
                            className={styles.followBtn}
                            disabled
                          >
                            Xem trang cá nhân
                          </button>
                        ) : (
                          <button 
                            className={`${styles.followBtn} ${followingIds.has(String(author.id)) ? styles.following : ''}`}
                            onClick={() => handleFollowClick(author.id)}
                            disabled={loadingFollow[author.id]}
                          >
                            {loadingFollow[author.id]
                              ? '...'
                              : followingIds.has(String(author.id))
                                ? 'Đang theo dõi'
                                : 'Theo dõi'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {results.posts.length === 0 &&
              results.authors.length === 0 && (
                <div className={styles.noResults}>
                  <p>Không tìm thấy kết quả nào cho "{query}"</p>
                </div>
              )}
          </>
        )}
      </div>

      {showPostDetail && selectedPostDetail && (
        <CommentModal
          podcast={selectedPostDetail}
          liked={liked}
          saved={saved}
          likeCount={likeCount}
          shareCount={selectedPostDetail?.share_count || 0}
          saveCount={selectedPostDetail?.save_count || 0}
          commentCount={commentCount}
          onClose={() => {
            setShowPostDetail(false)
            setSelectedPostDetail(null)
          }}
          onCommentCountChange={setCommentCount}
          onToggleLike={handleToggleLike}
          onToggleSave={handleToggleSave}
          onShare={handleShare}
          onPostDeleted={handlePostDeleted}
          disableAutoScroll={true}
        />
      )}
    </MainLayout>
  )
}

function formatSeconds(seconds) {
  const total = Math.floor(Number(seconds || 0))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}
