import Header from '../Header/Header'
import Sidebar from '../Sidebar/Sidebar'
import RightPanel from '../RightPanel/RightPanel'
import AudioPlayer from '../AudioPlayer/AudioPlayer'
import styles from '../../../style/layout/MainLayout.module.css'

/**
 * MainLayout
 * Wraps any page with: Header, Sidebar, RightPanel, AudioPlayer.
 * Pass children as the main scrollable content (feed, library, etc.)
 */
export default function MainLayout({ children }) {
  return (
    <div className={styles.root}>
      <Header />
      <Sidebar />
      <main className={styles.main}>
        {children}
      </main>
      <RightPanel />
      <AudioPlayer />
    </div>
  )
}
