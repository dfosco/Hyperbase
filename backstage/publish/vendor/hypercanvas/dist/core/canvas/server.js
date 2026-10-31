/**
 * Canvas Server API — CRUD operations for .canvas.jsonl files.
 *
 * Canvas data is stored as an append-only JSONL event stream.
 * Each line is a JSON event object. The first line is always a
 * `canvas_created` event containing the full initial state.
 * Subsequent lines are atomic change events. Current state is
 * derived by replaying the stream via the materializer.
 *
 * Routes (mounted at /_hypercanvas/canvas/):
 *   GET    /read     — read materialized canvas state
 *   GET    /list     — list all canvases
 *   GET    /folders  — list canvas folders
 *   PUT    /update   — append update events (widgets, sources, settings)
 *   POST   /undo     — append the inverse of a previously-applied event
 *   POST   /redo     — re-apply an undone event (mirror of /undo)
 *   PUT    /rename-page — rename a canvas page file
 *   PUT    /reorder-pages — save page order for a canvas folder
 *   GET    /page-order — read page order for a folder
 *   PUT    /update-folder-meta — update folder .meta.json title
 *   POST   /widget   — append a widget_added event
 *   PATCH  /widget   — update a single widget's props/position
 *   DELETE /widget   — append a widget_removed event
 *   POST   /connector — append a connector_added event
 *   DELETE /connector — append a connector_removed event
 *   POST   /batch    — execute multiple operations in one request (refs, single HMR push)
 *   POST   /create   — create a new .canvas.jsonl file
 *   GET    /stories  — list all .story.{jsx,tsx} files with exports
 *   POST   /create-story — scaffold a new .story.{jsx,tsx} file
 *   GET    /github/available — check if local gh CLI is installed
 *   POST   /github/embed — fetch GitHub issue/discussion/PR/comment metadata via gh
 *   POST   /image    — upload a pasted image to src/canvas/images/
 *   GET    /images/* — serve an image file from src/canvas/images/
 *   POST   /image/toggle-private — toggle ~prefix on image filename
 *   GET    /terminal-buffer/:id — read private terminal buffer (with ?length=N)
 *   GET    /terminal-snapshot/:id — read public terminal snapshot
 */
import fs from 'node:fs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { resolveRuntimeDir, runtimeDirNames } from '../runtimeDir.js';
import { readOptionalGitValue } from '../data/gitMetadata.js';
import { Buffer } from 'node:buffer';
import { applyEvent, captureCanvasLayoutRestoration, materialize, materializeFromText, parseCanvasJsonl, reverseCanvasLayoutRestoration, serializeEvent, validateCanvasJsonl } from './materializer.js';
import { decodeCanvasEvent } from './canvasEvents.js';
import { appendCanvasEventRaw as appendEventRaw, assertCanvasWritable, rememberCanvasFormat } from './canvasEventWriter.js';
import { buildInverseEvent } from './undoRedo.js';
import { compactCanvas } from './compact.js';
import { canvasPayloadRevision, deleteCanvasArtifact, deleteCanvasPage, writeCanvasPage } from './page-lifecycle.js';
import { toCanvasId, parseCanvasId } from './identity.js';
import { GH_INSTALL_URL, GitHubEmbedError, fetchGitHubEmbedSnapshot, isGhCliAvailable, isGitHubEmbedUrl, } from './githubEmbeds.js';
import { stampBounds, stampBoundsAll, resolvePosition, getWidgetBounds, findBestAnchors } from './collision.js';
import { markCanvasWrite, unmarkCanvasWrite } from './writeGuard.js';
import { devLog } from '../logger/devLogger.js';
import { buildHostWorkloadEnv, HostRuntimeError, quoteShellWord, reassertHostPath, resolveAgentHostRuntime, rewriteAgentCommand, rewriteAgentConfig, } from '../host-tools/runtime.js';
import { getServerWidgetDefinition } from './customWidgets.js';
import { readAgentsConfig } from './configReader.js';
import { planWidgetCreation } from './creationPlacement.js';
import { createTerminalSession, snapshotTerminalSession, subscribeTerminalSession, terminalSessionExists, terminalWidgetStartupKey, submitTerminalKeys, submitTerminalText, withTerminalStartup, writeTerminalText, } from './terminal-runtime.js';
import { initPaseoTerminalRuntime } from './paseo-terminal-runtime.js';
import { confirmNotebookPaseoBinding } from './paseo-notebook-binding.js';
import { closeWidgetSession, restoreWidgetSession } from './widget-session-lifecycle.js';
import { inspectNotebook, registerNotebookPage, updateNotebookPage, unregisterNotebookPage, hasNotebookManifest } from '../notebook/notebook.js';
import { notebookContentPath } from '../notebook/layout.js';
import { canvasArtifactDirectoryForPayload, notebookCanvasArtifactPaths } from './artifact-paths.js';
import { artifactFolderVisibilityPrefix } from '../artifact/visibility.js';
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function notifyArtifactChanged(filePath, event) {
    const hook = Reflect.get(globalThis, '__HYPERCANVAS_NOTIFY_ARTIFACT_CHANGE__');
    if (typeof hook === 'function') {
        try {
            hook(filePath, event);
        }
        catch { /* artifact notifications are best-effort */ }
    }
}
function stringField(record, key) {
    return typeof record[key] === 'string' ? record[key] : null;
}
function recordField(record, key) {
    return isRecord(record[key]) ? record[key] : null;
}
function pointField(value) {
    if (!isRecord(value) || typeof value.x !== 'number' || !Number.isFinite(value.x) || typeof value.y !== 'number' || !Number.isFinite(value.y))
        return null;
    return { x: value.x, y: value.y };
}
function waypointsField(value) {
    if (!Array.isArray(value))
        return null;
    const result = [];
    for (const item of value) {
        if (!isRecord(item) || typeof item.dx !== 'number' || !Number.isFinite(item.dx) || typeof item.dy !== 'number' || !Number.isFinite(item.dy))
            return null;
        result.push({
            dx: item.dx,
            dy: item.dy,
            ...(typeof item.tHint === 'number' ? { tHint: item.tHint } : {}),
            ...(item.orientation === 'h' || item.orientation === 'v' ? { orientation: item.orientation } : {}),
        });
    }
    return result;
}
function batchOperationsField(value) {
    if (!Array.isArray(value))
        return null;
    const operations = [];
    for (const item of value) {
        if (!isRecord(item) || typeof item.op !== 'string')
            return null;
        const operation = { op: item.op };
        for (const key of ['type', 'ref', 'pool', 'direction', 'source', 'widgetId', 'connectorId', 'startWidgetId', 'endWidgetId', 'startAnchor', 'endAnchor', 'connectorType', 'className']) {
            if (item[key] === undefined)
                continue;
            if (typeof item[key] !== 'string')
                return null;
            operation[key] = item[key];
        }
        if (item.props !== undefined) {
            const props = isRecord(item.props) ? item.props : null;
            if (!props)
                return null;
            operation.props = props;
        }
        if (item.position !== undefined) {
            const position = pointField(item.position);
            if (!position)
                return null;
            operation.position = position;
        }
        if (item.near !== undefined) {
            if (item.near !== false && typeof item.near !== 'string')
                return null;
            operation.near = item.near;
        }
        if (item.resolve !== undefined) {
            if (typeof item.resolve !== 'boolean')
                return null;
            operation.resolve = item.resolve;
        }
        if (item.gap !== undefined) {
            if (typeof item.gap !== 'number' || !Number.isFinite(item.gap))
                return null;
            operation.gap = item.gap;
        }
        for (const key of ['meta', 'style', 'data']) {
            if (item[key] === undefined)
                continue;
            const field = isRecord(item[key]) ? item[key] : null;
            if (!field)
                return null;
            operation[key] = field;
        }
        for (const key of ['startEndpoint', 'endEndpoint']) {
            if (item[key] === undefined)
                continue;
            if (item[key] !== null && typeof item[key] !== 'string')
                return null;
            operation[key] = item[key];
        }
        if (item.expectedRevision !== undefined) {
            if (typeof item.expectedRevision !== 'string' || !/^[a-f\d]{64}$/i.test(item.expectedRevision))
                return null;
            operation.expectedRevision = item.expectedRevision;
        }
        if (item.sourceBinding !== undefined) {
            if (!isRecord(item.sourceBinding) || typeof item.sourceBinding.canvasId !== 'string'
                || !item.sourceBinding.canvasId
                || (item.sourceBinding.jsxReference !== null && typeof item.sourceBinding.jsxReference !== 'string'))
                return null;
            operation.sourceBinding = {
                canvasId: item.sourceBinding.canvasId,
                jsxReference: item.sourceBinding.jsxReference,
            };
        }
        if (item.layout !== undefined) {
            if (!isRecord(item.layout))
                return null;
            operation.layout = item.layout;
        }
        operations.push(operation);
    }
    return operations;
}
function canvasWidgetsField(value) {
    if (!Array.isArray(value) || !value.every(isCanvasWidget))
        return null;
    return value.map((item) => ({ ...item }));
}
function isCanvasWidget(value) {
    return isRecord(value) && typeof value.id === 'string' && typeof value.type === 'string';
}
function asAgentConfig(value) {
    if (!isRecord(value) || typeof value.startupCommand !== 'string')
        return null;
    return {
        ...value,
        startupCommand: value.startupCommand,
        ...(typeof value.readinessSignal === 'string' ? { readinessSignal: value.readinessSignal } : {}),
        ...(typeof value.postStartup === 'string' ? { postStartup: value.postStartup } : {}),
    };
}
function outputBytes(value) {
    if (!isRecord(value))
        return new Uint8Array();
    const bytes = value.bytes;
    if (Buffer.isBuffer(bytes) || bytes instanceof Uint8Array)
        return bytes;
    if (Array.isArray(bytes) && bytes.every((byte) => typeof byte === 'number' && Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
        return Uint8Array.from(bytes);
    }
    return new Uint8Array();
}
function toLayoutWidget(widget) {
    if (!widget || typeof widget.type !== 'string')
        return null;
    const position = isRecord(widget.position)
        && typeof widget.position.x === 'number' && Number.isFinite(widget.position.x)
        && typeof widget.position.y === 'number' && Number.isFinite(widget.position.y)
        ? { x: widget.position.x, y: widget.position.y }
        : { x: 0, y: 0 };
    return {
        id: widget.id,
        type: widget.type,
        position,
        props: isRecord(widget.props) ? widget.props : {},
    };
}
function stampCanvasWidgets(widgets) {
    const layouts = widgets.map(toLayoutWidget).filter((widget) => Boolean(widget));
    if (layouts.length !== widgets.length)
        throw new Error('Canvas widget is missing a type.');
    const stamped = stampBoundsAll(layouts);
    return widgets.map((widget, index) => {
        const layout = stamped[index];
        if (!layout)
            throw new Error('Canvas widget layout could not be stamped.');
        return { ...widget, bounds: layout.bounds };
    });
}
/**
 * Read the prompt widget's execution config from the merged widget registry.
 * Returns { default, agents } where each agent has a command template.
 */
function getPromptExecution() {
    const def = getServerWidgetDefinition('prompt');
    return def?.execution || null;
}
function canvasContentRoot(root) {
    const notebookCanvas = path.join(root, 'canvas');
    return fs.existsSync(notebookCanvas) ? notebookCanvas : path.join(root, 'src', 'canvas');
}
/**
 * Build the CLI command for a prompt spawn.
 * Reads the prompt widget's execution.agents config and interpolates ${prompt}.
 */
function buildPromptCmd({ prompt, envFile, agentId, agentRuntime }) {
    const execution = getPromptExecution();
    if (!isRecord(execution) || !isRecord(execution.agents))
        return null;
    const id = agentId || (typeof execution.default === 'string' ? execution.default : '');
    const agentValue = execution.agents[id];
    if (!isRecord(agentValue) || typeof agentValue.command !== 'string')
        return null;
    const commandTemplate = agentValue.command;
    const promptWord = quoteShellWord(prompt);
    const configured = commandTemplate.includes('"${prompt}"')
        ? commandTemplate.replace('"${prompt}"', promptWord)
        : commandTemplate.replace('${prompt}', promptWord);
    const command = rewriteAgentCommand(agentRuntime, configured);
    return `source ${quoteShellWord(envFile)} && ${reassertHostPath(agentRuntime, `exec ${command}`)}`;
}
/**
 * Scan src/canvas/ for directories containing .meta.json files.
 * Returns an object keyed by directory name (without .folder suffix).
 */
function findCanvasMeta(root) {
    const canvasDir = canvasContentRoot(root);
    const groups = {};
    if (!fs.existsSync(canvasDir))
        return groups;
    const entries = fs.readdirSync(canvasDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;
        const dirName = entry.name.replace(/\.folder$/, '');
        const metaPath = path.join(canvasDir, entry.name, `${dirName}.meta.json`);
        if (fs.existsSync(metaPath)) {
            try {
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                groups[dirName] = meta;
            }
            catch { /* skip invalid meta */ }
        }
    }
    return groups;
}
/**
 * Read .meta.json from a canvas folder directory.
 */
function readFolderMeta(folderDir) {
    const dirName = path.basename(folderDir).replace(/\.folder$/, '');
    const metaPath = path.join(folderDir, `${dirName}.meta.json`);
    if (fs.existsSync(metaPath)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            return isRecord(parsed) ? parsed : {};
        }
        catch { /* ignore */ }
    }
    return {};
}
/**
 * Write .meta.json to a canvas folder directory.
 */
function writeFolderMeta(folderDir, meta) {
    const dirName = path.basename(folderDir).replace(/\.folder$/, '');
    const metaPath = path.join(folderDir, `${dirName}.meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
}
/**
 * Recursively find all .canvas.jsonl files in the project.
 */
function findCanvasFiles(root) {
    if (hasNotebookManifest(root)) {
        const snapshot = inspectNotebook(root);
        if (snapshot.status !== 'valid')
            return [];
        return snapshot.pages
            .filter(page => page.type === 'canvas' && page.available && typeof page.path === 'string' && page.path.endsWith('.canvas.jsonl'))
            .map(page => page.path)
            .filter(file => fs.existsSync(path.resolve(root, file)));
    }
    const results = [];
    const ignore = new Set(['node_modules', 'dist', '.git', ...runtimeDirNames(), 'publish', '.worktrees', 'worktrees']);
    function walk(dir, rel) {
        let entries = [];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true, encoding: 'utf8' });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (ignore.has(entry.name))
                continue;
            const fullPath = path.join(dir, entry.name);
            const relPath = rel ? `${rel}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                walk(fullPath, relPath);
            }
            else if (entry.name.endsWith('.canvas.jsonl')) {
                results.push(relPath);
            }
        }
    }
    walk(root, '');
    return results;
}
/**
 * Recursively find all .story.{jsx,tsx} files in routable directories
 * (src/canvas/ and src/components/) and extract their named exports.
 */
function findStoryFiles(root) {
    const results = [];
    const ignore = new Set(['node_modules', 'dist', '.git', ...runtimeDirNames(), 'publish', '.worktrees', 'worktrees']);
    const ROUTABLE_DIRS = [
        path.relative(root, canvasContentRoot(root)),
        'src/components',
    ];
    function walk(dir, rel) {
        let entries = [];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true, encoding: 'utf8' });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (ignore.has(entry.name))
                continue;
            if (entry.name.startsWith('_'))
                continue;
            const fullPath = path.join(dir, entry.name);
            const relPath = rel ? `${rel}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                walk(fullPath, relPath);
            }
            else if (/\.story\.(jsx|tsx)$/.test(entry.name)) {
                const name = entry.name.replace(/\.story\.(jsx|tsx)$/, '');
                const exports = parseExportNames(fullPath);
                results.push({ name, path: relPath, exports });
            }
        }
    }
    for (const dir of ROUTABLE_DIRS) {
        const absDir = path.join(root, dir);
        if (fs.existsSync(absDir)) {
            walk(absDir, dir);
        }
    }
    return results;
}
/**
 * Parse named function/const exports from a JSX/TSX file.
 */
function parseExportNames(filePath) {
    try {
        const src = fs.readFileSync(filePath, 'utf-8');
        const names = [];
        const re = /export\s+(?:function|const|class)\s+([A-Z]\w*)/g;
        let m;
        while ((m = re.exec(src)) !== null) {
            const name = m[1];
            if (name)
                names.push(name);
        }
        return names;
    }
    catch {
        return [];
    }
}
/**
 * Find a canvas JSONL file by canonical ID.
 * Only matches canonical path-based IDs from toCanvasId().
 */
function findCanvasPath(root, canvasId) {
    const files = findCanvasFiles(root);
    if (hasNotebookManifest(root)) {
        const snapshot = inspectNotebook(root);
        if (snapshot.status === 'valid') {
            const stableMatches = snapshot.artifacts.filter(artifact => artifact.kind === 'canvas'
                && artifact.available && artifact.id === canvasId && artifact.payloadPath);
            if (stableMatches.length === 1)
                return path.resolve(root, stableMatches[0].payloadPath);
            if (stableMatches.length > 1)
                return null;
        }
    }
    const canonicalMatches = files.filter(file => canvasIdForFile(file) === canvasId);
    if (canonicalMatches.length === 1)
        return path.resolve(root, canonicalMatches[0]);
    if (canonicalMatches.length > 1)
        return null;
    const basenameMatches = files.filter(file => path.basename(file).replace(/\.canvas\.jsonl$/, '') === canvasId);
    return basenameMatches.length === 1 ? path.resolve(root, basenameMatches[0]) : null;
}
function stableCanvasIdForFile(root, file) {
    if (hasNotebookManifest(root)) {
        const relative = notebookRelativePath(root, file);
        const snapshot = inspectNotebook(root);
        if (snapshot.status === 'valid') {
            const artifact = snapshot.artifacts.find(item => item.kind === 'canvas' && item.payloadPath === relative);
            if (artifact)
                return artifact.id;
        }
    }
    return canvasIdForFile(notebookRelativePath(root, file));
}
function notebookRelativePath(root, target) {
    return path.relative(fs.realpathSync.native(root), fs.realpathSync.native(target)).replaceAll('\\', '/');
}
// Notebooks store canvases at `canvas/`, while application projects use
// `src/canvas/`. Normalize both layouts before creating the public ID.
function canvasIdForFile(file) {
    const normalized = file.replace(/\\/g, '/');
    return toCanvasId(normalized.startsWith('canvas/') ? `src/${normalized}` : normalized);
}
/**
 * Read a .canvas.jsonl file and materialize its current state.
 */
function readCanvas(filePath) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return materializeFromText(raw);
}
function canvasDocumentRevision(raw) {
    return createHash('sha256').update(raw).digest('hex');
}
function readCanvasSnapshot(filePath) {
    const raw = fs.readFileSync(filePath);
    return { ...materializeFromText(raw.toString('utf-8')), documentRevision: canvasDocumentRevision(raw) };
}
function appendLayoutToDocument(raw, layoutEvent) {
    const parts = raw.toString('utf-8').split(/(\r?\n)/);
    const lineIndexes = parts.filter((_, index) => index % 2 === 0);
    let firstRecordIndex = -1;
    let firstRecord = null;
    for (let index = 0; index < lineIndexes.length; index++) {
        const line = lineIndexes[index];
        if (!line?.trim())
            continue;
        const parsed = JSON.parse(line);
        if (!isRecord(parsed) || parsed.event !== 'canvas_created') {
            throw new Error('The first canvas record must be canvas_created');
        }
        firstRecordIndex = index * 2;
        firstRecord = parsed;
        break;
    }
    if (firstRecordIndex < 0 || !firstRecord)
        throw new Error('Canvas document has no canvas_created record');
    if (firstRecord.formatVersion !== undefined && firstRecord.formatVersion !== 1 && firstRecord.formatVersion !== 2) {
        throw new Error(`Unsupported canvas formatVersion: ${String(firstRecord.formatVersion)}`);
    }
    if (firstRecord.formatVersion !== 2) {
        parts[firstRecordIndex] = serializeEvent({ ...firstRecord, formatVersion: 2 });
    }
    const existing = parts.join('');
    return `${existing}${existing.endsWith('\n') ? '' : '\n'}${serializeEvent(layoutEvent)}\n`;
}
function replaceCanvasDocument(filePath, expectedRevision, nextText) {
    const diagnostics = validateCanvasJsonl(nextText);
    if (diagnostics.length) {
        const first = diagnostics[0];
        const error = new Error(`Canvas document validation failed at line ${first?.line ?? 1}: ${first?.message ?? 'invalid document'}`);
        error.status = 400;
        throw error;
    }
    materializeFromText(nextText);
    const current = fs.readFileSync(filePath);
    if (canvasDocumentRevision(current) !== expectedRevision) {
        const error = new Error('Canvas document changed before the layout transaction could be saved');
        error.status = 409;
        throw error;
    }
    assertCanvasWritable(filePath);
    const stat = fs.statSync(filePath);
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
    let marked = false;
    try {
        fs.writeFileSync(temporaryPath, nextText, { encoding: 'utf-8', mode: stat.mode, flag: 'wx' });
        const fd = fs.openSync(temporaryPath, 'r');
        try {
            fs.fsyncSync(fd);
        }
        finally {
            fs.closeSync(fd);
        }
        const latest = fs.readFileSync(filePath);
        if (canvasDocumentRevision(latest) !== expectedRevision) {
            const error = new Error('Canvas document changed before the layout transaction could be saved');
            error.status = 409;
            throw error;
        }
        markCanvasWrite(filePath);
        marked = true;
        fs.renameSync(temporaryPath, filePath);
        rememberCanvasFormat(filePath);
        setTimeout(() => unmarkCanvasWrite(filePath), 1000);
        marked = false;
        return canvasDocumentRevision(Buffer.from(nextText, 'utf-8'));
    }
    catch (error) {
        try {
            fs.unlinkSync(temporaryPath);
        }
        catch { /* temporary file may already be renamed */ }
        if (marked)
            unmarkCanvasWrite(filePath);
        throw error;
    }
}
function findCanvasWidget(root, widgetId, canvasId = null) {
    const files = canvasId
        ? [findCanvasPath(root, canvasId)].filter((file) => Boolean(file))
        : findCanvasFiles(root).map(file => path.resolve(root, file));
    for (const file of files) {
        try {
            const widget = readCanvas(file).widgets?.find(entry => entry.id === widgetId);
            if (widget)
                return widget;
        }
        catch { /* continue past unreadable canvas files */ }
    }
    return null;
}
/**
 * Append a single event line to a .canvas.jsonl file.
 */
/**
 * Generate a short random event id. Stamped on every canvas event so
 * undo/redo can reference the inverse target by id alone.
 */
function generateEventId() {
    return `evt_${Math.random().toString(36).slice(2, 10)}`;
}
/**
 * Hard ceiling for runaway sessions: when a JSONL file grows past this size,
 * compact it once (collapses history into a single `canvas_created` baseline).
 * Set above the normal startup-compaction threshold (500 KB) so most files
 * never hit it — only marathon sessions that don't restart the dev server.
 */
const SOFT_COMPACT_THRESHOLD_BYTES = 2 * 1024 * 1024;
/** Per-file lock to avoid compacting the same file repeatedly on bursts. */
const inFlightCompactions = new Set();
/**
 * Check the file size after a write; if past the runaway threshold, kick off
 * a one-shot compaction. Best-effort — failures are swallowed and logged.
 */
function maybeCompactRunawayFile(filePath) {
    if (inFlightCompactions.has(filePath))
        return;
    let size;
    try {
        size = fs.statSync(filePath).size;
    }
    catch {
        return;
    }
    if (size < SOFT_COMPACT_THRESHOLD_BYTES)
        return;
    inFlightCompactions.add(filePath);
    // Run on the next tick so this append's HMR push fires first and the
    // compaction's HMR push lands after — the client treats both consistently
    // (compaction's push is a single canvas_created event that reconciles).
    setImmediate(() => {
        try {
            const result = compactCanvas(filePath, { force: true });
            devLog().logEvent('info', `[canvas] runaway compaction ${path.basename(filePath)}`, {
                before: result.before,
                after: result.after,
            });
        }
        catch (err) {
            devLog().logEvent('warn', `[canvas] runaway compaction failed for ${filePath}`, { error: errorMessage(err) });
        }
        finally {
            inFlightCompactions.delete(filePath);
        }
    });
}
/**
 * Generate a unique widget ID.
 */
function generateWidgetId(type) {
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${type}-${suffix}`;
}
/**
 * Create the canvas API route handler.
 */
