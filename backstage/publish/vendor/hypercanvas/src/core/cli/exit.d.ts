/**
 * storyboard exit — Stop every dev server tracked in the registry.
 *
 * No daemon, no proxy — just SIGTERM every PID in
 * runtime `servers.json` and clear their entries.
 */
export {};
