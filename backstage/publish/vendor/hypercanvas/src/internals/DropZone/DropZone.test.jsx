import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

let tauriAvailable = true
const listenHandlers = new Map()

vi.mock('../../core/notebook/tauri-bridge.js', () => ({
  isTauriAvailable: () => tauriAvailable,
  invoke: vi.fn(),
  listen: vi.fn(async (event, handler) => {
    listenHandlers.set(event, handler)
    return () => listenHandlers.delete(event)
  }),
}))

vi.mock('../hooks/useFeatureFlag.js', () => ({
  useFeatureFlag: () => true,
}))

import DropZone from './DropZone.jsx'
import { __resetDropRouter } from '../dragDrop/dropRouter.js'
import { invoke } from '../../core/notebook/tauri-bridge.js'

beforeEach(() => {
  tauriAvailable = true
  listenHandlers.clear()
  document.body.innerHTML = ''
  __resetDropRouter()
  // jsdom does not implement elementFromPoint — install a mock we can retarget.
  Object.defineProperty(document, 'elementFromPoint', { value: vi.fn(() => null), configurable: true, writable: true })
  vi.mocked(invoke).mockResolvedValue([])
  vi.stubGlobal('fetch', vi.fn(url => Promise.resolve(String(url).includes('/site/list')
    ? { ok: true, json: async () => ({ sites: [] }) }
    : String(url).includes('/notebook-runtime/recent')
      ? { ok: true, json: async () => ({ notebooks: [] }) }
      : { ok: false, json: async () => ({}) })))
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete globalThis.__HYPERCANVAS_OPEN_NOTEBOOK__
  delete globalThis.__HYPERCANVAS_PICK_NOTEBOOK_FOLDER__
})

describe('DropZone', () => {
  it('renders a div by default and exposes drop state', () => {
    const { getByTestId } = render(
      <DropZone data-testid="zone">
        {({ isOver }) => <span>{isOver ? 'over' : 'idle'}</span>}
      </DropZone>,
    )
    const zone = getByTestId('zone')
    expect(zone.tagName).toBe('DIV')
    expect(zone.getAttribute('data-dropzone')).toBe('')
    expect(zone.textContent).toBe('idle')
  })

  it('renders a button when clickable', () => {
    const { getByTestId } = render(
      <DropZone as="button" type="button" onClick={() => {}} data-testid="zone">pick</DropZone>,
    )
    expect(getByTestId('zone').tagName).toBe('BUTTON')
  })
})
