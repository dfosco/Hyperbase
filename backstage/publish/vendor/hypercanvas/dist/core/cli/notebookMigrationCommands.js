import { getServerUrl } from './serverUrl.js';
const API = '/_hypercanvas/notebook/migration';
export const notebookMigrationHelp = [
    'Usage: hypercanvas notebook migration preview --notebook-id <id> --generation <n> --expected-revision <sha256> [--json]',
    '  hypercanvas notebook migration apply --notebook-id <id> --generation <n> --expected-revision <sha256> --plan-id <id> --plan-digest <sha256> [--accept-route-changes] [--json]',
    '  hypercanvas notebook migration recover --notebook-id <id> --generation <n> --migration-id <id> --expected-journal-revision <sha256> --action resume|rollback [--json]',
].join('\n');
function parse(args) {
    const flags = {};
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (!token?.startsWith('--'))
            throw new Error(notebookMigrationHelp);
        const key = token.slice(2);
        if (['json', 'accept-route-changes'].includes(key)) {
            flags[key] = true;
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
function defaultApi() {
    return {
        async post(route, body) {
            const response = await fetch(`${getServerUrl()}${route}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
                signal: AbortSignal.timeout(15000),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const error = new Error('Notebook migration request failed.');
                error.status = response.status;
                error.responseBody = data;
                throw error;
            }
            return data;
        },
    };
}
/** CLI flags mirror the guarded migration request fields exactly. */
export async function runNotebookMigrationCommand(args, api = defaultApi()) {
    const [action, ...rest] = args;
    if (!['preview', 'apply', 'recover'].includes(action || ''))
        throw new Error(notebookMigrationHelp);
    const flags = parse(rest);
    const allowed = new Set(['json', 'notebook-id', 'generation', 'expected-revision',
        ...(action === 'apply' ? ['plan-id', 'plan-digest', 'accept-route-changes'] : []),
        ...(action === 'recover' ? ['migration-id', 'expected-journal-revision', 'action'] : [])]);
    if (Object.keys(flags).some(key => !allowed.has(key)))
        throw new Error(notebookMigrationHelp);
    const required = action === 'preview' ? ['notebook-id', 'generation', 'expected-revision']
        : action === 'apply' ? ['notebook-id', 'generation', 'expected-revision', 'plan-id', 'plan-digest']
            : ['notebook-id', 'generation', 'migration-id', 'expected-journal-revision', 'action'];
    if (required.some(key => typeof flags[key] !== 'string' || !flags[key].trim()))
        throw new Error(notebookMigrationHelp);
    const generation = Number(flags.generation);
    if (!Number.isSafeInteger(generation) || generation < 0)
        throw new Error('--generation must be a nonnegative integer');
    if (action === 'recover' && flags.action !== 'resume' && flags.action !== 'rollback')
        throw new Error('--action must be resume or rollback');
    const base = { notebookId: flags['notebook-id'], generation };
    if (action === 'preview')
        return api.post(`${API}/preview`, { ...base, expectedRevision: flags['expected-revision'] });
    if (action === 'apply')
        return api.post(`${API}/apply`, {
            ...base,
            expectedRevision: flags['expected-revision'],
            planId: flags['plan-id'],
            planDigest: flags['plan-digest'],
            acceptRouteChanges: flags['accept-route-changes'] === true,
        });
    return api.post(`${API}/recover`, {
        ...base,
        migrationId: flags['migration-id'],
        expectedJournalRevision: flags['expected-journal-revision'],
        action: flags.action,
    });
}
export function isMigrationCliError(error) {
    return error instanceof Error && 'responseBody' in error;
}
