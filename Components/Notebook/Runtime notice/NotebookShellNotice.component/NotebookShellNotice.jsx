import styles from './NotebookShellNotice.module.css'

export default function NotebookShellNotice({ children }) {
  return (
    <div className={styles.root}>
      {children}
    </div>
  )
}
