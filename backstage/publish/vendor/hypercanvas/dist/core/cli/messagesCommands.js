/**
 * storyboard messages — Low-level messaging bus CLI.
 *
 * Subcommands:
 *   storyboard messages publish --channel <ch> --type <type> --sender <id> [--body "text"] [--payload '{}']
 *   storyboard messages send --channel <ch> --type <type> --sender <id> [--body "text"] [--timeout 30000]
 *   storyboard messages read --channel <ch> [--since <ulid>] [--limit N] [--type <prefix>]
 *   storyboard messages batch --ops '{ "publish": [...], "read": [...] }'
 */
import { legacySessionEnv as legacyEnv } from '../envCompat.js';
import { parseSimpleArgs, jsonOut, die, post, get } from './cliHelpers.js';
const sub = process.argv[3];
const MESSAGING_BASE = '/_hypercanvas/messages';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function stringFlag(flags, name) {
    return typeof flags[name] === 'string' ? flags[name] : undefined;
}
function requiredStringFlag(flags, name) {
    const value = stringFlag(flags, name);
    if (!value)
        throw new Error(`--${name} is required`);
    return value;
}
function cliError(error, fallback) {
    return isRecord(error) && typeof error.message === 'string' ? error.message : fallback;
}
function parseCliArgs(args) {
    const parsed = parseSimpleArgs(args);
    return {
        positional: Array.isArray(parsed.positional) ? [...parsed.positional] : [],
        flags: isRecord(parsed.flags) ? parsed.flags : {},
    };
}
if (!sub || sub === '--help' || sub === '-h') {
    console.log(`
  messages subcommands:

    publish    Publish a single event to a channel
    send       Publish and wait for a correlated response
    read       Read events from a channel
    batch      Batch publish + read in one call

  Use --help on any subcommand for flags.
`);
    process.exit(0);
}
const args = process.argv.slice(4);
if (args.includes('--help') || args.includes('-h')) {
    const helpMap = {
        publish: `    --channel       Channel name (required)\n    --type          Event type (required)\n    --sender        Sender ID (required)\n    --body          Event body text\n    --payload       JSON payload\n    --status        Event status\n    --correlation   Correlation ID`,
        send: `    --channel       Channel name (required)\n    --type          Event type (required)\n    --sender        Sender ID (required)\n    --body          Event body text\n    --timeout       Timeout in ms [default: 30000]`,
        read: `    --channel       Channel name (required)\n    --since         ULID to read after\n    --limit         Max events to return\n    --type          Filter by type prefix`,
        batch: `    --ops           JSON with publish and/or read arrays (required)\n    --ops-file      Path to JSON file with operations`,
    };
    console.log(`\n  messages ${sub} flags:\n\n${helpMap[sub] || '    (see source)'}`);
    process.exit(0);
}
const { positional, flags } = parseCliArgs(args);
async function run() {
    switch (sub) {
        case 'publish': {
            const channel = requiredStringFlag(flags, 'channel');
            const type = stringFlag(flags, 'type');
            const senderId = stringFlag(flags, 'sender') || (process.env.HYPERCANVAS_WIDGET_ID ?? legacyEnv('STORYBOARD_WIDGET_ID'));
            const payload = { channel, senderId };
            if (type)
                payload.type = type;
            const body = stringFlag(flags, 'body');
            const status = stringFlag(flags, 'status');
            const correlation = stringFlag(flags, 'correlation');
            const rawPayload = stringFlag(flags, 'payload');
            if (body)
                payload.body = body;
            if (status)
                payload.status = status;
            if (correlation)
                payload.correlationId = correlation;
            if (rawPayload) {
                let parsed;
                try {
                    parsed = JSON.parse(rawPayload);
                }
                catch {
                    throw new Error('--payload must be valid JSON');
                }
                if (!isRecord(parsed))
                    throw new Error('--payload must be a JSON object');
                Object.assign(payload, parsed);
            }
            const data = await post(`${MESSAGING_BASE}/publish`, payload);
            jsonOut(data);
            break;
        }
        case 'send': {
            const channel = requiredStringFlag(flags, 'channel');
            const type = stringFlag(flags, 'type');
            const senderId = stringFlag(flags, 'sender') || (process.env.HYPERCANVAS_WIDGET_ID ?? legacyEnv('STORYBOARD_WIDGET_ID'));
            const payload = { channel, senderId };
            if (type)
                payload.type = type;
            const body = stringFlag(flags, 'body');
            const timeout = stringFlag(flags, 'timeout');
            if (body)
                payload.body = body;
            if (timeout)
                payload.timeout = parseInt(timeout, 10);
            const data = await post(`${MESSAGING_BASE}/send`, payload);
            jsonOut(data);
            break;
        }
        case 'read': {
            const channel = stringFlag(flags, 'channel') || positional[0];
            const channels = stringFlag(flags, 'channels');
            if (!channel && !channels)
                die('--channel or --channels is required');
            const params = [];
            if (channel)
                params.push(`channel=${encodeURIComponent(channel)}`);
            if (channels)
                params.push(`channels=${encodeURIComponent(channels)}`);
            const since = stringFlag(flags, 'since');
            const limit = stringFlag(flags, 'limit');
            const type = stringFlag(flags, 'type');
            if (since)
                params.push(`since=${encodeURIComponent(since)}`);
            if (limit)
                params.push(`limit=${encodeURIComponent(limit)}`);
            if (type)
                params.push(`type=${encodeURIComponent(type)}`);
            const data = await get(`${MESSAGING_BASE}/read?${params.join('&')}`);
            jsonOut(data);
            break;
        }
        case 'batch': {
            let ops;
            const opsFile = stringFlag(flags, 'ops-file');
            const opsValue = stringFlag(flags, 'ops');
            if (opsFile) {
                const { readFileSync } = await import('node:fs');
                try {
                    ops = JSON.parse(readFileSync(opsFile, 'utf8'));
                }
                catch (error) {
                    throw new Error(`Failed to read ops file: ${cliError(error, 'Unable to read file')}`);
                }
            }
            else if (opsValue) {
                try {
                    ops = JSON.parse(opsValue);
                }
                catch {
                    throw new Error('--ops must be valid JSON');
                }
            }
            else {
                throw new Error('--ops or --ops-file is required');
            }
            if (!isRecord(ops))
                throw new Error('Batch operations must be a JSON object');
            const data = await post(`${MESSAGING_BASE}/batch`, ops);
            jsonOut(data);
            break;
        }
        default:
            die(`Unknown messages subcommand: ${sub}. Use --help for a list.`);
    }
}
run().catch((error) => die(cliError(error, 'Messaging command failed')));
