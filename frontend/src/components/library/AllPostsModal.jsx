import { useEffect, useRef, useState } from 'react'
import { X, MoreHorizontal, Edit, Trash2, EyeOff } from 'lucide-react'
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

function PostMenu({ post, isOwner, onEdit, onDelete, onHide }) {
  const ref = useRef(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className={styles.menuWrap} ref={ref}>
      <button
        type="button"
        className={styles.moreBtn}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((prev) => !prev)
        }}
        aria-label="Tùy chọn"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div className={styles.dropdown}>
          {isOwner ? (
            <>
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                  onEdit?.(post)
                }}
              >
                <Edit size={14} />
                <span>Chỉnh sửa</span>
              </button>
              <button
                type="button"
                className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                  onDelete?.(post)
                }}
              >
                <Trash2 size={14} />
                <span>Xóa</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.dropdownItem}
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                onHide?.(post)
              }}
            >
              <EyeOff size={14} />
              <span>Ẩn bài viết</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function AllPostsModal({
  isOpen,
  onClose,
  posts,
  title,
  onSelectPost,
  isOwner,
  onEditPost,
  onDeletePost,
  onHidePost,
}) {
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

                  <PostMenu
                    post={post}
                    isOwner={typeof isOwner === 'function' ? isOwner(post) : false}
                    onEdit={onEditPost}
                    onDelete={onDeletePost}
                    onHide={onHidePost}
                  />
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
