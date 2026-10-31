import path from 'node:path';
import { SiteStore, detectSiteConfiguration, siteIdForTitle, assertAvailableSiteRoot, siteConfigRelativePath, siteDescriptorRelativePath, updateSiteDescriptor } from '../site/site.js';
import { SiteRuntime, adaptPaseoTerminalRuntime, discoverSiteServer, probeSite, rebindSite } from '../site/runtime.js';
import { getPaseoConnection, ensurePaseoWorkspaceForRoot } from '../canvas/paseo-runtime-client.js';
import { initPaseoTerminalRuntime } from '../canvas/paseo-terminal-runtime.js';
import { die, jsonOut, parseSimpleArgs } from './cliHelpers.js';
import { resolveNotebookRoot } from './filesystemRoots.js';
import { registerNotebookPage, unregisterNotebookPage, updateNotebookPage, hasNotebookManifest } from '../notebook/notebook.js';
const subcommand = process.argv[3];
const { positional, flags } = parseSimpleArgs(process.argv.slice(4));
if (!subcommand || flags.help || flags.h) {
    console.log('Usage: hypercanvas site list | detect <project> | create <external-root> --title <name> [--parent <notebook-folder>] [--description <text>] [--development-base-url <url>] [--start-command <command>] [--production-base-url <url>] | metadata <id> [--title <title>] [--description <text>] [--development-base-url <url>] [--start-command <command>] [--production-base-url <url>] [--root <external-directory> for rebind] | add <id> [--parent <notebook-folder>] [--title <title>] [--description <text>] [--development-base-url <url>] [--root <external-project>] [--start-command <command>] [--production-base-url <url>] | move <id> --parent <notebook-folder> | remove <id> --confirmed | status <id> | logs <id> | start <id> | run <id> (alias for start) | stop <id> | restart <id> --confirmed | discover <id> | rebind <id> <url> | capture <id> [--route <route>] [--width <px>] [--height <px>]');
    process.exit(0);
}
const stringFlag = (name) => typeof flags[name] === 'string' ? flags[name] : undefined;
const notebookRoot = resolveNotebookRoot(stringFlag('notebook'));
const store = new SiteStore(notebookRoot);
const startCommandFlag = stringFlag('start-command') ?? stringFlag('start');
const developmentBaseUrlFlag = stringFlag('development-base-url') ?? stringFlag('local-url');
const productionBaseUrlFlag = stringFlag('production-base-url') ?? stringFlag('production') ?? stringFlag('deploy-url');
if (Object.prototype.hasOwnProperty.call(flags, 'notebook-path')) {
    die('--notebook-path is no longer supported; Site directories must be external');
}
async function resolveNotebookWorkspaceId() {
    const connection = await getPaseoConnection();
    return ensurePaseoWorkspaceForRoot(connection.client, notebookRoot);
}
async function siteStatus(id) {
    const binding = store.getBinding(id);
    if (!binding)
        return null;
    if (binding.source === 'url') {
        return {
            ...binding,
            status: binding.developmentBaseUrl ? 'running' : 'stopped',
            running: Boolean(binding.developmentBaseUrl),
            sessionOwnership: binding.developmentBaseUrl ? 'adopted' : null,
        };
    }
    if (!binding.root)
        return { ...binding, status: 'stopped', running: false, sessionOwnership: null };
    try {
        // A manually configured Local URL is authoritative: health-check it
        // directly instead of listener discovery, which must never silently
        // replace the user's URL.
        if (binding.developmentBaseUrlSource === 'manual' && binding.developmentBaseUrl) {
            const health = await probeSite(binding.developmentBaseUrl);
            return {
                ...binding,
                status: health.reachable ? 'running' : 'stopped',
                pid: null,
                running: Boolean(health.reachable),
                sessionOwnership: binding.terminalSessionId ? 'paseo' : null,
                discovery: { state: health.reachable ? 'current' : 'none', baseUrl: health.reachable ? binding.developmentBaseUrl : null, candidates: [] },
            };
        }
        const discovery = await discoverSiteServer({ root: binding.root, previousBaseUrl: binding.developmentBaseUrl ?? null });
        if (discovery.baseUrl && discovery.baseUrl !== binding.developmentBaseUrl)
            store.upsertBinding(id, { developmentBaseUrl: discovery.baseUrl, developmentBaseUrlSource: 'discovered' });
        const current = store.getBinding(id);
        if (!current)
            return null;
        return {
            ...current,
            status: discovery.baseUrl ? 'running' : 'stopped',
            pid: null,
            running: Boolean(discovery.baseUrl),
            sessionOwnership: current.terminalSessionId ? 'paseo' : discovery.baseUrl ? 'adopted' : null,
            discovery,
        };
    }
    catch (error) {
        return { ...binding, status: 'error', running: false, error: error instanceof Error ? error.message : String(error), sessionOwnership: binding.terminalSessionId ? 'paseo' : null };
    }
}
try {
    let result;
    if (subcommand === 'list')
        result = { sites: await Promise.all(store.list().map(async (site) => ({ ...site, binding: await siteStatus(site.id) }))) };
    else if (subcommand === 'detect')
        result = detectSiteConfiguration(positional[0] || process.cwd());
    else if (subcommand === 'create' || subcommand === 'metadata') {
        const id = subcommand === 'metadata' ? positional[0] : null;
        const suppliedRoot = stringFlag('root') || (subcommand === 'create' ? positional[0] : null);
        const directory = suppliedRoot;
        if (subcommand === 'metadata' && !flags.root) {
            if (!id || !store.get(id))
                die(`Site not found: ${id}`);
            if (!Object.keys(flags).some(key => ['title', 'description', 'local-url', 'development-base-url', 'start', 'start-command', 'production', 'production-base-url', 'deploy-url'].includes(key)))
                die('Provide a Site field to edit');
            const title = flags.title === undefined ? undefined : String(flags.title).trim();
            const startCommand = startCommandFlag === undefined ? undefined : String(startCommandFlag).trim();
            if (flags.title && !title)
                die('Site name is required');
            if (startCommandFlag !== undefined && !startCommand)
                die('Dev command is required');
            const descriptorUpdates = {};
            if (title !== undefined)
                descriptorUpdates.title = title;
            if (flags.description !== undefined)
                descriptorUpdates.description = String(flags.description);
            if (productionBaseUrlFlag !== undefined)
                descriptorUpdates.productionBaseUrl = productionBaseUrlFlag;
            const site = Object.keys(descriptorUpdates).length
                ? store.upsert(updateSiteDescriptor(store.get(id), descriptorUpdates))
                : store.get(id);
            const bindingUpdates = {};
            if (startCommand !== undefined)
                bindingUpdates.startCommand = startCommand;
            if (developmentBaseUrlFlag !== undefined)
                bindingUpdates.developmentBaseUrl = developmentBaseUrlFlag;
            if (developmentBaseUrlFlag !== undefined)
                bindingUpdates.developmentBaseUrlSource = 'manual';
            result = { site, binding: Object.keys(bindingUpdates).length ? store.upsertBinding(id, bindingUpdates) : store.getBinding(id) };
        }
        else {
            if (!directory || (subcommand === 'create' && !flags.title) || (id && !store.get(id)))
                die('Site name and an existing directory are required');
            const selected = assertAvailableSiteRoot(store, directory, id);
            if (selected === notebookRoot)
                die('This directory is already registered as a Notebook');
            const paseoRuntime = id ? await initPaseoTerminalRuntime(notebookRoot) : null;
            const ptyRuntime = paseoRuntime ? adaptPaseoTerminalRuntime(paseoRuntime) : null;
            try {
                if (id) {
                    const runtime = new SiteRuntime(store, { ptyRuntime, requirePtyRuntime: true, reconcileOnStart: false, resolveNotebookWorkspaceId });
                    await runtime.ready;
                    await runtime.stop(id);
                }
                const workspaceId = await resolveNotebookWorkspaceId();
                const detection = detectSiteConfiguration(selected);
                const startCommand = startCommandFlag || detection.findings.find(item => item.kind === 'start-command')?.value || 'npm run dev';
                const localUrl = developmentBaseUrlFlag ?? detection.findings.find(item => item.kind === 'local-url')?.value ?? null;
                const titleFlag = stringFlag('title');
                const siteId = id || siteIdForTitle(titleFlag || 'site', store);
                const previous = id ? store.get(id) : { id: siteId, title: titleFlag };
                const descriptorUpdates = {
                    ...(flags.title !== undefined ? { title: String(flags.title).trim() } : {}),
                    ...(flags.description !== undefined ? { description: String(flags.description) } : {}),
                    ...(productionBaseUrlFlag !== undefined ? { productionBaseUrl: productionBaseUrlFlag } : {}),
                };
                const site = store.upsert(updateSiteDescriptor(previous, descriptorUpdates), { parentPath: stringFlag('parent') || '' });
                const binding = store.upsertBinding(site.id, {
                    source: 'managed', root: selected, workspaceId, startCommand, status: 'stopped', terminalSessionId: null,
                    developmentBaseUrl: localUrl,
                    ...(localUrl ? { developmentBaseUrlSource: developmentBaseUrlFlag ? 'manual' : 'discovered' } : {}),
                });
                result = { site, binding };
            }
            finally {
                await paseoRuntime?.shutdown();
            }
        }
    }
    else if (subcommand === 'add') {
        if (!positional[0])
            die('Usage: hypercanvas site add <id>');
        if (store.get(positional[0]))
            die(`Site already exists: ${positional[0]}`);
        const rootFlag = stringFlag('root');
        const externalRoot = rootFlag ? assertAvailableSiteRoot(store, rootFlag) : null;
        const title = stringFlag('title') || positional[0];
        const site = store.upsert(updateSiteDescriptor({ id: positional[0], title }, {
            title,
            ...(flags.description !== undefined ? { description: String(flags.description) } : {}),
            ...(productionBaseUrlFlag !== undefined ? { productionBaseUrl: productionBaseUrlFlag } : {}),
        }), { parentPath: stringFlag('parent') || '' });
        const bindingUpdates = {
            ...(externalRoot ? { root: externalRoot } : {}),
            ...(startCommandFlag ? { startCommand: startCommandFlag } : {}),
            ...(developmentBaseUrlFlag ? { developmentBaseUrl: developmentBaseUrlFlag, developmentBaseUrlSource: 'manual' } : {}),
        };
        const binding = Object.keys(bindingUpdates).length
            ? store.upsertBinding(site.id, { source: rootFlag || startCommandFlag ? 'managed' : 'url', ...bindingUpdates })
            : null;
        result = { site, ...(binding ? { binding } : {}) };
    }
    else if (subcommand === 'remove' || subcommand === 'delete') {
        const id = positional[0];
        if (!id || !store.get(id))
            die(`Site not found: ${id}`);
        if (hasNotebookManifest(notebookRoot) && flags.confirmed !== true) {
            die(`Removing Site "${id}" unregisters it from the Site descriptor file and leaves its external project intact. Re-run with --confirmed after reviewing this file.`);
        }
        const binding = store.getBinding(id);
        const siteEntry = store.listEntries().find(entry => entry.site.id === id);
        const paseoRuntime = binding?.terminalSessionId ? await initPaseoTerminalRuntime(notebookRoot) : null;
        const ptyRuntime = paseoRuntime ? adaptPaseoTerminalRuntime(paseoRuntime) : null;
        const runtime = new SiteRuntime(store, { ptyRuntime, requirePtyRuntime: false, reconcileOnStart: false });
        try {
            await runtime.stop(id);
            store.remove(id);
            unregisterNotebookPage(notebookRoot, { siteId: id });
            result = {
                success: true,
                deleted: id,
                files: [
                    siteEntry?.folderPath ? siteDescriptorRelativePath(siteEntry.folderPath) : path.relative(store.root, store.configPath),
                    ...(binding ? [siteConfigRelativePath(notebookRoot)] : []),
                ],
            };
        }
        finally {
            await runtime.close();
            await paseoRuntime?.shutdown();
        }
    }
    else if (subcommand === 'move') {
        const id = positional[0];
        const parentPath = stringFlag('parent');
        if (!id || parentPath === undefined)
            die('Usage: hypercanvas site move <id> --parent <notebook-folder>');
        const site = store.move(id, parentPath);
        result = { success: true, moved: site.id, site, folderPath: store.listEntries().find(entry => entry.site.id === site.id)?.folderPath };
    }
    else if (subcommand === 'status') {
        const id = positional[0];
        if (!id || !store.get(id))
            die(`Site not found: ${id}`);
        result = await siteStatus(id);
    }
    else if (subcommand === 'capture') {
        const siteId = positional[0];
        if (!siteId)
            die('Usage: hypercanvas site capture <id>');
        const site = store.get(siteId);
        const binding = store.getBinding(siteId);
        if (!site || !binding?.developmentBaseUrl)
            die(`Site is not running: ${positional[0]}`);
        const playwright = await import(/* @vite-ignore */ 'playwright').catch(() => null);
        if (!playwright)
            die('Site frame capture backend is unavailable in this Hypercanvas runtime. Reinstall or update Hypercanvas.');
        const { chromium } = playwright;
        const { captureSiteFrame, readSiteCapture } = await import('../site/capture.js');
        const { resolveSiteUrl } = await import('../site/contract.js');
        const reference = { siteId: site.id, route: stringFlag('route') || '', width: Number(flags.width) || 800, height: Number(flags.height) || 600 };
        const captureResult = await captureSiteFrame({
            notebookRoot,
            reference,
            developmentUrl: resolveSiteUrl(binding.developmentBaseUrl, reference.siteId, reference.route),
            bindingRevision: binding.revision ?? 0,
            captureAdapter: async ({ url, outputPath, viewport, colorScheme }) => {
                const browser = await chromium.launch({ headless: true });
                try {
                    const page = await browser.newPage({ viewport, colorScheme });
                    await page.goto(url, { waitUntil: 'networkidle' });
                    await page.screenshot({ path: outputPath });
                }
                finally {
                    await browser.close();
                }
            },
        });
        const capture = await readSiteCapture(notebookRoot, reference, { bindingRevision: binding.revision ?? 0 });
        result = { ...captureResult, capture };
    }
    else if (subcommand === 'logs')
        result = { logs: [] };
    else if (subcommand === 'start' || subcommand === 'run' || subcommand === 'stop' || subcommand === 'restart' || subcommand === 'discover' || subcommand === 'rebind') {
        if (!positional[0])
            die(`Usage: hypercanvas site ${subcommand} <id>`);
        if (subcommand === 'discover') {
            const binding = store.getBinding(positional[0]);
            if (!binding?.root)
                die(`Site requires a project root for discovery: ${positional[0]}`);
            // Explicit user-requested discovery may intentionally replace a manual
            // Local URL; provenance returns to `discovered`.
            const discovery = await discoverSiteServer({ root: binding.root, previousBaseUrl: binding.developmentBaseUrl ?? null });
            result = discovery;
            if (discovery.baseUrl)
                store.upsertBinding(positional[0], { developmentBaseUrl: discovery.baseUrl, developmentBaseUrlSource: 'discovered' });
        }
        else if (subcommand === 'rebind') {
            const binding = store.getBinding(positional[0]);
            if (!binding?.workspaceId)
                die(`Site requires a workspace binding: ${positional[0]}`);
            result = await rebindSite(store, positional[0], { workspaceId: binding.workspaceId, developmentBaseUrl: positional[1] });
        }
        else {
            const paseoRuntime = await initPaseoTerminalRuntime(notebookRoot);
            const ptyRuntime = adaptPaseoTerminalRuntime(paseoRuntime);
            try {
                const runtime = new SiteRuntime(store, { ptyRuntime, requirePtyRuntime: true, reconcileOnStart: false, resolveNotebookWorkspaceId });
                await runtime.ready;
                if (subcommand === 'start' || subcommand === 'run')
                    result = await runtime.start(positional[0], { confirmed: true });
                else if (subcommand === 'stop')
                    result = await runtime.stop(positional[0]);
                else
                    result = await runtime.restart(positional[0], { confirmed: Boolean(flags.confirmed) });
            }
            finally {
                await paseoRuntime.shutdown();
            }
        }
    }
    else
        die(`Unknown site subcommand: ${subcommand}`);
    const resultRecord = result !== null && typeof result === 'object' ? result : null;
    const resultSite = resultRecord?.site !== null && typeof resultRecord?.site === 'object' ? resultRecord.site : null;
    if (resultSite && typeof resultSite.id === 'string') {
        if (subcommand === 'metadata')
            updateNotebookPage(notebookRoot, { siteId: resultSite.id }, { title: typeof resultSite.title === 'string' ? resultSite.title : undefined });
        else if (subcommand === 'create' || subcommand === 'add')
            registerNotebookPage(notebookRoot, { type: 'site', siteId: resultSite.id, title: typeof resultSite.title === 'string' ? resultSite.title : '' });
    }
    if (flags.json)
        jsonOut(result);
    else
        console.log(JSON.stringify(result, null, 2));
}
catch (error) {
    die(error instanceof Error ? error.message : String(error));
}
