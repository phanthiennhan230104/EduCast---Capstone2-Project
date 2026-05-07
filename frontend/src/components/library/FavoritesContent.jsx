import { useMemo, useState, useEffect, useContext, useRef, useCallback } from 'react'
import {
  MapPin,
  BookMarked,
  Headphones,
  Clock3,
  StickyNote,
  ChevronRight,
  LayoutGrid,
  Rows3,
  Pin,
  MessageSquareText,
  CheckCircle2,
  PlayCircle,
  Play,
  Pause,
  Loader,
} from 'lucide-react'
import { toast } from 'react-toastify'
import styles from '../../style/library/FavoritesContent.module.css'
import { getToken } from '../../utils/auth'
import { PodcastContext } from '../contexts/PodcastContext'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import NotesModal from './NotesModal'
import AllPostsModal from './AllPostsModal'
import CommentModal from '../feed/CommentModal'

const COLLECTIONS = [
  { id: 1, name: 'AI cơ bản', count: 6 },
  { id: 2, name: 'Tâm lý học', count: 4 },
  { id: 3, name: 'IELTS', count: 5 },
  { id: 4, name: 'Tài chính cá nhân', count: 3 },
]


function getListenLabel(percent) {
  if (percent >= 100) return 'Đã nghe xong'
  if (percent <= 0) return 'Chưa nghe'
  return `Đã nghe ${percent}%`
}

