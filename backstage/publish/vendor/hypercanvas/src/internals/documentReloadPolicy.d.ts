export type DocumentPolicyRole = 'workspace-host' | 'canvas-host' | 'prototype-content' | 'story-content'
export type DocumentRecoveryAction = 'retry-core' | 'reload-page'

export interface DocumentPolicyHotContext {
  send(event: string, payload?: unknown): void
  on(event: string, listener: (payload: unknown) => void): void
  off?(event: string, listener: (payload: unknown) => void): void
  dispose(callback: () => void): void
}

export interface DocumentRuntimeSnapshot {
  schemaVersion: 1
  sequence: number
  phase: string
  incident?: { incidentId?: string; correlationId?: string } | null
  actions?: string[]
}

export interface DocumentReloadPolicyOptions {
  hot?: DocumentPolicyHotContext
  role: DocumentPolicyRole
  targetId: string
  configurationAutoReload?: boolean | (() => boolean)
  authorizeAction: (request: {
    action: DocumentRecoveryAction
    incidentId: string
    expectedSequence: number
    requestId: string
  }) => Promise<DocumentRecoveryActionResult>
  getCurrentSnapshot: () => Promise<DocumentRuntimeSnapshot | null>
  isUnsavedStateKnownClean: () => boolean
  isTargetLive: (targetId: string) => boolean
  getCurrentUrl?: () => string
  navigate?: () => void
  setPending?: (detail: unknown) => void
  requestId?: () => string
}

export interface DocumentRecoveryActionResult {
  accepted: boolean
  reason?: string
  snapshot?: DocumentRuntimeSnapshot
}

export interface DocumentReloadPolicy {
  dispose(): void
  refresh(): void
  canAuthorizeRecoveryAction(options: {
    action: DocumentRecoveryAction
    expectedSnapshot: DocumentRuntimeSnapshot
  }): boolean
  authorizeRecoveryAction(options: {
    action: DocumentRecoveryAction
    expectedSnapshot: DocumentRuntimeSnapshot
    requestId?: string
  }): Promise<DocumentRecoveryActionResult>
  authorizeReload(options: {
    expectedSnapshot: DocumentRuntimeSnapshot
    requestId?: string
  }): Promise<boolean>
  registration: { instance: symbol; generation: number }
}

export function createDocumentReloadPolicy(options: DocumentReloadPolicyOptions): DocumentReloadPolicy
export function hasActionPermission(snapshot: DocumentRuntimeSnapshot, expected: DocumentRuntimeSnapshot, action: DocumentRecoveryAction): boolean
export function hasReloadPermission(snapshot: DocumentRuntimeSnapshot, expected: DocumentRuntimeSnapshot): boolean
export function isSupportedSnapshot(snapshot: unknown): snapshot is DocumentRuntimeSnapshot
export function sameRuntimeEvidence(left: DocumentRuntimeSnapshot | null, right: DocumentRuntimeSnapshot | null): boolean
export function sameSnapshot(left: DocumentRuntimeSnapshot | null, right: DocumentRuntimeSnapshot | null): boolean

export function recoverInitialModuleFailure(error: unknown, options?: { signal?: AbortSignal }): Promise<{ decision: string }>
