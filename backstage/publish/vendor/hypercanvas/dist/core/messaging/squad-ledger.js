/** Minimal, writer-numbered JSONL ledger for a Squad room. */
import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';
const KINDS = new Set(['information', 'instruction']);
const RESPONSES = new Set(['ack', 'status', 'result', 'blocked']);
const SYSTEM_KINDS = new Set([
    'system.agent.lifecycle',
    'system.permission.requested',
    'system.permission.resolved',
    'system.delivery.attempt',
    'system.leader.promoted',
]);
const RESERVED = new Set(['number', 'timestamp', 'author']);
const MAX_ENTRY_BYTES = 1024 * 1024;
const appendLocks = new Map();
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function validId(value) {
    return typeof value === 'string' && SAFE_ID.test(value);
}
function isJsonValue(value, ancestors = new Set()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean')
        return true;
    if (typeof value === 'number')
        return Number.isFinite(value);
    if (typeof value !== 'object' || ancestors.has(value))
        return false;
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype)
        return false;
    const next = new Set(ancestors).add(value);
    const children = Array.isArray(value) ? value : Object.values(value);
    return children.every((item) => isJsonValue(item, next));
}
/** Validate caller-authored message fields, excluding writer-owned metadata. */
export function validateSquadMessage(message) {
    const errors = [];
    if (!isRecord(message)) {
        return { valid: false, errors: ['Message must be an object'] };
    }
    for (const field of RESERVED) {
        if (Object.hasOwn(message, field))
            errors.push(`Field is assigned by the ledger: ${field}`);
    }
    if (typeof message.kind !== 'string' || !KINDS.has(message.kind)) {
        errors.push('kind must be information or instruction');
    }
    if (typeof message.description !== 'string' || !message.description.trim()) {
        errors.push('description must be a non-empty string');
    }
    const recipients = message.to;
    if (Object.hasOwn(message, 'to') && (!Array.isArray(recipients)
        || recipients.some((id) => !validId(id))
        || new Set(recipients).size !== recipients.length)) {
        errors.push('to must be an array of unique member IDs');
    }
    if (Object.hasOwn(message, 'inject') && typeof message.inject !== 'boolean') {
        errors.push('inject must be a boolean');
    }
    if (message.inject === true && (!Array.isArray(recipients) || recipients.length === 0)) {
        errors.push('inject: true requires at least one recipient in to');
    }
    const attachments = message.attachments;
    if (Object.hasOwn(message, 'attachments') && (!Array.isArray(attachments)
        || attachments.some((item) => typeof item !== 'string'
            && !isRecord(item))
        || !isJsonValue(attachments))) {
        errors.push('attachments must be an array of strings or JSON objects');
    }
    const files = message.files;
    if (Object.hasOwn(message, 'files') && (!Array.isArray(files)
        || files.some((file) => typeof file !== 'string' || !file.trim() || file.includes('\0')
            || path.isAbsolute(file) || /^[a-zA-Z]:[\\/]/.test(file)
            || file.split(/[\\/]/).includes('..')))) {
        errors.push('files must be relative paths without traversal');
    }
    if (Object.hasOwn(message, 'replyTo') && (!Number.isSafeInteger(message.replyTo) || message.replyTo < 1)) {
        errors.push('replyTo must be a positive ledger number');
    }
    if (Object.hasOwn(message, 'response') && (typeof message.response !== 'string' || !RESPONSES.has(message.response))) {
        errors.push(`response must be one of ${[...RESPONSES].join(', ')}`);
    }
    if (Object.hasOwn(message, 'response') && !Object.hasOwn(message, 'replyTo')) {
        errors.push('response requires replyTo');
    }
    const allowed = new Set(['kind', 'description', 'to', 'inject', 'attachments', 'files', 'replyTo', 'response']);
    for (const field of Object.keys(message)) {
        if (!allowed.has(field) && !RESERVED.has(field))
            errors.push(`Unknown message field: ${field}`);
    }
    return { valid: errors.length === 0, errors };
}
function validatePersistedEntry(value, expectedNumber, lineNumber) {
    if (!isRecord(value) || !Number.isSafeInteger(value.number) || value.number !== expectedNumber) {
        throw new Error(`Squad ledger numbering is invalid at line ${lineNumber}; refusing append`);
    }
    if (typeof value.timestamp !== 'string' || !value.timestamp
        || typeof value.author !== 'string' || !value.author
        || typeof value.kind !== 'string' || typeof value.description !== 'string' || !value.description.trim()) {
        throw new Error(`Squad ledger entry is invalid at line ${lineNumber}; refusing append`);
    }
    if (SYSTEM_KINDS.has(value.kind)) {
        if (value.author !== 'system'
            || (value.data !== undefined && (!isRecord(value.data) || !isJsonValue(value.data)))) {
            throw new Error(`Squad ledger entry is invalid at line ${lineNumber}; refusing append`);
        }
    }
    else {
        if (!validId(value.author))
            throw new Error(`Squad ledger entry is invalid at line ${lineNumber}; refusing append`);
        const { number: _number, timestamp: _timestamp, author: _author, ...message } = value;
        const validation = validateSquadMessage(message);
        if (!validation.valid) {
            throw new Error(`Squad ledger entry is invalid at line ${lineNumber}: ${validation.errors.join('; ')}; refusing append`);
        }
    }
    return value;
}
function readLedger(filePath) {
    if (!fs.existsSync(filePath))
        return [];
    const content = fs.readFileSync(filePath, 'utf8');
    if (content && !content.endsWith('\n'))
        throw new Error('Squad ledger has an incomplete final line; refusing append');
    const lines = content.split('\n').slice(0, -1);
    const entries = [];
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        if (line === undefined)
            throw new Error('Squad ledger contains an incomplete line; refusing append');
        let entry;
        try {
            entry = JSON.parse(line);
        }
        catch {
            throw new Error(`Squad ledger contains invalid JSON at line ${index + 1}; refusing append`);
        }
        entries.push(validatePersistedEntry(entry, index + 1, index + 1));
    }
    return entries;
}
/**
 * Owns serialized append ordering for each room. Calls within one Core process
 * share a per-room promise queue; JSONL remains the source of truth on restart.
 */
