/** Auto place toggle using the same pressed state as other toolbar controls. */
import { useState, useEffect } from 'react'
import * as Tooltip from '../lib/components/ui/tooltip/index.js'
import { TriggerButton } from '../lib/components/ui/trigger-button/index.js'
import Icon from './Icon.jsx'

export default function CanvasSnap({ config = {}, data, tabindex, tabIndex }) {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    function handleAutoPlaceState(e) {
      setEnabled(!!e.detail?.enabled)
    }
    document.addEventListener('storyboard:canvas:auto-place-state', handleAutoPlaceState)
    document.dispatchEvent(new CustomEvent('storyboard:canvas:auto-place-state-request'))

    return () => {
      document.removeEventListener('storyboard:canvas:auto-place-state', handleAutoPlaceState)
    }
  }, [])

  if (!data) return null

  const label = enabled ? 'Auto place (on)' : 'Auto place (off)'

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <TriggerButton
          size="icon-xl"
          active={enabled}
          aria-label="Auto place"
          aria-pressed={enabled}
          tabIndex={tabIndex ?? tabindex ?? -1}
          onClick={() => data.toggleAutoPlace()}
        >
          <Icon name={config.icon || 'iconoir/view-grid'} size={16} {...(config.meta || {})} />
        </TriggerButton>
      </Tooltip.Trigger>
      <Tooltip.Content side="top">{label}</Tooltip.Content>
    </Tooltip.Root>
  )
}
