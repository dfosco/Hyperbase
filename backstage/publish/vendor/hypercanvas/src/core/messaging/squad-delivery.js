/** Attention delivery layered over the durable, numbered Squad room. */
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
const deliveriesInFlight = new Set();
export function formatSquadInjection(squadId, entry) {
    return `${entry.description}\n\nSquad ledger reference:\n${JSON.stringify({ squadId, number: entry.number }, null, 2)}`;
}
function latestAttempt(events, number, recipient) {
    return events.filter((event) => event.kind === 'system.delivery.attempt'
        && event.data?.number === number && event.data?.recipient === recipient).at(-1) || null;
}
function stateForError(error) {
    const code = error !== null && typeof error === 'object' && 'code' in error
        ? error.code
        : undefined;
    if (['AGENT_NOT_READY', 'TERMINAL_NOT_RUNNING', 'SESSION_NOT_FOUND', 'NO_SESSION'].includes(code ?? ''))
        return 'failed';
    return 'indeterminate';
}
function errorMessage(error) {
    return error instanceof Error ? error.message || String(error) : String(error);
}
/**
 * Deliver one already-committed injectable entry. Each recipient gets one
 * transport, and retries reuse its ledger number rather than appending again.
 */
export async function deliverSquadEntry(service, squadId, entry, { submitTerminalText, sessionFor, isReady, sendAgentMessage, force = false, } = {}) {
    const text = formatSquadInjection(squadId, entry);
    const room = await service.read(squadId, entry.author);
    const results = [];
    const recipients = Array.isArray(entry.to) ? entry.to : [];
    for (const recipient of recipients) {
        const deliveryKey = `${squadId}:${entry.number}:${recipient}`;
        if (deliveriesInFlight.has(deliveryKey)) {
            results.push({ recipient, status: 'indeterminate', error: 'A delivery attempt is already in progress' });
            continue;
        }
        deliveriesInFlight.add(deliveryKey);
        try {
            const previous = latestAttempt(room, entry.number, recipient);
            if (previous && (previous.data?.state === 'submitted'
                || (previous.data?.state !== 'failed' && !force))) {
                results.push({ recipient, status: previous.data?.state === 'submitted' ? 'already_submitted' : 'indeterminate' });
                continue;
            }
            let transport = null;
            let state = 'failed';
            let reason = null;
            try {
                await service.appendSystemEvent(squadId, 'system.delivery.attempt', `Delivery pending for entry ${entry.number}`, {
                    number: entry.number, recipient, state: 'pending',
                });
            }
            catch (error) {
                results.push({ recipient, status: 'failed', error: `Could not record delivery attempt: ${errorMessage(error)}` });
                continue;
            }
            try {
                service.assertCanCoordinate?.(squadId, entry.author, [recipient]);
                const binding = await service.getAgentBinding(squadId, recipient);
                if (binding?.agentId && typeof sendAgentMessage === 'function') {
                    transport = 'paseo-agent';
                    await sendAgentMessage(binding.agentId, text);
                    state = 'submitted';
                }
                else {
                    transport = 'terminal-pty';
                    const sessionId = await sessionFor?.(recipient);
                    if (!sessionId) {
                        const error = new Error('No managed terminal session is bound to this member');
                        error.code = 'SESSION_NOT_FOUND';
                        throw error;
                    }
                    const canWrite = () => {
                        try {
                            service.assertCanCoordinate?.(squadId, entry.author, [recipient]);
                        }
                        catch {
                            return false;
                        }
                        return isReady?.(recipient) === true;
                    };
                    if (!canWrite()) {
                        const error = new Error('Managed agent is not ready for injected input');
                        error.code = 'AGENT_NOT_READY';
                        throw error;
                    }
                    const result = await submitTerminalText(sessionId, text, { submit: true, paste: true, canWrite });
                    state = isRecord(result) && result.accepted === true && result.submitted === true
                        ? 'submitted'
                        : 'indeterminate';
                    if (state === 'indeterminate')
                        reason = 'PTY did not confirm submitted input';
                }
            }
            catch (error) {
                state = stateForError(error);
                reason = errorMessage(error);
            }
            try {
                await service.appendSystemEvent(squadId, 'system.delivery.attempt', `Delivery ${state} for entry ${entry.number}`, {
                    number: entry.number,
                    recipient,
                    ...(transport ? { transport } : {}),
                    state,
                    ...(reason ? { reason: reason.slice(0, 500) } : {}),
                });
            }
            catch (error) {
                state = 'indeterminate';
                reason = `Transport outcome could not be audited: ${errorMessage(error)}`;
            }
            results.push({ recipient, status: state, ...(transport ? { transport } : {}), ...(reason ? { error: reason } : {}) });
        }
        finally {
            deliveriesInFlight.delete(deliveryKey);
        }
    }
    return results;
}
