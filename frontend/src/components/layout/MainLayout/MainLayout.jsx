import Header from '../Header/Header'
import Sidebar from '../Sidebar/Sidebar'
import RightPanel from '../RightPanel/RightPanel'
import AudioPlayer from '../AudioPlayer/AudioPlayer'
import styles from '../../../style/layout/MainLayout.module.css'

export default function MainLayout({ children, rightPanel }) {
  return (
    <div className={styles.layout}>
      <Header />
      <Sidebar />

      <main className={styles.main}>
        {children}
      </main>
      {/* Nếu page không truyền rightPanel riêng thì dùng default (RightPanel) */}
      {rightPanel ?? <RightPanel />}
      <AudioPlayer />
    </div>
  )
}