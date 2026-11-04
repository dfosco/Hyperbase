import { useEffect, useRef } from 'react'
import PublishingProvider from '../../../../../../hypercanvas/packages/storyboard/src/core/ui/PublishingProvider/PublishingProvider.tsx'
import { GitHubPublishPanel } from '../../../../../../hypercanvas/packages/storyboard/src/core/ui/PublishControl.jsx'
import { disconnectedProvider } from '../../../../../../hypercanvas/packages/storyboard/src/core/notebook/publishing/providerRegistry.ts'
import { githubStates, netlifyStates, headerStates, publishingSnapshot } from '../../publishingStoryFixtures.js'

const labels = { vercel: 'Vercel', netlify: 'Netlify', 'cloudflare-pages': 'Cloudflare' }
const tools = { vercel: ['vercel', '65.9.0'], netlify: ['netlify', '27.16.2'], 'cloudflare-pages': ['wrangler', '4.156.1'] }
const verification = { vercel: 'https://vercel.com/oauth/device?user_code=DEMO-CODE', netlify: 'https://app.netlify.com/authorize?response_type=ticket&ticket=fixture-only', 'cloudflare-pages': 'https://dash.cloudflare.com/oauth2/device?user_code=DEMO1234' }

export default {
  title: 'Publishing/Provider connection',
  parameters: { layout: 'padded' },
  argTypes: {
    provider: { control: 'select', options: Object.keys(labels) },
    state: { control: 'select', options: ['ready', 'unavailable', 'awaiting_browser', 'expired', 'revoked'] },
  },
  args: { provider: 'vercel', state: 'ready' },
}

export const OfficialBrowserLogin = {
  render: ({ provider, state }) => {
    const waiting = state === 'awaiting_browser'
    const saved = state === 'expired' || state === 'revoked'
    const connection = { ...disconnectedProvider(), credentialPresent: saved, status: saved ? state === 'expired' ? 'expired' : 'invalid' : 'disconnected', expiresAt: state === 'expired' ? Date.UTC(2026, 10, 1, 10) : null }
    const capability = { available: state !== 'unavailable', tool: tools[provider][0], version: state === 'unavailable' ? null : tools[provider][1], hint: state === 'unavailable' ? `Install or update the official ${tools[provider][0]} CLI, then recheck sign-in availability. Advanced API token connection is also available.` : 'Sign in with the official CLI. Approve the request in your browser.' }
    const login = waiting ? { requestId: 'storybook-login', status: 'awaiting_browser', verificationUri: verification[provider], code: provider === 'netlify' ? null : provider === 'vercel' ? 'DEMO-CODE' : 'DEMO1234', startedAt: '2026-11-02T15:00:00.000Z', expiresAt: '2026-11-02T15:10:00.000Z', error: null } : null
    const publishing = { notebookId: 'storybook-fixture', providers: { selectedProviderId: provider, selectionId: 'storybook-selection', entries: { [provider]: { connection, destination: null, loginCapability: capability, login } } }, operation: null, busy: waiting ? 'provider:login' : null, providerRequest: waiting ? { requestId: 'storybook-login', kind: 'login', providerId: provider } : null, providerNotice: null, providerError: null, error: null, providerDeploymentReview: null }
    const preventAction = event => { event.preventDefault(); event.stopPropagation() }
    return <section data-hc-theme="light" data-hc-surface="toolbar" style={{ maxWidth: 420, padding: 16 }} onClickCapture={preventAction} onSubmitCapture={preventAction}>
      <p role="note">Controlled {labels[provider]} fixture. Actions are disabled; no provider requests run.</p>
      <PublishingProvider key={`${provider}:${state}`} publishing={publishing}><p>GitHub Pages fixture.</p></PublishingProvider>
    </section>
  },
}

