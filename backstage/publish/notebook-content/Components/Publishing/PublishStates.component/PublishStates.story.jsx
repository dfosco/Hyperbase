import PublishStates from './PublishStates.jsx'

export const ToolFirstUse = { name: 'ToolFirstUse', render: () => <PublishStates initialState="ToolFirstUse" initialProvider="GitHub" initialAccess="public"/> }
export const ToolMenu = { name: 'ToolMenu', render: () => <PublishStates initialState="ToolMenu" initialProvider="GitHub" initialAccess="public"/> }
export const ToolSetupFailed = { name: 'ToolSetupFailed', render: () => <PublishStates initialState="ToolSetupFailed" initialProvider="GitHub" initialAccess="public"/> }
export const GitDisconnected = { name: 'GitDisconnected', render: () => <PublishStates initialState="GitDisconnected" initialProvider="GitHub" initialAccess="public"/> }
export const GitAuthorize = { name: 'GitAuthorize', render: () => <PublishStates initialState="GitAuthorize" initialProvider="GitHub" initialAccess="public"/> }
export const GitAuthFailed = { name: 'GitAuthFailed', render: () => <PublishStates initialState="GitAuthFailed" initialProvider="GitHub" initialAccess="public"/> }
export const GitAuthCancelled = { name: 'GitAuthCancelled', render: () => <PublishStates initialState="GitAuthCancelled" initialProvider="GitHub" initialAccess="public"/> }
export const RepositoryCreate = { name: 'RepositoryCreate', render: () => <PublishStates initialState="RepositoryCreate" initialProvider="GitHub" initialAccess="public"/> }
// Compatibility for saved story URLs from before repository setup gained explicit states.
export const ConnectRepository = { ...RepositoryCreate, name: 'ConnectRepository' }
export const RepositoryExisting = { name: 'RepositoryExisting', render: () => <PublishStates initialState="RepositoryExisting" initialProvider="GitHub" initialAccess="public"/> }
export const RepositoryConflict = { name: 'RepositoryConflict', render: () => <PublishStates initialState="RepositoryConflict" initialProvider="GitHub" initialAccess="public"/> }
export const HostSelect = { name: 'HostSelect', render: () => <PublishStates initialState="HostSelect" initialProvider="GitHub" initialAccess="public"/> }
export const ProviderTabs = { name: 'ProviderTabs', render: () => <PublishStates initialState="Changes" initialProvider="GitHub" initialAccess="public" multiple/> }
export const PublishingSettings = { name: 'PublishingSettings', render: () => <PublishStates initialState="Settings" initialProvider="GitHub" initialAccess="public" multiple/> }
export const InspectorDockSide = { name: 'InspectorDockSide', render: () => <PublishStates initialState="InspectorDockSide" initialProvider="GitHub" initialAccess="public" inspector/> }
export const InspectorDockBottom = { name: 'InspectorDockBottom', render: () => <PublishStates initialState="InspectorDockBottom" initialProvider="GitHub" initialAccess="public" inspector/> }
export const GitHubConfigure = { name: 'GitHubConfigure', render: () => <PublishStates initialState="Configure" initialProvider="GitHub" initialAccess="public"/> }
export const GitHubConfigReview = { name: 'GitHubConfigReview', render: () => <PublishStates initialState="ConfigReview" initialProvider="GitHub" initialAccess="public"/> }
export const GitHubAutoPublishConflict = { name: 'GitHubAutoPublishConflict', render: () => <PublishStates initialState="AutoPublishConflict" initialProvider="GitHub" initialAccess="public"/> }
export const GitHubDeploying = { name: 'GitHubDeploying', render: () => <PublishStates initialState="Deploying" initialProvider="GitHub" initialAccess="public"/> }
export const GitHubLive = { name: 'GitHubLive', render: () => <PublishStates initialState="Live" initialProvider="GitHub" initialAccess="public"/> }
export const GitHubChanges = { name: 'GitHubChanges', render: () => <PublishStates initialState="Changes" initialProvider="GitHub" initialAccess="public"/> }
export const GitHubFailed = { name: 'GitHubFailed', render: () => <PublishStates initialState="Failed" initialProvider="GitHub" initialAccess="public"/> }
export const GitHubCancelled = { name: 'GitHubCancelled', render: () => <PublishStates initialState="Cancelled" initialProvider="GitHub" initialAccess="public"/> }
export const GitHubSettings = { name: 'GitHubSettings', render: () => <PublishStates initialState="Settings" initialProvider="GitHub" initialAccess="public"/> }
export const GitHubAccessReview = { name: 'GitHubAccessReview', render: () => <PublishStates initialState="AccessReview" initialProvider="GitHub" initialAccess="private"/> }
export const VercelAuthorize = { name: 'VercelAuthorize', render: () => <PublishStates initialState="Authorize" initialProvider="Vercel" initialAccess="public"/> }
export const VercelAuthFailed = { name: 'VercelAuthFailed', render: () => <PublishStates initialState="AuthFailed" initialProvider="Vercel" initialAccess="public"/> }
export const VercelAuthCancelled = { name: 'VercelAuthCancelled', render: () => <PublishStates initialState="AuthCancelled" initialProvider="Vercel" initialAccess="public"/> }
export const VercelConfigure = { name: 'VercelConfigure', render: () => <PublishStates initialState="Configure" initialProvider="Vercel" initialAccess="public"/> }
export const VercelConfigReview = { name: 'VercelConfigReview', render: () => <PublishStates initialState="ConfigReview" initialProvider="Vercel" initialAccess="public"/> }
export const VercelAutoPublishConflict = { name: 'VercelAutoPublishConflict', render: () => <PublishStates initialState="AutoPublishConflict" initialProvider="Vercel" initialAccess="public"/> }
export const VercelDeploying = { name: 'VercelDeploying', render: () => <PublishStates initialState="Deploying" initialProvider="Vercel" initialAccess="public"/> }
export const VercelLive = { name: 'VercelLive', render: () => <PublishStates initialState="Live" initialProvider="Vercel" initialAccess="public"/> }
export const VercelChanges = { name: 'VercelChanges', render: () => <PublishStates initialState="Changes" initialProvider="Vercel" initialAccess="public"/> }
export const VercelFailed = { name: 'VercelFailed', render: () => <PublishStates initialState="Failed" initialProvider="Vercel" initialAccess="public"/> }
export const VercelCancelled = { name: 'VercelCancelled', render: () => <PublishStates initialState="Cancelled" initialProvider="Vercel" initialAccess="public"/> }
export const VercelSettings = { name: 'VercelSettings', render: () => <PublishStates initialState="Settings" initialProvider="Vercel" initialAccess="public"/> }
export const VercelAccessReview = { name: 'VercelAccessReview', render: () => <PublishStates initialState="AccessReview" initialProvider="Vercel" initialAccess="private"/> }
export const NetlifyAuthorize = { name: 'NetlifyAuthorize', render: () => <PublishStates initialState="Authorize" initialProvider="Netlify" initialAccess="public"/> }
export const NetlifyAuthFailed = { name: 'NetlifyAuthFailed', render: () => <PublishStates initialState="AuthFailed" initialProvider="Netlify" initialAccess="public"/> }
export const NetlifyAuthCancelled = { name: 'NetlifyAuthCancelled', render: () => <PublishStates initialState="AuthCancelled" initialProvider="Netlify" initialAccess="public"/> }
export const NetlifyConfigure = { name: 'NetlifyConfigure', render: () => <PublishStates initialState="Configure" initialProvider="Netlify" initialAccess="public"/> }
export const NetlifyConfigReview = { name: 'NetlifyConfigReview', render: () => <PublishStates initialState="ConfigReview" initialProvider="Netlify" initialAccess="public"/> }
export const NetlifyAutoPublishConflict = { name: 'NetlifyAutoPublishConflict', render: () => <PublishStates initialState="AutoPublishConflict" initialProvider="Netlify" initialAccess="public"/> }
export const NetlifyDeploying = { name: 'NetlifyDeploying', render: () => <PublishStates initialState="Deploying" initialProvider="Netlify" initialAccess="public"/> }
export const NetlifyLive = { name: 'NetlifyLive', render: () => <PublishStates initialState="Live" initialProvider="Netlify" initialAccess="public"/> }
export const NetlifyChanges = { name: 'NetlifyChanges', render: () => <PublishStates initialState="Changes" initialProvider="Netlify" initialAccess="public"/> }
export const NetlifyFailed = { name: 'NetlifyFailed', render: () => <PublishStates initialState="Failed" initialProvider="Netlify" initialAccess="public"/> }
export const NetlifyCancelled = { name: 'NetlifyCancelled', render: () => <PublishStates initialState="Cancelled" initialProvider="Netlify" initialAccess="public"/> }
export const NetlifySettings = { name: 'NetlifySettings', render: () => <PublishStates initialState="Settings" initialProvider="Netlify" initialAccess="public"/> }
export const NetlifyAccessReview = { name: 'NetlifyAccessReview', render: () => <PublishStates initialState="AccessReview" initialProvider="Netlify" initialAccess="private"/> }
export const CloudflareAuthorize = { name: 'CloudflareAuthorize', render: () => <PublishStates initialState="Authorize" initialProvider="Cloudflare" initialAccess="public"/> }
export const CloudflareAuthFailed = { name: 'CloudflareAuthFailed', render: () => <PublishStates initialState="AuthFailed" initialProvider="Cloudflare" initialAccess="public"/> }
export const CloudflareAuthCancelled = { name: 'CloudflareAuthCancelled', render: () => <PublishStates initialState="AuthCancelled" initialProvider="Cloudflare" initialAccess="public"/> }
export const CloudflareConfigure = { name: 'CloudflareConfigure', render: () => <PublishStates initialState="Configure" initialProvider="Cloudflare" initialAccess="public"/> }
export const CloudflareConfigReview = { name: 'CloudflareConfigReview', render: () => <PublishStates initialState="ConfigReview" initialProvider="Cloudflare" initialAccess="public"/> }
export const CloudflareAutoPublishConflict = { name: 'CloudflareAutoPublishConflict', render: () => <PublishStates initialState="AutoPublishConflict" initialProvider="Cloudflare" initialAccess="public"/> }
export const CloudflareDeploying = { name: 'CloudflareDeploying', render: () => <PublishStates initialState="Deploying" initialProvider="Cloudflare" initialAccess="public"/> }
export const CloudflareLive = { name: 'CloudflareLive', render: () => <PublishStates initialState="Live" initialProvider="Cloudflare" initialAccess="public"/> }
export const CloudflareChanges = { name: 'CloudflareChanges', render: () => <PublishStates initialState="Changes" initialProvider="Cloudflare" initialAccess="public"/> }
export const CloudflareFailed = { name: 'CloudflareFailed', render: () => <PublishStates initialState="Failed" initialProvider="Cloudflare" initialAccess="public"/> }
export const CloudflareCancelled = { name: 'CloudflareCancelled', render: () => <PublishStates initialState="Cancelled" initialProvider="Cloudflare" initialAccess="public"/> }
export const CloudflareSettings = { name: 'CloudflareSettings', render: () => <PublishStates initialState="Settings" initialProvider="Cloudflare" initialAccess="public"/> }
export const CloudflareAccessReview = { name: 'CloudflareAccessReview', render: () => <PublishStates initialState="AccessReview" initialProvider="Cloudflare" initialAccess="private"/> }
export const GitHubProtectedLive = { name: 'GitHubProtectedLive', render: () => <PublishStates initialState="Live" initialProvider="GitHub" initialAccess="private"/> }
export const VercelProtectedLive = { name: 'VercelProtectedLive', render: () => <PublishStates initialState="Live" initialProvider="Vercel" initialAccess="private"/> }
export const NetlifyProtectedLive = { name: 'NetlifyProtectedLive', render: () => <PublishStates initialState="Live" initialProvider="Netlify" initialAccess="private"/> }
export const CloudflareProtectedLive = { name: 'CloudflareProtectedLive', render: () => <PublishStates initialState="Live" initialProvider="Cloudflare" initialAccess="private"/> }

export const PublishWelcome = { name: 'PublishWelcome', render: () => <PublishStates initialState="ToolFirstUse" initialSurface="panel"/> }
export const RepositoryPush = { name: 'RepositoryPush', render: () => <PublishStates initialState="RepositoryPush"/> }
export const RepositoryPushing = { name: 'RepositoryPushing', render: () => <PublishStates initialState="RepositoryPushing"/> }
export const RepositoryPushed = { name: 'RepositoryPushed', render: () => <PublishStates initialState="RepositoryPushed"/> }
export const RepositoryPushFailed = { name: 'RepositoryPushFailed', render: () => <PublishStates initialState="RepositoryPushFailed"/> }
export const RepositoryPushCancelled = { name: 'RepositoryPushCancelled', render: () => <PublishStates initialState="RepositoryPushCancelled"/> }
