import styles from './PublishingPanel.module.css'

export default function PublishingPanel({ children }) {
  return (
    <div className={styles.root}>
      {children}
    </div>
  )
}
