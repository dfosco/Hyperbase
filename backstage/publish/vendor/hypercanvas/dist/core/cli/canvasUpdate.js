/**
 * storyboard canvas update <widget-id> — Update a widget's props or position.
 *
 * Usage:
 *   storyboard canvas update <widget-id> --canvas my-canvas --text "New text"
 *   storyboard canvas update <widget-id> --canvas my-canvas --content "# Markdown"
 *   storyboard canvas update <widget-id> --canvas my-canvas --props '{"key":"value"}'
 *   storyboard canvas update <widget-id> --canvas my-canvas --x 100 --y 200
 *
 * Shorthand flags (merged into props):
 *   --text <string>       Set props.text (sticky notes)
 *   --content <string>    Set props.content (markdown blocks)
 *   --src <string>        Set props.src (images, prototypes)
 *   --url <string>        Set props.url (link previews, embeds)
 *   --color <string>      Set props.color (sticky notes)
 *
 * Position flags:
 *   --x <number>          Move widget to x position
 *   --y <number>          Move widget to y position
 */
import * as p from '@clack/prompts';
import { getServerUrl } from './serverUrl.js';
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
async function checkServer() {
    try {
        await fetch(`${getServerUrl()}/_hypercanvas/canvas/list`, { signal: AbortSignal.timeout(2000) });
        return true;
    }
    catch {
        return false;
    }
}
async function serverPatch(path, body) {
    const base = getServerUrl();
    const res = await fetch(`${base}${path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`${res.status} ${res.statusText}${text ? ': ' + text : ''}`);
    }
    return res.json();
}
async function canvasUpdate() {
    const args = process.argv.slice(4);
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
  canvas update — Update a widget's props or position

  Usage:
    storyboard canvas update <widget-id> --canvas <name> [flags]

  Shorthand flags (merged into props):
    --text <string>       Set props.text (sticky notes)
    --content <string>    Set props.content (markdown blocks)
    --src <string>        Set props.src (images, prototypes)
    --url <string>        Set props.url (link previews, embeds)
    --color <string>      Set props.color (sticky notes)
    --props <json>        Set arbitrary props as JSON

  Position flags:
    --x <number>          Move widget to x position
    --y <number>          Move widget to y position

  Options:
    --canvas <name>       Canvas name ${dim('(required)')}
    --json                Output result as JSON
`);
        process.exit(0);
    }
    // Parse args
    let widgetId = '';
    let canvasName = '';
    let outputJson = false;
    let rawProps = '';
    const shorthandProps = {};
    let posX;
    let posY;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === undefined)
            continue;
        const value = args[i + 1];
        if (arg === '--canvas' && value) {
            canvasName = value;
            i++;
        }
        else if (arg === '--json') {
            outputJson = true;
        }
        else if (arg === '--props' && value) {
            rawProps = value;
            i++;
        }
        else if (arg === '--text' && value) {
            shorthandProps.text = value;
            i++;
        }
        else if (arg === '--content' && value) {
            shorthandProps.content = value;
            i++;
        }
        else if (arg === '--src' && value) {
            shorthandProps.src = value;
            i++;
        }
        else if (arg === '--url' && value) {
            shorthandProps.url = value;
            i++;
        }
        else if (arg === '--color' && value) {
            shorthandProps.color = value;
            i++;
        }
        else if (arg === '--x' && value) {
            posX = Number(value);
            i++;
        }
        else if (arg === '--y' && value) {
            posY = Number(value);
            i++;
        }
        else if (!arg.startsWith('-') && !widgetId) {
            widgetId = arg;
        }
    }
    if (!widgetId) {
        p.log.error('Widget ID is required. Usage: hypercanvas canvas update <widget-id> --canvas <name>');
        process.exit(1);
    }
    if (!canvasName) {
        p.log.error('Canvas name is required. Use --canvas <name>');
        process.exit(1);
    }
    // Build props
    let props = {};
    if (rawProps) {
        try {
            props = JSON.parse(rawProps);
        }
        catch {
            p.log.error('--props must be valid JSON');
            process.exit(1);
        }
    }
    Object.assign(props, shorthandProps);
    // Build position
    let position;
    if (posX !== undefined || posY !== undefined) {
        position = {};
        if (posX !== undefined)
            position.x = posX;
        if (posY !== undefined)
            position.y = posY;
    }
    if (Object.keys(props).length === 0 && !position) {
        p.log.error('Nothing to update. Provide --props, --text, --content, --x, --y, or other flags.');
        process.exit(1);
    }
    // Check server
    const serverUp = await checkServer();
    if (!serverUp) {
        p.log.error('Dev server is not running. Start it with: hypercanvas dev');
        process.exit(1);
    }
    try {
        const body = { name: canvasName, widgetId };
        if (Object.keys(props).length > 0)
            body.props = props;
        if (position)
            body.position = position;
        const result = await serverPatch('/_hypercanvas/canvas/widget', body);
        if (outputJson) {
            console.log(JSON.stringify(result, null, 2));
        }
        else {
            const updates = [];
            if (Object.keys(props).length > 0)
                updates.push(`props: ${Object.keys(props).join(', ')}`);
            if (position)
                updates.push(`position: ${posX ?? '·'}, ${posY ?? '·'}`);
            p.log.success(`Updated ${bold(widgetId)} in ${bold(canvasName)} (${updates.join('; ')})`);
        }
    }
    catch (err) {
        p.log.error(`Failed to update widget: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }
}
canvasUpdate();