// Cloudflare destination and processing states. Mocked data only; actions are blocked by the capture handler below.
const cloudflareAccount = { id: 'acct_storybook', slug: 'fixture', name: 'Fixture Account', type: 'user' }
const cloudflareDestination = { accountId: cloudflareAccount.id, account: cloudflareAccount, project: { id: 'prj_storybook', name: 'docs-site', settingsUrl: 'https://dash.cloudflare.com/0123456789abcdef0123456789abcdef/pages/view/docs-site', gitConnected: false, cloudflare: { productionBranch: 'main', subdomain: 'docs-site.pages.dev', sourceType: 'direct_upload' } }, connectedAt: '2026-11-02T15:00:00.000Z', reviewId: 'storybook-review' }
const cloudflareConnected = { ...disconnectedProvider(), status: 'connected', credentialPresent: true, account: cloudflareAccount, accounts: [cloudflareAccount], checkedAt: '2026-11-02T15:00:00.000Z', expiresAt: null, error: null }
const cloudflareCapability = { available: true, tool: 'wrangler', version: '4.156.1', hint: 'Sign in with the official CLI. Approve the request in your browser.' }

function cloudflareOperation(phase) {
  return { id: 'storybook-cf-op', requestId: 'storybook-cf-request', attempt: 'storybook-nonce', accountId: cloudflareAccount.id, projectId: 'prj_storybook', phase, sourceDigest: 'storybook-source', staticDigest: 'storybook-static', deploymentId: 'storybook-deployment', deploymentUrl: null, productionUrl: null, readyState: 'queued', aliasAssigned: false, access: 'unknown', requestedAccess: 'preserve', startedAt: '2026-11-02T15:00:00.000Z', updatedAt: '2026-11-02T15:01:00.000Z', error: null, filesUploaded: 2, fileCount: 2, localWaiting: true, warnings: [] }
}

function renderCloudflareFixture({ operation = null, localBuild = null, connection = cloudflareConnected, destination = cloudflareDestination, capability = cloudflareCapability }) {
  const publishing = { notebookId: 'storybook-fixture', providers: { selectedProviderId: 'cloudflare-pages', selectionId: 'storybook-selection-cloudflare', entries: { 'cloudflare-pages': { connection, destination, loginCapability: capability, login: null, operation, localBuild } } }, operation: null, busy: null, providerRequest: null, providerNotice: null, providerError: null, error: null, providerDeploymentReview: null }
  const preventAction = event => { event.preventDefault(); event.stopPropagation() }
  return <section data-hc-theme="light" data-hc-surface="toolbar" style={{ maxWidth: 420, padding: 16 }} onClickCapture={preventAction} onSubmitCapture={preventAction}>
    <p role="note">Controlled Cloudflare fixture. Actions are disabled; no provider requests run.</p>
    <PublishingProvider key={`cloudflare:${operation?.phase ?? 'destination'}:${localBuild?.status ?? 'idle'}`} publishing={publishing}><p>GitHub Pages fixture.</p></PublishingProvider>
  </section>
}

/** Connected Cloudflare destination with no deployment yet. */
export const CloudflareDestination = {
  name: 'Cloudflare destination',
  render: () => renderCloudflareFixture({}),
}

/** Exact deployment processing at Cloudflare, with the local build still running and an unverified website access line. */
export const CloudflareProcessing = {
  name: 'Cloudflare processing',
  render: () => renderCloudflareFixture({ operation: cloudflareOperation('pending'), localBuild: { requestId: 'storybook-cf-build', status: 'running', error: null } }),
}

/** Cloudflare sign-in with the official CLI available and no saved credential. */
export const CloudflareSignIn = {
  name: 'Cloudflare sign-in',
  render: () => renderCloudflareFixture({ connection: disconnectedProvider() }),
}

/** Cloudflare CLI missing: sign-in is disabled and the hint explains the fix. */
export const CloudflareCliMissing = {
  name: 'Cloudflare CLI missing',
  render: () => renderCloudflareFixture({ connection: disconnectedProvider(), capability: { available: false, tool: 'wrangler', version: null, hint: 'Install or update the official wrangler CLI, then recheck sign-in availability. Advanced API token connection is also available.' } }),
}

