/**
 * storyboard canvas add <widget-type> — Add a widget to an existing canvas.
 *
 * Widgets are auto-positioned by default near (in priority order):
 * 1. The active agent/terminal running the command ($STORYBOARD_WIDGET_ID)
 * 2. The user's currently selected widget
 * 3. The center of the user's viewport
 * 4. The last widget on the canvas
 *
 * Use --x/--y for explicit coordinates, or --near <widget-id> to place
 * relative to a specific widget. Use --near false to opt out entirely.
 *
 * Usage:
 *   storyboard canvas add sticky-note --canvas my-canvas
 *   storyboard canvas add markdown --canvas my-canvas --near widget-abc
 *   storyboard canvas add prototype --canvas my-canvas --x 100 --y 200
 *   storyboard canvas add sticky-note --canvas my-canvas --near false --x 0 --y 0
 *
 * Known widget types: sticky-note, markdown, prototype
 * The server accepts any type string — new widget types work automatically.
 */
import fs from 'node:fs';
import { legacySessionEnv as legacyEnv } from '../envCompat.js';
import * as p from '@clack/prompts';
import { parseFlags, hasFlags, formatFlagHelp } from './flags.js';
import { widgetSchema } from './schemas.js';
import { ensureDevServer, serverPost, getServerUrl } from './create.js';
const KNOWN_TYPES = ['sticky-note', 'markdown', 'prototype', 'story'];
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function errorMessage(error) { return error instanceof Error ? error.message : String(error); }
async function canvasAdd() {
    // argv: storyboard canvas add [type] [--flags]
    // process.argv: [node, script, 'canvas', 'add', ...rest]
    const rest = process.argv.slice(4);
    if (rest.includes('--help') || rest.includes('-h')) {
        console.log(`\n  canvas add flags:\n`);
        console.log(`  Positional: <widget-type>  Widget type (${KNOWN_TYPES.join(', ')})\n`);
        console.log(formatFlagHelp(widgetSchema));
        console.log('');
        process.exit(0);
    }
    // Extract positional widget type (first non-flag arg)
    let widgetType = '';
    const flagTokens = [];
    for (const token of rest) {
        if (!widgetType && !token.startsWith('-')) {
            widgetType = token;
        }
        else {
            flagTokens.push(token);
        }
    }
    const flagMode = hasFlags(rest) || Boolean(widgetType);
    const parsed = flagMode ? parseFlags(flagTokens, widgetSchema) : { flags: {}, errors: [] };
    const flags = parsed.flags;
    const errors = parsed.errors;
    const jsonOutput = Boolean(flags.json);
    if (errors.length) {
        for (const e of errors)
            p.log.error(e);
        process.exit(1);
    }
    if (!jsonOutput)
        p.intro('storyboard canvas add');
    await ensureDevServer({ quiet: jsonOutput });
    // Widget type
    if (!widgetType) {
        const selected = await p.select({
            message: 'Widget type',
            options: KNOWN_TYPES.map((t) => ({ value: t, label: t })),
        });
        if (p.isCancel(selected))
            return process.exit(0);
        widgetType = String(selected);
    }
    // Canvas name
    const canvasName = (typeof flags.canvas === 'string' ? flags.canvas : '') || await (async () => {
        // Try to fetch available canvases
        let canvases = [];
        try {
            const base = getServerUrl();
            const res = await fetch(`${base}/_hypercanvas/canvas/list`);
            if (res.ok) {
                const payload = await res.json();
                const data = isRecord(payload) ? payload : {};
                const values = data.canvases || payload || [];
                canvases = Array.isArray(values) ? values : [];
            }
        }
        catch { /* empty */ }
        if (canvases.length > 0) {
            const choice = await p.select({
                message: 'Canvas',
                options: canvases.map((c) => ({ value: c.name || String(c), label: c.name || String(c) })),
            });
            if (p.isCancel(choice))
                process.exit(0);
            return String(choice);
        }
        const v = await p.text({
            message: 'Canvas name',
            placeholder: 'my-canvas',
            validate: (v) => { if (!v)
                return 'Canvas name is required'; },
        });
        if (p.isCancel(v))
            process.exit(0);
        return String(v);
    })();
    // Position flags: only send explicit position if user provided --x/--y.
    // --near=false explicitly opts out of auto-positioning.
    const hasExplicitX = typeof flags.x === 'number';
    const hasExplicitY = typeof flags.y === 'number';
    const hasExplicitPosition = hasExplicitX || hasExplicitY;
    const x = typeof flags.x === 'number' ? flags.x : 0;
    const y = typeof flags.y === 'number' ? flags.y : 0;
    // --near: string widget ID, or literal "false" to opt out
    const nearRaw = flags.near;
    const nearOptOut = nearRaw === 'false' || nearRaw === false;
    const near = typeof nearRaw === 'string' && nearRaw && !nearOptOut ? nearRaw : null;
    const direction = typeof flags.direction === 'string' ? flags.direction : 'right';
    const gap = flags.gap != null ? Number(flags.gap) : undefined;
    const resolve = Boolean(flags.resolve || near);
    // Pass the calling agent/terminal's widget ID so the server can auto-position near it
    const source = (process.env.HYPERCANVAS_WIDGET_ID ?? legacyEnv('STORYBOARD_WIDGET_ID')) || null;
    let props = {};
    if (typeof flags['props-file'] === 'string') {
        try {
            const raw = fs.readFileSync(flags['props-file'], 'utf8');
            props = JSON.parse(raw);
        }
        catch (err) {
            p.log.error(`--props-file: ${errorMessage(err)}`);
            process.exit(1);
        }
    }
    else if (typeof flags.props === 'string') {
        try {
            props = JSON.parse(flags.props);
        }
        catch {
            p.log.error('--props must be valid JSON');
            process.exit(1);
        }
    }
    // --name sets the alias prop on agent/terminal widgets
    if (flags.name) {
        props.alias = flags.name;
    }
    // Story-specific: prompt for storyId and exportName if not in --props
    if (widgetType === 'story' && !props.storyId) {
        // Try to fetch available stories from the dev server
        let stories = [];
        try {
            const base = getServerUrl();
            const res = await fetch(`${base}/_hypercanvas/stories/list`);
            if (res.ok) {
                const payload = await res.json();
                const data = isRecord(payload) ? payload : {};
                stories = Array.isArray(data.stories) ? data.stories : [];
            }
        }
        catch { /* empty */ }
        if (stories.length > 0) {
            const storyId = await (async () => {
                const choice = await p.select({
                    message: 'Story',
                    options: stories.map((s) => ({ value: s.name, label: s.name, hint: s.route || '' })),
                });
                if (p.isCancel(choice))
                    process.exit(0);
                return String(choice);
            })();
            props.storyId = storyId;
        }
        else {
            const storyId = await (async () => {
                const v = await p.text({
                    message: 'Story ID',
                    placeholder: 'button-patterns',
                    validate: (v) => { if (!v)
                        return 'Story ID is required'; },
                });
                if (p.isCancel(v))
                    process.exit(0);
                return String(v);
            })();
            props.storyId = storyId;
        }
        if (!props.exportName) {
            const exportName = await (async () => {
                const v = await p.text({
                    message: 'Export name (leave empty for all)',
                    placeholder: 'Default',
                });
                if (p.isCancel(v))
                    process.exit(0);
                return String(v);
            })();
            if (exportName)
                props.exportName = exportName;
        }
        if (!props.width)
            props.width = 600;
        if (!props.height)
            props.height = 400;
    }
    // Submit
    if (jsonOutput) {
        // JSON mode: no spinners/clack UI, just raw JSON output for scripting
        try {
            const body = { name: canvasName, type: widgetType, props };
            if (hasExplicitPosition)
                body.position = { x, y };
            if (nearOptOut)
                body.near = false;
            if (near) {
                body.near = near;
                body.direction = direction;
            }
            if (gap != null)
                body.gap = gap;
            if (resolve)
                body.resolve = true;
            if (source)
                body.source = source;
            const result = await serverPost('/_hypercanvas/canvas/widget', body);
            const widget = result.widget || result;
            console.log(JSON.stringify(widget));
        }
        catch (err) {
            console.error(JSON.stringify({ error: errorMessage(err) }));
            process.exit(1);
        }
        return;
    }
    const s = p.spinner();
    s.start(`Adding ${widgetType} widget`);
    try {
        const body = { name: canvasName, type: widgetType, props };
        if (hasExplicitPosition)
            body.position = { x, y };
        if (nearOptOut)
            body.near = false;
        if (near) {
            body.near = near;
            body.direction = direction;
        }
        if (gap != null)
            body.gap = gap;
        if (resolve)
            body.resolve = true;
        if (source)
            body.source = source;
        const result = await serverPost('/_hypercanvas/canvas/widget', body);
        s.stop(`Widget added!`);
        const resultWidget = isRecord(result.widget) ? result.widget : {};
        const widgetId = resultWidget.id || result.id;
        if (widgetId) {
            p.log.success(`  ${widgetType} → ${canvasName} (id: ${widgetId})`);
        }
        else {
            p.log.success(`  ${widgetType} → ${canvasName}`);
        }
        p.outro('');
    }
    catch (err) {
        s.stop('Failed to add widget');
        p.log.error(errorMessage(err));
        p.outro('');
    }
}
canvasAdd();
