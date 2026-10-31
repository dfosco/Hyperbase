/**
 * storyboard notebook — manage content-only Notebook folders and Core bindings.
 *
 * This command only manages portable Notebook content and its local runtime
 * directory. It never copies the Hypercanvas application into the Notebook.
 */
import path from 'node:path';
import process from 'node:process';
import { initializeNotebook, inspectNotebook, forgetMissingNotebookCanvas } from '../notebook/notebook.js';
import { publishNotebookProject } from '../notebook/publishing.js';
import { runNotebookRuntimeCommand } from './notebookRuntimeCommands.js';
import { notebookCatalogHelp, runNotebookCatalogCommand } from './notebookCatalogCommands.js';
import { notebookRepairHelp, runNotebookRepairCommand } from './notebookRepairCommands.js';
import { isMigrationCliError, notebookMigrationHelp, runNotebookMigrationCommand } from './notebookMigrationCommands.js';
import { die, jsonOut, parseSimpleArgs } from './cliHelpers.js';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function errorMessage(error) {
    return isRecord(error) && typeof error.message === 'string' ? error.message : String(error);
}
function stringFlag(flags, name) {
    return typeof flags[name] === 'string' ? flags[name] : undefined;
}
function help() {
    console.log(`
  storyboard notebook — manage content-only Notebook folders

  Usage:
    storyboard notebook inspect [path] [--json]
    storyboard notebook forget-missing-canvas <path> --page-id <id> --expected-revision <sha256> [--json]
    storyboard notebook init [path] [--id <id>] [--title <title>] [--json]
    storyboard notebook pages [--json]
    storyboard notebook navigation read [--json]
    storyboard notebook navigation update --notebook-id <id> --generation <n> --expected-revision <sha256> --operation <json>
    storyboard notebook publish <source> [destination] [--mode default|external] [--json]
    storyboard notebook recent
    storyboard notebook forget <path>
    storyboard notebook open <path>
    storyboard notebook create <path> [--title <title>] [--id <id>]
    storyboard notebook close

  A Notebook contains canvas/, prototypes/, assets/, and portable metadata.
  Runtime state is kept in the runtime directory (.hypercanvas/, legacy .storyboard/) and the application is never copied in.
${notebookCatalogHelp}
${notebookRepairHelp}
${notebookMigrationHelp}
`);
}
const subcommand = process.argv[3];
const parsedArgs = parseSimpleArgs(process.argv.slice(4));
const positional = Array.isArray(parsedArgs.positional) ? [...parsedArgs.positional] : [];
const flags = isRecord(parsedArgs.flags) ? parsedArgs.flags : {};
if (!subcommand || subcommand === 'help' || flags.help || flags.h) {
    help();
    process.exit(0);
}
if (!['inspect', 'init', 'publish', 'recent', 'forget', 'open', 'create', 'close', 'pages', 'branch', 'navigation', 'repair', 'migration', 'forget-missing-canvas'].includes(subcommand))
    die(`Unknown notebook subcommand: ${subcommand}`);
if (['recent', 'forget', 'open', 'create', 'close'].includes(subcommand)) {
    runNotebookRuntimeCommand([subcommand, ...positional]).then(result => {
        if (isRecord(result) && typeof result.help === 'string')
            console.log(result.help);
        else
            console.log(JSON.stringify(result, null, 2));
    }).catch(error => die(errorMessage(error)));
}
else if (['pages', 'branch', 'navigation'].includes(subcommand)) {
    runNotebookCatalogCommand([subcommand, ...process.argv.slice(4)]).then(jsonOut).catch(error => die(errorMessage(error)));
}
else if (subcommand === 'repair') {
    runNotebookRepairCommand(process.argv.slice(4)).then(jsonOut).catch(error => {
        if (isRecord(error) && error.responseBody && flags.json) {
            jsonOut(error.responseBody);
            process.exitCode = 1;
        }
        else
            die(errorMessage(error));
    });
}
else if (subcommand === 'migration') {
    runNotebookMigrationCommand(process.argv.slice(4)).then(jsonOut).catch(error => {
        if (isMigrationCliError(error) && flags.json) {
            jsonOut(error.responseBody);
            process.exitCode = 1;
        }
        else
            die(errorMessage(error));
    });
}
else {
    const root = path.resolve(positional[0] || process.cwd());
    try {
        if (subcommand === 'forget-missing-canvas') {
            const pageId = stringFlag(flags, 'page-id');
            const expectedRevision = stringFlag(flags, 'expected-revision');
            if (positional.length !== 1 || !pageId || !expectedRevision)
                die('A Notebook path, --page-id and --expected-revision are required.');
            jsonOut(forgetMissingNotebookCanvas(root, { pageId, expectedRevision }));
        }
        else if (subcommand === 'publish') {
            const result = await Reflect.apply(publishNotebookProject, undefined, [{
                    notebookRoot: root,
                    destination: positional[1],
                    mode: stringFlag(flags, 'mode') || (positional[1] ? 'external' : 'default'),
                    initializeGit: false,
                }]);
            if (flags.json)
                jsonOut(result);
            else
                console.log(`published: ${isRecord(result) && typeof result.destination === 'string' ? result.destination : ''}`);
        }
        else {
            const initialId = stringFlag(flags, 'id');
            const result = subcommand === 'init'
                ? initializeNotebook(root, { ...(initialId ? { id: initialId } : {}), title: stringFlag(flags, 'title') || 'Notebook' })
                : inspectNotebook(root);
            if (flags.json)
                jsonOut(result);
            else {
                console.log(`${result.status}: ${result.root}`);
                if (result.manifest)
                    console.log(`  ${String(result.manifest.title ?? '')} (${String(result.manifest.id ?? '')})`);
                console.log(`  pages: ${result.pages.length}`);
                const sites = result.status === 'valid' ? result.sites : result.sites ?? [];
                console.log(`  sites: ${sites.length}`);
                for (const site of sites)
                    console.log(`  - site ${site.id}: ${site.path}`);
                for (const page of result.pages) {
                    console.log(`  - ${String(page.type || 'unknown')} ${String(page.title || page.id || '(unnamed)')}: ${page.available ? 'available' : 'unavailable'}`);
                }
                for (const item of result.diagnostics)
                    console.error(`  ! ${item.code}: ${item.message}`);
            }
            if (result.status === 'invalid' || result.status === 'unavailable')
                process.exitCode = 1;
        }
    }
    catch (error) {
        die(errorMessage(error));
    }
}
