/**
 * storyboard server — inspect and control the single global Hypercanvas instance.
 *
 * One instance per machine owns one selected proxy port (ADR-007). `list` and
 * `status` probe it; bare `start` launches the instance when absent; `stop`
 * terminates it. Worktree-targeted starts are disconnected from the CLI —
 * Notebook switching happens inside the running instance instead. The
 * previous worktree implementation is retained below as
 * DEPRECATED_serverStartWorktree for a future refactor and is no longer
 * reachable through routing or help.
 *
 * Usage:
 *   storyboard server               Show the running instance
 *   storyboard server list          Show the running instance
 *   storyboard server status        Show instance details
 *   storyboard server start         Start the instance when absent (detached)
 *   storyboard server stop          Stop the instance
 */
export {};
