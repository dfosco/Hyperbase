import styles from './PublisherAccordion.module.css'

export default function PublisherAccordion({ children }) {
  return (
    <div className={styles.root}>
      {children}
    </div>
  )
}
