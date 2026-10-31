import { type DesktopRecoveryActionRequest, type DesktopRuntimeSnapshot } from '../notebook/browserBridge.js';
import { createDocumentReloadPolicy } from '../../internals/documentReloadPolicy.js';
type RuntimeListener = (snapshot: DesktopRuntimeSnapshot) => void;
export interface OfflineRecoveryClientDependencies {
    documentRef?: Document;
    windowRef?: Window;
    getSnapshot?: () => Promise<DesktopRuntimeSnapshot>;
    subscribe?: (listener: RuntimeListener) => () => void;
    authorizeAction?: (request: DesktopRecoveryActionRequest) => Promise<{
        accepted: boolean;
        reason?: string;
        snapshot: DesktopRuntimeSnapshot;
    }>;
    makePolicy?: typeof createDocumentReloadPolicy;
    requestId?: () => string;
}
export interface OfflineRecoveryClient {
    dispose(): void;
}
/** Attach recovery controls to the current static error document. */
export declare function startOfflineRecoveryClient(dependencies?: OfflineRecoveryClientDependencies): OfflineRecoveryClient;
export {};
