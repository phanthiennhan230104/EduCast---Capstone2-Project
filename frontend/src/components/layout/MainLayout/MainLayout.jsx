import Header from '../Header/Header'
import Sidebar from '../Sidebar/Sidebar'
import RightPanel from '../RightPanel/RightPanel'
import AudioPlayer from '../AudioPlayer/AudioPlayer'
import styles from '../../../style/layout/MainLayout.module.css'

export default function MainLayout({
  children,
  rightPanel = true,
  hideGlobalProgress = false,
}) {
  const shouldShowRightPanel =
    rightPanel === true || (rightPanel && rightPanel !== false && rightPanel !== null)

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