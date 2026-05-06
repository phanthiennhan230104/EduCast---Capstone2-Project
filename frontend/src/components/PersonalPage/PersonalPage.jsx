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
import ShareModal from '../feed/ShareModal'
import SaveCollectionModal from '../common/SaveCollectionModal'
import {
  CheckCircle2,
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

const TABS = ['Bài đăng', 'Podcast', 'Bạn bè']

export default function PersonalPage() {
  const [activeTab, setActiveTab] = useState('Bài đăng')
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
  const { username: routeUsername } = useParams()
  const navigate = useNavigate()
  const { deletedPostIds, deletedPostsVersion, hiddenPostIds, hiddenPostsVersion, deletePost, hidePost, addSavedPost, removeSavedPost } = useContext(PodcastContext)
  const { pauseTrackIfDeleted } = useAudioPlayer()

  React.useEffect(() => {
    // If routeUsername is present, show that user's profile; otherwise use logged-in user
    if (!user?.id && !routeUsername) return
    fetchUserProfile()
    fetchUserPosts()
    fetchUserPodcasts()
    fetchUserFriends()
  }, [user?.id, routeUsername])

  React.useEffect(() => {
    setPosts(prev => 
      prev.filter(p => !deletedPostIds.has(String(p.id)) && !hiddenPostIds.has(String(p.id)))
    )
  }, [deletedPostsVersion, hiddenPostsVersion])

  const fetchUserProfile = async () => {
    try {
      // If routeUsername provided, try to load that user's profile
      if (routeUsername) {
        try {
          const byName = await apiRequest(`/users/username/${routeUsername}/profile/`)
          setUserProfile(byName.data || {})
          return
        } catch (err) {
          // fallback: try search endpoint to resolve id
          try {
            const search = await apiRequest(`/users/?username=${routeUsername}`)
            const found = (search.data?.results || search.data || []).find(u => u.username === routeUsername)
            if (found?.id) {
              const data = await apiRequest(`/users/${found.id}/profile/`)
              setUserProfile(data.data || {})
              return
            }
          } catch (err2) {
            console.warn('Fallback username lookup failed', err2)
          }
        }
      }

      // Default: current user
      const data = await apiRequest(`/users/${user.id}/profile/`)
      console.log('User profile data:', data.data)
      setUserProfile(data.data || {})
    } catch (err) {
      console.error('Failed to fetch user profile:', err)
      setUserProfile(null)
    }
  }

  const fetchUserPosts = async () => {
    try {
      const data = await apiRequest(`/content/users/${user?.id}/posts/?limit=100`)
      const posts = data.data?.posts || []
      
      console.log('📌 Fetched posts:', posts.map(p => ({ id: p.id, type: p.type, is_liked: p.is_liked, like_count: p.like_count, title: p.title })))
      
      const localLikeOverrides = JSON.parse(localStorage.getItem('personalPageLikeOverrides') || '{}')
      const localCommentCountOverrides = JSON.parse(localStorage.getItem('personalPageCommentCountOverrides') || '{}')
      const profileHiddenPosts = JSON.parse(localStorage.getItem('profileHiddenPosts') || '[]')
      
      console.log('📌 Local like overrides:', localLikeOverrides)
      console.log('📌 Local comment count overrides:', localCommentCountOverrides)
      console.log('📌 Profile hidden posts:', profileHiddenPosts)
      
      const mappedPosts = posts.map((post) => {
        const likeCount = post.like_count || 0
        const shareCount = post.share_count || 0
        const saveCount = post.save_count || 0
        
        const hasLocalLikeOverride = post.id in localLikeOverrides
        const isLiked = hasLocalLikeOverride ? localLikeOverrides[post.id] : (post.is_liked || false)
        const isSaved = post.is_saved || false
        
        const hasLocalCommentOverride = post.id in localCommentCountOverrides
        const commentCount = hasLocalCommentOverride ? localCommentCountOverrides[post.id] : (post.comment_count || 0)
        
        console.log('📌 Post state:', { 
          id: post.id,
          type: post.type,
          backendLiked: post.is_liked, 
          localLikeOverride: hasLocalLikeOverride ? localLikeOverrides[post.id] : 'none',
          finalLiked: isLiked,
          backendLikeCount: post.like_count,
          finalLikeCount: likeCount,
          backendCommentCount: post.comment_count,
          localCommentOverride: hasLocalCommentOverride ? localCommentCountOverrides[post.id] : 'none',
          finalCommentCount: commentCount
        })
        
        return {
          id: post.id,
          title: post.title,
          description: post.description,
          author: post.author || '',
          authorUsername: post.author_username || '',
          authorId: post.author_id || '',
          authorInitials: getInitials(userProfile?.display_name || user?.username || 'User'),
          audioUrl: post.audio_url || '',
          durationSeconds: post.duration_seconds || 0,
          cover: post.thumbnail_url,
          thumbnail_url: post.thumbnail_url,
          tags: post.tags || [],
          aiGenerated: post.is_ai_generated || false,
          timeAgo: post.timeAgo || new Date(post.created_at).toLocaleDateString('vi-VN'),
          listens: post.listen_count || 0,
          likes: likeCount,
          comments: commentCount,
          shares: shareCount,
          saveCount: saveCount,
          liked: isLiked,
          saved: isSaved,
          ...post, 
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

      // Save local override to localStorage
      const localLikeOverrides = JSON.parse(localStorage.getItem('personalPageLikeOverrides') || '{}')
      localLikeOverrides[postId] = nextLiked
      localStorage.setItem('personalPageLikeOverrides', JSON.stringify(localLikeOverrides))
      console.log('❤️ Saved local override:', { postId, liked: nextLiked })

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
    } catch (err) {
      console.error('Like failed:', err)
      toast.error('Lỗi khi thích bài viết')
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
      } else {
        // Show collection modal
        setSelectedPost(posts.find(p => p.id === postId))
        setShowCollectionModal(true)
      }
    } catch (err) {
      console.error('Save failed:', err)
      toast.error('Lỗi khi lưu bài viết')
    }
  }

  const handleCollectionModalSave = (postId) => {
    setPostStates(prev => ({
      ...prev,
      [postId]: {
        ...prev[postId],
        saved: true,
        saveCount: (prev[postId]?.saveCount || 0) + 1,
      }
    }))

    addSavedPost(postId)
    setPosts(prev => prev.map(p => 
      p.id === postId 
        ? { ...p, saved: true, saveCount: (p.saveCount || 0) + 1 }
        : p
    ))
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
      toast.success('Đã xóa bài đăng khỏi trang cá nhân')
    } catch (err) {
      console.error('Delete failed:', err)
      toast.error('Lỗi khi xóa bài viết: ' + err.message)
    }
  }

  const handleHidePost = (postId) => {
    console.log('👤 [PersonalPage] handleHidePost called:', { postId, type: typeof postId })
    console.log('👤 [PersonalPage] Calling pauseTrackIfDeleted')
    pauseTrackIfDeleted(postId)
    setPosts(prev => prev.filter(p => p.id !== postId))
    hidePost(postId)
    toast.success('Đã ẩn bài đăng')
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
                {(userProfile?.avatar_url || user?.avatar_url) && !failedAvatarUrls.has('profile') ? (
                  <img
                    src={userProfile?.avatar_url || user?.avatar_url}
                    alt="Avatar"
                    className={styles.avatarImage}
                    onError={() => {
                      setFailedAvatarUrls(prev => new Set([...prev, 'profile']))
                    }}
                  />
                ) : (
                  <div className={styles.avatarInitialsLarge}>
                    {getInitials(userProfile?.display_name || user?.username || 'User')}
                  </div>
                )}
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
                {podcasts.length || 0} Podcast · {userProfile?.followers_count || 0} Người theo dõi · {userProfile?.following_count || 0} Đang theo dõi
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
                  {posts.length > 0 ? (
                    posts.map((post) => (
                      <div key={post.id} className={styles.postShareContainer}>
                        {/* Wrapper div bao quanh tất cả */}
                        <div className={styles.postShareWrapper}>
                          {/* Share Info Header - Hiển thị tên người chia sẻ và thời gian */}
                          <div className={styles.postShareInfo}>
                            <div className={styles.postShareAuthor}>
                              {(userProfile?.avatar_url || user?.avatar_url) && !failedAvatarUrls.has('postShare') ? (
                                <div className={styles.postShareAvatarWrapper}>
                                  <img 
                                    src={userProfile?.avatar_url || user?.avatar_url} 
                                    alt={user?.username} 
                                    className={styles.postShareAvatar}
                                    onError={() => {
                                      setFailedAvatarUrls(prev => new Set([...prev, 'postShare']))
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className={styles.postShareAvatarWrapper}>
                                  <div className={styles.postShareAvatarInitials}>
                                    {getInitials(userProfile?.display_name || user?.username || 'User')}
                                  </div>
                                </div>
                              )}
                              <div>
                                <h5 className={styles.postShareAuthorName}>
                                  {userProfile?.display_name || userProfile?.full_name || userProfile?.name || user?.username}
                                </h5>
                                <p className={styles.postShareTime}>{post.timeAgo || new Date(post.created_at).toLocaleDateString('vi-VN')}</p>
                              </div>
                            </div>
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
                                  onClick={() => handleHidePost(post.id)}
                                >
                                  <EyeOff size={16} />
                                  <span>Ẩn bài đăng</span>
                                </button>
                                <button 
                                  className={styles.postMenuOption}
                                  onClick={() => {
                                    setOpenMenuPostId(null)
                                    toast.info('Báo cáo bài đăng')
                                  }}
                                >
                                  <Flag size={16} />
                                  <span>Báo cáo</span>
                                </button>
                                <button 
                                  className={styles.postMenuOption}
                                  onClick={() => handleDeletePost(post.id)}
                                >
                                  <Trash2 size={16} />
                                  <span>Xóa bài đăng</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Share Caption - Hiển thị nội dung chia sẻ */}
                          {post.share_caption && (
                            <div className={styles.shareCaption}>
                              <p>{post.share_caption}</p>
                            </div>
                          )}

                          {/* Shared Post Content - Hiển thị bài đăng gốc */}
                          <div className={styles.postCard}>
                            <PodcastCard
                              podcast={post}
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
                    ))
                  ) : (
                    <div className={styles.emptyState}>
                      <p>Chưa có bài đăng nào</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'Podcast' && (
              <div className={styles.tabContent}>
                <h3 className={styles.cardTitle}>Podcast của tôi</h3>
                <div className={styles.podcastsGrid}>
                  {podcasts.length > 0 ? (
                    podcasts.map((pod) => (
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
                    ))
                  ) : (
                    <div className={styles.emptyState}>
                      <p>Chưa có podcast nào</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'Bạn bè' && (
              <div className={styles.tabContent}>
                <div className={styles.tabContentHeader}>
                  <h3 className={styles.cardTitle}>Bạn bè</h3>
                  <div className={styles.friendsCount}>{friends.length} người</div>
                </div>
                <div className={styles.friendsGrid}>
                  {friends.length > 0 ? (
                    friends.map((friend) => (
                      <div key={friend.name || friend.username} className={styles.friendCard}>
                        <img src={friend.avatar_url || friend.avatar} alt={friend.name || friend.username} className={styles.friendAvatar} />
                        <div>
                          <h4 className={styles.friendName}>{friend.name || friend.display_name || friend.username}</h4>
                          <p className={styles.friendMutual}>{friend.mutual || 0} bạn chung</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.emptyState}>
                      <p>Chưa có bạn bè nào</p>
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
        isPopup={true}
      />
    </div>
  )
}
