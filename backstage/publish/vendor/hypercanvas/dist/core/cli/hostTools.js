import { get } from './cliHelpers.js';
const API_PATH = '/_hypercanvas/host-tools';
export function hostToolsHelp() {
    return [
        'Usage: hypercanvas host-tools <command>',
        '',
        'Commands:',
        '  preflight                         Inspect the host runtime and installed CLIs',
    ].join('\n');
}
export async function runHostToolsCommand(args, request = { get }) {
    const [command, ...extra] = args;
    if (!command || command === 'help' || command === '--help')
        return { help: hostToolsHelp() };
    if (extra.includes('--help') || extra.includes('-h'))
        return { help: hostToolsHelp() };
    if (command !== 'preflight')
        throw new Error(`Unknown host-tools command: ${command}`);
    if (extra.length)
        throw new Error(`Unexpected arguments: ${extra.join(' ')}`);
    return request.get(`${API_PATH}/preflight`);
}
export async function main(args = process.argv.slice(3)) {
    try {
        const result = await runHostToolsCommand(args);
        if ('help' in result && typeof result.help === 'string')
            console.log(result.help);
        else
            console.log(JSON.stringify(result, null, 2));
    }
    catch (error) {
        console.error(JSON.stringify({ error: { code: 'CLI_ERROR', message: error instanceof Error ? error.message : String(error) } }, null, 2));
        process.exitCode = 1;
    }
}
