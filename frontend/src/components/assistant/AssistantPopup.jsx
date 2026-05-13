import { Bot } from 'lucide-react'
import AssistantChatBox from './AssistantChatBox'
import { useTranslation } from 'react-i18next'
import styles from '../../style/assistant/AssistantWidget.module.css'

export default function AssistantPopup({ anchorPosition, onClose }) {
  const { t } = useTranslation()
  const popupStyle = getPopupPosition(anchorPosition)

  return (
    <div className={styles.popup} style={popupStyle}>
      <div className={styles.popupHeader}>
        <div className={styles.popupTitle}>
          <div className={styles.popupIcon}>
            <Bot size={18} />
          </div>
          <div>
            <strong>{t('assistant.title')}</strong>
<p>{t('assistant.popupSubtitle')}</p>
          </div>
        </div>

        <button type="button" className={styles.closeBtn} onClick={onClose}>
          ×
        </button>
      </div>

      <AssistantChatBox />
    </div>
  )
}

function getPopupPosition(anchorPosition) {
  const popupWidth = 380
  const popupHeight = 520
  const spacing = 14

  let left = anchorPosition.x - popupWidth + 64
  let top = anchorPosition.y - popupHeight - spacing

  if (left < 12) left = 12
  if (top < 12) top = 12

  const maxLeft = window.innerWidth - popupWidth - 12
  const maxTop = window.innerHeight - popupHeight - 12

  return {
    left: Math.min(left, maxLeft),
    top: Math.min(top, maxTop),
  }
}