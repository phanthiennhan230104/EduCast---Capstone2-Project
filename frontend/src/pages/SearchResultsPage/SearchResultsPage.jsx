import { useEffect, useMemo, useState, useContext, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import MainLayout from '../../components/layout/MainLayout/MainLayout'
import { searchContent } from '../../utils/searchApi'
import SearchPostCard from '../../components/common/SearchPostCard'
import { useAuth } from '../../components/contexts/AuthContext'
import { getInitials } from '../../utils/getInitials'
import { getToken, getCurrentUser } from '../../utils/auth'
import { getCanonicalPostIdForEngagement } from '../../utils/canonicalPostId'
import { API_BASE_URL } from '../../config/apiBase'
import { PodcastContext } from '../../components/contexts/PodcastContext'
import CommentModal from '../../components/feed/CommentModal'
import EditPostModal from '../../components/feed/EditPostModal'
import ConfirmModal from '../../components/feed/ConfirmModal'
import { useAudioPlayer } from '../../components/contexts/AudioPlayerContext'
import { POST_REMOVED_EVENT, matchesRemovedPost } from '../../utils/postRemoval'
import styles from '../../style/pages/SearchResultPage/SearchResults.module.css'

function mapSearchPostToDetail(post, currentUser) {
  let sync = {}
  try {
    sync = JSON.parse(localStorage.getItem(`post-sync-${post.id}`) || '{}')
  } catch {
    sync = {}
  }

  return {
    id: post.id,
    postId: post.id,
    title: post.title,
    description: post.description,
    author: post.author,
    authorUsername: post.author_username || post.username || '',
    authorId: post.author_id,
    user_id: post.author_id,
    userId: post.author_id,
    tags: post.tags || post.tag_names || post.tagNames || [],
    isOwner: String(currentUser?.id) === String(post.author_id),
    cover: post.thumbnail_url || '',
    thumbnail_url: post.thumbnail_url || '',
    audio_url: post.audio_url || post.audio?.audio_url || '',
    audioUrl: post.audio_url || post.audio?.audio_url || '',
    audioId: post.audio_id || post.audio?.id || '',
    duration: post.duration_seconds || post.audio?.duration_seconds || 0,
    duration_seconds: post.duration_seconds || post.audio?.duration_seconds || 0,
    durationSeconds: post.duration_seconds || post.audio?.duration_seconds || 0,
    like_count: post.like_count ?? sync.likeCount ?? 0,
    comment_count: post.comment_count || 0,
    share_count: post.share_count || 0,
    save_count: post.save_count ?? sync.saveCount ?? 0,
    is_liked: post.is_liked ?? sync.liked ?? false,
    is_saved: post.is_saved ?? sync.saved ?? false,
    created_at: post.created_at,
    timeAgo: post.timeAgo,
  }
}

export default function SearchResultsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
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
  const visiblePosts = useMemo(
    () =>
      results.posts.filter(
        (post) => !isPostHidden(post.id) && !isPostDeleted(post.id)
      ),
    [isPostDeleted, isPostHidden, results.posts]
  )

  // State for CommentModal
  const [showPostDetail, setShowPostDetail] = useState(false)
  const [selectedPostDetail, setSelectedPostDetail] = useState(null)
  const [likeCount, setLikeCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)

  // State cho menu Chỉnh sửa / Xóa / Ẩn trên card kết quả
  const [editPostModalOpen, setEditPostModalOpen] = useState(false)
  const [editingPostId, setEditingPostId] = useState(null)
  const [deletePostConfirmOpen, setDeletePostConfirmOpen] = useState(false)
  const [deletingPost, setDeletingPost] = useState(null)
  const [isDeletingPost, setIsDeletingPost] = useState(false)
  const [hidePostConfirmOpen, setHidePostConfirmOpen] = useState(false)
  const [hidingPost, setHidingPost] = useState(null)
  const [isHidingPost, setIsHidingPost] = useState(false)
  const { pauseTrackIfDeleted } = useAudioPlayer()
  const POST_SYNC_EVENT = 'post-sync-updated'
  const FOLLOW_SYNC_EVENT = 'follow-sync-updated'

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
              ...(typeof d.title === 'string' ? { title: d.title } : {}),
              ...(typeof d.description === 'string'
                ? { description: d.description }
                : {}),
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
            ...(typeof d.title === 'string' ? { title: d.title } : {}),
            ...(typeof d.description === 'string'
              ? { description: d.description }
              : {}),
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

  // Đồng bộ liên trang khi 1 bài bị xoá/ẩn ở nơi khác.
  useEffect(() => {
    const handleRemoved = (event) => {
      const removedId = event.detail?.postId
      if (!removedId) return
      setResults((prev) => ({
        ...prev,
        posts: prev.posts.filter((p) => !matchesRemovedPost(p, removedId)),
      }))
      setSelectedPostDetail((prev) =>
        prev && matchesRemovedPost(prev, removedId) ? null : prev
      )
    }
    window.addEventListener(POST_REMOVED_EVENT, handleRemoved)
    return () => window.removeEventListener(POST_REMOVED_EVENT, handleRemoved)
  }, [])

  // Sync follow state across components
  useEffect(() => {
    const handleFollowSync = (event) => {
      const { userId, followed } = event.detail || {}
      if (!userId) return

      setFollowingIds(prev => {
        const newSet = new Set(prev)
        if (followed) {
          newSet.add(String(userId))
        } else {
          newSet.delete(String(userId))
        }
        return newSet
      })
    }

    window.addEventListener(FOLLOW_SYNC_EVENT, handleFollowSync)
    return () => window.removeEventListener(FOLLOW_SYNC_EVENT, handleFollowSync)
  }, [])

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
        setError(t('searchResults.searchError'))
        console.error(t('searchResults.searchErrorLog'), err)
        setResults({ posts: [], authors: [] })
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [query, t])

  // Fetch danh sách người đang follow
  useEffect(() => {
    if (!currentUserId) return

    const fetchFollowing = async () => {
      try {
        const token = getToken()

        const response = await fetch(`${API_BASE_URL}/social/follow-list/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const data = await response.json()
        console.log(t('searchResults.followListLog'), data)

        const followingList = data.data?.following || []

        setFollowingIds(
          new Set(followingList.map(item => String(item.id)))
        )
      } catch (err) {
        console.error(t('searchResults.fetchFollowingErrorLog'), err)
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
      const token = getToken()

      const response = await fetch(
        `${API_BASE_URL}/social/users/${authorId}/follow/`,
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
        const isFollowed = data.data?.followed ?? data.followed

        // Dispatch sync event
        window.dispatchEvent(new CustomEvent(FOLLOW_SYNC_EVENT, {
          detail: { userId: authorId, followed: isFollowed }
        }))

        setFollowingIds(prev => {
          const newSet = new Set(prev)

          if (isFollowed) {
            newSet.add(String(authorId))
          } else {
            newSet.delete(String(authorId))
          }

          return newSet
        })
      }
    } catch (err) {
      console.error(t('searchResults.followToggleErrorLog'), err)
    } finally {
      setLoadingFollow(prev => ({ ...prev, [authorId]: false }))
    }
  }

  const handleOpenPostDetail = useCallback((post) => {
    setSelectedPostDetail(post)
    setLikeCount(post.like_count || 0)
    setCommentCount(post.comment_count || 0)
    setLiked(post.is_liked || false)
    setSaved(post.is_saved || false)
    setShowPostDetail(true)
  }, [])

  const handleEditPost = useCallback((post) => {
    const postId =
      getCanonicalPostIdForEngagement(post) || String(post?.id ?? '')
    if (!postId) return
    setEditingPostId(postId)
    setEditPostModalOpen(true)
  }, [])

  const handlePostEdited = useCallback((next) => {
    if (!editingPostId || !next) return
    setResults((prev) => ({
      ...prev,
      posts: prev.posts.map((p) =>
        String(p.id) === String(editingPostId)
          ? {
              ...p,
              ...(typeof next.title === 'string' ? { title: next.title } : {}),
              ...(typeof next.description === 'string'
                ? { description: next.description }
                : {}),
            }
          : p
      ),
    }))
    window.dispatchEvent(
      new CustomEvent('post-sync-updated', {
        detail: {
          postId: editingPostId,
          title: next.title,
          description: next.description,
        },
      })
    )
  }, [editingPostId])

  const handleRequestDeletePost = useCallback((post) => {
    if (!post?.id) return
    setDeletingPost(post)
    setDeletePostConfirmOpen(true)
  }, [])

  const handleConfirmDeletePost = useCallback(async () => {
    if (!deletingPost) return
    const postId =
      getCanonicalPostIdForEngagement(deletingPost) ||
      String(deletingPost?.id ?? '')
    if (!postId) return

    try {
      setIsDeletingPost(true)
      const token = getToken()
      const res = await fetch(
        `${API_BASE_URL}/content/drafts/${encodeURIComponent(postId)}/delete/`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      )

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`Delete failed: ${res.status} ${errText}`)
      }

      pauseTrackIfDeleted(postId)
      deletePost(postId)
      removeSavedPost(postId)

      setResults((prev) => ({
        ...prev,
        posts: prev.posts.filter((p) => String(p.id) !== String(postId)),
      }))

      toast.success('Đã xóa bài viết')
      setDeletePostConfirmOpen(false)
      setDeletingPost(null)
    } catch (err) {
      console.error('Delete post failed:', err)
      toast.error('Không thể xóa bài viết')
    } finally {
      setIsDeletingPost(false)
    }
  }, [deletingPost, pauseTrackIfDeleted, deletePost, removeSavedPost])

  const handleRequestHidePost = useCallback((post) => {
    if (!post?.id) return
    setHidingPost(post)
    setHidePostConfirmOpen(true)
  }, [])

  const handleConfirmHidePost = useCallback(async () => {
    if (!hidingPost) return
    const postId =
      getCanonicalPostIdForEngagement(hidingPost) ||
      String(hidingPost?.id ?? '')
    if (!postId) return

    try {
      setIsHidingPost(true)
      const token = getToken()
      const res = await fetch(
        `${API_BASE_URL}/social/posts/${encodeURIComponent(postId)}/hide/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ user_id: currentUserId }),
        }
      )

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`Hide failed: ${res.status} ${errText}`)
      }

      pauseTrackIfDeleted(postId)
      hidePost(postId)

      setResults((prev) => ({
        ...prev,
        posts: prev.posts.filter((p) => String(p.id) !== String(postId)),
      }))

      toast.success('Đã ẩn bài viết')
      setHidePostConfirmOpen(false)
      setHidingPost(null)
    } catch (err) {
      console.error('Hide post failed:', err)
      toast.error('Không thể ẩn bài viết')
    } finally {
      setIsHidingPost(false)
    }
  }, [hidingPost, currentUserId, pauseTrackIfDeleted, hidePost])

  useEffect(() => {
    const handleOpenPostDetailFromPlayer = async (event) => {
      const rowPostId = event.detail?.postId
      if (!rowPostId) return

      const contentPostId =
        event.detail?.canonicalPostId ||
        getCanonicalPostIdForEngagement({
          id: rowPostId,
          postId: rowPostId,
          post_id: rowPostId,
        }) ||
        rowPostId

      if (!contentPostId || String(contentPostId).startsWith('share_')) return

      let post = results.posts.find((p) => String(p.id) === String(contentPostId))

      if (!post) {
        try {
          const token = getToken()
          const res = await fetch(
            `${API_BASE_URL}/content/posts/${encodeURIComponent(contentPostId)}/`,
            {
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            }
          )
          const json = await res.json()
          const raw = json.data
          if (!res.ok || !raw?.id) return
          post = {
            id: raw.id,
            title: raw.title,
            description: raw.description,
            author: raw.author,
            author_username: raw.author_username,
            author_id: raw.author_id,
            thumbnail_url: raw.thumbnail_url,
            audio_url: raw.audio_url,
            duration_seconds: raw.duration_seconds,
            like_count: raw.like_count,
            comment_count: raw.comment_count,
            share_count: raw.share_count,
            save_count: raw.save_count,
            is_liked: raw.is_liked,
            is_saved: raw.is_saved,
            created_at: raw.created_at,
            timeAgo: undefined,
          }
        } catch (err) {
          console.error(t('searchResults.loadPostFromPlayerFailedLog'), err)
          return
        }
      }

      if (!post) return

      handleOpenPostDetail(mapSearchPostToDetail(post, currentUser))
    }

    window.addEventListener('open-post-detail', handleOpenPostDetailFromPlayer)
    return () => {
      window.removeEventListener('open-post-detail', handleOpenPostDetailFromPlayer)
    }
  }, [results.posts, currentUser, handleOpenPostDetail])

  useEffect(() => {
    if (loading || results.posts.length === 0) return
    if (sessionStorage.getItem('returnFromEdit') !== 'true') return

    const openPostId = sessionStorage.getItem('openPostDetailId')
    if (!openPostId) return

    const post = results.posts.find(p => String(p.id) === String(openPostId))
    if (!post) return

    handleOpenPostDetail(mapSearchPostToDetail(post, currentUser))

    sessionStorage.removeItem('returnFromEdit')
    sessionStorage.removeItem('returnToAfterEdit')
    sessionStorage.removeItem('openPostDetailId')
    sessionStorage.removeItem('openPostDetailNoScroll')
  }, [loading, results.posts, currentUser, handleOpenPostDetail])

  const handleToggleLike = async () => {
    if (!selectedPostDetail?.id) return

    try {
      const token = getToken()
      const user = getCurrentUser()

      const response = await fetch(
        `${API_BASE_URL}/social/posts/${selectedPostDetail.id}/like/`,
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
      console.error(t('searchResults.toggleLikeFailedLog'), err)
    }
  }

  const handleToggleSave = async () => {
    if (!selectedPostDetail?.id) return

    try {
      const token = getToken()

      const user = getCurrentUser()

      const response = await fetch(
        `${API_BASE_URL}/social/posts/${selectedPostDetail.id}/save/`,
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
      console.error(t('searchResults.toggleSaveFailedLog'), err)
    }
  }

  const handleShare = async () => {
    try {
      const token = getToken()
      const response = await fetch(`${API_BASE_URL}/social/posts/${selectedPostDetail?.id}/share/`, {
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

      alert(t('searchResults.shareSuccess'))
    } catch (err) {
      console.error(t('searchResults.shareFailedLog'), err)
      alert(t('searchResults.shareError'))
    }
  }

  const handlePostDeleted = () => {
    setShowPostDetail(false)
    setSelectedPostDetail(null)
  }

  return (
    <>
      <div className={styles.searchResultsContainer}>
        <div className={styles.header}>
          <h1 className={styles.title}>{t('searchResults.pageTitle')}</h1>
          {query && (
            <p className={styles.query}>
              {t('searchResults.searchFor')} <strong>"{query}"</strong>
            </p>
          )}
        </div>

        {!query && (
          <div className={styles.emptyState}>
            <p>{t('searchResults.enterKeyword')}</p>
          </div>
        )}

        {query && loading && (
          <div className={styles.loadingState}>
            <p>{t('searchResults.searching')}</p>
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
                {t('searchResults.all')}
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'posts' ? styles.active : ''}`}
                onClick={() => handleTabChange('posts')}
              >
                {t('searchResults.podcasts', { count: visiblePosts.length })}
              </button>
              <button
                className={`${styles.tab} ${activeTab === 'authors' ? styles.active : ''}`}
                onClick={() => handleTabChange('authors')}
              >
                {t('searchResults.authors', { count: results.authors.length })}
              </button>
            </div>

            {/* Podcasts */}
            {(activeTab === 'all' || activeTab === 'posts') && (
              <div className={styles.section}>
                {visiblePosts.length === 0 ? (
                  <p className={styles.noResults}>{t('searchResults.noPodcasts')}</p>
                ) : (
                  <div className={styles.podcastsGrid}>
                    {visiblePosts.map((post) => (
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
                        isOwner={String(currentUserId) === String(post.author_id)}
                        onEdit={handleEditPost}
                        onDelete={handleRequestDeletePost}
                        onHide={handleRequestHidePost}
                        hideMenu
                        onClick={() =>
                          handleOpenPostDetail(mapSearchPostToDetail(post, currentUser))
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Divider */}
            {activeTab === 'all' && visiblePosts.length > 0 && results.authors.length > 0 && (
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
                      <div
                        key={author.id}
                        className={styles.authorCard}
                      >
                        <div
                          className={styles.authorAvatarWrapper}
                          role="button"
                          tabIndex={0}
                          onClick={() => navigate(`/profile/${author.id}`)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              navigate(`/profile/${author.id}`)
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        >
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
                            <div className={styles.authorAvatarFallback}>
                              {initials}
                            </div>
                          )}
                        </div>
                        <h4 className={styles.authorName}>{displayName}</h4>
                        <p className={styles.authorUsername}>@{author.username}</p>

                        {String(currentUserId) === String(author.id) ? (
                          <button
                            className={styles.followBtn}
                            onClick={(event) => {
                              event.stopPropagation()
                              navigate(`/profile/${author.id}`)
                            }}
                          >
                            {t('searchResults.viewProfile')}
                          </button>
                        ) : (
                          <button
                            className={`${styles.followBtn} ${followingIds.has(String(author.id)) ? styles.following : ''}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              handleFollowClick(author.id)
                            }}
                            disabled={loadingFollow[author.id]}
                          >
                            {loadingFollow[author.id]
                              ? '...'
                              : followingIds.has(String(author.id))
                                ? t('searchResults.following')
                                : t('searchResults.follow')}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {visiblePosts.length === 0 &&
              results.authors.length === 0 && (
                <div className={styles.noResults}>
                  <p>{t('searchResults.noResultsFor', { query })}</p>
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

      <EditPostModal
        isOpen={editPostModalOpen}
        postId={editingPostId}
        onClose={() => {
          setEditPostModalOpen(false)
          setEditingPostId(null)
        }}
        onSaved={handlePostEdited}
      />

      <ConfirmModal
        isOpen={deletePostConfirmOpen}
        onCancel={() => {
          if (isDeletingPost) return
          setDeletePostConfirmOpen(false)
          setDeletingPost(null)
        }}
        onConfirm={handleConfirmDeletePost}
        title="Xóa bài viết"
        message="Bạn có chắc muốn xóa bài viết này? Hành động này không thể hoàn tác."
        confirmText={isDeletingPost ? 'Đang xóa…' : 'Xóa bài viết'}
        cancelText="Hủy"
        isDangerous
        isLoading={isDeletingPost}
      />

      <ConfirmModal
        isOpen={hidePostConfirmOpen}
        type="confirm"
        title={t('feed.confirm.hidePostTitle')}
        message={t('feed.confirm.hidePostMessage')}
        confirmText={t('feed.confirm.hide')}
        cancelText={t('common.cancel')}
        isDangerous={false}
        onCancel={() => setHidePostConfirmOpen(false)}
        onConfirm={handleConfirmHidePost}
      />
    </>
  )
}

function formatSeconds(seconds) {
  const total = Math.floor(Number(seconds || 0))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}
