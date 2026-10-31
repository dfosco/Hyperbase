/** Notebook/daemon-scoped Squad membership and numbered room operations. */
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import process from 'node:process';
import { SquadLedger, validateSquadMessage } from './squad-ledger.js';
import { connectedAgentIds, readSquadCanvas, wireSquadPeers } from './squad-canvas.js';
import { getAdapter, publish, registerEventNamespace } from './bus.js';
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function serviceError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}
function assertId(value, label) {
    if (typeof value !== 'string' || !SAFE_ID.test(value))
        throw serviceError(`${label} is required and must be a safe ID`);
}
function readJsonRecord(filePath, errorMessage) {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!isRecord(parsed))
        throw new Error(errorMessage);
    return parsed;
}
function asSquadMetadata(value, squadId) {
    if (typeof value.squadId !== 'string'
        || typeof value.workspaceId !== 'string'
        || typeof value.daemonId !== 'string'
        || typeof value.name !== 'string'
        || typeof value.leaderId !== 'string'
        || typeof value.createdAt !== 'string'
        || !isRecord(value.members)) {
        throw new Error(`Squad ${squadId} metadata is invalid`);
    }
    for (const member of Object.values(value.members)) {
        if (!isRecord(member) || (member.role !== 'leader' && member.role !== 'member')) {
            throw new Error(`Squad ${squadId} metadata is invalid`);
        }
    }
    if (value.broadcast !== undefined && (!isRecord(value.broadcast)
        || typeof value.broadcast.canvasId !== 'string' || !value.broadcast.canvasId.trim()
        || typeof value.broadcast.enabled !== 'boolean'))
        throw new Error(`Squad ${squadId} broadcast metadata is invalid`);
    return value;
}
function asAgentBinding(value) {
    if (!isRecord(value)
        || typeof value.widgetId !== 'string'
        || typeof value.agentId !== 'string'
        || typeof value.provider !== 'string'
        || typeof value.workspaceId !== 'string'
        || typeof value.daemonId !== 'string'
        || typeof value.updatedAt !== 'string'
        || (value.sessionId !== undefined && typeof value.sessionId !== 'string'))
        return null;
    return value;
}
const groupMutations = new Map();
export class SquadService {
    root;
    workspaceId;
    daemonId;
    baseDir;
    ledger;
    constructor({ root, workspaceId, daemonId }) {
        if (typeof root !== 'string' || !root.trim())
            throw serviceError('Notebook root is required');
        assertId(workspaceId, 'Notebook workspace ID');
        assertId(daemonId, 'Paseo daemon ID');
        this.root = root;
        this.workspaceId = workspaceId;
        this.daemonId = daemonId;
        this.baseDir = path.join(root, '.hypercanvas', 'squads');
        this.ledger = new SquadLedger({ root });
    }
    _metadataPath(squadId) {
        assertId(squadId, 'Squad ID');
        return path.join(this.baseDir, squadId, 'squad.json');
    }
    _readMetadata(squadId) {
        const metadataPath = this._metadataPath(squadId);
        if (!fs.existsSync(metadataPath))
            throw serviceError(`Squad ${squadId} not found`, 404);
        const metadata = asSquadMetadata(readJsonRecord(metadataPath, `Squad ${squadId} metadata is invalid`), squadId);
        if (metadata.workspaceId !== this.workspaceId || metadata.daemonId !== this.daemonId) {
            throw serviceError(`Squad ${squadId} belongs to a different Notebook workspace or Paseo daemon`, 403);
        }
        return metadata;
    }
    _readBindings(squadId) {
        const metadata = this._readMetadata(squadId);
        const bindingsPath = path.join(this.baseDir, squadId, 'agent-bindings.json');
        const persisted = fs.existsSync(bindingsPath)
            ? readJsonRecord(bindingsPath, `Agent bindings for Squad ${squadId} are invalid`)
            : { squadId, workspaceId: metadata.workspaceId, daemonId: metadata.daemonId, bindings: {}, history: [] };
        if (typeof persisted.squadId !== 'string'
            || typeof persisted.workspaceId !== 'string'
            || typeof persisted.daemonId !== 'string'
            || !isRecord(persisted.bindings)
            || !Array.isArray(persisted.history)
            || !persisted.history.every(isRecord)) {
            throw new Error(`Agent bindings for Squad ${squadId} are invalid`);
        }
        const bindings = {};
        for (const [widgetId, bindingValue] of Object.entries(persisted.bindings)) {
            const binding = asAgentBinding(bindingValue);
            if (!binding || binding.widgetId !== widgetId)
                throw new Error(`Agent bindings for Squad ${squadId} are invalid`);
            bindings[widgetId] = binding;
        }
        let state = {
            squadId: persisted.squadId,
            workspaceId: persisted.workspaceId,
            daemonId: persisted.daemonId,
            bindings,
            history: persisted.history,
        };
        if (state.workspaceId !== this.workspaceId || state.daemonId !== this.daemonId) {
            throw serviceError(`Agent bindings for Squad ${squadId} belong to a different Notebook workspace or Paseo daemon`, 403);
        }
        const auditPath = path.join(this.baseDir, squadId, 'agent-bindings.jsonl');
        if (fs.existsSync(auditPath)) {
            const content = fs.readFileSync(auditPath, 'utf8');
            if (content && !content.endsWith('\n'))
                throw new Error(`Agent binding audit for Squad ${squadId} has an incomplete final line`);
            const lines = content.split('\n').filter(Boolean);
            const events = lines.map((line, index) => {
                let event;
                try {
                    event = JSON.parse(line);
                }
                catch {
                    throw new Error(`Agent binding audit for Squad ${squadId} is invalid at line ${index + 1}`);
                }
                if (!isRecord(event) || typeof event.widgetId !== 'string' || !asAgentBinding(event.binding)) {
                    throw new Error(`Agent binding audit for Squad ${squadId} is invalid at line ${index + 1}`);
                }
                return event;
            });
            state = { ...state, history: events, bindings: { ...state.bindings } };
            for (const event of events)
                state.bindings[event.widgetId] = event.binding;
        }
        return state;
    }
    _writeBindings(squadId, state) {
        const bindingsPath = path.join(this.baseDir, squadId, 'agent-bindings.json');
        const tempPath = `${bindingsPath}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
        fs.writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, { flag: 'wx' });
        fs.renameSync(tempPath, bindingsPath);
    }
    async getAgentBinding(squadId, widgetId) {
        assertId(widgetId, 'Widget ID');
        const metadata = this._readMetadata(squadId);
        if (!metadata.members?.[widgetId])
            throw serviceError(`Widget ${widgetId} is not a member of Squad ${squadId}`, 403);
        return this._readBindings(squadId).bindings[widgetId] || null;
    }
    async findAgentBindings(agentId) {
        assertId(agentId, 'Paseo agent ID');
        if (!fs.existsSync(this.baseDir))
            return [];
        const matches = [];
        for (const entry of fs.readdirSync(this.baseDir, { withFileTypes: true })) {
            if (!entry.isDirectory())
                continue;
            try {
                const metadata = this._readMetadata(entry.name);
                const state = this._readBindings(entry.name);
                for (const [widgetId, binding] of Object.entries(state.bindings)) {
                    if (binding.agentId === agentId)
                        matches.push({ squadId: metadata.squadId, widgetId, binding });
                }
            }
            catch { /* ignore unrelated, stale or malformed Squad state */ }
        }
        return matches;
    }
    async appendSystemEvent(squadId, kind, description, data = null) {
        this._readMetadata(squadId);
        const entry = await this.ledger.appendSystem(squadId, kind, description, data);
        await this.notifyChanged(squadId);
        return entry;
    }
    async authorizeDeliveryRetry(squadId, widgetId, number, { force = false } = {}) {
        assertId(widgetId, 'Widget ID');
        const metadata = this._readMetadata(squadId);
        if (!metadata.members?.[widgetId])
            throw serviceError(`Widget ${widgetId} is not a member of Squad ${squadId}`, 403);
        const entry = await this.ledger.get(squadId, number);
        if (!entry || entry.inject !== true || !Array.isArray(entry.to) || entry.to.length === 0
            || entry.to.some((recipient) => typeof recipient !== 'string')) {
            throw serviceError(`Ledger entry ${number} is not an injectable direct message`, 400);
        }
        const recipients = entry.to;
        this.assertCanCoordinate(squadId, entry.author, recipients);
        if (entry.author !== widgetId && metadata.leaderId !== widgetId) {
            throw serviceError('Only the entry author or Squad leader may retry delivery', 403);
        }
        const events = await this.ledger.read(squadId);
        const latestByRecipient = new Map();
        for (const event of events) {
            const recipient = event.data?.recipient;
            if (event.kind === 'system.delivery.attempt' && event.data?.number === number
                && typeof recipient === 'string' && recipients.includes(recipient)) {
                latestByRecipient.set(recipient, event);
            }
        }
        const allRecipientsHaveNonFailedAttempt = recipients.every((recipient) => {
            const deliveryState = latestByRecipient.get(recipient)?.data?.state;
            return deliveryState !== undefined && deliveryState !== 'failed';
        });
        if (!force && allRecipientsHaveNonFailedAttempt) {
            throw serviceError('Delivery has a pending or uncertain outcome; an explicit force retry is required', 409);
        }
        return { entry, metadata, events };
    }
    async bindAgent(squadId, widgetId, { agentId, provider, sessionId = null, transition = 'created', reason = null } = {}) {
        assertId(widgetId, 'Widget ID');
        const metadata = this._readMetadata(squadId);
        if (!metadata.members?.[widgetId])
            throw serviceError(`Widget ${widgetId} is not a member of Squad ${squadId}`, 403);
        assertId(agentId, 'Paseo agent ID');
        assertId(provider, 'Provider ID');
        if (sessionId !== null && (typeof sessionId !== 'string' || !sessionId.trim())) {
            throw serviceError('sessionId must be a non-empty string when supplied');
        }
        if (typeof transition !== 'string' || !['created', 'resumed', 'replaced'].includes(transition)) {
            throw serviceError('Invalid binding transition');
        }
        const state = this._readBindings(squadId);
        if (state.workspaceId !== this.workspaceId || state.daemonId !== this.daemonId) {
            throw serviceError('Binding workspace/daemon does not match the active Squad', 403);
        }
        const previous = state.bindings[widgetId] || null;
        const binding = {
            widgetId,
            agentId,
            provider,
            ...(sessionId ? { sessionId } : {}),
            workspaceId: this.workspaceId,
            daemonId: this.daemonId,
            updatedAt: new Date().toISOString(),
        };
        state.bindings[widgetId] = binding;
        const event = {
            timestamp: binding.updatedAt,
            widgetId,
            transition: previous?.agentId === agentId ? 'resumed' : (previous ? 'replaced' : transition),
            ...(previous ? { previousAgentId: previous.agentId } : {}),
            ...(typeof reason === 'string' && reason.trim() ? { reason: reason.trim().slice(0, 500) } : {}),
            agentId,
            provider,
            binding,
        };
        const auditPath = path.join(this.baseDir, squadId, 'agent-bindings.jsonl');
        fs.appendFileSync(auditPath, `${JSON.stringify(event)}\n`, 'utf8');
        state.history.push(event);
        this._writeBindings(squadId, state);
        return binding;
    }
    async mutateGroup(operation) {
        const key = `${this.baseDir}:${this.workspaceId}:${this.daemonId}`;
        const pending = (groupMutations.get(key) || Promise.resolve()).catch(() => { }).then(operation);
        groupMutations.set(key, pending);
        try {
            return await pending;
        }
        finally {
            if (groupMutations.get(key) === pending)
                groupMutations.delete(key);
        }
    }
    create(input) {
        return this.mutateGroup(() => this.createGroup(input));
    }
    async createGroup({ leaderId, memberIds = [], name = null, canvasId = null }, wire = true) {
        assertId(leaderId, 'Leader ID');
        if (!Array.isArray(memberIds) || memberIds.some((id) => typeof id !== 'string' || !SAFE_ID.test(id))) {
            throw serviceError('memberIds must be an array of safe widget IDs');
        }
        const ids = [...new Set([leaderId, ...memberIds])].sort();
        if (canvasId !== null && (typeof canvasId !== 'string' || !canvasId.trim()))
            throw serviceError('canvasId must be a non-empty string');
        // Validate the complete request and room conflicts before writing any connectors.
        const resolvedCanvasId = wireSquadPeers(this.root, canvasId, leaderId, ids, false);
        if (resolvedCanvasId) {
            const rooms = new Map();
            for (const id of ids)
                for (const room of await this.list(id))
                    rooms.set(room.squadId, room);
            const existing = [...rooms.values()];
            const matching = existing.find((squad) => Object.keys(squad.members).sort().join(',') === ids.join(',')
                && (!squad.broadcast || squad.broadcast.canvasId === resolvedCanvasId));
            this.assertNoOverlappingBroadcast(existing, ids, resolvedCanvasId, matching?.squadId);
            if (wire)
                wireSquadPeers(this.root, resolvedCanvasId, leaderId, ids);
            if (matching)
                return this.changeBroadcast(resolvedCanvasId, leaderId, true, matching.squadId);
        }
        const squadId = `squad_${randomBytes(8).toString('hex')}`;
        fs.mkdirSync(this.baseDir, { recursive: true });
        const directory = path.join(this.baseDir, squadId);
        fs.mkdirSync(directory, { recursive: false });
        const metadata = {
            squadId,
            workspaceId: this.workspaceId,
            daemonId: this.daemonId,
            name: typeof name === 'string' && name.trim() ? name.trim() : squadId,
            leaderId,
            members: Object.fromEntries(ids.map((id) => [id, { role: id === leaderId ? 'leader' : 'member' }])),
            createdAt: new Date().toISOString(),
            ...(resolvedCanvasId ? { broadcast: { canvasId: resolvedCanvasId, enabled: true } } : {}),
        };
        const filePath = this._metadataPath(squadId);
        const tempPath = `${filePath}.${process.pid}.tmp`;
        fs.writeFileSync(tempPath, `${JSON.stringify(metadata, null, 2)}\n`, { flag: 'wx' });
        fs.renameSync(tempPath, filePath);
        await this.notifyChanged(squadId);
        return metadata;
    }
    async list(widgetId) {
        assertId(widgetId, 'Widget ID');
        if (!fs.existsSync(this.baseDir))
            return [];
        return fs.readdirSync(this.baseDir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => {
            try {
                const metadata = this._readMetadata(entry.name);
                return { ...metadata, activeMemberIds: this.activeMemberIds(metadata), agentBindings: this._readBindings(entry.name).bindings };
            }
            catch {
                return null;
            }
        })
            .filter((metadata) => Boolean(metadata?.members[widgetId]));
    }
    async writeMetadata(metadata) {
        const filePath = this._metadataPath(metadata.squadId);
        const temporary = `${filePath}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
        fs.writeFileSync(temporary, `${JSON.stringify(metadata, null, 2)}\n`, { flag: 'wx' });
        fs.renameSync(temporary, filePath);
        await this.notifyChanged(metadata.squadId);
        return metadata;
    }
    async notifyChanged(squadId) {
        if (!getAdapter())
            return;
        registerEventNamespace('squad', { events: ['changed'] });
        // Invalidation only. The room and membership remain the source of truth.
        await publish('squad-state', { type: 'squad:changed', senderId: 'system', payload: { squadId } })
            .catch((error) => console.error('[squad] Could not announce state change:', error));
    }
    activeMemberIds(metadata) {
        if (metadata.broadcast?.enabled === false)
            return [];
        try {
            const target = readSquadCanvas(this.root, metadata.broadcast?.canvasId || null, metadata.leaderId);
            return target ? connectedAgentIds(target.canvas, metadata.leaderId, Object.keys(metadata.members)) : Object.keys(metadata.members);
        }
        catch {
            return [];
        } // Missing/removed canvas cannot authorize communication.
    }
    assertCanCoordinate(squadId, author, recipients) {
        const metadata = this._readMetadata(squadId);
        const active = this.activeMemberIds(metadata);
        if (!active.includes(author) || recipients.some((id) => !active.includes(id))) {
            throw serviceError('Broadcast is off or these agents are no longer connected to the Squad leader', 409);
        }
    }
    assertNoOverlappingBroadcast(squads, ids, canvasId, except) {
        if (squads.some((squad) => squad.squadId !== except && squad.broadcast?.enabled !== false
            && (!squad.broadcast || squad.broadcast.canvasId === canvasId) && this.activeMemberIds(squad).length > 1
            && this.activeMemberIds(squad).some((id) => ids.includes(id)))) {
            throw serviceError('Connected agents already belong to another active Squad; turn its broadcast off before combining groups', 409);
        }
    }
    setBroadcast(canvasId, widgetId, enabled, squadId) {
        return this.mutateGroup(() => this.changeBroadcast(canvasId, widgetId, enabled, squadId));
    }
    async changeBroadcast(canvasId, widgetId, enabled, squadId) {
        assertId(widgetId, 'Widget ID');
        if (typeof canvasId !== 'string' || !canvasId.trim() || typeof enabled !== 'boolean')
            throw serviceError('canvasId and boolean enabled are required');
        const target = readSquadCanvas(this.root, canvasId, widgetId);
        if (!target)
            throw serviceError('Canvas not found', 404);
        const ids = connectedAgentIds(target.canvas, widgetId);
        if (!ids.includes(widgetId))
            throw serviceError('Broadcast requires an agent widget');
        const own = await this.list(widgetId);
        let squad = squadId ? own.find((item) => item.squadId === squadId) : undefined;
        if (squadId && !squad)
            throw serviceError('Only a Squad member may change its broadcast mode', 403);
        if (squad?.broadcast && squad.broadcast.canvasId !== canvasId)
            throw serviceError('Squad belongs to another canvas', 409);
        if (!squad)
            squad = own.find((item) => (!item.broadcast || item.broadcast.canvasId === canvasId)
                && Object.keys(item.members).sort().join(',') === ids.join(','));
        if (!squad)
            squad = own.find((item) => item.broadcast?.canvasId === canvasId
                && ids.includes(item.leaderId) && ids.every((id) => Boolean(item.members[id])));
        if (!squad)
            squad = own.find((item) => item.broadcast?.canvasId === canvasId && item.broadcast.enabled);
        if (!enabled) {
            if (!squad)
                return null;
            return this.writeMetadata({ ...this._readMetadata(squad.squadId), broadcast: { canvasId, enabled: false } });
        }
        if (ids.length < 2)
            throw serviceError('Connect another agent before turning broadcast on');
        const overlapping = new Map();
        for (const id of ids)
            for (const room of await this.list(id)) {
                if (room.broadcast?.enabled !== false && (!room.broadcast || room.broadcast.canvasId === canvasId)
                    && room.activeMemberIds.length > 1)
                    overlapping.set(room.squadId, room);
            }
        if (!squad && overlapping.size === 1) {
            const candidate = [...overlapping.values()][0];
            squad = { ...candidate, activeMemberIds: this.activeMemberIds(candidate), agentBindings: this._readBindings(candidate.squadId).bindings };
        }
        this.assertNoOverlappingBroadcast([...overlapping.values()], ids, canvasId, squad?.squadId);
        if (!squad)
            return this.createGroup({ leaderId: widgetId, memberIds: ids.filter((id) => id !== widgetId), canvasId }, false);
        if (!ids.includes(squad.leaderId))
            throw serviceError('Reconnect the Squad leader before enabling its broadcast', 409);
        const metadata = this._readMetadata(squad.squadId);
        return this.writeMetadata({
            ...metadata,
            members: { ...metadata.members, ...Object.fromEntries(ids.filter((id) => !metadata.members[id]).map((id) => [id, { role: 'member' }])) },
            broadcast: { canvasId, enabled: true },
        });
    }
    async append(squadId, widgetId, message) {
        assertId(widgetId, 'Widget ID');
        const metadata = this._readMetadata(squadId);
        if (!metadata.members?.[widgetId])
            throw serviceError(`Widget ${widgetId} is not a member of Squad ${squadId}`, 403);
        const validation = validateSquadMessage(message);
        if (!validation.valid)
            throw serviceError(validation.errors.join('; '));
        if (!isRecord(message))
            throw serviceError('Message must be an object');
        const validatedMessage = message;
        if (validatedMessage.to && validatedMessage.to.some((id) => !metadata.members[id])) {
            throw serviceError('Every recipient in to must be a Squad member');
        }
        if (validatedMessage.to?.length)
            this.assertCanCoordinate(squadId, widgetId, validatedMessage.to);
        if (validatedMessage.replyTo) {
            const original = await this.ledger.get(squadId, validatedMessage.replyTo);
            if (!original)
                throw serviceError(`Ledger entry ${validatedMessage.replyTo} not found in Squad ${squadId}`, 404);
            this.assertCanCoordinate(squadId, widgetId, [original.author]);
            if (original.response === 'result' && validatedMessage.response === 'ack' && widgetId !== metadata.leaderId) {
                throw serviceError('Only the current Squad leader may acknowledge a result', 403);
            }
            if (validatedMessage.response && original.kind === 'instruction'
                && (!Array.isArray(original.to) || !original.to.includes(widgetId))) {
                throw serviceError(`Widget ${widgetId} was not a recipient of instruction ${validatedMessage.replyTo}`, 403);
            }
        }
        const entry = await this.ledger.append(squadId, widgetId, validatedMessage);
        await this.notifyChanged(squadId);
        return entry;
    }
    async read(squadId, widgetId, options = {}) {
        assertId(widgetId, 'Widget ID');
        if (options.after !== undefined && (!Number.isSafeInteger(options.after) || options.after < 0)) {
            throw serviceError('after must be a non-negative safe integer');
        }
        if (options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 1)) {
            throw serviceError('limit must be a positive safe integer');
        }
        const metadata = this._readMetadata(squadId);
        if (!metadata.members?.[widgetId])
            throw serviceError(`Widget ${widgetId} is not a member of Squad ${squadId}`, 403);
        return this.ledger.read(squadId, options);
    }
    async get(squadId, widgetId, number) {
        assertId(widgetId, 'Widget ID');
        const metadata = this._readMetadata(squadId);
        if (!metadata.members?.[widgetId])
            throw serviceError(`Widget ${widgetId} is not a member of Squad ${squadId}`, 403);
        return this.ledger.get(squadId, number);
    }
    async reconcile(squadId, widgetId) {
        assertId(widgetId, 'Widget ID');
        const metadata = this._readMetadata(squadId);
        if (!metadata.members?.[widgetId])
            throw serviceError(`Widget ${widgetId} is not a member of Squad ${squadId}`, 403);
        const entries = await this.ledger.read(squadId);
        const active = this.activeMemberIds(metadata);
        if (!active.includes(widgetId))
            return [];
        return entries.filter((entry) => entry.kind === 'instruction' && active.includes(entry.author))
            .flatMap((instruction) => (instruction.to || []).filter((recipient) => active.includes(recipient)
            && (recipient === widgetId || metadata.leaderId === widgetId)).map((recipient) => ({ instruction, recipient })))
            .map(({ instruction, recipient }) => {
            const replies = entries.filter((entry) => entry.replyTo === instruction.number && entry.author === recipient);
            const latestReply = replies.at(-1) || null;
            const result = replies.filter((entry) => entry.response === 'result').at(-1) || null;
            const leaderAcknowledgement = result
                ? entries.find((entry) => entry.replyTo === result.number && entry.author === metadata.leaderId && entry.response === 'ack') || null
                : null;
            let state = 'awaiting_ack';
            if (leaderAcknowledgement)
                state = 'completed';
            else if (result)
                state = 'awaiting_leader_ack';
            else if (latestReply?.response === 'blocked')
                state = 'blocked';
            else if (latestReply?.response === 'status')
                state = 'in_progress';
            else if (latestReply?.response === 'ack')
                state = 'acknowledged';
            return {
                number: instruction.number,
                instruction,
                recipient,
                state,
                replies,
                latestReply,
                ...(result ? { result } : {}),
                ...(leaderAcknowledgement ? { leaderAcknowledgement } : {}),
            };
        });
    }
    promoteLeader(squadId, actorWidgetId, targetWidgetId) {
        return this.mutateGroup(() => this.promoteGroupLeader(squadId, actorWidgetId, targetWidgetId));
    }
    async promoteGroupLeader(squadId, actorWidgetId, targetWidgetId) {
        assertId(actorWidgetId, 'Widget ID');
        assertId(targetWidgetId, 'Target widget ID');
        const metadata = this._readMetadata(squadId);
        if (!metadata.members?.[actorWidgetId])
            throw serviceError(`Widget ${actorWidgetId} is not a member of Squad ${squadId}`, 403);
        if (metadata.leaderId !== actorWidgetId)
            throw serviceError('Only the current Squad leader may promote a replacement', 403);
        if (!metadata.members?.[targetWidgetId])
            throw serviceError(`Widget ${targetWidgetId} is not a member of Squad ${squadId}`, 400);
        if (targetWidgetId === actorWidgetId)
            return metadata;
        const updated = {
            ...metadata,
            leaderId: targetWidgetId,
            members: Object.fromEntries(Object.entries(metadata.members).map(([widgetId, member]) => [
                widgetId,
                { ...member, role: widgetId === targetWidgetId ? 'leader' : 'member' },
            ])),
        };
        await this.ledger.appendSystem(squadId, 'system.leader.promoted', `${actorWidgetId} promoted ${targetWidgetId} to Squad leader`, {
            previousLeaderId: actorWidgetId,
            leaderId: targetWidgetId,
        });
        return this.writeMetadata(updated);
    }
    async nudgeMember(squadId, actorWidgetId, targetWidgetId, description = 'Read the Squad room and continue outstanding addressed work without duplicating active or completed work.') {
        assertId(actorWidgetId, 'Widget ID');
        assertId(targetWidgetId, 'Target widget ID');
        const metadata = this._readMetadata(squadId);
        if (metadata.leaderId !== actorWidgetId)
            throw serviceError('Only the current Squad leader may nudge a member', 403);
        if (!metadata.members?.[targetWidgetId])
            throw serviceError(`Widget ${targetWidgetId} is not a member of Squad ${squadId}`, 400);
        if (typeof description !== 'string' || !description.trim())
            throw serviceError('Nudge description is required');
        return this.append(squadId, actorWidgetId, {
            kind: 'instruction',
            description: description.trim(),
            to: [targetWidgetId],
            inject: true,
        });
    }
}
