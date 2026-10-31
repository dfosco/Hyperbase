/** Recoverable notebook visibility control. Removed and embed views have none. */
import { useSyncExternalStore } from 'react'
import { TriggerButton } from '../lib/components/ui/trigger-button/index.js'
import Icon from './Icon.jsx'
import { getNotebookViewSearch, subscribeToChromeVisibility, toggleNotebookChrome } from '../session/chromeVisibility.js'
import { resolveNotebookView } from '../session/notebookView.js'

export default function HideChromeTrigger({ config = {}, tabindex, tabIndex }) {
  const search = useSyncExternalStore(subscribeToChromeVisibility, getNotebookViewSearch, () => '')
  const view = resolveNotebookView(search)
  if (!view.recoveryAvailable) return null

  return (
    <span style={{ opacity: view.notebookVisible ? 1 : 0.5, transition: 'opacity 0.15s' }}>
      <TriggerButton
        aria-label={config.ariaLabel || 'Toggle toolbars'}
        size={config.size || 'icon-xl'}
        tabIndex={tabIndex ?? tabindex}
        onClick={toggleNotebookChrome}
      >
        <Icon name={config.icon || 'primer/light-bulb'} size={16} {...(config.meta || {})} />
      </TriggerButton>
    </span>
  )
}
