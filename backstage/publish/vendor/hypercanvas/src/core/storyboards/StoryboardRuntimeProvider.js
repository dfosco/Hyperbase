import { createElement, useEffect, useMemo, useRef } from 'react';
import { createStoryboardQuerySession, } from './query-session';
/** Supplies Statefully's existing provider with a URL-query-backed session. */
export function StoryboardRuntimeProvider({ Provider, createSessionStore, providerProps, children, targetWindow, }) {
    const runtime = useMemo(() => createStoryboardQuerySession(createSessionStore, targetWindow), [createSessionStore, targetWindow]);
    const lifecycleGeneration = useRef(0);
    useEffect(() => {
        const generation = ++lifecycleGeneration.current;
        return () => {
            // React StrictMode runs effect cleanup and setup again without replacing
            // memoized values. Defer disposal so that probe cleanup cannot poison
            // the Statefully session before the replacement effect subscribes.
            queueMicrotask(() => {
                if (lifecycleGeneration.current === generation)
                    runtime.dispose();
            });
        };
    }, [runtime]);
    return createElement(Provider, { ...providerProps, session: runtime.session }, children);
}
