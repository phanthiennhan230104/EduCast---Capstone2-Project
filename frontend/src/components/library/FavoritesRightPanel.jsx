import { Headphones, StickyNote, Bookmark, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from '../../style/library/FavoritesRightPanel.module.css'

// Thành:
const RECENT_LISTENS = [
  {
    titleKey: 'library.rightPanel.recentListensItems.neuralNetwork.title',
    subKey: 'library.rightPanel.recentListensItems.neuralNetwork.sub',
    time: '3:05',
  },
  {
    titleKey: 'library.rightPanel.recentListensItems.dunningKruger.title',
    subKey: 'library.rightPanel.recentListensItems.dunningKruger.sub',
    time: '4:05',
  },
  {
    titleKey: 'library.rightPanel.recentListensItems.ieltsSpeaking.title',
    subKey: 'library.rightPanel.recentListensItems.ieltsSpeaking.sub',
    time: '3:20',
  },
  {
    titleKey: 'library.rightPanel.recentListensItems.budgetRule.title',
    subKey: 'library.rightPanel.recentListensItems.budgetRule.sub',
    time: '3:14',
  },
]

// Thành:
const HIGHLIGHT_NOTES = [
  {
    tagKey: 'library.rightPanel.highlightNotesItems.neuralNetwork.tag',
    textKey: 'library.rightPanel.highlightNotesItems.neuralNetwork.text',
  },
  {
    tagKey: 'library.rightPanel.highlightNotesItems.psychology.tag',
    textKey: 'library.rightPanel.highlightNotesItems.psychology.text',
  },
  {
    tagKey: 'library.rightPanel.highlightNotesItems.finance.tag',
    textKey: 'library.rightPanel.highlightNotesItems.finance.text',
  },
]

// Thành:
const SUGGESTED_LIBRARY = [
  {
    titleKey: 'library.rightPanel.suggestedItems.habitStacking.title',
    subKey: 'library.rightPanel.suggestedItems.habitStacking.sub',
  },
  {
    titleKey: 'library.rightPanel.suggestedItems.djangoRest.title',
    subKey: 'library.rightPanel.suggestedItems.djangoRest.sub',
  },
  {
    titleKey: 'library.rightPanel.suggestedItems.leanStartup.title',
    subKey: 'library.rightPanel.suggestedItems.leanStartup.sub',
  },
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
            <button key={item.titleKey} type="button" className={styles.itemButton}>
              <div className={styles.item}>
                <div className={styles.thumb}>
                  <Headphones size={14} />
                </div>

                <div className={styles.info}>

                  <div className={styles.itemTitle}>{t(item.titleKey)}</div>
                  <div className={styles.itemSub}>{t(item.subKey)}</div>
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

            <button key={item.tagKey} type="button" className={styles.noteButton}>
              <div className={styles.noteCard}>
                <span className={styles.noteTag}>{t(item.tagKey)}</span>
                <p className={styles.noteText}>{t(item.textKey)}</p>
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
            <div key={item.titleKey} className={styles.item}>
              <div className={styles.thumbAlt}>
                <Bookmark size={13} />
              </div>

              <div className={styles.info}>
                <div className={styles.itemTitle}>{t(item.titleKey)}</div>
                <div className={styles.itemSub}>{t(item.subKey)}</div>
              </div>

              <button type="button" className={styles.addBtn}
                aria-label={t('library.rightPanel.addToLibrary', { title: t(item.titleKey) })}>
                <Plus size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
