import { applyHideUIFromUrl, toggleNotebookChrome } from '../../core/session/chromeVisibility.js'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { createBrowserRouter, createMemoryRouter, RouterProvider, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ContentFrame from './ContentFrame.jsx'
import {
  forwardPrototypeShortcutEvent,
  isEligiblePrototypeShortcutFrame,
} from './prototypeShortcutBridge.js'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); window.history.replaceState(null, '', '/'); document.documentElement.removeAttribute('class') })

function RoutedFrame({ externalUrlForPath, title }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [orderRevision, setOrderRevision] = useState(0)
  const externalUrl = externalUrlForPath?.(location.pathname)
  return <>
    <output data-testid="route">{location.pathname}</output>
    <output data-testid="order-revision">{orderRevision}</output>
    <button type="button" onClick={() => navigate('/Next.prototype')}>Next route</button>
    <button type="button" onClick={() => navigate('/Remote.prototype')}>Remote route</button>
    <button type="button" onClick={() => setOrderRevision(revision => revision + 1)}>Refresh order</button>
    <ContentFrame kind="prototype" externalUrl={externalUrl} title={title} />
  </>
}

function renderRoutedFrame(initialPath, props = {}) {
  const router = createMemoryRouter([
    { path: '*', Component: () => <RoutedFrame {...props} /> },
  ], { initialEntries: [initialPath] })
  return { router, ...render(<RouterProvider router={router} />) }
}

function postFromFrame(frame, data) {
  const event = new Event('message')
  Object.defineProperties(event, {
    source: { value: frame.contentWindow },
    origin: { value: window.location.origin },
    data: { value: data },
  })
  window.dispatchEvent(event)
}

describe('ContentFrame route lifetime', () => {
  it('keeps the iframe mounted while a child-approved host POP commits', async () => {
    const router = createMemoryRouter([
      {
        Component: () => <ContentFrame kind="prototype" />,
        children: [
          { path: '/Demo', Component: () => null },
          { path: '/Demo/details', Component: () => null },
        ],
      },
    ], { initialEntries: ['/Demo', '/Demo/details'], initialIndex: 1 })

    const { container, unmount } = render(<RouterProvider router={router} />)
    const frame = container.querySelector('iframe')
    const initialSrc = frame.getAttribute('src')
    const posted = []
    vi.spyOn(frame.contentWindow, 'postMessage').mockImplementation(data => posted.push(data))
    expect(initialSrc).toBe('/Demo/details?_sb_embed=')
    await act(async () => postFromFrame(frame, { type: 'storyboard:embed:ready' }))

    await act(async () => { await router.navigate(-1) })
    expect(router.state.location.pathname).toBe('/Demo/details')
    const request = posted.find(data => data.type === 'storyboard:embed:navigate-request')
    expect(request?.target).toBe('/Demo')
    expect(request?.replace).toBe(true)
    const blocker = [...router.state.blockers.values()].find(item => item.state === 'blocked')
    expect(blocker).toBeDefined()
    const proceed = vi.spyOn(blocker, 'proceed')
    await act(async () => postFromFrame(frame, {
      type: 'storyboard:embed:navigate', src: `${window.location.origin}/Demo`, replace: false,
    }))
    expect(router.state.location.pathname).toBe('/Demo/details')
    expect([...router.state.blockers.values()].some(item => item.state === 'blocked')).toBe(true)
    await act(async () => postFromFrame(frame, {
      type: 'storyboard:embed:navigate', id: 'stale-response',
      src: `${window.location.origin}/Demo`,
    }))
    expect(router.state.location.pathname).toBe('/Demo/details')
    await act(async () => postFromFrame(frame, {
      type: 'storyboard:embed:navigate', id: request.id,
      src: `${window.location.origin}/Demo`,
    }))
    expect(proceed).toHaveBeenCalledOnce()

    expect(router.state.location.pathname).toBe('/Demo')
    expect([...router.state.blockers.values()].every(item => item.state !== 'blocked')).toBe(true)
    expect(container.querySelector('iframe')).toBe(frame)
    expect(frame.getAttribute('src')).toBe(initialSrc)
    unmount()
    postFromFrame(frame, {
      type: 'storyboard:embed:navigate',
      src: `${window.location.origin}/Demo/after-unmount`,
    })
    expect(router.state.location.pathname).toBe('/Demo')
  })

  it.each(['/', '/branch--preview/'])('keeps cancellation final and ignores delayed replies at %s', async base => {
    vi.stubEnv('BASE_URL', base)
    const router = createMemoryRouter([
      {
        Component: () => <ContentFrame kind="prototype" />,
        children: [
          { path: '/Demo', Component: () => null },
          { path: '/Demo/details', Component: () => null },
        ],
      },
    ], { initialEntries: ['/Demo'] })

    const { container } = render(<RouterProvider router={router} />)
    const frame = container.querySelector('iframe')
    const posted = []
    vi.spyOn(frame.contentWindow, 'postMessage').mockImplementation(data => posted.push(data))
    await act(async () => postFromFrame(frame, { type: 'storyboard:embed:ready' }))
    await act(async () => { await router.navigate('/Demo/details') })
    const request = posted.find(data => data.type === 'storyboard:embed:navigate-request')
    expect(request).toBeDefined()
    expect(request.replace).toBe(false)
    await act(async () => postFromFrame(frame, { type: 'storyboard:embed:navigate-cancelled', id: request.id }))
    expect(router.state.location.pathname).toBe('/Demo')
    expect([...router.state.blockers.values()].every(item => item.state !== 'blocked')).toBe(true)
    await act(async () => postFromFrame(frame, {
      type: 'storyboard:embed:navigate', id: request.id,
      src: `${window.location.origin}${base}Demo/details`,
    }))
    expect(router.state.location.pathname).toBe('/Demo')
  })
})

