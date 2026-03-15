import { Star } from 'lucide-react'
import styles from '../../style/cards/TestimonialCard.module.css'

export default function TestimonialCard({ avatar, name, role, quote, rating }) {
  return (
    <div className={styles.card}>
      <div className={styles.stars}>
        {[...Array(rating)].map((_, i) => (
          <Star key={i} size={16} fill="currentColor" />
        ))}
      </div>
      <p className={styles.quote}>{quote}</p>
      <div className={styles.author}>
        <img src={avatar} alt={name} className={styles.avatar} />
        <div className={styles.info}>
          <p className={styles.name}>{name}</p>
          <p className={styles.role}>{role}</p>
        </div>
      </div>
    </div>
  )
}
