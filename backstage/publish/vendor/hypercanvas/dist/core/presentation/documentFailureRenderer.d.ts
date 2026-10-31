import type { DesktopRuntimeSnapshot } from '../notebook/browserBridge.js';
export type DocumentFailureRequest = Readonly<{
    method: string;
    url?: string;
}>;
/** Render an offline-capable document for a validated desktop runtime incident. */
export declare function renderDocumentFailure(_request: DocumentFailureRequest, state: DesktopRuntimeSnapshot): {
    html: string;
} | null;
