import React, { useState, useContext, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { PodcastContext } from '../contexts/PodcastContext'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { apiRequest } from '../../utils/api'
import { getInitials } from '../../utils/getInitials'
import { toast } from 'react-toastify'
import { message, Dropdown } from 'antd'
import { getToken, getCurrentUser } from '../../utils/auth'
import { EDUCAST_PERSONAL_SHARE_SUCCESS } from '../../utils/appEvents'
import PodcastCard from '../feed/PodcastCard'
import CommentModal from '../feed/CommentModal'
import ShareModal from '../feed/ShareModal'
import ProfileShareModal from '../feed/ProfileShareModal'
import EditShareCaptionModal from '../feed/EditShareCaptionModal'
import EditPostModal from '../feed/EditPostModal'
import ReportPostModal from '../feed/ReportPostModal'
import SaveCollectionModal from '../common/SaveCollectionModal'
import FollowListModal from '../personal/FollowListModal'
import { useTranslation } from 'react-i18next'
import { API_BASE_URL } from '../../config/apiBase'
import { POST_REMOVED_EVENT, matchesRemovedPost } from '../../utils/postRemoval'
import {
  Edit,
  Edit3,
  Share2,
  MoreHorizontal,
  Image as ImageIcon,
  Trash2,
  Heart,
  MessageCircle,
  Bookmark,
  AlertCircle,
  RotateCcw,
  UserCheck,
  UserPlus,
  Clock,
  Archive,
  EyeOff,
  Flag,
} from 'lucide-react'
import styles from '../../style/personal/PersonalPage.module.css'

function engagementPostIdProfile(post) {
  if (!post) return null
  if (post.post_id != null && post.post_id !== '') return post.post_id
  return post.id
}

const TABS = [
  { key: 'posts', labelKey: 'personal.tabs.posts' },
  { key: 'friends', labelKey: 'personal.tabs.friends' },
]

export default function PersonalPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('posts')
  const [posts, setPosts] = useState([])
  const [podcasts, setPodcasts] = useState([])
  const [friends, setFriends] = useState([])
  const [userProfile, setUserProfile] = useState(null)
  const [profileAccessErrorType, setProfileAccessErrorType] = useState(null) // 'private', 'followers_only', or null
  const [openMenuPostId, setOpenMenuPostId] = useState(null)
  const [failedAvatarUrls, setFailedAvatarUrls] = useState(new Set())
  const [postStates, setPostStates] = useState({})
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [disableCommentAutoScroll, setDisableCommentAutoScroll] = useState(true)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showProfileShareModal, setShowProfileShareModal] = useState(false)
  const [editShareCaptionPost, setEditShareCaptionPost] = useState(null)
  const [editPostModalPost, setEditPostModalPost] = useState(null)
  const [selectedPost, setSelectedPost] = useState(null)
  const [reportPostModalPost, setReportPostModalPost] = useState(null)
  const [showCollectionModal, setShowCollectionModal] = useState(false)
  const [followModal, setFollowModal] = useState({ isOpen: false, type: 'followers' })
  const [followingIds, setFollowingIds] = useState(new Set())
  const [loadingFollow, setLoadingFollow] = useState({})
  const [sharedActionHover, setSharedActionHover] = useState({
    rowKey: null,
    kind: null,
    items: [],
    loading: false,
  })
  const sharedActionHoverLeaveTimerRef = useRef(null)

  const saveBookmarkRef = useRef(null)
  const { user } = useAuth()
  const { userId: routeUserId } = useParams()
  const navigate = useNavigate()

  const {
    deletedPostIds,
    deletedPostsVersion,
    hiddenPostIds,
    hiddenPostsVersion,
    deletePost,
    hidePost,
    addSavedPost,
    removeSavedPost,
  } = useContext(PodcastContext)

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
    const handleSocialUpdate = (event) => {
      const { type, data } = event.detail
      if (type === 'follow_change') {
        const { follower_id, following_id, followed } = data
        const followerIdStr = String(follower_id)
        const followingIdStr = String(following_id)
        const myIdStr = user?.id ? String(user.id) : null
        const profileIdStr = String(profileUserId)

        // Case 1: The current user (me) is the follower
        if (myIdStr === followerIdStr) {
          setFollowingIds(prev => {
            const newSet = new Set(prev)
            if (followed) newSet.add(followingIdStr)
            else newSet.delete(followingIdStr)
            return newSet
          })

          if (isOwnProfile) {
            setUserProfile(prev => {
              if (!prev) return prev
              // To avoid double counting if the API already updated it
              // we could fetch, but for now let's just use the event
              // since it's the source of truth for the whole system
              return {
                ...prev,
                following_count: followed
                  ? (prev.following_count || 0) + 1
                  : Math.max(0, (prev.following_count || 0) - 1)
              }
            })
          }
        }

        // Case 2: The profile being viewed is the one being followed/unfollowed
        if (profileIdStr === followingIdStr) {
          setUserProfile(prev => {
            if (!prev) return prev
            return {
              ...prev,
              is_following: myIdStr === followerIdStr ? followed : prev.is_following,
              followers_count: followed
                ? (prev.followers_count || 0) + 1
                : Math.max(0, (prev.followers_count || 0) - 1)
            }
          })
        }

        // Case 3: The profile being viewed is the follower (and it's not me)
        if (profileIdStr === followerIdStr && profileIdStr !== myIdStr) {
          setUserProfile(prev => {
            if (!prev) return prev
            return {
              ...prev,
              following_count: followed
                ? (prev.following_count || 0) + 1
                : Math.max(0, (prev.following_count || 0) - 1)
            }
          })
        }
      }
    }

    window.addEventListener('social-update', handleSocialUpdate)
    return () => window.removeEventListener('social-update', handleSocialUpdate)
  }, [profileUserId, user?.id, isOwnProfile])

  React.useEffect(() => {
    if (!profileUserId) return

    const loadData = async () => {
      const profileData = await fetchUserProfile()
      await fetchUserPosts(profileData)
      fetchUserPodcasts()
      fetchUserFriends()
    }
    loadData()
  }, [profileUserId])

  React.useEffect(() => {
    setPosts((prev) =>
      prev.filter(
        (p) =>
          !deletedPostIds.has(String(p.id)) &&
          !hiddenPostIds.has(String(p.id))
      )
    )
  }, [deletedPostsVersion, hiddenPostsVersion])

  const clearSharedActionHoverLeaveTimer = () => {
    if (sharedActionHoverLeaveTimerRef.current) {
      clearTimeout(sharedActionHoverLeaveTimerRef.current)
      sharedActionHoverLeaveTimerRef.current = null
    }
  }

  const handleSharedRowStatsEnter = async (podcast, kind) => {
    clearSharedActionHoverLeaveTimer()
    const rowKey = String(podcast.viewId || podcast.id)

    if (
      sharedActionHover.rowKey === rowKey &&
      sharedActionHover.kind === kind &&
      sharedActionHover.items.length > 0
    ) {
      return
    }

    setSharedActionHover({ rowKey, kind, items: [], loading: true })

    try {
      const canonicalId =
        podcast.type === 'shared' ? podcast.share_id : podcast.post_id || podcast.id

      if (!canonicalId) {
        setSharedActionHover((prev) => ({ ...prev, loading: false }))
        return
      }

      let endpoint = ''
      if (kind === 'likes') {
        endpoint = `/social/posts/${canonicalId}/likers/`
        if (podcast.type === 'shared') {
          endpoint = `/social/shares/${canonicalId}/likers/`
        }
      } else if (kind === 'comments') {
        endpoint = `/social/posts/${canonicalId}/commenters/`
        if (podcast.type === 'shared') {
          endpoint = `/social/shares/${canonicalId}/commenters/`
        }
      } else if (kind === 'shares') {
        endpoint = `/social/posts/${canonicalId}/sharers/`
        if (podcast.type === 'shared') {
          endpoint = `/social/shares/${canonicalId}/sharers/`
        }
      }

      if (!endpoint) {
        setSharedActionHover((prev) => ({ ...prev, loading: false }))
        return
      }

      const data = await apiRequest(endpoint)
      if (data && data.success) {
        let items = []
        if (kind === 'likes') items = data.data?.likers || []
        if (kind === 'comments') items = data.data?.commenters || []
        if (kind === 'shares') items = data.data?.sharers || []

        setSharedActionHover({ rowKey, kind, items, loading: false })
      } else {
        setSharedActionHover((prev) => ({ ...prev, loading: false }))
      }
    } catch (err) {
      console.error(err)
      setSharedActionHover((prev) => ({ ...prev, loading: false }))
    }
  }

  const handleSharedRowStatsLeave = () => {
    clearSharedActionHoverLeaveTimer()
    sharedActionHoverLeaveTimerRef.current = setTimeout(() => {
      setSharedActionHover((prev) =>
        prev.rowKey !== null
          ? { rowKey: null, kind: null, items: [], loading: false }
          : prev
      )
    }, 140)
  }

  const handleSharedRowStatsPopupEnter = () => {
    clearSharedActionHoverLeaveTimer()
  }

  const sharedHoverEmptyLabel = (kind) => {
    if (kind === 'likes') return t('feed.noLikes')
    if (kind === 'comments') return t('feed.noComments')
    return t('feed.noShares')
  }

  const hoverUserLabel = (u) => {
    if (u.display_name && u.username) {
      return u.display_name
    }
    return u.display_name || u.username || t('feed.anonymous')
  }

  const POST_SYNC_EVENT = 'post-sync-updated'

  const dispatchPostSync = (payload) => {
    window.dispatchEvent(new CustomEvent(POST_SYNC_EVENT, { detail: payload }))
  }

  React.useEffect(() => {
    const handlePostSync = (event) => {
      const d = event.detail || {}
      if (!d.postId) return

      const oldSync = JSON.parse(
        localStorage.getItem(`post-sync-${d.postId}`) || '{}'
      )

      const nextSync = { ...oldSync }

      if (typeof d.liked === 'boolean') nextSync.liked = d.liked
      if (typeof d.likeCount === 'number') nextSync.likeCount = d.likeCount
      if (typeof d.saved === 'boolean') nextSync.saved = d.saved
      if (typeof d.saveCount === 'number') nextSync.saveCount = d.saveCount
      if (typeof d.commentCount === 'number') nextSync.commentCount = d.commentCount
      if (typeof d.shareCount === 'number') nextSync.shareCount = d.shareCount

      localStorage.setItem(`post-sync-${d.postId}`, JSON.stringify(nextSync))

      const mergePostFields = (p) => ({
        ...p,
        liked: typeof d.liked === 'boolean' ? d.liked : p.liked,
        likes: typeof d.likeCount === 'number' ? d.likeCount : p.likes,
        saved: typeof d.saved === 'boolean' ? d.saved : p.saved,
        saveCount: typeof d.saveCount === 'number' ? d.saveCount : p.saveCount,
        comments: typeof d.commentCount === 'number' ? d.commentCount : p.comments,
        shares: typeof d.shareCount === 'number' ? d.shareCount : p.shares,
        title: typeof d.title === 'string' ? d.title : p.title,
        description: typeof d.description === 'string' ? d.description : p.description,
      })

      const textUpdate =
        typeof d.title === 'string' || typeof d.description === 'string'

      setPosts((prev) =>
        prev.map((p) => {
          if (String(p.id) === String(d.postId)) return mergePostFields(p)

          if (p.type === 'shared') {
            if (p.post_id != null && String(p.post_id) === String(d.postId)) {
              return {
                ...p,
                saved: typeof d.saved === 'boolean' ? d.saved : p.saved,
                saveCount: typeof d.saveCount === 'number' ? d.saveCount : p.saveCount,
                ...(textUpdate ? {
                  title: typeof d.title === 'string' ? d.title : p.title,
                  description: typeof d.description === 'string' ? d.description : p.description,
                } : {}),
              }
            }
            return p
          }

          if (p.post_id != null && String(p.post_id) === String(d.postId)) {
            return mergePostFields(p)
          }

          return p
        })
      )

      setPostStates((prev) => {
        const next = { ...prev }
        next[d.postId] = {
          ...next[d.postId],
          ...(typeof d.liked === 'boolean' ? { liked: d.liked } : {}),
          ...(typeof d.likeCount === 'number' ? { likeCount: d.likeCount } : {}),
          ...(typeof d.saved === 'boolean' ? { saved: d.saved } : {}),
          ...(typeof d.saveCount === 'number' ? { saveCount: d.saveCount } : {}),
          ...(typeof d.commentCount === 'number'
            ? { commentCount: d.commentCount }
            : {}),
          ...(typeof d.shareCount === 'number' ? { shareCount: d.shareCount } : {}),
        }

        // Also update any shared posts that embed this original post
        Object.keys(next).forEach((key) => {
          if (key.startsWith('share_') && key.endsWith(`_${d.postId}`)) {
            next[key] = {
              ...next[key],
              ...(typeof d.saved === 'boolean' ? { saved: d.saved } : {}),
              ...(typeof d.saveCount === 'number' ? { saveCount: d.saveCount } : {}),
            }
          }
        })

        return next
      })
    }

    window.addEventListener(POST_SYNC_EVENT, handlePostSync)
    return () => window.removeEventListener(POST_SYNC_EVENT, handlePostSync)
  }, [])

  React.useEffect(() => {
    if (!openMenuPostId) return

    const close = () => setOpenMenuPostId(null)

    const isInsideMenu = (target) => {
      if (!target || typeof target.closest !== 'function') return false
      return Boolean(target.closest('[data-profile-share-menu]'))
    }

    const onPointerDown = (e) => {
      if (!isInsideMenu(e.target)) close()
    }

    const onScroll = () => close()
    const onWheel = () => close()
    const onTouchMove = () => close()

    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('scroll', onScroll, true)
    document.addEventListener('wheel', onWheel, { capture: true, passive: true })
    document.addEventListener('touchmove', onTouchMove, {
      capture: true,
      passive: true,
    })

    const main = document.querySelector('main')
    main?.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('wheel', onWheel, true)
      document.removeEventListener('touchmove', onTouchMove, true)
      main?.removeEventListener('scroll', onScroll)
    }
  }, [openMenuPostId])

  const fetchUserProfile = async () => {
    try {
      const data = await apiRequest(`/users/${profileUserId}/profile/`)

      let profileData = data.data || {}
      // Check if profile is not accessible
      if (data.is_accessible === false) {
        let errorType = null
        if (profileData.profile_visibility === 'private') {
          errorType = 'private'
        } else if (profileData.profile_visibility === 'followers_only') {
          errorType = 'followers_only'
        }
        setProfileAccessErrorType(errorType)
        setUserProfile(profileData)
      } else {
        setProfileAccessErrorType(null)
        setUserProfile(profileData)
      }
      return profileData
    } catch (err) {
      console.error(t('personal.fetchProfileFailed'), err)
      setUserProfile(null)
      setProfileAccessErrorType(null)
      return null
    }
  }

  const fetchUserPosts = async (passedProfile = null) => {
    try {
      const effectiveProfile = passedProfile || userProfile
      const data = await apiRequest(`/content/users/${profileUserId}/posts/?limit=100`)
      const posts = data.data?.posts || []

      const localCommentCountOverrides = JSON.parse(
        localStorage.getItem('personalPageCommentCountOverrides') || '{}'
      )
      const profileHiddenPosts = JSON.parse(
        localStorage.getItem('profileHiddenPosts') || '[]'
      )

      const mappedPosts = posts.map((post) => {
        const shareCount = post.share_count || 0
        const saveCount = post.save_count || 0

        const cachedSync = JSON.parse(
          localStorage.getItem(`post-sync-${post.id}`) || 'null'
        )
        const originalCachedSync = post.post_id
          ? JSON.parse(localStorage.getItem(`post-sync-${post.post_id}`) || 'null')
          : null

        const syncState =
          post.type === 'shared'
            ? cachedSync || {}
            : cachedSync || originalCachedSync || {}

        const isLiked = syncState.liked ?? (post.is_liked || false)
        const finalLikeCount = syncState.likeCount ?? (post.like_count || 0)
        const isSaved = syncState.saved ?? (post.is_saved || false)

        const hasLocalCommentOverride = post.id in localCommentCountOverrides
        const commentCount = hasLocalCommentOverride
          ? localCommentCountOverrides[post.id]
          : post.comment_count || 0

        return {
          ...post,
          id: post.id,
          viewId: post.id,
          type: post.type || 'original',
          post_id: post.post_id || post.id,
          share_id: post.share_id || null,
          title: post.title,
          description: post.description,

          author: {
            id: post.author_id || post.user?.id || '',
            username: post.author_username || post.author || post.user?.username || '',
            name: post.author || post.author_username || post.user?.profile?.display_name || '',
            avatar_url: post.author_avatar || post.user?.profile?.avatar_url || '',
          },
          authorUsername: post.author_username || post.author || '',
          authorId: post.author_id || post.user?.id || '',
          authorInitials: getInitials({
            username: post.author_username || post.author || '',
            name: post.author || post.author_username || '',
          }),
          author_avatar: post.author_avatar || post.user?.profile?.avatar_url || '',

          audioUrl: post.audio_url || '',
          audioId: post.audio_id || '',
          durationSeconds: post.duration_seconds || 0,
          cover: post.thumbnail_url,
          thumbnail_url: post.thumbnail_url,

          tags: (post.tags || post.post_tags || [])
            .map((tag) => {
              if (tag == null) return ''
              if (typeof tag === 'string') {
                return tag.startsWith('#') ? tag : `#${tag}`
              }
              const n = tag.name ?? tag.slug ?? tag.tag_name ?? ''
              return n ? `#${n}` : ''
            })
            .filter(Boolean),
          tagIds: (post.tags || post.post_tags || [])
            .map((tag) => (tag && typeof tag === 'object' ? tag.id : null))
            .filter(Boolean),

          aiGenerated: false,
          timeAgo: post.shared_at
            ? formatTimeAgo(post.shared_at, t)
            : (post.timeAgo || formatTimeAgo(post.created_at, t)),
          sharedTimeAgo: post.shared_at
            ? formatTimeAgo(post.shared_at, t)
            : (post.timeAgo || formatTimeAgo(post.created_at, t)),
          postTimeAgo: post.created_at
            ? formatTimeAgo(post.created_at, t)
            : (post.timeAgo || ''),

          listens: t('feed.listens', { count: post.listen_count || 0 }),
          likes: finalLikeCount,
          comments: commentCount,
          shares: shareCount,
          saveCount,
          liked: isLiked,
          saved: isSaved,

          sharedBy: post.type === 'shared' ? {
            id: profileUserId,
            username: effectiveProfile?.user?.username || effectiveProfile?.username || '',
            display_name: effectiveProfile?.display_name || effectiveProfile?.full_name || '',
            avatar_url: effectiveProfile?.avatar_url || effectiveProfile?.avatar || effectiveProfile?.profile_image || '',
          } : null,
          share_caption: post.share_caption || '',
        }
      })

      const newPostStates = {}

      mappedPosts.forEach((post) => {
        newPostStates[post.id] = {
          liked: post.liked,
          likeCount: post.likes,
          saved: post.saved,
          saveCount: post.saveCount,
          commentCount: post.comments,
          shareCount: post.shares,
        }
      })

      setPostStates(newPostStates)

      const filteredPosts = mappedPosts.filter(
        (p) =>
          !deletedPostIds.has(String(p.id)) &&
          !hiddenPostIds.has(String(p.id)) &&
          !profileHiddenPosts.includes(p.id)
      )

      setPosts(filteredPosts)
    } catch (err) {
      console.error(t('personal.fetchPostsFailed'), err)
      setPosts([])
    }
  }

  const fetchUserPostsRef = React.useRef(fetchUserPosts)
  fetchUserPostsRef.current = fetchUserPosts

  React.useEffect(() => {
    if (!user?.id) return

    const onPersonalShare = () => {
      void fetchUserPostsRef.current?.()
    }

    window.addEventListener(EDUCAST_PERSONAL_SHARE_SUCCESS, onPersonalShare)
    return () =>
      window.removeEventListener(EDUCAST_PERSONAL_SHARE_SUCCESS, onPersonalShare)
  }, [user?.id])

  // Đồng bộ liên trang khi 1 bài bị xoá/ẩn ở nơi khác:
  // loại bỏ cả dòng bài gốc lẫn các dòng share dẫn về bài gốc đó.
  React.useEffect(() => {
    const handleRemoved = (event) => {
      const removedId = event.detail?.postId
      if (!removedId) return
      setPosts((prev) => prev.filter((p) => !matchesRemovedPost(p, removedId)))
      setPodcasts((prev) => prev.filter((p) => !matchesRemovedPost(p, removedId)))
    }
    window.addEventListener(POST_REMOVED_EVENT, handleRemoved)
    return () => window.removeEventListener(POST_REMOVED_EVENT, handleRemoved)
  }, [])

  const fetchUserPodcasts = async () => {
    try {
      const data = await apiRequest(`/content/drafts/my/?limit=100`)
      setPodcasts(data.data?.results || data.data?.drafts || [])
    } catch (err) {
      console.error(t('personal.fetchPodcastsFailed'), err)
      setPodcasts([])
    }
  }

  const fetchUserFriends = async () => {
    try {
      const data = await apiRequest(`/social/friends/?user_id=${profileUserId}`)

      const following =
        data.data?.following ||
        data.data?.friends ||
        data.data?.results ||
        []

      setFriends(following)
    } catch (err) {
      console.error(t('personal.fetchFriendsFailed'), err)
      setFriends([])
    }
  }

  const fetchFollowing = async () => {
    if (!user?.id) return
    try {
      const data = await apiRequest('/social/follow-list/')
      const followingList = data.data?.following || []
      setFollowingIds(new Set(followingList.map(item => String(item.id))))
    } catch (err) {
      console.error('Fetch following error:', err)
    }
  }

  React.useEffect(() => {
    fetchFollowing()
  }, [user?.id])

  const handleToggleFollowFriend = async (authorId) => {
    if (!user?.id) return
    setLoadingFollow(prev => ({ ...prev, [authorId]: true }))
    try {
      const response = await apiRequest(`/social/users/${authorId}/follow/`, {
        method: 'POST',
        body: JSON.stringify({ user_id: user.id }),
      })

      // Thêm delay 500ms để tạo cảm giác chân thực
      await new Promise(resolve => setTimeout(resolve, 500))

      // WebSocket event will handle state updates for follows and counts
    } catch (err) {
      console.error('Toggle follow friend error:', err)
    } finally {
      setLoadingFollow(prev => ({ ...prev, [authorId]: false }))
    }
  }

  const handleOpenOriginalPost = async (post) => {
    const targetId = post.post_id || post.id
    console.log('🔍 handleOpenOriginalPost targetId:', targetId)
    if (!targetId) return

    // Nếu là ID bài share (share_xxx_yyy), chúng ta cần bóc tách để lấy ID bài gốc cho API chi tiết
    let postIdForApi = targetId
    let shareId = null

    if (String(targetId).startsWith('share_')) {
      const parts = String(targetId).split('_')
      if (parts.length >= 3) {
        shareId = parts[1]
        postIdForApi = parts[parts.length - 1]
        console.log('📦 Extracted from share ID:', { shareId, postIdForApi })
      }
    }

    try {
      console.log('🚀 Fetching post details for:', postIdForApi)
      const data = await apiRequest(`/content/posts/${postIdForApi}/`)
      console.log('✅ Post data received:', data)

      if (data && data.data) {
        const origPost = data.data

        const mappedPost = {
          ...origPost,
          id: targetId,
          title: origPost.title,
          description: origPost.description,
          author: origPost.author || '',
          authorUsername: origPost.author_username || '',
          authorId: origPost.author_id || '',
          audioUrl: origPost.audio_url || '',
          durationSeconds: origPost.duration_seconds || 0,
          cover: origPost.thumbnail_url,
          thumbnail_url: origPost.thumbnail_url,
          tags: (origPost.tags || origPost.post_tags || [])
            .map((tag) => {
              if (tag == null) return ''
              if (typeof tag === 'string') {
                return tag.startsWith('#') ? tag : `#${tag}`
              }
              const n = tag.name ?? tag.slug ?? tag.tag_name ?? ''
              return n ? `#${n}` : ''
            })
            .filter(Boolean),
          aiGenerated: false,
          timeAgo: formatTimeAgo(origPost.created_at, t),
          listens: origPost.listen_count || 0,
          likes: origPost.like_count || 0,
          comments: origPost.comment_count || 0,
          shares: origPost.share_count || 0,
          saveCount: origPost.save_count || 0,
          liked: origPost.is_liked || false,
          saved: origPost.is_saved || false,
        }

        setDisableCommentAutoScroll(true)
        setSelectedPost(mappedPost)
        setShowCommentModal(true)
      }
    } catch (err) {
      console.error(t('personal.fetchOriginalPostFailed'), err)
      toast.error(t('personal.fetchOriginalPostFailed'))
    }
  }

  const handleEditProfile = () => {
    navigate('/settings?tab=profile')
  }

  const handleShareProfile = () => {
    if (!profileUserId) {
      toast.error(t('personal.userFallback'))
      return
    }

    setShowProfileShareModal(true)
  }

  const handleMoreOptions = () => {
    toast.info(t('personal.moreOptions'))
  }

  const handleViewArchived = () => {
    navigate('/archive')
  }

  const handleFollowUser = async () => {
    try {
      const currentUser = getCurrentUser()
      if (!currentUser || !profileUserId) {
        toast.error(t('personal.loginRequired'))
        return
      }
      // Call follow API with correct endpoint: /social/users/{id}/follow/
      const response = await apiRequest(`/social/users/${profileUserId}/follow/`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: currentUser.id,
        }),
      })
      toast.success(t('personal.followedSuccessfully'))
      // Refresh profile after follow
      await fetchUserProfile()
    } catch (err) {
      console.error('Follow user error:', err)
      toast.error(t('personal.followFailed'))
    }
  }

  const handleToggleLike = async (postId) => {
    try {
      const token = getToken()
      const currentUser = getCurrentUser()

      const post = posts.find((p) => p.id === postId)
      if (!post) return

      const apiLikeId =
        post.type === 'shared' ? postId : engagementPostIdProfile(post)

      const res = await fetch(
        `${API_BASE_URL}/social/posts/${apiLikeId}/like/`,
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

      setPostStates((prev) => ({
        ...prev,
        [postId]: {
          ...prev[postId],
          liked: nextLiked,
          likeCount: nextLikeCount,
        },
      }))

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, liked: nextLiked, likes: nextLikeCount }
            : p
        )
      )

      if (post.type === 'shared') {
        const canonicalId = engagementPostIdProfile(post)

        setSelectedPost((prev) => {
          if (!prev) return prev
          const prevCanonical = engagementPostIdProfile(prev)
          if (String(prev.id) === String(post.id) || String(prevCanonical) === String(canonicalId)) {
            return { ...prev, liked: nextLiked, likes: nextLikeCount }
          }
          return prev
        })

        dispatchPostSync({
          postId,
          liked: nextLiked,
          likeCount: nextLikeCount,
        })

        if (canonicalId) {
          dispatchPostSync({
            postId: canonicalId,
            liked: nextLiked,
            likeCount: nextLikeCount,
          })

          window.dispatchEvent(
            new CustomEvent('audio-track-like-updated', {
              detail: {
                postId: canonicalId,
                liked: nextLiked,
                likeCount: nextLikeCount,
              },
            })
          )
        }
      } else {
        dispatchPostSync({
          postId,
          liked: nextLiked,
          likeCount: nextLikeCount,
        })

        window.dispatchEvent(
          new CustomEvent('audio-track-like-updated', {
            detail: {
              postId,
              liked: nextLiked,
              likeCount: nextLikeCount,
            },
          })
        )
      }

    } catch (err) {
      console.error(t('personal.likeError'), err)
      toast.error(t('personal.likeError'))
    }
  }

  const handleToggleSave = async (postId) => {
    try {
      const currentState = postStates[postId]
      const isSaved = currentState?.saved || false

      const post = posts.find((p) => p.id === postId)
      if (!post) return

      const apiSaveId =
        post.type === 'shared' ? postId : engagementPostIdProfile(post)

      if (isSaved) {
        const token = getToken()
        const currentUser = getCurrentUser()

        const res = await fetch(
          `${API_BASE_URL}/social/posts/${apiSaveId}/save/`,
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

        setPostStates((prev) => ({
          ...prev,
          [postId]: {
            ...prev[postId],
            saved: false,
            saveCount: nextSaveCount,
          },
        }))

        removeSavedPost(apiSaveId)

        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, saved: false, saveCount: nextSaveCount }
              : p
          )
        )

        dispatchPostSync({
          postId,
          saved: false,
          saveCount: nextSaveCount,
        })
      } else {
        setSelectedPost(posts.find((p) => p.id === postId))
        setShowCollectionModal(true)
      }
    } catch (err) {
      console.error(t('personal.saveError'), err)
      toast.error(t('personal.saveError'))
    }
  }

  const handleCollectionModalSave = (_collectionId, apiData) => {
    const post = selectedPost
    if (!post) return

    const rowId = post.id
    const apiId =
      post.type === 'shared' ? post.id : engagementPostIdProfile(post)

    // Dùng save_count thực từ API, tránh cộng dồn sai khi lưu lại sau khi hủy
    const newSaveCount = typeof apiData?.save_count === 'number'
      ? apiData.save_count
      : (postStates[rowId]?.saveCount || 0) + 1

    setPostStates((prev) => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        saved: true,
        saveCount: newSaveCount,
      },
    }))

    addSavedPost(apiId)

    setPosts((prev) =>
      prev.map((p) =>
        p.id === rowId ? { ...p, saved: true, saveCount: newSaveCount } : p
      )
    )

    // Sự kiện sync đã được SaveCollectionModal dispatch. Chỉ dispatch thêm nếu không có giá trị thực
    if (typeof apiData?.save_count !== 'number') {
      dispatchPostSync({
        postId: rowId,
        saved: true,
        saveCount: newSaveCount,
      })
    }

    setShowCollectionModal(false)
  }

  const handleOpenCommentModal = (post) => {
    setDisableCommentAutoScroll(false)
    setSelectedPost(post)
    setShowCommentModal(true)
  }

  const handleOpenShareModal = (post) => {
    setSelectedPost(post)
    setShowShareModal(true)
  }

  const handleCommentCountChange = (postId, newCount) => {
    const localCommentCountOverrides = JSON.parse(
      localStorage.getItem('personalPageCommentCountOverrides') || '{}'
    )

    localCommentCountOverrides[postId] = newCount

    localStorage.setItem(
      'personalPageCommentCountOverrides',
      JSON.stringify(localCommentCountOverrides)
    )

    setPostStates((prev) => ({
      ...prev,
      [postId]: {
        ...prev[postId],
        commentCount: newCount,
      },
    }))

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments: newCount } : p
      )
    )
  }

  const handleShareSuccess = (sourcePost, data) => {
    const canonicalId = engagementPostIdProfile(sourcePost)

    const newShareCount = Number(data?.share_count || 0)
    const newLikeCount = Number(data?.like_count)
    const newCommentCount = Number(data?.comment_count)
    const newSaveCount = Number(data?.save_count)

    setPostStates((prev) => ({
      ...prev,
      [sourcePost.id]: {
        ...prev[sourcePost.id],
        shareCount: newShareCount,
        ...(typeof newLikeCount === 'number' && !Number.isNaN(newLikeCount)
          ? { likeCount: newLikeCount }
          : {}),
        ...(typeof newCommentCount === 'number' && !Number.isNaN(newCommentCount)
          ? { commentCount: newCommentCount }
          : {}),
        ...(typeof newSaveCount === 'number' && !Number.isNaN(newSaveCount)
          ? { saveCount: newSaveCount }
          : {}),
      },
    }))

    setPosts((prev) =>
      prev.map((p) => {
        if (String(p.id) !== String(sourcePost.id)) return p

        return {
          ...p,
          shares: newShareCount,
          ...(typeof newLikeCount === 'number' && !Number.isNaN(newLikeCount)
            ? { likes: newLikeCount }
            : {}),
          ...(typeof newCommentCount === 'number' && !Number.isNaN(newCommentCount)
            ? { comments: newCommentCount }
            : {}),
          ...(typeof newSaveCount === 'number' && !Number.isNaN(newSaveCount)
            ? { saveCount: newSaveCount }
            : {}),
        }
      })
    )

    dispatchPostSync({
      postId: canonicalId,
      ...(typeof newShareCount === 'number' && !Number.isNaN(newShareCount)
        ? { shareCount: newShareCount }
        : {}),
      ...(typeof newLikeCount === 'number' && !Number.isNaN(newLikeCount)
        ? { likeCount: newLikeCount }
        : {}),
      ...(typeof newCommentCount === 'number' && !Number.isNaN(newCommentCount)
        ? { commentCount: newCommentCount }
        : {}),
      ...(typeof newSaveCount === 'number' && !Number.isNaN(newSaveCount)
        ? { saveCount: newSaveCount }
        : {}),
    })

    void fetchUserPostsRef.current?.()
    navigate('/feed')
  }

  const handleRequestRepublish = async (postId) => {
    try {
      const token = getToken();
      if (!token) return;

      const res = await fetch(`${API_BASE_URL}/content/posts/${postId}/request-republish/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t('personal.requestRepublishFailed'))
      }

      toast.success(t('personal.requestRepublishSuccess'));

      // Update local state to reflect status change to processing
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, status: 'processing' } : p
      ));

    } catch (err) {
      console.error(t('personal.requestRepublishErrorLog'), err)
      toast.error(err.message || t('personal.requestRepublishFailed'))
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      const post = posts.find((p) => p.id === postId)
      if (!post) return

      pauseTrackIfDeleted(postId)

      const token = getToken()
      const currentUser = getCurrentUser()

      if (post.type === 'shared') {
        const res = await fetch(
          `${API_BASE_URL}/social/posts/${post.post_id}/unshare/`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              user_id: currentUser?.id,
            }),
          }
        )

        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.message || `HTTP ${res.status}`)
        }
      } else {
        const hiddenPosts = JSON.parse(
          localStorage.getItem('profileHiddenPosts') || '[]'
        )

        if (!hiddenPosts.includes(postId)) {
          hiddenPosts.push(postId)
          localStorage.setItem('profileHiddenPosts', JSON.stringify(hiddenPosts))
        }
      }

      setPosts((prev) => prev.filter((p) => p.id !== postId))
      deletePost(postId)
    } catch (err) {
      console.error(t('personal.deleteError', { message: err.message }), err)
      toast.error(t('personal.deleteError', { message: err.message }))
    }
  }

  const handleHidePost = (postId) => {
    pauseTrackIfDeleted(postId)
    setPosts((prev) => prev.filter((p) => p.id !== postId))
    hidePost(postId)
    toast.success(t('personal.hideSuccess'))
  }

  const isFollowing = followingIds.has(String(profileUserId)) || Boolean(userProfile?.is_following);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.coverPhoto}>
          <img
            src={userProfile?.cover_url || "https://picsum.photos/seed/cover/1200/400"}
            alt={t('personal.coverAlt')}
            className={styles.coverImage}
          />

          {isOwnProfile && (
            <button className={styles.editCoverBtn}>
              <ImageIcon size={16} />
              <span className={styles.editCoverText}>{t('personal.editCover')}</span>
            </button>
          )}
        </div>

        <div className={styles.profileSection}>
          <div className={styles.profileRow}>
            <div className={styles.avatarWrapper}>
              <div className={styles.avatar}>
                {profileAvatar && !failedAvatarUrls.has('profile') ? (
                  <img
                    src={profileAvatar}
                    alt={t('personal.avatarAlt')}
                    className={styles.avatarImage}
                    onError={() => {
                      setFailedAvatarUrls((prev) => new Set([...prev, 'profile']))
                    }}
                  />
                ) : (
                  <div className={styles.avatarInitialsLarge}>
                    {getInitials({
                      username: userProfile?.username,
                      display_name: userProfile?.display_name,
                      name: userProfile?.full_name || userProfile?.name,
                    } || t('personal.userFallback'))}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.profileInfo}>
              <h1 className={styles.profileName}>

                {userProfile?.display_name ||
                  userProfile?.full_name ||
                  userProfile?.name ||
                  userProfile?.username ||
                  t('personal.userFallback')}              </h1>
              <p className={styles.profileStats}>

                <span>{t('personal.podcastCount', { count: userProfile?.podcast_count || 0 })}</span>
                <span
                  className={styles.clickableStat}
                  onClick={() => setFollowModal({ isOpen: true, type: 'followers' })}
                >
                  {t('personal.followersCount', { count: userProfile?.followers_count || 0 })}
                </span>
                <span
                  className={styles.clickableStat}
                  onClick={() => setFollowModal({ isOpen: true, type: 'following' })}
                >
                  {t('personal.followingCount', { count: userProfile?.following_count || 0 })}
                </span>              </p>
            </div>

            <div className={styles.actions}>
              {isOwnProfile && (
                <button className={styles.editBtn} onClick={handleEditProfile}>
                  <Edit3 size={16} />
                  {t('personal.edit')}
                </button>
              )}

              {!isOwnProfile && (
                <button
                  className={`${styles.followBtnMain} ${userProfile?.is_following ? styles.following : ''}`}
                  onClick={() => handleToggleFollowFriend(profileUserId)}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck size={16} />
                      {t('personal.following')}
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      {t('personal.followUser')}
                    </>
                  )}
                </button>
              )}

              <button className={styles.shareBtn} onClick={handleShareProfile}>
                <Share2 size={16} />
                {t('personal.share')}
              </button>

              {isOwnProfile && (
                <button className={styles.archiveBtn} onClick={handleViewArchived}>
                  <Archive size={16} />
                  {t('personal.archived')}
                </button>
              )}
            </div>
          </div>

          <p className={styles.bio}>
            {userProfile?.bio || t('personal.defaultBio')}
          </p>
        </div>

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

      {/* Profile Access Error Message */}
      {profileAccessErrorType && (
        <div className={styles.accessErrorContainer}>
          <div className={styles.accessErrorCard}>
            <EyeOff size={48} className={styles.accessErrorIcon} />
            <h2 className={styles.accessErrorTitle}>
              {profileAccessErrorType === 'private'
                ? t('personal.profilePrivate')
                : t('personal.profileFollowersOnly')}
            </h2>
            <p className={styles.accessErrorDescription}>
              {profileAccessErrorType === 'private'
                ? t('personal.profilePrivateDescription')
                : t('personal.profileFollowersOnlyDescription')}
            </p>
            <div className={styles.accessErrorActions}>
              {!isOwnProfile && (
                <button className={styles.accessFollowBtn} onClick={handleFollowUser}>
                  {t('personal.followUser')}
                </button>
              )}
              <button className={styles.backBtn} onClick={() => navigate(-1)}>
                {t('personal.goBack')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content - Only show if profile is accessible */}
      {!profileAccessErrorType && (
        <>
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
                  <div className={styles.tabContent}>
                    <div className={styles.postsLayout}>
                      {posts.length > 0 ? (
                        posts.map((post) => {
                          const isOriginalPost = post.type !== 'shared'

                          // If it's own post, display like Feed (just PodcastCard without share frame)
                          if (isOriginalPost) {
                            return (
                              <div key={post.viewId || post.id} className={styles.postCard} data-post-id={post.id}>
                                <PodcastCard
                                  podcast={post}
                                  queue={posts}
                                  onDelete={handleDeletePost}
                                  onHide={handleHidePost}
                                  hideMenu={false}
                                  hideActions={false}
                                  onEditPost={
                                    isOwnProfile ? () => setEditPostModalPost(post) : null
                                  }
                                  rejectionBanner={
                                    post.status === 'failed' ? (
                                      <div className={styles.rejectedBanner}>
                                        <div className={styles.rejectedText}>
                                          <AlertCircle size={18} />
                                          <span>
                                            {post.learning_field === '2'
                                              ? t('personal.postRejectedSecondTime')
                                              : t('personal.postRejected')}
                                          </span>
                                        </div>
                                        <div className={styles.rejectedActions}>
                                          {post.learning_field !== '2' && (
                                            <button
                                              className={styles.republishRequestBtn}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleRequestRepublish(post.id);
                                              }}
                                            >
                                              <RotateCcw size={16} />
                                              <span>{t('personal.requestRepublish')}</span>
                                            </button>
                                          )}
                                          <button
                                            className={styles.rejectedDeleteBtn}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleDeletePost(post.id)
                                            }}
                                          >
                                            <Trash2 size={16} />
                                            <span>{t('personal.deletePost')}</span>
                                          </button>
                                        </div>
                                      </div>
                                    ) : post.status === 'processing' ? (
                                      <div className={styles.reviewingBanner}>
                                        <div className={styles.reviewingText}>
                                          <Clock size={18} />
                                          <span>{t('personal.postReviewing', { defaultValue: 'Bài viết đang được người kiểm duyệt xem xét' })}</span>
                                        </div>
                                      </div>
                                    ) : null
                                  }
                                />
                              </div>
                            )
                          }

                          // If it's a shared post from someone else, display with share frame
                          const sharedBy = post.sharedBy || {}
                          const rowKey = String(post.viewId || post.id)
                          const avatarKey = `share-${post.viewId || post.id}`
                          const shareAuthorName = sharedBy.display_name || sharedBy.name || sharedBy.username || t('feed.anonymous')
                          const shareAuthorInitials = getInitials(sharedBy || shareAuthorName)

                          const sharedByUserId = sharedBy.id ?? sharedBy.user_id ?? sharedBy.pk ?? sharedBy.userId

                          const openSharedAuthorProfile = (event) => {
                            event?.stopPropagation?.()
                            if (sharedByUserId == null || sharedByUserId === '') return
                            navigate(`/profile/${sharedByUserId}`)
                          }

                          return (
                            <div key={post.viewId || post.id} className={styles.postShareContainer} data-post-id={post.id}>
                              <div className={styles.postShareWrapper}>
                                <div className={styles.postShareInfo}>
                                  <div
                                    className={`${styles.postShareAuthor} ${sharedByUserId ? styles.postShareAuthorClickable : ''}`}
                                    role={sharedByUserId ? 'button' : undefined}
                                    tabIndex={sharedByUserId ? 0 : undefined}
                                    onClick={openSharedAuthorProfile}
                                    onKeyDown={(event) => {
                                      if ((event.key === 'Enter' || event.key === ' ') && sharedByUserId) {
                                        event.preventDefault()
                                        openSharedAuthorProfile(event)
                                      }
                                    }}
                                  >
                                    {sharedBy.avatar_url && !failedAvatarUrls.has(avatarKey) ? (
                                      <div className={styles.postShareAvatarWrapper}>
                                        <img
                                          src={sharedBy.avatar_url}
                                          alt={shareAuthorName}
                                          className={styles.postShareAvatar}
                                          onError={() => {
                                            setFailedAvatarUrls((prev) => new Set([...prev, avatarKey]))
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <div className={styles.postShareAvatarWrapper}>
                                        <div className={styles.postShareAvatarInitials}>
                                          {shareAuthorInitials}
                                        </div>
                                      </div>
                                    )}

                                    <div className={styles.postShareAuthorInfo}>
                                      <div className={styles.postShareAuthorMetaRow}>
                                        <span className={styles.postShareAuthorName}>
                                          {shareAuthorName}
                                        </span>
                                        <span className={styles.postShareMetaDot}>•</span>
                                        <span className={styles.postShareMetaText}>
                                          {post.sharedTimeAgo || post.timeAgo || formatTimeAgo(post.shared_at || post.created_at, t)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className={styles.shareMenuWrap} data-profile-share-menu>
                                    <button
                                      className={styles.postShareMenuBtn}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setOpenMenuPostId(openMenuPostId === rowKey ? null : rowKey)
                                      }}
                                    >
                                      <MoreHorizontal size={20} />
                                    </button>
                                    {openMenuPostId === rowKey && (
                                      <div className={styles.shareMenuDropdown}>
                                        {isOwnProfile ? (
                                          <>
                                            <button
                                              className={styles.shareMenuOption}
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                e.preventDefault()
                                                setOpenMenuPostId(null)
                                                setEditShareCaptionPost(post)
                                              }}
                                            >
                                              <Edit size={14} />
                                              <span>{t('personal.edit')}</span>
                                            </button>
                                            <button
                                              className={`${styles.shareMenuOption} ${styles.danger}`}
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                setOpenMenuPostId(null)
                                                handleDeletePost(post.id)
                                              }}
                                            >
                                              <Trash2 size={14} />
                                              <span>{t('common.delete')}</span>
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <button
                                              className={styles.shareMenuOption}
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                setOpenMenuPostId(null)
                                                handleHidePost(post.id)
                                              }}
                                            >
                                              <EyeOff size={14} />
                                              <span>{t('feed.hidePost')}</span>
                                            </button>
                                            <button
                                              className={`${styles.shareMenuOption} ${styles.danger}`}
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                setOpenMenuPostId(null)
                                                setReportPostModalPost(post)
                                              }}
                                            >
                                              <Flag size={14} />
                                              <span>{t('feed.report')}</span>
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {post.share_caption && (
                                  <div className={styles.shareCaption}>
                                    <p>{post.share_caption}</p>
                                  </div>
                                )}

                                <div
                                  className={styles.postShareCard}
                                  onClick={() => handleOpenOriginalPost(post)}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleOpenOriginalPost(post)
                                  }}
                                  title={t('feed.viewOriginalPost')}
                                >
                                  <PodcastCard
                                    podcast={{ ...post, timeAgo: post.postTimeAgo || post.timeAgo }}
                                    queue={posts}
                                    onDelete={handleDeletePost}
                                    onHide={handleHidePost}
                                    hideMenu={true}
                                    hideActions={true}
                                    embedInShare={true}
                                  />
                                </div>

                                <div className={styles.postShareActions}>
                                  <div className={styles.shareStatWrap}>
                                    <button
                                      type="button"
                                      className={`${styles.shareActionBtn} ${postStates[post.id]?.liked ? styles.liked : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleToggleLike(post.id)
                                      }}
                                    >
                                      <Heart size={16} fill={postStates[post.id]?.liked ? 'currentColor' : 'none'} />
                                      <span
                                        onMouseEnter={() => handleSharedRowStatsEnter(post, 'likes')}
                                        onMouseLeave={handleSharedRowStatsLeave}
                                      >
                                        {postStates[post.id]?.likeCount ?? post.likes ?? 0}
                                      </span>
                                    </button>

                                    {sharedActionHover.rowKey === rowKey &&
                                      sharedActionHover.kind === 'likes' && (
                                        <div
                                          className={styles.shareSharerPopup}
                                          onMouseEnter={handleSharedRowStatsPopupEnter}
                                          onMouseLeave={handleSharedRowStatsLeave}
                                        >
                                          {sharedActionHover.loading ? (
                                            <div className={styles.shareSharerEmpty}>
                                              {t('common.loading')}
                                            </div>
                                          ) : sharedActionHover.items.length > 0 ? (
                                            sharedActionHover.items.map((u) => (
                                              <div
                                                key={u.user_id || u.username}
                                                className={styles.shareSharerRow}
                                              >
                                                {hoverUserLabel(u)}
                                              </div>
                                            ))
                                          ) : (
                                            <div className={styles.shareSharerEmpty}>
                                              {sharedHoverEmptyLabel('likes')}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                  </div>

                                  <div className={styles.shareStatWrap}>
                                    <button
                                      type="button"
                                      className={styles.shareActionBtn}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleOpenCommentModal({ ...post, commentModalScope: 'share' })
                                      }}
                                    >
                                      <MessageCircle size={16} />
                                      <span
                                        onMouseEnter={() => handleSharedRowStatsEnter(post, 'comments')}
                                        onMouseLeave={handleSharedRowStatsLeave}
                                      >
                                        {t('personal.comments', { count: postStates[post.id]?.commentCount ?? post.comments ?? 0 })}
                                      </span>
                                    </button>

                                    {sharedActionHover.rowKey === rowKey &&
                                      sharedActionHover.kind === 'comments' && (
                                        <div
                                          className={styles.shareSharerPopup}
                                          onMouseEnter={handleSharedRowStatsPopupEnter}
                                          onMouseLeave={handleSharedRowStatsLeave}
                                        >
                                          {sharedActionHover.loading ? (
                                            <div className={styles.shareSharerEmpty}>
                                              {t('common.loading')}
                                            </div>
                                          ) : sharedActionHover.items.length > 0 ? (
                                            sharedActionHover.items.map((u) => (
                                              <div
                                                key={u.user_id || u.username}
                                                className={styles.shareSharerRow}
                                              >
                                                {hoverUserLabel(u)}
                                              </div>
                                            ))
                                          ) : (
                                            <div className={styles.shareSharerEmpty}>
                                              {sharedHoverEmptyLabel('comments')}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                  </div>

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
                      </div>                </div>
                    <div className={styles.friendsGrid}>
                      {friends.length > 0 ? (
                        friends.map((friend) => (
                          <div key={friend.name || friend.username} className={styles.friendCard}>
                            <div
                              className={styles.friendAvatarWrapper}
                              style={{ cursor: 'pointer' }}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                if (friend.id) {
                                  navigate(`/profile/${friend.id}`)
                                  window.scrollTo(0, 0)
                                }
                              }}
                              onKeyDown={(e) => {
                                if ((e.key === 'Enter' || e.key === ' ') && friend.id) {
                                  e.preventDefault()
                                  navigate(`/profile/${friend.id}`)
                                  window.scrollTo(0, 0)
                                }
                              }}
                            >
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
                            </div>
                            <div>
                              <h4 className={styles.friendName}>{friend.name || friend.display_name || friend.username}</h4>
                              {friend.username ? (
                                <div className={styles.friendUsername}>@{friend.username}</div>
                              ) : null}
                              {String(user?.id) === String(friend.id) ? (
                                <button
                                  className={styles.followBtn}
                                  onClick={() => {
                                    navigate(`/profile/${friend.id}`)
                                    window.scrollTo(0, 0)
                                  }}
                                >
                                  {t('personal.viewProfile')}
                                </button>
                              ) : (
                                <button
                                  className={`${styles.followBtn} ${followingIds.has(String(friend.id)) ? styles.following : ''}`}
                                  onClick={() => handleToggleFollowFriend(friend.id)}
                                  disabled={loadingFollow[friend.id]}
                                >
                                  {loadingFollow[friend.id]
                                    ? '...'
                                    : followingIds.has(String(friend.id))
                                      ? t('buttons.following')
                                      : t('buttons.follow')}
                                </button>
                              )}
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
        </>
      )}

      {showCommentModal && selectedPost && (
        <CommentModal
          podcast={selectedPost}
          liked={postStates[selectedPost.id]?.liked ?? selectedPost.liked ?? false}
          saved={postStates[selectedPost.id]?.saved ?? selectedPost.saved ?? false}
          likeCount={postStates[selectedPost.id]?.likeCount ?? selectedPost.likes ?? 0}
          shareCount={
            postStates[selectedPost.id]?.shareCount ?? selectedPost.shares ?? 0
          }
          saveCount={
            postStates[selectedPost.id]?.saveCount ?? selectedPost.saveCount ?? 0
          }
          commentCount={
            postStates[selectedPost.id]?.commentCount ?? selectedPost.comments ?? 0
          }
          disableAutoScroll={disableCommentAutoScroll}
          onClose={() => {
            setShowCommentModal(false)
            setDisableCommentAutoScroll(true)
          }}
          onCommentCountChange={(newCount) =>
            handleCommentCountChange(selectedPost.id, newCount)
          }
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
          onShareSuccess={(data) => handleShareSuccess(selectedPost, data)}
        />
      )}

      {showProfileShareModal && (
        <ProfileShareModal
          profileUser={userProfile}
          profileUserId={profileUserId}
          onClose={() => setShowProfileShareModal(false)}
          onShareSuccess={() => {
            setShowProfileShareModal(false)
          }}
        />
      )}

      <EditShareCaptionModal
        isOpen={Boolean(editShareCaptionPost)}
        compositeRowId={editShareCaptionPost?.id}
        initialCaption={editShareCaptionPost?.share_caption ?? ''}
        onClose={() => setEditShareCaptionPost(null)}
        onSaved={(caption) => {
          const row = editShareCaptionPost
          if (!row) return

          setPosts((prev) =>
            prev.map((p) =>
              String(p.id) === String(row.id)
                ? { ...p, share_caption: caption }
                : p
            )
          )

          dispatchPostSync({
            postId: row.id,
            shareCaption: caption,
          })
        }}
      />

      <EditPostModal
        isOpen={Boolean(editPostModalPost)}
        postId={editPostModalPost ? engagementPostIdProfile(editPostModalPost) : null}
        onClose={() => setEditPostModalPost(null)}
        onSaved={({ title, description }) => {
          const row = editPostModalPost
          if (!row) return

          const pid = engagementPostIdProfile(row)

          setPosts((prev) =>
            prev.map((p) => {
              const same =
                String(p.id) === String(pid) ||
                (p.post_id != null && String(p.post_id) === String(pid))

              if (!same) return p

              return { ...p, title, description }
            })
          )

          dispatchPostSync({ postId: pid, title, description })
        }}
      />

      <SaveCollectionModal
        isOpen={showCollectionModal}
        onClose={() => setShowCollectionModal(false)}
        postId={
          selectedPost?.type === 'shared'
            ? selectedPost.id
            : engagementPostIdProfile(selectedPost)
        }
        onSave={handleCollectionModalSave}
        triggerRef={saveBookmarkRef}
        isPopup={false}
      />

      <FollowListModal
        isOpen={followModal.isOpen}
        onClose={() => setFollowModal({ ...followModal, isOpen: false })}
        type={followModal.type}
        userId={profileUserId}
        isOwnProfile={isOwnProfile}
        onUpdateStats={fetchUserProfile}
      />

      {reportPostModalPost && (
        <ReportPostModal
          postId={reportPostModalPost.post_id || reportPostModalPost.id}
          postTitle={reportPostModalPost.title}
          authorId={reportPostModalPost.authorId || reportPostModalPost.author?.id}
          authorName={
            typeof reportPostModalPost.author === 'object' &&
              reportPostModalPost.author != null
              ? reportPostModalPost.author.name ||
              reportPostModalPost.author.username ||
              t('feed.anonymous')
              : reportPostModalPost.author || t('feed.anonymous')
          }
          onClose={() => setReportPostModalPost(null)}
        />
      )}
    </div>
  )
}

function formatTimeAgo(dateString, t) {
  if (!dateString) return t('feed.time.justNow')

  const created = new Date(dateString)
  const now = new Date()
  const diffMs = now - created
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return t('feed.time.justNow')
  if (diffMinutes < 60) return t('feed.time.minutesAgo', { count: diffMinutes })
  if (diffHours < 24) return t('feed.time.hoursAgo', { count: diffHours })
  return t('feed.time.daysAgo', { count: diffDays })
}
