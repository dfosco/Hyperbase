/**
 * URL hash-based utilities for storyboard session state.
 *
 * Session params are stored in the URL hash fragment (after #) to avoid
 * triggering React Router re-renders. React Router (used by generouted)
 * patches history.replaceState/pushState, so any search-param change
 * causes a full route tree re-render. The hash is invisible to the router.
 *
 * Format:  #key1=value1&key2=value2
 * Example: /page?scene=default#user.name=Alice&settings.theme=dark
 */
/**
 * Read a single session param value.
 * @param {string} key
 * @returns {string|null}
 */
export declare function getParam(key: string): string | null;
/**
 * Write a single session param. Updates the hash in-place.
 * @param {string} key
 * @param {string} value
 */
export declare function setParam(key: string, value: unknown): void;
/**
 * Return all session params as a plain object.
 * @returns {Record<string, string>}
 */
export declare function getAllParams(): Record<string, string>;
/**
 * Remove a single session param from the hash.
 * @param {string} key
 */
export declare function removeParam(key: string): void;