function makeShortcutFrame({
  kind = 'prototype',
  marker = true,
  origin = window.location.origin,
  parent = window,
  top = window,
  sandbox = false,
} = {}) {
  const childDocument = document.implementation.createHTMLDocument('child')
  const childWindow = {
    document: childDocument,
    location: { origin },
    parent,
    top,
    postMessage: vi.fn(),
  }
  return {
    childDocument,
    childWindow,
    frame: {
      contentDocument: childDocument,
      contentWindow: childWindow,
      getAttribute: name => name === 'data-hypercanvas-content' && marker ? kind : null,
      hasAttribute: name => name === 'sandbox' && sandbox,
    },
  }
}

function trustedKeydown({ key = 'k', ctrlKey = false, metaKey = true, shiftKey = false, altKey = false } = {}) {
  return {
    isTrusted: true,
    key,
    ctrlKey,
    metaKey,
    shiftKey,
    altKey,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  }
}

describe('ContentFrame direct prototype shortcut bridge', () => {
  it('only accepts the direct same-origin unsandboxed prototype frame', () => {
    expect(isEligiblePrototypeShortcutFrame(makeShortcutFrame().frame, window)).toBe(true)
    expect(isEligiblePrototypeShortcutFrame(makeShortcutFrame({ marker: false }).frame, window)).toBe(false)
    expect(isEligiblePrototypeShortcutFrame(makeShortcutFrame({ kind: 'story' }).frame, window, 'story')).toBe(false)
    expect(isEligiblePrototypeShortcutFrame(makeShortcutFrame({ sandbox: true }).frame, window)).toBe(false)
    expect(isEligiblePrototypeShortcutFrame(makeShortcutFrame({ origin: 'https://elsewhere.test' }).frame, window)).toBe(false)
    expect(isEligiblePrototypeShortcutFrame(makeShortcutFrame({ origin: 'null' }).frame, window)).toBe(false)
    expect(isEligiblePrototypeShortcutFrame(makeShortcutFrame({ parent: {} }).frame, window)).toBe(false)
    expect(isEligiblePrototypeShortcutFrame(makeShortcutFrame({ top: {} }).frame, window)).toBe(false)
  })

  it('forwards trusted canonical k/K and consumes the child event only when the host claims it', () => {
    const hostEvents = []
    const hostHandler = event => {
      hostEvents.push(event)
      if (event.key === 'K') event.preventDefault()
    }
    window.document.addEventListener('keydown', hostHandler)

    const claimed = trustedKeydown({ key: 'K', shiftKey: true, ctrlKey: true, metaKey: false })
    expect(forwardPrototypeShortcutEvent(claimed, window)).toBe(true)
    expect(hostEvents).toHaveLength(1)
    expect(hostEvents[0]).toMatchObject({ key: 'K', code: 'KeyK', ctrlKey: true, shiftKey: true })
    expect(claimed.preventDefault).toHaveBeenCalledOnce()
    expect(claimed.stopImmediatePropagation).toHaveBeenCalledOnce()

    const unclaimed = trustedKeydown({ key: 'k' })
    expect(forwardPrototypeShortcutEvent(unclaimed, window)).toBe(false)
    expect(hostEvents).toHaveLength(2)
    expect(hostEvents[1]).toMatchObject({ key: 'k', code: 'KeyK', metaKey: true, shiftKey: false })
    expect(unclaimed.preventDefault).not.toHaveBeenCalled()
    expect(unclaimed.stopImmediatePropagation).not.toHaveBeenCalled()

    expect(forwardPrototypeShortcutEvent({ ...trustedKeydown(), isTrusted: false }, window)).toBe(false)
    expect(forwardPrototypeShortcutEvent(trustedKeydown({ key: 'x' }), window)).toBe(false)
    expect(forwardPrototypeShortcutEvent(trustedKeydown({ altKey: true }), window)).toBe(false)
    expect(hostEvents).toHaveLength(2)

    window.document.removeEventListener('keydown', hostHandler)
  })

  it('rebinds on load and removes the current child listener on navigation and unmount', async () => {
    const router = createMemoryRouter([
      { path: '/Demo/*', Component: () => <ContentFrame kind="prototype" /> },
    ], { initialEntries: ['/Demo'] })
    const { container, unmount } = render(<RouterProvider router={router} />)
    const frame = container.querySelector('iframe')
    const firstDocument = document.implementation.createHTMLDocument('first child')
    Object.defineProperties(frame, {
      contentDocument: { configurable: true, value: firstDocument },
      contentWindow: {
        configurable: true,
        value: {
          document: firstDocument,
          location: {
            origin: window.location.origin,
            href: `${window.location.origin}/Demo?_sb_embed=`,
            pathname: '/Demo',
            search: '?_sb_embed=',
            hash: '',
            replace: vi.fn(),
          },
          parent: window,
          top: window,
          postMessage: vi.fn(),
        },
      },
    })
    const firstAdd = vi.spyOn(firstDocument, 'addEventListener')
    const firstRemove = vi.spyOn(firstDocument, 'removeEventListener')
    fireEvent.load(frame)
    const firstBinding = firstAdd.mock.calls.find(([type]) => type === 'keydown')
    expect(firstBinding).toBeDefined()
    const hostKeydown = vi.fn(event => {
      if (event.key === 'K') event.preventDefault()
    })
    window.document.addEventListener('keydown', hostKeydown)
    const claimed = trustedKeydown({ key: 'K', shiftKey: true })
    firstBinding[1](claimed)
    expect(hostKeydown).toHaveBeenCalledOnce()
    expect(claimed.preventDefault).toHaveBeenCalledOnce()
    const unclaimed = trustedKeydown({ key: 'k' })
    firstBinding[1](unclaimed)
    expect(hostKeydown).toHaveBeenCalledTimes(2)
    expect(unclaimed.preventDefault).not.toHaveBeenCalled()
    window.document.removeEventListener('keydown', hostKeydown)

    await act(async () => { await router.navigate('/Demo/next') })
    expect(firstRemove).toHaveBeenCalledWith('keydown', firstBinding[1], true)

    const secondDocument = document.implementation.createHTMLDocument('next child')
    const secondWindow = {
      document: secondDocument,
      location: {
        origin: window.location.origin,
        href: `${window.location.origin}/Demo?_sb_embed=`,
        pathname: '/Demo/next',
        search: '?_sb_embed=',
        hash: '',
        replace: vi.fn(),
      },
      parent: window,
      top: window,
      postMessage: vi.fn(),
    }
    const secondAdd = vi.spyOn(secondDocument, 'addEventListener')
    const secondRemove = vi.spyOn(secondDocument, 'removeEventListener')
    Object.defineProperties(frame, {
      contentDocument: { configurable: true, value: secondDocument },
      contentWindow: { configurable: true, value: secondWindow },
    })
    fireEvent.load(frame)
    expect(firstRemove).toHaveBeenCalledWith('keydown', firstBinding[1], true)
    const secondBinding = secondAdd.mock.calls.find(([type]) => type === 'keydown')
    expect(secondBinding).toBeDefined()

    unmount()
    expect(secondRemove).toHaveBeenCalledWith('keydown', secondBinding[1], true)
  })
})