/** Connected Cloudflare account with no Pages project chosen yet: the project setup form is the next step. */
export const CloudflareConnectedNoDestination = {
  name: 'Cloudflare connected, no destination',
  render: () => renderCloudflareFixture({ destination: null }),
}

/** Cloudflare deployment failed: the exact error and retry action are shown. */
export const CloudflareFailed = {
  name: 'Cloudflare failed',
  render: () => renderCloudflareFixture({ operation: { ...cloudflareOperation('failed'), localWaiting: false, readyState: 'failure', error: { code: 'upload_rejected', message: 'Cloudflare rejected the static upload.', hint: 'Check the project settings, then retry.' } } }),
}

// Publishing panel states with the real provider strip, GitHub Pages panel, and Netlify setup.
// Clicks the user makes are blocked; programmatic setup clicks (untrusted events) still run.
const blockUserActions = event => { if (event.isTrusted) { event.preventDefault(); event.stopPropagation() } }

function Frame({ caption, children }) {
  return <section data-hc-theme="light" data-hc-surface="toolbar" style={{ maxWidth: 480, padding: 16 }} onClickCapture={blockUserActions} onSubmitCapture={blockUserActions}>
    <p role="note">{caption}</p>
    {children}
  </section>
}

function GitHubFrame({ publishing, caption, children }) {
  return <Frame caption={caption}><PublishingProvider publishing={publishing}>{children ?? <GitHubPublishPanel publishing={publishing} />}</PublishingProvider></Frame>
}

const githubCaption = 'GitHub Pages panel. Actions are disabled; no provider requests run.'

export const GitHubLoading = { name: 'GitHub loading', render: () => <GitHubFrame caption={githubCaption} publishing={githubStates.loading} /> }
export const GitHubSignedOut = { name: 'GitHub signed out', render: () => <GitHubFrame caption={githubCaption} publishing={githubStates.signedOut} /> }
export const GitHubCliMissing = { name: 'GitHub CLI missing', render: () => <GitHubFrame caption={githubCaption} publishing={githubStates.cliMissing} /> }
export const GitHubCliInstalling = { name: 'GitHub CLI installing', render: () => <GitHubFrame caption={githubCaption} publishing={githubStates.cliInstalling} /> }
export const GitHubConnectedNewRepository = { name: 'GitHub connected, new repository', render: () => <GitHubFrame caption={githubCaption} publishing={githubStates.connectedNewRepository} /> }
export const GitHubReadyBoundRepository = { name: 'GitHub ready, bound repository', render: () => <GitHubFrame caption={githubCaption} publishing={githubStates.ready} /> }
export const GitHubPublished = { name: 'GitHub published', render: () => <GitHubFrame caption={githubCaption} publishing={githubStates.published} /> }
export const GitHubFailed = { name: 'GitHub failed', render: () => <GitHubFrame caption={githubCaption} publishing={githubStates.failed} /> }

/** "Existing repository" is a local toggle, not an initial state: opened once after mount, like a user click. */
export const GitHubConnectedExistingRepository = {
  name: 'GitHub connected, existing repository',
  render: () => {
    function ToggleExisting() {
      const ref = useRef(null)
      useEffect(() => {
        const toggle = [...(ref.current?.querySelectorAll('button[aria-pressed]') || [])].find(button => button.textContent === 'Existing repository')
        toggle?.click()
      }, [])
      return <div ref={ref}><GitHubFrame caption={githubCaption} publishing={githubStates.connectedNewRepository} /></div>
    }
    return <ToggleExisting />
  },
}

const netlifyCaption = 'Netlify setup inside the provider strip. Actions are disabled; no provider requests run.'
const netlifyFrame = publishing => <Frame caption={netlifyCaption}><PublishingProvider publishing={publishing}><p>GitHub Pages fixture.</p></PublishingProvider></Frame>

