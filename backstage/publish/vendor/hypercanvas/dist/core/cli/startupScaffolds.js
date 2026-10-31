import fs from 'node:fs';
import { hasNotebookManifest, resolveNotebookManifestPath } from '../notebook/notebook.js';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createNotebookRuntime } from '../notebook/runtime.js';
import { resolveNotebookStateDirectory } from '../notebook/stateDirectory.js';
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
const NOTEBOOK_TEMPLATE_INFRASTRUCTURE = new Set([
    '.git', '.hypercanvas', '.storyboard', '.vite', '.agents', 'node_modules', 'build', 'coverage', 'dist',
    'publish', 'public', 'storybook-static', '.storyboard-public',
]);
function copyNotebookTemplateEntry(source, destination) {
    const stat = fs.lstatSync(source);
    if (stat.isSymbolicLink())
        return;
    if (stat.isDirectory()) {
        if (NOTEBOOK_TEMPLATE_INFRASTRUCTURE.has(path.basename(source)))
            return;
        fs.mkdirSync(destination, { recursive: true });
        for (const entry of fs.readdirSync(source))
            copyNotebookTemplateEntry(path.join(source, entry), path.join(destination, entry));
    }
    else if (stat.isFile()) {
        fs.copyFileSync(source, destination);
    }
    else {
        throw new Error(`Unsupported scaffold entry: ${source}`);
    }
}
/** Like copyTree, but skips files whose destination already matches byte-for-byte. */
function copyTreeIfChanged(source, destination) {
    const stat = fs.statSync(source);
    if (stat.isDirectory()) {
        fs.mkdirSync(destination, { recursive: true });
        for (const entry of fs.readdirSync(source))
            copyTreeIfChanged(path.join(source, entry), path.join(destination, entry));
    }
    else if (stat.isFile()) {
        if (fs.existsSync(destination) && fs.readFileSync(source).equals(fs.readFileSync(destination)))
            return;
        fs.copyFileSync(source, destination);
    }
    else {
        throw new Error(`Unsupported scaffold entry: ${source}`);
    }
}
/**
 * Skills a Notebook's agents need. Notebooks are the user surface: agents in a
 * notebook author prototypes, canvases, and data — not app releases or
 * repository workflows, so dev-repo skills (ship, clips, changelog, changeset,
 * release, agent-browser, design-system-catalog, vitest,
 * web-perf, worktree, migrate) stay out of Notebooks.
 */
