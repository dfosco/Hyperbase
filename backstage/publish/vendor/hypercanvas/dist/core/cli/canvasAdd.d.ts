/**
 * storyboard canvas add <widget-type> — Add a widget to an existing canvas.
 *
 * Widgets are auto-positioned by default near (in priority order):
 * 1. The active agent/terminal running the command ($STORYBOARD_WIDGET_ID)
 * 2. The user's currently selected widget
 * 3. The center of the user's viewport
 * 4. The last widget on the canvas
 *
 * Use --x/--y for explicit coordinates, or --near <widget-id> to place
 * relative to a specific widget. Use --near false to opt out entirely.
 *
 * Usage:
 *   storyboard canvas add sticky-note --canvas my-canvas
 *   storyboard canvas add markdown --canvas my-canvas --near widget-abc
 *   storyboard canvas add prototype --canvas my-canvas --x 100 --y 200
 *   storyboard canvas add sticky-note --canvas my-canvas --near false --x 0 --y 0
 *
 * Known widget types: sticky-note, markdown, prototype
 * The server accepts any type string — new widget types work automatically.
 */
export {};
