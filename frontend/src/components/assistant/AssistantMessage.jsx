import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from '../../style/assistant/AssistantWidget.module.css'
import { useTranslation } from 'react-i18next'


function renderPlainText(text) {
  return String(text || '')
    .split('\n')
    .filter(Boolean)
    .map((line, index) => (
      <p key={index} className={styles.messageParagraph}>
        {line}
      </p>
    ))
}

function getPostAuthor(post, t) {
  return (
    post?.author?.username ||
    post?.author ||
    post?.user?.username ||
    t('assistant.unknownAuthor')
  )
}

function getPostTags(post) {
  if (Array.isArray(post?.hashtags)) {
    return post.hashtags
  }

  if (Array.isArray(post?.tags)) {
    return post.tags
  }

  return []
}

export default function AssistantMessage({ message, onQuickAction }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [previewPost, setPreviewPost] = useState(null)
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className={`${styles.message} ${styles.userMessage}`}>
        {renderPlainText(message.content)}
      </div>
    )
  }

  const payload = message.content

  if (!payload || typeof payload === 'string') {
    return (
      <div className={`${styles.message} ${styles.assistantMessage}`}>
        {renderPlainText(payload)}
      </div>
    )
  }

  const content = payload.content || {}
  const isSearchResult = payload.type === 'search_result'
  const posts = Array.isArray(content.posts) ? content.posts : []

  return (
    <>
      <div
        className={`${styles.message} ${styles.assistantMessage} ${styles.richMessage}`}
      >
        {payload.summary && (
          <div className={styles.messageSummary}>{payload.summary}</div>
        )}

        {!isSearchResult && content.title && (
          <h4 className={styles.generatedTitle}>{content.title}</h4>
        )}

        {!isSearchResult && content.description && (
          <p className={styles.generatedDescription}>{content.description}</p>
        )}

        {!isSearchResult && content.body && (
          <div className={styles.generatedBody}>
            {renderPlainText(content.body)}
          </div>
        )}

        {!isSearchResult &&
          Array.isArray(content.bullets) &&
          content.bullets.length > 0 && (
            <ul className={styles.generatedList}>
              {content.bullets.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          )}

        {!isSearchResult &&
          Array.isArray(content.hashtags) &&
          content.hashtags.length > 0 && (
            <div className={styles.tagGroup}>
              {content.hashtags.map((tag, index) => (
                <span key={`${tag}-${index}`} className={styles.tagChip}>
                  {String(tag).startsWith('#') ? tag : `#${tag}`}
                </span>
              ))}
            </div>
          )}

        {!isSearchResult && payload.type !== 'error' && content.body && (
          <button
            type="button"
            className={styles.createPodcastFromAiBtn}
            onClick={() => {
              const parts = []
              if (content.title) parts.push(content.title)
              if (content.description) parts.push(content.description)
              if (content.body) parts.push(content.body)
              if (Array.isArray(content.bullets) && content.bullets.length > 0) {
                parts.push(content.bullets.map((b) => `- ${b}`).join('\n'))
              }
              navigate('/create-audio', { state: { initialText: parts.join('\n\n') } })
            }}
          >
            {t('assistant.createPodcastFromThis', { defaultValue: 'Tạo podcast từ nội dung này' })}
          </button>
        )}

        {posts.length > 0 && (
          <div className={styles.searchResultList}>
            {posts.map((post) => {
              const tags = getPostTags(post)

              return (
                <button
                  key={post.id}
                  type="button"
                  className={styles.searchResultCard}
                  onClick={() => setPreviewPost(post)}
                >
                  <div className={styles.searchResultHeader}>
                    <h5 className={styles.postTitle}>{post.title}</h5>
                    <span className={styles.viewPostText}>{t('assistant.viewPost')}</span>
                  </div>

                  {post.description && (
                    <p className={styles.postDescription}>{post.description}</p>
                  )}

                  <div className={styles.postMeta}>
                    <span className={styles.postAuthor}>
                      {t('assistant.author')}: {getPostAuthor(post, t)}
                    </span>

                    {tags.length > 0 && (
                      <div className={styles.postTags}>
                        {tags.map((tag, index) => {
                          const tagStr = typeof tag === 'object' ? (tag.name || tag.slug || '') : String(tag);
                          return (
                            <span key={`${tag.id || index}`} className={styles.tagChip}>
                              {tagStr.startsWith('#') ? tagStr : `#${tagStr}`}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {Array.isArray(payload.suggestions) && payload.suggestions.length > 0 && (
          <div className={styles.quickActions}>
            {payload.suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion}-${index}`}
                type="button"
                className={styles.quickActionBtn}
                onClick={() => onQuickAction(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {previewPost && (
        <div
          className={styles.postPreviewOverlay}
          onClick={() => setPreviewPost(null)}
        >
          <div
            className={styles.postPreviewModal}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.postPreviewHeader}>
              <div>
                <h3>{previewPost.title}</h3>
                <span>{t('assistant.author')}: {getPostAuthor(previewPost, t)}</span>
              </div>

              <button
                type="button"
                className={styles.postPreviewCloseBtn}
                onClick={() => setPreviewPost(null)}
              >
                ×
              </button>
            </div>

            {previewPost.description && (
              <p className={styles.postPreviewDescription}>
                {previewPost.description}
              </p>
            )}

            {previewPost.body && (
              <div className={styles.postPreviewBody}>
                {renderPlainText(previewPost.body)}
              </div>
            )}

            {!previewPost.body && previewPost.summary_text && (
              <div className={styles.postPreviewBody}>
                {renderPlainText(previewPost.summary_text)}
              </div>
            )}

            {getPostTags(previewPost).length > 0 && (
              <div className={styles.postPreviewTags}>
                {getPostTags(previewPost).map((tag, index) => {
                  const tagStr = typeof tag === 'object' ? (tag.name || tag.slug || '') : String(tag);
                  return (
                    <span key={`${tag.id || index}`} className={styles.tagChip}>
                      {tagStr.startsWith('#') ? tagStr : `#${tagStr}`}
                    </span>
                  )
                })}
              </div>
            )}

            {previewPost.id && (
              <button
                type="button"
                className={styles.openPostBtn}
                onClick={() => {
                  // Dispatch global event to open post detail (CommentModal)
                  // This allows pages like Feed or SearchResults to handle it
                  window.dispatchEvent(
                    new CustomEvent('open-post-detail', {
                      detail: { 
                        postId: previewPost.id,
                        post: previewPost,
                        disableAutoScroll: true
                      },
                    })
                  )
                  // Close the preview modal
                  setPreviewPost(null)
                }}
              >
                {t('assistant.openFullPost')}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}