function formatTime(seconds) {
  const total = Math.floor(Number(seconds || 0))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function SavedCard({ item, viewMode, onToggleSaved, onOpenNotes, onOpenDetail }) {
  const { playTrack, currentTrack, playing, togglePlay, currentTime, duration, formattedCurrentTime, trackProgressMap, seekToPercent, isSeeking } = useAudioPlayer()
  const progressBarRef = useRef(null)

  const handlePlayClick = () => {
    if (!item.audioUrl) {
      alert('Bài này chưa có file audio')
      return
    }

    if (currentTrack?.id === item.id) {
      togglePlay()
      return
    }

    playTrack({
      id: item.id,
      postId: item.id,
      title: item.title,
      author: item.author,
      audioUrl: item.audioUrl,
      durationSeconds: item.durationSeconds,
      thumbnail_url: item.thumbnail_url,
      liked: item.is_liked,
      saved: item.saved,
    })
  }

  const handleProgressBarClick = (e) => {
    if (!item.durationSeconds || item.durationSeconds === 0) return
    
    const barRect = progressBarRef.current?.getBoundingClientRect()
    if (!barRect) return
    
    const clickX = e.clientX - barRect.left
    const percentage = Math.max(0, Math.min(100, (clickX / barRect.width) * 100))
    
    // If this track is currently playing, seek directly
    if (currentTrack?.id === item.id) {
      seekToPercent(percentage)
    } else {
      // Otherwise, play the track and then seek
      playTrack({
        id: item.id,
        title: item.title,
        author: item.author,
        audioUrl: item.audioUrl,
        durationSeconds: item.durationSeconds,
        thumbnail_url: item.thumbnail_url,
      })
      // Seek after a small delay to ensure audio is loaded
      setTimeout(() => seekToPercent(percentage), 100)
    }
  }

  const isCurrentPlaying = currentTrack?.id === item.id && playing

  // Lấy saved progress nếu track đã từng chạy
  const savedProgress = trackProgressMap?.[item.id]
  
  const displayTime = currentTrack?.id === item.id ? currentTime : (savedProgress?.currentTime || 0)
  const displayProgress = currentTrack?.id === item.id 
    ? (item.durationSeconds ? (currentTime / item.durationSeconds) * 100 : 0)
    : (savedProgress?.progressPercent || 0)
  
  // Display duration - giống như Feed PodcastCard
  const displayDuration = currentTrack?.id === item.id
    ? formatTime(duration || item.durationSeconds || 0)
    : formatTime(savedProgress?.duration || item.durationSeconds || 0)

  return (
    <article className={`${styles.savedCard} ${viewMode === 'list' ? styles.savedCardList : ''}`}>
      <div className={styles.savedTop}>
        {item.pinned && (
          <span className={styles.savedBadge}>
            <Pin size={11} />
            Đã ghim
          </span>
        )}
      </div>

      <div className={styles.savedBody} onClick={() => onOpenDetail(item)}>
        <div className={styles.savedMain} style={{ cursor: 'pointer' }}>
          <h4 className={styles.savedTitle}>{item.title}</h4>
          <p className={styles.savedMeta}>
            {item.author} · {item.listens}
          </p>
          <div className={styles.tagsContainer}>
            {item.tags && item.tags.length > 0 && (
              <p className={styles.tags}>
                {item.tags.slice(0, 2).map((tag, idx) => (
                  <span key={idx} className={styles.tag}>{tag}</span>
                ))}
                {item.tags.length > 2 && <span className={styles.tag}>+{item.tags.length - 2}</span>}
              </p>
            )}
          </div>

          {/* Flat player bar like feed */}
          <div className={styles.player}>
            <button
              className={`${styles.playBtn} ${isCurrentPlaying ? styles.playing : ''}`}
              onClick={(e) => { e.stopPropagation(); handlePlayClick() }}
              type="button"
              disabled={!item.audioUrl}
              aria-label={isCurrentPlaying ? 'Tạm dừng' : 'Phát'}
              title={!item.audioUrl ? 'Không có file audio' : ''}
            >
              {isCurrentPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>

            <div className={styles.progressSection}>
              <span className={styles.time}>{formatTime(displayTime)}</span>
              <div 
                className={styles.progressBar}
                ref={progressBarRef}
                onClick={(e) => { e.stopPropagation(); handleProgressBarClick(e) }}
                role="progressbar"
                tabIndex={0}
                aria-label="Seek bar"
              >
                <div className={styles.progressFill} style={{ width: `${displayProgress}%` }} />
                {currentTrack?.id === item.id && isSeeking && (
                  <div className={styles.seekingIndicator}>
                    <Loader size={14} />
                  </div>
                )}
              </div>
              <span className={styles.time}>{displayDuration}</span>
            </div>
          </div>

          <div className={styles.savedFooter}>
            <button type="button" className={`${styles.metaPill} ${styles.metaPillInfo}`}>
              {item.listenedPercent >= 100 ? <CheckCircle2 size={14} /> : <PlayCircle size={14} />}
              <span>{getListenLabel(item.listenedPercent)}</span>
            </button>

            <button type="button" className={`${styles.metaPill} ${item.hasNote ? styles.metaPillNoted : styles.metaPillMuted}`} onClick={(e) => { e.stopPropagation(); onOpenNotes(item) }}>
              <MessageSquareText size={14} />
              <span>Ghi chú</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function FavoritesContent() {
  console.log('🎵 FavoritesContent RENDER')
  const [viewMode, setViewMode] = useState('grid')
  const [podcasts, setPodcasts] = useState([])
  const [collections, setCollections] = useState([])
  const [showAllCollections, setShowAllCollections] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState(null)
  const [collectionPosts, setCollectionPosts] = useState([])
  const [loadingCollections, setLoadingCollections] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')
  const [notesModalOpen, setNotesModalOpen] = useState(false)
  const [selectedPostForNotes, setSelectedPostForNotes] = useState(null)
  const [showAllPostsModal, setShowAllPostsModal] = useState(false)
  const [showPostDetail, setShowPostDetail] = useState(false)
  const [selectedPostDetail, setSelectedPostDetail] = useState(null)
  const [likeCount, setLikeCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(true)
  const POST_SYNC_EVENT = 'post-sync-updated'

  const { pauseTrackIfDeleted } = useAudioPlayer()

  const dispatchPostSync = (payload) => {
    if (payload?.postId) {
      const oldSync = JSON.parse(localStorage.getItem(`post-sync-${payload.postId}`) || '{}')
      const nextSync = { ...oldSync, ...payload }
      localStorage.setItem(`post-sync-${payload.postId}`, JSON.stringify(nextSync))
    }

    window.dispatchEvent(new CustomEvent(POST_SYNC_EVENT, { detail: payload }))
  }

  const { removeSavedPost, hidePost, deletePost, isPostHidden, isPostDeleted, hiddenPostIds, deletedPostIds, deletedPostsVersion, hiddenPostsVersion } = useContext(PodcastContext)

  const fetchCollections = useCallback(async () => {
    console.log('🎯 fetchCollections called')
    try {
      const token = getToken()
      console.log('🔑 Token:', token ? `${token.substring(0, 20)}...` : 'NOT FOUND')
      console.log('📡 Fetching /api/social/collections/')
      
      const response = await fetch('http://127.0.0.1:8000/api/social/collections/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      console.log('📊 Response Status:', response.status)
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      
      console.log('✅ Collections fetched:', data.data?.collections?.length || 0)

      if (data.success && data.data.collections) {
        setCollections(data.data.collections)
      } else {
        console.warn('⚠️ Empty collections response')
      }
    } catch (err) {
      console.error('❌ Failed to fetch collections:', err)
      setCollections([])
    }
  }, [])

  const fetchCollectionPosts = useCallback(async (collectionId) => {
    try {
      setLoadingCollections(true)
      const token = getToken()
      // Fetch từ bảng collection_items để get posts của collection
      const response = await fetch(`http://127.0.0.1:8000/api/social/collections/${collectionId}/posts/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()

      if (data.success && data.data.posts) {
        // Transform posts
        const transformedPosts = data.data.posts.map(post => ({
          id: post.id,
          pinned: false,
          title: post.title,
          author: post.author || 'Người dùng',
          authorUsername: post.author_username || post.author || 'Người dùng',
          authorId: post.user_id,
          author_id: post.user_id,
          user_id: post.user_id,
          userId: post.user_id,
          isOwner: post.is_owner || false,
          topic: post.tags && post.tags.length > 0 ? post.tags[0] : 'Chung',
          tags: post.tags || [],
          like_count: post.like_count || 0,
          comment_count: post.comment_count || 0,
          share_count: post.share_count || 0,
          is_liked: post.is_liked || false,
          listens: post.listen_count 
            ? `${post.listen_count >= 1000 ? Math.floor(post.listen_count / 1000) + 'k' : post.listen_count} lượt nghe` 
            : '0 lượt nghe',
          duration: post.duration_seconds 
            ? `${Math.floor(post.duration_seconds / 60)}:${String(post.duration_seconds % 60).padStart(2, '0')}`
            : '0:00',
          durationSeconds: post.duration_seconds || 0,
          description: post.description,
          noteCount: post.has_note ? 1 : 0,
          hasNote: post.has_note || false,
          saved: true,
          listenedPercent: post.playback_history?.completed_ratio 
            ? Math.round(post.playback_history.completed_ratio * 100)
            : 0,
          audioUrl: post.audio_url || '',
          thumbnail_url: post.thumbnail_url || '',
          created_at: post.created_at,
          timeAgo: post.timeAgo,
        }))
        setCollectionPosts(transformedPosts)
        setShowAllPostsModal(true)
      }
    } catch (err) {
      console.error('Failed to fetch collection posts:', err)
      setCollectionPosts([])
    } finally {
      setLoadingCollections(false)
    }
  }, [])

  const handleCollectionClick = useCallback((collection) => {
    setSelectedCollection(collection)
    fetchCollectionPosts(collection.id)
  }, [fetchCollectionPosts])

  const fetchSavedPosts = useCallback(async () => {
    try {
      setLoading(true)
      const token = getToken()
      const response = await fetch('http://127.0.0.1:8000/api/social/saved-posts/my/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.data.saved_posts) {
        // Transform API data to match UI format
        const transformedPodcasts = data.data.saved_posts.map(post => {
          // Get listen percentage from playback history if available
          const listenedPercent = post.playback_history?.completed_ratio 
            ? Math.round(post.playback_history.completed_ratio * 100)
            : 0
          
          return {
            id: post.id,
            pinned: false,
            title: post.title,
            author: post.author || 'Người dùng',
            authorUsername: post.author_username || post.author || 'Người dùng',
            authorId: post.user_id,
            author_id: post.user_id,
            user_id: post.user_id,
            userId: post.user_id,
            isOwner: post.is_owner || false,
            topic: post.tags && post.tags.length > 0 ? post.tags[0] : 'Chung',
            tags: post.tags || [],
            like_count: post.like_count || 0,
            comment_count: post.comment_count || 0,
            share_count: post.share_count || 0,
            is_liked: post.is_liked || false,
            listens: post.listen_count 
              ? `${post.listen_count >= 1000 ? Math.floor(post.listen_count / 1000) + 'k' : post.listen_count} lượt nghe` 
              : '0 lượt nghe',
            duration: post.duration_seconds 
              ? `${Math.floor(post.duration_seconds / 60)}:${String(post.duration_seconds % 60).padStart(2, '0')}`
              : '0:00',
            durationSeconds: post.duration_seconds || 0,
            description: post.description,
            noteCount: post.has_note ? 1 : 0,
            hasNote: post.has_note || false,
            saved: true,
            listenedPercent,
            audioUrl: post.audio_url || '',
            thumbnail_url: post.thumbnail_url || '',
            created_at: post.created_at,
            timeAgo: post.timeAgo,
          }
        })

        setPodcasts(transformedPodcasts)
      }
    } catch (err) {
      console.error('Failed to fetch saved posts:', err)
      setPodcasts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const handlePostSync = (event) => {
      const d = event.detail || {}
      if (!d.postId) return

      setPodcasts(prev =>
        prev.map(item =>
          String(item.id) === String(d.postId)
            ? {
                ...item,
                is_liked: typeof d.liked === 'boolean' ? d.liked : item.is_liked,
                like_count: typeof d.likeCount === 'number' ? d.likeCount : item.like_count,
                saved: typeof d.saved === 'boolean' ? d.saved : item.saved,
              }
            : item
        )
      )

      setSelectedPostDetail(prev =>
        prev && String(prev.id) === String(d.postId)
          ? {
              ...prev,
              is_liked: typeof d.liked === 'boolean' ? d.liked : prev.is_liked,
              like_count: typeof d.likeCount === 'number' ? d.likeCount : prev.like_count,
              saved: typeof d.saved === 'boolean' ? d.saved : prev.saved,
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
    return () => window.removeEventListener(POST_SYNC_EVENT, handlePostSync)
  }, [selectedPostDetail])

  // Fetch danh sách saved posts và collections từ API khi component mount
  useEffect(() => {
    console.log('🔥 MOUNT EFFECT: Calling fetchSavedPosts and fetchCollections')
    fetchSavedPosts()
    fetchCollections()
  }, [fetchSavedPosts, fetchCollections])

  useEffect(() => {
    if (loading || podcasts.length === 0) return
    if (sessionStorage.getItem('returnFromEdit') !== 'true') return

    const openPostId = sessionStorage.getItem('openPostDetailId')
    if (!openPostId) return

    const post = podcasts.find(p => String(p.id) === String(openPostId))
    if (!post) return

    handleOpenPostDetail(post)

    sessionStorage.removeItem('returnFromEdit')
    sessionStorage.removeItem('returnToAfterEdit')
    sessionStorage.removeItem('openPostDetailId')
    sessionStorage.removeItem('openPostDetailNoScroll')
  }, [loading, podcasts])

  const decreaseCollectionCountByPostId = useCallback((postId) => {
    setCollections(prev =>
      prev.map(collection => {
        const hasPost =
          collection.post_ids?.some(id => String(id) === String(postId)) ||
          collection.posts?.some(post => String(post.id) === String(postId))

        if (!hasPost) return collection

        return {
          ...collection,
          post_count: Math.max((collection.post_count || 0) - 1, 0),
        }
      })
    )
  }, [])

  const toggleSaved = useCallback(async id => {
    console.log('🎁 [Favorites] toggleSaved called:', { id, type: typeof id })
    const removedItem = podcasts.find(item => item.id === id)
    console.log('🎁 [Favorites] Calling pauseTrackIfDeleted')
    pauseTrackIfDeleted(id)
    console.log('🎁 [Favorites] Calling removeSavedPost')
    setPodcasts(prev => {
      const filtered = prev.filter(item => item.id !== id)
      console.log('🎁 [Favorites] UI updated (toggleSaved):', prev.length, '->', filtered.length)
      return filtered
    })
    
    removeSavedPost(id)
    decreaseCollectionCountByPostId(id)

    try {
      const token = getToken()
      const response = await fetch(`http://127.0.0.1:8000/api/social/posts/${id}/save/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        fetchCollections()

        dispatchPostSync({
          postId: id,
          saved: false,
          saveCount: Number(data.data?.save_count || 0),
        })
      } else {
        throw new Error(data.message || 'Bỏ lưu thất bại')
      }
    } catch (err) {
      console.error('❌ API error:', err)
      toast.error(err.message || 'Bỏ lưu bài viết thất bại')
      if (removedItem) {
        setPodcasts(prev => [...prev, removedItem])
      }
    }
  }, [podcasts, removeSavedPost, decreaseCollectionCountByPostId, fetchCollections])

  const handleOpenNotes = (post) => {
    setSelectedPostForNotes(post)
    setNotesModalOpen(true)
  }

  const handleOpenPostDetail = (post) => {
    setSelectedPostDetail(post)
    setLikeCount(post.like_count || post.likes || 0)
    setCommentCount(post.comment_count || post.comments || 0)
    setLiked(post.is_liked || post.liked || false)

    setSaved(Boolean(
      post.saved ??
      post.is_saved ??
      post.viewer_state?.is_saved ??
      false
    ))

    setShowPostDetail(true)
  }

  const handleSelectPostFromAllModal = (post) => {
    setShowAllPostsModal(false)
    handleOpenPostDetail(post)
  }

  const handleToggleLike = async () => {
    try {
      const token = getToken()
      const response = await fetch(`http://127.0.0.1:8000/api/social/posts/${selectedPostDetail?.id}/like/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()

      if (data.success) {
        const nextLiked = Boolean(data.data?.liked)
        const nextLikeCount = Number(data.data?.like_count || 0)

        setLiked(nextLiked)
        setLikeCount(nextLikeCount)

        setPodcasts(prev =>
          prev.map(item =>
            String(item.id) === String(selectedPostDetail?.id)
              ? { ...item, is_liked: nextLiked, like_count: nextLikeCount }
              : item
          )
        )

        dispatchPostSync({
          postId: selectedPostDetail.id,
          liked: nextLiked,
          likeCount: nextLikeCount,
        })
      }
    } catch (err) {
      console.error('Failed to toggle like:', err)
    }
  }

  const handleToggleSave = async () => {
    const removedItem = podcasts.find(item => item.id === selectedPostDetail?.id)
    
    try {
      const token = getToken()
      
      setPodcasts(prev => prev.filter(item => item.id !== selectedPostDetail?.id))
      removeSavedPost(selectedPostDetail?.id)
      decreaseCollectionCountByPostId(selectedPostDetail?.id)
      
      const response = await fetch(`http://127.0.0.1:8000/api/social/posts/${selectedPostDetail?.id}/save/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      if (data.success) {
        const nextSaved = Boolean(data.data?.saved)
        const nextSaveCount = Number(data.data?.save_count || 0)

        setSaved(nextSaved)
        fetchCollections()

        dispatchPostSync({
          postId: selectedPostDetail.id,
          saved: nextSaved,
          saveCount: nextSaveCount,
        })
      } else {
        throw new Error('Bỏ lưu thất bại')
      }
    } catch (err) {
      console.error('Failed to toggle save:', err)
      toast.error('Bỏ lưu bài viết thất bại')
      // Restore if API fails
      if (removedItem) {
        setPodcasts(prev => [...prev, removedItem])
      }
    }
  }

  const handleShare = async () => {
    try {
      console.log('Share post:', selectedPostDetail?.id)
    } catch (err) {
      console.error('Failed to share:', err)
    }
  }

  const handlePostDeleted = (postId) => {
    const id = postId || selectedPostDetail?.id
    console.log('🎁 [Favorites] handlePostDeleted called:', { id, type: typeof id })

    if (id) {
      console.log('🎁 [Favorites] Calling pauseTrackIfDeleted')
      pauseTrackIfDeleted(id)
      console.log('🎁 [Favorites] Calling deletePost')
      deletePost(id)
      console.log('🎁 [Favorites] Calling removeSavedPost')
      removeSavedPost(id)

      setPodcasts(prev => {
        const filtered = prev.filter(item => String(item.id) !== String(id))
        console.log('🎁 [Favorites] Filtered podcasts:', prev.length, '->', filtered.length)
        return filtered
      })

      setCollectionPosts(prev =>
        prev.filter(item => String(item.id) !== String(id))
      )

      fetchCollections()
    }

    setShowPostDetail(false)
    setSelectedPostDetail(null)
  }

  const handleNoteLoaded = (postId, hasNote) => {
    // Cập nhật hasNote khi ghi chú được tải từ backend
    setPodcasts(prev =>
      prev.map(item =>
        item.id === postId
          ? { ...item, hasNote }
          : item
      )
    )
  }

  const handleSaveNote = async (postId, noteContent) => {
    try {
      const token = getToken()
      const response = await fetch(`http://127.0.0.1:8000/api/social/posts/${postId}/notes/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: noteContent }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      if (data.success) {
        // Update podcasts with hasNote flag
        setPodcasts(prev =>
          prev.map(item =>
            item.id === postId
              ? { ...item, hasNote: noteContent ? true : false, noteCount: noteContent ? 1 : 0 }
              : item
          )
        )
      }
    } catch (err) {
      console.error('Failed to save note:', err)
      alert('Lỗi khi lưu ghi chú')
    }
  }

  const stats = useMemo(() => {
    console.log('📊 Recalc stats - podcasts:', podcasts.length, 'deleted:', deletedPostIds.size, 'hidden:', hiddenPostIds.size, 'deletedVer:', deletedPostsVersion)
    const activePostcasts = podcasts.filter(item => {
      const isDeleted = deletedPostIds.has(String(item.id))
      const isHidden = hiddenPostIds.has(String(item.id))
      if (isDeleted || isHidden) {
        console.log(`  ❌ Filtering out ${item.title} (deleted:${isDeleted}, hidden:${isHidden})`)
      }
      return !isDeleted && !isHidden
    })
    console.log('  ✅ Active posts after filter:', activePostcasts.length)
    const saved = activePostcasts.filter(item => item.saved).length
    const listened = activePostcasts.filter(item => item.listenedPercent > 0).length
    const unheard = activePostcasts.filter(item => item.listenedPercent === 0).length
    const notes = activePostcasts.filter(item => item.noteCount > 0).length

    return [
      { key: 'saved', icon: BookMarked, value: saved, sub: 'Đã lưu' },
      { key: 'listened', icon: Headphones, value: listened, sub: 'Đã nghe' },
      { key: 'unheard', icon: Clock3, value: unheard, sub: 'Chưa nghe' },
      { key: 'notes', icon: StickyNote, value: notes, sub: 'Ghi chú' },
    ]
  }, [podcasts, hiddenPostIds, deletedPostIds, deletedPostsVersion, hiddenPostsVersion])

  const visiblePodcasts = useMemo(() => {
    console.log('🔄 Recalc visiblePodcasts - podcasts:', podcasts.length, 'deleted:', deletedPostIds.size, 'hidden:', hiddenPostIds.size, 'deletedVer:', deletedPostsVersion, 'hiddenVer:', hiddenPostsVersion)
    const filtered = podcasts.filter(item => !deletedPostIds.has(String(item.id)) && !hiddenPostIds.has(String(item.id)))
    console.log('  📋 After filter:', filtered.length)
    
    switch (activeFilter) {
      case 'saved':
        return filtered.filter(item => item.saved)
      case 'listened':
        return filtered.filter(item => item.listenedPercent > 0)
      case 'unheard':
        return filtered.filter(item => item.listenedPercent === 0)
      case 'notes':
        return filtered.filter(item => item.noteCount > 0)
      default:
        return filtered
    }
  }, [activeFilter, podcasts, hiddenPostIds, deletedPostIds, deletedPostsVersion, hiddenPostsVersion])

  const sortedCollections = useMemo(() => {
    return [...collections].sort((a, b) => {
      const countDiff = (b.post_count || 0) - (a.post_count || 0)
      if (countDiff !== 0 ) return countDiff

      return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
    })
  }, [collections])

  useEffect(() => {
    const handleOpenPostDetailFromPlayer = async (event) => {
      const postId = event.detail?.postId
      if (!postId) return

      let post = podcasts.find(p => String(p.id) === String(postId))

      if (!post) {
        try {
          const token = getToken()

          const res = await fetch(`http://localhost:8000/api/content/drafts/${postId}/`, {
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          })

          const data = await res.json()
          const raw = data.data || data

          post = {
            id: raw.id,
            title: raw.title,
            description: raw.description,
            author: raw.author?.name || raw.author || 'Người dùng',
            authorUsername: raw.author?.username || raw.author_username || '',
            authorId: raw.user_id || raw.author_id,
            user_id: raw.user_id || raw.author_id,
            userId: raw.user_id || raw.author_id,
            isOwner: raw.is_owner || false,
            cover: raw.thumbnail_url || '',
            thumbnail_url: raw.thumbnail_url || '',
            audioUrl: raw.audio?.audio_url || raw.audio_url || '',
            audio_url: raw.audio?.audio_url || raw.audio_url || '',
            durationSeconds: raw.audio?.duration_seconds || raw.duration_seconds || 0,
            duration_seconds: raw.audio?.duration_seconds || raw.duration_seconds || 0,
            like_count: raw.stats?.likes || raw.like_count || 0,
            comment_count: raw.stats?.comments || raw.comment_count || 0,
            share_count: raw.stats?.shares || raw.share_count || 0,
            is_liked: raw.viewer_state?.is_liked || raw.is_liked || false,
            saved: raw.viewer_state?.is_saved || raw.saved || false,
            created_at: raw.created_at,
            timeAgo: raw.timeAgo,
          }
        } catch (err) {
          console.error('Fetch post detail failed:', err)
          return
        }
      }

      handleOpenPostDetail(post)
    }

    window.addEventListener('open-post-detail', handleOpenPostDetailFromPlayer)

    return () => {
      window.removeEventListener('open-post-detail', handleOpenPostDetailFromPlayer)
    }
  }, [podcasts])

  if (loading) {
    return (
      <section className={styles.wrapper}>
        <div className={styles.mainCol}>
          <div className={styles.sectionCard}>
            <div className={styles.pageHeader}>
              Đang tải...
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className={styles.wrapper}>
      <div className={styles.mainCol}>
        <div className={styles.sectionCard}>
          <div className={styles.pageHeader}>
            <div className={styles.titleRow}>
              <div className={styles.pinIcon}>
                <MapPin size={14} />
              </div>
              <div className={styles.titleCopy}>
                <h1 className={styles.pageTitle}>Thư viện yêu thích</h1>
                <p className={styles.pageSub}>
                  Podcast đã lưu, ghi chú và ghim lại
                </p>
              </div>
            </div>

            <div className={styles.headerActions}>
              <button
                type="button"
                className={`${styles.iconBtn} ${
                  viewMode === 'grid' ? styles.iconBtnActive : ''
                }`}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid size={15} />
              </button>

              <button
                type="button"
                className={`${styles.iconBtn} ${
                  viewMode === 'list' ? styles.iconBtnActive : ''
                }`}
                onClick={() => setViewMode('list')}
              >
                <Rows3 size={15} />
              </button>
            </div>
          </div>

          <div className={styles.statsGrid}>
            {stats.map(({ key, icon: Icon, value, sub }) => (
              <button
                key={key}
                type="button"
                className={`${styles.statCard} ${
                  activeFilter === key ? styles.statCardActive : ''
                }`}
                onClick={() =>
                  setActiveFilter(prev => (prev === key ? 'all' : key))
                }
              >
                <div className={styles.statIcon}>
                  <Icon size={15} />
                </div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>{value}</div>
                  <div className={styles.statSub}>{sub}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <div>
              <h3 className={styles.sectionTitle}>Bộ sưu tập</h3>
              <p className={styles.sectionSub}>{sortedCollections.length} bộ</p>
            </div>

            {sortedCollections.length > 4 && (
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => setShowAllCollections(prev => !prev)}
              >
                {showAllCollections ? 'Thu gọn' : 'Xem tất cả'} <ChevronRight size={15} />
              </button>
            )}
          </div>

          <div className={styles.collectionGrid}>
            {sortedCollections.length > 0 ? (
              (showAllCollections ? sortedCollections : sortedCollections.slice(0, 4)).map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.collectionCard}
                  onClick={() => handleCollectionClick(item)}
                >
                  <span className={styles.collectionName}>{item.name}</span>
                  <span className={styles.collectionCount}>{item.post_count || 0} podcast</span>
                </button>
              ))
            ) : (
              <p className={styles.emptyMessage}>Chưa có bộ sưu tập nào</p>
            )}
          </div>
        </div>

        <div className={styles.sectionCard}>
          <div className={styles.sectionHead}>
            <div>
              <h3 className={styles.sectionTitle}>Podcast đã lưu</h3>
              <p className={styles.sectionSub}>
                {visiblePodcasts.length} podcast
              </p>
            </div>
            {visiblePodcasts.length > 4 && (
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => {
                  setSelectedCollection(null)
                  setCollectionPosts([])
                  setShowAllPostsModal(true)
                }}
              >
                Xem tất cả <ChevronRight size={15} />
              </button>
            )}
          </div>

          <div className={`${styles.savedGrid} ${viewMode === 'list' ? styles.savedGridList : ''}`}>
            {visiblePodcasts.slice(0, 4).length > 0 ? (
              visiblePodcasts.slice(0, 4).map(item => (
                <SavedCard
                  key={item.id}
                  item={item}
                  viewMode={viewMode}
                  onToggleSaved={toggleSaved}
                  onOpenNotes={handleOpenNotes}
                  onOpenDetail={handleOpenPostDetail}
                />
              ))
            ) : (
              <p style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: '#999' }}>
                Chưa có podcast nào được lưu
              </p>
            )}
          </div>
        </div>
      </div>

      <NotesModal
        isOpen={notesModalOpen}
        onClose={() => {
          setNotesModalOpen(false)
          setSelectedPostForNotes(null)
        }}
        post={selectedPostForNotes}
        onSaveNote={handleSaveNote}
        onNoteLoaded={handleNoteLoaded}
      />

      <AllPostsModal
        isOpen={showAllPostsModal}
        onClose={() => {
          setShowAllPostsModal(false)
          setSelectedCollection(null)
          setCollectionPosts([])
        }}
        posts={selectedCollection ? collectionPosts : visiblePodcasts}
        title={
          selectedCollection
            ? `Bộ sưu tập ${selectedCollection.name}`
            : `Tất cả podcast đã lưu (${visiblePodcasts.length})`
        }
        onSelectPost={handleSelectPostFromAllModal}
      />

      {showPostDetail && selectedPostDetail && (
        <CommentModal
          podcast={selectedPostDetail}
          liked={liked}
          saved={saved}
          likeCount={likeCount}
          shareCount={selectedPostDetail?.share_count || 0}
          saveCount={0}
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
    </section>
  )
}
