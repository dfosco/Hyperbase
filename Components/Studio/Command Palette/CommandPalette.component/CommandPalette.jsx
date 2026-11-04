import styles from './CommandPalette.module.css'

export default function CommandPalette({ children }) {
  return (
    <div className={styles.root}>
      {children}
    </div>
  )
}
