/**
 * storyboard canvas read — Read canvas state and list widgets with their IDs, URLs, and content.
 *
 * Usage:
 *   storyboard canvas read my-canvas             List all widgets
 *   storyboard canvas read my-canvas --json      Output as JSON
 *   storyboard canvas read my-canvas --id abc    Get a specific widget by ID
 *
 * Output includes:
 *   - Widget ID
 *   - Widget type
 *   - Position (x, y)
 *   - Content (text, url, src depending on type)
 *   - File path (for images)
 */
export {};
