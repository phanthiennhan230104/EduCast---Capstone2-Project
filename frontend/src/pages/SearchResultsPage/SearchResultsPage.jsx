import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import MainLayout from '../../components/layout/MainLayout/MainLayout'
import { searchContent } from '../../utils/searchApi'
import SearchPostCard from '../../components/common/SearchPostCard'
import { useAuth } from '../../components/contexts/AuthContext'
import { getInitials } from '../../utils/getInitials'
import styles from '../../style/pages/SearchResultPage/SearchResults.module.css'

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams()
  const { user: currentUser } = useAuth()
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
    if (!currentUser) return

    const fetchFollowing = async () => {
      try {
        const token = localStorage.getItem('educast_access')
        const response = await fetch('http://127.0.0.1:8000/api/social/follow-list/', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          const followingIds = new Set(
            (data.following || []).map(user => user.id || user.following_id)
          )
          setFollowingIds(followingIds)
        }
      } catch (err) {
        console.error('Fetch following list error:', err)
      }
    }

    fetchFollowing()
  }, [currentUser])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
  }

  const handleFollowClick = async (authorId) => {
    if (!currentUser) return

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
        // Toggle follow status based on response
        setFollowingIds(prev => {
          const newSet = new Set(prev)
          if (data.data?.followed) {
            newSet.add(authorId)
          } else {
            newSet.delete(authorId)
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
                    {results.posts.map((post) => (
                      <SearchPostCard
                        key={post.id}
                        post={{
                          id: post.id,
                          title: post.title,
                          description: post.description,
                          author: post.author,
                          cover: post.thumbnail_url,
                          duration: post.duration_seconds,
                        }}
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
                        
                        {currentUser?.id === author.id ? (
                          <button 
                            className={styles.followBtn}
                            disabled
                          >
                            Xem trang cá nhân
                          </button>
                        ) : (
                          <button 
                            className={`${styles.followBtn} ${followingIds.has(author.id) ? styles.following : ''}`}
                            onClick={() => handleFollowClick(author.id)}
                            disabled={loadingFollow[author.id]}
                          >
                            {loadingFollow[author.id] ? '...' : followingIds.has(author.id) ? 'Đang theo dõi' : 'Theo dõi'}
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
    </MainLayout>
  )
}

function formatSeconds(seconds) {
  const total = Math.floor(Number(seconds || 0))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}
