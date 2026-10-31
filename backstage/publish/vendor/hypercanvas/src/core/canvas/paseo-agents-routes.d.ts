/**
 * Paseo Agents API routes — mounted at /_hypercanvas/paseo-agents/.
 *
 * Same-origin proxy in front of the Paseo daemon so daemon credentials never
 * reach the browser. All route inputs are validated before hitting the SDK.
 *
 * Routes:
 *   GET  /health            — runtime + connection diagnostics
 *   GET  /providers         — available providers (pre-launch picker)
 *   GET  /providers/models  — models for ?provider=
 *   GET  /agents            — list agents (optional ?subscribe=1)
 *   GET  /agents/:id        — refresh + fetch one agent snapshot
 *   POST /agents            — create agent { config: { provider, model, ... }, title, context: { workspaceId } }
 *   POST /agents/:id/send   — send message { text, messageId }
 *   POST /agents/:id/cancel — interrupt the active turn
 *   POST /agents/:id/permission — respond { requestId, response: { behavior, ... } }
 *   POST /agents/:id/timeline   — refetch timeline { direction, cursor, limit, projection }
 *   POST /agents/:id/archive    — archive agent
 *
 * Agent/timeline events reach the browser via the Vite custom HMR event
 * `storyboard:paseo-agent-event` (see paseo-agent-runtime.js).
 */
import { getPaseoAgentRuntime } from './paseo-agent-runtime.js';
type JsonRecord = Record<string, unknown>;
type SendJson = (res: unknown, status: number, body: unknown) => unknown;
type RouteRequest = {
    body?: unknown;
};
type RouteResponse = unknown;
type RouteMetadata = {
    body?: unknown;
    path?: string;
    method?: string;
};
type PaseoAgentsRouteContext = {
    root: string;
    sendJson: SendJson;
    wsSend?: (message: JsonRecord) => unknown;
    workspaceIdResolver?: NonNullable<Parameters<typeof getPaseoAgentRuntime>[0]>['workspaceIdResolver'];
};
export declare function createPaseoAgentsHandler(ctx: PaseoAgentsRouteContext): (_req: RouteRequest, res: RouteResponse, { body, path, method }: RouteMetadata) => Promise<unknown>;
export {};
