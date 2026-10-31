/**
 * storyboard-scaffold — sync scaffold files from @dfosco/storyboard.
 *
 * Two passes per run, driven by `packages/storyboard/scaffold/scaffold.config.json`:
 *
 *   1. Whole-file pass (`files[]`):
 *      - `mode: "scaffold"`   — copy library file to client only if target is missing
 *      - `mode: "updateable"` — always overwrite client file with library version
 *      Both call `stripLibraryMarkers()` on the source content first so library
 *      bare markers (`<!-- <id> --start-->`) never leak into client output.
 *
 *   2. Fragment-replace pass (`fragmentSources[]`):
 *      - For every client file that contains `<!-- storyboard:<src>:<id> --start-->`
 *        markers, rewrite each fragment body from the corresponding library
 *        source. Content outside markers is preserved exactly.
 *      - Scans `files[]` targets plus a curated set of well-known config files
 *        (`.gitignore`, `AGENTS.md`, `README.md`) so clients can opt in to
 *        fragment-only updates without listing the file in `files[]`.
 *
 * A one-shot legacy migration runs before pass 2: any `.gitignore` containing
 * the pre-0.6.10 ad-hoc storyboard banner is rewritten into marker form so
 * subsequent scaffolds keep it in sync.
 *
 * Backwards-compat: if `scaffold.config.json` is missing but the old
 * `manifest.json` exists, we read it and emit a deprecation warning.
 *
 * Usage:
 *   npx hypercanvas-scaffold                  # both passes
 *   npx hypercanvas-scaffold --fragments-only # skip pass 1, only rewrite fragments
 *   npx hypercanvas-scaffold --files-only     # skip pass 2, only copy whole files
 */
export {};
