/** Subscribe React to browser navigation using the pinned Design Notebook shape. */
export declare function usePrototypeRoute({ basePath }?: {
    basePath?: string | undefined;
}): {
    navigate: (destination: string | URL) => void;
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => Readonly<{
        pathname: string;
        search: string;
        params: Readonly<Record<string, string>>;
        basePath: string;
    }>;
    pathname: string;
    search: string;
    params: Readonly<Record<string, string>>;
    basePath: string;
};