const NOTEBOOK_SKILLS = [
    'create',
    'hypercanvas',
    'hypercanvas-canvas',
    'hypercanvas-knobs',
    'hypercanvas-tools',
    'hypercanvas-widget',
    'notebook-publishing',
];
// The demo Notebook lives directly under the home folder. ~/Documents is
// privacy-protected and iCloud-synced, so evicted files made startup fail
// with EPERM.
function demoNotebookDir(home, suffix) {
    return path.join(home, `hypercanvas${suffix}`, 'demo');
}
// Where earlier builds provisioned the demo Notebook.
function legacyDemoNotebookDir(home, suffix) {
    return path.join(home, 'Documents', `hypercanvas${suffix}`, 'demo');
}
const operations = [
    {
        id: 'demo-notebook',
        policy: 'once-per-user-profile',
        provision({ profile, home, source }) {
            const suffix = profile === 'development' ? '-dev' : '';
            const configDir = path.join(home, `.hypercanvas${suffix}`);
            const settingsPath = path.join(configDir, 'settings.json');
            const destination = demoNotebookDir(home, suffix);
            let settings = {};
            if (fs.existsSync(settingsPath)) {
                const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                if (!isRecord(parsed))
                    throw new Error(`Invalid settings object: ${settingsPath}`);
                settings = parsed;
            }
            const provisionedAt = typeof settings.demoNotebookPath === 'string'
                ? settings.demoNotebookPath
                : legacyDemoNotebookDir(home, suffix);
            // The marker only skips work while the folder is still there; a missing demo
            // (deleted, or never moved from an older location) is provisioned again.
            if (settings.demoNotebookProvisioned === true && provisionedAt === destination && hasNotebookManifest(destination))
                return destination;
            if (!fs.existsSync(destination)) {
                const manifest = resolveNotebookManifestPath(source);
                let manifestStat = null;
                try {
                    manifestStat = fs.lstatSync(manifest);
                }
                catch { /* surfaced below */ }
                if (!manifestStat?.isFile())
                    throw new Error('Demo Notebook template is missing a regular hypercanvas.notebook.json');
                const parent = path.dirname(destination);
                fs.mkdirSync(parent, { recursive: true });
                const staging = path.join(parent, `.demo-${process.pid}-staging`);
                fs.rmSync(staging, { recursive: true, force: true });
                fs.mkdirSync(staging);
                try {
                    for (const entry of fs.readdirSync(source)) {
                        copyNotebookTemplateEntry(path.join(source, entry), path.join(staging, entry));
                    }
                    fs.renameSync(staging, destination);
                }
                catch (error) {
                    fs.rmSync(staging, { recursive: true, force: true });
                    throw error;
                }
            }
            fs.mkdirSync(configDir, { recursive: true });
            const temporary = `${settingsPath}.${process.pid}.tmp`;
            fs.writeFileSync(temporary, `${JSON.stringify({ ...settings, demoNotebookProvisioned: true, demoNotebookPath: destination }, null, 2)}\n`);
            fs.renameSync(temporary, settingsPath);
            return destination;
        },
    },
    {
        id: 'demo-notebook-modules',
        // Runs on every startup so notebooks provisioned by an older build keep
        // working: prototype-owned CSS (`@import "tailwindcss"`) must resolve from
        // the Notebook folder, which has no node_modules of its own.
        policy: 'every-startup',
        provision({ profile, home }) {
            const suffix = profile === 'development' ? '-dev' : '';
            const destination = demoNotebookDir(home, suffix);
            if (!hasNotebookManifest(destination))
                return destination;
            // Resolve packages the way Node would from this module — handles
            // hoisted workspace installs (dev) and the packaged bundle layout
            // (node_modules lives next to the compiled package) alike.
            let appNodeModules;
            try {
                const pkgJson = createRequire(import.meta.url).resolve('tailwindcss/package.json');
                appNodeModules = path.dirname(path.dirname(pkgJson));
            }
            catch {
                appNodeModules = path.join(PACKAGE_ROOT, 'node_modules');
            }
            for (const name of ['tailwindcss']) {
                const packageRoot = path.join(appNodeModules, name);
                if (!fs.existsSync(packageRoot))
                    continue;
                const modulesDir = path.join(destination, 'node_modules');
                fs.mkdirSync(modulesDir, { recursive: true });
                const link = path.join(modulesDir, name);
                const target = fs.realpathSync(packageRoot);
                try {
                    const existing = fs.readlinkSync(link);
                    if (existing === target)
                        continue;
                }
                catch { /* not a symlink yet — create or replace below */ }
                try {
                    fs.rmSync(link, { force: true, recursive: true });
                }
                catch { /* ignore */ }
                try {
                    fs.symlinkSync(target, link, 'dir');
                }
                catch { /* best-effort */ }
            }
            return destination;
        },
    },
    {
        id: 'demo-notebook-agent-guidance',
        // Runs on every startup so notebooks provisioned by an older build keep
        // working: agents opened in the Notebook need the user-facing instructions
        // and the curated Notebook skill set, kept current with the installed
        // build. Never overwrites an edited AGENTS.md; shipped skills are
        // app-owned and refresh when their source changes.
        policy: 'every-startup',
        provision({ profile, home }) {
            const suffix = profile === 'development' ? '-dev' : '';
            const destination = demoNotebookDir(home, suffix);
            if (!hasNotebookManifest(destination))
                return destination;
            // Agent guidance is app-owned single-sourced from the bundled scaffold
            // (which also scaffolds it into client prototype repositories).
            const agentsDestination = path.join(destination, 'AGENTS.md');
            const agentsSource = path.join(PACKAGE_ROOT, 'scaffold', 'AGENTS.md');
            copyTreeIfChanged(agentsSource, agentsDestination);
            const scaffoldSkills = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../scaffold/skills');
            const skillsRoot = path.join(destination, '.agents', 'skills');
            for (const name of NOTEBOOK_SKILLS) {
                const skillSource = path.join(scaffoldSkills, name);
                if (!fs.existsSync(path.join(skillSource, 'SKILL.md')))
                    continue;
                copyTreeIfChanged(skillSource, path.join(skillsRoot, name));
            }
            return destination;
        },
    },
];
export function runStartupScaffolds({ profile = 'development', home = os.homedir(), source = process.env.HYPERCANVAS_DEMO_NOTEBOOK_TEMPLATE || path.resolve(PACKAGE_ROOT, '../../fixtures/notebooks/demo-notebook') } = {}) {
    if (!fs.existsSync(source) && !process.env.HYPERCANVAS_DEMO_NOTEBOOK_TEMPLATE)
        return {};
    const results = {};
    for (const operation of operations)
        results[operation.id] = operation.provision({ profile, home, source });
    return results;
}
export function defaultDemoNotebookPath(profile = 'development', home = os.homedir()) {
    const suffix = profile === 'development' ? '-dev' : '';
    return demoNotebookDir(home, suffix);
}
/** Prefer an explicitly configured Notebook, then the last available selection. */
export function resolveStartupNotebook({ profile = 'development', home = os.homedir(), activeNotebook = process.env.HYPERCANVAS_NOTEBOOK_ROOT, stateDirectory, fallback = defaultDemoNotebookPath(profile, home), } = {}) {
    if (activeNotebook && hasNotebookManifest(activeNotebook)) {
        return path.resolve(activeNotebook);
    }
    const runtime = createNotebookRuntime({
        stateDirectory: resolveNotebookStateDirectory({ profile, home, ...(stateDirectory ? { stateDirectory } : {}) }),
    });
    const legacyDemo = legacyDemoNotebookDir(home, profile === 'development' ? '-dev' : '');
    return runtime.recent().find(entry => entry.available && path.resolve(entry.root) !== legacyDemo)?.root || fallback;
}
/**
 * Provision startup scaffolds and choose the Notebook Core opens. A failed
 * scaffold or a missing Notebook folder must never stop Core: the Notebook
 * root is cleared and a notice is returned so the in-app selection screen takes
 * over. Returns null when a Notebook is ready.
 */