export function createCanvasHandler(ctx) {
    const { root, sendJson, hotPool, workspaceIdResolver } = ctx;
    const headlessSubscriptions = new Map();
    const ownedStoryPreviews = new Map();
    const resolveActiveWorkspaceId = async () => {
        if (typeof workspaceIdResolver === 'function')
            return workspaceIdResolver(root);
        const confirmed = await confirmNotebookPaseoBinding(root);
        return confirmed.workspaceId;
    };
    /**
     * Compute a target position relative to a reference widget.
     * @param {object} refWidget — widget to position near (must have position + type/props)
     * @param {string} direction — 'right' | 'left' | 'above' | 'below' | 'above-right' | 'below-right' | 'above-left' | 'below-left'
     * @param {string} newType — type of the widget being created (for size defaults)
     * @param {object} newProps — props of the widget being created
     * @param {number} gap — spacing between widgets in grid spaces (default 1)
     * @param {number} gridSize — pixel size of one grid unit (default 24)
     * @returns {{ x: number, y: number }}
     */
    /**
     * Map a `--direction` value to the preferred collision-resolution axis.
     * Side placements (left/right/diagonals) cascade vertically so a fan of
     * widgets stacks into a clean column instead of getting shoved further
     * away from the reference widget. Above/below cascade horizontally.
     */
    function directionPreferAxis(direction) {
        if (direction === 'above' || direction === 'below')
            return 'horizontal';
        return 'vertical';
    }
    function computeNearPosition(refWidget, direction = 'right', newType = 'sticky-note', newProps = {}, gap = 1, gridSize = 24) {
        gap = gap * gridSize;
        const refBounds = getWidgetBounds(refWidget);
        const newDefaults = getWidgetBounds({ type: newType, props: newProps, position: { x: 0, y: 0 } });
        const refCenterY = refBounds.y + refBounds.height / 2;
        switch (direction) {
            case 'left':
                return { x: refBounds.x - newDefaults.width - gap, y: refBounds.y };
            case 'above':
                return { x: refBounds.x, y: refBounds.y - newDefaults.height - gap };
            case 'below':
                return { x: refBounds.x, y: refBounds.y + refBounds.height + gap };
            case 'above-right':
                return { x: refBounds.x + refBounds.width + gap, y: refCenterY - newDefaults.height - gap / 2 };
            case 'below-right':
                return { x: refBounds.x + refBounds.width + gap, y: refCenterY + gap / 2 };
            case 'above-left':
                return { x: refBounds.x - newDefaults.width - gap, y: refCenterY - newDefaults.height - gap / 2 };
            case 'below-left':
                return { x: refBounds.x - newDefaults.width - gap, y: refCenterY + gap / 2 };
            case 'right':
            default:
                return { x: refBounds.x + refBounds.width + gap, y: refBounds.y };
        }
    }
    /**
     * Compute a smart default position when no --near or explicit x,y is given.
     * Priority chain:
     *   1. Active agent/terminal (source widget ID from request)
     *   2. User-selected widget (from .selectedwidgets.json, same canvas)
     *   3. Viewport center (from .selectedwidgets.json)
     *   4. Last widget on canvas
     *   5. Origin (0, 0) — empty canvas, no viewport
     *
     * @param {object[]} canvasWidgets — current widgets on the canvas
     * @param {string} type — widget type being created
     * @param {object} props — widget props
     * @param {string} projectRoot — project root directory
     * @param {string|null} canvasName — canvas ID for matching selectedwidgets context
     * @param {string|null} sourceWidgetId — caller's widget ID (agent/terminal creating this widget)
     */
    async function computeAutoPosition(canvasWidgets, type, props, projectRoot, canvasName, sourceWidgetId) {
        const layoutWidgets = (canvasWidgets || []).map(toLayoutWidget).filter((widget) => Boolean(widget));
        const widgetMap = new Map(layoutWidgets.map(w => [w.id, w]));
        // 1. Place near the source agent/terminal widget
        const sourceWidget = sourceWidgetId ? widgetMap.get(sourceWidgetId) : undefined;
        if (sourceWidget) {
            return computeNearPosition(sourceWidget, 'right', type, props);
        }
        // 2–3. Read .selectedwidgets.json for selection + viewport context
        try {
            const { readSelectedWidgets } = await import('./selectedWidgets.js');
            const sw = readSelectedWidgets(projectRoot);
            if (sw && sw.canvasId === canvasName) {
                // 2. Place near the selected widget
                if (sw.selectedWidgetIds?.length > 0) {
                    const selectedId = sw.selectedWidgetIds[0];
                    const selectedWidget = widgetMap.get(selectedId);
                    if (selectedWidget) {
                        return computeNearPosition(selectedWidget, 'right', type, props);
                    }
                }
                // 3. Place at viewport center
                const vp = sw.viewport;
                if (vp && vp.centerX != null && vp.centerY != null) {
                    return { x: Math.round(vp.centerX / 24) * 24, y: Math.round(vp.centerY / 24) * 24 };
                }
            }
        }
        catch { /* selectedWidgets bridge may not be initialized */ }
        // 4. Place near the last widget on the canvas
        if (canvasWidgets && canvasWidgets.length > 0) {
            const lastWidget = layoutWidgets[layoutWidgets.length - 1];
            if (lastWidget)
                return computeNearPosition(lastWidget, 'right', type, props);
        }
        // 5. Truly empty canvas, no viewport
        return { x: 0, y: 0 };
    }
    /**
     * Update terminal configs when connectors change.
     * Finds all terminal widgets in the canvas, computes their connected widget IDs
     * from the current connector list, and updates their config files.
     */
    async function updateTerminalConnectionsForCanvas(root, canvasName, canvasData, connectors) {
        try {
            const { updateTerminalConnections, initTerminalConfig } = await import('./terminal-config.js');
            initTerminalConfig(root);
            const branch = readOptionalGitValue(root, ['branch', '--show-current']) || 'unknown';
            const widgets = canvasData.widgets || [];
            const widgetMap = new Map(widgets.map(w => [w.id, w]));
            const terminalWidgets = widgets.filter((w) => w.type === 'terminal' || w.type === 'agent' || w.type === 'prompt' || w.type === 'agent-chat');
            for (const tw of terminalWidgets) {
                const connectedIds = new Set();
                for (const conn of connectors) {
                    let peerId = null;
                    if (conn.start?.widgetId === tw.id) {
                        peerId = conn.end?.widgetId;
                    }
                    if (conn.end?.widgetId === tw.id) {
                        peerId = conn.start?.widgetId;
                    }
                    if (peerId) {
                        connectedIds.add(peerId);
                    }
                }
                // Resolve full widget objects for connected widgets
                const connectedWidgets = [...connectedIds]
                    .map(id => widgetMap.get(id))
                    .filter((widget) => widget !== undefined && typeof widget.type === 'string')
                    .map(w => ({ id: w.id, type: w.type, ...(w.props === undefined ? {} : { props: w.props }), ...(w.position === undefined ? {} : { position: w.position }) }));
                updateTerminalConnections({
                    branch,
                    canvasId: canvasName,
                    widgetId: tw.id,
                    connectedWidgets,
                    widgetProps: tw.props || null,
                });
                if (tw.type !== 'agent-chat') {
                    const { refreshLiveCodingTarget } = await import('./live-terminal-coding-target.js');
                    await refreshLiveCodingTarget(root, tw.id);
                }
            }
        }
        catch (err) {
            devLog().logEvent('warn', 'Failed to update terminal connections', { error: errorMessage(err) });
        }
    }
    // Append an event to an existing canvas file.
    // Marks the file in the write guard so the data plugin's watcher handler
    // skips sending a duplicate HMR event (the server pushes its own via
    // pushCanvasUpdate after the write). Stamps a stable random `id` so
    // undo/redo markers can target events by id.
    //
    // Also runs the runaway-session hard ceiling: if the file grows past
    // SOFT_COMPACT_THRESHOLD after writing, kick off a one-shot compaction
    // to keep the JSONL → HMR → React pipeline responsive. The user's per-tab
    // undo stack will lose pre-compaction targets (post-compaction undo calls
    // return 404 which the client interprets as "clear the stack").
    function appendEvent(filePath, event) {
        if (typeof event.id !== 'string' || !event.id) {
            event.id = generateEventId();
        }
        markCanvasWrite(filePath);
        appendEventRaw(filePath, event);
        maybeCompactRunawayFile(filePath);
        // Unmark after enough time for the watcher to fire and be suppressed.
        // macOS FSEvents latency is typically 100-500ms; 1s covers edge cases.
        setTimeout(() => unmarkCanvasWrite(filePath), 1000);
        return typeof event.id === 'string' ? event.id : undefined;
    }
    /** Persist one creation and its placement effects without an intervening await. */
    function appendWidgetCreation(filePath, canvasId, requested, eligible, legacy) {
        const current = readCanvas(filePath);
        const placements = eligible ? planWidgetCreation(root, canvasId, current, requested) : null;
        if (!placements && legacy.resolve) {
            const layout = toLayoutWidget(requested);
            if (!layout)
                throw new Error('New widget is missing a valid type.');
            const gridSize = typeof current.gridSize === 'number' ? current.gridSize : 24;
            const resolved = resolvePosition({
                x: layout.position?.x ?? 0, y: layout.position?.y ?? 0, type: layout.type, props: layout.props ?? {},
                widgets: (current.widgets ?? []).map(toLayoutWidget).filter((peer) => Boolean(peer)),
                gridSize,
                gap: legacy.gap === null ? null : legacy.gap * gridSize,
                preferAxis: legacy.preferAxis,
            });
            requested = { ...requested, position: { x: resolved.x, y: resolved.y } };
        }
        const placementEvents = [];
        const eventIds = [];
        const timestamp = new Date().toISOString();
        const append = (event) => {
            const id = appendEvent(filePath, event);
            if (id)
                eventIds.push(id);
            return id;
        };
        if (placements) {
            for (const peer of current.widgets ?? []) {
                const position = placements.get(peer.id);
                if (!position || (position.x === peer.position?.x && position.y === peer.position?.y))
                    continue;
                const event = { event: 'widget_moved', timestamp, widgetId: peer.id, position, prevPosition: peer.position ?? { x: 0, y: 0 } };
                append(event);
                placementEvents.push(event);
            }
            const previousSources = current.sources ?? [];
            let changed = false;
            const sources = previousSources.map((source) => {
                if (!isRecord(source) || typeof source.export !== 'string')
                    return source;
                const position = placements.get(`jsx-${source.export}`);
                const previous = pointField(source.position);
                if (!position || (position.x === previous?.x && position.y === previous?.y))
                    return source;
                changed = true;
                return { ...source, position };
            });
            if (changed) {
                const event = { event: 'source_updated', timestamp, sources, prevSources: previousSources };
                append(event);
                placementEvents.push(event);
            }
        }
        const placedPosition = placements?.get(requested.id);
        const layout = toLayoutWidget(placedPosition
            ? { ...requested, position: { x: placedPosition.x, y: placedPosition.y } }
            : requested);
        if (!layout)
            throw new Error('New widget is missing a valid type.');
        const widget = stampBounds({ ...requested, position: pointField(layout.position) ?? { x: 0, y: 0 }, type: layout.type, props: layout.props ?? {} });
        const eventId = append({ event: 'widget_added', timestamp, widget });
        return { widget, eventId, eventIds, placementEvents };
    }
    /**
     * Prepare a terminal/agent widget: auto-assign displayName and pre-reserve identity.
     * Shared by POST /widget and batch create-widget.
     * @param {{ type: string, props: Object }} opts
     * @param {string} widgetId
     * @param {string} canvasName
     * @param {import('node:http').IncomingMessage} [req]
     */
    async function prepareTerminalWidget({ type, props, widgetId, canvasName, req }) {
        if (type !== 'terminal' && type !== 'agent' && type !== 'agent-chat')
            return;
        const workspaceId = await resolveActiveWorkspaceId();
        if (type === 'agent') {
            const agents = readAgentsConfig(root) || {};
            const defaultEntry = Object.entries(agents).find(([, config]) => isRecord(config) && config.default === true) || Object.entries(agents)[0];
            const agentId = typeof props.agentId === 'string' ? props.agentId : defaultEntry?.[0] || null;
            if (!agentId)
                throw new Error('No configured agent is available.');
            const runtime = await resolveAgentHostRuntime(root, agentId);
            const agentConfig = agents[agentId];
            if (!isRecord(agentConfig))
                throw new Error(`Agent ${agentId} configuration is invalid.`);
            rewriteAgentConfig(runtime, agentConfig);
            props.agentId = agentId;
            if (typeof agentConfig.startupCommand === 'string')
                props.startupCommand = agentConfig.startupCommand;
        }
        if (!props.prettyName) {
            try {
                const { generateFriendlyName } = await import('./terminal-registry.js');
                props.prettyName = generateFriendlyName();
            }
            catch { /* registry not initialized yet */ }
        }
        try {
            const { preReserveTerminalIdentity, initTerminalConfig, writeTerminalConfig } = await import('./terminal-config.js');
            initTerminalConfig(root);
            let branch = 'unknown';
            try {
                branch = readOptionalGitValue(root, ['branch', '--show-current']) || 'unknown';
            }
            catch { /* terminal identity can fall back to unknown */ }
            const serverUrl = `http://localhost:${req?.socket?.localPort || 1234}`;
            if (type === 'agent-chat') {
                // Agent-chat widgets never open a terminal WS, so nothing would later
                // promote a pre-reserved identity into the hash-named config. Write
                // the full config now so the widget has identity from creation.
                writeTerminalConfig({
                    branch,
                    canvasId: canvasName,
                    widgetId,
                    serverUrl,
                    ...(workspaceId === undefined ? {} : { workspaceId }),
                    widgetProps: props,
                    displayName: typeof props.alias === 'string' ? props.alias : typeof props.prettyName === 'string' ? props.prettyName : null,
                });
            }
            else {
                preReserveTerminalIdentity({
                    widgetId,
                    preDisplayName: typeof props.prettyName === 'string' ? props.prettyName : null,
                    canvasId: canvasName,
                    branch,
                    serverUrl,
                    ...(workspaceId === undefined ? {} : { workspaceId }),
                    widgetProps: props,
                });
            }
        }
        catch { /* best effort */ }
    }
    /**
     * Resolve which hot pool to use for a widget type + props.
     * Agent widgets use their agentId as pool ID; terminals use 'terminal'.
     */
    function resolvePoolId(type, props) {
        if (type === 'agent' && typeof props.agentId === 'string')
            return props.agentId;
        return 'terminal';
    }
    /**
     * Non-mutating probe of a hot pool — returns readiness without claiming
     * a slot. Use this when the canvas API just needs to tell the client
     * whether a hot session is available; the actual session claim happens
     * later in terminal-server when the WebSocket connects.
     * @param {Object|null} hotPool — HotPoolManager instance
     * @param {string} poolId — pool to peek at
     * @param {string} [mode] — 'auto' (default), 'hot', or 'cold'
     * @returns {{ ready: boolean }}
     */
    function peekPool(hotPool, poolId, mode) {
        if (!hotPool || mode === 'cold')
            return { ready: false };
        if (!hotPool.has(poolId))
            return { ready: false };
        return hotPool.peek(poolId);
    }
    /**
     * Push live canvas update to connected clients via Vite HMR.
     * Reads the full materialized state from disk and sends it as a custom
     * event so useCanvas can update in-place without a page refresh.
     */
    async function pushCanvasUpdate(canvasName, filePath, viteWs) {
        try {
            const data = readCanvasSnapshot(filePath);
            viteWs?.send({
                type: 'custom',
                event: 'storyboard:canvas-file-changed',
                data: { canvasId: canvasName, name: canvasName, metadata: data },
            });
            // Refresh terminal config files on every canvas change so agents
            // always see up-to-date connectedWidgets and widget props.
            await updateTerminalConnectionsForCanvas(root, canvasName, data, data.connectors || []);
        }
        catch { /* best effort — watcher will catch it eventually */ }
    }
    // Write a new JSONL file with a single creation event.
    // New files are detected naturally by Vite's watcher as an `add` event,
    // which correctly triggers a full reload to register new routes.
    function writeNewCanvas(filePath, event) {
        writeCanvasPage(root, filePath, serializeEvent(event) + '\n', { title: typeof event.title === 'string' ? event.title : path.basename(filePath, '.canvas.jsonl') });
    }
    async function spawnHeadlessAgent(options) {
        const key = terminalWidgetStartupKey(root, options.widgetId);
        return withTerminalStartup(key, async () => {
            const { initTerminalConfig, readTerminalConfigById } = await import('./terminal-config.js');
            initTerminalConfig(root);
            if (readTerminalConfigById(options.widgetId)?.deleted) {
                throw new Error('This agent widget has been removed.');
            }
            const agents = readAgentsConfig(root) || {};
            const configuredDefault = getPromptExecution();
            const targetAgentId = (typeof options.agentId === 'string' ? options.agentId : null)
                || (isRecord(configuredDefault) && typeof configuredDefault.default === 'string' ? configuredDefault.default : null)
                || Object.keys(agents).find((id) => isRecord(agents[id]) && agents[id].default === true)
                || Object.keys(agents)[0]
                || null;
            if (!targetAgentId)
                throw new Error('No configured agent is available.');
            const agentRuntime = await resolveAgentHostRuntime(root, targetAgentId);
            const agentConfig = asAgentConfig(rewriteAgentConfig(agentRuntime, agents[targetAgentId]));
            if (!agentConfig)
                throw new Error(`Agent ${targetAgentId} configuration is invalid.`);
            const workspaceId = (await resolveActiveWorkspaceId()) || null;
            const warmSession = options.warmPoolId && hotPool?.has(options.warmPoolId)
                ? hotPool.acquire(options.warmPoolId)
                : null;
            try {
                const result = await spawnHeadlessAgentUnlocked({
                    ...options,
                    agentId: targetAgentId,
                    agentConfig,
                    agentRuntime,
                    workspaceId,
                    warmSession,
                });
                if (warmSession && typeof options.warmPoolId === 'string')
                    hotPool?.consume(options.warmPoolId, warmSession.id);
                return result;
            }
            catch (error) {
                if (warmSession && typeof options.warmPoolId === 'string')
                    hotPool?.release(options.warmPoolId, warmSession.id);
                throw error;
            }
        });
    }
    async function spawnHeadlessAgentUnlocked({ canvasId, widgetId, prompt, autopilot = true, requestedBranch, agentId, agentConfig, agentRuntime, workspaceId, warmSession = null, statusMessage = 'Agent spawning...', }) {
        const { initTerminalConfig, updateAgentStatus, writeTerminalConfig, } = await import('./terminal-config.js');
        const { adoptRuntimeSession, disconnectSession, generateSessionId, getSessionByWidget, killSession, registerSession, } = await import('./terminal-registry.js');
        initTerminalConfig(root);
        const branch = requestedBranch || readOptionalGitValue(root, ['branch', '--show-current']) || 'unknown';
        const sessionId = generateSessionId(branch, canvasId, widgetId);
        const existing = getSessionByWidget(branch, canvasId, widgetId);
        if (existing && await terminalSessionExists(existing.sessionId).catch(() => false)) {
            throw new Error(`Agent session already active for widget ${widgetId}`);
        }
        const runtimeSessionId = warmSession?.runtimeSessionId || sessionId;
        const basePath = process.env.VITE_BASE_PATH || '/';
        const serverUrl = `http://localhost:${reqSocketPort || 1234}${basePath.startsWith('/') ? basePath : `/${basePath}`}`.replace(/\/$/, '');
        const envMap = {
            HYPERCANVAS_WIDGET_ID: widgetId,
            HYPERCANVAS_CANVAS_ID: canvasId,
            HYPERCANVAS_BRANCH: branch,
            HYPERCANVAS_SERVER_URL: serverUrl,
            HYPERCANVAS_PROJECT_ROOT: root,
            // Legacy aliases for agent templates installed before the rename.
            STORYBOARD_WIDGET_ID: widgetId,
            STORYBOARD_CANVAS_ID: canvasId,
            STORYBOARD_BRANCH: branch,
            STORYBOARD_SERVER_URL: serverUrl,
            STORYBOARD_PROJECT_ROOT: root,
            TERM_PROGRAM: 'hypercanvas',
            FORCE_COLOR: '3',
        };
        const envFile = path.join(resolveRuntimeDir(root), 'terminals', `${sessionId}.env`);
        fs.mkdirSync(path.dirname(envFile), { recursive: true });
        fs.writeFileSync(envFile, Object.entries(envMap).map(([key, value]) => `export ${key}=${quoteShellWord(value)}`).join('\n') + '\n');
        // Headless canvas agents also run in terminal PTYs. They cannot show a
        // picker, so ambiguous targets require a saved widget preference.
        const { prepareTerminalCodingLaunch } = await import('../cli/terminal-coding-target.js');
        const { appendTerminalAgentPrompt, isInteractiveTerminalAgent } = await import('./terminal-coding-target.js');
        const codingContext = await prepareTerminalCodingLaunch(root, widgetId, { assignment: prompt });
        const { startTerminalContext, stopTerminalContext } = await import('./live-terminal-coding-target.js');
        const codingRuntime = { ...agentRuntime, path: `${codingContext.binDirectory}${path.delimiter}${agentRuntime.path || agentRuntime.hostPath}` };
        let command;
        if (autopilot) {
            command = buildPromptCmd({ prompt: codingContext.prompt, envFile, agentId, agentRuntime: codingRuntime });
            const promptExecution = getPromptExecution();
            const fallbackAgent = isRecord(promptExecution) && typeof promptExecution.default === 'string' ? promptExecution.default : 'unknown';
            if (!command)
                throw new Error(`Agent "${agentId || fallbackAgent}" has no prompt command configured`);
        }
        else {
            const { localCodexCommand } = await import('./agent-session.js');
            const startup = agentId === 'codex'
                ? localCodexCommand(agentConfig.startupCommand, agentRuntime.executablePath, buildHostWorkloadEnv(codingRuntime))
                : agentConfig.startupCommand;
            command = `source ${quoteShellWord(envFile)} && ${reassertHostPath(codingRuntime, `exec ${appendTerminalAgentPrompt(startup, agentId, codingContext.prompt)}`)}`;
        }
        startTerminalContext(root, widgetId, { ...codingContext, interactive: !autopilot && isInteractiveTerminalAgent(agentConfig.startupCommand, agentId) });
        const shell = agentRuntime.shell;
        const shellFlag = shell.endsWith('/zsh') || shell.endsWith('/bash') ? '-lc' : '-c';
        let entry = null;
        let subscription = null;
        let pendingExit = null;
        let readinessTimer = null;
        let commandStarted = false;
        let resolveReadiness = () => { };
        let rejectReadiness = () => { };
        let readinessOutput = '';
        const readiness = new Promise((resolveReady, rejectReady) => {
            resolveReadiness = resolveReady;
            rejectReadiness = rejectReady;
        });
        const checkReadiness = () => {
            if (agentConfig?.readinessSignal && readinessOutput.includes(agentConfig.readinessSignal))
                resolveReadiness();
        };
        const handleExit = async (event) => {
            if (readinessTimer)
                clearTimeout(readinessTimer);
            resolveReadiness();
            if (headlessSubscriptions.get(widgetId) === subscription)
                headlessSubscriptions.delete(widgetId);
            subscription?.close();
            if (entry)
                disconnectSession(sessionId, entry.generation);
            const processStatus = isRecord(event) && isRecord(event.processStatus) ? event.processStatus : {};
            const exitCode = processStatus.exitCode;
            stopTerminalContext(root, widgetId, codingContext.launchId);
            updateAgentStatus({
                branch,
                canvasId,
                widgetId,
                status: exitCode === 0 ? 'done' : 'error',
                message: (typeof processStatus.message === 'string' ? processStatus.message : null) || (exitCode === 0 ? 'Agent finished' : 'Agent exited'),
                data: readinessOutput ? { output: readinessOutput.slice(-4000) } : null,
            });
        };
        try {
            await initPaseoTerminalRuntime(root);
            commandStarted = !warmSession;
            const createdUnknown = await createTerminalSession(sessionId, {
                runtimeSessionId,
                ...(workspaceId ? { workspaceId } : {}),
                program: shell,
                args: warmSession ? [] : [shellFlag, command],
                cwd: agentRuntime.cwd,
                env: buildHostWorkloadEnv(codingRuntime, envMap),
                cols: 80,
                rows: 24,
            });
            const registered = registerSession({ branch, canvasId, widgetId, prettyName: null, runtimeSessionId });
            entry = registered.entry;
            if (runtimeSessionId !== sessionId)
                adoptRuntimeSession(sessionId, runtimeSessionId);
            writeTerminalConfig({ branch, canvasId, widgetId, serverUrl, workspaceId, sessionId });
            updateAgentStatus({ branch, canvasId, widgetId, status: 'running', message: statusMessage });
            headlessSubscriptions.get(widgetId)?.close();
            const snapshot = await snapshotTerminalSession(sessionId);
            readinessOutput = warmSession ? '' : (snapshot.text || snapshot.screen || '');
            subscription = await subscribeTerminalSession(sessionId, {
                readOnly: true,
                afterSequence: snapshot.sequence || 0,
                onOutput: (event) => {
                    readinessOutput += Buffer.from(isRecord(event) ? outputBytes(event) : new Uint8Array()).toString('utf8');
                    checkReadiness();
                },
                onExit: (event) => {
                    if (!subscription)
                        pendingExit = event;
                    else
                        handleExit(event).catch(() => { });
                },
            });
            const created = isRecord(createdUnknown) ? createdUnknown : {};
            if (pendingExit || created.running === false) {
                await handleExit(pendingExit || { processStatus: created.processStatus });
                throw new Error('Agent process exited during startup');
            }
            else {
                headlessSubscriptions.set(widgetId, subscription);
            }
            if (warmSession) {
                await writeTerminalText(sessionId, command, { submit: true });
                commandStarted = true;
            }
            checkReadiness();
            readinessTimer = agentConfig?.readinessSignal
                ? setTimeout(() => rejectReadiness(new Error(`Agent readiness timed out waiting for ${JSON.stringify(agentConfig.readinessSignal)}`)), 60_000)
                : setTimeout(resolveReadiness, 1500);
            readinessTimer.unref?.();
            readiness.then(async () => {
                if (readinessTimer)
                    clearTimeout(readinessTimer);
                if (headlessSubscriptions.get(widgetId) !== subscription)
                    return;
                updateAgentStatus({ branch, canvasId, widgetId, status: 'ready', message: 'Agent ready' });
                if (!autopilot && agentConfig?.postStartup)
                    await writeTerminalText(sessionId, agentConfig.postStartup, { submit: true }).catch(() => { });
            }).catch((error) => {
                if (headlessSubscriptions.get(widgetId) !== subscription)
                    return;
                updateAgentStatus({ branch, canvasId, widgetId, status: 'error', message: errorMessage(error) });
            });
            return { branch, sessionId, runtimeSessionId, warm: Boolean(warmSession) };
        }
        catch (error) {
            stopTerminalContext(root, widgetId, codingContext.launchId);
            if (readinessTimer)
                clearTimeout(readinessTimer);
            subscription?.close();
            if (headlessSubscriptions.get(widgetId) === subscription)
                headlessSubscriptions.delete(widgetId);
            if (entry || commandStarted)
                await killSession(sessionId).catch(() => { });
            throw error;
        }
    }
    let reqSocketPort = null;
    return async (req, res, { body, path: routePath, method, __viteWs }) => {
        reqSocketPort = req?.socket?.localPort || reqSocketPort;
        // GET /folders — list available canvas folders
        if (routePath === '/folders' && method === 'GET') {
            const canvasDir = canvasContentRoot(root);
            let folders = [];
            let entries = [];
            try {
                if (fs.existsSync(canvasDir)) {
                    const dirEntries = fs.readdirSync(canvasDir, { withFileTypes: true });
                    // .folder directories — workspace grouping (sibling canvases shown
                    // under a folder header in the workspace, each addressable on its
                    // own /canvas/<folder>/<name> route).
                    const folderDirs = dirEntries
                        .filter((d) => d.isDirectory() && d.name.endsWith('.folder'))
                        .map((d) => d.name.replace('.folder', ''));
                    // Plain directories containing .canvas.jsonl files — multi-page
                    // canvas grouping (each .canvas.jsonl is a "page" of the parent
                    // group, surfaced via PageSelector inside the canvas).
                    const plainDirs = dirEntries
                        .filter((d) => {
                        if (!d.isDirectory() || d.name.endsWith('.folder') || d.name.startsWith('_'))
                            return false;
                        const files = fs.readdirSync(path.join(canvasDir, d.name));
                        return files.some((f) => f.endsWith('.canvas.jsonl'));
                    })
                        .map((d) => d.name);
                    folders = [...folderDirs, ...plainDirs];
                    entries = [
                        ...folderDirs.map((name) => ({ name, kind: 'workspace' })),
                        ...plainDirs.map((name) => ({ name, kind: 'pages' })),
                    ];
                }
            }
            catch { /* empty */ }
            // `folders` is the legacy flat name list; `entries` is the new tagged
            // list. Clients can prefer `entries` when they need to know whether a
            // folder is a `.folder/` (workspace) or plain (multi-page) dir.
            sendJson(res, 200, { folders, entries });
            return;
        }
        // GET /read?name=... — read materialized canvas data from disk
        if (routePath.startsWith('/read') && method === 'GET') {
            const url = new URL(routePath, 'http://localhost');
            const name = url.searchParams.get('name');
            if (!name) {
                sendJson(res, 400, { error: 'Canvas name is required (?name=...)' });
                return;
            }
            const filePath = findCanvasPath(root, name);
            if (!filePath) {
                sendJson(res, 404, { error: `Canvas "${name}" not found` });
                return;
            }
            try {
                const data = readCanvasSnapshot(filePath);
                const widgetFilter = url.searchParams.get('widget');
                if (widgetFilter) {
                    const widget = (data.widgets || []).find((w) => w.id === widgetFilter);
                    if (!widget) {
                        sendJson(res, 404, { error: `Widget "${widgetFilter}" not found in canvas "${name}"` });
                        return;
                    }
                    sendJson(res, 200, { ...data, widgets: [widget] });
                }
                else {
                    sendJson(res, 200, data);
                }
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to read canvas: ${errorMessage(err)}` });
            }
            return;
        }
        // GET /list — list all canvases
        if (routePath === '/list' && method === 'GET') {
            const files = findCanvasFiles(root);
            const canvases = files.map((file) => {
                const id = canvasIdForFile(file);
                if (!id)
                    return null;
                const { segments } = parseCanvasId(id);
                const group = segments.length > 1 ? segments.slice(0, -1).join('/') : null;
                try {
                    const filePath = path.resolve(root, file);
                    const data = readCanvas(filePath);
                    return {
                        name: id,
                        id: stableCanvasIdForFile(root, filePath),
                        title: typeof data.title === 'string' ? data.title : (segments.at(-1) || id),
                        path: file,
                        widgetCount: (data.widgets || []).length + (data.sources || []).length,
                        group,
                    };
                }
                catch {
                    return { name: id, id: stableCanvasIdForFile(root, path.resolve(root, file)), title: segments[segments.length - 1] || id, path: file, widgetCount: 0, group };
                }
            }).filter((canvas) => canvas !== null);
            const groups = findCanvasMeta(root);
            // Sort canvases within each group by saved pageOrder from .meta.json
            const groupOrderMaps = new Map();
            for (const [groupName, meta] of Object.entries(groups)) {
                if (isRecord(meta) && Array.isArray(meta.pageOrder)) {
                    const orderMap = new Map();
                    meta.pageOrder.forEach((entry, idx) => {
                        if (typeof entry === 'string' && !entry.startsWith('sep-'))
                            orderMap.set(entry, idx);
                    });
                    groupOrderMaps.set(groupName, orderMap);
                }
            }
            if (groupOrderMaps.size > 0) {
                canvases.sort((a, b) => {
                    if (a.group !== b.group)
                        return 0;
                    const orderMap = a.group ? groupOrderMaps.get(a.group) : null;
                    if (!orderMap)
                        return 0;
                    const ai = orderMap.has(a.name) ? orderMap.get(a.name) : Infinity;
                    const bi = orderMap.has(b.name) ? orderMap.get(b.name) : Infinity;
                    return (ai ?? Infinity) - (bi ?? Infinity);
                });
            }
            sendJson(res, 200, { canvases, groups });
            return;
        }
        // PUT /update — append update events to the canvas stream
        if (routePath === '/update' && method === 'PUT') {
            const name = stringField(body, 'name');
            const widgets = body.widgets === undefined ? undefined : canvasWidgetsField(body.widgets);
            const sources = body.sources;
            const settings = recordField(body, 'settings');
            const connectors = body.connectors;
            if (body.widgets !== undefined && widgets === null) {
                sendJson(res, 400, { error: 'widgets must be an array of canvas widgets' });
                return;
            }
            if (sources !== undefined && !Array.isArray(sources)) {
                sendJson(res, 400, { error: 'sources must be an array' });
                return;
            }
            if (connectors !== undefined && !Array.isArray(connectors)) {
                sendJson(res, 400, { error: 'connectors must be an array' });
                return;
            }
            if (body.settings !== undefined && settings === null) {
                sendJson(res, 400, { error: 'settings must be an object' });
                return;
            }
            if (!name) {
                sendJson(res, 400, { error: 'Canvas name is required' });
                return;
            }
            const filePath = findCanvasPath(root, name);
            if (!filePath) {
                sendJson(res, 404, { error: `Canvas "${name}" not found` });
                return;
            }
            try {
                const ts = new Date().toISOString();
                // Snapshot of pre-update state so we can stamp prev* payloads on
                // source_updated and settings_updated events without re-reading.
                const current = readCanvas(filePath);
                // Replacement events have no inverse; expose only undoable mutations.
                const eventIds = [];
                if (widgets) {
                    // Guard against accidental canvas wipes. Any widget IDs present in
                    // current but missing from the incoming array are deletions; we
                    // refuse those unless the caller explicitly opts in via replaceAll.
                    // This protects against stale-state writers (e.g. a debounced client
                    // save fired before an HMR push containing newly-added widgets was
                    // reconciled) silently wiping freshly-created widgets.
                    const currentWidgets = current.widgets || [];
                    if (body.replaceAll !== true) {
                        const incomingIds = new Set(widgets.map((w) => w.id));
                        const missing = currentWidgets.filter((w) => !incomingIds.has(w.id));
                        if (missing.length > 0) {
                            sendJson(res, 400, {
                                error: `Refusing to drop ${missing.length} widget(s) on PUT /update. `
                                    + `Missing IDs: ${missing.map((w) => w.id).slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''}. `
                                    + `Use DELETE /_hypercanvas/canvas/widget to remove widgets, PATCH to update them, `
                                    + `or pass "replaceAll": true to confirm full replacement.`,
                                missingIds: missing.map((w) => w.id),
                            });
                            return;
                        }
                    }
                    const stamped = stampCanvasWidgets(widgets);
                    assertCanvasWritable(filePath);
                    const retainedTypes = new Map(stamped.map(widget => [widget.id, widget.type]));
                    for (const widget of currentWidgets) {
                        if (retainedTypes.get(widget.id) !== widget.type)
                            await closeWidgetSession(root, name, widget);
                    }
                    // widgets_replaced is not undoable — emitted only by compaction or
                    // explicit replaceAll. The client should use PATCH/POST/DELETE for
                    // granular, undoable changes.
                    appendEvent(filePath, { event: 'widgets_replaced', timestamp: ts, widgets: stamped });
                    const previousTypes = new Map(currentWidgets.map(widget => [widget.id, widget.type]));
                    for (const widget of stamped) {
                        if (previousTypes.get(widget.id) !== widget.type)
                            restoreWidgetSession(root, name, widget);
                    }
                }
                if (sources) {
                    const eventId = appendEvent(filePath, {
                        event: 'source_updated',
                        timestamp: ts,
                        sources,
                        prevSources: Array.isArray(current.sources) ? current.sources : [],
                    });
                    if (eventId)
                        eventIds.push(eventId);
                }
                if (connectors) {
                    // connectors_replaced is not undoable — emitted only by compaction.
                    appendEvent(filePath, { event: 'connectors_replaced', timestamp: ts, connectors });
                }
                if (settings) {
                    const filtered = {};
                    for (const [key, value] of Object.entries(settings)) {
                        if (['title', 'description', 'grid', 'gridSize', 'colorMode', 'dotted', 'centered', 'author', 'autoPlace', 'snapToGrid', 'connectorStyle', 'layout', 'className'].includes(key)) {
                            filtered[key] = value;
                        }
                    }
                    if (Object.keys(filtered).length > 0) {
                        // Capture prior values for the keys being changed.
                        const prevSettings = {};
                        for (const key of Object.keys(filtered)) {
                            prevSettings[key] = current[key];
                        }
                        const eventId = appendEvent(filePath, {
                            event: 'settings_updated',
                            timestamp: ts,
                            settings: filtered,
                            prevSettings,
                        });
                        if (eventId)
                            eventIds.push(eventId);
                    }
                }
                await pushCanvasUpdate(name, filePath, __viteWs);
                sendJson(res, 200, { success: true, name, eventIds });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to update canvas: ${errorMessage(err)}` });
            }
            return;
        }
        // POST /undo — append the inverse of a previously-applied event, tagged
        // with meta.kind = 'undo' / meta.of = <targetEventId>. Body:
        //   { name, eventId }
        // Returns { success, eventId, inverseEvent: {...} }.
        //
        // POST /redo behaves identically but stamps meta.kind = 'redo'. Per
        // convention the client passes the id of the *undo* event when redoing
        // (so the redo cancels the undo and brings back the original change).
        if ((routePath === '/undo' || routePath === '/redo') && method === 'POST') {
            const name = stringField(body, 'name');
            const eventId = stringField(body, 'eventId');
            const kind = routePath === '/undo' ? 'undo' : 'redo';
            if (!name || !eventId) {
                sendJson(res, 400, { error: 'Canvas name and eventId are required' });
                return;
            }
            const filePath = findCanvasPath(root, name);
            if (!filePath) {
                sendJson(res, 404, { error: `Canvas "${name}" not found` });
                return;
            }
            try {
                const rawAtStart = fs.readFileSync(filePath);
                const text = rawAtStart.toString('utf-8');
                const events = parseCanvasJsonl(text);
                const target = events.find((evt) => isRecord(evt) && evt.id === eventId);
                if (!target) {
                    sendJson(res, 404, { error: `Event "${eventId}" not found in canvas "${name}"` });
                    return;
                }
                let inverse = buildInverseEvent(target, kind);
                const isLayoutForward = target.event === 'canvas_layout_updated';
                const isLayoutRestoration = target.event === 'canvas_layout_restored';
                if (isLayoutForward && kind !== 'undo') {
                    sendJson(res, 400, { error: 'A canvas layout update can only be undone' });
                    return;
                }
                if (isLayoutForward || isLayoutRestoration) {
                    const current = materializeFromText(rawAtStart.toString('utf-8'));
                    if (isLayoutForward) {
                        const targetIndex = events.findIndex((evt) => isRecord(evt) && evt.id === eventId);
                        const preState = materialize(events.slice(0, targetIndex));
                        inverse = captureCanvasLayoutRestoration(preState, target);
                    }
                    else {
                        inverse = reverseCanvasLayoutRestoration(target);
                    }
                    if (!inverse)
                        throw new Error('Could not construct canvas layout restoration');
                    inverse.id = generateEventId();
                    inverse.timestamp = new Date().toISOString();
                    inverse.meta = { kind, of: eventId };
                    const restored = applyEvent(current, inverse);
                    if (restored === current) {
                        const error = new Error(`Canvas layout ${kind} conflict; canvas was not changed`);
                        error.status = 409;
                        throw error;
                    }
                    const rawText = rawAtStart.toString('utf-8');
                    const nextText = `${rawText}${rawText && !rawText.endsWith('\n') ? '\n' : ''}${serializeEvent(inverse)}\n`;
                    const revision = replaceCanvasDocument(filePath, canvasDocumentRevision(rawAtStart), nextText);
                    await pushCanvasUpdate(name, filePath, __viteWs);
                    sendJson(res, 200, { success: true, eventId: inverse.id, documentRevision: revision, inverseEvent: inverse });
                    return;
                }
                if (!inverse) {
                    sendJson(res, 400, {
                        error: `Event "${eventId}" (type "${target.event}") cannot be ${kind === 'undo' ? 'undone' : 'redone'}: missing inverse payload or unsupported event type`,
                    });
                    return;
                }
                assertCanvasWritable(filePath);
                if (inverse.event === 'widget_removed' && typeof inverse.widgetId === 'string') {
                    const widget = readCanvas(filePath).widgets?.find(entry => entry.id === inverse.widgetId);
                    if (widget)
                        await closeWidgetSession(root, name, widget);
                }
                inverse.timestamp = new Date().toISOString();
                const inverseId = appendEvent(filePath, inverse);
                if (inverse.event === 'widget_added' && isCanvasWidget(inverse.widget)) {
                    restoreWidgetSession(root, name, inverse.widget);
                }
                await pushCanvasUpdate(name, filePath, __viteWs);
                sendJson(res, 200, {
                    success: true,
                    eventId: inverseId,
                    inverseEvent: { ...inverse, id: inverseId },
                });
            }
            catch (err) {
                const message = errorMessage(err);
                const status = typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number'
                    ? err.status
                    : message.includes('canvas_layout_restored') ? 409 : 500;
                sendJson(res, status, { error: `Failed to ${kind} event: ${message}` });
            }
            return;
        }
        // POST /widget — append a widget_added event
        if (routePath === '/widget' && method === 'POST') {
            const name = stringField(body, 'name');
            const type = stringField(body, 'type');
            const props = recordField(body, 'props') || {};
            const pool = stringField(body, 'pool');
            const near = stringField(body, 'near');
            const direction = stringField(body, 'direction') || 'right';
            const resolve = body.resolve === true;
            const source = stringField(body, 'source');
            const gap = typeof body.gap === 'number' && Number.isFinite(body.gap) ? body.gap : undefined;
            const positionInput = body.position === undefined ? { x: 0, y: 0 } : pointField(body.position);
            if (!positionInput) {
                sendJson(res, 400, { error: 'position must contain finite x and y coordinates' });
                return;
            }
            let position = positionInput;
            // Detect whether the caller provided an explicit position.
            // `near === false` is the explicit opt-out ("put it exactly here").
            const hasExplicitPosition = body.position !== undefined && (position.x !== 0 || position.y !== 0);
            const hasNearOptOut = body.near === false;
            const needsAutoPosition = !near && !hasExplicitPosition && !hasNearOptOut;
            if (!name) {
                sendJson(res, 400, { error: 'Canvas name is required' });
                return;
            }
            if (!type) {
                sendJson(res, 400, { error: 'Widget type is required' });
                return;
            }
            const filePath = findCanvasPath(root, name);
            if (!filePath) {
                sendJson(res, 404, { error: `Canvas "${name}" not found` });
                return;
            }
            try {
                // Always read canvas when we need near, resolve, or auto-positioning
                const needsCanvasRead = near || resolve || needsAutoPosition;
                let canvasWidgets = [];
                let canvasData = null;
                if (needsCanvasRead) {
                    canvasData = readCanvas(filePath);
                    canvasWidgets = canvasData.widgets || [];
                }
                if (near) {
                    const refWidget = canvasWidgets.find((w) => w.id === near);
                    if (!refWidget) {
                        sendJson(res, 400, { error: `Widget "${near}" not found (--near)` });
                        return;
                    }
                    const layoutRef = toLayoutWidget(refWidget);
                    if (!layoutRef)
                        throw new Error('Reference widget is missing a valid type.');
                    const gridSize = typeof canvasData?.gridSize === 'number' ? canvasData.gridSize : 24;
                    position = computeNearPosition(layoutRef, direction, type, props, gap, gridSize);
                }
                // Auto-position: no --near, no explicit x,y → smart default
                if (needsAutoPosition && !near) {
                    position = await computeAutoPosition(canvasWidgets, type, props, root, name, source);
                }
                const widgetId = generateWidgetId(type);
                await prepareTerminalWidget({ type, props, widgetId, canvasName: name, req });
                // Hot pool readiness probe for terminal/agent widgets — non-mutating.
                // The actual session claim happens later in terminal-server when the
                // WS connects. Probing here only tells the client whether a hot
                // session is available. (Previously this called acquireFromPool,
                // which leaked a #acquired slot per widget creation because no
                // consume/release ever fired against this acquisition.)
                let hotProbe = { ready: false };
                if ((type === 'terminal' || type === 'agent') && pool !== 'cold') {
                    const poolId = resolvePoolId(type, props);
                    hotProbe = peekPool(hotPool, poolId, pool || undefined);
                    if (!hotProbe.ready && pool === 'hot') {
                        sendJson(res, 409, { error: `No warm sessions available in pool "${poolId}"` });
                        return;
                    }
                }
                // Explicit coordinates and directional --near contracts remain exact
                // unless the caller opted into resolution. UI-computed positions use
                // resolve:true so enabled Auto place can treat them as placement hints.
                const eligible = !near && (resolve || (!hasExplicitPosition && !hasNearOptOut));
                const creation = appendWidgetCreation(filePath, name, { id: widgetId, type, position, props }, eligible, {
                    resolve: Boolean(near || resolve || needsAutoPosition),
                    gap: near && typeof gap === 'number' ? gap : null,
                    preferAxis: near ? directionPreferAxis(direction) : 'horizontal',
                });
                const response = { success: true, ...creation };
                if (hotProbe.ready)
                    response.hotSession = { id: null, runtimeSessionId: null };
                await pushCanvasUpdate(name, filePath, __viteWs);
                sendJson(res, 201, response);
            }
            catch (err) {
                const code = isRecord(err) && typeof err.code === 'string' ? err.code : null;
                sendJson(res, 500, { error: `Failed to add widget: ${errorMessage(err)}`, code });
            }
            return;
        }
        // DELETE /widget — append a widget_removed event
        if (routePath === '/widget' && method === 'DELETE') {
            const name = stringField(body, 'name');
            const widgetId = stringField(body, 'widgetId');
            if (!name || !widgetId) {
                sendJson(res, 400, { error: 'Canvas name and widgetId are required' });
                return;
            }
            const filePath = findCanvasPath(root, name);
            if (!filePath) {
                sendJson(res, 404, { error: `Canvas "${name}" not found` });
                return;
            }
            try {
                // Verify the widget exists before appending the removal event
                const data = readCanvas(filePath);
                const widget = (data.widgets || []).find((w) => w.id === widgetId);
                if (!widget) {
                    sendJson(res, 404, { error: `Widget "${widgetId}" not found in canvas "${name}"` });
                    return;
                }
                assertCanvasWritable(filePath);
                await closeWidgetSession(root, name, widget);
                // Keep the existing per-connector undo history, but only mutate it
                // after the session has actually closed.
                const eventIds = [];
                for (const connector of data.connectors || []) {
                    if (connector.start?.widgetId !== widgetId && connector.end?.widgetId !== widgetId)
                        continue;
                    const connectorEventId = appendEvent(filePath, {
                        event: 'connector_removed', timestamp: new Date().toISOString(), connectorId: connector.id, connector,
                    });
                    if (connectorEventId)
                        eventIds.push(connectorEventId);
                }
                const eventId = appendEvent(filePath, {
                    event: 'widget_removed',
                    timestamp: new Date().toISOString(),
                    widgetId,
                    // Carry the full removed widget so undo can re-add it without
                    // walking history. Symmetric to widget_added.widget.
                    widget,
                });
                await pushCanvasUpdate(name, filePath, __viteWs);
                if (eventId)
                    eventIds.push(eventId);
                sendJson(res, 200, { success: true, removed: 1, eventId, eventIds });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to remove widget: ${errorMessage(err)}` });
            }
            return;
        }
        // PATCH /widget — update a single widget's props
        if (routePath === '/widget' && method === 'PATCH') {
            const name = stringField(body, 'name');
            const widgetId = stringField(body, 'widgetId');
            const props = body.props === undefined ? undefined : recordField(body, 'props');
            const position = body.position === undefined ? undefined : recordField(body, 'position');
            if ((body.props !== undefined && props === null) || (body.position !== undefined && position === null)) {
                sendJson(res, 400, { error: 'props and position must be objects' });
                return;
            }
            if (!name || !widgetId) {
                sendJson(res, 400, { error: 'Canvas name and widgetId are required' });
                return;
            }
            if (!props && !position) {
                sendJson(res, 400, { error: 'At least one of props or position is required' });
                return;
            }
            const filePath = findCanvasPath(root, name);
            if (!filePath) {
                sendJson(res, 404, { error: `Canvas "${name}" not found` });
                return;
            }
            try {
                const data = readCanvas(filePath);
                const widget = (data.widgets || []).find((w) => w.id === widgetId);
                if (!widget) {
                    sendJson(res, 404, { error: `Widget "${widgetId}" not found in canvas "${name}"` });
                    return;
                }
                const ts = new Date().toISOString();
                const eventIds = [];
                if (props) {
                    // Capture only the keys being changed so undo restores them
                    // precisely. Missing keys mean "this prop didn't exist before".
                    const prevProps = {};
                    for (const key of Object.keys(props)) {
                        prevProps[key] = widget.props ? widget.props[key] : undefined;
                    }
                    eventIds.push(appendEvent(filePath, {
                        event: 'widget_updated',
                        timestamp: ts,
                        widgetId,
                        props,
                        prevProps,
                    }));
                }
                if (position) {
                    // Merge with existing position so partial updates (only --x or --y) are safe
                    const mergedPosition = { ...widget.position, ...position };
                    eventIds.push(appendEvent(filePath, {
                        event: 'widget_moved',
                        timestamp: ts,
                        widgetId,
                        position: mergedPosition,
                        prevPosition: widget.position || { x: 0, y: 0 },
                    }));
                }
                // Return the merged widget for convenience
                const merged = {
                    ...widget,
                    props: { ...widget.props, ...(props || {}) },
                    position: position ? { ...widget.position, ...position } : widget.position,
                };
                await pushCanvasUpdate(name, filePath, __viteWs);
                sendJson(res, 200, { success: true, widget: merged, eventIds });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to update widget: ${errorMessage(err)}` });
            }
            return;
        }
        // GET /alias — read alias for a widget
        if (routePath === '/alias' && method === 'GET') {
            const url = new URL(req?.url || '/', 'http://localhost');
            const name = url.searchParams.get('canvas');
            const widgetId = url.searchParams.get('widgetId');
            if (!name || !widgetId) {
                sendJson(res, 400, { error: 'canvas and widgetId query params are required' });
                return;
            }
            const filePath = findCanvasPath(root, name);
            if (!filePath) {
                sendJson(res, 404, { error: `Canvas "${name}" not found` });
                return;
            }
            try {
                const data = readCanvas(filePath);
                const widget = (data.widgets || []).find(w => w.id === widgetId);
                if (!widget) {
                    sendJson(res, 404, { error: `Widget "${widgetId}" not found` });
                    return;
                }
                sendJson(res, 200, { widgetId, alias: widget.props?.alias || null, prettyName: widget.props?.prettyName || null });
            }
            catch (err) {
                sendJson(res, 500, { error: errorMessage(err) });
            }
            return;
        }
        // PUT /alias — set alias for a widget
        if (routePath === '/alias' && method === 'PUT') {
            const name = stringField(body, 'canvas');
            const widgetId = stringField(body, 'widgetId');
            const alias = stringField(body, 'alias');
            if (!name || !widgetId || !alias) {
                sendJson(res, 400, { error: 'canvas, widgetId, and alias are required' });
                return;
            }
            const filePath = findCanvasPath(root, name);
            if (!filePath) {
                sendJson(res, 404, { error: `Canvas "${name}" not found` });
                return;
            }
            try {
                const data = readCanvas(filePath);
                const widget = (data.widgets || []).find(w => w.id === widgetId);
                if (!widget) {
                    sendJson(res, 404, { error: `Widget "${widgetId}" not found` });
                    return;
                }
                // Persist the alias and refresh terminal widget context.
                appendEventRaw(filePath, {
                    event: 'widget_updated',
                    timestamp: new Date().toISOString(),
                    widgetId,
                    props: { alias },
                });
                await pushCanvasUpdate(name, filePath, __viteWs);
                sendJson(res, 200, { success: true, widgetId, alias });
            }
            catch (err) {
                sendJson(res, 500, { error: errorMessage(err) });
            }
            return;
        }
        // DELETE /alias — clear alias for a widget
        if (routePath === '/alias' && method === 'DELETE') {
            const name = stringField(body, 'canvas');
            const widgetId = stringField(body, 'widgetId');
            if (!name || !widgetId) {
                sendJson(res, 400, { error: 'canvas and widgetId are required' });
                return;
            }
            const filePath = findCanvasPath(root, name);
            if (!filePath) {
                sendJson(res, 404, { error: `Canvas "${name}" not found` });
                return;
            }
            try {
                const data = readCanvas(filePath);
                const widget = (data.widgets || []).find(w => w.id === widgetId);
                if (!widget) {
                    sendJson(res, 404, { error: `Widget "${widgetId}" not found` });
                    return;
                }
                appendEventRaw(filePath, {
                    event: 'widget_updated',
                    timestamp: new Date().toISOString(),
                    widgetId,
                    props: { alias: '' },
                });
                await pushCanvasUpdate(name, filePath, __viteWs);
                sendJson(res, 200, { success: true, widgetId, alias: null });
            }
            catch (err) {
                sendJson(res, 500, { error: errorMessage(err) });
            }
            return;
        }
        // POST /connector — append a connector_added event
        if (routePath === '/connector' && method === 'POST') {
            const name = stringField(body, 'name');
            const startWidgetId = stringField(body, 'startWidgetId');
            const endWidgetId = stringField(body, 'endWidgetId');
            let startAnchor = stringField(body, 'startAnchor');
            let endAnchor = stringField(body, 'endAnchor');
            const connectorType = typeof body.connectorType === 'string' ? body.connectorType : 'default';
            const meta = recordField(body, 'meta');
            const className = stringField(body, 'className');
            const style = recordField(body, 'style');
            const startEndpoint = stringField(body, 'startEndpoint');
            const endEndpoint = stringField(body, 'endEndpoint');
            const customData = recordField(body, 'data');
            if (!name) {
                sendJson(res, 400, { error: 'Canvas name is required' });
                return;
            }
            if (!startWidgetId || !endWidgetId) {
                sendJson(res, 400, { error: 'startWidgetId and endWidgetId are required' });
                return;
            }
            if (startWidgetId === endWidgetId) {
                sendJson(res, 400, { error: 'Cannot connect a widget to itself' });
                return;
            }
            const filePath = findCanvasPath(root, name);
            if (!filePath) {
                sendJson(res, 404, { error: `Canvas "${name}" not found` });
                return;
            }
            try {
                const data = readCanvas(filePath);
                const widgets = data.widgets || [];
                const widgetMap = new Map(widgets.map((w) => [w.id, w]));
                if (!widgetMap.has(startWidgetId)) {
                    sendJson(res, 404, { error: `Widget "${startWidgetId}" not found` });
                    return;
                }
                if (!widgetMap.has(endWidgetId)) {
                    sendJson(res, 404, { error: `Widget "${endWidgetId}" not found` });
                    return;
                }
                // Auto-calculate optimal anchors if not provided
                const validAnchors = ['top', 'bottom', 'left', 'right'];
                if (!startAnchor || !endAnchor) {
                    const startWidget = toLayoutWidget(widgetMap.get(startWidgetId));
                    const endWidget = toLayoutWidget(widgetMap.get(endWidgetId));
                    if (!startWidget || !endWidget)
                        throw new Error('Connector widgets have invalid types.');
                    const computed = findBestAnchors(startWidget, endWidget);
                    if (!startAnchor)
                        startAnchor = computed.startAnchor;
                    if (!endAnchor)
                        endAnchor = computed.endAnchor;
                }
                // Validate anchors (if explicitly provided)
                if (!validAnchors.includes(startAnchor) || !validAnchors.includes(endAnchor)) {
                    sendJson(res, 400, { error: `Anchors must be one of: ${validAnchors.join(', ')}` });
                    return;
                }
                const validEndpoints = ['circle', 'arrow-start', 'arrow-end', 'none'];
                if (startEndpoint != null && (typeof startEndpoint !== 'string' || !validEndpoints.includes(startEndpoint))) {
                    sendJson(res, 400, { error: `startEndpoint must be one of: ${validEndpoints.join(', ')}` });
                    return;
                }
                if (endEndpoint != null && (typeof endEndpoint !== 'string' || !validEndpoints.includes(endEndpoint))) {
                    sendJson(res, 400, { error: `endEndpoint must be one of: ${validEndpoints.join(', ')}` });
                    return;
                }
                const connectorId = generateWidgetId('connector');
                const connector = {
                    id: connectorId,
                    type: 'connector',
                    connectorType,
                    start: { widgetId: startWidgetId, anchor: startAnchor },
                    end: { widgetId: endWidgetId, anchor: endAnchor },
                    meta: meta ? { ...meta } : {},
                };
                // Optional presentational fields — only stamped when explicitly provided
                // so legacy connectors stay byte-identical.
                if (typeof className === 'string' && className)
                    connector.className = className;
                if (style && typeof style === 'object')
                    connector.style = { ...style };
                if (customData)
                    connector.data = { ...customData };
                if (startEndpoint)
                    connector.startEndpoint = startEndpoint;
                if (endEndpoint)
                    connector.endEndpoint = endEndpoint;
                const eventId = appendEvent(filePath, {
                    event: 'connector_added',
                    timestamp: new Date().toISOString(),
                    connector,
                });
                await pushCanvasUpdate(name, filePath, __viteWs);
                sendJson(res, 201, { success: true, connector, eventId });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to add connector: ${errorMessage(err)}` });
            }
            return;
        }
        // PATCH /connector — update connector anchors, meta, or presentational fields
        if (routePath === '/connector' && method === 'PATCH') {
            const name = stringField(body, 'name');
            const connectorId = stringField(body, 'connectorId');
            const meta = recordField(body, 'meta');
            const startAnchor = stringField(body, 'startAnchor');
            const endAnchor = stringField(body, 'endAnchor');
            const className = body.className;
            const style = body.style;
            const startEndpoint = body.startEndpoint;
            const endEndpoint = body.endEndpoint;
            const customData = Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : undefined;
            if (!name || !connectorId) {
                sendJson(res, 400, { error: 'Canvas name and connectorId are required' });
                return;
            }
            const filePath = findCanvasPath(root, name);
            if (!filePath) {
                sendJson(res, 404, { error: `Canvas "${name}" not found` });
                return;
            }
            try {
                const data = readCanvas(filePath);
                const connector = (data.connectors || []).find((c) => c.id === connectorId);
                if (!connector) {
                    sendJson(res, 404, { error: `Connector "${connectorId}" not found in canvas "${name}"` });
                    return;
                }
                const validAnchors = ['top', 'right', 'bottom', 'left'];
                if (startAnchor && !validAnchors.includes(startAnchor)) {
                    sendJson(res, 400, { error: `Invalid startAnchor "${startAnchor}". Must be one of: ${validAnchors.join(', ')}` });
                    return;
                }
                if (endAnchor && !validAnchors.includes(endAnchor)) {
                    sendJson(res, 400, { error: `Invalid endAnchor "${endAnchor}". Must be one of: ${validAnchors.join(', ')}` });
                    return;
                }
                const validEndpoints = ['circle', 'arrow-start', 'arrow-end', 'none'];
                if (startEndpoint != null && (typeof startEndpoint !== 'string' || !validEndpoints.includes(startEndpoint))) {
                    sendJson(res, 400, { error: `startEndpoint must be one of: ${validEndpoints.join(', ')}` });
                    return;
                }
                if (endEndpoint != null && (typeof endEndpoint !== 'string' || !validEndpoints.includes(endEndpoint))) {
                    sendJson(res, 400, { error: `endEndpoint must be one of: ${validEndpoints.join(', ')}` });
                    return;
                }
                const updates = {};
                if (meta)
                    updates.meta = { ...meta };
                if (startAnchor)
                    updates.startAnchor = startAnchor;
                if (endAnchor)
                    updates.endAnchor = endAnchor;
                // Presentational fields: explicit `null` clears, an object merges,
                // anything else is ignored. Mirrors the materializer's handling.
                if (className !== undefined)
                    updates.className = className;
                if (style !== undefined)
                    updates.style = style;
                if (customData !== undefined)
                    updates.data = customData;
                if (startEndpoint !== undefined)
                    updates.startEndpoint = startEndpoint;
                if (endEndpoint !== undefined)
                    updates.endEndpoint = endEndpoint;
                // Capture the previous values for the keys we're changing so undo
                // can restore them precisely.
                const prevUpdates = {};
                if (meta) {
                    const prevMeta = {};
                    for (const key of Object.keys(meta)) {
                        prevMeta[key] = connector.meta ? connector.meta[key] : undefined;
                    }
                    prevUpdates.meta = prevMeta;
                }
                if (startAnchor)
                    prevUpdates.startAnchor = connector.start?.anchor;
                if (endAnchor)
                    prevUpdates.endAnchor = connector.end?.anchor;
                if (className !== undefined)
                    prevUpdates.className = connector.className ?? null;
                if (style !== undefined) {
                    // Track only the keys being changed so undo restores exact prior values
                    if (style && typeof style === 'object') {
                        const prevStyle = {};
                        for (const key of Object.keys(style)) {
                            prevStyle[key] = connector.style ? connector.style[key] : undefined;
                        }
                        prevUpdates.style = prevStyle;
                    }
                    else {
                        prevUpdates.style = connector.style ?? null;
                    }
                }
                if (customData !== undefined) {
                    if (customData && typeof customData === 'object') {
                        const prevData = {};
                        for (const key of Object.keys(customData)) {
                            prevData[key] = connector.data ? connector.data[key] : undefined;
                        }
                        prevUpdates.data = prevData;
                    }
                    else {
                        prevUpdates.data = connector.data ?? null;
                    }
                }
                if (startEndpoint !== undefined)
                    prevUpdates.startEndpoint = connector.startEndpoint ?? null;
                if (endEndpoint !== undefined)
                    prevUpdates.endEndpoint = connector.endEndpoint ?? null;
                const eventId = appendEvent(filePath, {
                    event: 'connector_updated',
                    timestamp: new Date().toISOString(),
                    connectorId,
                    updates,
                    prevUpdates,
                });
                await pushCanvasUpdate(name, filePath, __viteWs);
                sendJson(res, 200, { success: true, eventId });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to update connector: ${errorMessage(err)}` });
            }
            return;
        }
        // POST /connector/waypoints — set/replace manual routing waypoints on a connector
        if (routePath === '/connector/waypoints' && method === 'POST') {
            const name = stringField(body, 'name');
            const connectorId = stringField(body, 'connectorId');
            const waypoints = waypointsField(body.waypoints);
            if (!name || !connectorId) {
                sendJson(res, 400, { error: 'Canvas name and connectorId are required' });
                return;
            }
            if (!waypoints) {
                sendJson(res, 400, { error: 'waypoints must be an array of { dx, dy, tHint? } objects' });
                return;
            }
            const filePath = findCanvasPath(root, name);
            if (!filePath) {
                sendJson(res, 404, { error: `Canvas "${name}" not found` });
                return;
            }
            try {
                const data = readCanvas(filePath);
                const existing = (data.connectors || []).find((c) => c.id === connectorId);
                if (!existing) {
                    sendJson(res, 404, { error: `Connector "${connectorId}" not found in canvas "${name}"` });
                    return;
                }
                // Normalize waypoints — keep only known fields
                const normalized = waypoints;
                const eventId = appendEvent(filePath, {
                    event: 'connector_waypoints_set',
                    timestamp: new Date().toISOString(),
                    connectorId,
                    waypoints: normalized,
                    // null prevWaypoints means "this connector had no manual routing
                    // before"; undo emits connector_waypoints_cleared in that case.
                    prevWaypoints: Array.isArray(existing.waypoints) ? existing.waypoints : null,
                });
                await pushCanvasUpdate(name, filePath, __viteWs);
                sendJson(res, 200, { success: true, waypoints: normalized, eventId });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to set waypoints: ${errorMessage(err)}` });
            }
            return;
        }
        // DELETE /connector/waypoints — clear manual routing, revert to auto-routing
        if (routePath === '/connector/waypoints' && method === 'DELETE') {
            const name = stringField(body, 'name');
            const connectorId = stringField(body, 'connectorId');
            if (!name || !connectorId) {
                sendJson(res, 400, { error: 'Canvas name and connectorId are required' });
                return;
            }
            const filePath = findCanvasPath(root, name);
            if (!filePath) {
                sendJson(res, 404, { error: `Canvas "${name}" not found` });
                return;
            }
            try {
                const data = readCanvas(filePath);
                const existing = (data.connectors || []).find((c) => c.id === connectorId);
                if (!existing) {
                    sendJson(res, 404, { error: `Connector "${connectorId}" not found in canvas "${name}"` });
                    return;
                }
                const eventId = appendEvent(filePath, {
                    event: 'connector_waypoints_cleared',
                    timestamp: new Date().toISOString(),
                    connectorId,
                    prevWaypoints: Array.isArray(existing.waypoints) ? existing.waypoints : null,
                });
                await pushCanvasUpdate(name, filePath, __viteWs);
                sendJson(res, 200, { success: true, eventId });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to clear waypoints: ${errorMessage(err)}` });
            }
            return;
        }
        // DELETE /connector — append a connector_removed event
        if (routePath === '/connector' && method === 'DELETE') {
            const name = stringField(body, 'name');
            const connectorId = stringField(body, 'connectorId');
            if (!name || !connectorId) {
                sendJson(res, 400, { error: 'Canvas name and connectorId are required' });
                return;
            }
            const filePath = findCanvasPath(root, name);
            if (!filePath) {
                sendJson(res, 404, { error: `Canvas "${name}" not found` });
                return;
            }
            try {
                const data = readCanvas(filePath);
                const connector = (data.connectors || []).find((c) => c.id === connectorId);
                if (!connector) {
                    sendJson(res, 404, { error: `Connector "${connectorId}" not found in canvas "${name}"` });
                    return;
                }
                const eventId = appendEvent(filePath, {
                    event: 'connector_removed',
                    timestamp: new Date().toISOString(),
                    connectorId,
                    // Carry the full removed connector so undo can re-add it without
                    // walking history. Symmetric to connector_added.connector.
                    connector,
                });
                await pushCanvasUpdate(name, filePath, __viteWs);
                sendJson(res, 200, { success: true, removed: 1, eventId });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to remove connector: ${errorMessage(err)}` });
            }
            return;
        }
        // POST /batch — execute multiple canvas operations in a single request.
        // Reads the canvas once, appends all events, pushes ONE HMR update at the end.
        // Operations reference earlier results via $index (auto) or $refName (opt-in).
        if (routePath === '/batch' && method === 'POST') {
            const name = stringField(body, 'name');
            const operations = batchOperationsField(body.operations);
            if (!name) {
                sendJson(res, 400, { error: 'Canvas name is required' });
                return;
            }
            if (!operations || operations.length === 0) {
                sendJson(res, 400, { error: 'operations must be a non-empty array' });
                return;
            }
            if (operations.length > 200) {
                sendJson(res, 400, { error: 'Maximum 200 operations per batch' });
                return;
            }
            const filePath = findCanvasPath(root, name);
            if (!filePath) {
                sendJson(res, 404, { error: `Canvas "${name}" not found` });
                return;
            }
            try {
                const layoutOps = operations.filter((operation) => operation.op === 'update-layout');
                if (layoutOps.length > 0) {
                    if (operations.length !== 1 || layoutOps.length !== 1) {
                        sendJson(res, 400, { error: 'update-layout must be the only operation in its batch' });
                        return;
                    }
                    const operation = layoutOps[0];
                    if (!operation.expectedRevision || !operation.layout) {
                        sendJson(res, 400, { error: 'update-layout requires expectedRevision and layout' });
                        return;
                    }
                    const raw = fs.readFileSync(filePath);
                    if (canvasDocumentRevision(raw) !== operation.expectedRevision) {
                        sendJson(res, 409, { error: 'Canvas changed before layout planning completed; reload and retry' });
                        return;
                    }
                    const before = materializeFromText(raw.toString('utf-8'));
                    const layoutData = operation.layout;
                    const sourceBinding = operation.sourceBinding;
                    const jsxReference = typeof before.jsx === 'string' && before.jsx.length > 0 ? before.jsx : null;
                    if ((sourceBinding && (sourceBinding.canvasId !== name || sourceBinding.jsxReference !== jsxReference))
                        || (jsxReference && !sourceBinding)) {
                        sendJson(res, 409, { error: 'Canvas source binding changed or is unavailable; reload and retry' });
                        return;
                    }
                    const storedSourceExports = new Set((Array.isArray(before.sources) ? before.sources : [])
                        .map((source) => isRecord(source) ? source.export : null)
                        .filter((exportName) => typeof exportName === 'string' && exportName.length > 0));
                    let resolvedSourceExports = new Set();
                    if (jsxReference) {
                        if (!ctx.resolveCanvasSourceExports) {
                            sendJson(res, 503, { error: 'Current canvas JSX source binding cannot be verified' });
                            return;
                        }
                        const resolved = await ctx.resolveCanvasSourceExports(filePath, jsxReference);
                        if (!resolved) {
                            sendJson(res, 409, { error: 'Current canvas JSX source binding could not be resolved' });
                            return;
                        }
                        resolvedSourceExports = new Set(resolved);
                    }
                    if (!Array.isArray(layoutData.sources) || layoutData.sources.some((source) => !isRecord(source) || typeof source.export !== 'string'
                        || (!storedSourceExports.has(source.export) && !resolvedSourceExports.has(source.export)))) {
                        sendJson(res, 400, { error: 'update-layout contains a source not stored on this canvas or resolved by its current JSX binding' });
                        return;
                    }
                    const requestedSourceExports = new Set(layoutData.sources.map((source) => source.export));
                    if (requestedSourceExports.size !== layoutData.sources.length) {
                        sendJson(res, 400, { error: 'update-layout contains duplicate source exports' });
                        return;
                    }
                    for (const requiredExport of [...storedSourceExports, ...resolvedSourceExports]) {
                        if (!requestedSourceExports.has(requiredExport)) {
                            sendJson(res, 400, { error: `update-layout omitted required source export: ${requiredExport}` });
                            return;
                        }
                    }
                    const event = {
                        event: 'canvas_layout_updated',
                        id: generateEventId(),
                        timestamp: new Date().toISOString(),
                        scroll: layoutData.scroll,
                        widgets: layoutData.widgets,
                        sources: layoutData.sources,
                    };
                    let decodedEvent;
                    try {
                        decodedEvent = decodeCanvasEvent(event);
                    }
                    catch (error) {
                        sendJson(res, 400, { error: `update-layout contains invalid fields: ${errorMessage(error)}` });
                        return;
                    }
                    if (!decodedEvent) {
                        sendJson(res, 400, { error: 'update-layout contains invalid scroll or geometry fields' });
                        return;
                    }
                    if (event.widgets.some((geometry) => !Number.isFinite(geometry.width) || geometry.width <= 0
                        || !Number.isFinite(geometry.height) || geometry.height <= 0)
                        || event.sources.some((geometry) => !Number.isFinite(geometry.width) || geometry.width <= 0
                            || !Number.isFinite(geometry.height) || geometry.height <= 0)) {
                        sendJson(res, 400, { error: 'update-layout dimensions must be finite positive numbers' });
                        return;
                    }
                    let after;
                    try {
                        after = applyEvent(before, event);
                    }
                    catch (error) {
                        sendJson(res, 400, { error: `update-layout rejected: ${errorMessage(error)}` });
                        return;
                    }
                    if (after === before)
                        throw new Error('Canvas layout update was not applied');
                    const withLayout = appendLayoutToDocument(raw, event);
                    const revision = replaceCanvasDocument(filePath, operation.expectedRevision, withLayout);
                    await pushCanvasUpdate(name, filePath, __viteWs);
                    sendJson(res, 200, {
                        success: true,
                        results: [{ index: 0, op: 'update-layout', success: true, eventId: event.id }],
                        refs: {},
                        eventId: event.id,
                        documentRevision: revision,
                    });
                    return;
                }
                const canvasData = readCanvas(filePath);
                const widgetIds = new Set((canvasData.widgets || []).map((w) => w.id));
                const connectorIds = new Set((canvasData.connectors || []).map((c) => c.id));
                const widgetMap = new Map((canvasData.widgets || []).map((w) => [w.id, { ...w }]));
                const connectorMap = new Map((canvasData.connectors || []).map((c) => [c.id, { ...c }]));
                const refs = {};
                const results = [];
                const validAnchors = ['top', 'bottom', 'left', 'right'];
                // Resolve $ref strings — "$0", "$myName", etc.
                function resolveRef(val) {
                    if (typeof val !== 'string')
                        throw new Error('Widget or connector ID must be a string');
                    if (!val.startsWith('$'))
                        return val;
                    const refName = val.slice(1);
                    if (typeof refs[refName] === 'string')
                        return refs[refName];
                    throw new Error(`Unknown ref "${val}"`);
                }
                for (let i = 0; i < operations.length; i++) {
                    const op = operations[i];
                    if (!op)
                        throw new Error(`Batch operation ${i} is missing.`);
                    const ts = new Date().toISOString();
                    try {
                        switch (op.op) {
                            case 'create-widget': {
                                const { type, props: requestedProps = {}, ref, pool, near, direction, resolve: doResolve, source: opSource, gap: opGap } = op;
                                const props = requestedProps || {};
                                let position = op.position || { x: 0, y: 0 };
                                if (!type)
                                    throw new Error('type is required');
                                // Detect whether an explicit position was provided
                                const hasExplicitPos = op.position && (op.position.x !== 0 || op.position.y !== 0);
                                const hasNearOptOut = near === false;
                                const needsAuto = !near && !hasExplicitPos && !hasNearOptOut;
                                // --near: compute position relative to a reference widget
                                if (near) {
                                    const nearId = resolveRef(near);
                                    const refWidget = widgetMap.get(nearId);
                                    if (!refWidget)
                                        throw new Error(`Widget "${nearId}" not found (near)`);
                                    const layoutRef = toLayoutWidget(refWidget);
                                    if (!layoutRef)
                                        throw new Error(`Widget "${nearId}" has invalid layout data`);
                                    const gridSize = typeof canvasData.gridSize === 'number' ? canvasData.gridSize : 24;
                                    position = computeNearPosition(layoutRef, direction || 'right', type, props, opGap, gridSize);
                                }
                                // Auto-position: no --near, no explicit x,y → smart default
                                if (needsAuto && !near) {
                                    const currentWidgets = Array.from(widgetMap.values());
                                    position = await computeAutoPosition(currentWidgets, type, props, root, name, opSource || null);
                                }
                                const widgetId = generateWidgetId(type);
                                await prepareTerminalWidget({ type, props, widgetId, canvasName: name, req });
                                let hotProbe = { ready: false };
                                if ((type === 'terminal' || type === 'agent') && pool !== 'cold') {
                                    const poolId = resolvePoolId(type, props);
                                    hotProbe = peekPool(hotPool, poolId, pool);
                                    if (!hotProbe.ready && pool === 'hot')
                                        throw new Error(`No warm sessions available in pool "${poolId}"`);
                                }
                                const eligible = !near && (doResolve === true || (!hasExplicitPos && !hasNearOptOut));
                                const creation = appendWidgetCreation(filePath, name, { id: widgetId, type, position, props }, eligible, {
                                    resolve: Boolean(near || doResolve || needsAuto),
                                    gap: near && typeof opGap === 'number' ? opGap : null,
                                    preferAxis: near ? directionPreferAxis(direction || '') : 'horizontal',
                                });
                                for (const event of creation.placementEvents) {
                                    if (event.event !== 'widget_moved' || typeof event.widgetId !== 'string')
                                        continue;
                                    const peer = widgetMap.get(event.widgetId);
                                    const peerPosition = pointField(event.position);
                                    if (peer && peerPosition)
                                        peer.position = peerPosition;
                                }
                                widgetIds.add(widgetId);
                                widgetMap.set(widgetId, creation.widget);
                                refs[String(i)] = widgetId;
                                if (ref)
                                    refs[ref] = widgetId;
                                const result = { index: i, op: 'create-widget', ref: ref || undefined, widgetId, ...creation };
                                if (hotProbe.ready)
                                    result.hotSession = { id: null, runtimeSessionId: null };
                                results.push(result);
                                break;
                            }
                            case 'update-widget': {
                                const widgetId = resolveRef(op.widgetId);
                                const { props } = op;
                                if (!widgetId)
                                    throw new Error('widgetId is required');
                                if (!props)
                                    throw new Error('props is required');
                                if (!widgetIds.has(widgetId))
                                    throw new Error(`Widget "${widgetId}" not found`);
                                const existing = widgetMap.get(widgetId);
                                const prevProps = {};
                                for (const key of Object.keys(props)) {
                                    prevProps[key] = existing?.props ? existing.props[key] : undefined;
                                }
                                const eventId = appendEvent(filePath, { event: 'widget_updated', timestamp: ts, widgetId, props, prevProps });
                                if (existing)
                                    existing.props = { ...existing.props, ...props };
                                results.push({ index: i, op: 'update-widget', widgetId, success: true, eventId });
                                break;
                            }
                            case 'move-widget': {
                                const widgetId = resolveRef(op.widgetId);
                                const { position } = op;
                                if (!widgetId)
                                    throw new Error('widgetId is required');
                                if (!position)
                                    throw new Error('position is required');
                                if (!widgetIds.has(widgetId))
                                    throw new Error(`Widget "${widgetId}" not found`);
                                const existing = widgetMap.get(widgetId);
                                const mergedPosition = { ...(existing?.position || {}), ...position };
                                const prevPosition = existing?.position || { x: 0, y: 0 };
                                const eventId = appendEvent(filePath, { event: 'widget_moved', timestamp: ts, widgetId, position: mergedPosition, prevPosition });
                                if (existing)
                                    existing.position = mergedPosition;
                                results.push({ index: i, op: 'move-widget', widgetId, success: true, eventId });
                                break;
                            }
                            case 'delete-widget': {
                                const widgetId = resolveRef(op.widgetId);
                                if (!widgetId)
                                    throw new Error('widgetId is required');
                                if (!widgetIds.has(widgetId))
                                    throw new Error(`Widget "${widgetId}" not found`);
                                const existing = widgetMap.get(widgetId);
                                assertCanvasWritable(filePath);
                                if (existing)
                                    await closeWidgetSession(root, name, existing);
                                const eventId = appendEvent(filePath, {
                                    event: 'widget_removed',
                                    timestamp: ts,
                                    widgetId,
                                    widget: existing,
                                });
                                widgetIds.delete(widgetId);
                                widgetMap.delete(widgetId);
                                results.push({ index: i, op: 'delete-widget', widgetId, success: true, eventId });
                                break;
                            }
                            case 'create-connector': {
                                const startWidgetId = resolveRef(op.startWidgetId);
                                const endWidgetId = resolveRef(op.endWidgetId);
                                let { startAnchor, endAnchor, connectorType = 'default', ref } = op;
                                if (!startWidgetId || !endWidgetId)
                                    throw new Error('startWidgetId and endWidgetId are required');
                                if (startWidgetId === endWidgetId)
                                    throw new Error('Cannot connect a widget to itself');
                                if (!widgetIds.has(startWidgetId))
                                    throw new Error(`Widget "${startWidgetId}" not found`);
                                if (!widgetIds.has(endWidgetId))
                                    throw new Error(`Widget "${endWidgetId}" not found`);
                                // Auto-calculate optimal anchors if not provided
                                if (!startAnchor || !endAnchor) {
                                    const startWidget = widgetMap.get(startWidgetId);
                                    const endWidget = widgetMap.get(endWidgetId);
                                    if (!startWidget || !endWidget)
                                        throw new Error('Connector widgets are no longer available');
                                    const startLayout = toLayoutWidget(startWidget);
                                    const endLayout = toLayoutWidget(endWidget);
                                    if (!startLayout || !endLayout)
                                        throw new Error('Connector widgets have invalid layout data');
                                    const computed = findBestAnchors(startLayout, endLayout);
                                    if (!startAnchor)
                                        startAnchor = computed.startAnchor;
                                    if (!endAnchor)
                                        endAnchor = computed.endAnchor;
                                }
                                if (!validAnchors.includes(startAnchor) || !validAnchors.includes(endAnchor)) {
                                    throw new Error(`Anchors must be one of: ${validAnchors.join(', ')}`);
                                }
                                const validEndpoints = ['circle', 'arrow-start', 'arrow-end', 'none'];
                                if (op.startEndpoint != null && !validEndpoints.includes(op.startEndpoint)) {
                                    throw new Error(`startEndpoint must be one of: ${validEndpoints.join(', ')}`);
                                }
                                if (op.endEndpoint != null && !validEndpoints.includes(op.endEndpoint)) {
                                    throw new Error(`endEndpoint must be one of: ${validEndpoints.join(', ')}`);
                                }
                                const connectorId = generateWidgetId('connector');
                                const connector = {
                                    id: connectorId,
                                    type: 'connector',
                                    connectorType,
                                    start: { widgetId: startWidgetId, anchor: startAnchor },
                                    end: { widgetId: endWidgetId, anchor: endAnchor },
                                    meta: op.meta && typeof op.meta === 'object' ? { ...op.meta } : {},
                                };
                                if (typeof op.className === 'string' && op.className)
                                    connector.className = op.className;
                                if (op.style && typeof op.style === 'object')
                                    connector.style = { ...op.style };
                                if (op.data && typeof op.data === 'object')
                                    connector.data = { ...op.data };
                                if (op.startEndpoint)
                                    connector.startEndpoint = op.startEndpoint;
                                if (op.endEndpoint)
                                    connector.endEndpoint = op.endEndpoint;
                                const eventId = appendEvent(filePath, { event: 'connector_added', timestamp: ts, connector });
                                connectorIds.add(connectorId);
                                connectorMap.set(connectorId, connector);
                                refs[String(i)] = connectorId;
                                if (ref)
                                    refs[ref] = connectorId;
                                results.push({ index: i, op: 'create-connector', ref: ref || undefined, connectorId, success: true, eventId });
                                break;
                            }
                            case 'delete-connector': {
                                const connectorId = resolveRef(op.connectorId);
                                if (!connectorId)
                                    throw new Error('connectorId is required');
                                if (!connectorIds.has(connectorId))
                                    throw new Error(`Connector "${connectorId}" not found`);
                                const existing = connectorMap.get(connectorId);
                                const eventId = appendEvent(filePath, {
                                    event: 'connector_removed',
                                    timestamp: ts,
                                    connectorId,
                                    connector: existing,
                                });
                                connectorIds.delete(connectorId);
                                connectorMap.delete(connectorId);
                                results.push({ index: i, op: 'delete-connector', connectorId, success: true, eventId });
                                break;
                            }
                            case 'update-connector': {
                                const connectorId = resolveRef(op.connectorId);
                                const { meta, className, style, data: opData, startEndpoint, endEndpoint } = op;
                                if (!connectorId)
                                    throw new Error('connectorId is required');
                                const hasPresentational = className !== undefined || style !== undefined
                                    || opData !== undefined || startEndpoint !== undefined || endEndpoint !== undefined;
                                if (!meta && !hasPresentational) {
                                    throw new Error('meta or a presentational field (className/style/data/startEndpoint/endEndpoint) is required');
                                }
                                if (!connectorIds.has(connectorId))
                                    throw new Error(`Connector "${connectorId}" not found`);
                                const validEndpoints = ['circle', 'arrow-start', 'arrow-end', 'none'];
                                if (startEndpoint != null && startEndpoint !== undefined && !validEndpoints.includes(startEndpoint)) {
                                    throw new Error(`startEndpoint must be one of: ${validEndpoints.join(', ')}`);
                                }
                                if (endEndpoint != null && endEndpoint !== undefined && !validEndpoints.includes(endEndpoint)) {
                                    throw new Error(`endEndpoint must be one of: ${validEndpoints.join(', ')}`);
                                }
                                const existing = connectorMap.get(connectorId);
                                const updates = {};
                                const prevUpdates = {};
                                if (meta) {
                                    updates.meta = meta;
                                    const prevMeta = {};
                                    for (const key of Object.keys(meta)) {
                                        prevMeta[key] = existing?.meta ? existing.meta[key] : undefined;
                                    }
                                    prevUpdates.meta = prevMeta;
                                }
                                if (className !== undefined) {
                                    updates.className = className;
                                    prevUpdates.className = existing?.className ?? null;
                                }
                                if (style !== undefined) {
                                    updates.style = style;
                                    if (style && typeof style === 'object') {
                                        const prevStyle = {};
                                        for (const key of Object.keys(style)) {
                                            prevStyle[key] = existing?.style ? existing.style[key] : undefined;
                                        }
                                        prevUpdates.style = prevStyle;
                                    }
                                    else {
                                        prevUpdates.style = existing?.style ?? null;
                                    }
                                }
                                if (opData !== undefined) {
                                    updates.data = opData;
                                    if (opData && typeof opData === 'object') {
                                        const prevD = {};
                                        for (const key of Object.keys(opData)) {
                                            prevD[key] = existing?.data ? existing.data[key] : undefined;
                                        }
                                        prevUpdates.data = prevD;
                                    }
                                    else {
                                        prevUpdates.data = existing?.data ?? null;
                                    }
                                }
                                if (startEndpoint !== undefined) {
                                    updates.startEndpoint = startEndpoint;
                                    prevUpdates.startEndpoint = existing?.startEndpoint ?? null;
                                }
                                if (endEndpoint !== undefined) {
                                    updates.endEndpoint = endEndpoint;
                                    prevUpdates.endEndpoint = existing?.endEndpoint ?? null;
                                }
                                const eventId = appendEvent(filePath, {
                                    event: 'connector_updated',
                                    timestamp: ts,
                                    connectorId,
                                    updates,
                                    prevUpdates,
                                });
                                if (existing) {
                                    if (meta)
                                        existing.meta = { ...(existing.meta || {}), ...meta };
                                    if (className === null)
                                        delete existing.className;
                                    else if (typeof className === 'string')
                                        existing.className = className;
                                    if (style === null)
                                        delete existing.style;
                                    else if (style && typeof style === 'object')
                                        existing.style = { ...(existing.style || {}), ...style };
                                    if (opData === null)
                                        delete existing.data;
                                    else if (opData && typeof opData === 'object')
                                        existing.data = { ...(existing.data || {}), ...opData };
                                    if (startEndpoint === null)
                                        delete existing.startEndpoint;
                                    else if (startEndpoint)
                                        existing.startEndpoint = startEndpoint;
                                    if (endEndpoint === null)
                                        delete existing.endEndpoint;
                                    else if (endEndpoint)
                                        existing.endEndpoint = endEndpoint;
                                }
                                results.push({ index: i, op: 'update-connector', connectorId, success: true, eventId });
                                break;
                            }
                            default:
                                throw new Error(`Unknown operation "${op.op}"`);
                        }
                    }
                    catch (opErr) {
                        // Fail-fast: push what we have so far, then return the error
                        await pushCanvasUpdate(name, filePath, __viteWs);
                        sendJson(res, 400, {
                            success: false,
                            error: `Operation ${i} (${op.op}) failed: ${errorMessage(opErr)}`,
                            failedAt: i,
                            results,
                            refs,
                        });
                        return;
                    }
                }
                // A later creation can move an earlier created peer when stationary
                // placement is enabled. Return its final geometry to optimistic clients.
                for (const result of results) {
                    if (result.op !== 'create-widget' || typeof result.widgetId !== 'string')
                        continue;
                    const widget = widgetMap.get(result.widgetId);
                    if (widget)
                        result.widget = widget;
                }
                await pushCanvasUpdate(name, filePath, __viteWs);
                sendJson(res, 200, { success: true, results, refs });
            }
            catch (err) {
                const status = typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number' ? err.status : 500;
                sendJson(res, status, { error: `Batch failed: ${errorMessage(err)}` });
            }
            return;
        }
        // PUT /rename-page — rename a canvas page file
        if (routePath === '/rename-page' && method === 'PUT') {
            const name = stringField(body, 'name');
            const newTitle = stringField(body, 'newTitle');
            if (!name || !newTitle) {
                sendJson(res, 400, { error: 'Canvas name and newTitle are required' });
                return;
            }
            const filePath = findCanvasPath(root, name);
            if (!filePath) {
                sendJson(res, 404, { error: `Canvas "${name}" not found` });
                return;
            }
            const kebab = newTitle
                .replace(/[^a-zA-Z0-9\s_-]/g, '')
                .trim()
                .replace(/[\s_]+/g, '-')
                .toLowerCase()
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            if (!kebab) {
                sendJson(res, 400, { error: 'newTitle must contain at least one alphanumeric character' });
                return;
            }
            try {
                const artifactDirectory = canvasArtifactDirectoryForPayload(filePath);
                if (artifactDirectory) {
                    const parent = path.dirname(artifactDirectory);
                    const visibilityPrefix = hasNotebookManifest(root)
                        ? artifactFolderVisibilityPrefix(path.basename(artifactDirectory))
                        : '';
                    const newDirectory = path.join(parent, `${visibilityPrefix}${kebab}.canvas`);
                    const newPath = path.join(newDirectory, `${kebab}.canvas.jsonl`);
                    const oldCompanion = filePath.replace(/\.canvas\.jsonl$/, '.canvas.jsx');
                    const newCompanion = newPath.replace(/\.canvas\.jsonl$/, '.canvas.jsx');
                    if (newDirectory !== artifactDirectory && fs.existsSync(newDirectory)) {
                        sendJson(res, 409, { error: `Canvas artifact "${path.basename(newDirectory)}" already exists` });
                        return;
                    }
                    assertCanvasWritable(filePath);
                    const stableId = stableCanvasIdForFile(root, filePath);
                    const routeConflict = inspectNotebook(root).artifacts.find(artifact => artifact.kind === 'canvas'
                        && artifact.id !== stableId && artifact.route === `/canvas/${kebab}`);
                    if (routeConflict) {
                        sendJson(res, 409, { error: `Canvas route "/canvas/${kebab}" is already used by "${routeConflict.folderPath}"` });
                        return;
                    }
                    fs.renameSync(artifactDirectory, newDirectory);
                    const renamedPayload = path.join(newDirectory, path.basename(filePath));
                    if (renamedPayload !== newPath)
                        fs.renameSync(renamedPayload, newPath);
                    const movedCompanion = path.join(newDirectory, path.basename(oldCompanion));
                    if (fs.existsSync(movedCompanion)) {
                        if (movedCompanion !== newCompanion)
                            fs.renameSync(movedCompanion, newCompanion);
                    }
                    appendEvent(newPath, {
                        event: 'settings_updated',
                        timestamp: new Date().toISOString(),
                        settings: { title: newTitle },
                    });
                    if (hasNotebookManifest(root)) {
                        updateNotebookPage(root, { id: stableId }, { title: newTitle });
                    }
                    const newCanonicalId = canvasIdForFile(notebookRelativePath(root, newPath));
                    sendJson(res, 200, {
                        success: true,
                        name: newCanonicalId,
                        id: stableId,
                        path: notebookRelativePath(root, newPath),
                        route: `/canvas/${kebab}`,
                    });
                    return;
                }
                const dir = path.dirname(filePath);
                const newFilename = `${kebab}.canvas.jsonl`;
                const newPath = path.join(dir, newFilename);
                if (newPath !== filePath && fs.existsSync(newPath)) {
                    sendJson(res, 409, { error: `A canvas file named "${newFilename}" already exists in this directory` });
                    return;
                }
                assertCanvasWritable(filePath);
                fs.renameSync(filePath, newPath);
                const newCanonicalId = canvasIdForFile(path.relative(root, newPath));
                appendEvent(newPath, {
                    event: 'settings_updated',
                    timestamp: new Date().toISOString(),
                    settings: { title: newTitle },
                });
                // Update pageOrder in .meta.json if it exists
                const metaForOrder = readFolderMeta(dir);
                if (Array.isArray(metaForOrder.pageOrder)) {
                    try {
                        const updated = metaForOrder.pageOrder.map((entry) => typeof entry === 'string' && entry === name ? newCanonicalId : entry);
                        metaForOrder.pageOrder = updated;
                        writeFolderMeta(dir, metaForOrder);
                    }
                    catch { /* skip */ }
                }
                sendJson(res, 200, { success: true, name: newCanonicalId, route: '/canvas/' + newCanonicalId });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to rename page: ${errorMessage(err)}` });
            }
            return;
        }
        // PUT /reorder-pages — save page order for a canvas folder
        if (routePath === '/reorder-pages' && method === 'PUT') {
            const folder = stringField(body, 'folder');
            const rawOrder = body.order;
            const order = Array.isArray(rawOrder) && rawOrder.every((entry) => typeof entry === 'string') ? rawOrder : null;
            if (!folder || !order) {
                sendJson(res, 400, { error: 'folder (string) and order (array) are required' });
                return;
            }
            const canvasDir = canvasContentRoot(root);
            const folderDir = fs.existsSync(path.join(canvasDir, `${folder}.folder`))
                ? path.join(canvasDir, `${folder}.folder`)
                : fs.existsSync(path.join(canvasDir, folder))
                    ? path.join(canvasDir, folder)
                    : null;
            if (!folderDir) {
                sendJson(res, 404, { error: `Folder "${folder}" not found` });
                return;
            }
            try {
                const meta = readFolderMeta(folderDir);
                meta.pageOrder = order;
                writeFolderMeta(folderDir, meta);
                sendJson(res, 200, { success: true });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to save page order: ${errorMessage(err)}` });
            }
            return;
        }
        // GET /page-order?folder=... — read page order for a folder
        if (routePath.startsWith('/page-order') && method === 'GET') {
            const pageOrderUrl = new URL(routePath, 'http://localhost');
            const folder = pageOrderUrl.searchParams.get('folder');
            if (!folder) {
                sendJson(res, 400, { error: 'folder query parameter is required' });
                return;
            }
            const canvasDir = canvasContentRoot(root);
            const folderDir = fs.existsSync(path.join(canvasDir, `${folder}.folder`))
                ? path.join(canvasDir, `${folder}.folder`)
                : fs.existsSync(path.join(canvasDir, folder))
                    ? path.join(canvasDir, folder)
                    : null;
            if (!folderDir) {
                sendJson(res, 404, { error: `Folder "${folder}" not found` });
                return;
            }
            try {
                const meta = readFolderMeta(folderDir);
                sendJson(res, 200, { order: meta?.pageOrder || null });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to read page order: ${errorMessage(err)}` });
            }
            return;
        }
        // PUT /update-folder-meta — update folder .meta.json title
        if (routePath === '/update-folder-meta' && method === 'PUT') {
            const folder = stringField(body, 'folder');
            const title = stringField(body, 'title');
            if (!folder || !title) {
                sendJson(res, 400, { error: 'folder and title are required' });
                return;
            }
            const kebab = title
                .replace(/[^a-zA-Z0-9\s_-]/g, '')
                .trim()
                .replace(/[\s_]+/g, '-')
                .toLowerCase()
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            if (!kebab) {
                sendJson(res, 400, { error: 'title must contain at least one alphanumeric character' });
                return;
            }
            const canvasDir = canvasContentRoot(root);
            const isFolderSuffix = fs.existsSync(path.join(canvasDir, `${folder}.folder`));
            const folderDir = isFolderSuffix
                ? path.join(canvasDir, `${folder}.folder`)
                : fs.existsSync(path.join(canvasDir, folder))
                    ? path.join(canvasDir, folder)
                    : null;
            if (!folderDir) {
                sendJson(res, 404, { error: `Folder "${folder}" not found` });
                return;
            }
            try {
                const meta = readFolderMeta(folderDir);
                const dirName = path.basename(folderDir).replace(/\.folder$/, '');
                meta.title = title;
                // Rename folder directory if the kebab name differs
                const needsRename = kebab !== dirName;
                let newDirName = dirName;
                if (needsRename) {
                    const suffix = isFolderSuffix ? '.folder' : '';
                    const newFolderDir = path.join(canvasDir, `${kebab}${suffix}`);
                    if (fs.existsSync(newFolderDir)) {
                        sendJson(res, 409, { error: `A folder named "${kebab}" already exists` });
                        return;
                    }
                    // Write updated meta, rename file to match new dir name, rename dir
                    writeFolderMeta(folderDir, meta);
                    const metaPath = path.join(folderDir, `${dirName}.meta.json`);
                    const newMetaPath = path.join(folderDir, `${kebab}.meta.json`);
                    if (newMetaPath !== metaPath) {
                        fs.renameSync(metaPath, newMetaPath);
                    }
                    fs.renameSync(folderDir, newFolderDir);
                    newDirName = kebab;
                }
                else {
                    writeFolderMeta(folderDir, meta);
                }
                sendJson(res, 200, { success: true, folder: newDirName, renamed: needsRename });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to update folder meta: ${errorMessage(err)}` });
            }
            return;
        }
        // POST /duplicate — duplicate an existing canvas page with its widgets
        if (routePath === '/duplicate' && method === 'POST') {
            const name = stringField(body, 'name');
            const newTitle = stringField(body, 'newTitle');
            if (!name || !newTitle) {
                sendJson(res, 400, { error: 'Canvas name and newTitle are required' });
                return;
            }
            const filePath = findCanvasPath(root, name);
            if (!filePath) {
                sendJson(res, 404, { error: `Canvas "${name}" not found` });
                return;
            }
            const kebab = newTitle
                .replace(/[^a-zA-Z0-9\s_-]/g, '')
                .trim()
                .replace(/[\s_]+/g, '-')
                .toLowerCase()
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            if (!kebab) {
                sendJson(res, 400, { error: 'newTitle must contain at least one alphanumeric character' });
                return;
            }
            try {
                if (hasNotebookManifest(root)) {
                    const sourceDirectory = canvasArtifactDirectoryForPayload(filePath);
                    const sourceParent = sourceDirectory
                        ? notebookRelativePath(root, path.dirname(sourceDirectory))
                        : notebookRelativePath(root, path.dirname(filePath));
                    const targetParent = stringField(body, 'folder') ?? sourceParent;
                    const visibilityPrefix = sourceDirectory
                        ? artifactFolderVisibilityPrefix(path.basename(sourceDirectory))
                        : '';
                    const target = notebookCanvasArtifactPaths(root, kebab, targetParent, visibilityPrefix);
                    const routeConflict = inspectNotebook(root).artifacts.find(artifact => artifact.kind === 'canvas' && artifact.route === `/canvas/${kebab}`);
                    if (fs.existsSync(target.folderDirectory) || routeConflict) {
                        sendJson(res, 409, { error: `Canvas artifact "${target.folderName}" already exists or its route is already in use` });
                        return;
                    }
                    const sourceName = path.basename(filePath);
                    const sourceCompanion = filePath.replace(/\.canvas\.jsonl$/, '.canvas.jsx');
                    try {
                        if (sourceDirectory)
                            fs.cpSync(sourceDirectory, target.folderDirectory, { recursive: true, errorOnExist: true, force: false });
                        else {
                            fs.mkdirSync(target.folderDirectory);
                            fs.copyFileSync(filePath, path.join(target.folderDirectory, sourceName), fs.constants.COPYFILE_EXCL);
                            if (fs.existsSync(sourceCompanion))
                                fs.copyFileSync(sourceCompanion, path.join(target.folderDirectory, path.basename(sourceCompanion)), fs.constants.COPYFILE_EXCL);
                        }
                        const copiedPayload = path.join(target.folderDirectory, sourceName);
                        if (copiedPayload !== target.payloadFile)
                            fs.renameSync(copiedPayload, target.payloadFile);
                        const copiedCompanion = path.join(target.folderDirectory, path.basename(sourceCompanion));
                        const targetCompanion = target.payloadFile.replace(/\.canvas\.jsonl$/, '.canvas.jsx');
                        if (fs.existsSync(copiedCompanion) && copiedCompanion !== targetCompanion)
                            fs.renameSync(copiedCompanion, targetCompanion);
                        fs.writeFileSync(path.join(target.folderDirectory, '.hypercanvas-artifact.json'), JSON.stringify({
                            formatVersion: 1, id: randomUUID(), kind: 'canvas',
                        }, null, 2) + '\n', 'utf8');
                        appendEvent(target.payloadFile, {
                            event: 'settings_updated',
                            timestamp: new Date().toISOString(),
                            settings: { title: newTitle },
                        });
                        const relativePayload = notebookRelativePath(root, target.payloadFile);
                        const page = registerNotebookPage(root, { type: 'canvas', title: newTitle, path: relativePayload });
                        if (!page)
                            throw new Error('Canvas copy could not be registered in the Notebook.');
                        const relativePath = notebookRelativePath(root, target.payloadFile);
                        const canonicalName = canvasIdForFile(relativePath);
                        notifyArtifactChanged(target.payloadFile, 'add');
                        sendJson(res, 201, {
                            success: true,
                            name: canonicalName,
                            id: page.id,
                            path: relativePath,
                            route: `/canvas/${kebab}`,
                        });
                    }
                    catch (error) {
                        unregisterNotebookPage(root, { path: notebookRelativePath(root, target.payloadFile) });
                        fs.rmSync(target.folderDirectory, { recursive: true, force: true });
                        throw error;
                    }
                    return;
                }
                const sourceData = readCanvas(filePath);
                const dir = path.dirname(filePath);
                const newFilename = `${kebab}.canvas.jsonl`;
                const newPath = path.join(dir, newFilename);
                if (fs.existsSync(newPath)) {
                    sendJson(res, 409, { error: `A canvas file named "${newFilename}" already exists` });
                    return;
                }
                // Re-ID all widgets to avoid collisions
                const widgets = (sourceData.widgets || []).map((w) => ({
                    ...w,
                    id: generateWidgetId(typeof w.type === 'string' ? w.type : 'widget'),
                }));
                const creationEvent = {
                    event: 'canvas_created',
                    timestamp: new Date().toISOString(),
                    title: newTitle,
                    grid: sourceData.grid ?? true,
                    gridSize: sourceData.gridSize ?? 24,
                    colorMode: sourceData.colorMode ?? 'auto',
                    autoPlace: sourceData.autoPlace ?? sourceData.snapToGrid ?? false,
                    widgets,
                };
                writeNewCanvas(newPath, creationEvent);
                const relPath = path.relative(root, newPath).replace(/\\/g, '/');
                const canonicalName = canvasIdForFile(relPath) || kebab;
                sendJson(res, 201, {
                    success: true,
                    name: canonicalName,
                    path: relPath,
                    route: `/canvas/${canonicalName}`,
                });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to duplicate canvas: ${errorMessage(err)}` });
            }
            return;
        }
        // POST /create — create a new .canvas.jsonl file
        // Supports `convertFrom` to convert a single-page canvas into a multi-page folder.
        if (routePath === '/create' && method === 'POST') {
            const name = stringField(body, 'name');
            const title = stringField(body, 'title');
            const folder = stringField(body, 'folder');
            const folderKind = stringField(body, 'folderKind');
            const convertFrom = stringField(body, 'convertFrom');
            const author = stringField(body, 'author');
            const description = stringField(body, 'description');
            const meta = recordField(body, 'meta');
            const grid = typeof body.grid === 'boolean' ? body.grid : true;
            const gridSize = typeof body.gridSize === 'number' && Number.isFinite(body.gridSize) ? body.gridSize : 24;
            const colorMode = stringField(body, 'colorMode') || 'auto';
            const autoPlace = typeof body.autoPlace === 'boolean'
                ? body.autoPlace
                : (typeof body.snapToGrid === 'boolean' ? body.snapToGrid : false);
            if (!name || typeof name !== 'string') {
                sendJson(res, 400, { error: 'Canvas name is required' });
                return;
            }
            const kebab = name
                .replace(/[^a-zA-Z0-9\s_-]/g, '')
                .trim()
                .replace(/[\s_]+/g, '-')
                .toLowerCase()
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            if (!kebab) {
                sendJson(res, 400, { error: 'Name must contain at least one alphanumeric character' });
                return;
            }
            // ── Convert single-page canvas to multi-page folder ──────────────
            if (convertFrom && typeof convertFrom === 'string') {
                // Only allow flat root canvases (no path segments, no proto:)
                if (convertFrom.includes('/') || convertFrom.startsWith('proto:')) {
                    sendJson(res, 400, { error: 'convertFrom only supports flat root canvases (no path segments or proto: prefix)' });
                    return;
                }
                const canvasDir = canvasContentRoot(root);
                const existingPath = findCanvasPath(root, convertFrom);
                if (!existingPath) {
                    sendJson(res, 404, { error: `Canvas "${convertFrom}" not found` });
                    return;
                }
                // Verify it's actually a flat file in src/canvas/ (not already in a folder)
                const existingRel = path.relative(canvasDir, existingPath).replace(/\\/g, '/');
                if (existingRel.includes('/')) {
                    sendJson(res, 400, { error: `Canvas "${convertFrom}" is already inside a folder` });
                    return;
                }
                const newDir = path.join(canvasDir, convertFrom);
                const dotFolderDir = path.join(canvasDir, `${convertFrom}.folder`);
                // Preflight: check for collisions
                if (fs.existsSync(newDir)) {
                    sendJson(res, 409, { error: `Directory "${convertFrom}" already exists in src/canvas/` });
                    return;
                }
                if (fs.existsSync(dotFolderDir)) {
                    sendJson(res, 409, { error: `Directory "${convertFrom}.folder" already exists in src/canvas/` });
                    return;
                }
                // Read the existing canvas to extract metadata for .meta.json
                let existingData;
                try {
                    existingData = readCanvas(existingPath);
                }
                catch (err) {
                    sendJson(res, 500, { error: `Failed to read existing canvas: ${errorMessage(err)}` });
                    return;
                }
                const existingBasename = path.basename(existingPath);
                const movedCanvasPath = path.join(newDir, existingBasename);
                const newPagePath = path.join(newDir, `${kebab}.canvas.jsonl`);
                if (existingBasename === `${kebab}.canvas.jsonl`) {
                    sendJson(res, 409, { error: `New page name "${kebab}" collides with existing canvas filename` });
                    return;
                }
                // Perform the conversion with rollback on failure
                const rollbackOps = [];
                try {
                    // 1. Create the directory
                    fs.mkdirSync(newDir, { recursive: true });
                    rollbackOps.push(() => { try {
                        fs.rmdirSync(newDir);
                    }
                    catch { /* ignore */ } });
                    // 2. Move the existing canvas file
                    fs.renameSync(existingPath, movedCanvasPath);
                    rollbackOps.push(() => { try {
                        fs.renameSync(movedCanvasPath, existingPath);
                    }
                    catch { /* ignore */ } });
                    // 3. Write .meta.json with metadata from the existing canvas
                    const metaObj = { title: existingData?.title || convertFrom };
                    if (existingData?.description)
                        metaObj.description = existingData.description;
                    if (existingData?.author)
                        metaObj.author = existingData.author;
                    const metaPath = path.join(newDir, `${convertFrom}.meta.json`);
                    fs.writeFileSync(metaPath, JSON.stringify(metaObj, null, 2) + '\n', 'utf-8');
                    rollbackOps.push(() => { try {
                        fs.unlinkSync(metaPath);
                    }
                    catch { /* ignore */ } });
                    // 4. Create the new page
                    const creationEvent = {
                        event: 'canvas_created',
                        timestamp: new Date().toISOString(),
                        title: title || kebab.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
                        grid,
                        gridSize,
                        colorMode,
                        autoPlace: existingData?.autoPlace ?? existingData?.snapToGrid ?? autoPlace,
                        widgets: [],
                    };
                    writeNewCanvas(newPagePath, creationEvent);
                    const relPath = path.relative(root, newPagePath).replace(/\\/g, '/');
                    const canonicalName = canvasIdForFile(relPath) || kebab;
                    notifyArtifactChanged(newPagePath, 'add');
                    sendJson(res, 201, {
                        success: true,
                        converted: true,
                        name: canonicalName,
                        path: relPath,
                        route: `/canvas/${canonicalName}`,
                    });
                }
                catch (err) {
                    // Rollback in reverse order
                    for (let i = rollbackOps.length - 1; i >= 0; i--) {
                        rollbackOps[i]?.();
                    }
                    sendJson(res, 500, { error: `Failed to convert canvas to folder: ${errorMessage(err)}` });
                }
                return;
            }
            // ── Standard canvas creation ─────────────────────────────────────
            const canvasDir = canvasContentRoot(root);
            const notebook = hasNotebookManifest(root);
            let targetDir = canvasDir;
            let canvasPath;
            if (notebook) {
                try {
                    const artifact = notebookCanvasArtifactPaths(root, kebab, folder || undefined);
                    if (fs.existsSync(artifact.folderDirectory)) {
                        sendJson(res, 409, { error: `Canvas artifact "${artifact.folderName}" already exists in "${artifact.parentPath || '.'}"` });
                        return;
                    }
                    const canonicalRoute = `/canvas/${kebab}`.toLocaleLowerCase('en-US');
                    const routeConflicts = inspectNotebook(root).artifacts.filter(item => item.kind === 'canvas'
                        && item.route?.toLocaleLowerCase('en-US') === canonicalRoute);
                    if (routeConflicts.length) {
                        sendJson(res, 409, {
                            error: `Canvas route "/canvas/${kebab}" is already used by ${routeConflicts.map(item => `"${item.folderPath}"`).join(', ')}`,
                        });
                        return;
                    }
                    targetDir = artifact.folderDirectory;
                    canvasPath = artifact.payloadFile;
                }
                catch (err) {
                    sendJson(res, 400, { error: errorMessage(err) });
                    return;
                }
            }
            else {
                if (folder) {
                    const dotFolderDir = path.join(canvasDir, `${folder}.folder`);
                    const plainDir = path.join(canvasDir, folder);
                    if (fs.existsSync(dotFolderDir))
                        targetDir = dotFolderDir;
                    else if (fs.existsSync(plainDir) && fs.statSync(plainDir).isDirectory())
                        targetDir = plainDir;
                    else {
                        const useWorkspace = folderKind === 'workspace';
                        const newDir = useWorkspace ? dotFolderDir : plainDir;
                        try {
                            fs.mkdirSync(newDir, { recursive: true });
                            if (meta && typeof meta === 'object') {
                                const metaPath = path.join(newDir, `${folder}.meta.json`);
                                fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
                            }
                        }
                        catch (err) {
                            sendJson(res, 500, { error: `Failed to create directory: ${errorMessage(err)}` });
                            return;
                        }
                        targetDir = newDir;
                    }
                }
                canvasPath = path.join(targetDir, `${kebab}.canvas.jsonl`);
            }
            if (fs.existsSync(canvasPath)) {
                sendJson(res, 409, { error: `Canvas "${kebab}" already exists` });
                return;
            }
            const creationEvent = {
                event: 'canvas_created',
                timestamp: new Date().toISOString(),
                title: title || kebab.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
                grid,
                gridSize,
                colorMode,
                autoPlace,
                widgets: [],
            };
            if (author) {
                creationEvent.author = author;
            }
            if (description) {
                creationEvent.description = description;
            }
            let createdArtifactDirectory = false;
            try {
                if (notebook) {
                    fs.mkdirSync(targetDir);
                    createdArtifactDirectory = true;
                }
                else
                    fs.mkdirSync(targetDir, { recursive: true });
                writeNewCanvas(canvasPath, creationEvent);
                const relPath = notebookRelativePath(root, canvasPath);
                const canonicalName = canvasIdForFile(relPath) || kebab;
                const stableId = stableCanvasIdForFile(root, canvasPath);
                const result = {
                    success: true,
                    name: canonicalName,
                    id: stableId,
                    path: relPath,
                    route: notebook ? `/canvas/${kebab}` : `/canvas/${canonicalName}`,
                };
                notifyArtifactChanged(canvasPath, 'add');
                sendJson(res, 201, result);
            }
            catch (err) {
                if (createdArtifactDirectory)
                    fs.rmSync(targetDir, { recursive: true, force: true });
                sendJson(res, 500, { error: `Failed to create canvas: ${errorMessage(err)}` });
            }
            return;
        }
        // ── Story routes ──────────────────────────────────────────────────
        // GET /stories — list all .story.{jsx,tsx} files with their exports
        if (routePath === '/stories' && method === 'GET') {
            try {
                const storyFiles = findStoryFiles(root);
                sendJson(res, 200, { stories: storyFiles });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to list stories: ${errorMessage(err)}` });
            }
            return;
        }
        // POST /create-story — scaffold a story or create an owned paste preview.
        if (routePath === '/create-story' && method === 'POST') {
            const name = stringField(body, 'name');
            const location = stringField(body, 'location');
            const format = stringField(body, 'format') || 'jsx';
            const storyCanvasName = stringField(body, 'canvasName');
            const suppliedContent = typeof body?.content === 'string' ? body.content : null;
            if (!name || typeof name !== 'string') {
                sendJson(res, 400, { error: 'Component name is required' });
                return;
            }
            const kebab = name
                .replace(/[^a-zA-Z0-9\s_-]/g, '')
                .trim()
                .replace(/[\s_]+/g, '-')
                .toLowerCase()
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            if (!kebab) {
                sendJson(res, 400, { error: 'Name must contain at least one alphanumeric character' });
                return;
            }
            const ext = format === 'tsx' ? 'tsx' : 'jsx';
            // Resolve target directory from location + canvas name
            let targetDir;
            if (location === 'components') {
                targetDir = path.join(root, 'src', 'components');
            }
            else if (storyCanvasName) {
                const canvasPath = findCanvasPath(root, storyCanvasName);
                targetDir = canvasPath ? path.dirname(canvasPath) : canvasContentRoot(root);
            }
            else {
                targetDir = canvasContentRoot(root);
            }
            const storyPath = path.join(targetDir, `${kebab}.story.${ext}`);
            if (fs.existsSync(storyPath)) {
                sendJson(res, 409, { error: `Story "${kebab}.story.${ext}" already exists at ${path.relative(root, targetDir)}` });
                return;
            }
            // Check for duplicate story name anywhere in the project (Vite data plugin
            // enforces global uniqueness and would fail the build on duplicates)
            const existing = findStoryFiles(root);
            // The Notebook data index treats story names as globally unique. Its
            // canonical components/ directory is not part of findStoryFiles's
            // routable source roots, so include it in this collision check.
            const notebookComponentStories = path.join(root, 'components');
            let notebookComponentCollision = false;
            try {
                const pending = [notebookComponentStories];
                while (pending.length && !notebookComponentCollision) {
                    const dir = pending.pop();
                    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                        if (entry.isDirectory())
                            pending.push(path.join(dir, entry.name));
                        else if (entry.isFile() && (entry.name === `${kebab}.story.jsx` || entry.name === `${kebab}.story.tsx`)) {
                            notebookComponentCollision = true;
                            break;
                        }
                    }
                }
            }
            catch { /* no canonical Notebook components directory */ }
            if (existing.some(s => s.name === kebab) || notebookComponentCollision) {
                sendJson(res, 409, { error: `A story named "${kebab}" already exists in the project` });
                return;
            }
            const componentName = kebab.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
            const content = suppliedContent ?? `/**
 * ${componentName} component stories.
 * Each named export becomes a draggable widget on the canvas.
 */

export function Default() {
  return (
    <div style={{ padding: '1.5rem', minWidth: 200 }}>
      <h3>${componentName}</h3>
      <p>Edit this file to build your component.</p>
    </div>
  )
}
`;
            try {
                fs.mkdirSync(targetDir, { recursive: true });
                fs.writeFileSync(storyPath, content, 'utf-8');
                const relPath = path.relative(root, storyPath);
                // Force-invalidate the data index so a follow-up "add to canvas"
                // doesn't race chokidar (StoryWidget would otherwise show
                // "Story not found" until the next refresh).
                notifyArtifactChanged(storyPath, 'add');
                const sourceHash = createHash('sha256').update(content).digest('hex');
                const cleanupToken = suppliedContent === null ? undefined : randomBytes(24).toString('hex');
                if (cleanupToken)
                    ownedStoryPreviews.set(cleanupToken, { path: storyPath, sourceHash });
                const canvasRelativeDir = path.relative(canvasContentRoot(root), targetDir);
                const routeParts = canvasRelativeDir.split(path.sep)
                    .filter((part) => part && part !== 'drafts' && !part.endsWith('.folder'));
                const route = `/components/${[...routeParts, kebab].filter(Boolean).join('/')}`;
                sendJson(res, 201, {
                    success: true,
                    name: kebab,
                    path: relPath,
                    storyId: kebab,
                    ...(suppliedContent === null ? {} : { sourceHash, cleanupToken, route }),
                });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to create story: ${errorMessage(err)}` });
            }
            return;
        }
        // DELETE /create-story — remove only a paste preview created by this
        // handler and only while its exact file content remains unchanged.
        if (routePath === '/create-story' && method === 'DELETE') {
            const token = stringField(body, 'cleanupToken');
            const owned = token ? ownedStoryPreviews.get(token) : undefined;
            if (!owned) {
                sendJson(res, 404, { success: false, error: 'Story preview ownership token is unknown or expired' });
                return;
            }
            try {
                if (!fs.existsSync(owned.path)) {
                    ownedStoryPreviews.delete(token);
                    sendJson(res, 404, { success: false, error: 'Owned story preview no longer exists' });
                    return;
                }
                const currentHash = createHash('sha256').update(fs.readFileSync(owned.path)).digest('hex');
                if (currentHash !== owned.sourceHash) {
                    sendJson(res, 409, { success: false, code: 'OWNED_STORY_MODIFIED', error: 'Story preview changed after creation; it was preserved' });
                    return;
                }
                fs.unlinkSync(owned.path);
                ownedStoryPreviews.delete(token);
                notifyArtifactChanged(owned.path, 'unlink');
                sendJson(res, 200, { success: true, removed: true });
            }
            catch (err) {
                sendJson(res, 500, { success: false, error: `Failed to remove owned story preview: ${errorMessage(err)}` });
            }
            return;
        }
        // GET /github/available — check if gh CLI is installed locally
        if (routePath === '/github/available' && method === 'GET') {
            sendJson(res, 200, {
                available: isGhCliAvailable(),
                installUrl: GH_INSTALL_URL,
            });
            return;
        }
        // POST /github/embed — fetch metadata for GitHub issue/discussion/comment links
        if (routePath === '/github/embed' && method === 'POST') {
            const rawUrl = typeof body?.url === 'string' ? body.url.trim() : '';
            if (!rawUrl) {
                sendJson(res, 400, { code: 'invalid_url', error: 'url is required' });
                return;
            }
            if (!isGitHubEmbedUrl(rawUrl)) {
                sendJson(res, 400, {
                    code: 'unsupported_url',
                    error: 'Only GitHub issue, discussion, and comment URLs are supported.',
                });
                return;
            }
            try {
                const snapshot = fetchGitHubEmbedSnapshot(rawUrl);
                sendJson(res, 200, { success: true, snapshot });
            }
            catch (error) {
                if (error instanceof GitHubEmbedError) {
                    sendJson(res, error.status ?? 500, {
                        code: error.code,
                        error: errorMessage(error),
                        installUrl: error.code === 'gh_unavailable' ? GH_INSTALL_URL : undefined,
                    });
                    return;
                }
                sendJson(res, 500, {
                    code: 'gh_fetch_failed',
                    error: errorMessage(error) || 'Failed to fetch GitHub metadata.',
                });
            }
            return;
        }
        // ── Image routes ──────────────────────────────────────────────────
        const imagesDir = notebookContentPath(root, 'assets', 'canvas', 'images');
        const snapshotsDir = notebookContentPath(root, 'assets', 'canvas', 'snapshots');
        const MIME_TO_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
        const EXT_TO_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
        const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
        // Route snapshot uploads (snapshot-* prefix) to the snapshots directory.
        // Canvases inside a `drafts/` segment go to images/drafts/ (gitignored)
        // so draft-only images don't leak into git via assets/canvas/images/.
        function isDraftCanvasId(canvasName) {
            if (!canvasName || typeof canvasName !== 'string')
                return false;
            return canvasName.split('/').some((seg) => seg === 'drafts');
        }
        function resolveWriteDir(canvasName) {
            if (canvasName?.startsWith('snapshot-'))
                return snapshotsDir;
            if (isDraftCanvasId(canvasName))
                return path.join(imagesDir, 'drafts');
            return imagesDir;
        }
        // Validate a filename coming from the client. Accepts a bare basename
        // (`foo.png`) or one optional `drafts/` segment (`drafts/foo.png`).
        // Returns { dirSegment: '' | 'drafts', basename } or null if invalid.
        function parseValidFilename(filename) {
            if (!filename || typeof filename !== 'string')
                return null;
            if (filename.includes('..') || filename.includes('\\'))
                return null;
            const segments = filename.split('/');
            if (segments.length === 1) {
                return segments[0] ? { dirSegment: '', basename: segments[0] } : null;
            }
            if (segments.length === 2 && segments[0] === 'drafts' && segments[1]) {
                return { dirSegment: 'drafts', basename: segments[1] };
            }
            return null;
        }
        // Resolve a stored filename to an absolute path on disk.
        //
        // `filename` may be either a bare basename (`foo.png`) or one optional
        // `drafts/` segment followed by a basename (`drafts/foo.png`). The
        // `drafts/` form is reserved for images that belong to draft canvases
        // and resolves only into images/drafts/. Bare basenames intentionally
        // do NOT fall back to images/drafts/ — that would let a public canvas
        // serve a draft-only asset just by sharing a basename.
        //
        // Returns null when the filename is malformed or the file is not found.
        function resolveImagePath(filename) {
            const parsed = parseValidFilename(filename);
            if (!parsed)
                return null;
            if (parsed.dirSegment === 'drafts') {
                const draftPath = path.join(imagesDir, 'drafts', parsed.basename);
                if (fs.existsSync(draftPath))
                    return draftPath;
                return null;
            }
            const snapshotPath = path.join(snapshotsDir, parsed.basename);
            if (fs.existsSync(snapshotPath))
                return snapshotPath;
            const imagePath = path.join(imagesDir, parsed.basename);
            if (fs.existsSync(imagePath))
                return imagePath;
            return null;
        }
        // POST /image — upload a pasted image (base64 data URL)
        if (routePath === '/image' && method === 'POST') {
            const dataUrl = stringField(body, 'dataUrl');
            const canvasName = stringField(body, 'canvasName');
            const purpose = stringField(body, 'purpose');
            if (purpose && purpose !== 'agent-screenshot') {
                sendJson(res, 400, { error: 'Unsupported image upload purpose' });
                return;
            }
            if (!dataUrl || typeof dataUrl !== 'string') {
                sendJson(res, 400, { error: 'dataUrl is required' });
                return;
            }
            const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
            if (!match) {
                sendJson(res, 400, { error: 'Invalid data URL format' });
                return;
            }
            const mimeCapture = match[1];
            const base64 = match[2];
            if (!mimeCapture || !base64) {
                sendJson(res, 400, { error: 'Invalid data URL format' });
                return;
            }
            const mime = mimeCapture.toLowerCase();
            const ext = MIME_TO_EXT[mime];
            if (!ext) {
                sendJson(res, 400, { error: `Unsupported image type: ${mime}` });
                return;
            }
            const buffer = Buffer.from(base64, 'base64');
            const maxSize = purpose === 'agent-screenshot' ? 15 * 1024 * 1024 : MAX_IMAGE_SIZE;
            if (buffer.length > maxSize) {
                sendJson(res, 413, { error: `Image exceeds ${maxSize / 1024 / 1024}MB limit` });
                return;
            }
            // Agent screenshots belong to the Notebook, never to a canvas or
            // agent widget. Preserve the human-readable shortcode contract and
            // use exclusive creation so rapid pastes cannot overwrite one another.
            if (purpose === 'agent-screenshot') {
                const pngHeader = Buffer.from('89504e470d0a1a0a', 'hex');
                if (mime !== 'image/png' || !buffer.subarray(0, pngHeader.length).equals(pngHeader)) {
                    sendJson(res, 400, { error: 'Agent screenshots must contain PNG image data' });
                    return;
                }
                const screenshotDir = notebookContentPath(root, 'assets', 'screenshots');
                const pad = (n) => String(n).padStart(2, '0');
                const now = new Date();
                try {
                    fs.mkdirSync(screenshotDir, { recursive: true });
                    // Seconds are the highest precision in the required filename. In
                    // case of a same-second collision, advance to the next free second
                    // rather than corrupting the existing screenshot.
                    for (let offset = 0; offset < 120; offset++) {
                        const date = new Date(now.getTime() + offset * 1000);
                        const filename = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}--${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}--screenshot.png`;
                        try {
                            fs.writeFileSync(path.join(screenshotDir, filename), buffer, { flag: 'wx' });
                            sendJson(res, 201, { success: true, filename });
                            return;
                        }
                        catch (error) {
                            if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')
                                continue;
                            throw error;
                        }
                    }
                    sendJson(res, 409, { error: 'Could not allocate a unique screenshot filename' });
                }
                catch (error) {
                    sendJson(res, 500, { error: `Failed to save screenshot: ${errorMessage(error)}` });
                }
                return;
            }
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}--${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
            const suffix = `-${Math.random().toString(36).slice(2, 6)}`;
            const prefix = canvasName ? `${canvasName.replace(/[/:]/g, '--')}--` : '';
            // Support explicit filename for snapshot uploads (stable naming)
            // and cropped image uploads (user-initiated crop)
            const explicitName = stringField(body, 'filename');
            let filename;
            if (explicitName && /^snapshot-[a-z0-9_-]+--(latest|light|dark)\.webp$/i.test(explicitName)) {
                filename = explicitName;
            }
            else if (explicitName && /--cropped--\d{4}-\d{2}-\d{2}--\d{2}-\d{2}-\d{2}\.\w+$/.test(explicitName)) {
                // Cropped image: validate format, strip path traversal
                const safeName = explicitName.replace(/[/\\]/g, '');
                if (safeName === explicitName && !explicitName.includes('..')) {
                    filename = explicitName;
                }
                else {
                    filename = `${prefix}${dateStr}${suffix}.${ext}`;
                }
            }
            else {
                filename = `${prefix}${dateStr}${suffix}.${ext}`;
            }
            const targetDir = resolveWriteDir(canvasName || '');
            // Return the filename with a `drafts/` prefix when the write went to
            // the drafts subdirectory, so widget `props.src` includes the
            // directory and the GET route can locate the file unambiguously.
            const responseFilename = targetDir === path.join(imagesDir, 'drafts') ? `drafts/${filename}` : filename;
            try {
                fs.mkdirSync(targetDir, { recursive: true });
                fs.writeFileSync(path.join(targetDir, filename), buffer);
                sendJson(res, 201, { success: true, filename: responseFilename });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to save image: ${errorMessage(err)}` });
            }
            return;
        }
        // GET /images/<filename> — serve an image file. Filename may include
        // an optional `drafts/` directory segment (e.g. `drafts/foo.png`).
        if (routePath.startsWith('/images/') && method === 'GET') {
            // Strip query string (e.g. ?v=123 cache busters) from filename
            let filename = routePath.slice('/images/'.length);
            const qIdx = filename.indexOf('?');
            if (qIdx !== -1)
                filename = filename.slice(0, qIdx);
            // Validate (allows optional `drafts/` segment, rejects deeper paths
            // and path traversal)
            if (!parseValidFilename(filename)) {
                sendJson(res, 400, { error: 'Invalid filename' });
                return;
            }
            const filePath = resolveImagePath(filename);
            if (!filePath) {
                sendJson(res, 404, { error: 'Image not found' });
                return;
            }
            const ext = path.extname(filename).slice(1).toLowerCase();
            const contentType = EXT_TO_MIME[ext] || 'application/octet-stream';
            try {
                const data = fs.readFileSync(filePath);
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Content-Length': data.length,
                    'Cache-Control': 'no-cache',
                });
                res.end(data);
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to serve image: ${errorMessage(err)}` });
            }
            return;
        }
        // POST /image/duplicate — copy an image file with a new timestamped name.
        // Accepts a bare basename or one optional `drafts/` segment.
        if (routePath === '/image/duplicate' && method === 'POST') {
            const filename = stringField(body, 'filename');
            if (!filename || typeof filename !== 'string') {
                sendJson(res, 400, { error: 'filename is required' });
                return;
            }
            const parsed = parseValidFilename(filename);
            if (!parsed) {
                sendJson(res, 400, { error: 'Invalid filename' });
                return;
            }
            const sourcePath = resolveImagePath(filename);
            if (!sourcePath) {
                sendJson(res, 404, { error: 'Image not found' });
                return;
            }
            try {
                const base = parsed.basename;
                const ext = path.extname(base);
                const now = new Date();
                const pad = (n) => String(n).padStart(2, '0');
                const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}--${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
                // Preserve privacy prefix on the basename
                const prefix = base.startsWith('~') ? '~' : '';
                const baseName = base.replace(/^~/, '').replace(ext, '');
                // Extract canvas prefix (everything before the date pattern or the full base)
                const canvasMatch = baseName.match(/^(.+?--)\d{4}-/);
                const canvasPrefix = canvasMatch ? canvasMatch[1] : '';
                const newBase = `${prefix}${canvasPrefix}${dateStr}${ext}`;
                const targetDir = path.dirname(sourcePath);
                fs.copyFileSync(sourcePath, path.join(targetDir, newBase));
                // Return the filename with the same drafts/ prefix as the source
                const responseFilename = parsed.dirSegment === 'drafts' ? `drafts/${newBase}` : newBase;
                sendJson(res, 201, { success: true, filename: responseFilename });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to duplicate image: ${errorMessage(err)}` });
            }
            return;
        }
        // POST /image/toggle-private — toggle tilde prefix on image filename
        if (routePath === '/image/toggle-private' && method === 'POST') {
            const filename = stringField(body, 'filename');
            if (!filename || typeof filename !== 'string') {
                sendJson(res, 400, { error: 'filename is required' });
                return;
            }
            const parsed = parseValidFilename(filename);
            if (!parsed) {
                sendJson(res, 400, { error: 'Invalid filename' });
                return;
            }
            const base = parsed.basename;
            const isPrivate = base.startsWith('~');
            const newBase = isPrivate ? base.slice(1) : `~${base}`;
            const oldPath = resolveImagePath(filename);
            if (!oldPath) {
                sendJson(res, 404, { error: 'Image not found' });
                return;
            }
            const parentDir = path.dirname(oldPath);
            const newPath = path.join(parentDir, newBase);
            // Preserve the `drafts/` segment on the returned filename
            const responseFilename = parsed.dirSegment === 'drafts' ? `drafts/${newBase}` : newBase;
            try {
                fs.renameSync(oldPath, newPath);
                sendJson(res, 200, { success: true, filename: responseFilename, private: !isPrivate });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to toggle private: ${errorMessage(err)}` });
            }
            return;
        }
        // ── Agent Signal API ──────────────────────────────────────────────────
        // POST /agent/signal — agent signals status (done/error/running)
        if (routePath === '/agent/signal' && method === 'POST') {
            const widgetId = stringField(body, 'widgetId');
            const canvasId = stringField(body, 'canvasId');
            const branch = stringField(body, 'branch');
            const status = stringField(body, 'status');
            const message = stringField(body, 'message');
            const payload = body.data;
            if (!widgetId || !status) {
                sendJson(res, 400, { error: 'widgetId and status are required' });
                return;
            }
            const validStatuses = ['done', 'error', 'running', 'working'];
            if (!validStatuses.includes(status)) {
                sendJson(res, 400, { error: `status must be one of: ${validStatuses.join(', ')}` });
                return;
            }
            try {
                const { updateAgentStatus, initTerminalConfig } = await import('./terminal-config.js');
                initTerminalConfig(root);
                updateAgentStatus({
                    branch: branch || 'unknown',
                    canvasId: canvasId || 'unknown',
                    widgetId,
                    status,
                    message: message || null,
                    data: payload || null,
                });
                // Push status to canvas clients via Vite WS custom event
                if (__viteWs) {
                    __viteWs.send({
                        type: 'custom',
                        event: 'storyboard:agent-status',
                        data: { widgetId, canvasId, status, message, timestamp: new Date().toISOString() },
                    });
                }
                sendJson(res, 200, { success: true, status });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to update agent status: ${errorMessage(err)}` });
            }
            return;
        }
        // GET /agents — list storyboard-spawned agent sessions on a canvas
        if (routePath === '/agents' && method === 'GET') {
            const url = new URL(req?.url || '/', 'http://localhost');
            const canvasId = url.searchParams.get('canvasId');
            const branch = url.searchParams.get('branch') || null;
            if (!canvasId) {
                sendJson(res, 400, { error: 'canvasId query parameter is required' });
                return;
            }
            try {
                const { listAgentsForCanvas, initTerminalConfig } = await import('./terminal-config.js');
                initTerminalConfig(root);
                const agents = listAgentsForCanvas({ branch, canvasId });
                sendJson(res, 200, { agents });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to list agents: ${errorMessage(err)}` });
            }
            return;
        }
        // GET /agent/status — poll agent status for a widget
        if (routePath.startsWith('/agent/status') && method === 'GET') {
            const url = new URL(req?.url || '/', 'http://localhost');
            const widgetId = url.searchParams.get('widgetId');
            const canvasId = url.searchParams.get('canvasId') || 'unknown';
            const branch = url.searchParams.get('branch') || 'unknown';
            if (!widgetId) {
                sendJson(res, 400, { error: 'widgetId query parameter is required' });
                return;
            }
            try {
                const { readTerminalConfig, readTerminalConfigById, initTerminalConfig } = await import('./terminal-config.js');
                initTerminalConfig(root);
                let config = readTerminalConfig({ branch, canvasId, widgetId });
                // Fallback: when canvasId/branch are missing, mismatched, or stale
                // (e.g. the persisted canvasId only captured the parent folder),
                // recover via the widget-id-named symlink that writeTerminalConfig
                // creates next to the hashed config.
                if (!config?.agentStatus) {
                    const byId = readTerminalConfigById(widgetId);
                    if (byId?.agentStatus)
                        config = byId;
                }
                sendJson(res, 200, { agentStatus: config?.agentStatus || null });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to read agent status: ${errorMessage(err)}` });
            }
            return;
        }
        // POST /agent/spawn — spawn a headless agent session
        if (routePath === '/agent/spawn' && method === 'POST') {
            const canvasId = stringField(body, 'canvasId');
            const widgetId = stringField(body, 'widgetId');
            const prompt = stringField(body, 'prompt');
            const autopilot = typeof body.autopilot === 'boolean' ? body.autopilot : true;
            const reqBranch = stringField(body, 'branch');
            const agentId = stringField(body, 'agentId');
            if (!canvasId || !widgetId || !prompt) {
                sendJson(res, 400, { error: 'canvasId, widgetId, and prompt are required' });
                return;
            }
            const configuredAgents = readAgentsConfig(root) || {};
            const promptExecution = getPromptExecution();
            const targetAgentId = agentId || undefined
                || (isRecord(promptExecution) ? stringField(promptExecution, 'default') : undefined)
                || Object.keys(configuredAgents).find((id) => isRecord(configuredAgents[id]) && configuredAgents[id].default === true)
                || Object.keys(configuredAgents)[0]
                || undefined;
            try {
                const session = await spawnHeadlessAgent({
                    canvasId,
                    widgetId,
                    prompt,
                    autopilot,
                    ...(reqBranch ? { requestedBranch: reqBranch } : {}),
                    ...(targetAgentId ? { agentId: targetAgentId, warmPoolId: targetAgentId } : {}),
                });
                if (__viteWs) {
                    __viteWs.send({
                        type: 'custom',
                        event: 'storyboard:agent-status',
                        data: { widgetId, canvasId, status: 'running', timestamp: new Date().toISOString() },
                    });
                }
                sendJson(res, 200, { success: true, sessionId: session.sessionId, status: 'running' });
            }
            catch (err) {
                sendJson(res, err instanceof HostRuntimeError ? 409 : 500, { error: `Failed to spawn agent: ${errorMessage(err)}`, code: err instanceof HostRuntimeError ? err.code : null });
            }
            return;
        }
        // POST /agent/peek — reconnect a headless agent session to a visible terminal widget
        if (routePath === '/agent/peek' && method === 'POST') {
            const widgetId = stringField(body, 'widgetId');
            const canvasId = stringField(body, 'canvasId');
            if (!widgetId) {
                sendJson(res, 400, { error: 'widgetId is required' });
                return;
            }
            try {
                const { findSessionIdForWidget, generateSessionId } = await import('./terminal-registry.js');
                const branch = readOptionalGitValue(root, ['branch', '--show-current']) || 'unknown';
                const sessionId = findSessionIdForWidget(widgetId) || generateSessionId(branch, canvasId || 'unknown', widgetId);
                if (!await terminalSessionExists(sessionId)) {
                    sendJson(res, 404, { error: `No PTY session found for widget ${widgetId}` });
                    return;
                }
                sendJson(res, 200, {
                    success: true,
                    sessionId,
                    widgetId,
                    canvasId: canvasId || 'unknown',
                    message: 'Session is alive. Create a terminal widget to connect.',
                });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to peek agent session: ${errorMessage(err)}` });
            }
            return;
        }
        // ── Terminal Messaging API ──────────────────────────────────────────
        // POST /terminal/activate-agent — activate an agent launched from terminal-welcome
        if (routePath === '/terminal/activate-agent' && method === 'POST') {
            const widgetId = stringField(body, 'widgetId');
            const canvasId = stringField(body, 'canvasId');
            const branch = stringField(body, 'branch');
            const agentId = stringField(body, 'agentId');
            if (!widgetId) {
                sendJson(res, 400, { error: 'widgetId is required' });
                return;
            }
            try {
                const { activateTerminalAgent } = await import('./terminal-server.js');
                const result = await activateTerminalAgent({
                    widgetId,
                    ...(canvasId ? { canvasId } : {}),
                    ...(branch ? { branch } : {}),
                    ...(agentId ? { agentId } : {}),
                });
                sendJson(res, 200, { success: true, ...result });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to activate terminal agent: ${errorMessage(err)}` });
            }
            return;
        }
        // POST /terminal/context — inspect lifecycle state, acknowledge or retry.
        if (routePath === '/terminal/context' && method === 'POST') {
            const widgetId = stringField(body, 'widgetId');
            const action = stringField(body, 'action') || 'state';
            const launchId = stringField(body, 'launchId') || undefined;
            const revision = typeof body.revision === 'string' ? body.revision : undefined;
            const interactive = typeof body.interactive === 'boolean' ? body.interactive : undefined;
            if (typeof widgetId !== 'string' || !widgetId.trim()) {
                sendJson(res, 400, { error: 'widgetId is required' });
                return;
            }
            try {
                const { initTerminalConfig, readTerminalConfigById } = await import('./terminal-config.js');
                const context = await import('./live-terminal-coding-target.js');
                initTerminalConfig(root);
                const config = readTerminalConfigById(widgetId);
                if (findCanvasWidget(root, widgetId, config?.canvasId)?.type === 'agent-chat') {
                    sendJson(res, 409, { error: 'Agent Chat uses managed prompt delivery, not terminal context' });
                    return;
                }
                if (!config) {
                    sendJson(res, 404, { error: 'Terminal context not found' });
                    return;
                }
                let state;
                if (action === 'start')
                    state = context.startTerminalContext(root, widgetId, { launchId: launchId || '', revision: revision || '', ...(interactive === undefined ? {} : { interactive }) });
                else if (action === 'exit')
                    state = context.stopTerminalContext(root, widgetId, launchId);
                else if (action === 'ack')
                    state = await context.acknowledgeTerminalContext(root, widgetId, { launchId: launchId || '', revision: revision || '' });
                else if (action === 'retry')
                    state = await context.refreshLiveCodingTarget(root, widgetId, { retry: true });
                else if (action === 'state')
                    state = readTerminalConfigById(widgetId)?.contextState || null;
                else
                    throw new Error('Unknown terminal context action');
                sendJson(res, 200, { success: true, state });
            }
            catch (error) {
                sendJson(res, 409, { error: errorMessage(error) });
            }
            return;
        }
        // POST /terminal/input — write text to a live PTY, optionally followed by Enter.
        if (routePath === '/terminal/input' && method === 'POST') {
            const widgetId = stringField(body, 'widgetId');
            const sessionId = stringField(body, 'sessionId');
            const canvasId = stringField(body, 'canvasId');
            const branch = stringField(body, 'branch');
            const text = body.text;
            const keys = body.keys;
            const hasWidgetTarget = body.widgetId !== undefined && body.widgetId !== null;
            const hasSessionTarget = body.sessionId !== undefined && body.sessionId !== null;
            const targetCount = Number(hasWidgetTarget) + Number(hasSessionTarget);
            const submit = body.submit === undefined ? false : body.submit;
            const paste = body.paste === undefined ? false : body.paste;
            if (targetCount !== 1) {
                sendJson(res, 400, { code: 'INVALID_TERMINAL_TARGET', error: 'Provide exactly one non-empty widgetId or sessionId' });
                return;
            }
            const target = hasWidgetTarget ? widgetId : sessionId;
            if (typeof target !== 'string' || !target.trim()) {
                sendJson(res, 400, { code: 'INVALID_TERMINAL_TARGET', error: 'The terminal target must be a non-empty string' });
                return;
            }
            if (text === undefined && keys === undefined) {
                sendJson(res, 400, { code: 'INVALID_TERMINAL_TEXT', error: 'text must be a string' });
                return;
            }
            if (text !== undefined && typeof text !== 'string') {
                sendJson(res, 400, { code: 'INVALID_TERMINAL_TEXT', error: 'text must be a string' });
                return;
            }
            if (keys !== undefined && (!Array.isArray(keys) || keys.some(key => typeof key !== 'string'))) {
                sendJson(res, 400, { code: 'INVALID_TERMINAL_KEYS', error: 'keys must be an array of strings' });
                return;
            }
            if (text !== undefined && keys !== undefined) {
                sendJson(res, 400, { code: 'INVALID_TERMINAL_INPUT', error: 'Provide either text or keys, not both' });
                return;
            }
            if (typeof submit !== 'boolean') {
                sendJson(res, 400, { code: 'INVALID_SUBMIT_OPTION', error: 'submit must be a boolean' });
                return;
            }
            if (typeof paste !== 'boolean') {
                sendJson(res, 400, { code: 'INVALID_PASTE_OPTION', error: 'paste must be a boolean' });
                return;
            }
            if (paste && keys !== undefined) {
                sendJson(res, 400, { code: 'INVALID_PASTE_OPTION', error: 'paste can only be used with text input' });
                return;
            }
            if (canvasId != null && typeof canvasId !== 'string') {
                sendJson(res, 400, { code: 'INVALID_CANVAS_ID', error: 'canvasId must be a string' });
                return;
            }
            if (branch != null && typeof branch !== 'string') {
                sendJson(res, 400, { code: 'INVALID_BRANCH', error: 'branch must be a string' });
                return;
            }
            let entry = null;
            let resolvedSessionId = sessionId || null;
            try {
                const { getSession, listSessions } = await import('./terminal-registry.js');
                if (widgetId) {
                    const matches = listSessions().filter(session => (session.widgetId === widgetId
                        && (!canvasId || session.canvasId === canvasId)
                        && (!branch || session.branch === branch)));
                    if (matches.length > 1) {
                        sendJson(res, 409, {
                            code: 'AMBIGUOUS_TERMINAL_TARGET',
                            error: `Widget ${widgetId} maps to multiple terminal sessions; provide a sessionId or narrow by canvasId and branch`,
                        });
                        return;
                    }
                    entry = matches[0] || null;
                    resolvedSessionId = entry?.sessionId || null;
                    if (!entry) {
                        const widget = findCanvasWidget(root, widgetId, canvasId || undefined);
                        if (widget && typeof widget.type === 'string' && ['terminal-read', 'prompt'].includes(widget.type)) {
                            sendJson(res, 409, {
                                code: 'TERMINAL_READ_ONLY',
                                error: `Widget ${widgetId} is a read-only terminal view and cannot accept input`,
                            });
                            return;
                        }
                        sendJson(res, 404, {
                            code: 'TERMINAL_NOT_FOUND',
                            error: `No writable PTY session is registered for widget ${widgetId}`,
                        });
                        return;
                    }
                }
                else {
                    entry = getSession(sessionId || '');
                    if (entry && canvasId && entry.canvasId !== canvasId) {
                        sendJson(res, 404, { code: 'TERMINAL_NOT_FOUND', error: `Session ${sessionId} is not registered in canvas ${canvasId}` });
                        return;
                    }
                    if (entry && branch && entry.branch !== branch) {
                        sendJson(res, 404, { code: 'TERMINAL_NOT_FOUND', error: `Session ${sessionId} is not registered on branch ${branch}` });
                        return;
                    }
                }
                if (entry) {
                    const widget = findCanvasWidget(root, entry.widgetId, entry.canvasId);
                    if (widget && typeof widget.type === 'string' && ['terminal-read', 'prompt'].includes(widget.type)) {
                        sendJson(res, 409, {
                            code: 'TERMINAL_READ_ONLY',
                            error: `Widget ${entry.widgetId} is a read-only terminal view and cannot accept input`,
                        });
                        return;
                    }
                }
                if (!resolvedSessionId)
                    throw new Error('Terminal session could not be resolved');
                const result = keys === undefined
                    ? await submitTerminalText(resolvedSessionId, text, { submit, ...(paste ? { paste } : {}) })
                    : await submitTerminalKeys(resolvedSessionId, keys, { submit });
                sendJson(res, 200, {
                    success: true,
                    ...result,
                    sessionId: resolvedSessionId,
                    ...(entry ? { widgetId: entry.widgetId, canvasId: entry.canvasId } : {}),
                });
            }
            catch (err) {
                const errorRecord = isRecord(err) ? err : {};
                const notRunning = errorRecord.code === 'TERMINAL_NOT_RUNNING';
                const status = notRunning ? (entry ? 410 : 404) : (typeof errorRecord.statusCode === 'number' ? errorRecord.statusCode : 502);
                const code = notRunning ? (entry ? 'TERMINAL_EXITED' : 'TERMINAL_NOT_FOUND') : (typeof errorRecord.code === 'string' ? errorRecord.code : 'TERMINAL_INPUT_FAILED');
                sendJson(res, status, {
                    code,
                    error: notRunning
                        ? entry ? `Terminal session ${resolvedSessionId} has exited` : `No live PTY session found for ${sessionId}`
                        : errorMessage(err) || 'Terminal input failed',
                });
            }
            return;
        }
        // POST /terminal/output — save latest output to terminal config
        if (routePath === '/terminal/output' && method === 'POST') {
            const outputWidgetId = stringField(body, 'widgetId');
            const content = stringField(body, 'content');
            const summary = stringField(body, 'summary');
            if (!outputWidgetId) {
                sendJson(res, 400, { error: 'widgetId is required' });
                return;
            }
            try {
                const { updateLatestOutput, initTerminalConfig } = await import('./terminal-config.js');
                initTerminalConfig(root);
                updateLatestOutput(outputWidgetId, {
                    content: content || '',
                    summary: summary || '',
                    updatedAt: new Date().toISOString(),
                });
                sendJson(res, 200, { success: true });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to save output: ${errorMessage(err)}` });
            }
            return;
        }
        // POST /prompt/spawn — spawn a prompt agent session (acquires from hot pool)
        if (routePath === '/prompt/spawn' && method === 'POST') {
            const canvasId = stringField(body, 'canvasId');
            const widgetId = stringField(body, 'widgetId');
            const prompt = stringField(body, 'prompt');
            const agentId = stringField(body, 'agentId');
            if (!canvasId || !widgetId || !prompt) {
                sendJson(res, 400, { error: 'canvasId, widgetId, and prompt are required' });
                return;
            }
            try {
                const { updateTerminalConnections } = await import('./terminal-config.js');
                const session = await spawnHeadlessAgent({
                    canvasId,
                    widgetId,
                    prompt,
                    ...(agentId ? { agentId } : {}),
                    warmPoolId: 'prompt',
                    statusMessage: 'Prompt agent spawning...',
                });
                // Resolve connected widgets so the terminal-agent has context
                try {
                    const canvasFilePath = findCanvasPath(root, canvasId);
                    if (canvasFilePath) {
                        const canvasData = readCanvas(canvasFilePath);
                        const widgetMap = new Map((canvasData.widgets || []).map(w => [w.id, w]));
                        const connectors = canvasData.connectors || [];
                        const connectedIds = new Set();
                        for (const conn of connectors) {
                            if (conn.start?.widgetId === widgetId && typeof conn.end?.widgetId === 'string')
                                connectedIds.add(conn.end.widgetId);
                            if (conn.end?.widgetId === widgetId && typeof conn.start?.widgetId === 'string')
                                connectedIds.add(conn.start.widgetId);
                        }
                        const connectedWidgets = [...connectedIds]
                            .map(id => widgetMap.get(id))
                            .filter((widget) => widget !== undefined && typeof widget.type === 'string')
                            .map(w => ({ id: w.id, type: w.type, ...(w.props === undefined ? {} : { props: w.props }), ...(w.position === undefined ? {} : { position: w.position }) }));
                        if (connectedWidgets.length > 0) {
                            updateTerminalConnections({ branch: typeof session.branch === 'string' ? session.branch : 'unknown', canvasId, widgetId, connectedWidgets });
                        }
                    }
                }
                catch (err) {
                    devLog().logEvent('warn', 'Failed to resolve prompt connections', { error: errorMessage(err) });
                }
                if (__viteWs) {
                    __viteWs.send({
                        type: 'custom',
                        event: 'storyboard:agent-status',
                        data: { widgetId, canvasId, status: 'running', timestamp: new Date().toISOString() },
                    });
                }
                sendJson(res, 200, { success: true, sessionId: session.sessionId, status: 'running', warm: session.warm });
            }
            catch (err) {
                sendJson(res, err instanceof HostRuntimeError ? 409 : 500, { error: `Failed to spawn prompt agent: ${errorMessage(err)}`, code: err instanceof HostRuntimeError ? err.code : null });
            }
            return;
        }
        // POST /terminal/kill — kill a terminal or agent PTY session
        if (routePath === '/terminal/kill' && method === 'POST') {
            const targetWidgetId = stringField(body, 'widgetId');
            if (!targetWidgetId) {
                sendJson(res, 400, { error: 'widgetId is required' });
                return;
            }
            try {
                const { findSessionIdForWidget, killSession } = await import('./terminal-registry.js');
                const { updateAgentStatus, initTerminalConfig } = await import('./terminal-config.js');
                initTerminalConfig(root);
                const sessionId = findSessionIdForWidget(targetWidgetId);
                if (!sessionId) {
                    sendJson(res, 404, { error: `No active session for widget ${targetWidgetId}` });
                    return;
                }
                // Close any WS connections for this session
                const { orphanTerminalSession } = await import('./terminal-server.js');
                await orphanTerminalSession(targetWidgetId);
                await killSession(sessionId);
                // Update agent status
                const pathParts = (req?.url || '/').split('/');
                const _canvasIdx = pathParts.indexOf('canvas');
                void _canvasIdx;
                let branch = 'unknown';
                try {
                    branch = readOptionalGitValue(root, ['branch', '--show-current']) || 'unknown';
                }
                catch { /* status update can fall back to unknown */ }
                try {
                    updateAgentStatus({ branch, canvasId: 'unknown', widgetId: targetWidgetId, status: 'cancelled', message: 'Cancelled by user' });
                }
                catch { /* empty */ }
                // Notify via HMR
                if (__viteWs) {
                    __viteWs.send({
                        type: 'custom',
                        event: 'storyboard:agent-status',
                        data: { widgetId: targetWidgetId, status: 'cancelled', message: 'Cancelled by user', timestamp: new Date().toISOString() },
                    });
                }
                sendJson(res, 200, { success: true, killed: sessionId });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to kill session: ${errorMessage(err)}` });
            }
            return;
        }
        // GET /terminal-buffer/:widgetId — read terminal buffer JSON
        // Accepts optional ?length=N query param to truncate scrollback
        if (routePath.startsWith('/terminal-buffer/') && method === 'GET') {
            const widgetId = routePath.slice('/terminal-buffer/'.length).split('?')[0];
            if (!widgetId || widgetId.includes('..') || widgetId.includes('/')) {
                sendJson(res, 400, { error: 'Invalid widgetId' });
                return;
            }
            const urlObj = new URL(req?.url || '/', 'http://localhost');
            const lengthParam = urlObj.searchParams.get('length');
            const maxLength = lengthParam ? parseInt(lengthParam, 10) : undefined;
            try {
                const { readTerminalBuffer } = await import('./terminal-server.js');
                const buffer = readTerminalBuffer(widgetId, maxLength ? { maxLength } : {});
                if (buffer) {
                    sendJson(res, 200, buffer);
                    return;
                }
                sendJson(res, 404, { error: 'Buffer not found' });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to read buffer: ${errorMessage(err)}` });
            }
            return;
        }
        // GET /terminal-snapshot/:widgetId — read terminal snapshot JSON (new + legacy fallback)
        if (routePath.startsWith('/terminal-snapshot/') && method === 'GET') {
            const widgetId = routePath.slice('/terminal-snapshot/'.length);
            if (!widgetId || widgetId.includes('..') || widgetId.includes('/')) {
                sendJson(res, 400, { error: 'Invalid widgetId' });
                return;
            }
            try {
                const { readTerminalSnapshot } = await import('./terminal-server.js');
                // Try new path first
                const snapshot = readTerminalSnapshot(widgetId, null);
                if (snapshot) {
                    sendJson(res, 200, snapshot);
                    return;
                }
                // Legacy fallback: .storyboard/terminal-snapshots/<canvasDir>/<widgetId>.json
                const snapshotsRoot = path.join(resolveRuntimeDir(root), 'terminal-snapshots');
                if (fs.existsSync(snapshotsRoot)) {
                    const dirs = fs.readdirSync(snapshotsRoot, { withFileTypes: true });
                    for (const d of dirs) {
                        if (!d.isDirectory())
                            continue;
                        const filePath = path.join(snapshotsRoot, d.name, `${widgetId}.json`);
                        if (fs.existsSync(filePath)) {
                            const data = fs.readFileSync(filePath, 'utf8');
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(data);
                            return;
                        }
                    }
                }
                sendJson(res, 404, { error: 'Snapshot not found' });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to read snapshot: ${errorMessage(err)}` });
            }
            return;
        }
        // DELETE /delete-canvas — delete a canvas and its directory
        if (routePath === '/delete-canvas' && method === 'DELETE') {
            const { name } = body;
            if (!name || typeof name !== 'string') {
                sendJson(res, 400, { error: 'Canvas name is required' });
                return;
            }
            const filePath = findCanvasPath(root, name);
            if (!filePath) {
                sendJson(res, 404, { error: `Canvas "${name}" not found` });
                return;
            }
            try {
                const dir = path.dirname(filePath);
                const canvasDir = canvasContentRoot(root);
                const artifactDirectory = canvasArtifactDirectoryForPayload(filePath);
                assertCanvasWritable(filePath);
                const revision = canvasPayloadRevision(filePath);
                const stableId = stableCanvasIdForFile(root, filePath);
                const pathId = canvasIdForFile(path.relative(root, filePath));
                for (const widget of readCanvas(filePath).widgets || []) {
                    for (const canvasId of new Set([name, stableId, pathId]))
                        await closeWidgetSession(root, canvasId, widget);
                }
                // Payload and all saved Notebook navigation references commit together.
                if (artifactDirectory)
                    deleteCanvasArtifact(root, filePath, revision);
                else
                    deleteCanvasPage(root, filePath, revision);
                // If the parent directory is inside src/canvas/ and now empty (or only has .meta.json), remove it
                if (!artifactDirectory && dir !== canvasDir) {
                    const remaining = fs.readdirSync(dir).filter(f => !f.endsWith('.meta.json'));
                    if (remaining.length === 0) {
                        for (const f of fs.readdirSync(dir)) {
                            fs.unlinkSync(path.join(dir, f));
                        }
                        fs.rmdirSync(dir);
                    }
                }
                sendJson(res, 200, { success: true, deleted: name, id: stableId });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to delete canvas: ${errorMessage(err)}` });
            }
            return;
        }
        // PUT /update-meta — update canvas metadata
        if (routePath === '/update-meta' && method === 'PUT') {
            const { name, title, description, author } = body;
            if (!name || typeof name !== 'string') {
                sendJson(res, 400, { error: 'Canvas name is required' });
                return;
            }
            const filePath = findCanvasPath(root, name);
            if (!filePath) {
                sendJson(res, 404, { error: `Canvas "${name}" not found` });
                return;
            }
            try {
                // Try to find and update .meta.json first
                const dir = path.dirname(filePath);
                const dirName = path.basename(dir).replace(/\.folder$/, '');
                const metaPath = path.join(dir, `${dirName}.meta.json`);
                if (fs.existsSync(metaPath)) {
                    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                    if (title !== undefined)
                        meta.title = title;
                    if (description !== undefined)
                        meta.description = description;
                    if (author !== undefined)
                        meta.author = author;
                    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
                }
                else {
                    // Update the canvas JSONL's canvas_created event metadata
                    const text = fs.readFileSync(filePath, 'utf-8');
                    const lines = text.split('\n').filter(Boolean);
                    if (lines.length > 0) {
                        const firstLine = lines[0];
                        if (!firstLine)
                            throw new Error('Canvas event log is empty.');
                        const firstEvent = JSON.parse(firstLine);
                        if (title !== undefined)
                            firstEvent.title = title;
                        if (description !== undefined)
                            firstEvent.description = description;
                        if (author !== undefined)
                            firstEvent.author = author;
                        lines[0] = JSON.stringify(firstEvent);
                        fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
                    }
                }
                // Notify via WebSocket
                await pushCanvasUpdate(name, filePath, __viteWs);
                sendJson(res, 200, { success: true, updated: name });
            }
            catch (err) {
                sendJson(res, 500, { error: `Failed to update canvas metadata: ${errorMessage(err)}` });
            }
            return;
        }
        sendJson(res, 404, { error: `Unknown route: ${method} ${routePath}` });
    };
}
