/** Typed Storyboard source inspection and literal prop-edit commands. */
import { get, parseSimpleArgs, post } from './cliHelpers.js';
function parseJsonFlag(flags, name) {
    const value = flags[name];
    if (typeof value !== 'string')
        throw new Error(`--${name} must contain JSON.`);
    try {
        return JSON.parse(value);
    }
    catch {
        throw new Error(`--${name} must contain valid JSON.`);
    }
}
export async function runStoryboardSourceCommand(args, request = { get, post }) {
    const { positional, flags } = parseSimpleArgs(args);
    const action = positional[0];
    if (action === 'inspect') {
        const sourcePath = positional[1];
        if (!sourcePath || positional.length > 2)
            throw new Error('Usage: storyboard source inspect <prototypes/file.tsx|prototypes/declarations.ts>');
        return request.get(`/_hypercanvas/storyboards/source?path=${encodeURIComponent(sourcePath)}`);
    }
    if (action === 'edit') {
        const generation = Number(flags.generation);
        if (typeof flags['notebook-id'] !== 'string' || !Number.isSafeInteger(generation)
            || typeof flags.path !== 'string' || typeof flags['expected-revision'] !== 'string'
            || typeof flags.prop !== 'string') {
            throw new Error('Usage: storyboard source edit --notebook-id <id> --generation <n> --path <tsx> --expected-revision <sha256> --target <json> --prop <name> --value <json>');
        }
        const body = {
            notebookId: flags['notebook-id'],
            generation,
            path: flags.path,
            expectedRevision: flags['expected-revision'],
            type: 'setProp',
            target: parseJsonFlag(flags, 'target'),
            prop: flags.prop,
            value: parseJsonFlag(flags, 'value'),
        };
        return request.post('/_hypercanvas/storyboards/source/prop', body);
    }
    if (action === 'layout') {
        const generation = Number(flags.generation);
        if (typeof flags['notebook-id'] !== 'string' || !Number.isSafeInteger(generation)
            || typeof flags.path !== 'string' || typeof flags['expected-revision'] !== 'string'
            || typeof flags.field !== 'string') {
            throw new Error('Usage: storyboard source layout --notebook-id <id> --generation <n> --path <tsx> --expected-revision <sha256> --target <json> --field <name> --value <json>');
        }
        return request.post('/_hypercanvas/storyboards/source/layout', {
            notebookId: flags['notebook-id'], generation, path: flags.path,
            expectedRevision: flags['expected-revision'], type: 'setLayout',
            target: parseJsonFlag(flags, 'target'), field: flags.field, value: parseJsonFlag(flags, 'value'),
        });
    }
    if (action === 'binding') {
        const generation = Number(flags.generation);
        if (typeof flags['notebook-id'] !== 'string' || !Number.isSafeInteger(generation)
            || typeof flags.path !== 'string' || typeof flags['expected-revision'] !== 'string'
            || typeof flags['control-id'] !== 'string' || typeof flags['action-id'] !== 'string') {
            throw new Error('Usage: storyboard source binding --notebook-id <id> --generation <n> --path <declarations.ts> --expected-revision <sha256> --control-id <id> --action-id <id> --condition-id <json|null>');
        }
        return request.post('/_hypercanvas/storyboards/source/binding', {
            notebookId: flags['notebook-id'], generation, path: flags.path,
            expectedRevision: flags['expected-revision'], type: 'setBinding',
            controlId: flags['control-id'], actionId: flags['action-id'],
            conditionId: parseJsonFlag(flags, 'condition-id'),
        });
    }
    if (action === 'undo' || action === 'redo') {
        const generation = Number(flags.generation);
        if (typeof flags['notebook-id'] !== 'string' || !Number.isSafeInteger(generation)
            || typeof flags.path !== 'string' || typeof flags['expected-revision'] !== 'string') {
            throw new Error(`Usage: storyboard source ${action} --notebook-id <id> --generation <n> --path <tsx> --expected-revision <sha256>`);
        }
        return request.post(`/_hypercanvas/storyboards/source/${action}`, {
            notebookId: flags['notebook-id'], generation, path: flags.path,
            expectedRevision: flags['expected-revision'], type: action === 'undo' ? 'undoSource' : 'redoSource',
        });
    }
    if (action === 'delete') {
        const generation = Number(flags.generation);
        if (typeof flags['notebook-id'] !== 'string' || !Number.isSafeInteger(generation)
            || typeof flags.path !== 'string' || typeof flags['expected-revision'] !== 'string') {
            throw new Error('Usage: storyboard source delete --notebook-id <id> --generation <n> --path <tsx> --expected-revision <sha256> --target <json>');
        }
        const body = {
            notebookId: flags['notebook-id'],
            generation,
            path: flags.path,
            expectedRevision: flags['expected-revision'],
            type: 'deleteNode',
            target: parseJsonFlag(flags, 'target'),
        };
        return request.post('/_hypercanvas/storyboards/source/delete', body);
    }
    if (action === 'insert') {
        const generation = Number(flags.generation);
        const index = Number(flags.index);
        if (typeof flags['notebook-id'] !== 'string' || !Number.isSafeInteger(generation)
            || typeof flags.path !== 'string' || typeof flags['expected-revision'] !== 'string'
            || typeof flags.slot !== 'string' || !Number.isSafeInteger(index) || typeof flags.component !== 'string') {
            throw new Error('Usage: storyboard source insert --notebook-id <id> --generation <n> --path <tsx> --expected-revision <sha256> --target <json> --slot children --index <n> --component <name> --props <json>');
        }
        const body = {
            notebookId: flags['notebook-id'],
            generation,
            path: flags.path,
            expectedRevision: flags['expected-revision'],
            type: 'insertNode',
            target: parseJsonFlag(flags, 'target'),
            slot: flags.slot,
            index,
            component: flags.component,
            props: parseJsonFlag(flags, 'props'),
        };
        return request.post('/_hypercanvas/storyboards/source/insert', body);
    }
    if (action === 'duplicate') {
        const generation = Number(flags.generation);
        const index = Number(flags.index);
        if (typeof flags['notebook-id'] !== 'string' || !Number.isSafeInteger(generation)
            || typeof flags.path !== 'string' || typeof flags['expected-revision'] !== 'string'
            || typeof flags.slot !== 'string' || !Number.isSafeInteger(index)) {
            throw new Error('Usage: storyboard source duplicate --notebook-id <id> --generation <n> --path <tsx> --expected-revision <sha256> --target <json> --slot children --index <n>');
        }
        return request.post('/_hypercanvas/storyboards/source/duplicate', {
            notebookId: flags['notebook-id'], generation, path: flags.path,
            expectedRevision: flags['expected-revision'], type: 'duplicateNode',
            target: parseJsonFlag(flags, 'target'), slot: flags.slot, index,
        });
    }
    if (action === 'reorder') {
        const generation = Number(flags.generation);
        const index = Number(flags.index);
        if (typeof flags['notebook-id'] !== 'string' || !Number.isSafeInteger(generation)
            || typeof flags.path !== 'string' || typeof flags['expected-revision'] !== 'string' || !Number.isSafeInteger(index)) {
            throw new Error('Usage: storyboard source reorder --notebook-id <id> --generation <n> --path <tsx> --expected-revision <sha256> --target <json> --index <n>');
        }
        return request.post('/_hypercanvas/storyboards/source/reorder', {
            notebookId: flags['notebook-id'], generation, path: flags.path,
            expectedRevision: flags['expected-revision'], type: 'reorderNode',
            target: parseJsonFlag(flags, 'target'), index,
        });
    }
    if (action === 'reparent') {
        const generation = Number(flags.generation);
        const index = Number(flags.index);
        if (typeof flags['notebook-id'] !== 'string' || !Number.isSafeInteger(generation)
            || typeof flags.path !== 'string' || typeof flags['expected-revision'] !== 'string'
            || typeof flags.slot !== 'string' || !Number.isSafeInteger(index)) {
            throw new Error('Usage: storyboard source reparent --notebook-id <id> --generation <n> --path <tsx> --expected-revision <sha256> --target <json> --parent <json> --slot children --index <n>');
        }
        return request.post('/_hypercanvas/storyboards/source/reparent', {
            notebookId: flags['notebook-id'], generation, path: flags.path,
            expectedRevision: flags['expected-revision'], type: 'reparentNode',
            target: parseJsonFlag(flags, 'target'), parent: parseJsonFlag(flags, 'parent'),
            slot: flags.slot, index,
        });
    }
    throw new Error('Usage: storyboard source <inspect|edit|layout|binding|undo|redo|delete|insert|duplicate|reorder|reparent>');
}
