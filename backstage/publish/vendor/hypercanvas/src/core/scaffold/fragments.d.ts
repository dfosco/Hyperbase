/**
 * Scaffold fragment templating — comment-style-agnostic block markers used by
 * `storyboard-scaffold` to keep slices of client-owned files in sync with the
 * library.
 *
 * Two marker schemes:
 *
 *   Client-side ("namespaced"):
 *     # <!-- storyboard:<source-path>:<fragment-id> --start-->
 *     ...content the scaffolder rewrites...
 *     # <!-- storyboard:<source-path>:<fragment-id> --end-->
 *
 *     The leading `#` (or `//`, or whatever comment prefix the host file uses)
 *     is ignored by the parser — we match on the `storyboard:` namespace
 *     substring only, so the same scheme works in .gitignore, .yml, .json,
 *     .js, .md, etc.
 *
 *   Library-side ("bare"):
 *     # <!-- <fragment-id> --start-->
 *     ...fragment body...
 *     # <!-- <fragment-id> --end-->
 *
 *     Bare markers live in `packages/storyboard/scaffold/<source-path>`. The
 *     scaffolder reads them via `extractFragment()`. When a library file is
 *     copied wholesale into a client (no client-side markers present), the
 *     scaffolder strips the bare markers first via `stripLibraryMarkers()`
 *     so the client gets clean content.
 *
 * Whitespace rules:
 *   - Fragment body = the bytes BETWEEN the start-marker line and the
 *     end-marker line, exclusive of both. Leading/trailing newlines on the
 *     body are preserved exactly so round-trips are stable.
 *   - The comment prefix on the start line is repeated on the end line by
 *     convention but not enforced — the parser only requires that both
 *     markers appear on their own line.
 *
 * Failure modes (all throw):
 *   - Nested markers with the same id.
 *   - Unbalanced markers (start without end, or vice versa).
 *   - Unknown source path or fragment id during apply.
 */
export interface NamespacedFragment {
    sourcePath: string;
    id: string;
    startLine: number;
    endLine: number;
    body: string;
}
export interface ApplyFragmentsResult {
    text: string;
    replaced: number;
    unchanged: number;
}
/**
 * @typedef {object} NamespacedFragment
 * @property {string} sourcePath  - e.g. "scaffold/gitignore"
 * @property {string} id          - e.g. "runtime-state"
 * @property {number} startLine   - 0-indexed line number of the start marker
 * @property {number} endLine     - 0-indexed line number of the end marker
 * @property {string} body        - content between markers (exclusive)
 */
/**
 * Parse a client-side file for `storyboard:<src>:<id>` fragment markers.
 *
 * @param {string} text
 * @returns {NamespacedFragment[]}
 * @throws if markers are nested, unbalanced, or duplicated.
 */
export declare function parseFragments(text: string): NamespacedFragment[];
/**
 * Extract a bare-marker fragment body from a library source file.
 *
 * @param {string} srcText
 * @param {string} id
 * @returns {string|null} the fragment body (between markers, exclusive), or
 *   null if no matching fragment exists.
 * @throws if markers are nested, unbalanced, or duplicated for the same id.
 */
export declare function extractFragment(srcText: string, id: string): string | null;
/**
 * Rewrite the bodies of every `storyboard:<src>:<id>` fragment in a client
 * file by looking up the matching library fragment via `lookup(src, id)`.
 *
 * The lookup callback is responsible for resolving the source file and
 * extracting the fragment body — typically:
 *
 *   (src, id) => extractFragment(fs.readFileSync(src, 'utf-8'), id)
 *
 * Returns `{ text, replaced, unchanged }` so the caller can report counts and
 * skip writes when nothing changed.
 *
 * @param {string} clientText
 * @param {(sourcePath: string, fragmentId: string) => string|null} lookup
 * @returns {{ text: string, replaced: number, unchanged: number }}
 * @throws if a fragment marker references a source/id the lookup can't resolve.
 */
export declare function applyFragments(clientText: string, lookup: (sourcePath: string, fragmentId: string) => string | null): ApplyFragmentsResult;
/**
 * Strip library-side bare markers from a text. Used by the whole-file copy
 * pass so that when a library file is copied into a client, the markers
 * don't leak through.
 *
 * Defensive behaviour:
 *   - Removes ONLY bare-marker lines (`<!-- <id> --start-->` / `--end-->`).
 *   - Leaves `storyboard:<src>:<id>` namespaced markers in place — those
 *     don't belong in library sources, but if a contributor adds one we
 *     shouldn't silently delete it.
 *   - Collapses any blank lines left behind so the output stays clean.
 *
 * @param {string} text
 * @returns {{ text: string, stripped: number }} number of marker LINES removed.
 */
export declare function stripLibraryMarkers(text: string): {
    text: string;
    stripped: number;
};
