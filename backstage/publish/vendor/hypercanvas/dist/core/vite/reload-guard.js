const documentPolicyEvent = 'storyboard:document-policy';
const validTargetId = /^[A-Za-z0-9_-]{16,128}$/;
const validRoles = new Set(['workspace-host', 'canvas-host', 'prototype-content', 'story-content']);
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function parseRegistration(data) {
    if (!isRecord(data) || data.schemaVersion !== 1 || data.active !== true
        || typeof data.role !== 'string' || !validRoles.has(data.role)
        || typeof data.targetId !== 'string' || !validTargetId.test(data.targetId)
        || typeof data.configurationAutoReload !== 'boolean')
        return null;
    return {
        schemaVersion: 1,
        role: data.role,
        targetId: data.targetId,
        configurationAutoReload: data.configurationAutoReload,
    };
}
/**
 * Own the per-client document policy for Vite's supported HMR transport.
 * Routine full reloads fail closed for every connected document. Module
 * updates continue to flow so React Fast Refresh remains available.
 */
export function installReloadGuard(server) {
    const documents = new Map();
    const targetOwners = new Map();
    function removeDocument(client) {
        const current = documents.get(client);
        if (!current)
            return;
        documents.delete(client);
        if (targetOwners.get(current.targetId) === client)
            targetOwners.delete(current.targetId);
    }
    server.hot.on(documentPolicyEvent, (data, client) => {
        if (isRecord(data) && data.active === false) {
            removeDocument(client);
            return;
        }
        const next = parseRegistration(data);
        if (!next)
            return;
        const owner = targetOwners.get(next.targetId);
        if (owner && owner !== client)
            return;
        removeDocument(client);
        documents.set(client, next);
        targetOwners.set(next.targetId, client);
    });
    // A closed or unmounted document must not leave its target resolvable.
    server.hot.on('vite:client:disconnect', (_data, client) => removeDocument(client));
    function isConfigurationPayload(payload) {
        if (!isRecord(payload))
            return false;
        const updates = Array.isArray(payload.updates) ? payload.updates : [];
        const paths = [payload.path, ...updates.flatMap((update) => isRecord(update) ? [update.path] : [])];
        return paths.some((file) => typeof file === 'string'
            && /(?:^|\/)(?:storyboard|toolbar|commandpalette|paste|widgets|terminal|mascot)\.config\.json$/i.test(file.replace(/\\/g, '/')));
    }
    function sendPending(client, registration, reason, payload) {
        client.send('storyboard:reload-pending', {
            kind: 'document-update',
            reason,
            path: isRecord(payload) && typeof payload.path === 'string' ? payload.path : null,
            target: registration ? { role: registration.role, targetId: registration.targetId } : null,
        });
    }
    const originalSend = server.ws.send.bind(server.ws);
    server.ws.send = (payload) => {
        if (payload.type === 'full-reload') {
            const configuration = isConfigurationPayload(payload);
            for (const client of server.ws.clients) {
                const registration = documents.get(client);
                // A missing or invalid registration is treated as a host document.
                // Existing auto-reload preferences never authorize incidental full
                // reloads. Only the separate configuration preference keeps its
                // established opt-in behavior.
                if (configuration && registration?.configurationAutoReload === true)
                    client.send(payload);
                else
                    sendPending(client, registration, configuration ? 'configuration' : 'document-update', payload);
            }
            return;
        }
        if (payload.type === 'update') {
            if (isConfigurationPayload(payload)) {
                for (const client of server.ws.clients) {
                    if (documents.get(client)?.configurationAutoReload === true)
                        client.send(payload);
                    else
                        sendPending(client, documents.get(client), 'configuration', payload);
                }
                return;
            }
            // Ordinary module updates stay on Vite's HMR/Fast Refresh path.
            for (const client of server.ws.clients)
                client.send(payload);
            return;
        }
        return originalSend(payload);
    };
}
