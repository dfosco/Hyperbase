/**
 * storyboard canvas redo — re-apply a previously-undone event.
 *
 * Usage:
 *   storyboard canvas redo --canvas my-canvas --event evt_xxx
 *
 * The --event is the id of the *undo event* (the one with meta.kind = 'undo')
 * that you want to cancel — the server emits the inverse of that, restoring
 * the original change.
 *
 * Flags:
 *   -c, --canvas             Canvas name (required)
 *   -e, --event              Event ID (the undo event) to redo (required)
 *   --json                   Output as JSON
 */
export {};
