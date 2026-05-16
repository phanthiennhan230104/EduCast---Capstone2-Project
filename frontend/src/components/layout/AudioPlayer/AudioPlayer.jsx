import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, ListMusic, Heart,
  ChevronDown, ChevronUp
} from 'lucide-react'
import styles from '../../../style/layout/AudioPlayer.module.css'
import { useAudioPlayer } from "../../contexts/AudioPlayerContext";
import { getToken, getCurrentUser } from '../../../utils/auth'
import { getCanonicalPostIdForEngagement } from '../../../utils/canonicalPostId'
import { API_BASE_URL } from '../../../config/apiBase'
import { useNavigate, useLocation } from 'react-router-dom'

/** Feed truyền `author` là object { id, username, name, avatar_url } — không render trực tiếp trong React. */
function formatTrackAuthorLabel(track) {
  if (!track) return ''
  const a = track.author
  if (typeof a === 'string' && a.trim()) return a.trim()
  if (a && typeof a === 'object') {
    const pick = [a.name, a.username, a.display_name].find(
      (x) => typeof x === 'string' && String(x).trim()
    )
    if (pick) return String(pick).trim()
  }
  return (
    track.authorUsername ||
    track.author_name ||
    track.authorDisplayName ||
    ''
  )
}


export default function AudioPlayer() {
  const { t } = useTranslation()
  const [liked, setLiked] = useState(false)
  const [loadingLike, setLoadingLike] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const POST_SYNC_EVENT = 'post-sync-updated'

  const dispatchPostSync = (payload) => {
    if (payload?.postId) {
      const oldSync = JSON.parse(
        localStorage.getItem(`post-sync-${payload.postId}`) || '{}'
      )

      const nextSync = { ...oldSync }

      if (typeof payload.liked === 'boolean') {
        nextSync.liked = payload.liked
      }

      if (typeof payload.likeCount === 'number') {
        nextSync.likeCount = payload.likeCount
      }

      if (typeof payload.saved === 'boolean') {
        nextSync.saved = payload.saved
      }

      if (typeof payload.saveCount === 'number') {
        nextSync.saveCount = payload.saveCount
      }

      localStorage.setItem(`post-sync-${payload.postId}`, JSON.stringify(nextSync))
    }

    window.dispatchEvent(new CustomEvent(POST_SYNC_EVENT, { detail: payload }))
  }

  const {
    currentTrack,
    playing,
    volume,
    progressPercent,
    formattedCurrentTime,
    formattedDuration,
    togglePlay,
    seekToPercent,
    setVolume,
    playNext,
    playPrev,
  } = useAudioPlayer()

  useEffect(() => {
    const syncId = getCanonicalPostIdForEngagement(currentTrack)

    if (!syncId) {
      setLiked(false)
      return
    }

    const cached = JSON.parse(
      localStorage.getItem(`post-sync-${syncId}`) || '{}'
    )

    if (typeof cached.liked === 'boolean') {
      setLiked(cached.liked)
      return
    }

    setLiked(Boolean(currentTrack?.liked))

    // Card share: trạng thái like trên feed là theo share; cần trạng thái bài gốc giống CommentModal.
    const fromSharedRow = String(currentTrack?.id || '').startsWith('share_')
    if (!fromSharedRow) return

    let cancelled = false
      ; (async () => {
        try {
          const token = getToken()
          const user = getCurrentUser()
          const res = await fetch(
            `${API_BASE_URL}/social/posts/${syncId}/comments/?user_id=${encodeURIComponent(
              user?.id || ''
            )}`,
            {
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            }
          )
          const data = await res.json()
          if (cancelled || !res.ok || !data.success) return
          setLiked(Boolean(data.data?.is_liked))
        } catch (e) {
          console.error('Player like state fetch failed:', e)
        }
      })()

    return () => {
      cancelled = true
    }
  }, [currentTrack?.id, currentTrack?.post_id, currentTrack?.postId])

  const handleOpenPost = () => {
    // Feed tìm dòng theo id dòng (composite với bài share), không dùng canonical.
    const rowId =
      currentTrack?.id ??
      currentTrack?.postId ??
      currentTrack?.post_id
    if (!rowId) return

    const canonicalPostId =
      getCanonicalPostIdForEngagement(currentTrack) || String(rowId)

    window.dispatchEvent(
      new CustomEvent('open-post-detail', {
        detail: {
          postId: rowId,
          canonicalPostId,
          disableAutoScroll: true,
          podcastPreview: {
            ...currentTrack,
            id: canonicalPostId,
            postId: canonicalPostId,
            post_id: canonicalPostId,
          },
        },
      })
    )
  }

  useEffect(() => {
    const handleTrackLikeUpdated = (event) => {
      const { postId, liked } = event.detail || {}
      const syncId = getCanonicalPostIdForEngagement(currentTrack)

      if (!syncId || String(postId) !== String(syncId)) return
      if (typeof liked !== 'boolean') return

      setLiked(liked)
    }

    window.addEventListener('post-sync-updated', handleTrackLikeUpdated)

    return () => {
      window.removeEventListener('post-sync-updated', handleTrackLikeUpdated)
    }
  }, [currentTrack])

  const handleToggleLike = async (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (loadingLike || !currentTrack?.id) return

    const likePostId = getCanonicalPostIdForEngagement(currentTrack)
    if (!likePostId) return

    try {
      setLoadingLike(true)

      const token = getToken()
      const currentUser = getCurrentUser()

      const res = await fetch(
        `${API_BASE_URL}/social/posts/${likePostId}/like/`,
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
      dispatchPostSync({
        postId: likePostId,
        liked: Boolean(data.data?.liked),
        likeCount: Number(data.data?.like_count || 0),
      })

      // Gọi callback nếu track có onLikeChange handler, truyền cả liked state và likeCount
      if (currentTrack?.onLikeChange) {
        currentTrack.onLikeChange({
          liked: Boolean(data.data?.liked),
          likeCount: Number(data.data?.like_count || 0)
        })
      }
    } catch (err) {
      console.error('Like failed:', err)
      alert(err.message || t('audioPlayer.likeFailed'))
    } finally {
      setLoadingLike(false)
    }
  }

  if (!currentTrack) {
    return (
      <footer className={`${styles.player} ${styles.idle}`}>
        <div className={styles.trackInfo}>
          <div className={styles.meta}>
            <span className={styles.title}>{t('audioPlayer.noAudioPlaying')}</span>
            <span className={styles.author}>{t('audioPlayer.choosePodcast')}</span>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer
      className={`${styles.player} ${collapsed ? styles.collapsed : ''}`}
      onClick={handleOpenPost}
    >
      <div className={styles.trackInfo}>
        <img
          src={currentTrack.cover || 'https://picsum.photos/seed/default/56/56'}
          alt={currentTrack.title}
          className={styles.cover}
        />

        <div className={styles.meta}>
          <span className={styles.title}>{currentTrack.title}</span>
          <span className={styles.author}>{formatTrackAuthorLabel(currentTrack)}</span>
        </div>

        <button
          type="button"
          className={`${styles.iconBtn} ${liked ? styles.liked : ''}`}
          onClick={handleToggleLike}
          disabled={loadingLike}
          aria-label={t('audioPlayer.favorite')}
        >
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className={styles.controls}>
        <div className={styles.buttons}>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={t('audioPlayer.previous')}
            onClick={(e) => {
              e.stopPropagation()
              playPrev()
            }}
          >
            <SkipBack size={18} />
          </button>

          <button
            type="button"
            className={styles.playBtn}
            onClick={(e) => {
              e.stopPropagation()
              togglePlay()
            }}
            aria-label={playing ? t('buttons.pause') : t('buttons.play')}
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <button
            type="button"
            className={styles.iconBtn}
            aria-label={t('audioPlayer.next')}
            onClick={(e) => {
              e.stopPropagation()
              playNext()
            }}
          >
            <SkipForward size={18} />
          </button>
        </div>

        <div className={styles.progressRow} onClick={(e) => e.stopPropagation()}>
          <span className={styles.time}>{formattedCurrentTime}</span>

          <div className={styles.progressBar}>
            <input
              type="range"
              min={0}
              max={100}
              value={progressPercent}
              onChange={(e) => {
                e.stopPropagation()
                seekToPercent(Number(e.target.value))
              }}
              className={styles.range}
            />
            <div className={styles.fill} style={{ width: `${progressPercent}%` }} />
          </div>

          <span className={styles.time}>{formattedDuration}</span>
        </div>
      </div>

      <div className={styles.extras}>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={t('audioPlayer.playlist')}
          onClick={(e) => e.stopPropagation()}
        >
          <ListMusic size={17} />
        </button>

        <div className={styles.volumeRow} onClick={(e) => e.stopPropagation()}>
          <Volume2 size={15} className={styles.volIcon} />
          <div className={`${styles.progressBar} ${styles.volumeBar}`}>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => {
                e.stopPropagation()
                setVolume(Number(e.target.value))
              }}
              className={styles.range}
            />
            <div className={styles.fill} style={{ width: `${volume}%` }} />
          </div>
        </div>

        <button
          type="button"
          className={styles.collapseBtn}
          onClick={(e) => {
            e.stopPropagation()
            setCollapsed(prev => !prev)
          }}
          aria-label={collapsed ? t('audioPlayer.expandPlayer') : t('audioPlayer.collapsePlayer')}
          title={collapsed ? t('audioPlayer.expand') : t('audioPlayer.collapse')}
        >
          {collapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>
    </footer>
  )
}
