import { useCallback, useRef, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { AgentChatStore } from '../../core/agent-chat/agent-chat-store.js'
import {
  agentChatTransport,
  AGENT_RUNTIME_STATE_CHANGED_EVENT,
} from '../../core/agent-chat/agent-chat-client.js'
import { storyboardWs } from '../storyboard-ws.js'

const AGENT_INITIALIZATION_RETRY_DELAYS_MS = [300, 900, 1800]

/**
 * React hook for a Paseo-backed agent conversation.
 *
 * Creates and manages an AgentChatStore instance bound to an optional agentId.
 * Subscribes to the Hypercanvas server WebSocket for real-time updates.
 * Returns { state, actions } where state is the store snapshot and actions
 * dispatch into the store (send, cancel, respondToPermission, loadOlder, etc.).
 *
 * Usage:
 *   const chat = useAgentChat({ agentId, onAgentIdChange })
 *   // chat.state.items, chat.state.head, chat.state.permissions
 *   // chat.actions.send('hello'), chat.actions.cancel()
 */
export function useAgentChat({ agentId, widgetId, onAgentIdChange, transport } = {}) {
  const activeTransport = transport || agentChatTransport
  const storeRef = useRef(null)
  if (!storeRef.current) {
    storeRef.current = new AgentChatStore({ transport: activeTransport })
  }
  const store = storeRef.current

  const [providers, setProviders] = useState([])
  const [providersError, setProvidersError] = useState('')
  const [providersLoading, setProvidersLoading] = useState(true)
  const [models, setModels] = useState([])
  const [modelsError, setModelsError] = useState('')
  const [loadingModels, setLoadingModels] = useState(false)
  const [creationError, setCreationError] = useState('')
  const state = useSyncExternalStore(store.subscribe.bind(store), store.getSnapshot.bind(store))

  const refreshProviders = useCallback(async () => {
    setProvidersLoading(true)
    try {
      const result = await activeTransport.listAvailableProviders()
      const available = (result?.providers || []).filter((provider) => provider?.available)
      setProviders(available)
      setProvidersError(result?.error || (!available.length ? 'No configured Paseo CLI providers are available.' : ''))
      return available
    } catch (error) {
      setProvidersError(error.message || 'Could not load Paseo providers')
      return null
    } finally {
      setProvidersLoading(false)
    }
  }, [activeTransport])

  useEffect(() => {
    let active = true
    let timer = null
    let retryIndex = 0

    const checkProviders = async () => {
      const available = await refreshProviders()
      if (!active || available?.length || retryIndex >= AGENT_INITIALIZATION_RETRY_DELAYS_MS.length) return
      const delay = AGENT_INITIALIZATION_RETRY_DELAYS_MS[retryIndex]
      retryIndex += 1
      timer = window.setTimeout(checkProviders, delay)
    }

    void checkProviders()
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [refreshProviders])

  useEffect(() => {
    if (!agentId || state.initialized) return undefined
    let active = true
    let timer = null
    let retryIndex = 0

    const initialize = async () => {
      try {
        await store.initialize({ agentId })
      } catch {
        if (!active || retryIndex >= AGENT_INITIALIZATION_RETRY_DELAYS_MS.length) return
        const delay = AGENT_INITIALIZATION_RETRY_DELAYS_MS[retryIndex]
        retryIndex += 1
        timer = window.setTimeout(initialize, delay)
      }
    }

    void initialize()
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [agentId, state.initialized, store])

  useEffect(() => {
    const refreshRuntime = () => {
      void refreshProviders()
      if (agentId) void store.initialize({ agentId }).catch(() => {})
    }
    window.addEventListener(AGENT_RUNTIME_STATE_CHANGED_EVENT, refreshRuntime)
    return () => window.removeEventListener(AGENT_RUNTIME_STATE_CHANGED_EVENT, refreshRuntime)
  }, [agentId, refreshProviders, store])

  useEffect(() => {
    const handler = (event) => {
      if (!event || typeof event !== 'object') return
      const { agentId: eventAgentId, kind, payload } = event
      if (agentId && eventAgentId !== agentId) return
      if (kind === 'stream' && payload) {
        if (store.enqueueStreamEvent(payload)) store.catchUpIfNeeded()
      } else if (kind === 'update' && payload) {
        if (store.enqueueStreamEvent({ type: 'agent_snapshot', ...payload })) store.catchUpIfNeeded()
      }
    }
    storyboardWs.on('storyboard:paseo-agent-event', handler)
    return () => storyboardWs.off('storyboard:paseo-agent-event', handler)
  }, [agentId, store])

  useEffect(() => {
    if (!agentId || !state.turnActive) return
    const timer = setInterval(() => { store.initialize() }, 1000)
    return () => clearInterval(timer)
  }, [agentId, state.turnActive, store])

  const actions = useMemo(() => ({
    send: (text) => store.send(text),
    cancel: () => store.cancel(),
    respondToPermission: (requestId, behavior) => store.respondToPermission(requestId, behavior),
    loadOlder: () => store.loadOlder(),
    catchUp: () => store.catchUpIfNeeded(),
    initialize: (opts) => store.initialize(opts),
    setAgentId: (id) => {
      store.setAgentId(id)
      onAgentIdChange?.(id)
    },
    createAgent: async (config, title) => {
      setCreationError('')
      try {
        const result = await activeTransport.createAgent(
          config,
          title,
          widgetId ? { widgetId } : undefined,
        )
        if (result?.agent?.id) {
          store.setAgentId(result.agent.id)
          onAgentIdChange?.(result.agent.id)
          await store.initialize({ agentId: result.agent.id })
        }
        return result
      } catch (error) {
        setCreationError(error.message || 'Could not create agent')
        throw error
      }
    },
    loadModels: async (provider) => {
      if (!provider) {
        setModels([])
        setModelsError('')
        return []
      }
      setLoadingModels(true)
      setModelsError('')
      try {
        const result = await activeTransport.listModels(provider)
        const availableModels = result?.models || []
        setModels(availableModels)
        if (result?.error) setModelsError(result.error)
        return availableModels
      } catch (error) {
        setModels([])
        setModelsError(error.message || 'Could not load models')
        return []
      } finally {
        setLoadingModels(false)
      }
    },
  }), [store, widgetId, onAgentIdChange, activeTransport])

  return { state, actions, providers, providersError, providersLoading, models, modelsError, loadingModels, creationError }
}
