import { useState } from 'react'
import Toast from './Toast.jsx'

function Demo({ kind, size, actions }) {
  const [open, setOpen] = useState(true)
  const [msg, title] = {
    info: ['A document update is ready. Reload to apply it.', 'Document update ready'],
    warning: ['Pushing can trigger websites already connected to this repository.', 'Connected websites may rebuild'],
    error: ['GitHub couldn’t confirm the update. Check repository access and try again.', 'Push failed'],
  }[kind]
  const labels = { info: ['Reload now', 'View changes'], warning: ['Review sites', 'Push anyway'], error: ['Try again', 'Open GitHub'] }[kind].slice(0, actions)
  return (
    <div style={{ width: 400, padding: 16, background: 'var(--hc-color-background, #fff)' }}>
      {open
        ? <Toast kind={kind} size={size} title={title} actions={labels.map((label) => ({ label, onClick: () => {} }))} onDismiss={() => setOpen(false)}>{msg}</Toast>
        : <button type="button" style={{ font: '12px sans-serif' }} onClick={() => setOpen(true)}>Dismissed · restore</button>}
    </div>
  )
}

export const InfoSmallOneAction = { name: 'InfoSmallOneAction', render: () => <Demo kind="info" size="small" actions={1}/> }
export const InfoSmallTwoActions = { name: 'InfoSmallTwoActions', render: () => <Demo kind="info" size="small" actions={2}/> }
export const InfoLargeOneAction = { name: 'InfoLargeOneAction', render: () => <Demo kind="info" size="large" actions={1}/> }
export const InfoLargeTwoActions = { name: 'InfoLargeTwoActions', render: () => <Demo kind="info" size="large" actions={2}/> }
export const WarningSmallOneAction = { name: 'WarningSmallOneAction', render: () => <Demo kind="warning" size="small" actions={1}/> }
export const WarningSmallTwoActions = { name: 'WarningSmallTwoActions', render: () => <Demo kind="warning" size="small" actions={2}/> }
export const WarningLargeOneAction = { name: 'WarningLargeOneAction', render: () => <Demo kind="warning" size="large" actions={1}/> }
export const WarningLargeTwoActions = { name: 'WarningLargeTwoActions', render: () => <Demo kind="warning" size="large" actions={2}/> }
export const ErrorSmallOneAction = { name: 'ErrorSmallOneAction', render: () => <Demo kind="error" size="small" actions={1}/> }
export const ErrorSmallTwoActions = { name: 'ErrorSmallTwoActions', render: () => <Demo kind="error" size="small" actions={2}/> }
export const ErrorLargeOneAction = { name: 'ErrorLargeOneAction', render: () => <Demo kind="error" size="large" actions={1}/> }
export const ErrorLargeTwoActions = { name: 'ErrorLargeTwoActions', render: () => <Demo kind="error" size="large" actions={2}/> }