describe('ContentFrame prototype scope lifecycle', () => {
  it('replaces cross-scope children and ignores messages from replaced windows during rapid switching', async () => {
    const router = createMemoryRouter([{ path: '*', Component: () => <ContentFrame /> }], { initialEntries: ['/First/details'] })
    const { container } = render(<RouterProvider router={router} />)
    const first = container.querySelector('iframe')
    const staleWindow = first.contentWindow
    await act(async () => { await router.navigate('/Second?mode=review#body') })
    const second = container.querySelector('iframe')
    expect(second).not.toBe(first)
    expect(second.getAttribute('src')).toContain('/Second?mode=review&_sb_embed=#body')
    await act(async () => { await router.navigate('/Third') })
    expect(container.querySelector('iframe')).not.toBe(second)
    await act(async () => fireEvent(window, new MessageEvent('message', {
      source: staleWindow, origin: window.location.origin,
      data: { type: 'storyboard:embed:navigate', src: '/First/stale' },
    })))
    expect(router.state.location.pathname).toBe('/Third')
    await act(async () => { await router.navigate('/First/details') })
    expect(container.querySelector('iframe')).not.toBe(first)
    expect(container.querySelector('iframe').getAttribute('src')).toContain('/First/details?')
  })

  it('retries an about:blank route on load before announcing or binding the obsolete document', async () => {
    const router = createMemoryRouter([{ path: '*', Component: () => <ContentFrame /> }], { initialEntries: ['/Demo'] })
    const { container } = render(<RouterProvider router={router} />)
    const frame = container.querySelector('iframe')
    const childDocument = document.implementation.createHTMLDocument('loading child')
    const location = { href: 'about:blank', origin: window.location.origin, pathname: '/Demo', search: '?_sb_embed=', hash: '', replace: vi.fn() }
    const postMessage = vi.fn()
    Object.defineProperties(frame, {
      contentDocument: { configurable: true, value: childDocument },
      contentWindow: { configurable: true, value: { document: childDocument, location, postMessage, parent: window, top: window } },
    })
    const add = vi.spyOn(childDocument, 'addEventListener')
    await act(async () => { await router.navigate('/Demo/details?keep=1#section') })
    expect(container.querySelector('iframe')).toBe(frame)
    expect(location.replace).not.toHaveBeenCalled()
    location.href = `${window.location.origin}/Demo?_sb_embed=`
    fireEvent.load(frame)
    expect(location.replace).toHaveBeenCalledWith('/Demo/details?keep=1&_sb_embed=#section')
    expect(postMessage).not.toHaveBeenCalled()
    expect(add.mock.calls.some(([name]) => name === 'keydown')).toBe(false)
    Object.assign(location, { href: `${window.location.origin}/Demo/details?keep=1&_sb_embed=#section`, pathname: '/Demo/details', search: '?keep=1&_sb_embed=', hash: '#section' })
    fireEvent.load(frame)
    expect(postMessage).toHaveBeenCalledWith({ type: 'storyboard:embed:hello' }, window.location.origin)
    expect(add.mock.calls.some(([name]) => name === 'keydown')).toBe(true)
  })
})

