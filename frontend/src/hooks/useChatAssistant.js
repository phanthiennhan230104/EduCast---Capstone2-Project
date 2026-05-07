import { useCallback, useMemo, useState } from 'react'

import { sendAssistantMessage } from '../utils/aiServicesApi'

const INITIAL_ASSISTANT_MESSAGE = {
  id: 'assistant-welcome',
  role: 'assistant',
  content: {
    type: 'welcome',
    summary: 'Xin chào, mình là EduCast Assistant.',
    content: {
      title: 'Mình có thể giúp bạn',
      bullets: [
        'Gợi ý topic nội dung giáo dục',
        'Tạo dàn ý và bản nháp bài viết',
        'Viết lại nội dung cho dễ đọc hơn',
        'Đổi sang script podcast',
        'Tìm kiếm bài viết có sẵn trong feed',
      ],
      description: '',
      body: '',
      hashtags: [],
    },
    suggestions: [
      'Gợi ý 5 topic về học tiếng Anh',
      'Viết bài ngắn về Pomodoro',
      'Tìm bài viết về kỹ năng học tập trong feed',
      'Đổi nội dung này thành script podcast',
    ],
  },
}

const SEARCH_KEYWORDS = [
  'tìm',
  'tìm kiếm',
  'search',
  'bài viết',
  'post',
  'feed',
  'trong feed',
  'có sẵn',
  'đã đăng',
]

function isSearchRequest(message) {
  const normalizedMessage = (message || '').toLowerCase()
  return SEARCH_KEYWORDS.some((keyword) => normalizedMessage.includes(keyword))
}

function toHistoryText(content) {
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

          return [postTitle, postDescription, author].filter(Boolean).join('\n')
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
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role,
      content: toHistoryText(message.content),
    }))
    .filter((item) => item.content)
    .slice(-8)
}

export function useChatAssistant() {
  const [messages, setMessages] = useState([INITIAL_ASSISTANT_MESSAGE])
  const [isLoading, setIsLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
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

      const historyPayload = buildHistoryPayload(messages)
      const shouldSearch = isSearchRequest(content)

      setMessages((previousMessages) => [...previousMessages, userMessage])
      setIsLoading(true)
      setIsSearching(shouldSearch)
      setError('')

      try {
        const response = await sendAssistantMessage({
          message: content,
          history: historyPayload,
          context: {
            tone: 'friendly',
            target_audience: 'students and young professionals',
            format: shouldSearch ? 'feed_search' : 'feed_post',
            length: 'medium',
            language: 'vi',
          },
        })

        const assistantMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content:
            response?.message ||
            'Hệ thống chưa thể đưa ra phản hồi cho câu hỏi này.',
        }

        setMessages((previousMessages) => [
          ...previousMessages,
          assistantMessage,
        ])
      } catch (requestError) {
        const errorMessage =
          requestError?.response?.data?.detail ||
          requestError?.response?.data?.message ||
          requestError?.message ||
          'Không thể gửi tin nhắn tới AI Assistant.'

        setError(errorMessage)
      } finally {
        setIsLoading(false)
        setIsSearching(false)
      }
    },
    [isLoading, messages],
  )

  const canSend = useMemo(() => !isLoading, [isLoading])

  return {
    messages,
    isLoading,
    isSearching,
    error,
    canSend,
    sendMessage,
  }
}