import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, Edit, Trash2, EyeOff } from 'lucide-react'
import styles from '../../style/common/SearchPostCard.module.css'


const DEFAULT_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Cdefs%3E%3ClinearGradient id="grad" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%23667eea;stop-opacity:1" /%3E%3Cstop offset="100%25" style="stop-color:%23764ba2;stop-opacity:1" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width="400" height="300" fill="url(%23grad)"%3E%3C/rect%3E%3Ccircle cx="200" cy="150" r="40" fill="rgba(255,255,255,0.3)" /%3E%3Cpath d="M185 130 L185 170 L220 150 Z" fill="rgba(255,255,255,0.8)" /%3E%3C/svg%3E'

export default function SearchPostCard({
  post,
  onClick,
  isOwner = false,
  onEdit,
  onDelete,
  onHide,
}) {
  const [imageError, setImageError] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const handleClick = () => {
    if (onClick) {
      onClick()
    }
  }

  const handleImageError = () => {
    setImageError(true)
  }

  const imageSource = post.cover && !imageError ? post.cover : DEFAULT_PLACEHOLDER

  const showMenu =
    (isOwner && (onEdit || onDelete)) || (!isOwner && onHide)

  return (
    <div className={styles.postCard} onClick={handleClick} style={{ cursor: 'pointer' }}>
      <div className={styles.coverContainer}>
        <img
          src={imageSource}
          alt={post.title}
          className={styles.cover}
          onError={handleImageError}
        />
        <div className={styles.overlay}>
          <div className={styles.playIcon}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {showMenu && (
          <div className={styles.menuWrap} ref={menuRef}>
            <button
              type="button"
              className={styles.moreBtn}
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen((prev) => !prev)
              }}
              aria-label="Tùy chọn"
            >
              <MoreHorizontal size={16} />
            </button>

            {menuOpen && (
              <div
                className={styles.dropdown}
                onClick={(e) => e.stopPropagation()}
              >
                {isOwner ? (
                  <>
                    {onEdit && (
                      <button
                        type="button"
                        className={styles.dropdownItem}
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpen(false)
                          onEdit(post)
                        }}
                      >
                        <Edit size={14} />
                        <span>Chỉnh sửa</span>
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpen(false)
                          onDelete(post)
                        }}
                      >
                        <Trash2 size={14} />
                        <span>Xóa</span>
                      </button>
                    )}
                  </>
                ) : (
                  onHide && (
                    <button
                      type="button"
                      className={styles.dropdownItem}
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuOpen(false)
                        onHide(post)
                      }}
                    >
                      <EyeOff size={14} />
                      <span>Ẩn bài viết</span>
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className={styles.content}>
        <h3 className={styles.title}>{post.title}</h3>
        <p className={styles.author}>{post.author}</p>
      </div>
    </div>
  )
}