describe('ContentFrame external prototype URLs', () => {
  it('uses an external URL directly, labels it, and skips same-origin bridge and location sync', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    renderRoutedFrame('/Remote.prototype', {
      externalUrlForPath: () => 'https://remote.example.test/preview?mode=compact',
      title: 'Remote prototype',
    })

    const frame = screen.getByTitle('Remote prototype')
    expect(frame).toHaveAttribute('src', 'https://remote.example.test/preview?mode=compact')
    expect(addEventListener).not.toHaveBeenCalledWith('message', expect.any(Function))
    expect(removeEventListener).not.toHaveBeenCalledWith('message', expect.any(Function))
  })

  it('updates external routes and keeps the frame element for same-route refreshes', () => {
    renderRoutedFrame('/Remote.prototype', {
      externalUrlForPath: pathname => pathname === '/Next.prototype'
        ? 'https://remote.example.test/next'
        : 'https://remote.example.test/preview',
      title: 'Remote prototype',
    })

    const frame = screen.getByTitle('Remote prototype')
    expect(frame).toHaveAttribute('src', 'https://remote.example.test/preview')

    fireEvent.click(screen.getByRole('button', { name: 'Next route' }))
    expect(screen.getByTestId('route')).toHaveTextContent('/Next.prototype')
    expect(screen.getByTitle('Remote prototype')).toBe(frame)
    expect(frame).toHaveAttribute('src', 'https://remote.example.test/next')

    fireEvent.click(screen.getByRole('button', { name: 'Refresh order' }))
    expect(screen.getByTestId('order-revision')).toHaveTextContent('1')
    expect(screen.getByTitle('Remote prototype')).toBe(frame)
    expect(frame).toHaveAttribute('src', 'https://remote.example.test/next')

    fireEvent.click(screen.getByRole('button', { name: 'Remote route' }))
    expect(screen.getByTitle('Remote prototype')).toBe(frame)
    expect(frame).toHaveAttribute('src', 'https://remote.example.test/preview')
  })

  it('keeps the same-origin embed URL and navigation bridge when no external URL is supplied', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    renderRoutedFrame('/Guide.prototype?tab=overview#intro')

    const frame = screen.getByTitle('Prototype preview')
    expect(frame.getAttribute('src')).toContain('/Guide.prototype?tab=overview&_sb_embed=#intro')
    expect(addEventListener).toHaveBeenCalledWith('message', expect.any(Function))

    fireEvent(window, new MessageEvent('message', {
      source: frame.contentWindow,
      origin: window.location.origin,
      data: { type: 'storyboard:embed:navigate', src: '/Next.prototype?from=child#section' },
    }))
    expect(screen.getByTestId('route')).toHaveTextContent('/Next.prototype')
  })
})

