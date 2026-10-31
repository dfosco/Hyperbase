import { getServerUrl } from './serverUrl.js';
const API = '/_hypercanvas/notebook/repair';
export const notebookRepairHelp = [
    'Usage: hypercanvas notebook repair --notebook-id <id> --generation <n> --expected-revision <sha256>',
    '  --nested-kind <kind> --nested-path <path> --containing-kind <kind> --containing-path <path>',
    '  --expected-destination <path> [--json]',
].join('\n');
function parseFlags(args) {
    const flags = {};
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (!token?.startsWith('--'))
            throw new Error(notebookRepairHelp);
        const key = token.slice(2);
        if (key === 'json') {
            flags.json = true;
            continue;
        }
        const value = args[index + 1];
        if (!value || value.startsWith('--'))
            throw new Error(`Missing value for ${token}`);
        flags[key] = value;
        index += 1;
    }
    return flags;
}
function defaultRequest() {
    return {
        async post(route, body) {
            const base = getServerUrl();
            const response = await fetch(`${base}${route}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(15000),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const error = new Error('Notebook artifact repair failed.');
                error.status = response.status;
                error.responseBody = data;
                throw error;
            }
            return data;
        },
    };
}
/** Call the guarded repair endpoint with a 1:1 mapping from CLI flags to request fields. */
export async function runNotebookRepairCommand(args, request = defaultRequest()) {
    const flags = parseFlags(args);
    const required = ['notebook-id', 'generation', 'expected-revision', 'nested-kind', 'nested-path', 'containing-kind', 'containing-path', 'expected-destination'];
    if (Object.keys(flags).some(key => key !== 'json' && !required.includes(key))
        || required.some(key => typeof flags[key] !== 'string' || !flags[key].trim())) {
        throw new Error(notebookRepairHelp);
    }
    const generation = Number(flags.generation);
    if (!Number.isSafeInteger(generation) || generation < 0)
        throw new Error('--generation must be a nonnegative integer');
    const kinds = ['prototype', 'component', 'canvas', 'site'];
    if (!kinds.includes(String(flags['nested-kind'])) || !kinds.includes(String(flags['containing-kind']))) {
        throw new Error('--nested-kind and --containing-kind must be prototype, component, canvas, or site');
    }
    return request.post(API, {
        notebookId: flags['notebook-id'],
        generation,
        expectedRevision: flags['expected-revision'],
        nestedArtifact: { kind: flags['nested-kind'], path: flags['nested-path'] },
        containingArtifact: { kind: flags['containing-kind'], path: flags['containing-path'] },
        expectedProposedDestination: flags['expected-destination'],
    });
}
