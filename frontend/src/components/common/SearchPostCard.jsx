import { useNavigate } from 'react-router-dom'
import styles from '../../style/common/SearchPostCard.module.css'

export default function SearchPostCard({ post }) {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate(`/feed`, { state: { scrollToPostId: post.id } })
  }

  return (
    <div className={styles.postCard} onClick={handleClick}>
      <div className={styles.coverContainer}>
        <img
          src={post.cover || '/default-podcast.png'}
          alt={post.title}
          className={styles.cover}
        />
        <div className={styles.overlay}>
          <div className={styles.playIcon}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
      <div className={styles.content}>
        <h3 className={styles.title}>{post.title}</h3>
        <p className={styles.author}>{post.author}</p>
      </div>
    </div>
  )
}
