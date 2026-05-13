import i18n from './i18n'
export function formatDurationVi(seconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0))

  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60

  if (mins > 0 && secs > 0) {
    return i18n.t('duration.minutesSeconds', { mins, secs })
  }
  if (mins > 0) return i18n.t('duration.minutes', { count: mins })
  return i18n.t('duration.seconds', { count: secs })
}

export function formatDurationClock(seconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0))

  const mins = Math.floor(totalSeconds / 60)
  const secs = String(totalSeconds % 60).padStart(2, '0')

  return `${mins}:${secs}`
}

/**
 * Get actual audio duration from a URL by loading the audio
 * @param {string} audioUrl - The URL of the audio file
 * @returns {Promise<number>} - Duration in seconds, or 0 if failed
 */
export async function getAudioDuration(audioUrl) {
  if (!audioUrl) return 0

  return new Promise((resolve) => {
    const audio = new Audio()
    audio.src = audioUrl

    const handleLoadedMetadata = () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('error', handleError)
      resolve(Math.floor(audio.duration || 0))
    }

    const handleError = () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('error', handleError)
      resolve(0)
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('error', handleError)

    // Set timeout to prevent hanging if audio doesn't load
    setTimeout(() => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('error', handleError)
      resolve(0)
    }, 5000)
  })
}