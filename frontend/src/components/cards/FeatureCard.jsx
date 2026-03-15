import styles from '../../style/cards/FeatureCard.module.css'

export default function FeatureCard({ icon: Icon, title, description }) {
  return (
    <div className={styles.card}>
      <div className={styles.icon}>
        <Icon size={32} />
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
    </div>
  )
}
