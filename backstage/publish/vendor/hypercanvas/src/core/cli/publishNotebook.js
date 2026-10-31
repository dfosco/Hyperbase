#!/usr/bin/env node
/**
 * `hypercanvas publish <command>` — Notebook publication operations.
 *
 * Commands run directly against the selected Notebook root (or active
 * Notebook). Fields map 1:1 to `/_hypercanvas/publishing` request fields.
 */
import { buildPublishSite, getPublishOperation, publishNotebookProject, getPublishStatus, publishNotebook, retryPublish, setupPublishingRepository, } from '../notebook/publishing.js';
import { resolveNotebookRoot } from './filesystemRoots.js';
import { legacySessionEnv as legacyEnv } from '../envCompat.js';
import { die, get, parseSimpleArgs, post } from './cliHelpers.js';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function stringFlag(flags, name) {
    return typeof flags[name] === 'string' ? flags[name] : undefined;
}
function callPublishingApi(operation, request) {
    return Promise.resolve(Reflect.apply(operation, undefined, [request]));
}
function errorField(error, name) {
    return isRecord(error) ? error[name] : undefined;
}
function errorMessage(error, fallback) {
    const message = errorField(error, 'message');
    return typeof message === 'string' && message ? message : fallback;
}
const [command, ...args] = process.argv.slice(3);
const parsedArgs = parseSimpleArgs(args);
const positional = Array.isArray(parsedArgs.positional) ? [...parsedArgs.positional] : [];
const flags = isRecord(parsedArgs.flags) ? parsedArgs.flags : {};
function requestFields(notebookRoot) {
    return {
        notebookRoot,
        mode: stringFlag(flags, 'mode') || 'default',
        destination: stringFlag(flags, 'destination'),
        repositoryMode: stringFlag(flags, 'repository-mode') || 'create',
        owner: stringFlag(flags, 'owner'),
        name: stringFlag(flags, 'name'),
        visibility: stringFlag(flags, 'visibility') || 'private',
        branch: stringFlag(flags, 'branch') || 'main',
    };
}
const PUBLISHING_API = '/_hypercanvas/publishing';
const LOGIN_TERMINAL = new Set(['succeeded', 'failed', 'cancelled']);
/**
 * `publish github <status|login|cancel|recheck|retry-cli>` — the CLI side of the
 * shared GitHub connection API. Each subcommand calls the same Core route as the
 * Publish panel; `--session` maps to the request's `sessionId`.
 */
