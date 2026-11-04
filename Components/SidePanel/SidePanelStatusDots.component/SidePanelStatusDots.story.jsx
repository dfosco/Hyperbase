import { SidePanelHeader } from '../../../../../hypercanvas/packages/storyboard/src/internals/SidePanelHeader/SidePanelHeader.jsx'

// Status dots on side panel tabs: a colour, or a presence state (filled = present, hollow ring = missing), optionally pulsing.
export default {
  title: 'Side panel/Status dots',
}

const colours = ['blue', 'green', 'yellow', 'red', 'gray']

function Strip({ items, width = 520, showStatusDots = true }) {
  return (
    <section style={{ width, minWidth: 0, color: 'var(--hc-color-foreground)', background: 'var(--hc-color-background)', border: '1px solid var(--hc-color-border)' }}>
      <SidePanelHeader title="Status" items={items} value={items[0]?.id} onValueChange={() => {}} showStatusDots={showStatusDots} />
    </section>
  )
}

const coloured = pulse => colours.map(tone => ({ id: tone, label: tone, status: { label: tone, tone, ...(pulse ? { pulse: true } : {}) } }))
const presence = [
  { id: 'present', label: 'Present', status: { label: 'Present', presence: 'present' } },
  { id: 'missing', label: 'Missing', status: { label: 'Missing', presence: 'missing' } },
]

export const Colours = { render: () => <Strip items={coloured(false)} /> }
export const Presence = { render: () => <Strip items={presence} /> }
export const Pulsing = { render: () => <Strip items={coloured(true)} /> }
export const PulsingMissing = { render: () => <Strip items={[{ id: 'missing', label: 'Missing', status: { label: 'Missing', presence: 'missing', pulse: true } }]} /> }
export const HiddenDots = { render: () => <Strip items={coloured(false)} showStatusDots={false} /> }
