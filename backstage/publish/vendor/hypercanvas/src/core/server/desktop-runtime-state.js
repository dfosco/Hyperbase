import fs from 'node:fs';
import path from 'node:path';
import { MAX_DIAGNOSTIC_SNAPSHOT_BYTES, validateDiagnosticIncident } from './diagnostics/contract.js';
const publisherPattern = /^publisher_[A-Za-z0-9_-]{16,128}$/;
const phases = new Set(['starting', 'ready', 'recovering', 'recovered', 'exhausted', 'manual']);
const actions = new Set(['retry-core', 'reload-page', 'restart-app', 'open-diagnostics']);
const appearanceModes = new Set(['system', 'light', 'dark']);
const MAX_APPEARANCE_BYTES = 1024;
const FUTURE_TIMESTAMP_TOLERANCE_MS = 60_000;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function processIsAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        return error instanceof Error && 'code' in error && error.code === 'EPERM';
    }
}
function parseParentPid(value) {
    if (!value || !/^[1-9]\d{0,9}$/.test(value))
        return null;
    const pid = Number(value);
    return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
}
function validRuntimeSnapshot(value) {
    if (!isRecord(value)
        || Object.keys(value).some((key) => !['schemaVersion', 'sequence', 'phase', 'incident', 'actions'].includes(key))
        || value.schemaVersion !== 1
        || !Number.isSafeInteger(value.sequence)
        || value.sequence < 1
        || typeof value.phase !== 'string'
        || !phases.has(value.phase)
        || !Array.isArray(value.actions)
        || value.actions.some((action) => typeof action !== 'string' || !actions.has(action)))
        return null;
    const uniqueActions = new Set(value.actions);
    if (uniqueActions.size !== value.actions.length)
        return null;
    if (value.phase === 'starting' || value.phase === 'ready') {
        if (value.incident !== null || value.actions.length !== 0)
            return null;
        return {
            schemaVersion: 1,
            sequence: value.sequence,
            phase: value.phase,
            incident: null,
            actions: [],
        };
    }
    const incident = validateDiagnosticIncident(value.incident);
    if (!incident.ok || !incident.incident.recovery || incident.incident.recovery.state !== value.phase)
        return null;
    return {
        schemaVersion: 1,
        sequence: value.sequence,
        phase: value.phase,
        incident: incident.incident,
        actions: value.actions,
    };
}
function readBoundedRegularFile(filename, maximumBytes) {
    let descriptor;
    try {
        const before = fs.lstatSync(filename);
        if (!before.isFile() || before.isSymbolicLink() || before.size < 1 || before.size > maximumBytes)
            return null;
        descriptor = fs.openSync(filename, 'r');
        const opened = fs.fstatSync(descriptor);
        const after = fs.lstatSync(filename);
        if (!opened.isFile() || after.isSymbolicLink() || opened.dev !== after.dev || opened.ino !== after.ino
            || opened.size !== before.size || opened.size > maximumBytes)
            return null;
        const data = fs.readFileSync(descriptor);
        if (data.length !== opened.size || data.length > maximumBytes)
            return null;
        return data;
    }
    catch {
        return null;
    }
    finally {
        if (descriptor !== undefined) {
            try {
                fs.closeSync(descriptor);
            }
            catch { /* best effort cleanup */ }
        }
    }
}
function hasRealProjectionDirectories(stateDirectory) {
    try {
        const diagnosticsDirectory = path.join(stateDirectory, 'diagnostics');
        const runtimeDirectory = path.join(diagnosticsDirectory, 'runtime');
        return [diagnosticsDirectory, runtimeDirectory].every((directory) => {
            const stats = fs.lstatSync(directory);
            return stats.isDirectory() && !stats.isSymbolicLink();
        });
    }
    catch {
        return false;
    }
}
/** Read only the Go-owned last-complete snapshot for this exact child session. */
export function readDesktopRuntimeProjection({ env = process.env, isProcessAlive = processIsAlive, now = new Date(), } = {}) {
    const stateDirectory = env.HYPERCANVAS_APP_STATE_DIR?.trim();
    const publisherId = env.HYPERCANVAS_DESKTOP_RUNTIME_ID?.trim();
    const parentPid = parseParentPid(env.HYPERCANVAS_DESKTOP_PARENT_PID);
    if (!stateDirectory || !publisherId || !publisherPattern.test(publisherId) || parentPid === null)
        return null;
    if (!isProcessAlive(parentPid))
        return null;
    const resolvedStateDirectory = path.resolve(stateDirectory);
    if (!hasRealProjectionDirectories(resolvedStateDirectory))
        return null;
    const filename = path.join(resolvedStateDirectory, 'diagnostics', 'runtime', `${publisherId}.json`);
    const data = readBoundedRegularFile(filename, MAX_DIAGNOSTIC_SNAPSHOT_BYTES);
    if (!data)
        return null;
    let candidate;
    try {
        candidate = JSON.parse(data.toString('utf8'));
    }
    catch {
        return null;
    }
    if (!isRecord(candidate)
        || Object.keys(candidate).some((key) => !['schemaVersion', 'publisherId', 'ownerPid', 'publishedAt', 'snapshot'].includes(key))
        || candidate.schemaVersion !== 1
        || candidate.publisherId !== publisherId
        || candidate.ownerPid !== parentPid
        || typeof candidate.publishedAt !== 'string'
        || candidate.publishedAt.length > 40
        || !timestampPattern.test(candidate.publishedAt)
        || !Number.isFinite(Date.parse(candidate.publishedAt))
        || Date.parse(candidate.publishedAt) > now.getTime() + FUTURE_TIMESTAMP_TOLERANCE_MS)
        return null;
    const snapshot = validRuntimeSnapshot(candidate.snapshot);
    if (!snapshot)
        return null;
    return {
        schemaVersion: 1,
        publisherId,
        ownerPid: parentPid,
        publishedAt: candidate.publishedAt,
        snapshot,
    };
}
/** Read the Go-owned explicit global app appearance; invalid/missing means system. */
export function readDesktopAppearanceMode(stateDirectory) {
    const filename = path.join(path.resolve(stateDirectory), 'appearance.json');
    const data = readBoundedRegularFile(filename, MAX_APPEARANCE_BYTES);
    if (!data)
        return 'system';
    try {
        const value = JSON.parse(data.toString('utf8'));
        if (isRecord(value) && value.schemaVersion === 1 && typeof value.mode === 'string'
            && appearanceModes.has(value.mode))
            return value.mode;
    }
    catch { /* missing or corrupt preference safely follows system appearance */ }
    return 'system';
}
