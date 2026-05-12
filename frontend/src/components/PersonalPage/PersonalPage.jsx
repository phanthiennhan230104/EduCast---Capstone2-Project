import React, { useState, useContext, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { PodcastContext } from '../contexts/PodcastContext'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { apiRequest } from '../../utils/api'
import { getInitials } from '../../utils/getInitials'
import { toast } from 'react-toastify'
import { getToken, getCurrentUser } from '../../utils/auth'
import PodcastCard from '../feed/PodcastCard'
import CommentModal from '../feed/CommentModal'
import { useTranslation } from 'react-i18next'
import ShareModal from '../feed/ShareModal'
import SaveCollectionModal from '../common/SaveCollectionModal'
import {
  CheckCircle2,
  Edit,
  Edit3,
  Share2,
  MoreHorizontal,
  Image as ImageIcon,
  PlayCircle,
  Clock,
  EyeOff,
  Flag,
  Trash2,
  Heart,
  MessageCircle,
  Bookmark,
} from 'lucide-react'
import styles from '../../style/personal/PersonalPage.module.css'

const TABS = ['Bài đăng', 'Bạn bè']

export default function PersonalPage() {
  const { t, i18n } = useTranslation()
  const [activeTab, setActiveTab] = useState('posts')
  const [posts, setPosts] = useState([])
  const [podcasts, setPodcasts] = useState([])
  const [friends, setFriends] = useState([])
  const [userProfile, setUserProfile] = useState(null)
  const [openMenuPostId, setOpenMenuPostId] = useState(null)
  const [failedAvatarUrls, setFailedAvatarUrls] = useState(new Set())
  const [postStates, setPostStates] = useState({}) // Track like, save, comment, share states
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedPost, setSelectedPost] = useState(null)
  const [showCollectionModal, setShowCollectionModal] = useState(false)
  const saveBookmarkRef = useRef(null)
  const { user } = useAuth()
  const { userId: routeUserId } = useParams()
  const navigate = useNavigate()
  const { deletedPostIds, deletedPostsVersion, hiddenPostIds, hiddenPostsVersion, deletePost, hidePost, addSavedPost, removeSavedPost } = useContext(PodcastContext)
  const { pauseTrackIfDeleted } = useAudioPlayer()

const profileUserId = routeUserId || user?.id
const isOwnProfile = String(profileUserId) === String(user?.id)
const profileAvatar =
  userProfile?.avatar_url ||
  userProfile?.avatar ||
  userProfile?.profile_image ||
  userProfile?.image ||
  ''

  React.useEffect(() => {
    if (!profileUserId) return

    fetchUserProfile()
    fetchUserPosts()
    fetchUserPodcasts()
    fetchUserFriends()
  }, [profileUserId])

  React.useEffect(() => {
    setPosts(prev => 
      prev.filter(p => !deletedPostIds.has(String(p.id)) && !hiddenPostIds.has(String(p.id)))
    )
  }, [deletedPostsVersion, hiddenPostsVersion])

  // Sync event for Feed and Profile page communication
  const POST_SYNC_EVENT = 'post-sync-updated'

  const dispatchPostSync = (payload) => {
    window.dispatchEvent(new CustomEvent(POST_SYNC_EVENT, { detail: payload }))
  }

  React.useEffect(() => {
    const handlePostSync = (event) => {
      const d = event.detail || {}

      if (!d.postId) return
      
      // Update localStorage cache (same as Feed does)
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

      // Update posts array
      setPosts(prev =>
        prev.map(p =>
          String(p.id) === String(d.postId)
            ? {
                ...p,
                liked: typeof d.liked === 'boolean' ? d.liked : p.liked,
                likes: typeof d.likeCount === 'number' ? d.likeCount : p.likes,
                saved: typeof d.saved === 'boolean' ? d.saved : p.saved,
                saveCount: typeof d.saveCount === 'number' ? d.saveCount : p.saveCount,
              }
            : p
        )
      )

      // Update postStates
      setPostStates(prev => ({
        ...prev,
        [d.postId]: {
          ...prev[d.postId],
          ...(typeof d.liked === 'boolean' ? { liked: d.liked } : {}),
          ...(typeof d.likeCount === 'number' ? { likeCount: d.likeCount } : {}),
          ...(typeof d.saved === 'boolean' ? { saved: d.saved } : {}),
          ...(typeof d.saveCount === 'number' ? { saveCount: d.saveCount } : {}),
        }
      }))
    }
    
    window.addEventListener(POST_SYNC_EVENT, handlePostSync)
    return () => window.removeEventListener(POST_SYNC_EVENT, handlePostSync)
  }, [])

  const fetchUserProfile = async () => {
    try {
      const data = await apiRequest(`/users/${profileUserId}/profile/`)
      setUserProfile(data.data || {})
    } catch (err) {
      console.error('Failed to fetch user profile:', err)
      setUserProfile(null)
    }
  }

  const fetchUserPosts = async () => {
    try {
      const data = await apiRequest(`/content/users/${profileUserId}/posts/?limit=100`)
      const posts = data.data?.posts || []

      console.log('📌 Fetched posts:', posts.map(p => ({ id: p.id, type: p.type, is_liked: p.is_liked, like_count: p.like_count, title: p.title })))

      // Load local overrides from localStorage
      const localCommentCountOverrides = JSON.parse(localStorage.getItem('personalPageCommentCountOverrides') || '{}')
      const profileHiddenPosts = JSON.parse(localStorage.getItem('profileHiddenPosts') || '[]')
      
      console.log('📌 Local comment count overrides:', localCommentCountOverrides)
      console.log('📌 Profile hidden posts:', profileHiddenPosts)
      
      const mappedPosts = posts.map((post) => {
        // Use backend field names directly (cả bài gốc và bài share đều dùng counts từ backend)
        const shareCount = post.share_count || 0
        const saveCount = post.save_count || 0
        // Combine local sync caches (post.id and post.post_id if it's a shared post)
        const cachedSync = JSON.parse(localStorage.getItem(`post-sync-${post.id}`) || 'null')
        const originalCachedSync = post.post_id ? JSON.parse(localStorage.getItem(`post-sync-${post.post_id}`) || 'null') : null
        const syncState = cachedSync || originalCachedSync || {}

        const isLiked = syncState.liked ?? (post.is_liked || false)
        const finalLikeCount = syncState.likeCount ?? (post.like_count || 0)
        const isSaved = syncState.saved ?? (post.is_saved || false)
        
        const hasLocalCommentOverride = post.id in localCommentCountOverrides
        const commentCount = hasLocalCommentOverride ? localCommentCountOverrides[post.id] : (post.comment_count || 0)

        console.log('📌 Post state:', {
          id: post.id,
          type: post.type,
          backendLiked: post.is_liked, 
          finalLiked: isLiked,
          backendLikeCount: post.like_count,
          finalLikeCount: finalLikeCount,
          backendCommentCount: post.comment_count,
          localCommentOverride: hasLocalCommentOverride ? localCommentCountOverrides[post.id] : 'none',
          finalCommentCount: commentCount
        })

        return {
          ...post, // Keep original data for fallback
          id: post.id,
          title: post.title,
          description: post.description,
          author: post.author || '',
          authorUsername: post.author_username || '',
          authorId: post.author_id || '',
          authorInitials: getInitials({ username: post.author_username, name: post.author } || 'A'),
          audioUrl: post.audio_url || '',
          durationSeconds: post.duration_seconds || 0,
          cover: post.thumbnail_url,
          thumbnail_url: post.thumbnail_url,
          tags: (post.tags || []).map(t => typeof t === 'object' ? `#${t.name || ''}` : (t.startsWith('#') ? t : `#${t}`)),
          aiGenerated: post.is_ai_generated || false,
          timeAgo: post.shared_at
            ? formatTimeAgo(post.shared_at)
            : (post.timeAgo || formatTimeAgo(post.created_at)),
          sharedTimeAgo: post.shared_at
            ? formatTimeAgo(post.shared_at)
            : (post.timeAgo || formatTimeAgo(post.created_at)),
          postTimeAgo: post.created_at
            ? formatTimeAgo(post.created_at)
            : (post.timeAgo || ''),
          listens: `${post.listen_count || 0} lượt nghe`,
          likes: finalLikeCount,
          comments: commentCount,
          shares: shareCount,
          saveCount: saveCount,
          liked: isLiked,
          saved: isSaved,
        }
      })
      
      const newPostStates = {}
      mappedPosts.forEach(post => {
        console.log('📌 Initializing post state:', {
          id: post.id,
          type: post.type,
          post_id: post.post_id,
          share_id: post.share_id,
          is_liked: post.is_liked,
          liked: post.liked,
          likes: post.likes,
          comments: post.comments,
          title: post.title
        })
        newPostStates[post.id] = {
          liked: post.liked,  
          likeCount: post.likes,
          saved: post.saved,
          saveCount: post.saveCount,
          commentCount: post.comments,  
          shareCount: post.shares,
        }
      })
      console.log('📌 postStates initialized:', newPostStates)
      setPostStates(newPostStates)
      
      const filteredPosts = mappedPosts.filter(p => 
        !deletedPostIds.has(String(p.id)) && 
        !hiddenPostIds.has(String(p.id)) &&
        !profileHiddenPosts.includes(p.id)
      )

      setPosts(filteredPosts)
    } catch (err) {
      console.error('Failed to fetch posts:', err)
      setPosts([])
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
    const data = await apiRequest(`/social/friends/?user_id=${profileUserId}`)
    setFriends(data.data?.friends || [])

    const following =
      data.data?.following ||
      data.data?.friends ||
      data.data?.results ||
      []

    setFriends(following)
  } catch (err) {
    console.error('Failed to fetch friends:', err)
    setFriends([])
  }
}

  const handleOpenOriginalPost = async (post) => {
    if (!post.post_id) return
    
    try {
      // Fetch the original post with its original stats
      const data = await apiRequest(`/content/posts/${post.post_id}/`)
      console.log('📌 Original post data:', data)
      
      if (data && data.data) {
        const origPost = data.data
        
        // Map to match PodcastCard format
        const mappedPost = {
          ...origPost,
          id: origPost.id,
          title: origPost.title,
          description: origPost.description,
          author: origPost.author || '',
          authorUsername: origPost.author_username || '',
          authorId: origPost.author_id || '',
          audioUrl: origPost.audio_url || '',
          durationSeconds: origPost.duration_seconds || 0,
          cover: origPost.thumbnail_url,
          thumbnail_url: origPost.thumbnail_url,
          tags: (origPost.tags || []).map(t => typeof t === 'object' ? `#${t.name || ''}` : (t.startsWith('#') ? t : `#${t}`)),
          aiGenerated: origPost.is_ai_generated || false,
          timeAgo: new Date(origPost.created_at).toLocaleDateString('vi-VN'),
          listens: origPost.listen_count || 0,
          likes: origPost.like_count || 0,
          comments: origPost.comment_count || 0,
          shares: origPost.share_count || 0,
          saveCount: origPost.save_count || 0,
          liked: origPost.is_liked || false,
          saved: origPost.is_saved || false,
        }
        
        // Use CommentModal to display original post (same as viewing comments)
        setSelectedPost(mappedPost)
        setShowCommentModal(true)
      }
    } catch (err) {
      console.error('Failed to fetch original post:', err)
      toast.error('Không thể tải bài đăng gốc')
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
        text: t('personal.profileShareText', { username: user.username }),
        url: profileUrl,
      })
    } else {
      navigator.clipboard.writeText(profileUrl)
      toast.success(t('personal.copiedLink'))
    }
  }

  const handleMoreOptions = () => {
    toast.info(t('personal.moreOptions'))
  }

  const handleToggleLike = async (postId) => {
    try {
      const token = getToken()
      const currentUser = getCurrentUser()

      // Get the post to find the actual post ID
      const post = posts.find(p => p.id === postId)
      if (!post) {
        console.error('❤️ Post not found:', postId)
        return
      }

      console.log('❤️ Like clicked on post:', {
        postId,
        type: post.type,
        post_id: post.post_id,
        share_id: post.share_id,
        currentLiked: postStates[postId]?.liked
      })

      // Use the composite ID (share_xxx_yyy) if it's a shared post, otherwise use post ID
      const likeEndpointId = postId

      const res = await fetch(
        `http://localhost:8000/api/social/posts/${likeEndpointId}/like/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            user_id: currentUser?.id,
          }),
        }
      )

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || `HTTP ${res.status}`)
      }

      const nextLiked = Boolean(data.data?.liked)
      const nextLikeCount = Number(data.data?.like_count || 0)

      console.log('❤️ Like response:', {
        postId,
        nextLiked,
        nextLikeCount,
        currentPostState: postStates[postId]
      })

      // IMPORTANT: Only update the specific post that was clicked
      // Do NOT update other posts even if they share the same original post
      setPostStates(prev => {
        const updated = {
          ...prev,
          [postId]: {
            ...prev[postId],
            liked: nextLiked,
            likeCount: nextLikeCount,
          }
        }
        console.log('❤️ Updated postStates for', postId, ':', updated[postId])
        return updated
      })

      // Update posts array - only update the specific post
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          console.log('❤️ Updating post in array:', { id: p.id, oldLiked: p.liked, newLiked: nextLiked })
          return { ...p, liked: nextLiked, likes: nextLikeCount }
        }
        return p
      }))

      // Dispatch sync event to notify Feed page
      dispatchPostSync({
        postId,
        liked: nextLiked,
        likeCount: nextLikeCount,
      })
    } catch (err) {
      console.error('Like failed:', err)
      toast.error(t('personal.likeError'))
    }
  }

  const handleToggleSave = async (postId) => {
    try {
      const currentState = postStates[postId]
      const isSaved = currentState?.saved || false

      // Use the composite ID (share_xxx_yyy) if it's a shared post, otherwise use post ID
      const saveEndpointId = postId

      
      if (isSaved) {
        // Unsave
        const token = getToken()
        const currentUser = getCurrentUser()

        const res = await fetch(
          `http://localhost:8000/api/social/posts/${saveEndpointId}/save/`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              user_id: currentUser?.id,
            }),
          }
        )

        const data = await res.json()

        if (!res.ok || !data.success) {
          throw new Error(data.message || `HTTP ${res.status}`)
        }

        const nextSaveCount = Number(data.data?.save_count || 0)

        setPostStates(prev => ({
          ...prev,
          [postId]: {
            ...prev[postId],
            saved: false,
            saveCount: nextSaveCount,
          }
        }))

        removeSavedPost(postId)

        setPosts(prev => prev.map(p =>
          p.id === postId
            ? { ...p, saved: false, saveCount: nextSaveCount }
            : p
        ))

        // Dispatch sync event to notify Feed page
        dispatchPostSync({
          postId,
          saved: false,
          saveCount: nextSaveCount,
        })
      } else {
        // Show collection modal
        setSelectedPost(posts.find(p => p.id === postId))
        setShowCollectionModal(true)
      }
    } catch (err) {
      console.error('Save failed:', err)
      toast.error(t('personal.saveError'))
    }
  }

  const handleCollectionModalSave = (postId) => {
    const newSaveCount = (postStates[postId]?.saveCount || 0) + 1

    setPostStates(prev => ({
      ...prev,
      [postId]: {
        ...prev[postId],
        saved: true,
        saveCount: newSaveCount,
      }
    }))

    addSavedPost(postId)
    setPosts(prev => prev.map(p => 
      p.id === postId 
        ? { ...p, saved: true, saveCount: newSaveCount }
        : p
    ))

    // Dispatch sync event to notify Feed page
    dispatchPostSync({
      postId,
      saved: true,
      saveCount: newSaveCount,
    })

    setShowCollectionModal(false)
  }

  const handleOpenCommentModal = (post) => {
    setSelectedPost(post)
    setShowCommentModal(true)
  }

  const handleOpenShareModal = (post) => {
    setSelectedPost(post)
    setShowShareModal(true)
  }

  const handleCommentCountChange = (postId, newCount) => {
    console.log('💬 Comment count changed:', { postId, newCount })

    // Save local override to localStorage
    const localCommentCountOverrides = JSON.parse(localStorage.getItem('personalPageCommentCountOverrides') || '{}')
    localCommentCountOverrides[postId] = newCount
    localStorage.setItem('personalPageCommentCountOverrides', JSON.stringify(localCommentCountOverrides))
    console.log('💬 Saved local comment count override:', { postId, count: newCount })

    setPostStates(prev => ({
      ...prev,
      [postId]: {
        ...prev[postId],
        commentCount: newCount,
      }
    }))

    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, comments: newCount }
        : p
    ))

    // Note: Comment count sync is handled automatically by Feed page
    // when comments are added/removed via CommentModal
  }

  const handleShareSuccess = (postId, data) => {
    console.log('📤 Share success - postId:', postId)
    console.log('📤 Share success - data:', data)

    // Backend trả về like_count, comment_count, save_count, share_count
    const newShareCount = Number(data?.share_count || 0)
    const newLikeCount = Number(data?.like_count)
    const newCommentCount = Number(data?.comment_count)
    const newSaveCount = Number(data?.save_count)

    console.log('📤 Parsed counts:', { newShareCount, newLikeCount, newCommentCount, newSaveCount })

    setPostStates(prev => {
      const updated = {
        ...prev,
        [postId]: {
          ...prev[postId],
          shareCount: newShareCount,
          // Giữ nguyên các giá trị khác nếu backend không trả về
          ...(typeof newLikeCount === 'number' && !isNaN(newLikeCount) ? { likeCount: newLikeCount } : {}),
          ...(typeof newCommentCount === 'number' && !isNaN(newCommentCount) ? { commentCount: newCommentCount } : {}),
          ...(typeof newSaveCount === 'number' && !isNaN(newSaveCount) ? { saveCount: newSaveCount } : {}),
        }
      }
      console.log('📤 Updated postStates:', updated[postId])
      return updated
    })

    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const updated = {
          ...p,
          shares: newShareCount,
          // Giữ nguyên các giá trị khác nếu backend không trả về
          ...(typeof newLikeCount === 'number' && !isNaN(newLikeCount) ? { likes: newLikeCount } : {}),
          ...(typeof newCommentCount === 'number' && !isNaN(newCommentCount) ? { comments: newCommentCount } : {}),
          ...(typeof newSaveCount === 'number' && !isNaN(newSaveCount) ? { saveCount: newSaveCount } : {}),
        }
        console.log('📤 Updated post:', updated)
        return updated
      }
      return p
    }))

    // Dispatch sync event to notify Feed page about all updated counts
    dispatchPostSync({
      postId,
      ...(typeof newLikeCount === 'number' && !isNaN(newLikeCount) ? { likeCount: newLikeCount } : {}),
      ...(typeof newCommentCount === 'number' && !isNaN(newCommentCount) ? { commentCount: newCommentCount } : {}),
      ...(typeof newSaveCount === 'number' && !isNaN(newSaveCount) ? { saveCount: newSaveCount } : {}),
    })
  }

  const handleDeletePost = async (postId) => {
    try {
      const post = posts.find(p => p.id === postId)
      if (!post) return

      console.log('👤 [PersonalPage] handleDeletePost called:', { postId, type: typeof postId })
      console.log('👤 [PersonalPage] Calling pauseTrackIfDeleted')
      pauseTrackIfDeleted(postId)

      const token = getToken()
      const currentUser = getCurrentUser()

      if (post.type === 'shared') {
        const res = await fetch(`http://localhost:8000/api/social/posts/${post.post_id}/unshare/`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            user_id: currentUser?.id,
          }),
        })

        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.message || `HTTP ${res.status}`)
        }
      } else {
        const hiddenPosts = JSON.parse(localStorage.getItem('profileHiddenPosts') || '[]')
        if (!hiddenPosts.includes(postId)) {
          hiddenPosts.push(postId)
          localStorage.setItem('profileHiddenPosts', JSON.stringify(hiddenPosts))
        }
      }

      console.log('👤 [PersonalPage] Calling deletePost')
      setPosts(prev => {
        const filtered = prev.filter(p => p.id !== postId)
        console.log('👤 [PersonalPage] UI updated:', prev.length, '->', filtered.length)
        return filtered
      })
      deletePost(postId)
      toast.success(t('personal.deleteSuccess'))
    } catch (err) {
      console.error('Delete failed:', err)
      toast.error(t('personal.deleteError', { message: err.message }))
    }
  }

  const handleHidePost = (postId) => {
    console.log('👤 [PersonalPage] handleHidePost called:', { postId, type: typeof postId })
    console.log('👤 [PersonalPage] Calling pauseTrackIfDeleted')
    pauseTrackIfDeleted(postId)
    setPosts(prev => prev.filter(p => p.id !== postId))
    hidePost(postId)
    toast.success(t('personal.hideSuccess'))
  }

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
          {isOwnProfile && (
            <button className={styles.editCoverBtn}>
              <ImageIcon size={16} />
              <span className={styles.editCoverText}>Chỉnh sửa ảnh bìa</span>
            </button>
          )}
        </div>

        {/* Profile Info Row */}
        <div className={styles.profileSection}>
          <div className={styles.profileRow}>
            {/* Avatar */}
            <div className={styles.avatarWrapper}>
              <div className={styles.avatar}>
                {profileAvatar && !failedAvatarUrls.has('profile') ? (
                  <img
                    src={profileAvatar}
                    alt="Avatar"
                    className={styles.avatarImage}
                    onError={() => {
                      setFailedAvatarUrls(prev => new Set([...prev, 'profile']))
                    }}
                  />
                ) : (
                  <div className={styles.avatarInitialsLarge}>
                    {getInitials({
                      username: userProfile?.username,
                      display_name: userProfile?.display_name,
                      name: userProfile?.full_name || userProfile?.name,
                    } || 'User')}
                  </div>
                )}
              </div>
            </div>

            {/* Name & Stats */}
            <div className={styles.profileInfo}>
              <h1 className={styles.profileName}>
                {userProfile?.display_name || userProfile?.full_name || userProfile?.name || userProfile?.username || 'User'}
              </h1>
              <p className={styles.profileStats}>
                {userProfile?.podcast_count || 0} Podcast · {userProfile?.followers_count || 0} Người theo dõi · {userProfile?.following_count || 0} Đang theo dõi
              </p>
            </div>

            {/* Actions */}
            <div className={styles.actions}>
              {isOwnProfile && (
                <button className={styles.editBtn} onClick={handleEditProfile}>
                  <Edit3 size={16} />
                  Chỉnh sửa
                </button>
              )}
              <button className={styles.shareBtn} onClick={handleShareProfile}>
                <Share2 size={16} />
                {t('personal.share')}
              </button>
              <button className={styles.moreBtn} onClick={handleMoreOptions}>
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>

          {/* Bio */}
          <p className={styles.bio}>
            {userProfile?.bio || user?.bio || t('personal.defaultBio')}          </p>
        </div>

        {/* Tabs */}
        <div className={styles.tabsContainer}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`${styles.tabBtn} ${activeTab === tab.key ? styles.activeTab : ''}`}
            >
              {t(tab.labelKey)}
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
                  {posts.length > 0 ? (
                    posts.map((post) => {
                      const isOriginalPost = post.type !== 'shared'

                      // If it's own post, display like Feed (just PodcastCard without share frame)
                      if (isOriginalPost) {
                        return (
                          <div key={post.id} className={styles.postCard}>
                            <PodcastCard
                              podcast={post}
                              queue={posts}
                              onDelete={handleDeletePost}
                              onHide={handleHidePost}
                              hideMenu={false}
                              hideActions={false}
                            />
                          </div>
                        )
                      }

                      // If it's a shared post from someone else, display with share frame
                      return (
                        <div key={post.id} className={styles.postShareContainer}>
                          {/* Wrapper div bao quanh tất cả */}
                          <div className={styles.postShareWrapper}>
                            {/* Share Info Header - Hiển thị tên người chia sẻ và thời gian */}
                            <div className={styles.postShareInfo}>
                              <div className={styles.postShareAuthor}>
                                {profileAvatar && !failedAvatarUrls.has('postShare') ? (
                                  <div className={styles.postShareAvatarWrapper}>
                                    <img 
                                      src={profileAvatar}
                                      alt={userProfile?.username || userProfile?.display_name || 'Avatar'}
                                      className={styles.postShareAvatar}
                                      onError={() => {
                                        setFailedAvatarUrls(prev => new Set([...prev, 'postShare']))
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div className={styles.postShareAvatarWrapper}>
                                    <div className={styles.postShareAvatarInitials}>
                                      {getInitials({
                                        username: userProfile?.username,
                                        display_name: userProfile?.display_name,
                                        name: userProfile?.full_name || userProfile?.name,
                                      } || 'User')}
                                    </div>
                                  </div>
                                )}
                                <div>
                                  <h5 className={styles.postShareAuthorName}>
                                    {userProfile?.display_name || userProfile?.full_name || userProfile?.name || user?.username}
                                  </h5>
                                  <p className={styles.postShareTime}>
                                    {post.sharedTimeAgo || post.timeAgo || formatTimeAgo(post.shared_at || post.created_at)}
                                  </p>
                                </div>
                              </div>
                              <div className={styles.postMenuWrap}>
                                <button 
                                  className={styles.postShareMenuBtn}
                                  onClick={() => setOpenMenuPostId(openMenuPostId === post.id ? null : post.id)}
                                >
                                  <MoreHorizontal size={20} />
                                </button>
                                {openMenuPostId === post.id && (
                                  <div className={styles.postMenu}>
                                    <button 
                                      className={styles.postMenuOption}
                                      onClick={() => {
                                        setOpenMenuPostId(null)
                                        toast.info('Chức năng chỉnh sửa bài chia sẻ đang phát triển')
                                      }}
                                    >
                                      <Edit size={16} />
                                      <span>Chỉnh sửa</span>
                                    </button>
                                    <button 
                                      className={`${styles.postMenuOption} ${styles.danger}`}
                                      onClick={() => handleDeletePost(post.id)}
                                    >
                                      <Trash2 size={16} />
                                      <span>Xóa</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Share Caption - Hiển thị nội dung chia sẻ */}
                            {post.share_caption && (
                              <div className={styles.shareCaption}>
                                <p>{post.share_caption}</p>
                              </div>
                            )}

                            {/* Shared Post Content - Hiển thị bài đăng gốc */}
                            <div 
                              className={styles.postCard}
                              onClick={() => handleOpenOriginalPost(post)}
                              style={{ cursor: 'pointer' }}
                              title="Click để xem bài đăng gốc"
                            >
                              <PodcastCard
                                podcast={{ ...post, timeAgo: post.postTimeAgo || post.timeAgo }}
                                queue={posts}
                                onDelete={handleDeletePost}
                                onHide={handleHidePost}
                                hideMenu={true}
                                hideActions={true}
                              />
                            </div>

                            {/* Share Actions - Hiển thị like, comment, share, lưu */}
                            <div className={styles.postShareActions}>
                              <button 
                                className={`${styles.shareActionBtn} ${postStates[post.id]?.liked ? styles.liked : ''}`}
                                onClick={() => handleToggleLike(post.id)}
                              >
                                <Heart size={16} fill={postStates[post.id]?.liked ? 'currentColor' : 'none'} />
                                <span>{postStates[post.id]?.likeCount ?? post.likes ?? 0}</span>
                              </button>
                              <button 
                                className={styles.shareActionBtn}
                                onClick={() => handleOpenCommentModal(post)}
                              >
                                <MessageCircle size={16} />
                                <span>{postStates[post.id]?.commentCount ?? post.comments ?? 0} Bình luận</span>
                              </button>
                              <button 
                                className={styles.shareActionBtn}
                                onClick={() => handleOpenShareModal(post)}
                              >
                                <Share2 size={16} />
                                <span>{postStates[post.id]?.shareCount ?? post.shares ?? 0} Chia sẻ</span>
                              </button>
                              <button 
                                ref={saveBookmarkRef}
                                className={`${styles.shareActionBtn} ${postStates[post.id]?.saved ? styles.saved : ''}`}
                                onClick={() => handleToggleSave(post.id)}
                              >
                                <Bookmark size={16} fill={postStates[post.id]?.saved ? 'currentColor' : 'none'} />
                                <span>{postStates[post.id]?.saveCount ?? post.saveCount ?? 0} Lưu</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className={styles.emptyState}>
                      <p>{t('personal.noPosts')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}


            {activeTab === 'friends' && (
              <div className={styles.tabContent}>
                <div className={styles.tabContentHeader}>
                  <h3 className={styles.cardTitle}>{t('personal.tabs.friends')}</h3>
                  <div className={styles.friendsCount}>
                    {t('personal.people', { count: friends.length })}
                  </div>
                </div>
                <div className={styles.friendsGrid}>
                  {friends.length > 0 ? (
                    friends.map((friend) => (
                      <div key={friend.name || friend.username} className={styles.friendCard}>
                        {(friend.avatar_url || friend.avatar) && !failedAvatarUrls.has(`friend-${friend.id || friend.username}`) ? (
                          <img 
                            src={friend.avatar_url || friend.avatar} 
                            alt={friend.name || friend.username} 
                            className={styles.friendAvatar} 
                            onError={() => setFailedAvatarUrls(prev => new Set([...prev, `friend-${friend.id || friend.username}`]))}
                          />
                        ) : (
                          <div className={styles.friendAvatarInitials}>
                            {getInitials({ username: friend.username, display_name: friend.display_name, name: friend.name } || 'User')}
                          </div>
                        )}
                        <div>
                          <h4 className={styles.friendName}>{friend.name || friend.display_name || friend.username}</h4>
                          <button className={styles.followingBadge}>Đang theo dõi</button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.emptyState}>
                      <p>{t('personal.noFriends')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {showCommentModal && selectedPost && (
        <CommentModal
          podcast={selectedPost}
          liked={postStates[selectedPost.id]?.liked ?? selectedPost.liked ?? false}
          saved={postStates[selectedPost.id]?.saved ?? selectedPost.saved ?? false}
          likeCount={postStates[selectedPost.id]?.likeCount ?? selectedPost.likes ?? 0}
          shareCount={postStates[selectedPost.id]?.shareCount ?? selectedPost.shares ?? 0}
          saveCount={postStates[selectedPost.id]?.saveCount ?? selectedPost.saveCount ?? 0}
          commentCount={postStates[selectedPost.id]?.commentCount ?? selectedPost.comments ?? 0}
          onClose={() => setShowCommentModal(false)}
          onCommentCountChange={(newCount) => handleCommentCountChange(selectedPost.id, newCount)}
          onToggleLike={() => handleToggleLike(selectedPost.id)}
          onToggleSave={() => handleToggleSave(selectedPost.id)}
          onShare={() => handleOpenShareModal(selectedPost)}
          onPostDeleted={() => {
            setShowCommentModal(false)
            handleDeletePost(selectedPost.id)
          }}
        />
      )}

      {showShareModal && selectedPost && (
        <ShareModal
          podcast={selectedPost}
          onClose={() => setShowShareModal(false)}
          onShareSuccess={(data) => handleShareSuccess(selectedPost.id, data)}
        />
      )}

      <SaveCollectionModal
        isOpen={showCollectionModal}
        onClose={() => setShowCollectionModal(false)}
        postId={selectedPost?.id}
        onSave={() => handleCollectionModalSave(selectedPost?.id)}
        triggerRef={saveBookmarkRef}
        isPopup={false}
      />
    </div>
  )
}

function formatTimeAgo(dateString) {
  if (!dateString) return 'Vừa xong'

  const created = new Date(dateString)
  const now = new Date()
  const diffMs = now - created
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return 'Vừa xong'
  if (diffMinutes < 60) return `${diffMinutes} phút trước`
  if (diffHours < 24) return `${diffHours} giờ trước`
  return `${diffDays} ngày trước`
}
