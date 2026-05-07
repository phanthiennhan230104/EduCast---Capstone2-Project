import { X } from 'lucide-react'
import styles from '../../style/library/AllPostsModal.module.css'

export default function AllPostsModal({ isOpen, onClose, posts, title, onSelectPost }) {
  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title || `Tất cả podcast đã lưu (${posts.length})`}</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Đóng"
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
                    <p className={styles.postAuthor}>{post.author}</p>
                    {post.tags && post.tags.length > 0 && (
                      <div className={styles.tags}>
                        {post.tags.slice(0, 2).map((tag, idx) => (
                          <span key={idx} className={styles.tag}>
                            {tag}
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
              <p>Chưa có podcast nào được lưu</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
