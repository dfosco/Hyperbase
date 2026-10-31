/**
 * storyboard artifact — Manage storyboard artifacts (prototypes, canvases, components, etc).
 *
 * Subcommands:
 *   storyboard artifact create <type> --name X [--title T] [--folder F] ...
 *   storyboard artifact edit <type> <name> [--title T] ...
 *   storyboard artifact delete <type> <name> [--force]
 *   storyboard artifact list [type] [--folder X] [--json]
 *   storyboard artifact schema <type>
 *
 * Types: prototype, canvas, site, component, flow, object, record, page
 *
 * Each flag maps 1:1 to a schema field. Run `hypercanvas artifact schema <type>`
 * to see the full JSON Schema for any artifact type.
 */
export {};
