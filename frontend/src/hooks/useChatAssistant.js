import { useCallback, useMemo, useState } from 'react'
import { sendAssistantMessage } from '../utils/aiServicesApi'
import { useTranslation } from 'react-i18next'

const INITIAL_ASSISTANT_MESSAGE = {
  id: 'assistant-welcome',
  role: 'assistant',
  content: {
    type: 'welcome',
    summary: 'Xin chào, mình là EduCast Assistant.',
    content: {
      title: 'Mình có thể giúp bạn',
      bullets: [
        'Tạo bài học tiếng Anh cho người mới bắt đầu',
        'Giải thích lập trình bằng ví dụ dễ hiểu',
        'Tạo nội dung kỹ năng mềm và lối sống',
        'Gợi ý bài tập sức khỏe an toàn cho người lớn tuổi',
        'Soạn script podcast giáo dục ngắn',
      ],
      description: '',
      body: '',
      hashtags: [],
    },
    suggestions: [
      'Tạo bài học tiếng Anh giao tiếp cho beginner',
      'Giải thích async await trong JavaScript',
      'Viết script podcast 2 phút về kỹ năng giao tiếp',
      'Gợi ý bài tập nhẹ cho người lớn tuổi',
    ],
  },
}

function normalizeContent(content) {
  if (typeof content === 'string') {
    return content.trim()
  }

  if (!content || typeof content !== 'object') {
    return ''
  }

  const summary = content.summary || ''
  const title = content?.content?.title || ''
  const description = content?.content?.description || ''
  const body = content?.content?.body || ''

  const bullets = Array.isArray(content?.content?.bullets)
    ? content.content.bullets.join('\n')
    : ''

  const posts = Array.isArray(content?.content?.posts)
    ? content.content.posts
        .map((post) => {
          const postTitle = post?.title || ''
          const postDescription = post?.description || ''
          const author = post?.author?.username
            ? `Tác giả: ${post.author.username}`
            : ''

          return [postTitle, postDescription, author]
            .filter(Boolean)
            .join('\n')
        })
        .join('\n\n')
    : ''

  return [summary, title, description, body, bullets, posts]
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

function buildHistoryPayload(messages) {
  return messages
    .filter(
      (message) =>
        message.role === 'user' || message.role === 'assistant',
    )
    .map((message) => ({
      role: message.role,
      content: normalizeContent(message.content),
    }))
    .filter((item) => item.content)
    .slice(-6)  // Giữ lại 6 tin nhắn gần nhất để tránh vượt quá limit token của Groq
}

export function useChatAssistant() {
  const [messages, setMessages] = useState([
    INITIAL_ASSISTANT_MESSAGE,
  ])

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const sendMessage = useCallback(
    async (rawMessage) => {
      const content = (rawMessage || '').trim()

      if (!content || isLoading) {
        return
      }

      const userMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
      }

      const historyPayload = buildHistoryPayload([
        ...messages,
        userMessage,
      ])

      setMessages((previousMessages) => [
        ...previousMessages,
        userMessage,
      ])

      setIsLoading(true)
      setError('')

      try {
        const response = await sendAssistantMessage({
          message: content,

          history: historyPayload,

          context: {
            tone: 'friendly, educational, practical',

            target_audience:
              'elderly adults, adult learners, english learners, programming students',

            format: 'assistant_response',

            length: 'medium',

            language: 'vi',
          },
        })

        const assistantPayload =
          response?.message ||
          response?.data?.message ||
          null

        const assistantMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',

          content:
            assistantPayload || {
              type: 'generate',
              intent: 'fallback',
              summary:
                'AI chưa thể tạo phản hồi phù hợp.',
              content: {
                title: '',
                description: '',
                body: 'Vui lòng thử lại.',
                bullets: [],
                hashtags: [],
              },
              suggestions: [],
            },
        }

        setMessages((previousMessages) => [
          ...previousMessages,
          assistantMessage,
        ])
      } catch (requestError) {
        console.error('Assistant request error:', requestError)

        const errorMessage =
          requestError?.response?.data?.detail ||
          requestError?.response?.data?.message ||
          requestError?.message ||
          'Không thể gửi tin nhắn tới AI Assistant.'

        setError(errorMessage)

        const assistantErrorMessage = {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: {
            type: 'error',
            summary: 'AI Assistant gặp lỗi',
            content: {
              title: 'Không thể xử lý yêu cầu',
              description: '',
              body: errorMessage,
              bullets: [],
              hashtags: [],
            },
            suggestions: [
              'Thử lại',
              'Viết ngắn gọn hơn',
              'Đổi chủ đề khác',
            ],
          },
        }

        setMessages((previousMessages) => [
          ...previousMessages,
          assistantErrorMessage,
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading],
  )

  const canSend = useMemo(
    () => !isLoading,
    [isLoading],
  )

  return {
    messages,
    isLoading,
    isSearching: false,  // Thêm property này (hiện chưa có logic search)
    error,
    canSend,
    sendMessage,
  }
}