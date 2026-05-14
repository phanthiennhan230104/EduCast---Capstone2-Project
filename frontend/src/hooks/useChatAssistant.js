import { useCallback, useEffect, useMemo, useState } from 'react'
import { sendAssistantMessage } from '../utils/aiServicesApi'
import { useTranslation } from 'react-i18next'

function buildInitialAssistantMessage(t) {
  return {
    id: 'assistant-welcome',
    role: 'assistant',
    content: {
      type: 'welcome',
      summary: t('assistant.welcome.summary'),
      content: {
        title: t('assistant.welcome.title'),
        bullets: [
          t('assistant.welcome.bullets.englishLesson'),
          t('assistant.welcome.bullets.programmingExplain'),
          t('assistant.welcome.bullets.softSkills'),
          t('assistant.welcome.bullets.elderExercise'),
          t('assistant.welcome.bullets.podcastScript'),
        ],
        description: '',
        body: '',
        hashtags: [],
      },
      suggestions: [
        t('assistant.welcome.suggestions.englishLesson'),
        t('assistant.welcome.suggestions.asyncAwait'),
        t('assistant.welcome.suggestions.communicationPodcast'),
        t('assistant.welcome.suggestions.elderExercise'),
      ],
    },
  }
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
  const { t, i18n } = useTranslation()

  const [messages, setMessages] = useState(() => [
    buildInitialAssistantMessage(t),
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

            language: (i18n.resolvedLanguage || i18n.language || 'vi').split('-')[0],
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
              summary: t('assistant.fallback.summary'),
              content: {
                title: '',
                description: '',
                body: t('assistant.fallback.body'),
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
          t('assistant.error.sendFailed')

        setError(errorMessage)

        const assistantErrorMessage = {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: {
            type: 'error',
            summary: t('assistant.error.summary'),
            content: {
              title: t('assistant.error.title'),
              description: '',
              body: errorMessage,
              bullets: [],
              hashtags: [],
            },
            suggestions: [
              t('assistant.error.suggestions.retry'),
              t('assistant.error.suggestions.shorten'),
              t('assistant.error.suggestions.changeTopic'),
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
    [isLoading, messages, t, i18n.language, i18n.resolvedLanguage],
  )

  return {
    messages,
    isLoading,
    isSearching: false,  // Thêm property này (hiện chưa có logic search)
    error,
    canSend,
    sendMessage,
  }
  useEffect(() => {
    setMessages((previousMessages) => {
      if (previousMessages.length === 0) {
        return [buildInitialAssistantMessage(t)]
      }

      if (previousMessages[0]?.id !== 'assistant-welcome') {
        return previousMessages
      }

      return [
        buildInitialAssistantMessage(t),
        ...previousMessages.slice(1),
      ]
    })
  }, [t, i18n.language])
}