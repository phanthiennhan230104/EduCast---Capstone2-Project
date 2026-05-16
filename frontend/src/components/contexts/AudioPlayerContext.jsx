import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AuthContext } from './AuthContext'
import { getToken } from '../../utils/auth'
import { getCanonicalPostIdForEngagement } from '../../utils/canonicalPostId'
import { API_BASE_URL } from '../../config/apiBase'

const AudioPlayerContext = createContext(null)

function sameTrackId(a, b) {
  if (a == null || b == null) return false
  return String(a) === String(b)
}

function formatTime(seconds) {
  const total = Math.floor(Number(seconds || 0))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}
function getTrackProgressKey(track) {
  if (!track) return null

  if (track.audioId) return `audio:${track.audioId}`
  if (track.audio_id) return `audio:${track.audio_id}`

  if (track.id && track.audioUrl) {
    return `track:${track.id}:${track.audioUrl}`
  }

  if (track.audioUrl) return `url:${track.audioUrl}`
  if (track.id) return `track:${track.id}`

  return null
}

export function AudioPlayerProvider({ children }) {
  const authCtx = useContext(AuthContext)
  const user = authCtx?.user || null
  const progressRef = useRef({})
  const audioRef = useRef(null)

  // Scoped localStorage key by user ID to prevent cross-user progress sharing
  const getProgressKey = useCallback(() => {
    return user?.id ? `audioPlayerProgress_${user.id}` : null
  }, [user?.id])

  const [queue, setQueue] = useState([])
  const [currentTrack, setCurrentTrack] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(80)
  const [trackProgressMap, setTrackProgressMap] = useState({})
  const [isSeeking, setIsSeeking] = useState(false)

  useEffect(() => {
    const progressKey = getProgressKey()
    if (!progressKey) {
      // User not loaded or logged out, clear progress from previous user
      progressRef.current = {}
      setTrackProgressMap({})
      return
    }

    const savedProgress = localStorage.getItem(progressKey)
    if (savedProgress) {
      try {
        progressRef.current = JSON.parse(savedProgress)
        setTrackProgressMap(progressRef.current)
      } catch (err) {
        console.error('Failed to load progress from localStorage:', err)
      }
    }
  }, [getProgressKey])

  // Clear progress when user changes (logout/login)
  useEffect(() => {
    if (!user?.id) {
      progressRef.current = {}
      setTrackProgressMap({})
      setCurrentTrack(null)
      setPlaying(false)
    }
  }, [user?.id])

  const getSavedProgress = useCallback((track) => {
  const key = getTrackProgressKey(track)
  if (!key) return null
  return progressRef.current[key] || null
}, [])

  const saveProgress = useCallback((trackKey, data) => {
  if (!trackKey) return

  progressRef.current[trackKey] = {
    ...(progressRef.current[trackKey] || {}),
    ...data,
  }

  setTrackProgressMap((prev) => ({
    ...prev,
    [trackKey]: progressRef.current[trackKey],
  }))

    try {
      const progressKey = getProgressKey()
      if (!progressKey) return
      localStorage.setItem(progressKey, JSON.stringify(progressRef.current))
    } catch (err) {
      console.error('Failed to save progress to localStorage:', err)
    }
  }, [getProgressKey])

  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = volume / 100
  }, [volume])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const audio = audioRef.current
      if (audio) {
        audio.pause()
        audio.src = ''
      }
    }
  }, [])

  // Đồng bộ currentTrack khi bài đang phát được chỉnh sửa (title/description/cover)
  useEffect(() => {
    const handlePostSync = (event) => {
      const d = event.detail || {}
      if (!d.postId) return
      if (
        typeof d.title !== 'string' &&
        typeof d.description !== 'string' &&
        typeof d.thumbnail_url !== 'string'
      ) {
        return
      }

      setCurrentTrack((prev) => {
        if (!prev) return prev
        const trackCanonical =
          getCanonicalPostIdForEngagement(prev) || String(prev.id || '')
        if (String(trackCanonical) !== String(d.postId)) return prev
        return {
          ...prev,
          ...(typeof d.title === 'string' ? { title: d.title } : {}),
          ...(typeof d.description === 'string'
            ? { description: d.description }
            : {}),
          ...(typeof d.thumbnail_url === 'string'
            ? { thumbnail_url: d.thumbnail_url, cover: d.thumbnail_url }
            : {}),
        }
      })

      setQueue((prevQueue) =>
        prevQueue.map((item) => {
          const canon =
            getCanonicalPostIdForEngagement(item) || String(item.id || '')
          if (String(canon) !== String(d.postId)) return item
          return {
            ...item,
            ...(typeof d.title === 'string' ? { title: d.title } : {}),
            ...(typeof d.description === 'string'
              ? { description: d.description }
              : {}),
            ...(typeof d.thumbnail_url === 'string'
              ? { thumbnail_url: d.thumbnail_url, cover: d.thumbnail_url }
              : {}),
          }
        })
      )
    }

    window.addEventListener('post-sync-updated', handlePostSync)
    return () => window.removeEventListener('post-sync-updated', handlePostSync)
  }, [])

  // Dừng phát + dọn queue khi 1 bài bị xoá/ẩn ở bất kỳ trang nào.
  useEffect(() => {
    const handleRemoved = (event) => {
      const removedId = event.detail?.postId
      if (!removedId) return
      const target = String(removedId)

      setCurrentTrack((prev) => {
        if (!prev) return prev
        const canon =
          getCanonicalPostIdForEngagement(prev) || String(prev.id || '')
        if (String(canon) !== target) return prev
        try {
          const audio = audioRef.current
          audio?.pause()
          if (audio) {
            audio.src = ''
            audio.load()
          }
        } catch (_) { }
        setPlaying(false)
        setCurrentTime(0)
        setDuration(0)
        return null
      })

      setQueue((prevQueue) =>
        prevQueue.filter((item) => {
          const canon =
            getCanonicalPostIdForEngagement(item) || String(item.id || '')
          return String(canon) !== target
        })
      )
    }
    window.addEventListener('post-removed', handleRemoved)
    return () => window.removeEventListener('post-removed', handleRemoved)
  }, [])

  const trackedListenRef = useRef({})
