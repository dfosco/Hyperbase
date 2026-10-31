/**
 * Agent Chat Store — framework-agnostic conversation state for Paseo agents.
 *
 * Implements the reconciliation rules distilled from getpaseo/paseo's own chat
 * (see .agents/plans/paseo-agent-chat-ui-exploration.md):
 *
 * - Per-agent cursor `{ epoch, startSeq, endSeq }` as the spine. Stream events
 *   are gated: stale → drop, contiguous → apply + advance, gap → drop + refetch
 *   after the cursor, epoch change → tail refetch (seq 1 of a new epoch resets).
 * - Head/tail model: assistant text streams in `head`; completed items flush to
 *   `items` (tail). Terminal turn events flush the head.
 * - Per-type row identity: tool_call by callId (status precedence), user by
 *   clientMessageId || messageId, assistant extends by messageId.
 * - Optimistic sends with a clientMessageId submission ledger; the optimistic
 *   row is only removed while still unreconciled.
 * - Queued stream events are drained before a fetched page is applied, so a
 *   canonical page can't clobber just-received live chunks.
 *
 * Zero npm dependencies. Transport is injectable for tests.
 */
function validOptionalNumber(value) {
    return value === undefined || value === null || (typeof value === 'number' && Number.isFinite(value));
}
function validOptionalString(value) {
    return value === undefined || value === null || typeof value === 'string';
}
function parseTimelineCursor(value, name) {
    if (value === undefined)
        return undefined;
    if (!isRecord(value) || !validOptionalString(value.epoch) || !validOptionalNumber(value.seq)) {
        throw new TypeError(`Invalid agent timeline ${name}`);
    }
    return value;
}
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isAgentChatItem(value) {
    return isRecord(value) && typeof value.type === 'string'
        && (value.text === undefined || typeof value.text === 'string')
        && (value.messageId === undefined || typeof value.messageId === 'string')
        && (value.clientMessageId === undefined || typeof value.clientMessageId === 'string');
}
function parseStreamEvent(value) {
    if (!isRecord(value) || typeof value.type !== 'string')
        return null;
    switch (value.type) {
        case 'timeline':
            if (value.item !== undefined && !isAgentChatItem(value.item))
                return null;
            if (value.epoch !== undefined && value.epoch !== null && typeof value.epoch !== 'string')
                return null;
            if (value.seq !== undefined && value.seq !== null && (typeof value.seq !== 'number' || !Number.isFinite(value.seq)))
                return null;
            return value;
        case 'turn_started':
        case 'turn_completed':
        case 'turn_canceled':
            return value;
        case 'turn_failed':
        case 'permission_requested':
        case 'permission_resolved':
        case 'attention_required':
            return value;
        default:
            return null;
    }
}
function parseTimelinePage(value) {
    if (!isRecord(value))
        throw new TypeError('Invalid agent timeline response');
    if (value.entries !== undefined && !Array.isArray(value.entries))
        throw new TypeError('Invalid agent timeline entries');
    if (value.epoch !== undefined && typeof value.epoch !== 'string')
        throw new TypeError('Invalid agent timeline epoch');
    if (value.reset !== undefined && typeof value.reset !== 'boolean')
        throw new TypeError('Invalid agent timeline reset marker');
    if (value.hasOlder !== undefined && typeof value.hasOlder !== 'boolean')
        throw new TypeError('Invalid agent timeline older marker');
    const startCursor = parseTimelineCursor(value.startCursor, 'start cursor');
    const endCursor = parseTimelineCursor(value.endCursor, 'end cursor');
    let window;
    if (value.window !== undefined) {
        if (!isRecord(value.window) || !validOptionalNumber(value.window.minSeq) || !validOptionalNumber(value.window.maxSeq)) {
            throw new TypeError('Invalid agent timeline window');
        }
        window = value.window;
    }
    let agent;
    if (value.agent !== undefined) {
        if (!isRecord(value.agent))
            throw new TypeError('Invalid agent timeline agent state');
        agent = value.agent;
    }
    const entries = (value.entries || []).map((entry) => {
        if (!isRecord(entry))
            throw new TypeError('Invalid agent timeline entry');
        const item = entry.item === undefined ? entry : entry.item;
        if (!isAgentChatItem(item))
            throw new TypeError('Invalid agent timeline item');
        return entry.item === undefined ? item : { item };
    });
    return { ...value, startCursor, endCursor, window, agent, entries };
}
function errorMessage(error, fallback) {
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) {
        return error.message;
    }
    return fallback;
}
export function generateMessageId() {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 10);
    return `msg_${ts}_${rand}`;
}
// ── Row identity ───────────────────────────────────────────────────────────
const TOOL_STATUS_RANK = { running: 0, canceled: 1, completed: 2, failed: 3 };
export function itemIdentity(item) {
    if (!item)
        return null;
    switch (item.type) {
        case 'user_message':
            return item.clientMessageId || item.messageId || null;
        case 'assistant_message':
            return item.messageId || null;
        case 'tool_call':
            return item.callId || null;
        case 'permission_requested':
            return item.requestId || null;
        default:
            return null;
    }
}
function mergeToolCall(prev, next) {
    const prevRank = TOOL_STATUS_RANK[prev.status || ''] ?? 0;
    const nextRank = TOOL_STATUS_RANK[next.status || ''] ?? 0;
    return {
        ...prev,
        ...next,
        ...((nextRank >= prevRank ? next.status : prev.status) === undefined
            ? {}
            : { status: nextRank >= prevRank ? next.status : prev.status }),
        detail: next.detail || prev.detail,
        error: next.error !== undefined ? next.error : prev.error,
    };
}
function mergeIdentityMatch(prev, next) {
    if (prev.type !== next.type)
        return null;
    if (prev.type === 'tool_call' && next.type === 'tool_call')
        return mergeToolCall(prev, next);
    const prevId = itemIdentity(prev);
    const nextId = itemIdentity(next);
    if (prevId != null && nextId != null) {
        if (prev.type === 'user_message' && prev.clientMessageId && next.clientMessageId && prev.clientMessageId !== next.clientMessageId)
            return null;
        return prevId === nextId ? { ...prev, ...next } : null;
    }
    // Conservative fallback for projected rows: equal text within a short
    // window matches (never across different clientMessageIds).
    if (prev.type === 'user_message' && next.type === 'user_message'
        && prev.clientMessageId && next.clientMessageId
        && prev.clientMessageId !== next.clientMessageId)
        return null;
    if (prev.text !== undefined && next.text !== undefined && prev.text === next.text
        && prev.messageId === undefined && next.messageId === undefined) {
        return { ...prev, ...next };
    }
    return null;
}
function upsertItem(items, next) {
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (!item)
            continue;
        const merged = mergeIdentityMatch(item, next);
        if (merged) {
            const before = items.slice(0, i);
            const after = items.slice(i + 1);
            return [...before, merged, ...after];
        }
        // Assistant text extends the last assistant row.
        if (next.type === 'assistant_message' && item.type === 'assistant_message'
            && next.messageId === undefined && item.messageId === undefined && !next.cursor) {
            const before = items.slice(0, i);
            const after = items.slice(i + 1);
            return [...before, { ...item, text: `${item.text || ''}${next.text || ''}` }, ...after];
        }
    }
    return [...items, next];
}
// ── Stream event classification ────────────────────────────────────────────
export function classifyStreamSeq(cursor, epoch, seq) {
    if (!cursor || !cursor.epoch)
        return 'no_cursor';
    if (cursor.epoch !== epoch)
        return 'drop_epoch';
    if (seq <= cursor.endSeq)
        return 'drop_stale';
    if (seq === cursor.endSeq + 1)
        return 'accept';
    return 'gap';
}
function upsertPermission(permissions, request) {
    if (!isRecord(request) || typeof request.id !== 'string')
        return permissions;
    if (!request?.id)
        return permissions;
    const existing = permissions.find((p) => p.id === request.id);
    if (existing)
        return permissions.map((p) => (p.id === request.id ? { ...p, ...request } : p));
    return [...permissions, request];
}
function applyAssistantDelta(head, item) {
    const last = head.length > 0 ? head[head.length - 1] : null;
    if (last && last.type === 'assistant_message') {
        const next = { ...last };
        if (item.messageId !== undefined)
            next.messageId = item.messageId;
        next.text = `${next.text || ''}${item.text || ''}`;
        return [...head.slice(0, -1), next];
    }
    return [...head, { ...item }];
}
// ── Pure reducers (exported for tests) ─────────────────────────────────────
export function createEmptyState(agentId = '') {
    return {
        agentId,
        initialized: false,
        cursor: null,
        hasOlder: false,
        olderAvailable: false,
        items: [],
        head: [],
        permissions: [],
        submissions: [],
        turnActive: false,
        cancelling: false,
        attention: null,
        needCatchUp: false,
        error: null,
        sendError: null,
    };
}
export function applyStreamEvent(state, untrustedEvent) {
    const event = parseStreamEvent(untrustedEvent);
    if (!event)
        return state;
    let next = state;
    switch (event?.type) {
        case 'timeline': {
            const item = event.item;
            if (!item)
                return state;
            if (event.seq != null && event.epoch) {
                const cls = classifyStreamSeq(state.cursor, event.epoch, event.seq);
                if (cls === 'drop_stale')
                    return state;
                if (cls === 'drop_epoch') {
                    // First row of a new epoch bootstraps a clean visible timeline.
                    if (event.seq === 1) {
                        return {
                            ...next,
                            cursor: { epoch: event.epoch, startSeq: 1, endSeq: 1 },
                            items: [],
                            head: [],
                            initialized: true,
                            turnActive: false,
                        };
                    }
                    return { ...next, needCatchUp: true };
                }
                if (cls === 'gap')
                    return { ...next, needCatchUp: true };
                next = {
                    ...next,
                    cursor: { ...next.cursor, endSeq: event.seq },
                };
            }
            // Non-seq events (no cursor yet) stream into the visible overlay.
            if (item.type === 'assistant_message' || item.type === 'reasoning') {
                return { ...next, head: applyAssistantDelta(next.head, item) };
            }
            const stamped = event.seq != null && event.epoch
                ? { ...item, cursor: { epoch: event.epoch, seq: event.seq } }
                : item;
            return { ...next, items: upsertItem(next.items, stamped) };
        }
        case 'turn_started':
            return { ...next, turnActive: true };
        case 'turn_completed':
            return { ...next, turnActive: false, attention: null, head: [] };
        case 'turn_failed':
            return { ...next, turnActive: false, error: event.error || 'Turn failed', head: [] };
        case 'turn_canceled':
            return { ...next, turnActive: false, cancelling: false, head: [] };
        case 'permission_requested':
            return { ...next, turnActive: true, permissions: upsertPermission(next.permissions, event.request) };
        case 'permission_resolved':
            return {
                ...next,
                permissions: next.permissions.filter((p) => p.id !== event.requestId),
            };
        case 'attention_required':
            return { ...next, attention: event.reason || null, turnActive: false };
        default:
            return state;
    }
}
/**
 * Drain queued stream events into state (used before fetched pages land).
 */
