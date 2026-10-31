import { describe, expect, it, vi } from 'vitest'
import {
  getActiveAgentPasteTarget,
  getClipboardImageFile,
  resolveAgentScreenshotPaste,
} from './agentScreenshotPaste.js'

const png = { type: 'image/png' }
const clipboard = (text = '', file = png) => ({
  getData: vi.fn(() => text),
  items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }],
})
const agent = { id: 'agent-1', type: 'agent', props: {} }
const terminal = { id: 'terminal-1', type: 'terminal', props: {} }
const activeRegistry = () => new Map([[
  'agent-1',
  { isAgent: true, canPasteScreenshot: true, ws: { readyState: 1 }, pasteText: vi.fn(() => true) },
]])

describe('agent screenshot paste routing', () => {
  it('requires a single selected agent and an interactive, connected terminal', () => {
    const registry = activeRegistry()
    const result = resolveAgentScreenshotPaste(new Set(['agent-1']), [agent], clipboard(), registry)
    expect(result).toMatchObject({ widgetId: 'agent-1', file: png })
    expect(result.terminal).toBe(registry.get('agent-1'))

    expect(resolveAgentScreenshotPaste(new Set(), [agent], clipboard(), registry)).toBeNull()
    expect(resolveAgentScreenshotPaste(new Set(['agent-1', 'terminal-1']), [agent, terminal], clipboard(), registry)).toBeNull()
    expect(resolveAgentScreenshotPaste(new Set(['terminal-1']), [agent, terminal], clipboard(), registry)).toBeNull()
  })

  it('never intercepts text paste, even when the clipboard also contains an image', () => {
    expect(getClipboardImageFile(clipboard('hello'))).toBeNull()
    expect(resolveAgentScreenshotPaste(new Set(['agent-1']), [agent], clipboard('hello'), activeRegistry())).toBeNull()
  })

  it('leaves other clipboard formats to existing canvas and terminal handlers', () => {
    expect(getClipboardImageFile({ getData: () => '', items: [{ type: 'text/plain', getAsFile: () => null }] })).toBeNull()
    expect(getClipboardImageFile({ getData: () => '', items: [] })).toBeNull()
  })

  it('does not paste through the interact gate or a disconnected terminal', () => {
    const registry = activeRegistry()
    registry.get('agent-1').canPasteScreenshot = false
    expect(resolveAgentScreenshotPaste(new Set(['agent-1']), [agent], clipboard(), registry)).toBeNull()

    registry.get('agent-1').canPasteScreenshot = true
    registry.get('agent-1').ws.readyState = 3
    expect(getActiveAgentPasteTarget('agent-1', registry)).toBeNull()
    expect(resolveAgentScreenshotPaste(new Set(['agent-1']), [agent], clipboard(), registry)).toBeNull()
  })

  it('requires an actual agent terminal, not a normal terminal masquerading as one', () => {
    const registry = activeRegistry()
    registry.set('terminal-1', { ...registry.get('agent-1'), isAgent: false })
    expect(resolveAgentScreenshotPaste(new Set(['terminal-1']), [terminal], clipboard(), registry)).toBeNull()
    expect(resolveAgentScreenshotPaste(new Set(['agent-1']), [agent], clipboard(), registry)).not.toBeNull()
  })
})
