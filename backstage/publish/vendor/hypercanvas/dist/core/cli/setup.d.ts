/**
 * storyboard setup — One-time setup for the Storyboard dev environment.
 *
 * Idempotent: safe to run multiple times, only does what's needed.
 *
 * Usage:
 *   npx hypercanvas setup                          # interactive
 *   npx hypercanvas setup --skip-branch             # non-interactive, skip branch prompt
 *   npx hypercanvas setup --skip-repo-config        # skip the storyboard.config.json repo-info update
 *   npx hypercanvas setup --branch=<name>           # non-interactive, switch to branch after setup
 */
export {};
