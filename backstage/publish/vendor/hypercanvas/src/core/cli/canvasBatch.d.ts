/**
 * storyboard canvas batch — Execute multiple canvas operations in one call.
 *
 * Usage:
 *   storyboard canvas batch --canvas my-canvas --ops '[{"op":"create-widget","type":"sticky-note","props":{"text":"Hi"}}]'
 *   storyboard canvas batch --canvas my-canvas --ops-file ops.json
 *   cat ops.json | storyboard canvas batch --canvas my-canvas --ops-file -
 *
 * Always outputs JSON. Designed for scripting and agent use.
 */
export {};