export function prepareStartupNotebook({ profile = 'development', env = process.env, scaffold = runStartupScaffolds, } = {}) {
    const withoutNotebook = (notice) => {
        delete env.HYPERCANVAS_NOTEBOOK_ROOT;
        env.HYPERCANVAS_NOTEBOOK_NOTICE = notice;
        return notice;
    };
    try {
        const scaffolds = scaffold({ profile });
        if (scaffolds['demo-notebook']) {
            env.HYPERCANVAS_NOTEBOOK_ROOT = resolveStartupNotebook({
                profile,
                ...(env.HYPERCANVAS_NOTEBOOK_ROOT ? { activeNotebook: env.HYPERCANVAS_NOTEBOOK_ROOT } : {}),
                ...(env.HYPERCANVAS_NOTEBOOK_STATE_DIR ? { stateDirectory: env.HYPERCANVAS_NOTEBOOK_STATE_DIR } : {}),
                fallback: scaffolds['demo-notebook'],
            });
        }
    }
    catch (error) {
        return withoutNotebook(`Startup setup failed (${error instanceof Error ? error.message : String(error)}). Select a notebook to continue.`);
    }
    const root = env.HYPERCANVAS_NOTEBOOK_ROOT;
    if (root && !hasNotebookManifest(root)) {
        return withoutNotebook(`The notebook folder “${root}” was not found. Select a notebook to continue.`);
    }
    return null;
}
