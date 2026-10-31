/**
 * Shared Design Notebook first-look contract.
 *
 * Pinned to dfosco/design-notebook 0.10.0-first-look at commit
 * 87348d6bc54afebb74094c02cd95b7b8c58be032. This module is browser-safe: it
 * holds constants, identity rules, and types only. Filesystem discovery lives
 * in discovery.node.ts.
 */
export const FIRST_LOOK_FORMAT_VERSION = 1;
export const FIRST_LOOK_PROTOTYPE_RUNTIME = Object.freeze({
    id: '@dfosco/statefully',
    version: '0.2.1',
});
export const FIRST_LOOK_KINDS = ['prototype', 'canvas', 'site', 'doc'];
export const FIRST_LOOK_DIRECTORY_SUFFIXES = Object.freeze({
    prototype: '.prototype',
    canvas: '.canvas',
    site: '.site',
});
// Exclusions from the upstream first-look scanner policy, plus the
// Hypercanvas runtime-state directories that already hold notebook metadata.
export const FIRST_LOOK_EXCLUDED_DIRECTORIES = new Set([
    '.git',
    '.design-notebook',
    '.vite',
    '.cache',
    '.next',
    '.turbo',
    'node_modules',
    'dist',
    'build',
    'out',
    'coverage',
    'storybook-static',
    '.hypercanvas',
    '.storyboard',
]);
// Public route roots that a prototype ID may not claim.
export const RESERVED_PUBLIC_ROUTE_ROOTS = new Set([
    'canvas',
    'docs',
    'sites',
    '__notebook',
    'prototypes',
    'assets',
    'node_modules',
    '@fs',
]);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
export function isFirstLookId(value) {
    return typeof value === 'string' && ID_PATTERN.test(value);
}
