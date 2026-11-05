import PublishingProvider from '../../../../../../hypercanvas/packages/storyboard/src/core/ui/PublishingProvider/PublishingProvider.tsx'
import { GitHubPublishPanel } from '../../../../../../hypercanvas/packages/storyboard/src/core/ui/PublishControl.jsx'
import { SidePanelToolHost } from '../../../../../../hypercanvas/packages/storyboard/src/internals/SidePanelHeader/SidePanelToolHost.jsx'
import { disconnectedProvider } from '../../../../../../hypercanvas/packages/storyboard/src/core/notebook/publishing/providerRegistry.ts'
import { githubStates, netlifyStates, publishingSnapshot } from '../../publishingStoryFixtures.js'

// Full Publish side panel: the shared titlebar (title, every provider tab, close) above the selected body.
// Fixture data only. Clicks the user makes are blocked, so no provider request or config write runs from a story.
const blockUserActions = event => { if (event.isTrusted) { event.preventDefault(); event.stopPropagation() } }
const noop = () => {}

export default {
  title: 'Publishing/Panel',
  parameters: { layout: 'padded' },
}

function Panel({ publishing, children }) {
  return (
    <section data-hc-surface="sidebar" style={{ width: 480, minHeight: 900, background: 'var(--hc-color-sidebar)', color: 'var(--hc-color-foreground)' }} onClickCapture={blockUserActions} onSubmitCapture={blockUserActions}>
      <SidePanelToolHost title="Publish" onClose={noop}>
        <PublishingProvider publishing={publishing}>{children}</PublishingProvider>
      </SidePanelToolHost>
    </section>
  )
}

const githubBody = publishing => <GitHubPublishPanel publishing={publishing} />

const vercelSignIn = publishingSnapshot({
  providers: { selectedProviderId: 'vercel', selectionId: 'panel-selection', entries: { vercel: { connection: disconnectedProvider(), destination: null, loginCapability: { available: true, tool: 'vercel', version: '65.9.0', hint: 'Sign in with the official Vercel CLI. Approve the request in your browser.' }, login: null } } },
})

const cloudflareAccount = { id: 'acct_panel', slug: 'fixture', name: 'Fixture Account', type: 'user' }
const cloudflareConnected = publishingSnapshot({
  providers: { selectedProviderId: 'cloudflare-pages', selectionId: 'panel-selection', entries: { 'cloudflare-pages': { connection: { ...disconnectedProvider(), status: 'connected', credentialPresent: true, account: cloudflareAccount, accounts: [cloudflareAccount], checkedAt: '2026-11-02T15:00:00.000Z' }, destination: null, loginCapability: { available: true, tool: 'wrangler', version: '4.156.1', hint: null }, login: null, operation: null, localBuild: null } } },
})

const allUnconfigured = publishingSnapshot({ auth: githubStates.connectedNewRepository.auth, providers: { selectedProviderId: 'github-pages', selectionId: 'panel-selection', entries: {} } })

function GitHubConnectedNewRepository() { return <Panel publishing={githubStates.connectedNewRepository}>{githubBody(githubStates.connectedNewRepository)}</Panel> }
function GitHubReadyBoundRepository() { return <Panel publishing={githubStates.ready}>{githubBody(githubStates.ready)}</Panel> }
function NetlifyNotSignedIn() { return <Panel publishing={netlifyStates.notSignedIn}><p>GitHub Pages body</p></Panel> }
function CloudflareConnected() { return <Panel publishing={cloudflareConnected}><p>GitHub Pages body</p></Panel> }
function VercelSignIn() { return <Panel publishing={vercelSignIn}><p>GitHub Pages body</p></Panel> }
function HeaderAllUnconfigured() { return <Panel publishing={allUnconfigured}>{githubBody(allUnconfigured)}</Panel> }

export const panelGithubConnectedNewRepository = { name: 'panel-github-connected-new-repository (light)', render: () => <GitHubConnectedNewRepository /> }
export const panelGithubConnectedNewRepositoryDark = { name: 'panel-github-connected-new-repository (dark)', globals: { appearance: 'dark' }, render: () => <GitHubConnectedNewRepository /> }
export const panelGithubReadyBoundRepository = { name: 'panel-github-ready-bound-repository (light)', render: () => <GitHubReadyBoundRepository /> }
export const panelGithubReadyBoundRepositoryDark = { name: 'panel-github-ready-bound-repository (dark)', globals: { appearance: 'dark' }, render: () => <GitHubReadyBoundRepository /> }
export const panelNetlifyNotSignedIn = { name: 'panel-netlify-not-signed-in (light)', render: () => <NetlifyNotSignedIn /> }
export const panelNetlifyNotSignedInDark = { name: 'panel-netlify-not-signed-in (dark)', globals: { appearance: 'dark' }, render: () => <NetlifyNotSignedIn /> }
export const panelCloudflareConnected = { name: 'panel-cloudflare-connected (light)', render: () => <CloudflareConnected /> }
export const panelCloudflareConnectedDark = { name: 'panel-cloudflare-connected (dark)', globals: { appearance: 'dark' }, render: () => <CloudflareConnected /> }
export const panelVercelSignIn = { name: 'panel-vercel-sign-in (light)', render: () => <VercelSignIn /> }
export const panelVercelSignInDark = { name: 'panel-vercel-sign-in (dark)', globals: { appearance: 'dark' }, render: () => <VercelSignIn /> }
export const panelHeaderAllUnconfigured = { name: 'panel-header-all-unconfigured (light)', render: () => <HeaderAllUnconfigured /> }
export const panelHeaderAllUnconfiguredDark = { name: 'panel-header-all-unconfigured (dark)', globals: { appearance: 'dark' }, render: () => <HeaderAllUnconfigured /> }