export function applyStreamEvents(state, events) {
    let next = state;
    for (const event of events)
        next = applyStreamEvent(next, event);
    return next;
}
function pageBounds(page) {
    const window = page.window || {};
    return {
        epoch: page.epoch || page.startCursor?.epoch || '',
        maxSeq: window.maxSeq ?? page.endCursor?.seq ?? null,
        startSeq: window.minSeq ?? page.startCursor?.seq ?? null,
    };
}
function pageItems(page) {
    const entries = page.entries || [];
    const items = [];
    for (const entry of entries) {
        const item = isRecord(entry) && isAgentChatItem(entry.item) ? entry.item : entry;
        if (isAgentChatItem(item))
            items.push(item);
    }
    return items;
}
/**
 * Apply a fetched timeline page. Directions:
 * - reset (page.reset or first load) → replace
 * - 'tail'/'after' → resume-tail policy (epoch → replace; adds nothing → discard;
 *   server rewound → replace; gap → replace with continuity; else append)
 * - 'before' → prepend merge, update hasOlder only when coverage expanded
 */
export function applyTimelinePage(state, page, { direction = 'tail' } = {}) {
    const { epoch, maxSeq, startSeq } = pageBounds(page);
    const fetched = pageItems(page);
    const submitting = state.submissions;
    const replaceState = (items, cursor) => ({
        ...state,
        initialized: true,
        needCatchUp: false,
        cursor,
        items,
        head: [],
        // Only in-flight (unacknowledged) submissions survive a replacement.
        submissions: submitting,
    });
    if (page.reset || !state.initialized || !state.cursor) {
        const items = fetched.map((item) => ({ ...item }));
        return {
            ...replaceState(items, epoch ? { epoch, startSeq: startSeq ?? 0, endSeq: maxSeq ?? 0 } : null),
            hasOlder: Boolean(page.hasOlder),
            olderAvailable: Boolean(page.hasOlder),
        };
    }
    if (direction === 'before') {
        if (!epoch || epoch !== state.cursor.epoch)
            return state;
        // Coverage must expand for hasOlder to flip.
        const expanded = startSeq != null && startSeq < state.cursor.startSeq;
        if (!expanded)
            return state;
        let merged = [...fetched.map((item) => ({ ...item }))];
        for (const item of state.items)
            merged = upsertItem(merged, item);
        return {
            ...state,
            items: merged,
            cursor: { ...state.cursor, startSeq: startSeq },
            hasOlder: Boolean(page.hasOlder),
            olderAvailable: Boolean(page.hasOlder),
        };
    }
    // Resume-tail policy for 'tail'/'after' pages.
    if (!epoch || epoch !== state.cursor.epoch) {
        return {
            ...replaceState(fetched.map((item) => ({ ...item })), epoch ? { epoch, startSeq: startSeq ?? 0, endSeq: maxSeq ?? 0 } : null),
        };
    }
    if (maxSeq == null)
        return { ...state, needCatchUp: false };
    if (maxSeq <= state.cursor.endSeq) {
        // Page adds nothing; still harvest acknowledgements from canonical rows.
        return { ...state, needCatchUp: false, submissions: submitAcknowledged(state, fetched) };
    }
    const pageStart = startSeq ?? 0;
    if (pageStart > state.cursor.endSeq + 1) {
        // Gap in the middle — atomic replace, keep live coverage of submissions.
        return {
            ...replaceState(fetched.map((item) => ({ ...item })), { epoch, startSeq: pageStart, endSeq: maxSeq }),
        };
    }
    let items = state.items;
    for (const item of fetched) {
        const stamped = {
            ...item,
            ...(epoch ? { cursor: { epoch, seq: maxSeq } } : {}),
        };
        items = upsertItem(items, stamped);
    }
    const acknowledged = submitAcknowledged(state, fetched);
    return {
        ...state,
        initialized: true,
        needCatchUp: false,
        cursor: { epoch, startSeq: state.cursor.startSeq, endSeq: maxSeq },
        items,
        submissions: acknowledged,
    };
}
/**
 * Canonical rows can acknowledge optimistic submissions (dual-path ack:
 * RPC settle + canonical observation).
 */
