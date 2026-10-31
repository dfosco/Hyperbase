export type PrototypeRouteSnapshot = Readonly<{
    pathname: string;
    search: string;
    params: Readonly<Record<string, string>>;
    basePath: string;
}>;
type RouteOptions = {
    mode?: 'local' | 'static';
    base?: string;
    baseIsPrototypePrefix?: boolean;
};
type BindingOptions = {
    basePath?: string | undefined;
    window?: Window;
};
/** Return the ID-scoped route prefix used by the pinned local/static contract. */
export declare function prototypeRouteBasePath(id: string, { mode, base, baseIsPrototypePrefix }?: RouteOptions): string;
/** Create the read-only browser location binding expected by Statefully. */
export declare function createPrototypeRouteBinding({ basePath, window: targetWindow }?: BindingOptions): Readonly<{
    getSnapshot: () => Readonly<{
        pathname: string;
        search: string;
        params: Readonly<Record<string, string>>;
        basePath: string;
    }>;
    subscribe: (listener: () => void) => () => void;
    navigate: (destination: string | URL) => void;
    dispose(): void;
}>;
export {};
