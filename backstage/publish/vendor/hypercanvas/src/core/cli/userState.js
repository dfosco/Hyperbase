/**
 * userState — Per-user local state for the current repo, stored in
 * the runtime directory `.hypercanvas/.user.json` (gitignored; legacy `.storyboard/.user.json` still read).
 *
 * This is a free-form key/value bag for things that should persist across
 * runs but never be committed:
 *   - setupVersion   (string) — @dfosco/hypercanvas version setup was last
 *     run against. Compared against the installed version on `npm run dev`
 *     to decide whether scaffolding needs to re-run.
 *   - setupRanAt     (ISO date) — last setup timestamp.
 *   - … future:        onboarded, username, lastSeenChangelog, etc.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const FILE = '.hypercanvas/.user.json';
const LEGACY_FILE = '.storyboard/.user.json';
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function userStatePath(cwd = process.cwd()) {
    return resolve(cwd, FILE);
}
/** Whichever marker file the project already has (legacy setups keep theirs). */
function existingUserStatePath(cwd = process.cwd()) {
    const primary = resolve(cwd, FILE);
    if (existsSync(primary))
        return primary;
    const legacy = resolve(cwd, LEGACY_FILE);
    if (existsSync(legacy))
        return legacy;
    return primary;
}
export function readUserState(cwd = process.cwd()) {
    const file = existingUserStatePath(cwd);
    if (!existsSync(file))
        return {};
    try {
        const parsed = JSON.parse(readFileSync(file, 'utf8'));
        return isRecord(parsed) ? parsed : {};
    }
    catch {
        return {};
    }
}
export function writeUserState(patch, cwd = process.cwd()) {
    const file = userStatePath(cwd);
    const dir = dirname(file);
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    const next = { ...readUserState(cwd), ...patch };
    writeFileSync(file, JSON.stringify(next, null, 2) + '\n', 'utf8');
    return next;
}
/**
 * Read the installed @dfosco/hypercanvas package version, or null if not
 * resolvable (e.g. running from a worktree without node_modules).
 */
export function getInstalledStoryboardVersion(cwd = process.cwd()) {
    try {
        const pkgPath = resolve(cwd, 'node_modules', '@dfosco', 'hypercanvas', 'package.json');
        const parsed = JSON.parse(readFileSync(pkgPath, 'utf8'));
        return isRecord(parsed) && typeof parsed.version === 'string' ? parsed.version : null;
    }
    catch {
        return null;
    }
}
/**
 * Decide whether `hypercanvas setup` should run before `dev`.
 * Returns null when up-to-date, or { reason, ... } otherwise.
 */
export function setupNeeded(cwd = process.cwd()) {
    const state = readUserState(cwd);
    const current = getInstalledStoryboardVersion(cwd);
    const setupVersion = typeof state.setupVersion === 'string' ? state.setupVersion : undefined;
    if (!setupVersion)
        return { reason: 'first-run', current };
    if (current && setupVersion !== current) {
        return { reason: 'version-changed', from: setupVersion, to: current };
    }
    return null;
}