export function submitAcknowledged(state, fetchedCanonical) {
    if (state.submissions.length === 0)
        return state.submissions;
    const canonicalClientIds = new Set();
    for (const item of fetchedCanonical) {
        if (item.type === 'user_message' && item.clientMessageId)
            canonicalClientIds.add(item.clientMessageId);
        if (item.type === 'user_message' && item.messageId)
            canonicalClientIds.add(item.messageId);
    }
    if (canonicalClientIds.size === 0)
        return state.submissions;
    return state.submissions.filter((s) => !canonicalClientIds.has(s.clientMessageId) && !canonicalClientIds.has(s.messageId || ''));
}
// ── Submission ledger ──────────────────────────────────────────────────────
export function beginSubmission(state, clientMessageId, text) {
    const optimistic = { type: 'user_message', text, clientMessageId };
    let items = state.items;
    const existing = items.find((item) => itemIdentity(item) === clientMessageId);
    if (existing)
        throw new Error(`Submitted user message already exists: ${clientMessageId}`);
    items = [...items, optimistic];
    return {
        ...state,
        items,
        turnActive: true,
        submissions: [...state.submissions, { clientMessageId }],
    };
}
export function rejectSubmission(state, clientMessageId) {
    const submissions = state.submissions.filter((s) => s.clientMessageId !== clientMessageId);
    const canonical = state.items.some((item) => item.type === 'user_message' && item.messageId !== undefined
        && (item.clientMessageId === clientMessageId || itemIdentity(item) === clientMessageId));
    const items = canonical
        ? state.items
        : state.items.filter((item) => itemIdentity(item) !== clientMessageId);
    return { ...state, items, submissions, sendError: 'Send failed' };
}
export function settleSubmission(state, clientMessageId) {
    return {
        ...state,
        submissions: state.submissions.filter((s) => s.clientMessageId !== clientMessageId),
    };
}
// ── Store with transport ───────────────────────────────────────────────────
export class AgentChatStore {
    state;
    constructor({ transport, agentId = '' }) {
        this.#transport = transport;
        this.#agentId = agentId;
        this.state = createEmptyState(agentId);
        this.#listeners = new Set();
        this.#streamQueue = [];
        this.#fetchInFlight = null;
        this.#loadOlderInFlight = false;
    }
    #transport;
    #agentId;
    #listeners;
    #streamQueue;
    #fetchInFlight;
    #loadOlderInFlight;
    get agentId() { return this.#agentId; }
    setAgentId(agentId) {
        this.#agentId = agentId;
        this.state = createEmptyState(agentId);
        this.#notify();
    }
    subscribe(listener) {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }
    getSnapshot() { return this.state; }
    #setState(next) {
        this.state = next;
        this.#notify();
    }
    #notify() {
        for (const listener of this.#listeners) {
            try {
                listener();
            }
            catch (err) {
                console.error('[agent-chat] listener error:', err);
            }
        }
    }
    enqueueStreamEvent(event) {
        this.#streamQueue.push(event);
        if (this.#fetchInFlight)
            return false;
        this.#flushQueueBefore(() => { });
        return this.state.needCatchUp;
    }
    /**
     * Drain queued stream events first, then apply the fetched page — the flush
     * order from the reference implementation. When the response already covers
     * queued events, the cursor gate drops them.
     */
    #flushQueueBefore(responseApply) {
        const queued = this.#streamQueue.splice(0);
        let next = applyStreamEvents(this.state, queued);
        this.#setState(next);
        responseApply();
    }
    async initialize({ agentId } = {}) {
        if (agentId && agentId !== this.#agentId)
            this.setAgentId(agentId);
        if (this.#fetchInFlight)
            return this.#fetchInFlight;
        if (!this.#agentId)
            return;
        this.#fetchInFlight = this.#transport.fetchTimeline(this.#agentId, {
            direction: 'tail',
            projection: 'projected',
            limit: 40,
        }).then((response) => {
            const page = parseTimelinePage(response);
            this.#fetchInFlight = null;
            this.#flushQueueBefore(() => {
                const next = applyTimelinePage({ ...this.state, error: null }, page, { direction: 'tail' });
                const turnActive = page?.agent?.activeTurn;
                const hasTurnState = page?.agent && Object.hasOwn(page.agent, 'activeTurn');
                this.#setState(!hasTurnState ? next : {
                    ...next,
                    turnActive: Boolean(turnActive),
                    cancelling: Boolean(turnActive) && next.cancelling,
                });
            });
            return this.state;
        }).catch((err) => {
            this.#fetchInFlight = null;
            this.#setState({ ...this.state, error: errorMessage(err, 'Timeline fetch failed') });
            throw err;
        });
        return this.#fetchInFlight;
    }
    async catchUpIfNeeded() {
        const state = this.state;
        if (!state.needCatchUp || this.#fetchInFlight)
            return false;
        if (!state.cursor)
            return this.initialize();
        this.#fetchInFlight = this.#transport.fetchTimeline(this.#agentId, {
            direction: 'after',
            cursor: { epoch: state.cursor.epoch, seq: state.cursor.endSeq },
            projection: 'projected',
        }).then((response) => {
            const page = parseTimelinePage(response);
            this.#fetchInFlight = null;
            this.#flushQueueBefore(() => {
                this.#setState(applyTimelinePage(this.state, page, { direction: 'after' }));
            });
            return true;
        }).catch((err) => {
            this.#fetchInFlight = null;
            this.#setState({ ...this.state, error: errorMessage(err, 'Catch-up failed') });
            return false;
        });
        return this.#fetchInFlight;
    }
    async loadOlder() {
        const state = this.state;
        if (this.#loadOlderInFlight || !state.cursor || !state.olderAvailable)
            return false;
        this.#loadOlderInFlight = true;
        try {
            const response = await this.#transport.fetchTimeline(this.#agentId, {
                direction: 'before',
                cursor: { epoch: state.cursor.epoch, seq: state.cursor.startSeq },
                projection: 'projected',
                limit: 40,
            });
            const page = parseTimelinePage(response);
            const next = applyTimelinePage(this.state, page, { direction: 'before' });
            this.#setState(next);
            return next !== state;
        }
        catch (err) {
            this.#setState({ ...this.state, error: errorMessage(err, 'Load older failed') });
            return false;
        }
        finally {
            this.#loadOlderInFlight = false;
        }
    }
    async send(text) {
        const trimmed = (text || '').trim();
        if (!trimmed)
            return false;
        const clientMessageId = generateMessageId();
        const before = this.state;
        this.#setState(beginSubmission(before, clientMessageId, trimmed));
        try {
            await this.#transport.sendMessage(this.#agentId, trimmed, clientMessageId);
            this.#setState(settleSubmission(this.state, clientMessageId));
            return true;
        }
        catch (err) {
            this.#setState(rejectSubmission(this.state, clientMessageId));
            this.#setState({ ...this.state, sendError: errorMessage(err, 'Send failed') });
            return false;
        }
    }
    async cancel() {
        this.#setState({ ...this.state, cancelling: true });
        try {
            await this.#transport.cancelTurn(this.#agentId);
            return true;
        }
        catch (err) {
            this.#setState({ ...this.state, cancelling: false, error: errorMessage(err, 'Cancel failed') });
            return false;
        }
    }
    async respondToPermission(requestId, behavior) {
        const response = behavior === 'allow' ? { behavior: 'allow' } : { behavior: 'deny' };
        try {
            await this.#transport.respondToPermission(this.#agentId, requestId, response);
            this.#setState({
                ...this.state,
                permissions: this.state.permissions.filter((p) => p.id !== requestId),
            });
            return true;
        }
        catch (err) {
            this.#setState({ ...this.state, error: errorMessage(err, 'Permission response failed') });
            return false;
        }
    }
}
