import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  mountIsolatedContent: vi.fn(),
  installNavigationBridge: vi.fn(),
  createRoot: vi.fn(),
  createRouter: vi.fn(),
  navigationDispose: vi.fn(),
  contentDispose: vi.fn(),
  routerDispose: vi.fn(),
}))

vi.mock('react-dom/client', () => ({ createRoot: mocks.createRoot }))
vi.mock('react-router-dom', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, createBrowserRouter: mocks.createRouter }
})
vi.mock('../../../core/mountIsolatedContent.js', () => ({ mountIsolatedContent: mocks.mountIsolatedContent }))
vi.mock('../../loadConsumerWrapper.js', () => ({ getPrototypeWrapper: vi.fn(() => function Wrapper({ children }) { return children }) }))
vi.mock('./contentNavigationBridge.js', () => ({ installContentNavigationBridge: mocks.installNavigationBridge }))

import { mountIsolationApp } from './mountIsolationApp.jsx'

describe('mountIsolationApp document registration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = '<div id="root"></div>'
    mocks.contentDispose.mockReset()
    mocks.navigationDispose.mockReset()
    mocks.routerDispose.mockReset()
    mocks.mountIsolatedContent.mockReturnValue(mocks.contentDispose)
    mocks.installNavigationBridge.mockReturnValue(mocks.navigationDispose)
    mocks.createRoot.mockReturnValue({ render: vi.fn() })
    mocks.createRouter.mockImplementation(() => ({ dispose: mocks.routerDispose }))
  })

  it('registers prototype and story documents with distinct actual roles and router cleanup', () => {
    mountIsolationApp({ name: 'prototypes.html', wrapperKind: 'prototype', routes: [] })
    const prototypeRouter = mocks.createRouter.mock.results[0].value
    mountIsolationApp({ name: 'stories.html', wrapperKind: 'story', routes: [] })
    const storyRouter = mocks.createRouter.mock.results[1].value

    expect(mocks.mountIsolatedContent).toHaveBeenNthCalledWith(1, expect.objectContaining({ role: 'prototype-content' }))
    expect(mocks.mountIsolatedContent).toHaveBeenNthCalledWith(2, expect.objectContaining({ role: 'story-content' }))
    prototypeRouter.dispose()
    storyRouter.dispose()
    expect(mocks.contentDispose).toHaveBeenCalledTimes(2)
    expect(mocks.navigationDispose).toHaveBeenCalledTimes(2)
    expect(mocks.routerDispose).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['100%25%20Ready.prototype', '100% Ready.prototype'],
    ['Rate%2520.prototype', 'Rate%20.prototype'],
    ['bad%prototype', 'bad%prototype'],
    ['bad%2Froot.prototype', 'bad%2Froot.prototype'],
  ])('selects one physical route root from URL segment %s', (encoded, physical) => {
    window.history.replaceState(null, '', `/${encoded}?_sb_embed=`)
    const resolveRoutes = vi.fn(() => [])
    mountIsolationApp({ name: '', resolveRoutes })
    expect(resolveRoutes).toHaveBeenCalledWith(expect.objectContaining({ firstSegment: physical }))
  })
})

// Isolated entries preserve caller URL state.
it('does not rewrite hideUI to an embed instruction on isolated entry URLs', () => {
  document.body.innerHTML = '<div id="root"></div>'
  window.history.replaceState(null, '', '/prototypes.html/Demo?hideUI&flow=empty#tab=profile')
  mocks.mountIsolatedContent.mockReturnValue(mocks.contentDispose)
  mocks.installNavigationBridge.mockReturnValue(mocks.navigationDispose)
  mocks.createRoot.mockReturnValue({ render: vi.fn() })
  mocks.createRouter.mockReturnValue({ dispose: mocks.routerDispose })
  mountIsolationApp({ name: 'prototypes.html', routes: [] })
  expect(window.location.search).toBe('?hideUI&flow=empty')
  expect(window.location.hash).toBe('#tab=profile')
})