async function githubConnection(subcommand) {
    if (subcommand === 'status')
        return get(`${PUBLISHING_API}/github`);
    if (subcommand === 'recheck')
        return post(`${PUBLISHING_API}/github/recheck`, {});
    if (subcommand === 'retry-cli')
        return post(`${PUBLISHING_API}/github/cli/retry`, {});
    if (subcommand === 'cancel') {
        const sessionId = stringFlag(flags, 'session');
        if (!sessionId)
            die('Usage: hypercanvas publish github cancel --session <id>');
        return post(`${PUBLISHING_API}/github/login/cancel`, { sessionId });
    }
    if (subcommand === 'login') {
        const started = await post(`${PUBLISHING_API}/github/login`, {});
        if (started.skipped || !isRecord(started.login))
            return started;
        // Follow the owned sign-in, printing the real device code once, until it settles.
        let login = started.login;
        let announced = false;
        for (;;) {
            if (!announced && typeof login.code === 'string') {
                announced = true;
                console.error(`Enter code ${login.code} at ${String(login.verificationUri ?? 'https://github.com/login/device')}`);
            }
            if (LOGIN_TERMINAL.has(String(login.status)))
                break;
            await new Promise(resolve => setTimeout(resolve, 1000));
            const current = await get(`${PUBLISHING_API}/github/login`);
            if (!isRecord(current.login) || current.login.id !== login.id)
                break;
            login = current.login;
        }
        return { ...started, login };
    }
    return die(`Usage:
  hypercanvas publish github status
  hypercanvas publish github login
  hypercanvas publish github cancel --session <id>
  hypercanvas publish github recheck
  hypercanvas publish github retry-cli`);
}
try {
    let result;
    const rootArgument = command === 'retry' ? positional[1] : positional[0];
    // The GitHub connection lives in the running Core; it takes no notebook argument.
    const notebookRoot = command === 'github' ? '' : command === 'status' && !rootArgument
        ? (process.env.HYPERCANVAS_PROJECT_ROOT ?? legacyEnv('STORYBOARD_PROJECT_ROOT')) || process.env.HYPERCANVAS_NOTEBOOK_ROOT || process.cwd()
        : resolveNotebookRoot(rootArgument ?? null);
    if (command === 'github') {
        result = await githubConnection(positional[0]);
        const login = isRecord(result) ? result.login : undefined;
        if (isRecord(login) && (login.status === 'failed' || login.status === 'cancelled'))
            process.exitCode = 1;
    }
    else if (command === 'status') {
        result = stringFlag(flags, 'operation')
            ? getPublishOperation(notebookRoot, stringFlag(flags, 'operation') || '')
            : getPublishStatus(notebookRoot);
    }
    else if (command === 'project' || command === 'prepare') {
        result = await callPublishingApi(publishNotebookProject, {
            notebookRoot,
            mode: stringFlag(flags, 'mode') || 'default',
            destination: stringFlag(flags, 'destination'),
        });
    }
    else if (command === 'build') {
        result = await callPublishingApi(buildPublishSite, {
            notebookRoot,
            mode: stringFlag(flags, 'mode') || 'default',
            destination: stringFlag(flags, 'destination'),
        });
    }
    else if (command === 'repository') {
        result = await callPublishingApi(setupPublishingRepository, { root: notebookRoot, ...requestFields(notebookRoot) });
    }
    else if (command === 'deploy') {
        result = await callPublishingApi(publishNotebook, { root: notebookRoot, ...requestFields(notebookRoot) });
    }
    else if (command === 'retry') {
        if (!positional[0])
            die('Usage: hypercanvas publish retry <operation-id> [notebook]');
        result = await callPublishingApi(retryPublish, { root: notebookRoot, operationId: positional[0] });
    }
    else {
        die(`Usage:
  storyboard publish status [notebook] [--operation <id>]
  storyboard publish project [notebook] [--mode default|external] [--destination <path>]
  storyboard publish build [notebook] [--mode default|external] [--destination <path>]
  storyboard publish repository [notebook] --owner <owner> --name <repo> [--mode default|external] [--repository-mode create|connect] [--visibility public|private] [--destination <path>]
  storyboard publish deploy [notebook] --owner <owner> --name <repo> [--mode default|external] [--repository-mode create|connect] [--visibility public|private] [--destination <path>]
  storyboard publish retry <operation-id> [notebook]
  storyboard publish github status|login|recheck|retry-cli
  storyboard publish github cancel --session <id>`);
    }
    if (flags.json)
        console.log(JSON.stringify(result, null, 2));
    else
        console.log(JSON.stringify(result, null, 2));
    const status = errorField(result, 'status');
    if (status === 'failed' || status === 'awaiting_retry')
        process.exitCode = 1;
}
catch (error) {
    if (flags.json) {
        console.log(JSON.stringify({
            status: 'failed',
            finalStatus: 'error',
            output: [],
            error: {
                code: errorField(error, 'code') || 'PUBLISHING_FAILED',
                message: errorMessage(error, 'Publishing failed'),
                detail: errorField(error, 'detail') ?? null,
                hint: errorField(error, 'hint') ?? null,
                actionable: Boolean(errorField(error, 'actionable')),
            },
        }, null, 2));
        process.exitCode = 1;
    }
    else {
        const hint = errorField(error, 'hint');
        const message = errorMessage(error, 'Publishing failed');
        die(typeof hint === 'string' && hint ? `${message}\n${hint}` : message);
    }
}
