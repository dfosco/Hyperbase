import { describe, expect, it } from 'vitest'
import { shouldGateAgentInput } from './agentBootstrapGate.js'

describe('agent bootstrap input gate', () => {
  it('holds agent input once startup has begun, until acknowledgement', () => {
    expect(shouldGateAgentInput(true, { phase: 'starting', delivery: 'pending' })).toBe(true)
    expect(shouldGateAgentInput(true, { phase: 'ready', delivery: 'acknowledged' })).toBe(false)
  })

  it('leaves the pre-launch terminal available for choosing a coding target', () => {
    expect(shouldGateAgentInput(true, null)).toBe(false)
    expect(shouldGateAgentInput(true, {})).toBe(false)
  })

  it('never re-locks for connector updates, stopped or unverified sessions', () => {
    expect(shouldGateAgentInput(true, { phase: 'ready', delivery: 'available' })).toBe(false)
    expect(shouldGateAgentInput(true, { phase: 'stopped' })).toBe(false)
    expect(shouldGateAgentInput(true, { phase: 'unverified' })).toBe(false)
  })

  it('does not gate plain terminals, and supports a deliberate startup bypass', () => {
    expect(shouldGateAgentInput(false, { phase: 'starting' })).toBe(false)
    expect(shouldGateAgentInput(true, { phase: 'starting' }, true)).toBe(false)
  })
})
