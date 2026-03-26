import { UserPlus, Bell } from 'lucide-react'
import styles from '../../style/community/CommunityRightPanel.module.css'

const FOLLOWING = [
  { id: 1, name: 'Bạch Thiên', desc: 'Ngoại ngữ', count: '29 người theo dõi' },
  { id: 2, name: 'Trâm', desc: 'Lập trình', count: '12 người theo dõi' },
  { id: 3, name: 'Tin', desc: 'Tâm lý học', count: '20 người theo dõi' },
  { id: 4, name: 'Hoàng', desc: 'Tâm lý học', count: '24 người theo dõi' },
  { id: 5, name: 'Nhân', desc: 'Ngoại ngữ', count: '23 người theo dõi' },
]

const SUGGESTIONS = [
  { id: 1, name: 'YongBGTik', desc: 'Lập trình' },
  { id: 2, name: 'Nuzzc', desc: 'Tâm lý học' },
  { id: 3, name: 'LittleBoiz', desc: 'Tâm lý học' },
]

const ACTIVITIES = [
  { id: 1, text: 'Tin vừa đăng podcast mới', time: '24 phút trước' },
  { id: 2, text: 'Bạch Thiên thích bài của Nhân', time: '25 phút trước' },
]

export default function CommunityRightPanel() {
  return (
    <aside className={styles.panel}>      
      {/* ĐANG THEO DÕI */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <span>Đang theo dõi</span>
          <span className={styles.count}>12</span>
        </div>

        {FOLLOWING.map(item => (
          <div key={item.id} className={styles.userRow}>
            <div className={styles.avatar} />

            <div className={styles.userInfo}>
              <div className={styles.name}>{item.name}</div>
              <div className={styles.meta}>{item.count}</div>
            </div>

            <button className={styles.followingBtn}>Đang theo dõi</button>
          </div>
        ))}

        <button className={styles.viewMore}>
          Xem tất cả 12 người →
        </button>
      </div>

      {/* GỢI Ý */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <UserPlus size={16} />
          Gợi ý theo dõi
        </div>

        {SUGGESTIONS.map(item => (
          <div key={item.id} className={styles.userRow}>
            <div className={styles.avatar} />

            <div className={styles.userInfo}>
              <div className={styles.name}>{item.name}</div>
              <div className={styles.meta}>{item.desc}</div>
            </div>

            <button className={styles.followBtn}>+ Theo dõi</button>
          </div>
        ))}
      </div>

      {/* HOẠT ĐỘNG */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <Bell size={16} />
          Hoạt động gần đây
        </div>

        {ACTIVITIES.map(item => (
          <div key={item.id} className={styles.activityRow}>
            <div className={styles.dot} />
            <div>
              <div className={styles.activityText}>{item.text}</div>
              <div className={styles.activityTime}>{item.time}</div>
            </div>
          </div>
        ))}
      </div>

    </aside>
  )
}