import styles from './SidePanelSubPageNav.module.css'

export default function SidePanelSubPageNav({ children }) {
  return (
    <div className={styles.root}>
      {children}
    </div>
  )
}
