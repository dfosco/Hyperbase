import NotebookSidebarTree from './NotebookSidebarTree.jsx'

const storyPage = {
  id: 'welcome-page', type: 'prototype', title: 'Welcome', route: '/welcome', path: 'prototypes/Welcome.prototype', available: true,
}

const tree = {
  capabilities: { reorderSiblings: true },
  root: {
    kind: 'folder', ref: null, name: 'Notebook', path: '', parentPath: null, depth: 0,
    capabilities: { reorderSiblings: true },
    children: [{
      kind: 'folder', ref: { kind: 'folder', path: 'prototypes' }, name: 'prototypes', path: 'prototypes', parentPath: '', depth: 1,
      capabilities: { reorderSiblings: true }, children: [{
        kind: 'folder', ref: { kind: 'folder', path: 'prototypes/guides' }, name: 'guides', path: 'prototypes/guides', parentPath: 'prototypes', depth: 2,
        capabilities: { reorderSiblings: true }, children: [{
          kind: 'folder', ref: { kind: 'folder', path: 'prototypes/guides/onboarding' }, name: 'onboarding', path: 'prototypes/guides/onboarding', parentPath: 'prototypes/guides', depth: 3,
          capabilities: { reorderSiblings: true }, children: [{
            kind: 'artifact', ref: { kind: 'artifact', id: storyPage.id }, id: storyPage.id, pageId: storyPage.id, artifactKind: 'prototype',
            name: 'Welcome.prototype', title: 'Welcome', path: 'prototypes/guides/onboarding/Welcome.prototype', parentPath: 'prototypes/guides/onboarding', depth: 4,
            payloadPath: 'prototypes/guides/onboarding/Welcome.prototype/index.jsx', route: '/welcome', siteId: null, available: true, diagnostics: [],
          }],
        }],
      }],
    }],
  },
}

export function Default() {
  return <div style={{ width: 320, height: 540, border: '1px solid #d0d7de' }}>
    <NotebookSidebarTree tree={tree} pages={[storyPage]} activePageId={storyPage.id} onOpenPage={() => {}} />
  </div>
}
