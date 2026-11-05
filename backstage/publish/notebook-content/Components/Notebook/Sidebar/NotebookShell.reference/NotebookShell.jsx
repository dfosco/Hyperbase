import styles from './NotebookShell.module.css'

export default function NotebookShell({ children }) {
  return (
    <div className={styles.root}>
      {children}
    </div>
  )
}
