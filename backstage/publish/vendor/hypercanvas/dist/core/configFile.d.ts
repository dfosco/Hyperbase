/**
 * Application configuration filename after the Storyboard → Hypercanvas
 * rename. Existing projects keep their `storyboard.config.json`; it stays
 * readable forever. A project that adopts `hypercanvas.config.json` signals
 * the migration and the primary file then wins over a leftover legacy file.
 * Writes keep whichever file already exists (single-file invariant) and create
 * the primary file only for fresh projects.
 */
export declare const APP_CONFIG_PRIMARY = "hypercanvas.config.json";
export declare const APP_CONFIG_LEGACY = "storyboard.config.json";
export declare const CONFIG_DIRECTORY_NAME = "config";
/** Where new Notebooks scaffold their config files; root and `config/` copies are honoured first. */
export declare const BACKSTAGE_CONFIG_DIRECTORY = "backstage/config";
export declare const LEGACY_CANVAS_CONFIG_FILE = "storyboard.canvas.json";
/** Root and grouped-location candidates, with the compatible root path first. */
export declare function configFileCandidates(root: string, filename: string): string[];
/** Application candidates use filename precedence first, then location precedence. */
export declare function appConfigCandidates(root: string): string[];
/**
 * Pick the layout for a new config file. An existing application config is
 * authoritative; otherwise retain whichever directory already contains a
 * Hypercanvas `*.config.json` file. Fresh projects continue to use the root.
 */
export declare function resolveConfigDirectory(root: string): string;
/**
 * Notebook variant of resolveConfigDirectory: an existing config location is
 * kept wherever it is (root, `config/`, `backstage/config/`); a Notebook with
 * none scaffolds into `backstage/config/`.
 */
export declare function resolveNotebookConfigDirectory(root: string): string;
/** Config write target for a Notebook: the existing file, else the Notebook config directory. */
export declare function resolveNotebookConfigWritePath(root: string, filename: string): string;
/** Resolve a named Hypercanvas config for reading, preferring its root copy. */
export declare function resolveConfigFilePath(root: string, filename: string): string;
/** All candidates for a named Hypercanvas config, in read-precedence order. */
export declare function resolveConfigFileCandidates(root: string, filename: string): string[];
/** Resolve a named Hypercanvas config target without creating a shadow copy. */
export declare function resolveConfigFileWritePath(root: string, filename: string): string;
/** Path readers should open for the application config under `root`. */
export declare function resolveAppConfigPath(root: string): string;
/** Alias writers use so the existing file keeps being the single source. */
export declare function resolveAppConfigWritePath(root: string): string;
/** Primary-name target used by writers that migrate a legacy filename. */
export declare function resolveAppConfigPrimaryWritePath(root: string): string;
/** Parsed `hypercanvas.config.json` (or its legacy fallback), or null. */
export declare function readAppConfig(root: string): Record<string, unknown> | null;
/** Raw config file text or null, using the same read order. */
export declare function readAppConfigRaw(root: string): string | null;
