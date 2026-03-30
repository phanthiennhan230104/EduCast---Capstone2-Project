import Header from '../Header/Header'
import Sidebar from '../Sidebar/Sidebar'
import RightPanel from '../RightPanel/RightPanel'
import AudioPlayer from '../AudioPlayer/AudioPlayer'
import styles from '../../../style/layout/MainLayout.module.css'

export default function MainLayout({ children, rightPanel = true }) {
  // rightPanel = true: show default RightPanel
  // rightPanel = false or null: không show RightPanel, main mở rộng
  const shouldShowRightPanel = rightPanel === true || (rightPanel && rightPanel !== false && rightPanel !== null)
  
  return (
    <div className={styles.layout}>
      <Header />
      <Sidebar />

      <main className={`${styles.main} ${!shouldShowRightPanel ? styles.mainExpanded : ''}`}>
        {children}
      </main>
      {/* Chỉ render RightPanel nếu rightPanel === true hoặc rightPanel là component */}
      {shouldShowRightPanel && (rightPanel === true ? <RightPanel /> : rightPanel)}
      <AudioPlayer />
    </div>
  )
}