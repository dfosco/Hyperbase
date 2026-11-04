/**
 * Publishing panel state fixtures for stories and smoke tests.
 * Plain snapshot objects only: no store, network, or config writes.
 */
export const NOTEBOOK_ID = 'story-notebook'

export function publishingSnapshot(patch = {}) {
  return {
    notebookId: NOTEBOOK_ID,
    sourceBranch: 'main',
    review: null,
    providerDeploymentReview: null,
    providerRequest: null,
    providerNotice: null,
    providerError: null,
    error: null,
    busy: null,
    login: null,
    auth: null,
    bindings: [],
    operation: null,
    providers: { selectedProviderId: 'github-pages', selectionId: 'story-selection', entries: {} },
    ...patch,
  }
}

const repository = { owner: 'dfosco', name: 'hyperbase', visibility: 'public', branch: 'main' }
const authenticated = { available: true, authenticated: true, account: 'dfosco', cli: { status: 'ready' }, missingScopes: [] }
const pagesUrl = 'https://dfosco.github.io/hyperbase/'

/** GitHub Pages initial states, keyed by the phase derived in deriveGitHubPublishingView. */
export const githubStates = {
  loading: publishingSnapshot({ auth: null }),
  signedOut: publishingSnapshot({ auth: { available: true, authenticated: false, account: null, cli: { status: 'ready' }, hint: 'Connect GitHub to publish this notebook.' } }),
  cliMissing: publishingSnapshot({ auth: { available: false, authenticated: false, cli: { status: 'failed', retryable: true, error: 'download failed', hint: 'Check your connection and retry.' }, hint: 'GitHub CLI isn’t available on this computer.' } }),
  cliInstalling: publishingSnapshot({ auth: { available: false, authenticated: false, cli: { status: 'installing', retryable: false }, hint: 'Hypercanvas is setting up the GitHub CLI.' } }),
  connectedNewRepository: publishingSnapshot({ auth: authenticated }),
  ready: publishingSnapshot({ auth: authenticated, bindings: [{ mode: 'default', repository }] }),
  published: publishingSnapshot({
    auth: authenticated,
    bindings: [{ mode: 'default', repository, remoteState: 'succeeded', pagesUrl, confirmedPagesUrl: pagesUrl, confirmedAccess: 'public' }],
    operation: { id: 'story-op-published', kind: 'publish', status: 'succeeded', result: { remoteState: 'succeeded', pagesUrl, websiteAccess: 'public' } },
  }),
  failed: publishingSnapshot({
    auth: authenticated,
    bindings: [{ mode: 'default', repository }],
    operation: { id: 'story-op-failed', kind: 'publish', status: 'failed', error: { code: 'build', message: 'The Pages build failed.', hint: 'Open the workflow run for details.', runUrl: 'https://github.com/dfosco/hyperbase/actions' }, output: [] },
  }),
}

const disconnected = { status: 'disconnected', credentialPresent: false, account: null, accounts: [], nextCursor: null, checkedAt: null, expiresAt: null, error: null }
const netlifyAccount = { id: 'user_story', name: 'Daniel Fosco', slug: 'dfosco', type: 'user' }
const netlifyCapability = { available: true, tool: 'netlify', version: '17.0.0', hint: null }

/** Netlify initial states; NetlifySetup reads only providers.entries.netlify. */
export const netlifyStates = {
  cliMissing: publishingSnapshot({
    providers: { selectedProviderId: 'netlify', selectionId: 'story-selection', entries: { netlify: { connection: disconnected, loginCapability: { available: false, tool: 'netlify', version: null, hint: 'Install the Netlify CLI to sign in with Netlify.' } } } },
  }),
  notSignedIn: publishingSnapshot({
    providers: { selectedProviderId: 'netlify', selectionId: 'story-selection', entries: { netlify: { connection: disconnected, loginCapability: netlifyCapability } } },
  }),
  connected: publishingSnapshot({
    providers: { selectedProviderId: 'netlify', selectionId: 'story-selection', entries: { netlify: { connection: { status: 'connected', credentialPresent: true, account: netlifyAccount, accounts: [netlifyAccount], nextCursor: null, checkedAt: 'story', expiresAt: null, error: null }, loginCapability: netlifyCapability } } },
  }),
}

/** Header states: the provider strip as PublishingProvider renders it today. */
export const headerStates = {
  noneConfigured: publishingSnapshot(),
  unconfiguredNetlifySelected: publishingSnapshot({
    providers: { selectedProviderId: 'netlify', selectionId: 'story-selection', entries: {} },
  }),
}