export class SquadLedger {
    baseDir;
    now;
    constructor({ root, directory = '.hypercanvas/squads', now = () => new Date() }) {
        this.baseDir = path.join(root, directory);
        this.now = now;
    }
    _filePath(squadId) {
        if (!validId(squadId))
            throw new Error('Invalid Squad ID');
        return path.join(this.baseDir, squadId, 'room.jsonl');
    }
    async append(squadId, verifiedAuthor, message) {
        if (!validId(verifiedAuthor))
            throw new Error('A verified author ID is required');
        const validation = validateSquadMessage(message);
        if (!validation.valid)
            throw new Error(validation.errors.join('; '));
        const validatedMessage = message;
        return this._append(squadId, (number, timestamp) => ({
            number, timestamp, author: verifiedAuthor, ...validatedMessage,
        }));
    }
    async appendSystem(squadId, kind, description, data = null) {
        if (!SYSTEM_KINDS.has(kind))
            throw new Error(`Invalid system event kind: ${kind}`);
        if (typeof description !== 'string' || !description.trim())
            throw new Error('System event description is required');
        if (data !== null && (!isRecord(data) || !isJsonValue(data))) {
            throw new Error('System event data must be a JSON object');
        }
        return this._append(squadId, (number, timestamp) => ({
            number,
            timestamp,
            author: 'system',
            kind,
            description: description.trim(),
            ...(data ? { data } : {}),
        }));
    }
    async _append(squadId, createEntry) {
        const filePath = this._filePath(squadId);
        const previous = appendLocks.get(filePath) || Promise.resolve();
        const operation = previous.catch(() => undefined).then(() => {
            const entries = readLedger(filePath);
            const entry = createEntry(entries.length + 1, this.now().toISOString());
            const serialized = `${JSON.stringify(entry)}\n`;
            if (Buffer.byteLength(serialized, 'utf8') > MAX_ENTRY_BYTES) {
                throw new Error(`Squad ledger entry exceeds ${MAX_ENTRY_BYTES} bytes`);
            }
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.appendFileSync(filePath, serialized, { encoding: 'utf8', flag: 'a' });
            return entry;
        });
        appendLocks.set(filePath, operation);
        try {
            return await operation;
        }
        finally {
            if (appendLocks.get(filePath) === operation)
                appendLocks.delete(filePath);
        }
    }
    async read(squadId, { after = 0, limit } = {}) {
        const entries = readLedger(this._filePath(squadId));
        let result = entries.filter((entry) => entry.number > after);
        if (typeof limit === 'number' && Number.isSafeInteger(limit) && limit > 0)
            result = result.slice(0, limit);
        return result;
    }
    async get(squadId, number) {
        if (!Number.isSafeInteger(number) || number < 1)
            return null;
        return (await this.read(squadId)).find((entry) => entry.number === number) || null;
    }
}
