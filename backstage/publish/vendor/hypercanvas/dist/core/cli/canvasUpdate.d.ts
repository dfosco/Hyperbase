/**
 * storyboard canvas update <widget-id> — Update a widget's props or position.
 *
 * Usage:
 *   storyboard canvas update <widget-id> --canvas my-canvas --text "New text"
 *   storyboard canvas update <widget-id> --canvas my-canvas --content "# Markdown"
 *   storyboard canvas update <widget-id> --canvas my-canvas --props '{"key":"value"}'
 *   storyboard canvas update <widget-id> --canvas my-canvas --x 100 --y 200
 *
 * Shorthand flags (merged into props):
 *   --text <string>       Set props.text (sticky notes)
 *   --content <string>    Set props.content (markdown blocks)
 *   --src <string>        Set props.src (images, prototypes)
 *   --url <string>        Set props.url (link previews, embeds)
 *   --color <string>      Set props.color (sticky notes)
 *
 * Position flags:
 *   --x <number>          Move widget to x position
 *   --y <number>          Move widget to y position
 */
export {};
