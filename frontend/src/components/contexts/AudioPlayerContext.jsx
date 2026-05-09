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

const AudioPlayerContext = createContext(null)

function formatTime(seconds) {
  const total = Math.floor(Number(seconds || 0))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
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
    if (!track?.id) return null
    return progressRef.current[track.id] || null
  }, [])

  const saveProgress = useCallback((trackId, data) => {
    if (!trackId) return

    progressRef.current[trackId] = {
      ...(progressRef.current[trackId] || {}),
      ...data,
    }

    setTrackProgressMap((prev) => ({
      ...prev,
      [trackId]: progressRef.current[trackId],
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

  const trackedListenRef = useRef({})
  const lastProgressUpdateRef = useRef({}) // Track last update time for throttling

  const playTrack = useCallback((track, trackQueue = []) => {
    if (!track?.audioUrl) return

    const audio = audioRef.current
    if (!audio) {
      console.warn('Audio element not found in DOM')
      return
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

    if (audio) {
      if (Math.abs(audio.currentTime - resumeTime) > 0.3) {
        audio.currentTime = resumeTime
      }
      
      // Add a small delay to ensure audio element is ready
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().catch((err) => {
            if (err.name === 'AbortError') {
              console.warn('Play interrupted - audio element may have been removed from DOM')
            } else {
              console.error('Play failed:', err)
            }
          })
        }
      }, 50)
    }
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

    saveProgress(currentTrack.id, {
      currentTime: nextTime,
      duration: audioDuration,
      progressPercent: (nextTime / audioDuration) * 100,
      hasPlayed: nextTime > 0,
    })
  }, [duration, currentTrack, saveProgress])

  const seekToTime = useCallback((time) => {
    const audio = audioRef.current
    if (!audio || !currentTrack?.id) return

    const nextTime = Number(time || 0)
    audio.currentTime = nextTime
    setCurrentTime(nextTime)

    saveProgress(currentTrack.id, {
      currentTime: nextTime,
      duration,
      progressPercent: duration ? (nextTime / duration) * 100 : 0,
      hasPlayed: nextTime > 0,
    })
  }, [currentTrack, duration, saveProgress])

  const playNext = useCallback(() => {
    if (!currentTrack || queue.length === 0) return

    const currentIndex = queue.findIndex((item) => item.id === currentTrack.id)
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

    
    const currentIndex = queue.findIndex((item) => item.id === currentTrack.id)
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

        saveProgress(currentTrack.id, {
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

      // save local progress
      saveProgress(trackId, {
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
        const token = localStorage.getItem('educast_access')

        const response = await fetch(
          `http://localhost:8000/api/social/posts/${trackId}/listen/`,
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
        saveProgress(currentTrack.id, {
          currentTime: duration,
          duration,
          progressPercent: 100,
          hasPlayed: true,
        })
      }

      const currentIndex = queue.findIndex((item) => item.id === currentTrack?.id)
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
    if (!audio || !currentTrack?.audioUrl) return

    const savedProgress = getSavedProgress(currentTrack)
    const resumeTime = Number(savedProgress?.currentTime || 0)

    audio.src = currentTrack.audioUrl
    audio.load()

    const handleLoaded = () => {
      if (resumeTime > 0 && Math.abs(audio.currentTime - resumeTime) > 0.3) {
        audio.currentTime = resumeTime
      }

      if (playing) {
        audio.play().catch((err) => {
          if (err.name === 'AbortError') {
            console.warn('Autoplay interrupted - audio element may have been removed from DOM')
          } else {
            console.error('Autoplay failed:', err)
          }
          setPlaying(false)
        })
      }
    }

    audio.addEventListener('loadedmetadata', handleLoaded, { once: true })

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoaded)
    }
  }, [currentTrack, playing, getSavedProgress])

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
    isCurrentTrack: (id) => currentTrack?.id === id,
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