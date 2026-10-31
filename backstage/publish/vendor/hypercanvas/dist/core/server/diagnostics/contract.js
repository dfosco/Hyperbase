import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const DIAGNOSTIC_SCHEMA_VERSION = 1;
export const MAX_DIAGNOSTIC_TEXT_LENGTH = 2000;
const secretKey = /(?:token|secret|password|credential|authorization|auth(?:entication|_?header)?|api[_-]?key)/i;
const jsonSecretAssignment = /("(?:[^"\\]|\\.)*(?:TOKEN|SECRET|PASSWORD|AUTH(?:ORIZATION|ENTICATION|_HEADER)?|API[_-]?KEY|CREDENTIAL)(?:[^"\\]|\\.)*"\s*:\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|null|true|false|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/gi;
const validIdentifier = /^[A-Za-z0-9_-]{16,128}$/;
const validCode = /^[A-Z][A-Z0-9_]{2,63}$/;
const validComponent = /^[a-z][a-z0-9-]{1,63}$/;
const allowedActions = new Set(['retry-core', 'reload-page', 'restart-app', 'open-diagnostics']);
const allowedStates = new Set(['recovering', 'recovered', 'exhausted', 'manual']);
const incidentKeys = new Set([
    'schemaVersion', 'incidentId', 'correlationId', 'occurredAt', 'code', 'title', 'description',
    'runtime', 'component', 'instruction', 'details', 'location', 'recovery',
]);
function readJsonAsset(name) {
    return JSON.parse(readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8'));
}
const catalogAsset = readJsonAsset('./diagnostic-catalog.json');
if (catalogAsset.schemaVersion !== DIAGNOSTIC_SCHEMA_VERSION || !Array.isArray(catalogAsset.codes) || !isRecord(catalogAsset.limits)
    || !Number.isInteger(catalogAsset.limits.history) || catalogAsset.limits.history < 1 || catalogAsset.limits.history > 100
    || !Number.isInteger(catalogAsset.limits.snapshotBytes) || catalogAsset.limits.snapshotBytes < 1024 * 1024 || catalogAsset.limits.snapshotBytes > 64 * 1024 * 1024) {
    throw new Error('Unsupported Hypercanvas diagnostic catalog');
}
export const MAX_DIAGNOSTIC_HISTORY = catalogAsset.limits.history;
export const MAX_DIAGNOSTIC_SNAPSHOT_BYTES = catalogAsset.limits.snapshotBytes;
export const DIAGNOSTIC_CATALOG = Object.freeze(catalogAsset.codes.map((candidate) => {
    if (!isRecord(candidate) || typeof candidate.code !== 'string' || typeof candidate.title !== 'string'
        || typeof candidate.description !== 'string' || (candidate.runtime !== 'mygo' && candidate.runtime !== 'core')
        || typeof candidate.component !== 'string') {
        throw new Error('Malformed Hypercanvas diagnostic catalog entry');
    }
    return Object.freeze({
        code: candidate.code,
        title: candidate.title,
        description: candidate.description,
        runtime: candidate.runtime,
        component: candidate.component,
    });
}));
const catalogByCode = new Map(DIAGNOSTIC_CATALOG.map((entry) => [entry.code, entry]));
export function getDiagnosticCatalogEntry(code) {
    return catalogByCode.get(code);
}
export function createDiagnosticIncident(code, options = {}) {
    const entry = catalogByCode.get(code);
    if (!entry)
        throw new TypeError(`Unknown Hypercanvas diagnostic code: ${code}`);
    const incident = {
        schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
        incidentId: randomUUID().replaceAll('-', '_'),
        correlationId: options.correlationId || randomUUID().replaceAll('-', '_'),
        occurredAt: (options.occurredAt || new Date()).toISOString(),
        code,
        title: entry.title,
        description: entry.description,
        runtime: options.runtime || entry.runtime,
        component: options.component || entry.component,
        ...(options.instruction ? { instruction: options.instruction } : {}),
        ...(options.details ? { details: options.details } : {}),
        ...(options.location ? { location: options.location } : {}),
        ...(options.recovery ? { recovery: options.recovery } : {}),
    };
    const result = validateDiagnosticIncident(incident);
    if (!result.ok)
        throw new TypeError(`Invalid Hypercanvas diagnostic incident: ${result.reason}`);
    return sanitizeDiagnosticIncident(result.incident);
}
/** Convert an untrusted failure report into a safe incident without dropping its original message. */
export function createUnknownDiagnosticIncident(original, options = {}) {
    const originalRuntime = isRecord(original) && (original.runtime === 'mygo' || original.runtime === 'core')
        ? original.runtime
        : undefined;
    const runtime = options.runtime || originalRuntime || 'core';
    const code = runtime === 'mygo' ? 'UNKNOWN_MYGO_FAILURE' : 'UNKNOWN_CORE_FAILURE';
    let reportedCode = '';
    let reportedDescription = '';
    let reportedComponent = options.component || '';
    if (isRecord(original)) {
        reportedCode = typeof original.code === 'string' ? original.code : '';
        if (!reportedComponent && typeof original.component === 'string')
            reportedComponent = original.component;
        reportedDescription = typeof original.description === 'string' ? original.description : '';
        if (!reportedDescription && typeof original.message === 'string')
            reportedDescription = original.message;
        if (!reportedDescription) {
            try {
                reportedDescription = JSON.stringify(sanitizeUnknownValue(original)) || '';
            }
            catch {
                reportedDescription = String(original);
            }
        }
    }
    else if (original instanceof Error) {
        reportedDescription = original.message;
    }
    else if (typeof original === 'string') {
        reportedDescription = original;
    }
    else {
        try {
            reportedDescription = JSON.stringify(original) || String(original ?? '');
        }
        catch {
            reportedDescription = String(original ?? '');
        }
    }
    return createDiagnosticIncident(code, {
        ...options,
        runtime,
        component: 'diagnostics',
        details: {
            reportedCode,
            reportedDescription: redactDiagnosticText(reportedDescription),
            ...(reportedComponent ? { reportedComponent: truncateUnicode(redactDiagnosticText(reportedComponent), 64) } : {}),
        },
    });
}
export function validateDiagnosticIncident(value) {
    if (!isRecord(value))
        return { ok: false, reason: 'incident must be an object' };
    if (Object.keys(value).some((key) => !incidentKeys.has(key)))
        return { ok: false, reason: 'incident has unsupported fields' };
    if (value.schemaVersion !== DIAGNOSTIC_SCHEMA_VERSION)
        return { ok: false, reason: 'unsupported schema version' };
    if (typeof value.incidentId !== 'string' || !validIdentifier.test(value.incidentId))
        return { ok: false, reason: 'invalid incident id' };
    if (typeof value.correlationId !== 'string' || !validIdentifier.test(value.correlationId))
        return { ok: false, reason: 'invalid correlation id' };
    if (typeof value.occurredAt !== 'string' || value.occurredAt.length > 40
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value.occurredAt)
        || !Number.isFinite(Date.parse(value.occurredAt))) {
        return { ok: false, reason: 'invalid incident timestamp' };
    }
    if (typeof value.code !== 'string' || !validCode.test(value.code) || !catalogByCode.has(value.code)) {
        return { ok: false, reason: 'unknown diagnostic code' };
    }
    if (!boundedString(value.title, 1, 160))
        return { ok: false, reason: 'invalid incident title' };
    if (!boundedString(value.description, 1, MAX_DIAGNOSTIC_TEXT_LENGTH))
        return { ok: false, reason: 'invalid incident description' };
    if (value.runtime !== 'mygo' && value.runtime !== 'core')
        return { ok: false, reason: 'invalid runtime' };
    if (typeof value.component !== 'string' || !validComponent.test(value.component))
        return { ok: false, reason: 'invalid component' };
    const catalogEntry = catalogByCode.get(value.code);
    if (catalogEntry?.runtime !== value.runtime || catalogEntry.component !== value.component) {
        return { ok: false, reason: 'runtime or component does not match the catalog code' };
    }
    if (value.instruction !== undefined && !boundedString(value.instruction, 1, 1000))
        return { ok: false, reason: 'invalid user instruction' };
    if (value.details !== undefined && !validDetails(value.details))
        return { ok: false, reason: 'invalid diagnostic details' };
    if (value.location !== undefined && !validLocation(value.location))
        return { ok: false, reason: 'invalid source location' };
    if (value.recovery !== undefined && !validRecovery(value.recovery))
        return { ok: false, reason: 'invalid recovery state' };
    return { ok: true, incident: value };
}
export function sanitizeDiagnosticIncident(incident) {
    const details = incident.details && Object.fromEntries(Object.entries(incident.details).slice(0, 20).map(([key, value]) => [
        truncateUnicode(key, 64),
        secretKey.test(key) ? '[redacted]' : typeof value === 'string' ? redactDiagnosticText(value) : value,
    ]));
    return {
        ...incident,
        title: truncateUnicode(redactDiagnosticText(incident.title), 160),
        description: redactDiagnosticText(incident.description),
        ...(incident.instruction ? { instruction: truncateUnicode(redactDiagnosticText(incident.instruction), 1000) } : {}),
        ...(details ? { details } : {}),
        ...(incident.location ? { location: { ...incident.location, file: truncateUnicode(incident.location.file, 240) } } : {}),
    };
}
export function redactDiagnosticText(value) {
    const redacted = String(value ?? '')
        .replace(jsonSecretAssignment, '$1"[redacted]"')
        .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
        .replace(/([?&](?:access_token|refresh_token|token|password|secret|api[_-]?key)=)[^&\s]+/gi, '$1[redacted]')
        .replace(/([A-Z0-9_.-]*(?:TOKEN|SECRET|PASSWORD|AUTH(?:ORIZATION|ENTICATION|_HEADER)?|API[_-]?KEY|CREDENTIAL)[A-Z0-9_.-]*\s*[:=]\s*)(?:Bearer\s+[^\s,;}]+|"[^"]*"|'[^']*'|[^\s,;}]+)/gi, '$1[redacted]')
        .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,}|sk-[A-Za-z0-9_-]{16,})\b/g, '[redacted]');
    return truncateUnicode(redacted, MAX_DIAGNOSTIC_TEXT_LENGTH);
}
export function readDiagnosticSnapshot(value) {
    if (!isRecord(value) || value.schemaVersion !== DIAGNOSTIC_SCHEMA_VERSION || !Array.isArray(value.incidents)) {
        return { schemaVersion: DIAGNOSTIC_SCHEMA_VERSION, incidents: [] };
    }
    const incidents = value.incidents.slice(-MAX_DIAGNOSTIC_HISTORY).flatMap((candidate) => {
        const result = validateDiagnosticIncident(candidate);
        return result.ok ? [sanitizeDiagnosticIncident(result.incident)] : [];
    });
    return { schemaVersion: DIAGNOSTIC_SCHEMA_VERSION, incidents };
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function boundedString(value, min, max) {
    return typeof value === 'string' && unicodeLength(value.trim()) >= min && unicodeLength(value) <= max;
}
function validDetails(value) {
    if (!isRecord(value) || Object.keys(value).length > 20)
        return false;
    return Object.entries(value).every(([key, item]) => unicodeLength(key) > 0 && unicodeLength(key) <= 64 && (item === null || typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item))
        || (typeof item === 'string' && unicodeLength(item) <= MAX_DIAGNOSTIC_TEXT_LENGTH)));
}
function validLocation(value) {
    if (!isRecord(value) || Object.keys(value).some((key) => key !== 'file' && key !== 'line'))
        return false;
    if (typeof value.file !== 'string' || unicodeLength(value.file) < 1 || unicodeLength(value.file) > 240
        || value.file.startsWith('/') || /^[A-Za-z]:/.test(value.file)
        || value.file.split(/[\\/]/).some((segment) => segment === '..')
        || Array.from(value.file).some((character) => character.charCodeAt(0) <= 0x1f))
        return false;
    return value.line === undefined || (Number.isInteger(value.line) && value.line > 0);
}
function validRecovery(value) {
    if (!isRecord(value) || Object.keys(value).some((key) => !['state', 'attempt', 'limit', 'action'].includes(key)))
        return false;
    if (typeof value.state !== 'string' || !allowedStates.has(value.state))
        return false;
    if (!Number.isInteger(value.attempt) || value.attempt < 0 || value.attempt > 3)
        return false;
    if (!Number.isInteger(value.limit) || value.limit < 1 || value.limit > 3 || value.attempt > value.limit)
        return false;
    return value.action === undefined || (typeof value.action === 'string' && allowedActions.has(value.action));
}
function unicodeLength(value) {
    return Array.from(value).length;
}
function truncateUnicode(value, maximum) {
    return Array.from(value).slice(0, maximum).join('');
}
function sanitizeUnknownValue(value, depth = 0) {
    if (depth >= 8)
        return '[truncated]';
    if (Array.isArray(value))
        return value.slice(0, 50).map((item) => sanitizeUnknownValue(item, depth + 1));
    if (isRecord(value)) {
        return Object.fromEntries(Object.entries(value).slice(0, 50).map(([key, item]) => [
            key.slice(0, 64),
            secretKey.test(key) ? '[redacted]' : sanitizeUnknownValue(item, depth + 1),
        ]));
    }
    if (typeof value === 'string')
        return redactDiagnosticText(value);
    if (value === null || typeof value === 'boolean' || typeof value === 'number')
        return value;
    return String(value);
}
