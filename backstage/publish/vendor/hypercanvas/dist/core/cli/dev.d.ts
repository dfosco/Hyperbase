/**
 * hypercanvas dev — start the single global Hypercanvas instance.
 *
 * The first action is the global instance claim (ADR-007): a loopback proxy
 * binds the configured port (default 1234), advancing past foreign listeners,
 * before any scaffold, Paseo, or Vite work. A duplicate launch reports the
 * running instance and exits instead of starting a second runtime. The
 * `/_hypercanvas/*` API endpoints are mounted by `core/vite/server-plugin` as
 * Vite middleware, so a single child process owns everything behind the proxy.
 *
 * Usage:
 *   hypercanvas dev          # start in current cwd
 *   hypercanvas dev --port=N # override the Vite backend port
 *
 * Env:
 *   HYPERCANVAS_PROXY_PORT=0    # bind an ephemeral proxy port (e2e isolation)
 *   HYPERCANVAS_INSTANCE_PROXY=0 # skip the claim entirely (legacy behavior)
 */
export {};
