import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from '../../style/library/AllPostsModal.module.css'

function displayAuthor(author) {
  if (author == null || author === '') return 'Người dùng'
  if (typeof author === 'object') {
    return author.name || author.username || author.display_name || 'Người dùng'
  }
  return String(author)
}

function displayTagLabel(tag) {
  if (tag == null) return ''
  if (typeof tag === 'object') {
    return tag.name != null ? String(tag.name) : tag.slug != null ? String(tag.slug) : ''
  }
  return String(tag)
}

export default function AllPostsModal({ isOpen, onClose, posts, title, onSelectPost }) {
  const { t } = useTranslation()
  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {title || t('library.allSavedPodcasts', { count: posts.length })}
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t('library.close')}
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          {posts.length > 0 ? (
            <div className={styles.postsList}>
              {posts.map(post => (
                <div
                  key={post.id}
                  className={styles.postItem}
                  onClick={() => onSelectPost(post)}
                >
                  {post.thumbnail_url && (
                    <img
                      src={post.thumbnail_url}
                      alt={post.title}
                      className={styles.thumbnail}
                    />
                  )}
                  <div className={styles.postInfo}>
                    <h3 className={styles.postTitle}>{post.title}</h3>
                    <p className={styles.postAuthor}>{displayAuthor(post.author)}</p>
                    {post.tags && post.tags.length > 0 && (
                      <div className={styles.tags}>
                        {post.tags.slice(0, 2).map((tag, idx) => (
                          <span key={idx} className={styles.tag}>
                            {displayTagLabel(tag)}
                          </span>
                        ))}
                        {post.tags.length > 2 && (
                          <span className={styles.tag}>+{post.tags.length - 2}</span>
                        )}
                      </div>
                    )}
                    <p className={styles.duration}>{post.duration}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <p>{t('library.noSavedPodcasts')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
