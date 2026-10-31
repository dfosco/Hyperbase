#!/usr/bin/env node
/**
 * storyboard agent signal — signal agent status to the canvas server.
 *
 * Usage:
 *   npx hypercanvas agent signal --widget <id> --canvas <canvasId> --status done|error|running|working [--message "..."]
 *
 * Environment variables (auto-set by terminal server):
 *   STORYBOARD_WIDGET_ID  — widget ID (fallback if --widget not provided)
 *   STORYBOARD_CANVAS_ID  — canvas ID (fallback if --canvas not provided)
 *   STORYBOARD_SERVER_URL — server base URL
 *   STORYBOARD_BRANCH     — current branch
 */
export {};
