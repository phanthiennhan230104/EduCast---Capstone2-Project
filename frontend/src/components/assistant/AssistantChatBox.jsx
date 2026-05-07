import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, SendHorizonal } from 'lucide-react'
import { useChatAssistant } from '../../hooks/useChatAssistant'
import AssistantMessage from './AssistantMessage'
import styles from '../../style/assistant/AssistantWidget.module.css'

export default function AssistantChatBox() {
  const [inputValue, setInputValue] = useState('')
  const {
    messages,
    isLoading,
    isSearching,
    error,
    canSend,
    sendMessage,
  } = useChatAssistant()
  const bodyRef = useRef(null)

  useEffect(() => {
    if (!bodyRef.current) {
      return
    }

    bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [messages, isLoading, isSearching, error])

  const handleSubmit = async (event) => {
    event.preventDefault()

    const submittedValue = inputValue.trim()
    if (!submittedValue || !canSend) {
      return
    }

    setInputValue('')
    await sendMessage(submittedValue)
  }

  const handleQuickAction = async (value) => {
    const submittedValue = (value || '').trim()

    if (!submittedValue || !canSend) {
      return
    }

    setInputValue('')
    await sendMessage(submittedValue)
  }

  const loadingText = isSearching
    ? 'EduCast Assistant đang tìm bài viết trong feed...'
    : 'EduCast Assistant đang suy nghĩ...'

  return (
    <>
      <div ref={bodyRef} className={styles.popupBody}>
        {messages.map((message) => (
          <AssistantMessage
            key={message.id}
            message={message}
            onQuickAction={handleQuickAction}
          />
        ))}

        {isLoading && (
          <div
            className={`${styles.message} ${styles.assistantMessage} ${styles.loadingMessage}`}
          >
            <LoaderCircle size={16} className={styles.loadingIcon} />
            <span>{loadingText}</span>
          </div>
        )}

        {error && <div className={styles.errorMessage}>{error}</div>}
      </div>

      <form className={styles.popupFooter} onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Nhập yêu cầu viết bài hoặc tìm nội dung..."
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          disabled={isLoading}
        />

        <button type="submit" disabled={!canSend || !inputValue.trim()}>
          <SendHorizonal size={16} />
        </button>
      </form>
    </>
  )
}