const pendingSeekPercentRef = useRef(null)
const lastProgressUpdateRef = useRef({})

  const playTrack = useCallback((track, trackQueue = []) => {
    if (!track?.audioUrl) return

    if (!audioRef.current) {
      console.warn('Audio element not found in DOM')
    }

    trackedListenRef.current[track.id] = false

    setQueue(trackQueue.length ? trackQueue : [track])

    const savedProgress = getSavedProgress(track)
    const resumeTime = Number(savedProgress?.currentTime || 0)
    // Use savedProgress duration first (from previous play), fallback to DB
    const nextDuration = Number(savedProgress?.duration || track.durationSeconds || 0)

    setCurrentTrack(track)
    setCurrentTime(resumeTime)
    setDuration(nextDuration)
    setPlaying(true)
    // Gán src + play() trong useEffect bên dưới — tránh play() khi src còn là bài cũ/rỗng.
  }, [getSavedProgress])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack?.audioUrl) return

    if (audio.paused) {
      audio.play().catch((err) => {
        if (err.name === 'AbortError') {
          console.warn('Play interrupted - audio element may have been removed from DOM')
        } else {
          console.error('Play failed:', err)
        }
      })
    } else {
      audio.pause()
    }
  }, [currentTrack])

  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const pauseTrackIfDeleted = useCallback((postId) => {
    console.log('⏸️ [AudioPlayer] pauseTrackIfDeleted called:', {
      postId,
      postIdType: typeof postId,
      currentTrackId: currentTrack?.id,
      currentTrackIdType: typeof currentTrack?.id,
      directMatch: currentTrack?.id === postId,
      stringMatch: String(currentTrack?.id) === String(postId),
    })

    if (currentTrack?.id === postId || String(currentTrack?.id) === String(postId)) {
      console.log('⏸️ [AudioPlayer] MATCH FOUND - resetting player state')
      const audio = audioRef.current
      try {
        audio?.pause()
      } catch (err) {
        console.warn('⏸️ [AudioPlayer] Failed to pause audio element:', err)
      }

      try {
        if (audio) {
          audio.src = ''
          audio.load()
        }
      } catch (err) {
        console.warn('⏸️ [AudioPlayer] Failed to clear audio src:', err)
      }

      setPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      setCurrentTrack(null)

      console.log('⏸️ [AudioPlayer] Player reset: currentTrack cleared, playing=false')
    } else {
      console.log('⏸️ [AudioPlayer] NO MATCH - track not paused')
    }
  }, [currentTrack, setCurrentTime, setDuration, setCurrentTrack])

  const seekToPercent = useCallback((percent) => {
    const audio = audioRef.current

    if (!audio || !currentTrack?.id) return

    const audioDuration =
      Number(audio.duration) ||
      Number(duration) ||
      Number(currentTrack?.durationSeconds) ||
      0

    if (audioDuration <= 0) return

    setIsSeeking(true)

    const nextTime = Math.max(
      0,
      Math.min(
        audioDuration,
        (Number(percent) / 100) * audioDuration
      )
    )

    audio.currentTime = nextTime
    setCurrentTime(nextTime)

    saveProgress(getTrackProgressKey(currentTrack), {
      currentTime: nextTime,
      duration: audioDuration,
      progressPercent: (nextTime / audioDuration) * 100,
      hasPlayed: nextTime > 0,
    })
  }, [duration, currentTrack, saveProgress])
