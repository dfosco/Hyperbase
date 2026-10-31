/**
 * Agent Session — capture & resume per-widget agent CLI sessions.
 *
 * Copilot CLI doesn't accept a `--settings` arg the way Claude Code does —
 * its hooks are loaded from `~/.copilot/hooks/*.json` (and `.github/hooks/`
 * + a few other locations). We install a single user-level hook file once
 * that runs on `sessionStart` for every copilot invocation; the hook reads
 * `STORYBOARD_WIDGET_ID` from its env (we already export it into the agent
 * shell) and the JSON payload from stdin, then writes the captured
 * `sessionId` to a per-widget capture file under the widget's project root.
 *
 * A watcher on the per-widget capture file persists the captured id onto
 * the widget's terminal config as `lastAgentSessionId`. On the next cold
 * restart, the launch is rewritten to `copilot --resume=<id> --agent ...`
 * (with a pre-flight check that the on-disk session still exists), and is
 * shell-chained with a `|| <fresh-startup>` fallback so that if the agent
 * CLI rejects the id at runtime the widget still ends up with a working
 * fresh session instead of a dead terminal.
 */
/** Isolate widget TUIs from shared-daemon feature settings, when supported. */
export declare function localCodexCommand(command: string, executablePath: string, env?: NodeJS.ProcessEnv): string;
export type AgentSessionConfig = Readonly<{
    resumeCommand?: string | null;
    resumeLastCommand?: string | null;
    resumeFallback?: boolean;
    sessionStateDir?: string | null;
    sessionStateGlob?: string | null;
}>;
/** Path to the per-widget capture file written by the user-level hook. */
export declare function captureFilePath(root: string, widgetKey: string): string;
/**
 * Install (idempotently) a user-level Copilot CLI hook that captures the
 * session id of every storyboard-managed widget into a per-widget file.
 *
 * The hook fires on `sessionStart` (both new + resume), reads:
 *   - `STORYBOARD_WIDGET_ID` from env (exported by terminal-server)
 *   - `HYPERCANVAS_PROJECT_ROOT` (legacy `STORYBOARD_PROJECT_ROOT`) from env
 *   - `sessionId` from the hook's JSON stdin payload
 * and writes the sessionId to
 *   `$HYPERCANVAS_PROJECT_ROOT/.hypercanvas/agent-sessions/$HYPERCANVAS_WIDGET_ID.session-id`.
 *
 * If either env var is missing (e.g. user runs copilot outside storyboard),
 * the hook silently no-ops.
 *
 * Safe to call on every dev-server boot.
 */
export declare function ensureCopilotCaptureHookInstalled(): string;
/**
 * Install (idempotently) a SessionStart hook in `~/.claude/settings.json`
 * that captures Claude Code session ids the same way the Copilot hook does.
 *
 * Claude's hook payload uses `session_id` (snake_case) instead of Copilot's
 * `sessionId` — our capture script handles both. Claude reads the hook from
 * `~/.claude/settings.json` and merges it with project / local / managed
 * settings, so we install user-scope and let Claude do the merging.
 *
 * Existing settings are preserved: we read, deep-merge our hook into the
 * SessionStart array (replacing any prior storyboard hook by `command`
 * marker), and write back.
 *
 * Safe to call on every dev-server boot.
 */
export declare function ensureClaudeCaptureHookInstalled(): string;
/**
 * Install (idempotently) a SessionStart hook for Codex CLI at
 * `~/.codex/hooks.json` using the same shared capture script.
 *
 * Codex's hook format is JSON with PascalCase event names like Claude's
 * (and uses `session_id` snake_case in the payload, also like Claude).
 * We own this file end-to-end (Codex merges multiple hook sources, so
 * other hooks the user has via config.toml or repo-level files keep
 * working). The marker comment identifies our handler for replace.
 */
export declare function ensureCodexCaptureHookInstalled(): string;
/**
 * Build a resume-aware startup command for an agent.
 *
 * Pre-validates that a captured `sessionId` looks like a UUID AND that the
 * session-state directory still exists for it under `~/.copilot/session-state/`.
 * If validation fails, returns the original `startupCommand` unchanged so
 * the agent launches a fresh session — same UX as today.
 *
 * Otherwise returns `agentCfg.resumeCommand` with `{id}` substituted. The
 * resume command is the FULL command to run (including the binary, the
 * --agent flag, and any other startup args), not just the resume flag —
 * keeping it in one field avoids confusion about which args go where.
 */
export declare function buildResumeStartupCommand({ startupCommand, sessionId, agentCfg }: {
    startupCommand?: string | null;
    sessionId?: string | null;
    agentCfg?: AgentSessionConfig | null;
}): string | null | undefined;
/**
 * Decide whether a captured sessionId is still resumable.
 *
 * Strategies:
 *   - `agentCfg.sessionStateDir` → check if `<dir>/<id>` exists (Copilot)
 *   - `agentCfg.sessionStateGlob` → check if any
 *     `~/.claude/projects/*‍/<id>.jsonl` exists (Claude)
 *   - both null → trust the UUID
 *
 * Defaults to the Copilot session-state dir when nothing is configured.
 */
export declare function isResumableSessionId(sessionId: unknown, agentCfg?: AgentSessionConfig): boolean;
/**
 * Watch `captureFile` for the agent's session id and call `onCapture(id)`
 * once it appears or is updated. Unlike the previous one-shot version,
 * this keeps watching so subsequent sessions on the same widget (e.g.
 * after `/new` inside the agent) overwrite the captured id.
 *
 * Returns a `stop()` function the caller can invoke to cancel.
 */
export declare function watchSessionIdFile(captureFile: string, onCapture: (sessionId: string) => void, { pollMs }?: {
    pollMs?: number;
}): () => void;
/**
 * Read a previously-captured session id from a capture file. Returns null
 * if the file is missing or empty.
 */
export declare function readCapturedSessionId(captureFile: string): string | null;
/**
 * Remove a capture file (e.g. after a widget is deleted). Best-effort.
 */
export declare function clearCaptureFile(captureFile: string): void;
