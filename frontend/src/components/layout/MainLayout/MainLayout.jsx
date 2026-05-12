import Header from '../Header/Header'
import Sidebar from '../Sidebar/Sidebar'
import RightPanel from '../RightPanel/RightPanel'
import AudioPlayer from '../AudioPlayer/AudioPlayer'
import styles from '../../../style/layout/MainLayout.module.css'
import { useContext, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { PodcastContext } from '../../contexts/PodcastContext'
import { useAudioPlayer } from '../../contexts/AudioPlayerContext'


export default function MainLayout({
  children,
  rightPanel = true,
  hideGlobalProgress = false,
}) {
  const shouldShowRightPanel =
    rightPanel === true || (rightPanel && rightPanel !== false && rightPanel !== null)
  
  const location = useLocation()
  const { deletedPostIds, hiddenPostIds } = useContext(PodcastContext)
  const { currentTrack, pauseTrackIfDeleted } = useAudioPlayer()
  const scrollStorageKey = `mainScroll:${location.pathname}`

  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return

    const saveScrollPosition = () => {
      sessionStorage.setItem(scrollStorageKey, String(main.scrollTop || 0))
    }

    // Không gọi save ngay khi mount: lúc đó scroll thường vẫn 0 và sẽ ghi đè
    // giá trị đã lưu (ví dụ quay lại từ /favorites) trước khi Feed khôi phục scroll.
    main.addEventListener('scroll', saveScrollPosition, { passive: true })

    return () => {
      // Không ghi scroll khi unmount: con (Feed, Favorites, …) đã unmount trước,
      // `main` thường trống / scrollTop = 0 và sẽ ghi đè giá trị đúng vừa lưu.
      main.removeEventListener('scroll', saveScrollPosition)
    }
  }, [scrollStorageKey])

  // Pause track if it gets deleted or hidden
  useEffect(() => {
    if (currentTrack?.id) {
      const trackId = String(currentTrack.id)
      const deletedArray = Array.from(deletedPostIds)
      const hiddenArray = Array.from(hiddenPostIds)
      const isDeleted = deletedArray.some(id => String(id) === trackId)
      const isHidden = hiddenArray.some(id => String(id) === trackId)
      
      console.log('🎵 [MainLayout] Effect fired:', {
        trackId,
        currentTrackType: typeof currentTrack?.id,
        deletedCount: deletedArray.length,
        hiddenCount: hiddenArray.length,
        isDeleted,
        isHidden,
        deletedArray,
        hiddenArray
      })
      
      if (isDeleted || isHidden) {
        console.log('🎵 [MainLayout] Detected deleted/hidden, calling pauseTrackIfDeleted')
        pauseTrackIfDeleted(currentTrack.id)
      }
    }
  }, [currentTrack?.id, deletedPostIds, hiddenPostIds, pauseTrackIfDeleted])

  return (
    <div className={styles.layout}>
      <Header hideGlobalProgress={hideGlobalProgress} />
      <Sidebar />

      <main className={`${styles.main} ${!shouldShowRightPanel ? styles.mainExpanded : ''}`}>
        {children}
      </main>

      {shouldShowRightPanel && (rightPanel === true ? <RightPanel /> : rightPanel)}
      {!hideGlobalProgress && <AudioPlayer />}
    </div>
  )
}