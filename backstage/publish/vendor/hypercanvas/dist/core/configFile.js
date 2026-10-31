import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { parse as parseJsonc } from 'jsonc-parser';
/**
 * Application configuration filename after the Storyboard → Hypercanvas
 * rename. Existing projects keep their `storyboard.config.json`; it stays
 * readable forever. A project that adopts `hypercanvas.config.json` signals
 * the migration and the primary file then wins over a leftover legacy file.
 * Writes keep whichever file already exists (single-file invariant) and create
 * the primary file only for fresh projects.
 */
export const APP_CONFIG_PRIMARY = 'hypercanvas.config.json';
export const APP_CONFIG_LEGACY = 'storyboard.config.json';
export const CONFIG_DIRECTORY_NAME = 'config';
/** Where new Notebooks scaffold their config files; root and `config/` copies are honoured first. */
export const BACKSTAGE_CONFIG_DIRECTORY = 'backstage/config';
export const LEGACY_CANVAS_CONFIG_FILE = 'storyboard.canvas.json';
function validateConfigFilename(filename) {
    if (!filename || basename(filename) !== filename) {
        throw new Error(`Configuration filename must be a single filename: ${JSON.stringify(filename)}`);
    }
}
function isFile(filePath) {
    try {
        return statSync(filePath).isFile();
    }
    catch {
        return false;
    }
}
/** Root and grouped-location candidates, with the compatible root path first. */
export function configFileCandidates(root, filename) {
    validateConfigFilename(filename);
    return [join(root, filename), join(root, CONFIG_DIRECTORY_NAME, filename), join(root, BACKSTAGE_CONFIG_DIRECTORY, filename)];
}
/** Application candidates use filename precedence first, then location precedence. */
export function appConfigCandidates(root) {
    return [APP_CONFIG_PRIMARY, APP_CONFIG_LEGACY]
        .flatMap(filename => configFileCandidates(root, filename));
}
function hasConfigFile(directory) {
    try {
        return readdirSync(directory, { withFileTypes: true }).some(entry => entry.isFile() && (entry.name.endsWith('.config.json') || entry.name === LEGACY_CANVAS_CONFIG_FILE));
    }
    catch {
        return false;
    }
}
/**
 * Pick the layout for a new config file. An existing application config is
 * authoritative; otherwise retain whichever directory already contains a
 * Hypercanvas `*.config.json` file. Fresh projects continue to use the root.
 */
export function resolveConfigDirectory(root) {
    const appConfig = appConfigCandidates(root).find(isFile);
    if (appConfig)
        return dirname(appConfig);
    const grouped = join(root, CONFIG_DIRECTORY_NAME);
    const backstage = join(root, BACKSTAGE_CONFIG_DIRECTORY);
    if (hasConfigFile(root))
        return root;
    if (hasConfigFile(grouped))
        return grouped;
    if (hasConfigFile(backstage))
        return backstage;
    return root;
}
/**
 * Notebook variant of resolveConfigDirectory: an existing config location is
 * kept wherever it is (root, `config/`, `backstage/config/`); a Notebook with
 * none scaffolds into `backstage/config/`.
 */
export function resolveNotebookConfigDirectory(root) {
    const existing = resolveConfigDirectory(root);
    if (existing !== root || hasConfigFile(root) || appConfigCandidates(root).some(isFile))
        return existing;
    return join(root, BACKSTAGE_CONFIG_DIRECTORY);
}
/** Config write target for a Notebook: the existing file, else the Notebook config directory. */
export function resolveNotebookConfigWritePath(root, filename) {
    return resolveConfigFileCandidates(root, filename).find(isFile)
        || join(resolveNotebookConfigDirectory(root), filename);
}
/** Resolve a named Hypercanvas config for reading, preferring its root copy. */
export function resolveConfigFilePath(root, filename) {
    return resolveConfigFileCandidates(root, filename).find(isFile)
        || join(resolveConfigDirectory(root), filename);
}
/** All candidates for a named Hypercanvas config, in read-precedence order. */
export function resolveConfigFileCandidates(root, filename) {
    return configFileCandidates(root, filename);
}
/** Resolve a named Hypercanvas config target without creating a shadow copy. */
export function resolveConfigFileWritePath(root, filename) {
    return resolveConfigFileCandidates(root, filename).find(isFile)
        || join(resolveConfigDirectory(root), filename);
}
/** Path readers should open for the application config under `root`. */
export function resolveAppConfigPath(root) {
    return appConfigCandidates(root).find(isFile)
        || join(resolveConfigDirectory(root), APP_CONFIG_PRIMARY);
}
/** Alias writers use so the existing file keeps being the single source. */
export function resolveAppConfigWritePath(root) {
    return resolveAppConfigPath(root);
}
/** Primary-name target used by writers that migrate a legacy filename. */
export function resolveAppConfigPrimaryWritePath(root) {
    const current = resolveAppConfigPath(root);
    if (isFile(current) && basename(current) === APP_CONFIG_PRIMARY)
        return current;
    return join(isFile(current) ? dirname(current) : resolveConfigDirectory(root), APP_CONFIG_PRIMARY);
}
/** Parsed `hypercanvas.config.json` (or its legacy fallback), or null. */
export function readAppConfig(root) {
    for (const filePath of appConfigCandidates(root)) {
        try {
            // Consumer configs may carry JSONC comments; parse tolerantly.
            const parsed = parseJsonc(readFileSync(filePath, 'utf8'));
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
        }
        catch { /* try the next name */ }
    }
    return null;
}
/** Raw config file text or null, using the same read order. */
export function readAppConfigRaw(root) {
    for (const filePath of appConfigCandidates(root)) {
        try {
            return readFileSync(filePath, 'utf8');
        }
        catch { /* try the next name */ }
    }
    return null;
}
