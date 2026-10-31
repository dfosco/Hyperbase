import { type ComponentType, type ReactNode } from 'react';
import { type StoryboardBrowserWindow, type StatefullySession, type StatefullySessionFactory } from './query-session';
export interface StatefullyProviderProps {
    children?: ReactNode;
    prototype?: string | null;
    dataset?: string | null;
    flow?: string;
    store?: unknown;
    session?: StatefullySession;
    [key: string]: unknown;
}
export interface StoryboardRuntimeProviderProps {
    Provider: ComponentType<StatefullyProviderProps>;
    createSessionStore: StatefullySessionFactory;
    providerProps: Omit<StatefullyProviderProps, 'children' | 'session'>;
    children?: ReactNode;
    targetWindow: StoryboardBrowserWindow;
}
/** Supplies Statefully's existing provider with a URL-query-backed session. */
export declare function StoryboardRuntimeProvider({ Provider, createSessionStore, providerProps, children, targetWindow, }: StoryboardRuntimeProviderProps): import("react").ReactElement<StatefullyProviderProps, string | import("react").JSXElementConstructor<any>>;
