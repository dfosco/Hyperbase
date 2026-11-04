import { useState } from 'react'
import { SidePanelHeader } from '../../../../../../hypercanvas/packages/storyboard/src/internals/SidePanelHeader/SidePanelHeader.jsx'
import { SidePanelSubHeader } from '../../../../../../hypercanvas/packages/storyboard/src/internals/SidePanelHeader/SidePanelSubHeader.jsx'

// Side panel sub-pages: the breadcrumb variant (default, flag sidepanel-subpage-breadcrumb on) against the previous
// variant (flag off). Fixtures only: no store, network or config writes.
export default {
  title: 'Side panel/Sub-page navigation',
}

const sessions = [
  { id: 'codex', label: 'Codex' },
  { id: 'claude', label: 'Claude' },
]

// Rendered at the side panel's real width so the nav is judged where it actually lives.
function Frame({ width = 420, children }) {
  return (
    <section style={{ width, minWidth: 0, color: 'var(--hc-color-foreground)', background: 'var(--hc-color-background)', border: '1px solid var(--hc-color-border)' }}>
      {children}
    </section>
  )
}

// Breadcrumb variant: the sub-page has no session tabs. Its title names Providers, and the title is the back link.
function HyperAgentProvidersBreadcrumb() {
  const [inProviders, setInProviders] = useState(true)
  return (
    <Frame>
      <SidePanelHeader
        title="Hyper Agent"
        items={inProviders ? [] : sessions}
        value={inProviders ? '' : 'codex'}
        onValueChange={() => setInProviders(false)}
        breadcrumb={inProviders ? { id: 'story-providers', label: 'Providers', backLabel: 'Back to sessions', onBack: () => setInProviders(false) } : null}
      />
    </Frame>
  )
}

// Previous variant (flag off): the tab strip is emptied and Providers gets its own sub-header row in the body.
function HyperAgentProvidersLegacy() {
  const [inProviders, setInProviders] = useState(true)
  return (
    <Frame>
      <SidePanelHeader title="Hyper Agent" items={inProviders ? [] : sessions} value={inProviders ? '' : 'codex'} onValueChange={() => setInProviders(false)} />
      {inProviders && <SidePanelSubHeader id="story-legacy-providers" title="Providers" backLabel="Back to sessions" onBack={() => setInProviders(false)} />}
    </Frame>
  )
}

// Publish > Repository: no provider tabs, and the page is named after Publish with a back control.
function PublishRepository({ width = 420, firstTime = false }) {
  const [value, setValue] = useState('github-pages')
  return (
    <Frame width={width}>
      <SidePanelHeader
        title="Publish"
        ariaLabel="Publishing providers"
        items={[]}
        value={value}
        onValueChange={setValue}
        titleGap
        breadcrumb={{ id: 'story-repository', label: 'Repository', backLabel: 'Back to publishing', onBack: firstTime ? undefined : () => {} }}
      />
    </Frame>
  )
}

export const HyperAgentSessions = { render: () => <Frame><SidePanelHeader title="Hyper Agent" items={sessions} value="codex" /></Frame> }
export const HyperAgentProvidersBreadcrumbVariant = { render: () => <HyperAgentProvidersBreadcrumb /> }
export const HyperAgentProvidersLegacyVariant = { render: () => <HyperAgentProvidersLegacy /> }
export const PublishRepositoryBreadcrumbVariant = { render: () => <PublishRepository /> }
export const PublishFirstTimeRepositoryNoBack = { render: () => <PublishRepository firstTime /> }
export const PublishRepositoryNarrowPanel = { render: () => <PublishRepository width={300} /> }
