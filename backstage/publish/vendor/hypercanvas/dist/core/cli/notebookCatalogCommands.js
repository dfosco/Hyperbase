import { get, post } from './cliHelpers.js';
const API = '/_hypercanvas/notebook';
export const notebookCatalogHelp = [
    '  storyboard notebook branch [--json]',
    '  storyboard notebook pages [--json]',
    '  storyboard notebook metadata update --notebook-id <id> --generation <n> --expected-revision <sha256> --title <name> --description <text>',
    '  storyboard notebook navigation read [--json]',
    '  storyboard notebook navigation update --notebook-id <id> --generation <n> --expected-revision <sha256> --operation <json>',
].join('\n');
/** Read the live primary-page catalog or inspect/apply a guarded layout operation. */
export async function runNotebookCatalogCommand(args, request = { get, post }) {
    const [command, ...rest] = args;
    if (command === 'branch' && rest.every(flag => flag === '--json'))
        return request.get(`${API}/branch`);
    if (command === 'pages' && rest.every(flag => flag === '--json'))
        return request.get(`${API}/pages`);
    if (command !== 'navigation' && command !== 'metadata')
        throw new Error(notebookCatalogHelp);
    const [action, ...argsAfterAction] = rest;
    if (command === 'navigation' && action === 'read' && argsAfterAction.every(flag => flag === '--json'))
        return request.get(`${API}/navigation`);
    if (action !== 'update')
        throw new Error(notebookCatalogHelp);
    const flags = {};
    for (let index = 0; index < argsAfterAction.length; index += 1) {
        const token = argsAfterAction[index];
        if (token === undefined)
            throw new Error(notebookCatalogHelp);
        if (!token.startsWith('--'))
            throw new Error(notebookCatalogHelp);
        const value = argsAfterAction[index + 1];
        if (!value || value.startsWith('--'))
            throw new Error(`Missing value for ${token}`);
        flags[token.slice(2)] = value;
        index += 1;
    }
    const notebookId = flags['notebook-id'];
    const generation = Number(flags.generation);
    const expectedRevision = flags['expected-revision'];
    if (command === 'metadata') {
        if (!notebookId || !Number.isSafeInteger(generation) || !expectedRevision || !flags.title?.trim() || flags.description === undefined)
            throw new Error(notebookCatalogHelp);
        return request.post(`${API}/metadata`, { notebookId, generation, expectedRevision, title: flags.title, description: flags.description });
    }
    let operation;
    try {
        operation = JSON.parse(flags.operation || '');
    }
    catch {
        throw new Error('--operation must be valid JSON');
    }
    if (!notebookId || !Number.isSafeInteger(generation) || !expectedRevision || !operation || typeof operation !== 'object' || Array.isArray(operation)) {
        throw new Error(notebookCatalogHelp);
    }
    return request.post(`${API}/navigation`, { notebookId, generation, expectedRevision, operation });
}
