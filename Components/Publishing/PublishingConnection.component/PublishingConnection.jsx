import styles from './PublishingConnection.module.css'

export default function PublishingConnection({ children }) {
  return (
    <div className={styles.root}>
      {children}
    </div>
  )
}
