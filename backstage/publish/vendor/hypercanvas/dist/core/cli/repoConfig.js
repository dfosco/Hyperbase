/**
 * repoConfig — Read & write the `repository`/`prodDomain` fields in the
 * application config (`hypercanvas.config.json`, legacy
 * `storyboard.config.json` keeps working) without disturbing formatting,
 * comments, or unrelated keys.
 *
 * Uses jsonc-parser's `modify` + `applyEdits` so the user's preferred
 * indent style (tabs vs spaces) and key order are preserved.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { modify, applyEdits, parse as parseJsonc } from 'jsonc-parser';
import { resolveAppConfigPath } from '../configFile.js';
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/**
 * Return parsed config (best-effort) and the raw source text of whichever
 * config file already exists.
 * Returns `{ config: {}, raw: '', exists: false }` when no config is present.
 */
export function readRepoConfig(cwd = process.cwd()) {
    const file = resolveAppConfigPath(cwd);
    if (!existsSync(file)) {
        return { file, exists: false, raw: '', config: {} };
    }
    const raw = readFileSync(file, 'utf8');
    let config = {};
    try {
        const parsed = parseJsonc(raw);
        config = isRecord(parsed) ? parsed : {};
    }
    catch {
        config = {};
    }
    return { file, exists: true, raw, config };
}
/**
 * Detect the indent style used by an existing JSON source. Falls back to
 * tabs (matches storyboard core's own config files) when the source is
 * empty or single-line.
 */
function detectFormatting(raw) {
    const m = raw.match(/^(\t|[ ]+)(?=["{[])/m);
    if (!m)
        return { tabSize: 1, insertSpaces: false };
    const indent = m[1] || '';
    if (indent === '\t')
        return { tabSize: 1, insertSpaces: false };
    return { tabSize: indent.length, insertSpaces: true };
}
/**
 * Apply a series of `{ path, value }` updates to a JSONC source string.
 * Returns the new source text.
 */
function applyUpdates(raw, updates) {
    const formattingOptions = detectFormatting(raw || '{\n\t\n}');
    let next = raw || '{\n}\n';
    for (const { path, value } of updates) {
        const edits = modify(next, path, value, { formattingOptions });
        next = applyEdits(next, edits);
    }
    return next;
}
/**
 * Compute the diff between the desired repo identity and what's currently
 * in the application config file. Only returns keys that need to change.
 *
 * @param {object} current  parsed config
 * @param {object} desired  { owner, name, prodDomain }
 * @returns Updates that change the current identity fields.
 */
export function diffRepoIdentity(current, desired) {
    const updates = [];
    const currentRepo = isRecord(current.repository) ? current.repository : {};
    if (desired.owner && currentRepo.owner !== desired.owner) {
        updates.push({
            path: ['repository', 'owner'],
            value: desired.owner,
            label: 'repository.owner',
            from: typeof currentRepo.owner === 'string' ? currentRepo.owner : '',
        });
    }
    if (desired.name && currentRepo.name !== desired.name) {
        updates.push({
            path: ['repository', 'name'],
            value: desired.name,
            label: 'repository.name',
            from: typeof currentRepo.name === 'string' ? currentRepo.name : '',
        });
    }
    if (desired.prodDomain && current.prodDomain !== desired.prodDomain) {
        updates.push({
            path: ['prodDomain'],
            value: desired.prodDomain,
            label: 'prodDomain',
            from: typeof current.prodDomain === 'string' ? current.prodDomain : '',
        });
    }
    return updates;
}
/**
 * Write a set of pre-validated updates back to the application config file
 * (whichever name already exists), preserving formatting. Returns the
 * updated raw source text (also persisted to disk).
 */
export function writeRepoConfig(cwd, updates) {
    const { file, raw } = readRepoConfig(cwd);
    const next = applyUpdates(raw, updates);
    writeFileSync(file, next, 'utf8');
    return next;
}
