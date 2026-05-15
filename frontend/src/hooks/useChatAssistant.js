import { useCallback, useEffect, useMemo, useState } from 'react'
import { sendAssistantMessage } from '../utils/aiServicesApi'
import { useTranslation } from 'react-i18next'

const buildInitialAssistantMessage = (t) => ({
  id: 'assistant-welcome',
  role: 'assistant',
  content: {
    type: 'welcome',
    summary: t('chatAssistant.welcome.summary'),
    content: {
      title: t('chatAssistant.welcome.title'),
      bullets: [
        t('chatAssistant.welcome.bullets.englishLesson'),
        t('chatAssistant.welcome.bullets.programming'),
        t('chatAssistant.welcome.bullets.softSkills'),
        t('chatAssistant.welcome.bullets.elderlyExercise'),
        t('chatAssistant.welcome.bullets.podcastScript'),
      ],
      description: '',
      body: '',
      hashtags: [],
    },
    suggestions: [
      t('chatAssistant.welcome.suggestions.englishConversation'),
      t('chatAssistant.welcome.suggestions.asyncAwait'),
      t('chatAssistant.welcome.suggestions.communicationPodcast'),
      t('chatAssistant.welcome.suggestions.elderlyExercise'),
    ],
  },
})

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
  ? `Author: ${post.author.username}`
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

function translateAssistantPayload(payload, t) {
  if (!payload || typeof payload !== 'object') {
    return payload
  }

  // Deep copy for translation
  const translated = {
    ...payload,
    content: payload.content ? { ...payload.content } : undefined,
  }

  if (translated.summary) {
    translated.summary = t(translated.summary)
  }

  if (translated.content) {
    if (translated.content.title) {
      translated.content.title = t(translated.content.title)
    }
    if (translated.content.description) {
      translated.content.description = t(translated.content.description)
    }
    if (translated.content.body) {
      translated.content.body = t(translated.content.body)
    }
    if (Array.isArray(translated.content.bullets)) {
      translated.content.bullets = translated.content.bullets.map((b) => t(b))
    }
  }

  if (Array.isArray(translated.suggestions)) {
    translated.suggestions = translated.suggestions.map((s) => t(s))
  }

  return translated
}

export function useChatAssistant() {
  const { t, i18n } = useTranslation()

  const [messages, setMessages] = useState(() => [
    buildInitialAssistantMessage(t),
  ])

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

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
            language: i18n.resolvedLanguage || i18n.language || 'vi',
          },
        })

        const assistantPayload =
          response?.message ||
          response?.data?.message ||
          null

        const assistantMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: assistantPayload
            ? translateAssistantPayload(assistantPayload, t)
            : {
                type: 'generate',
                intent: 'fallback',
                summary: t('chatAssistant.fallback.summary'),
                content: {
                  title: '',
                  description: '',
                  body: t('chatAssistant.fallback.body'),
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
          t('chatAssistant.error.sendFailed')

        setError(errorMessage)

        const assistantErrorMessage = {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: {
            type: 'error',
            summary: t('chatAssistant.error.summary'),
            content: {
              title: t('chatAssistant.error.title'),
              description: '',
              body: errorMessage,
              bullets: [],
              hashtags: [],
            },
            suggestions: [
              t('chatAssistant.error.suggestions.retry'),
              t('chatAssistant.error.suggestions.shorter'),
              t('chatAssistant.error.suggestions.changeTopic'),
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
    [isLoading, messages, t, i18n.resolvedLanguage, i18n.language],
  )

  const canSend = useMemo(
    () => !isLoading,
    [isLoading],
  )

  return {
    messages,
    isLoading,
    isSearching: false,
    error,
    canSend,
    sendMessage,
  }
}