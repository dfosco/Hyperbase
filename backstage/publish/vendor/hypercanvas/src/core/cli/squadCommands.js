/** storyboard squad — create Squads and append/read numbered ledger entries. */
import { legacySessionEnv as legacyEnv } from '../envCompat.js';
import { parseSimpleArgs, jsonOut, die, post, get } from './cliHelpers.js';
const sub = process.argv[3];
const args = process.argv.slice(4);
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function stringFlag(flags, name) {
    return typeof flags[name] === 'string' ? flags[name] : undefined;
}
function parseCliArgs(values) {
    const parsed = parseSimpleArgs(values);
    return {
        positional: Array.isArray(parsed.positional) ? [...parsed.positional] : [],
        flags: isRecord(parsed.flags) ? parsed.flags : {},
    };
}
function cliError(error) {
    return isRecord(error) && typeof error.message === 'string' ? error.message : String(error);
}
const { positional, flags } = parseCliArgs(args);
const base = '/_hypercanvas/messages';
const widgetId = (process.env.HYPERCANVAS_WIDGET_ID ?? legacyEnv('STORYBOARD_WIDGET_ID'));
if (!sub || sub === '--help' || sub === '-h') {
    console.log(`\n  squad subcommands:\n\n    create [name] [--members <id,id>]    Create a Squad and connect its peers [--canvas <id>]\n    broadcast --canvas <id> --enabled <true|false> [--widget <id>] [--squad <id>]\n                                           Toggle communicating hub / visual-only links\n    reply <squad-id> <number> --response <ack|status|result|blocked> --description <text>\n                                           Write a numbered information reply\n    list                                   List Squads this widget belongs to\n    append <squad-id> --kind <kind> --description <text> [options]\n    read <squad-id> [--after <number>] [--limit <number>]\n    reconcile <squad-id>                   Reconcile assigned work and replies\n    get <squad-id> <number>\n    deliver <squad-id> <number> [--force]  Retry requested delivery without appending\n    promote <squad-id> <target-widget-id>  Promote a Squad leader\n    nudge <squad-id> <target-widget-id>    Inject an explicit reconciliation nudge\n\n  append options: --to <member,member> --inject --attachments <json> --files <json>\n                  --reply-to <number> --response <ack|status|result|blocked>\n`);
    process.exit(0);
}
function requireWidget() {
    if (!widgetId)
        throw new Error('HYPERCANVAS_WIDGET_ID is required');
    return widgetId;
}
function query(squadId = null) {
    const params = new URLSearchParams();
    params.set('widgetId', requireWidget());
    if (squadId)
        params.set('squadId', squadId);
    return params.toString();
}
function parseJsonFlag(name, fallback) {
    if (flags[name] === undefined)
        return fallback;
    const value = flags[name];
    if (typeof value !== 'string')
        throw new Error(`--${name} must be valid JSON`);
    try {
        const parsed = JSON.parse(value);
        return parsed;
    }
    catch {
        throw new Error(`--${name} must be valid JSON`);
    }
}
async function run() {
    if (sub === 'broadcast') {
        const enabled = stringFlag(flags, 'enabled') ?? flags.enabled;
        const canvasId = stringFlag(flags, 'canvas') || process.env.HYPERCANVAS_CANVAS_ID;
        if (!canvasId || !['true', 'false', true, false].includes(enabled))
            throw new Error('--canvas and --enabled true|false are required');
        return jsonOut(await post(`${base}/broadcast`, {
            canvasId, widgetId: stringFlag(flags, 'widget') || requireWidget(), enabled: enabled === true || enabled === 'true',
            ...(stringFlag(flags, 'squad') ? { squadId: stringFlag(flags, 'squad') } : {}),
        }));
    }
    if (sub === 'create') {
        const name = stringFlag(flags, 'name') || positional.join(' ') || undefined;
        const canvasId = stringFlag(flags, 'canvas') || process.env.HYPERCANVAS_CANVAS_ID;
        const members = stringFlag(flags, 'members');
        const memberIds = members ? members.split(',').map((value) => value.trim()).filter(Boolean) : [];
        return jsonOut(await post(`${base}/squads?${query()}`, { widgetId: requireWidget(), memberIds, ...(name ? { name } : {}), ...(canvasId ? { canvasId } : {}) }));
    }
    if (sub === 'list')
        return jsonOut(await get(`${base}/squads?${query()}`));
    if (sub === 'append' || sub === 'reply') {
        const squadId = positional[0];
        if (!squadId)
            die('Usage: hypercanvas squad append <squad-id> --kind <kind> --description <text>');
        const kind = sub === 'reply' ? 'information' : stringFlag(flags, 'kind');
        const description = stringFlag(flags, 'description');
        if (!kind || !description)
            throw new Error('--kind and --description are required');
        const message = { kind, description };
        const recipients = stringFlag(flags, 'to');
        if (recipients)
            message.to = recipients.split(',').map((value) => value.trim()).filter(Boolean);
        if (flags.inject === true || flags.inject === 'true')
            message.inject = true;
        if (flags.inject === false || flags.inject === 'false')
            message.inject = false;
        if (flags.attachments !== undefined)
            message.attachments = parseJsonFlag('attachments', []);
        if (flags.files !== undefined)
            message.files = parseJsonFlag('files', []);
        if (flags['reply-to'] !== undefined)
            message.replyTo = Number(flags['reply-to']);
        if (flags.response !== undefined)
            message.response = flags.response;
        if (sub === 'reply') {
            if (!positional[1] || !stringFlag(flags, 'response'))
                throw new Error('reply requires a committed number and --response ack|status|result|blocked');
            message.replyTo = Number(positional[1]);
        }
        return jsonOut(await post(`${base}/squad/${encodeURIComponent(squadId)}/entry?${query()}`, message));
    }
    if (sub === 'read') {
        const squadId = positional[0];
        if (!squadId)
            die('Usage: hypercanvas squad read <squad-id> [--after <number>] [--limit <number>]');
        const params = new URLSearchParams(query(squadId));
        const after = stringFlag(flags, 'after');
        const limit = stringFlag(flags, 'limit');
        if (after !== undefined)
            params.set('after', after);
        if (limit !== undefined)
            params.set('limit', limit);
        return jsonOut(await get(`${base}/squad/${encodeURIComponent(squadId)}/room?${params}`));
    }
    if (sub === 'reconcile') {
        const squadId = positional[0];
        if (!squadId)
            die('Usage: hypercanvas squad reconcile <squad-id>');
        return jsonOut(await get(`${base}/squad/${encodeURIComponent(squadId)}/reconcile?${query(squadId)}`));
    }
    if (sub === 'get') {
        const [squadId, number] = positional;
        if (!squadId || !number)
            die('Usage: hypercanvas squad get <squad-id> <number>');
        return jsonOut(await get(`${base}/squad/${encodeURIComponent(squadId)}/entry/${encodeURIComponent(number)}?${query(squadId)}`));
    }
    if (sub === 'deliver') {
        const [squadId, number] = positional;
        if (!squadId || !number || !Number.isSafeInteger(Number(number)) || Number(number) < 1) {
            die('Usage: hypercanvas squad deliver <squad-id> <number> [--force]');
        }
        return jsonOut(await post(`${base}/squad/${encodeURIComponent(squadId)}/entry/${encodeURIComponent(number)}/deliver?${query(squadId)}`, { force: flags.force === true }));
    }
    if (sub === 'promote') {
        const [squadId, targetWidgetId] = positional;
        if (!squadId || !targetWidgetId)
            die('Usage: hypercanvas squad promote <squad-id> <target-widget-id>');
        return jsonOut(await post(`${base}/squad/${encodeURIComponent(squadId)}/leader?${query(squadId)}`, { targetWidgetId }));
    }
    if (sub === 'nudge') {
        const [squadId, targetWidgetId] = positional;
        if (!squadId || !targetWidgetId)
            die('Usage: hypercanvas squad nudge <squad-id> <target-widget-id> [--description <text>]');
        const description = stringFlag(flags, 'description');
        return jsonOut(await post(`${base}/squad/${encodeURIComponent(squadId)}/nudge?${query(squadId)}`, {
            targetWidgetId,
            ...(description ? { description } : {}),
        }));
    }
    die(`Unknown squad subcommand: ${sub}`);
}
run().catch((error) => die(cliError(error)));
