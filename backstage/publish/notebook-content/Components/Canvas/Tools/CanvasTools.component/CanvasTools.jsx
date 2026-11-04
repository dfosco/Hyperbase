import styles from './CanvasTools.module.css'

export default function CanvasTools({ children }) {
  return (
    <div className={styles.root}>
      {children}
    </div>
  )
}
