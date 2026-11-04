import PublishFiles from './PublishFiles.jsx'
import documents from './documents.json'

export const NotebookConfig = { name: 'NotebookConfig', render: () => <PublishFiles document={documents[0]}/> }
export const PortablePackage = { name: 'PortablePackage', render: () => <PublishFiles document={documents[1]}/> }
export const PortableVite = { name: 'PortableVite', render: () => <PublishFiles document={documents[2]}/> }
export const PrepareOutput = { name: 'PrepareOutput', render: () => <PublishFiles document={documents[3]}/> }
export const PortableIgnore = { name: 'PortableIgnore', render: () => <PublishFiles document={documents[4]}/> }
export const LockBoundary = { name: 'LockBoundary', render: () => <PublishFiles document={documents[5]}/> }
export const PagesWorkflow = { name: 'PagesWorkflow', render: () => <PublishFiles document={documents[6]}/> }
export const VercelConfig = { name: 'VercelConfig', render: () => <PublishFiles document={documents[7]}/> }
export const NetlifyConfig = { name: 'NetlifyConfig', render: () => <PublishFiles document={documents[8]}/> }
export const NetlifyRedirects = { name: 'NetlifyRedirects', render: () => <PublishFiles document={documents[9]}/> }
export const Cloudflare404 = { name: 'Cloudflare404', render: () => <PublishFiles document={documents[10]}/> }
export const PagesRemote = { name: 'PagesRemote', render: () => <PublishFiles document={documents[11]}/> }
export const VercelRemote = { name: 'VercelRemote', render: () => <PublishFiles document={documents[12]}/> }
export const NetlifyRemote = { name: 'NetlifyRemote', render: () => <PublishFiles document={documents[13]}/> }
export const CloudflareProject = { name: 'CloudflareProject', render: () => <PublishFiles document={documents[14]}/> }
export const CloudflareAccess = { name: 'CloudflareAccess', render: () => <PublishFiles document={documents[15]}/> }
export const RuntimeBinding = { name: 'RuntimeBinding', render: () => <PublishFiles document={documents[16]}/> }
export const RuntimeOperation = { name: 'RuntimeOperation', render: () => <PublishFiles document={documents[17]}/> }
export const Authorization = { name: 'Authorization', render: () => <PublishFiles document={documents[18]}/> }
export const ExistingReadme = { name: 'ExistingReadme', render: () => <PublishFiles document={documents[19]}/> }

export const PortableRegistry = { name: 'PortableRegistry', render: () => <PublishFiles document={documents[20]}/> }
export const PagesMarker = { name: 'PagesMarker', render: () => <PublishFiles document={documents[21]}/> }