it.each(['hideUI', 'removeUI', 'removeUI&showTools', 'hideUI&showTools'])('keeps %s in the host across iframe navigation and view changes without reloading content', async flags => {
  window.history.replaceState(null, '', `/Demo?${flags}&keep=1`)
  const router = createMemoryRouter([{ path: '*', Component: () => <ContentFrame /> }], { initialEntries: [`/Demo?${flags}&keep=1`] })
  const { container } = render(<RouterProvider router={router} />)
  const frame = container.querySelector('iframe')
  for (const flag of ['hideUI', 'removeUI', 'showTools']) expect(frame.getAttribute('src')).not.toContain(flag)
  const childDocument = document.implementation.createHTMLDocument('authored child')
  const location = { href: `${window.location.origin}/Demo?keep=1&_sb_embed=`, origin: window.location.origin, pathname: '/Demo', search: '?keep=1&_sb_embed=', hash: '', replace: vi.fn() }
  const childWindow = { document: childDocument, location, postMessage: vi.fn(), parent: window, top: window }
  Object.defineProperties(frame, {
    contentDocument: { configurable: true, value: childDocument },
    contentWindow: { configurable: true, value: childWindow },
  })
  fireEvent.load(frame)
  await act(async () => { await router.navigate('/Demo?keep=1') })
  expect(container.querySelector('iframe')).toBe(frame)
  expect(location.replace).not.toHaveBeenCalled()
  await act(async () => { await router.navigate(`/Demo?keep=1&${flags}`) })
  Object.assign(location, { href: `${window.location.origin}/Demo/details?keep=1&_sb_embed=`, pathname: '/Demo/details' })
  await act(async () => fireEvent(window, new MessageEvent('message', {
    source: childWindow, origin: window.location.origin,
    data: { type: 'storyboard:embed:navigate', src: '/Demo/details?keep=1' },
  })))
  expect(router.state.location.pathname).toBe('/Demo/details')
  for (const flag of flags.split('&')) expect(new URLSearchParams(router.state.location.search).has(flag)).toBe(true)
  expect(location.replace).not.toHaveBeenCalled()
})


it('uses the current browser view after lightbulb recovery during child navigation without reloading its document', async () => {
  window.history.replaceState(null, '', '/Demo?hideUI&flow=empty#title=Keep')
  applyHideUIFromUrl()
  const router = createBrowserRouter([{ path: '*', Component: () => <ContentFrame /> }])
  const { container, unmount } = render(<RouterProvider router={router} />)
  const frame = container.querySelector('iframe')
  const childDocument = document.implementation.createHTMLDocument('authored child')
  const location = { href: `${window.location.origin}/Demo?flow=empty&_sb_embed=#title=Keep`, origin: window.location.origin, pathname: '/Demo', search: '?flow=empty&_sb_embed=', hash: '#title=Keep', replace: vi.fn() }
  const childWindow = { document: childDocument, location, postMessage: vi.fn(), parent: window, top: window }
  Object.defineProperties(frame, {
    contentDocument: { configurable: true, value: childDocument },
    contentWindow: { configurable: true, value: childWindow },
  })
  fireEvent.load(frame)
  await act(async () => { toggleNotebookChrome() })
  expect(router.state.location.search).toBe('?flow=empty')
  expect(window.location.search).toBe('?flow=empty')
  expect(container.querySelector('iframe')).toBe(frame)
  expect(location.replace).not.toHaveBeenCalled()
  Object.assign(location, { href: `${window.location.origin}/Demo/details?flow=empty&_sb_embed=#title=Keep`, pathname: '/Demo/details' })
  await act(async () => fireEvent(window, new MessageEvent('message', {
    source: childWindow, origin: window.location.origin,
    data: { type: 'storyboard:embed:navigate', src: '/Demo/details?flow=empty#title=Keep' },
  })))
  expect(router.state.location.pathname).toBe('/Demo/details')
  expect(router.state.location.search).toBe('?flow=empty')
  expect(window.location.hash).toBe('#title=Keep')
  expect(container.querySelector('iframe')).toBe(frame)
  expect(location.replace).not.toHaveBeenCalled()
  unmount()
  router.dispose()
})
