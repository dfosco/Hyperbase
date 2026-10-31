/** Minimal Tauri bridge that keeps the external Notebook runtime dependency-free. */
type Unsubscribe = () => Promise<unknown>;
export declare function isTauriAvailable(): boolean;
export declare function invoke(command: string, args?: Record<string, unknown>): Promise<unknown>;
export declare function listen(event: string, handler: (event: unknown) => void): Promise<Unsubscribe>;
export {};
