export function formatDurationVi(seconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0))

  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60

  if (mins > 0 && secs > 0) return `${mins} phút ${secs} giây`
  if (mins > 0) return `${mins} phút`
  return `${secs} giây`
}

export function formatDurationClock(seconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0))

  const mins = Math.floor(totalSeconds / 60)
  const secs = String(totalSeconds % 60).padStart(2, '0')

  return `${mins}:${secs}`
}