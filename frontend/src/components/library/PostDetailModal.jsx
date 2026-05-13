import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Play, Pause, MessageSquareText, Heart, Share2, Bookmark, BookmarkCheck } from 'lucide-react'
import styles from '../../style/library/PostDetailModal.module.css'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { getToken } from '../../utils/auth'

export default function PostDetailModal({ isOpen, onClose, post }) {
  const { t } = useTranslation()
  const { playTrack, currentTrack, playing, togglePlay, seekToPercent, isSeeking } = useAudioPlayer()
  const [isLiked, setIsLiked] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!isOpen || !post) return null

  const isCurrentPlaying = currentTrack?.id === post.id && playing

  const handlePlayClick = () => {
    if (!post.audioUrl) return

    if (currentTrack?.id === post.id) {
      togglePlay()
      return
    }

    playTrack({
      id: post.id,
      title: post.title,
      author: post.author,
      audioUrl: post.audioUrl,
      durationSeconds: post.durationSeconds,
      thumbnail_url: post.thumbnail_url,
    })
  }

  const handleSaveClick = async () => {
    try {
      const token = getToken()
      const response = await fetch(`http://127.0.0.1:8000/api/social/posts/${post.id}/save/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setIsSaved(!isSaved)
        }
      }
    } catch (err) {
      console.error(t('library.postDetail.savePostFailed'), err)
    }
  }

  const handleLikeClick = async () => {
    try {
      const token = getToken()
      const response = await fetch(`http://127.0.0.1:8000/api/social/posts/${post.id}/like/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setIsLiked(!isLiked)
        }
      }
    } catch (err) {
      console.error(t('library.postDetail.likePostFailed'), err)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t('library.close')}
          >
            <X size={24} />
          </button>
        </div>

        <div className={styles.content}>
          {/* Cover Image */}
          {post.thumbnail_url && (
            <img src={post.thumbnail_url} alt={post.title} className={styles.cover} />
          )}

          {/* Title and Author */}
          <div className={styles.titleSection}>
            <h1 className={styles.title}>{post.title}</h1>
            <p className={styles.author}>
              {typeof post.author === 'object'
  ? post.author?.name || post.author?.username || t('library.content.user')
  : post.author || t('library.content.user')}
            </p>
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className={styles.tagsSection}>
              {post.tags.map((tag, idx) => (
                <span key={idx} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {post.description && (
            <p className={styles.description}>{post.description}</p>
          )}

          {/* Audio Player */}
          {post.audioUrl && (
            <div className={styles.playerSection}>
              <button
                className={`${styles.playBtn} ${isCurrentPlaying ? styles.playing : ''}`}
                onClick={handlePlayClick}
                type="button"
              >
                {isCurrentPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>
              <div className={styles.playerInfo}>
                <p className={styles.duration}>{post.duration}</p>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className={styles.statsSection}>
            <div className={styles.statItem}>
              <Heart size={16} />
              <span>{t('library.postDetail.likes', { count: post.like_count || 0 })}</span>
            </div>
            <div className={styles.statItem}>
              <MessageSquareText size={16} />
              <span>{t('library.postDetail.comments', { count: post.comment_count || 0 })}</span>
            </div>
            <div className={styles.statItem}>
              <Share2 size={16} />
              <span>{t('library.postDetail.shares', { count: post.share_count || 0 })}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className={styles.actionButtons}>
            <button
              type="button"
              className={`${styles.actionBtn} ${isLiked ? styles.actionBtnActive : ''}`}
              onClick={handleLikeClick}
            >
              <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
              <span>{t('library.postDetail.like')}</span>
            </button>
            <button
              type="button"
              className={`${styles.actionBtn}`}
            >
              <MessageSquareText size={18} />
              <span>{t('library.postDetail.comment')}</span>
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${isSaved ? styles.actionBtnActive : ''}`}
              onClick={handleSaveClick}
            >
              {isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
              <span>
                {isSaved ? t('library.postDetail.saved') : t('library.postDetail.save')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
