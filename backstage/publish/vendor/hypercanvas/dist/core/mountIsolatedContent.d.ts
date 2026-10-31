type IsolatedPolicyHotContext = {
    send(event: string, payload?: unknown): void;
    on(event: string, listener: (payload: unknown) => void): void;
    off?(event: string, listener: (payload: unknown) => void): void;
    dispose(callback: () => void): void;
};
/** Initialize the behavior needed by authored content, without loading Core UI. */
export declare function mountIsolatedContent({ basePath, role, hot, }?: {
    basePath?: string;
    role?: 'prototype-content' | 'story-content';
    hot?: IsolatedPolicyHotContext;
}): () => void;
export {};
