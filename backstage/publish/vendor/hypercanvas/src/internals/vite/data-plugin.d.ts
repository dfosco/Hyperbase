export interface DataDiscoveryOptions {
  includeDraft?: boolean
  contentOnly?: boolean
}

export type DataDiscovery = Record<string, unknown>

export function buildDataDiscovery(root: string, options?: DataDiscoveryOptions): DataDiscovery
export function setOnHotPoolConfigChange(callback: (() => void) | null): void
