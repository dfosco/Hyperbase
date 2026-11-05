import { useState } from 'react'
import { PublisherAccordion } from '../../../../../../hypercanvas/packages/storyboard/src/core/ui/PublisherAccordion/PublisherAccordion.tsx'

// Publishers as a stacked accordion: one open at a time, the default publisher first, and each publisher's configuration
// inside its item. Fixtures only: no store, network or config writes.
export default {
  title: 'Publishing/Publisher accordion',
}

// Labels match the provider registry's tabLabel values. Statuses use the publication tones.
const PUBLISHERS = [
  { id: 'github-pages', title: 'GitHub', status: { tone: 'published', label: 'Published' }, body: 'Publish this Notebook to GitHub Pages. Hypercanvas pushes it to a GitHub repository, and Pages serves the site.' },
  { id: 'vercel', title: 'Vercel', body: 'Connect Vercel and choose the project for this whole Notebook.' },
  { id: 'netlify', title: 'Netlify', status: { tone: 'failed', label: 'Failed' }, body: 'Connect Netlify and choose the site for this whole Notebook.' },
  { id: 'cloudflare-pages', title: 'Cloudflare', status: { tone: 'publishing', label: 'Publishing' }, body: 'Connect Cloudflare and choose the Pages project for this whole Notebook.' },
]

// Rendered at the side panel's real width so the accordion is judged where it actually lives.
function Frame({ width = 420, children }) {
  return (
    <section style={{ width, minWidth: 0, color: 'var(--hc-color-foreground)', background: 'var(--hc-color-background)', border: '1px solid var(--hc-color-border)' }}>
      {children}
    </section>
  )
}

// The default publisher leads the list, then the rest in registry order. Hidden publishers are left out.
function publisherItems(selected, hidden) {
  return [selected, ...PUBLISHERS.map(item => item.id).filter(id => id !== selected)]
    .map(id => {
      const publisher = PUBLISHERS.find(item => item.id === id)
      return {
        id,
        title: publisher.title,
        status: publisher.status,
        isDefault: id === selected,
        disabled: false,
        enabled: !hidden.includes(id),
        content: <p style={{ margin: 0, color: 'var(--hc-color-foreground-muted)' }}>{publisher.body}</p>,
      }
    })
}

// Set as default moves the publisher to the top and opens it. The Enabled toggle switches a publisher off and on again.
function AccordionWithState({ width = 420 }) {
  const [selected, setSelected] = useState('github-pages')
  const [open, setOpen] = useState('github-pages')
  const [hidden, setHidden] = useState([])
  return (
    <Frame width={width}>
      <PublisherAccordion
        items={publisherItems(selected, hidden)}
        openId={open}
        onOpenChange={setOpen}
        onSetDefault={id => { setSelected(id); setOpen(id) }}
        onDisable={id => { if (id === selected) return; setHidden(list => [...list, id]) }}
        onEnable={id => setHidden(list => list.filter(item => item !== id))}
      />
    </Frame>
  )
}

export const Collapsed = { render: () => <Frame><PublisherAccordion items={publisherItems('github-pages', [])} openId={null} onOpenChange={() => {}} /></Frame> }
export const DefaultOpen = { render: () => <Frame><PublisherAccordion items={publisherItems('github-pages', [])} openId="github-pages" onOpenChange={() => {}} /></Frame> }
export const OtherPublisherOpen = { render: () => <Frame><PublisherAccordion items={publisherItems('github-pages', [])} openId="netlify" onOpenChange={() => {}} onSetDefault={() => {}} onDisable={() => {}} /></Frame> }
export const Locked = { render: () => <Frame><PublisherAccordion items={publisherItems('github-pages', [])} openId="netlify" onOpenChange={() => {}} locked /></Frame> }
export const SwitchedOff = { render: () => <Frame><PublisherAccordion items={publisherItems('github-pages', ['netlify'])} openId="netlify" onOpenChange={() => {}} onEnable={() => {}} onDisable={() => {}} /></Frame> }
export const Interactive = { render: () => <AccordionWithState /> }
export const InteractiveNarrowPanel = { render: () => <AccordionWithState width={300} /> }