export const NetlifyCliMissing = { name: 'Netlify CLI missing', render: () => netlifyFrame(netlifyStates.cliMissing) }
export const NetlifyNotSignedIn = { name: 'Netlify not signed in', render: () => netlifyFrame(netlifyStates.notSignedIn) }
export const NetlifyConnected = { name: 'Netlify connected', render: () => netlifyFrame(netlifyStates.connected) }

/** The API-token disclosure is closed by default; opened once after mount, like a user click. */
export const NetlifyApiTokenDisclosureOpen = {
  name: 'Netlify API token disclosure open',
  render: () => {
    function OpenDisclosure() {
      const ref = useRef(null)
      useEffect(() => {
        const disclosure = ref.current?.querySelector('details')
        if (disclosure) disclosure.open = true
      }, [])
      return <div ref={ref}>{netlifyFrame(netlifyStates.notSignedIn)}</div>
    }
    return <OpenDisclosure />
  },
}

// Provider strip states. Each tab shows the selected provider's current setup body; GitHub Pages carries its panel.
const headerCaption = 'Provider strip. Actions are disabled; no provider requests run.'
const githubHeaderBody = <GitHubPublishPanel publishing={githubStates.connectedNewRepository} />
const vercelAccount = { id: 'team_storybook', name: 'Fixture Team', slug: 'fixture-team', type: 'team' }
const allConfiguredEntries = publishingSnapshot({
  auth: githubStates.connectedNewRepository.auth,
  providers: {
    selectedProviderId: 'github-pages',
    selectionId: 'story-selection',
    entries: {
      vercel: { connection: { ...disconnectedProvider(), status: 'connected', credentialPresent: true, account: vercelAccount, accounts: [vercelAccount], checkedAt: '2026-11-02T15:00:00.000Z', expiresAt: null, error: null }, destination: null, loginCapability: { available: true, tool: 'vercel', version: '65.9.0', hint: null } },
      netlify: netlifyStates.connected.providers.entries.netlify,
      'cloudflare-pages': { connection: cloudflareConnected, destination: cloudflareDestination, loginCapability: cloudflareCapability, login: null, operation: null, localBuild: null },
    },
  },
})

/** No provider configured, GitHub Pages selected: every registry provider is a tab in the shared titlebar; there is no add control. */
export const HeaderNoneConfigured = {
  name: 'Header: none configured',
  render: () => <Frame caption={headerCaption}><PublishingProvider publishing={githubStates.connectedNewRepository}>{githubHeaderBody}</PublishingProvider></Frame>,
}

/** Every provider configured: all four tabs show in the shared titlebar. */
export const HeaderAllConfigured = {
  name: 'Header: all configured',
  render: () => <Frame caption={headerCaption}><PublishingProvider publishing={allConfiguredEntries}>{githubHeaderBody}</PublishingProvider></Frame>,
}

/** Selected unconfigured Vercel: its setup body renders from the selected provider. */
export const HeaderVercelSelected = {
  name: 'Header: Vercel selected',
  render: () => <Frame caption={headerCaption}><PublishingProvider publishing={publishingSnapshot({ providers: { selectedProviderId: 'vercel', selectionId: 'story-selection', entries: {} } })}>{githubHeaderBody}</PublishingProvider></Frame>,
}

/** Selected unconfigured Netlify: its setup body renders from the selected provider. */
export const HeaderNetlifySelected = {
  name: 'Header: Netlify selected',
  render: () => <Frame caption={headerCaption}><PublishingProvider publishing={headerStates.unconfiguredNetlifySelected}>{githubHeaderBody}</PublishingProvider></Frame>,
}

/** Selected unconfigured Cloudflare Pages: its sign-in body renders from the selected provider. */
export const HeaderCloudflareSelected = {
  name: 'Header: Cloudflare selected',
  render: () => <Frame caption={headerCaption}><PublishingProvider publishing={publishingSnapshot({ providers: { selectedProviderId: 'cloudflare-pages', selectionId: 'story-selection', entries: {} } })}>{githubHeaderBody}</PublishingProvider></Frame>,
}