const seekTrackToPercent = useCallback((track, percent, trackQueue = []) => {
  if (!track?.audioUrl) return

  const isSameTrack = sameTrackId(currentTrack?.id, track.id)

  if (isSameTrack) {
    seekToPercent(percent)
    return
  }

  pendingSeekPercentRef.current = Number(percent)
  playTrack(track, trackQueue)
}, [currentTrack, seekToPercent, playTrack])
  const seekToTime = useCallback((time) => {
    const audio = audioRef.current
    if (!audio || !currentTrack?.id) return

    const nextTime = Number(time || 0)
    audio.currentTime = nextTime
    setCurrentTime(nextTime)

    saveProgress(getTrackProgressKey(currentTrack), {
      currentTime: nextTime,
      duration,
      progressPercent: duration ? (nextTime / duration) * 100 : 0,
      hasPlayed: nextTime > 0,
    })
  }, [currentTrack, duration, saveProgress])

  const playNext = useCallback(() => {
    if (!currentTrack || queue.length === 0) return

    const currentIndex = queue.findIndex((item) =>
      sameTrackId(item.id, currentTrack.id)
    )
    if (currentIndex === -1) return

    const nextTrack = queue[currentIndex + 1]
    if (!nextTrack) return

    const savedProgress = getSavedProgress(nextTrack)

    setCurrentTrack(nextTrack)
    setCurrentTime(Number(savedProgress?.currentTime || 0))
    // Use saved duration first, will be updated by handleLoadedMetadata with actual file duration
    setDuration(Number(savedProgress?.duration || nextTrack.durationSeconds || 0))
    setPlaying(true)
  }, [currentTrack, queue, getSavedProgress])

  const playPrev = useCallback(() => {
    if (!currentTrack || queue.length === 0) return

    if (currentTime > 5) {
      seekToTime(0)
      return
    }


    const currentIndex = queue.findIndex((item) =>
      sameTrackId(item.id, currentTrack.id)
    )
    if (currentIndex <= 0) return

    const prevTrack = queue[currentIndex - 1]
    const savedProgress = getSavedProgress(prevTrack)

    setCurrentTrack(prevTrack)
    setCurrentTime(Number(savedProgress?.currentTime || 0))
    // Use saved duration first, will be updated by handleLoadedMetadata with actual file duration
    setDuration(Number(savedProgress?.duration || prevTrack.durationSeconds || 0))
    setPlaying(true)
  }, [currentTrack, queue, currentTime, seekToTime, getSavedProgress])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      // Prioritize actual audio.duration from file
      const nextDuration = Number(audio.duration || currentTrack?.durationSeconds || 0)
      setDuration(nextDuration)

      if (currentTrack?.id) {
        const savedProgress = getSavedProgress(currentTrack)
        const resumeTime = Number(savedProgress?.currentTime || 0)

        // Quan trọng: quay lại post cũ thì restore đúng thời điểm cũ
        if (resumeTime > 0 && Math.abs(audio.currentTime - resumeTime) > 0.3) {
          audio.currentTime = resumeTime
        }

        saveProgress(getTrackProgressKey(currentTrack), {
          duration: nextDuration,
          progressPercent: nextDuration
            ? ((resumeTime || 0) / nextDuration) * 100
            : 0,
        })
      }
    }

    const handleTimeUpdate = async () => {
      const currentTime = Number(audio.currentTime || 0)
      // Use actual audio.duration from file for accuracy
      const duration = Number(audio.duration || currentTrack?.durationSeconds || 0)

      setCurrentTime(currentTime)

      if (!currentTrack?.id) return

      const trackId = currentTrack.id
      const listenPostId = getCanonicalPostIdForEngagement(currentTrack) || trackId

      // save local progress
      saveProgress(getTrackProgressKey(currentTrack), {
        currentTime,
        duration,
        progressPercent: duration ? (currentTime / duration) * 100 : 0,
        hasPlayed: currentTime > 0,
      })

      // phải có duration hợp lệ
      if (!duration || duration <= 0) return

      const progressPercent = (currentTime / duration) * 100
      const now = Date.now()
      const lastUpdate = lastProgressUpdateRef.current[trackId] || 0
      const timeSinceLastUpdate = now - lastUpdate

      // Gọi API mỗi 10 giây để update progress realtime (throttle)
      // Hoặc nếu người dùng nghe được 50% để tính lượt nghe
      const shouldUpdate = timeSinceLastUpdate > 10000 || (progressPercent >= 50 && !trackedListenRef.current[trackId])

      if (!shouldUpdate) return

      lastProgressUpdateRef.current[trackId] = now

      // Nếu lần đầu tiên nghe được 50%, mark để không tính lượt nghe lại
      if (progressPercent >= 50 && !trackedListenRef.current[trackId]) {
        trackedListenRef.current[trackId] = true
      }

      try {
        const token = getToken()

        const response = await fetch(
          `${API_BASE_URL}/social/posts/${listenPostId}/listen/`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token
                ? {
                  Authorization: `Bearer ${token}`,
                }
                : {}),
            },
            body: JSON.stringify({
              progress_seconds: Math.floor(currentTime),
              duration_seconds: Math.floor(duration),
            }),
          }
        )

        const data = await response.json().catch(() => null)

        console.log('track_listen response:', response.status, data)

        if (!response.ok) {
          throw new Error(`Listen tracking failed: ${response.status}`)
        }
      } catch (error) {
        console.error('Track listen failed:', error)
      }
    }

    const handlePlay = () => setPlaying(true)
    const handlePause = () => setPlaying(false)

    const handleEnded = () => {
      if (currentTrack?.id) {
        saveProgress(getTrackProgressKey(currentTrack), {
          currentTime: duration,
          duration,
          progressPercent: 100,
          hasPlayed: true,
        })
      }

      const currentIndex = queue.findIndex((item) =>
        sameTrackId(item.id, currentTrack?.id)
      )
      const nextTrack = currentIndex >= 0 ? queue[currentIndex + 1] : null

      if (nextTrack) {
        const savedProgress = getSavedProgress(nextTrack)

        setCurrentTrack(nextTrack)
        setCurrentTime(Number(savedProgress?.currentTime || 0))
        setDuration(Number(savedProgress?.duration || nextTrack.durationSeconds || 0))
        setPlaying(true)
      } else {
        setPlaying(false)
      }
    }

    const handleError = () => {
      console.error('Audio load failed:', currentTrack?.audioUrl, audio.error)
      setPlaying(false)
    }

    const handleSeeked = () => {
      setIsSeeking(false)
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [queue, currentTrack, duration, getSavedProgress, saveProgress])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack?.audioUrl || currentTrack?.id == null) return

    const savedProgress = getSavedProgress(currentTrack)
    const resumeTime = Number(savedProgress?.currentTime || 0)

    audio.src = currentTrack.audioUrl
    audio.load()

    const handleLoaded = () => {
  const audioDuration =
    Number(audio.duration) ||
    Number(currentTrack?.durationSeconds) ||
    0

  const pendingPercent = pendingSeekPercentRef.current

  if (pendingPercent != null && audioDuration > 0) {
    const nextTime = Math.max(
      0,
      Math.min(audioDuration, (pendingPercent / 100) * audioDuration)
    )

    audio.currentTime = nextTime
    setCurrentTime(nextTime)

    saveProgress(getTrackProgressKey(currentTrack), {
      currentTime: nextTime,
      duration: audioDuration,
      progressPercent: pendingPercent,
      hasPlayed: nextTime > 0,
    })

    pendingSeekPercentRef.current = null
  } else if (resumeTime > 0 && Math.abs(audio.currentTime - resumeTime) > 0.3) {
    audio.currentTime = resumeTime
  }

  audio.play().catch((err) => {
        if (err.name === 'AbortError') {
          console.warn('Autoplay interrupted - audio element may have been removed from DOM')
        } else {
          console.error('Autoplay failed:', err)
        }
        setPlaying(false)
      })
    }

    audio.addEventListener('loadedmetadata', handleLoaded, { once: true })

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoaded)
    }
 }, [currentTrack, getSavedProgress, saveProgress])

  const progressPercent = duration
    ? Math.min(100, (currentTime / duration) * 100)
    : 0

  const value = useMemo(() => ({
    audioRef,
    queue,
    currentTrack,
    playing,
    currentTime,
    duration,
    volume,
    progressPercent,
    trackProgressMap,
    isSeeking,
    formattedCurrentTime: formatTime(currentTime),
    formattedDuration: formatTime(duration),
    setVolume,
    playTrack,
    togglePlay,
    pause,
    pauseTrackIfDeleted,
    seekToPercent,
    seekToTime,
    playNext,
    playPrev,
    getTrackProgressKey,
seekTrackToPercent,
    isCurrentTrack: (id) => sameTrackId(currentTrack?.id, id),
  }), [
    queue,
    currentTrack,
    playing,
    currentTime,
    duration,
    volume,
    progressPercent,
    trackProgressMap,
    playTrack,
    togglePlay,
    pause,
    pauseTrackIfDeleted,
    seekToPercent,
    seekToTime,
    playNext,
    playPrev,
    isSeeking,
  ])

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="metadata" />
    </AudioPlayerContext.Provider>
  )
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext)
  if (!context) {
    throw new Error('useAudioPlayer must be used within AudioPlayerProvider')
  }
  return context
}
