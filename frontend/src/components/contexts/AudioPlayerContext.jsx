import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

const AudioPlayerContext = createContext(null)

function formatTime(seconds) {
  const total = Math.floor(Number(seconds || 0))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function AudioPlayerProvider({ children }) {
  const progressRef = useRef({})
  const audioRef = useRef(null)

  const [queue, setQueue] = useState([])
  const [currentTrack, setCurrentTrack] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(80)
  const [trackProgressMap, setTrackProgressMap] = useState({})
  const [isSeeking, setIsSeeking] = useState(false)

  useEffect(() => {
    const savedProgress = localStorage.getItem('audioPlayerProgress')
    if (savedProgress) {
      try {
        progressRef.current = JSON.parse(savedProgress)
        setTrackProgressMap(progressRef.current)
      } catch (err) {
        console.error('Failed to load progress from localStorage:', err)
      }
    }
  }, [])

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
      localStorage.setItem('audioPlayerProgress', JSON.stringify(progressRef.current))
    } catch (err) {
      console.error('Failed to save progress to localStorage:', err)
    }
  }, [])

  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = volume / 100
  }, [volume])

  const trackedListenRef = useRef({})

  const playTrack = useCallback((track, trackQueue = []) => {
    if (!track?.audioUrl) return

    trackedListenRef.current[track.id] = false

    setQueue(trackQueue.length ? trackQueue : [track])

    const savedProgress = getSavedProgress(track)
    const resumeTime = Number(savedProgress?.currentTime || 0)
    const nextDuration = Number(savedProgress?.duration || track.durationSeconds || 0)

    setCurrentTrack(track)
    setCurrentTime(resumeTime)
    setDuration(nextDuration)
    setPlaying(true)

    const audio = audioRef.current
    if (audio) {
      if (Math.abs(audio.currentTime - resumeTime) > 0.3) {
        audio.currentTime = resumeTime
      }
      audio.play().catch((err) => {
        console.error('Play failed:', err)
      })
    }
  }, [getSavedProgress])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack?.audioUrl) return

    if (audio.paused) {
      audio.play().catch((err) => {
        console.error('Play failed:', err)
      })
    } else {
      audio.pause()
    }
  }, [currentTrack])

  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const seekToPercent = useCallback((percent) => {
    const audio = audioRef.current
    if (!audio || !duration || !currentTrack?.id) return

    setIsSeeking(true)
    const nextTime = (Number(percent) / 100) * duration
    audio.currentTime = nextTime
    setCurrentTime(nextTime)

    saveProgress(currentTrack.id, {
      currentTime: nextTime,
      duration,
      progressPercent: Number(percent),
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
    setDuration(Number(savedProgress?.duration || prevTrack.durationSeconds || 0))
    setPlaying(true)
  }, [currentTrack, queue, currentTime, seekToTime, getSavedProgress])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
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

    const handleTimeUpdate = () => {
      const nextCurrentTime = Number(audio.currentTime || 0)
      const nextDuration = Number(audio.duration || currentTrack?.durationSeconds || 0)

      setCurrentTime(nextCurrentTime)

      if (currentTrack?.id) {
        saveProgress(currentTrack.id, {
          currentTime: nextCurrentTime,
          duration: nextDuration,
          progressPercent: nextDuration ? (nextCurrentTime / nextDuration) * 100 : 0,
          hasPlayed: nextCurrentTime > 0,
        })

        if (
          currentTrack?.id &&
          nextCurrentTime >= 10 &&
          !trackedListenRef.current[currentTrack.id]
        ) {
          trackedListenRef.current[currentTrack.id] = true

          const token = localStorage.getItem('educast_access')

          fetch(`http://localhost:8000/api/social/posts/${currentTrack.id}/listen/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              progress_seconds: Math.floor(nextCurrentTime),
              duration_seconds: Math.floor(nextDuration || 0),
            }),
          })
            .then(async (res) => {
              const data = await res.json().catch(() => null)
              console.log('track_listen response:', res.status, data)

              if (!res.ok) {
                trackedListenRef.current[currentTrack.id] = false
                throw new Error(`Track listen failed with status ${res.status}`)
              }
            })
            .catch((err) => {
              console.error('Track listen failed:', err)
              trackedListenRef.current[currentTrack.id] = false
            })
          }
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
          console.error('Autoplay failed:', err)
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
    formattedCurrentTime: formatTime(currentTime),
    formattedDuration: formatTime(duration),
    setVolume,
    playTrack,
    togglePlay,
    pause,
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