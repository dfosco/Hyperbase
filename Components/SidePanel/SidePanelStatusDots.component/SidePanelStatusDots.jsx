import styles from './SidePanelStatusDots.module.css'

export default function SidePanelStatusDots({ children }) {
  return (
    <div className={styles.root}>
      {children}
    </div>
  )
}
