import styles from './ShellTabs.module.css'

export default function ShellTabs({ children }) {
  return (
    <div className={styles.root}>
      {children}
    </div>
  )
}
