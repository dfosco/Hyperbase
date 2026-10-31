/**
 * storyboard messages — Low-level messaging bus CLI.
 *
 * Subcommands:
 *   storyboard messages publish --channel <ch> --type <type> --sender <id> [--body "text"] [--payload '{}']
 *   storyboard messages send --channel <ch> --type <type> --sender <id> [--body "text"] [--timeout 30000]
 *   storyboard messages read --channel <ch> [--since <ulid>] [--limit N] [--type <prefix>]
 *   storyboard messages batch --ops '{ "publish": [...], "read": [...] }'
 */
export {};
