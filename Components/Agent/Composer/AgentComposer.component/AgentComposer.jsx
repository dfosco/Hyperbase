import styles from './AgentComposer.module.css'

export default function AgentComposer({ children }) {
  return (
    <div className={styles.root}>
      {children}
    </div>
  )
}
