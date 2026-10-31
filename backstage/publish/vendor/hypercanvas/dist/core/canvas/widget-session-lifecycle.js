import { initTerminalConfig, markTerminalDeleted, readTerminalConfigById, unmarkTerminalDeleted, } from './terminal-config.js';
import { listSessions } from './terminal-registry.js';
import { resolveRuntimeSessionId, terminalWidgetStartupKey, withTerminalStartup } from './terminal-runtime.js';
import { getNotebookPaseoBinding } from './paseo-notebook-binding.js';
const sessionWidgetTypes = new Set(['terminal', 'agent', 'agent-chat']);
export async function closeWidgetSession(root, canvasId, widget) {
    if (typeof widget.type !== 'string' || !sessionWidgetTypes.has(widget.type))
        return;
    initTerminalConfig(root);
    await withTerminalStartup(terminalWidgetStartupKey(root, widget.id), async () => {
        const config = readTerminalConfigById(widget.id);
        const identity = { branch: config?.branch || 'unknown', canvasId, widgetId: widget.id };
        // Write this before awaiting shutdown, and keep it only on success.
        markTerminalDeleted(identity);
        try {
            if (widget.type === 'agent-chat') {
                const agentId = config?.lastAgentId || config?.widgetProps?.agentId || widget.props?.agentId;
                if (typeof agentId === 'string' && agentId) {
                    const { getPaseoAgentRuntime } = await import('./paseo-agent-runtime.js');
                    const runtime = await getPaseoAgentRuntime({ root, silent: false });
                    if (!runtime)
                        throw new Error('Paseo agent runtime is unavailable');
                    await runtime.archiveAgent(agentId);
                }
            }
            else {
                const entries = listSessions().filter(entry => entry.widgetId === widget.id);
                const sessionIds = new Set(entries.map(entry => entry.sessionId));
                if (config?.sessionId)
                    sessionIds.add(config.sessionId);
                if (sessionIds.size > 0) {
                    const { initPaseoTerminalRuntime } = await import('./paseo-terminal-runtime.js');
                    const { killTerminalSession } = await import('./terminal-server.js');
                    const runtime = await initPaseoTerminalRuntime(root);
                    const binding = getNotebookPaseoBinding();
                    const workspaceId = config?.workspaceId || (binding.root === root ? binding.workspaceId : null);
                    for (const sessionId of sessionIds) {
                        if (!workspaceId) {
                            const runtimeId = entries.find(entry => entry.sessionId === sessionId)?.runtimeSessionId
                                || resolveRuntimeSessionId(sessionId);
                            if (!(await runtime.exists(runtimeId)).exists) {
                                throw new Error('Cannot locate this terminal in Paseo: its saved workspace is missing.');
                            }
                        }
                        await killTerminalSession(sessionId, { workspaceId: workspaceId ?? null, cwd: root });
                    }
                }
            }
        }
        catch (error) {
            if (!config?.deleted)
                unmarkTerminalDeleted(identity);
            throw error;
        }
    });
}
/** Undo may restore the widget, but never resurrects a killed process. */
export function restoreWidgetSession(root, canvasId, widget) {
    if (typeof widget.type !== 'string' || !sessionWidgetTypes.has(widget.type))
        return;
    initTerminalConfig(root);
    const config = readTerminalConfigById(widget.id);
    if (config?.deleted) {
        unmarkTerminalDeleted({ branch: config.branch || 'unknown', canvasId, widgetId: widget.id });
    }
}
