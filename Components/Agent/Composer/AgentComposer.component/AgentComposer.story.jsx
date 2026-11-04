import { useState } from 'react'
import { Image, MousePointer2 } from 'lucide-react'
import {
  AgentComposerPresentation,
  AgentComposerContextPill,
  AgentComposerWidgets,
  AgentComposerProvider,
  AgentComposerDestination,
  AgentComposerSend,
  agentComposerParts,
} from '../../../../../../hypercanvas/packages/storyboard/src/internals/AgentComposerPresentation/AgentComposerPresentation.jsx'

function Composer({ variant = 'expressive', titleTreatment = 'current', attached = false, element = false, statusError, queuedInitially = false, widgets, className, positionKey }) {
  const [provider, setProvider] = useState('claude')
  const [destination, setDestination] = useState('current')
  const [attachedImage, setAttachedImage] = useState(attached)
  const [attachedElement, setAttachedElement] = useState(element)
  const [queued, setQueued] = useState(queuedInitially)
  const [removedWidgetIds, setRemovedWidgetIds] = useState([])
  return <AgentComposerPresentation
    variant={variant}
    titleTreatment={titleTreatment}
    className={className}
    positionKey={positionKey}
    input={<textarea className={agentComposerParts.textarea} aria-label="Hyper Agent instruction" placeholder="Describe what you want to change" rows={3} onKeyDown={event => { if (event.key === 'Enter' && event.altKey) { event.preventDefault(); setQueued(true) } }} />}
    provider={<AgentComposerProvider value={provider} onChange={setProvider} label="Agent provider" heading="Select provider" options={[{ id: 'claude', label: 'Claude' }, { id: 'codex', label: 'Codex' }, { id: 'opencode', label: 'OpenCode' }]} />}
    footer={<AgentComposerDestination value={destination} onChange={setDestination} />}
    actions={<AgentComposerSend aria-label="Send instruction" onClick={() => setQueued(false)} />}
    statusNotice={queued ? 'Added to batch' : undefined}
    statusError={statusError}
    onClose={() => setQueued(false)}
  >
    <AgentComposerWidgets widgets={widgets?.filter(widget => !removedWidgetIds.includes(widget.id))} onRemove={id => setRemovedWidgetIds(ids => [...ids, id])} />
    {(attachedImage || attachedElement) && <div className={agentComposerParts.pillRow}>
      {attachedImage && <AgentComposerContextPill removeLabel="Remove image attachment" icon={<Image size={12} aria-hidden="true" />} onRemove={() => setAttachedImage(false)}>Image</AgentComposerContextPill>}
      {attachedElement && <AgentComposerContextPill removeLabel="Remove element selection" icon={<MousePointer2 size={12} aria-hidden="true" />} onRemove={() => setAttachedElement(false)}>Element</AgentComposerContextPill>}
    </div>}
  </AgentComposerPresentation>
}

const meta = {
  title: 'Agent/Composer',
  parameters: { layout: 'fullscreen' },
  decorators: [Story => <div style={{ padding: 16, display: 'flex', justifyContent: 'center', boxSizing: 'border-box' }}><Story /></div>],
}
export default meta

export const GestureCapture = { render: () => <Composer positionKey="storybook:agent-composer:gesture-capture" /> }
export const SelectedWidgets = { render: () => <Composer widgets={[{ id: 'one', type: 'prototype', title: 'Login form' }, { id: 'two', type: 'component', title: 'Pricing table' }, { id: 'three', type: 'markdown', title: 'A widget with a very long title that must truncate inside the pill' }]} /> }
export const ProviderAndDestination = { render: () => <Composer /> }
export const QueueAcknowledgement = { args: { statusError: '' }, render: args => <Composer {...args} queuedInitially /> }
export const ImageAttachmentPill = { render: () => <Composer attached element /> }
export const CompactWide = { render: () => <Composer variant="compactWide" /> }

const titleOptions = [
  { id: 'current', label: 'Current title treatment' },
  { id: 'reducedFringe', label: 'Reduced RGB fringe' },
  { id: 'reducedFringeOutline', label: 'Reduced fringe with thin outline' },
]

function ComparisonGrid({ appearance }) {
  const theme = appearance === 'dark' ? 'dark' : 'light'
  return <main style={{ padding: 8, maxWidth: 1280, margin: '0 auto' }}>
    <section data-hc-theme={theme} data-sb-surface="toolbar" data-sb-toolbar-theme={theme} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 8, padding: 8, colorScheme: theme, color: 'var(--hc-color-foreground)', background: 'var(--hc-color-background)' }}>
      <h2 style={{ gridColumn: '1 / -1', margin: '0 0 2px', color: 'var(--hc-color-foreground)', font: '600 13px/18px var(--hc-font-sans)' }}>{theme === 'light' ? 'Light appearance' : 'Dark appearance'} · title treatment comparison</h2>
      {titleOptions.map(option => <article key={option.id} style={{ minWidth: 0, padding: 8, borderRadius: 12, backgroundColor: 'var(--hc-color-background)', backgroundImage: 'repeating-conic-gradient(from 45deg, color-mix(in srgb, var(--hc-color-foreground-accent) 65%, var(--hc-color-background)) 0% 25%, var(--hc-color-background-accent-muted) 0% 50%)', backgroundSize: '112px 112px' }}>
        <p style={{ margin: '0 0 6px', color: 'var(--hc-color-foreground-muted)', font: '12px/16px var(--hc-font-sans)' }}>{option.label}</p>
        <Composer titleTreatment={option.id} className="hc-w-full" />
      </article>)}
    </section>
  </main>
}

export const GlassAndTitleComparison = {
  render: (_args, { globals }) => <ComparisonGrid appearance={globals.appearance} />,
  parameters: { layout: 'fullscreen' },
}
