  import { useEffect, useRef, useState } from 'react'
  import {
    Play, Pause, Heart, MessageCircle,
    Share2, Bookmark, Sparkles, MoreHorizontal
  } from 'lucide-react'
  import styles from '../../style/feed/PodcastCard.module.css'
  import { useAudioPlayer } from '../contexts/AudioPlayerContext'
  import { getToken, getCurrentUser } from '../../utils/auth'
  import CommentModal from './CommentModal'

  function formatTime(seconds) {
    const total = Math.floor(Number(seconds || 0))
    const mins = Math.floor(total / 60)
    const secs = total % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  export default function PodcastCard({ podcast, queue = [] }) {
    const [liked, setLiked] = useState(podcast.liked ?? false)
    const [likeCount, setLikeCount] = useState(podcast.likes ?? 0)
    const [loadingLike, setLoadingLike] = useState(false)
    const [saved, setSaved] = useState(
      podcast.saved ?? podcast.viewer_state?.is_saved ?? false
    )
    const [saveCount, setSaveCount] = useState(
      podcast.saveCount ?? podcast.stats?.saves ?? 0
    )
    const [loadingSave, setLoadingSave] = useState(false)
    const [shareCount, setShareCount] = useState(podcast.shares ?? 0)
    const [loadingShare, setLoadingShare] = useState(false)
    const [showCommentModal, setShowCommentModal] = useState(false)
    const [commentCount, setCommentCount] = useState(podcast.comments ?? 0)

    const {
      playing,
      currentTime,
      duration,
      progressPercent,
      playTrack,
      seekToPercent,
      isCurrentTrack,
      trackProgressMap,
      togglePlay,
    } = useAudioPlayer()

    const isActive = isCurrentTrack(podcast.id)
    const isPlaying = isActive && playing

    const audioSrc = podcast.audioUrl || podcast.audio_url || ''
    const queueWithAudio = queue.filter((item) => item.audioUrl || item.audio_url)

    const savedProgress = trackProgressMap?.[podcast.id]
    const hasPlayedBefore = Boolean(savedProgress?.hasPlayed)

    const displayCurrent = isActive
      ? formatTime(currentTime)
      : hasPlayedBefore
        ? formatTime(savedProgress?.currentTime || 0)
        : '00:00'

    const displayDuration = isActive
      ? formatTime(duration || podcast.durationSeconds || podcast.duration_seconds || 0)
      : formatTime(savedProgress?.duration || podcast.durationSeconds || podcast.duration_seconds || 0)

    const displayProgress = isActive
      ? progressPercent
      : hasPlayedBefore
        ? Number(savedProgress?.progressPercent || 0)
        : 0

    const {
      title,
      author,
      authorUsername,
      authorInitials = 'A',
      cover,
      tags,
      aiGenerated,
      description,
    } = podcast

    const handlePlayClick = () => {
      if (!audioSrc) return

      if (isActive) {
        togglePlay()
        return
      }

      playTrack(
        {
          ...podcast,
          audioUrl: audioSrc,
        },
        queueWithAudio.map((item) => ({
          ...item,
          audioUrl: item.audioUrl || item.audio_url || '',
        }))
      )
    }

    const handleSeek = (e) => {
      const value = Number(e.target.value)

      if (!audioSrc) return

      if (!isActive) {
        playTrack(
          {
            ...podcast,
            audioUrl: audioSrc,
          },
          queueWithAudio.map((item) => ({
            ...item,
            audioUrl: item.audioUrl || item.audio_url || '',
          }))
        )

        setTimeout(() => seekToPercent(value), 0)
        return
      }

      seekToPercent(value)
    }

    const handleToggleLike = async (e) => {
      e.preventDefault()
      e.stopPropagation()

      if (loadingLike) return

      try {
        setLoadingLike(true)

        const token = getToken()
        const currentUser = getCurrentUser()

        const res = await fetch(
          `http://localhost:8000/api/social/posts/${podcast.id}/like/`,
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

        setLiked(Boolean(data.data?.liked))
        setLikeCount(Number(data.data?.like_count || 0))
      } catch (err) {
        console.error('Like failed:', err)
        alert(err.message || 'Like thất bại')
      } finally {
        setLoadingLike(false)
      }
    }

    const handleToggleSave = async (e) => {
      e.preventDefault()
      e.stopPropagation()

      if (loadingSave) return

      try {
        setLoadingSave(true)

        const token = getToken()
        const currentUser = getCurrentUser()

        const res = await fetch(
          `http://localhost:8000/api/social/posts/${podcast.id}/save/`,
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

        setSaved(Boolean(data.data?.saved))
        setSaveCount(Number(data.data?.save_count || 0))
      } catch (err) {
        console.error('Save failed:', err)
        alert(err.message || 'Lưu bài thất bại')
      } finally {
        setLoadingSave(false)
      }
    }

    const handleShare = async (e) => {
      e.preventDefault()
      e.stopPropagation()

      if (loadingShare) return

      try {
        setLoadingShare(true)

        const token = getToken()
        const currentUser = getCurrentUser()

        const res = await fetch(
          `http://localhost:8000/api/social/posts/${podcast.id}/share/`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              user_id: currentUser?.id,
              share_type: 'copy_link',
            }),
          }
        )

        const data = await res.json()

        if (!res.ok || !data.success) {
          throw new Error(data.message || `HTTP ${res.status}`)
        }

        setShareCount(Number(data.data?.share_count || 0))
      } catch (err) {
        console.error('Share failed:', err)
        alert(err.message || 'Chia sẻ thất bại')
      } finally {
        setLoadingShare(false)
      }
    }

    const [statsPopupDirection, setStatsPopupDirection] = useState('down')
    const [statsHoverType, setStatsHoverType] = useState(null) 
    const [statsPopupData, setStatsPopupData] = useState({
      likes: [],
      comments: [],
      shares: [],
    })
    const [statsPopupLoading, setStatsPopupLoading] = useState(false)
    const hoverTimerRef = useRef(null)

    const getUniqueUsersById = (items = []) => {
      const map = new Map()

      items.forEach((item) => {
        const key = item.user_id || item.username
        if (!key || map.has(key)) return
        map.set(key, item)
      })

      return Array.from(map.values())
    }

    const fetchStatsPopupData = async (type) => {
      try {
        setStatsPopupLoading(true)

        const token = getToken()
        let endpoint = ''

        if (type === 'likes') {
          endpoint = `http://localhost:8000/api/social/posts/${podcast.id}/likers/`
        } else if (type === 'comments') {
          endpoint = `http://localhost:8000/api/social/posts/${podcast.id}/commenters/`
        } else if (type === 'shares') {
          endpoint = `http://localhost:8000/api/social/posts/${podcast.id}/sharers/`
        } else {
          return
        }

        const res = await fetch(endpoint, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })

        const data = await res.json()

        if (!res.ok || !data.success) {
          throw new Error(data.message || `HTTP ${res.status}`)
        }

        if (type === 'likes') {
          setStatsPopupData((prev) => ({
            ...prev,
            likes: data.data?.likers || [],
          }))
        }

        if (type === 'comments') {
          setStatsPopupData((prev) => ({
            ...prev,
            comments: data.data?.commenters || [],
          }))
        }

        if (type === 'shares') {
          setStatsPopupData((prev) => ({
            ...prev,
            shares: getUniqueUsersById(data.data?.sharers || []),
          }))
        }
      } catch (err) {
        console.error(`Fetch ${type} popup failed:`, err)
      } finally {
        setStatsPopupLoading(false)
      }
    }

    useEffect(() => {
      return () => {
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      }
    }, [])

    const handleStatsMouseEnter = (type) => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current)
      }

      updatePopupDirection(type)
      setStatsHoverType(type)

      const hasData =
        (type === 'likes' && statsPopupData.likes.length > 0) ||
        (type === 'comments' && statsPopupData.comments.length > 0) ||
        (type === 'shares' && statsPopupData.shares.length > 0)

      if (!hasData) {
        fetchStatsPopupData(type)
      }
    }

    const handleStatsMouseLeave = () => {
      hoverTimerRef.current = setTimeout(() => {
        setStatsHoverType(null)
      }, 120)
    }

    const statRefs = useRef({
      likes: null,
      comments: null,
      shares: null,
    })

    const updatePopupDirection = (type) => {
    const triggerEl = statRefs.current[type]
    if (!triggerEl) {
      setStatsPopupDirection('down')
      return
    }

    const rect = triggerEl.getBoundingClientRect()
    const popupHeight = 260
    const gap = 12

    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top

    if (spaceBelow < popupHeight + gap && spaceAbove > popupHeight + gap) {
      setStatsPopupDirection('up')
    } else {
      setStatsPopupDirection('down')
    }
  }

    return (
      <>
        <article
          className={[
            styles.card,
            showCommentModal ? styles.noHover : '',
            isActive ? styles.activeCard : '',
          ].join(' ')}
        >
          <div className={styles.cardHeader}>
            <div className={styles.authorAvatar}>
              {authorInitials}
            </div>

            <div className={styles.authorInfo}>
              <div className={styles.authorMetaRow}>
                <span className={styles.authorName}>{author}</span>
                <span className={styles.metaDot}>•</span>
                <span className={styles.authorMetaText}>{podcast.timeAgo}</span>
                <span className={styles.metaDot}>•</span>
                <span className={styles.authorMetaText}>{podcast.listens}</span>
              </div>

              <div className={styles.tagRow}>
                {(tags || []).map((t) => (
                  <span key={t} className={styles.tag}>{t}</span>
                ))}

                {aiGenerated && (
                  <span className={styles.aiBadge}>
                    <Sparkles size={13} />
                    Được tạo bởi AI
                  </span>
                )}
              </div>
            </div>

            <button className={styles.menuBtn} type="button">
              <MoreHorizontal size={18} />
            </button>
          </div>

          <div className={styles.body}>
            <div className={styles.textContent}>
              <h3 className={styles.title}>{title}</h3>
              <p className={styles.description}>{description}</p>
            </div>

            {cover && (
              <img
                src={cover}
                alt={title}
                className={styles.cover}
              />
            )}
          </div>

          <div className={styles.player}>
            <button
              className={`${styles.playBtn} ${isPlaying ? styles.playing : ''}`}
              onClick={handlePlayClick}
              aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
              disabled={!audioSrc}
              title={!audioSrc ? 'Bài này chưa có audio' : ''}
              type="button"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>

            <div className={styles.progressSection}>
              <span className={styles.time}>{displayCurrent}</span>

              <div className={styles.progressBar}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={displayProgress}
                  onChange={handleSeek}
                  className={styles.range}
                  disabled={!audioSrc}
                />
                <div
                  className={styles.progressFill}
                  style={{ width: `${displayProgress}%` }}
                />
              </div>

              <span className={styles.time}>{displayDuration}</span>
            </div>
          </div>

          <div className={styles.actions}>
            <div
              ref={(el) => { statRefs.current.likes = el }}
              className={styles.statHoverWrap}
              onMouseEnter={() => handleStatsMouseEnter('likes')}
              onMouseLeave={handleStatsMouseLeave}
            >
              <button
                className={`${styles.actionBtn} ${liked ? styles.liked : ''}`}
                onClick={handleToggleLike}
                disabled={loadingLike}
                type="button"
              >
                <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
                <span>{likeCount}</span>
              </button>

              {statsHoverType === 'likes' && (
                <div
                  className={`${styles.statsPopup} ${
                    statsPopupDirection === 'up' ? styles.statsPopupUp : styles.statsPopupDown
                  }`}
                  onMouseEnter={() => handleStatsMouseEnter('likes')}
                  onMouseLeave={handleStatsMouseLeave}
                >
                  {statsPopupLoading ? (
                    <div className={styles.statsPopupEmpty}>Đang tải...</div>
                  ) : statsPopupData.likes.length > 0 ? (
                    statsPopupData.likes.map((user) => (
                      <div key={user.user_id} className={styles.statsPopupItem}>
                        <div className={styles.statsPopupName}>
                          {user.username || user.user_id}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.statsPopupEmpty}>Chưa có lượt thích</div>
                  )}
                </div>
              )}
            </div>

            <div
              ref={(el) => { statRefs.current.comments = el }}
              className={styles.statHoverWrap}
              onMouseEnter={() => handleStatsMouseEnter('comments')}
              onMouseLeave={handleStatsMouseLeave}
            >
              <button
                className={styles.actionBtn}
                type="button"
                onClick={() => setShowCommentModal(true)}
              >
                <MessageCircle size={16} />
                <span>{commentCount} Bình luận</span>
              </button>

              {statsHoverType === 'comments' && (
                <div
                  className={`${styles.statsPopup} ${
                    statsPopupDirection === 'up' ? styles.statsPopupUp : styles.statsPopupDown
                  }`}
                  onMouseEnter={() => handleStatsMouseEnter('comments')}
                  onMouseLeave={handleStatsMouseLeave}
                >
                  {statsPopupLoading ? (
                    <div className={styles.statsPopupEmpty}>Đang tải...</div>
                  ) : statsPopupData.comments.length > 0 ? (
                    statsPopupData.comments.map((user) => (
                      <div key={user.user_id} className={styles.statsPopupItem}>
                        <div className={styles.statsPopupName}>
                          {user.username || user.user_id}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.statsPopupEmpty}>Chưa có bình luận</div>
                  )}
                </div>
              )}
            </div>

            <div
              ref={(el) => { statRefs.current.shares = el }}
              className={styles.statHoverWrap}
              onMouseEnter={() => handleStatsMouseEnter('shares')}
              onMouseLeave={handleStatsMouseLeave}
            >
              <button
                className={styles.actionBtn}
                type="button"
                onClick={handleShare}
                disabled={loadingShare}
              >
                <Share2 size={16} />
                <span>{shareCount} Chia sẻ</span>
              </button>

              {statsHoverType === 'shares' && (
                <div
                  className={`${styles.statsPopup} ${
                    statsPopupDirection === 'up' ? styles.statsPopupUp : styles.statsPopupDown
                  }`}
                  onMouseEnter={() => handleStatsMouseEnter('shares')}
                  onMouseLeave={handleStatsMouseLeave}
                >
                  {statsPopupLoading ? (
                    <div className={styles.statsPopupEmpty}>Đang tải...</div>
                  ) : statsPopupData.shares.length > 0 ? (
                    statsPopupData.shares.map((user) => (
                      <div key={user.user_id || user.username} className={styles.statsPopupItem}>
                        <div className={styles.statsPopupName}>
                          {user.username || user.user_id}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.statsPopupEmpty}>Chưa có lượt chia sẻ</div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              className={`${styles.actionBtn} ${saved ? styles.saved : ''}`}
              onClick={handleToggleSave}
              disabled={loadingSave}
            >
              <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
              <span>{saved ? `${saveCount} Lưu` : `${saveCount} Lưu`}</span>
            </button>
          </div>
        </article>

        {showCommentModal && (
          <CommentModal
            podcast={podcast}
            liked={liked}
            saved={saved}
            likeCount={likeCount}
            shareCount={shareCount}
            saveCount={saveCount}
            commentCount={commentCount}
            onClose={() => setShowCommentModal(false)}
            onCommentCountChange={setCommentCount}
            onToggleLike={handleToggleLike}
            onToggleSave={handleToggleSave}
            onShare={handleShare}
          />
        )}
      </>
    )
  }