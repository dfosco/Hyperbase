import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AGENT_RUNTIME_STATE_CHANGED_EVENT } from '../../core/agent-chat/agent-chat-client.js'
import { useAgentChat } from './useAgentChat.js'

function ChatProbe({ agentId = '', transport }) {
  const chat = useAgentChat({ agentId, transport })
  return <div>
    <span data-testid="providers">{chat.providers.map(provider => provider.provider).join(',')}</span>
    <span data-testid="initialization">{chat.state.error || (chat.state.initialized ? 'ready' : 'loading')}</span>
  </div>
}

function readyTimeline() {
  return {
    reset: true,
    epoch: 'epoch-1',
    window: { minSeq: 1, maxSeq: 1 },
    entries: [{ type: 'assistant_message', messageId: 'message-1', text: 'Ready' }],
  }
}

describe('useAgentChat runtime refresh', () => {
  afterEach(() => vi.useRealTimers())

  it('retries a transient Agent initialization failure without remounting', async () => {
    const transport = {
      listAvailableProviders: vi.fn().mockResolvedValue({ providers: [{ provider: 'codex', available: true }] }),
      fetchTimeline: vi.fn()
        .mockRejectedValueOnce(new Error('verified runtime is still starting'))
        .mockResolvedValueOnce(readyTimeline()),
    }

    render(<ChatProbe agentId="agent-codex" transport={transport} />)

    expect(await screen.findByText('ready')).toBeTruthy()
    expect(transport.fetchTimeline).toHaveBeenCalledTimes(2)
  })

  it('refreshes providers and an existing Agent when runtime state changes', async () => {
    const transport = {
      listAvailableProviders: vi.fn()
        .mockResolvedValueOnce({ providers: [] })
        .mockResolvedValueOnce({ providers: [
          { provider: 'codex', available: true },
          { provider: 'copilot', available: true },
        ] }),
      fetchTimeline: vi.fn().mockResolvedValue(readyTimeline()),
    }

    render(<ChatProbe agentId="agent-shared" transport={transport} />)
    await waitFor(() => expect(screen.getByTestId('providers').textContent).toBe(''))

    await act(async () => {
      window.dispatchEvent(new CustomEvent(AGENT_RUNTIME_STATE_CHANGED_EVENT, { detail: { source: 'host-tools-preflight' } }))
    })

    await waitFor(() => expect(screen.getByTestId('providers').textContent).toBe('codex,copilot'))
    expect(transport.fetchTimeline).toHaveBeenCalledTimes(2)
  })

  it('bounds retries while providers and an Agent remain unavailable', async () => {
    vi.useFakeTimers()
    const transport = {
      listAvailableProviders: vi.fn().mockResolvedValue({ providers: [] }),
      fetchTimeline: vi.fn().mockRejectedValue(new Error('Agent runtime unavailable')),
    }

    render(<ChatProbe agentId="agent-unavailable" transport={transport} />)
    await act(async () => { await Promise.resolve() })
    await act(async () => { await vi.advanceTimersByTimeAsync(300 + 900 + 1800) })

    expect(transport.listAvailableProviders).toHaveBeenCalledTimes(4)
    expect(transport.fetchTimeline).toHaveBeenCalledTimes(4)
    expect(screen.getByTestId('initialization').textContent).toBe('Agent runtime unavailable')
  })
})
