import { Button } from '../../Publishing/PublishStates.component/chrome/ui/button.jsx'
import X from '../../Publishing/PublishStates.component/chrome/lucide/icons/x.js'
import '../../Publishing/PublishStates.component/chrome/core.css'
import css from './Toast.module.css'

/**
 * Toast notice. kind: 'info' | 'warning' | 'error'. size: 'small' (one line) | 'large'.
 * actions: up to two { label, onClick }; the first is emphasized.
 * onDismiss: renders the dismiss control (an × in small, a "Dismiss" button in large).
 */
export default function Toast({ kind = 'info', size = 'large', title, children, actions = [], onDismiss, className = '' }) {
  const shown = actions.slice(0, 2)
  const text = typeof children === 'string' ? children : undefined
  const small = size === 'small'
  const btn = small ? 'xs' : 'sm'
  const buttons = (
    <span className={css.actions}>
      {shown.map((a, i) => <Button key={a.label} type="button" variant={i === 0 ? 'outline' : 'ghost'} size={btn} onClick={a.onClick}>{a.label}</Button>)}
      {onDismiss && (small
        ? <Button type="button" variant="ghost" size="icon-xs" aria-label="Dismiss" onClick={onDismiss}><X/></Button>
        : <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>Dismiss</Button>)}
    </span>
  )
  return (
    <aside className={`${css.toast} ${css[kind]} ${css[size]} ${className}`} role={kind === 'error' ? 'alert' : 'status'} aria-live="polite" data-kind={kind} data-size={size}>
      {size === 'large' && title && <strong className={css.title}>{title}</strong>}
      <span className={css.message} title={size === 'small' ? text : undefined}>{children}</span>
      {buttons}
    </aside>
  )
}
