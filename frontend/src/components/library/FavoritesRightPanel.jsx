import { Headphones, StickyNote, Bookmark, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from '../../style/library/FavoritesRightPanel.module.css'

const RECENT_LISTENS = [
  { title: 'Neural Network từ A–Z', sub: 'Lê Thị Thanh Trâm', time: '3:05' },
  { title: 'Hiệu ứng Dunning–Kruger', sub: 'Phát Triển Bản Thân', time: '4:05' },
  { title: 'IELTS Speaking Part 2', sub: 'Bách Thiên', time: '3:20' },
  { title: 'Quy tắc 50-30-20', sub: 'Đức Minh Finance', time: '3:14' },
]

const HIGHLIGHT_NOTES = [
  {
    tag: 'NEURAL NETWORK',
    text: '“Backpropagation là quá trình tính gradient ngược từ output về input...”',
  },
  {
    tag: 'TÂM LÝ HỌC',
    text: '“Giữ thói quen nhìn lại giả định cũ để giảm tự tin ảo...”',
  },
  {
    tag: 'TÀI CHÍNH',
    text: '“50% nhu cầu thiết yếu, 30% mong muốn, 20% tiết kiệm...”',
  },
]

const SUGGESTED_LIBRARY = [
  { title: 'Habit Stacking: Xây thói quen bền vững', sub: '2:15 • Tâm lý học' },
  { title: 'Django REST Framework', sub: '2:30 • Lập trình' },
  { title: 'Lean Startup', sub: '3:15 • Startup' },
]

function TitleWithIcon({ icon, children }) {
  return (
    <h4 className={styles.widgetTitle}>
      <span className={styles.titleIcon}>{icon}</span>
      <span>{children}</span>
    </h4>
  )
}

export default function LibraryRightPanel() {
  const { t } = useTranslation()
  return (
    <aside className={styles.panel}>
      <div className={styles.widget}>
        <TitleWithIcon icon={<Headphones size={15} />}>
          {t('library.rightPanel.recentListens')}
        </TitleWithIcon>

        <div className={styles.list}>
          {RECENT_LISTENS.map((item) => (
            <button key={item.title} type="button" className={styles.itemButton}>
              <div className={styles.item}>
                <div className={styles.thumb}>
                  <Headphones size={14} />
                </div>

                <div className={styles.info}>
                  <div className={styles.itemTitle}>{item.title}</div>
                  <div className={styles.itemSub}>{item.sub}</div>
                </div>

                <span className={styles.time}>{item.time}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.widget}>
        <TitleWithIcon icon={<StickyNote size={15} />}>
          {t('library.rightPanel.highlightNotes')}
        </TitleWithIcon>

        <div className={styles.noteList}>
          {HIGHLIGHT_NOTES.map((item) => (
            <button key={item.tag} type="button" className={styles.noteButton}>
              <div className={styles.noteCard}>
                <span className={styles.noteTag}>{item.tag}</span>
                <p className={styles.noteText}>{item.text}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.widget}>
        <TitleWithIcon icon={<Bookmark size={15} />}>
          {t('library.rightPanel.suggestedLibrary')}
        </TitleWithIcon>

        <div className={styles.list}>
          {SUGGESTED_LIBRARY.map((item) => (
            <div key={item.title} className={styles.item}>
              <div className={styles.thumbAlt}>
                <Bookmark size={13} />
              </div>

              <div className={styles.info}>
                <div className={styles.itemTitle}>{item.title}</div>
                <div className={styles.itemSub}>{item.sub}</div>
              </div>

              <button type="button" className={styles.addBtn} aria-label={t('library.rightPanel.addToLibrary', { title: item.title })}>
                <Plus size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
