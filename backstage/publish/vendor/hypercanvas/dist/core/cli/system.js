import process from 'node:process';
import { get, post } from './cliHelpers.js';
const OPERATIONS = new Set(['select-directory', 'select-file', 'import-file', 'show-in-finder', 'diagnostics']);
export function systemHelp() {
    return [
        'Usage: hypercanvas system select-directory [--purpose notebook|site]',
        '       storyboard system <select-file|import-file|diagnostics>',
        '       hypercanvas system show-in-finder --path <notebook-relative-path>',
        '',
        'Use Core OS pickers, import a file, open its folder in Finder, or print runtime diagnostics.',
    ].join('\n');
}
export async function runSystemCommand(args, request = { get, post }) {
    const [operation, ...extra] = args;
    if (!operation || operation === 'help')
        return { help: systemHelp() };
    if (!OPERATIONS.has(operation))
        throw new Error(systemHelp());
    const selectedOperation = operation;
    if (operation === 'diagnostics') {
        if (extra.length)
            throw new Error(systemHelp());
        return request.get('/_hypercanvas/diagnostics');
    }
    let body = {};
    if (operation === 'show-in-finder') {
        if (extra.length !== 2 || extra[0] !== '--path' || !extra[1]?.trim())
            throw new Error(systemHelp());
        body = { path: extra[1] };
    }
    else if (operation === 'select-directory' && extra.length > 0) {
        if (extra.length !== 2 || extra[0] !== '--purpose' || !['notebook', 'site'].includes(extra[1] || '')) {
            throw new Error(systemHelp());
        }
        body = { purpose: extra[1] };
    }
    else if (extra.length > 0) {
        throw new Error(systemHelp());
    }
    return request.post(`/_hypercanvas/system/${selectedOperation}`, body);
}
export async function main(args = process.argv.slice(3)) {
    try {
        const result = await runSystemCommand(args);
        if (result !== null && typeof result === 'object' && 'help' in result && typeof result.help === 'string')
            console.log(result.help);
        else
            console.log(JSON.stringify(result, null, 2));
    }
    catch (error) {
        const details = error !== null && typeof error === 'object' ? error : {};
        console.error(JSON.stringify({ error: { code: typeof details.code === 'string' ? details.code : 'CLI_ERROR', message: typeof details.message === 'string' ? details.message : String(error) } }, null, 2));
        process.exitCode = 1;
    }
}
