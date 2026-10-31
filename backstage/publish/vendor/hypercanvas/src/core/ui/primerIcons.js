import { lazy } from 'react';
import { primerIconLoaders } from './primerIconLoaders.generated.js';
const componentCache = new Map();
const reportedLoadFailures = new Set();
const EmptyPrimerIcon = () => null;
function isPrimerIconName(name) {
    return Object.hasOwn(primerIconLoaders, name);
}
/**
 * Creates a lazy Primer component with a non-throwing fallback. Exported for
 * focused coverage of the optional-chunk failure path.
 */
export function createPrimerIconComponent(canonicalName, load, reportError = console.error) {
    return lazy(() => Promise.resolve()
        .then(load)
        .then(module => {
        if (!module?.default)
            throw new TypeError(`Primer icon module "${canonicalName}" has no default component`);
        return { default: module.default };
    })
        .catch(error => {
        if (!reportedLoadFailures.has(canonicalName)) {
            reportedLoadFailures.add(canonicalName);
            reportError(`[PrimerIcon] Could not load "${canonicalName}" from @primer/octicons-react.`, error);
        }
        return { default: EmptyPrimerIcon };
    }));
}
/**
 * Returns the cached lazy component for a canonical, lower-kebab-case Primer
 * icon name. Names correspond to the upstream `*Icon` component modules.
 * Primer's single component chooses its 16px or 24px artwork with its `size`
 * prop; pass that prop through rather than addressing dimension suffixes as
 * separate catalog names.
 */
export function getPrimerIconComponent(canonicalName) {
    if (!isPrimerIconName(canonicalName))
        return null;
    const loader = primerIconLoaders[canonicalName];
    if (!componentCache.has(canonicalName)) {
        componentCache.set(canonicalName, createPrimerIconComponent(canonicalName, loader));
    }
    return componentCache.get(canonicalName) ?? null;
}
