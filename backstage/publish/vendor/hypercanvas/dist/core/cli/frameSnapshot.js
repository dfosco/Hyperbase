/**
 * `hypercanvas canvas frame-snapshot` — read, capture, capability.
 *
 * 1:1 with the Core Frame snapshot API (`/_hypercanvas/frame-snapshot`):
 * fields map exactly to the route parameters (kind, source route or Site ID,
 * dimensions, zoom, theme, force).
 */
import { die, jsonOut, parseSimpleArgs } from './cliHelpers.js';
import { resolveNotebookRoot } from './filesystemRoots.js';
import { SiteStore } from '../site/site.js';
import { resolveSiteDevelopmentUrl } from '../site/contract.js';
import { createFrameSnapshotCapture, closeFrameSnapshotBrowser } from '../canvas/frameSnapshotCapture.js';
import { frameSnapshotSourceKey, normalizeFrameSnapshotTarget } from '../canvas/frameSnapshotContract.js';
import { readFrameSnapshot } from '../canvas/frameSnapshotStore.js';
const usage = 'Usage: hypercanvas canvas frame-snapshot read --kind prototype --src /MyProto/page [--zoom 100] [--width <px>] [--height <px>] [--theme light|dark] | read --kind site --site-id <id> [--route <route>] | capture ... [--theme light|dark|both] [--force] | capability';
function flagText(...values) {
    return values.find((value) => typeof value === 'string' && value.length > 0);
}
const subcommand = process.argv[4];
const { flags } = parseSimpleArgs(process.argv.slice(5));
if (!subcommand || flags.help || flags.h) {
    console.log(usage);
    process.exit(0);
}
try {
    const notebookRoot = resolveNotebookRoot(flagText(flags.notebook));
    const siteStore = new SiteStore(notebookRoot);
    const capture = createFrameSnapshotCapture({
        notebookRoot,
        resolveSiteUrl: (siteId, route) => {
            const binding = siteStore.getBinding(siteId);
            if (!binding?.developmentBaseUrl) {
                throw Object.assign(new Error(`Site is not running: ${siteId}`), { code: 'SITE_NOT_RUNNING' });
            }
            return resolveSiteDevelopmentUrl(binding.developmentBaseUrl, route);
        },
    });
    const targetInput = {
        kind: flagText(flags.kind),
        src: flagText(flags.src),
        siteId: flagText(flags['site-id'], flags.siteId, flags.site),
        route: flagText(flags.route) ?? '',
        width: flagText(flags.width),
        height: flagText(flags.height),
        zoom: flagText(flags.zoom),
    };
    let result;
    if (subcommand === 'capability') {
        let available = false;
        let message = 'Frame capture browser is not installed. Run: npx playwright install chromium';
        try {
            const playwright = await import('playwright');
            available = Boolean(playwright?.chromium);
            if (available)
                message = 'Frame capture browser is available';
        }
        catch { /* playwright is an optional peer dependency */ }
        result = { capability: { available, browser: 'chromium', message } };
    }
    else if (subcommand === 'read') {
        if (!flags.kind)
            die('Kind is required: --kind prototype | site');
        const sourceKey = frameSnapshotSourceKey(normalizeFrameSnapshotTarget(targetInput));
        result = { snapshot: await readFrameSnapshot(notebookRoot, sourceKey) };
    }
    else if (subcommand === 'capture') {
        if (!flags.kind)
            die('Kind is required: --kind prototype | site');
        const widgetId = flagText(flags['widget-id']);
        result = { snapshot: await capture.capture(targetInput, {
                theme: flagText(flags.theme) || 'light',
                force: flags.force === true,
                identity: widgetId ? { widgetId } : {},
            }) };
    }
    else {
        die(`Unknown frame-snapshot subcommand: ${subcommand}`);
    }
    // CLI parity with the API: both return the same snapshot payload.
    jsonOut(result);
    await closeFrameSnapshotBrowser();
}
catch (error) {
    die(error instanceof Error ? error.message : String(error));
}
