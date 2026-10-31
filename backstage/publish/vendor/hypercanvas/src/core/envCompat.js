import process from 'node:process';
/**
 * Session environment names were renamed from STORYBOARD_* to HYPERCANVAS_*.
 * Reading prefers the primary name and falls back to the legacy name that
 * older installs (and pre-update agent templates) still export. Writes
 * produce both names so consumers of either generation keep working.
 */
/** Legacy name for an environment variable already renames to primary. */
export function legacyName(primary) {
    return primary.startsWith('HYPERCANVAS_') ? `STORYBOARD_${primary.slice('HYPERCANVAS_'.length)}` : primary;
}
/** Read a renamed environment variable with the legacy alias as fallback. */
export function legacySessionEnv(primary) {
    const value = process.env[primary];
    if (value !== undefined)
        return value;
    return process.env[legacyName(primary)];
}
/** Add the legacy alias for every HYPERCANVAS_* key present in the object. */
export function withLegacySessionAliases(env) {
    const mutableEnvironment = env;
    for (const [key, value] of Object.entries(mutableEnvironment)) {
        if (key.startsWith('HYPERCANVAS_')) {
            const legacy = legacyName(key);
            if (!(legacy in mutableEnvironment) && value != null)
                mutableEnvironment[legacy] = value;
        }
    }
    return env;
}
