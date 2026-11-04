import styles from './NotebookSidebarResize.module.css'

export default function NotebookSidebarResize({ children }) {
  return (
    <div className={styles.root}>
      {children}
    </div>
  )
}
