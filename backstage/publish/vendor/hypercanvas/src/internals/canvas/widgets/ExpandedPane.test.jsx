import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExpandedPane from './ExpandedPane.jsx'

const { acquireIframePointerLock, releaseIframePointerLock } = vi.hoisted(() => ({
  acquireIframePointerLock: vi.fn(),
  releaseIframePointerLock: vi.fn(),
}))

vi.mock('../iframePointerLock.js', () => ({ acquireIframePointerLock }))

// Mock createPortal to render inline for testing
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom')
  return {
    ...actual,
    createPortal: (children) => children,
  }
})

// Polyfill ResizeObserver for jsdom
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    constructor(cb) { this._cb = cb }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

function makeReactPane(id, label = `Pane ${id}`) {
  return {
    id,
    label,
    kind: 'react',
    render: () => <div data-testid={`content-${id}`}>{label} content</div>,
  }
}

function makeExternalPane(id, label = `External ${id}`) {
  const detach = vi.fn()
  const attach = vi.fn(() => detach)
  const onResize = vi.fn()
  return {
    pane: { id, label, kind: 'external', attach, onResize },
    attach,
    detach,
    onResize,
  }
}

describe('ExpandedPane', () => {
  beforeEach(() => {
    acquireIframePointerLock.mockReset()
    releaseIframePointerLock.mockReset()
    acquireIframePointerLock.mockReturnValue(releaseIframePointerLock)
  })

  describe('single-pane modal variant', () => {
    it('renders modal container with title and content', () => {
      const pane = makeReactPane('md-1', 'Markdown · Notes')
      render(<ExpandedPane initialPanes={[pane]} variant="modal" onClose={vi.fn()} />)
      expect(screen.getByText('Markdown · Notes')).toBeTruthy()
      expect(screen.getByText('Markdown · Notes content')).toBeTruthy()
      expect(screen.getByLabelText('Close expanded view')).toBeTruthy()
    })

    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn()
      render(<ExpandedPane initialPanes={[makeReactPane('md-1')]} variant="modal" onClose={onClose} />)
      fireEvent.click(screen.getByLabelText('Close expanded view'))
      expect(onClose).toHaveBeenCalledOnce()
    })

    it('calls onClose on Escape key', () => {
      const onClose = vi.fn()
      render(<ExpandedPane initialPanes={[makeReactPane('md-1')]} variant="modal" onClose={onClose} />)
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  describe('single-pane full variant', () => {
    it('renders full-screen container with top bar', () => {
      const pane = makeReactPane('term-1', 'Terminal · wren')
      render(<ExpandedPane initialPanes={[pane]} variant="full" onClose={vi.fn()} />)
      expect(screen.getByText('Terminal · wren')).toBeTruthy()
      expect(screen.getByText('Terminal · wren content')).toBeTruthy()
      expect(screen.getByLabelText('Close expanded view')).toBeTruthy()
    })
  })

  describe('multi-pane (split) layout', () => {
    it('renders both panes with grid layout', () => {
      const paneA = makeReactPane('term-1', 'Terminal · wren')
      const paneB = makeReactPane('proto-1', 'Prototype · /Signup')
      const { container } = render(
        <ExpandedPane initialPanes={[paneA, paneB]} variant="full" onClose={vi.fn()} />
      )
      expect(screen.getByText('Terminal · wren content')).toBeTruthy()
      expect(screen.getByText('Prototype · /Signup content')).toBeTruthy()
      // Check grid exists
      const grid = container.querySelector('[class*="grid"]')
      expect(grid).toBeTruthy()
    })

    it('renders 3 panes', () => {
      const panes = [
        makeReactPane('a', 'Pane A'),
        makeReactPane('b', 'Pane B'),
        makeReactPane('c', 'Pane C'),
      ]
      render(<ExpandedPane initialPanes={panes} variant="full" onClose={vi.fn()} />)
      expect(screen.getByText('Pane A content')).toBeTruthy()
      expect(screen.getByText('Pane B content')).toBeTruthy()
      expect(screen.getByText('Pane C content')).toBeTruthy()
    })

    it('renders both pane labels in their respective panes', () => {
      const paneA = makeReactPane('term-1', 'Terminal · wren')
      const paneB = makeReactPane('proto-1', 'Prototype · /Signup')
      render(
        <ExpandedPane initialPanes={[paneA, paneB]} variant="full" onClose={vi.fn()} />
      )
      // Each pane has its own title bar with left-aligned label
      expect(screen.getByText('Terminal · wren')).toBeTruthy()
      expect(screen.getByText('Prototype · /Signup')).toBeTruthy()
    })

    it('renders divider between panes', () => {
      const panes = [makeReactPane('a'), makeReactPane('b')]
      const { container } = render(
        <ExpandedPane initialPanes={panes} variant="full" onClose={vi.fn()} />
      )
      const dividers = container.querySelectorAll('[role="separator"]')
      expect(dividers.length).toBe(1)
    })

    it('renders N-1 dividers for N panes', () => {
      const panes = [makeReactPane('a'), makeReactPane('b'), makeReactPane('c')]
      const { container } = render(
        <ExpandedPane initialPanes={panes} variant="full" onClose={vi.fn()} />
      )
      const dividers = container.querySelectorAll('[role="separator"]')
      expect(dividers.length).toBe(2)
    })
  })

  describe('external pane attach/detach', () => {
    it('calls attach with container element on mount', async () => {
      const { pane, attach } = makeExternalPane('term-1')
      render(<ExpandedPane initialPanes={[pane]} variant="full" onClose={vi.fn()} />)
      // useLayoutEffect runs synchronously in test
      expect(attach).toHaveBeenCalledOnce()
      expect(attach.mock.calls[0][0]).toBeInstanceOf(HTMLElement)
    })

    it('calls detach on unmount', () => {
      const { pane, detach } = makeExternalPane('term-1')
      const { unmount } = render(
        <ExpandedPane initialPanes={[pane]} variant="full" onClose={vi.fn()} />
      )
      unmount()
      expect(detach).toHaveBeenCalled()
    })
  })

  describe('returns null for empty panes', () => {
    it('returns null when no panes provided', () => {
      const { container } = render(
        <ExpandedPane initialPanes={[]} variant="modal" onClose={vi.fn()} />
      )
      // Modal variant with no panes returns null
      expect(container.innerHTML).toBe('')
    })
  })

  describe('initialLayout (2D layout)', () => {
    it('renders 2 columns from initialLayout', () => {
      const layout = [
        [makeReactPane('a', 'Left')],
        [makeReactPane('b', 'Right')],
      ]
      const { container } = render(
        <ExpandedPane initialLayout={layout} variant="full" onClose={vi.fn()} />
      )
      expect(screen.getByText('Left content')).toBeTruthy()
      expect(screen.getByText('Right content')).toBeTruthy()
      const grid = container.querySelector('[class*="grid"]')
      expect(grid).toBeTruthy()
    })

    it('renders 3 panes: 1 column + 2-row column', () => {
      const layout = [
        [makeReactPane('a', 'Left')],
        [makeReactPane('b', 'Top Right'), makeReactPane('c', 'Bottom Right')],
      ]
      render(
        <ExpandedPane initialLayout={layout} variant="full" onClose={vi.fn()} />
      )
      expect(screen.getByText('Left content')).toBeTruthy()
      expect(screen.getByText('Top Right content')).toBeTruthy()
      expect(screen.getByText('Bottom Right content')).toBeTruthy()
    })

    it('renders 4 panes in 2×2 grid', () => {
      const layout = [
        [makeReactPane('a', 'TL'), makeReactPane('b', 'BL')],
        [makeReactPane('c', 'TR'), makeReactPane('d', 'BR')],
      ]
      render(
        <ExpandedPane initialLayout={layout} variant="full" onClose={vi.fn()} />
      )
      expect(screen.getByText('TL content')).toBeTruthy()
      expect(screen.getByText('BL content')).toBeTruthy()
      expect(screen.getByText('TR content')).toBeTruthy()
      expect(screen.getByText('BR content')).toBeTruthy()
    })

    it('renders column divider between columns', () => {
      const layout = [
        [makeReactPane('a')],
        [makeReactPane('b')],
      ]
      const { container } = render(
        <ExpandedPane initialLayout={layout} variant="full" onClose={vi.fn()} />
      )
      const vSeparators = container.querySelectorAll('[role="separator"][aria-orientation="vertical"]')
      expect(vSeparators.length).toBe(1)
    })

    it('renders row dividers within 2-row columns', () => {
      const layout = [
        [makeReactPane('a'), makeReactPane('b')],
        [makeReactPane('c'), makeReactPane('d')],
      ]
      const { container } = render(
        <ExpandedPane initialLayout={layout} variant="full" onClose={vi.fn()} />
      )
      const hSeparators = container.querySelectorAll('[role="separator"][aria-orientation="horizontal"]')
      expect(hSeparators.length).toBe(2) // one per 2-row column
    })

    it.each([
      {
        name: 'column divider',
        layout: [[makeReactPane('column-a')], [makeReactPane('column-b')]],
        selector: '[role="separator"][aria-orientation="vertical"]',
      },
      {
        name: 'row divider',
        layout: [[makeReactPane('row-a'), makeReactPane('row-b')]],
        selector: '[role="separator"][aria-orientation="horizontal"]',
      },
    ])('locks iframe input while resizing with a $name and releases on pointerup', ({ layout, selector }) => {
      const { container } = render(
        <ExpandedPane initialLayout={layout} variant="full" onClose={vi.fn()} />
      )
      fireEvent.pointerDown(container.querySelector(selector), { clientX: 100, clientY: 100 })

      expect(acquireIframePointerLock).toHaveBeenCalledWith(document)
      expect(releaseIframePointerLock).not.toHaveBeenCalled()

      fireEvent.pointerMove(document, { clientX: 120, clientY: 120 })
      fireEvent.pointerUp(document)
      fireEvent.pointerUp(document)

      expect(releaseIframePointerLock).toHaveBeenCalledOnce()
    })

    it.each([
      ['pointercancel', () => fireEvent.pointerCancel(document)],
      ['window blur', () => fireEvent(window, new Event('blur'))],
      ['unmount', (unmount) => unmount()],
    ])('releases a row-divider lock on %s', (_label, finishGesture) => {
      const layout = [[makeReactPane('cancel-a'), makeReactPane('cancel-b')]]
      const { container, unmount } = render(
        <ExpandedPane initialLayout={layout} variant="full" onClose={vi.fn()} />
      )
      fireEvent.pointerDown(
        container.querySelector('[role="separator"][aria-orientation="horizontal"]'),
        { clientX: 100, clientY: 100 },
      )

      finishGesture(unmount)

      expect(releaseIframePointerLock).toHaveBeenCalledOnce()
    })

    it('renders single-pane modal from 1-element layout', () => {
      const layout = [[makeReactPane('a', 'Only Pane')]]
      render(
        <ExpandedPane initialLayout={layout} variant="modal" onClose={vi.fn()} />
      )
      expect(screen.getByText('Only Pane')).toBeTruthy()
      expect(screen.getByLabelText('Close expanded view')).toBeTruthy()
    })
  })
})
