import type { LazyExoticComponent } from 'react';
import type { PrimerIconLoader } from './primerIconLoaders.generated.js';
type PrimerIconModule = Awaited<ReturnType<PrimerIconLoader>>;
type PrimerIconComponent = PrimerIconModule['default'];
type CachedPrimerIcon = LazyExoticComponent<PrimerIconComponent>;
/**
 * Creates a lazy Primer component with a non-throwing fallback. Exported for
 * focused coverage of the optional-chunk failure path.
 */
export declare function createPrimerIconComponent(canonicalName: string, load: PrimerIconLoader, reportError?: (message: string, error: unknown) => void): CachedPrimerIcon;
/**
 * Returns the cached lazy component for a canonical, lower-kebab-case Primer
 * icon name. Names correspond to the upstream `*Icon` component modules.
 * Primer's single component chooses its 16px or 24px artwork with its `size`
 * prop; pass that prop through rather than addressing dimension suffixes as
 * separate catalog names.
 */
export declare function getPrimerIconComponent(canonicalName: string): CachedPrimerIcon | null;
export {};
