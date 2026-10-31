/**
 * Session environment names were renamed from STORYBOARD_* to HYPERCANVAS_*.
 * Reading prefers the primary name and falls back to the legacy name that
 * older installs (and pre-update agent templates) still export. Writes
 * produce both names so consumers of either generation keep working.
 */
/** Legacy name for an environment variable already renames to primary. */
export declare function legacyName(primary: string): string;
/** Read a renamed environment variable with the legacy alias as fallback. */
export declare function legacySessionEnv(primary: string): string | undefined;
/** Add the legacy alias for every HYPERCANVAS_* key present in the object. */
export declare function withLegacySessionAliases<T extends Record<string, string | undefined | null>>(env: T): T;
