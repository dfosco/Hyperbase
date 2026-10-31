const ARTIFACT_SUFFIXES = ['.prototype', '.component', '.canvas', '.site'];
/**
 * Return the authored logical name for a suffix-artifact directory basename.
 * Leading underscores on the folder are visibility markers and are removed
 * only from this identity value. The physical directory name is unchanged.
 */
export function artifactFolderLogicalName(folderName) {
    const basename = String(folderName || '').replaceAll('\\', '/').split('/').at(-1) || '';
    const suffix = ARTIFACT_SUFFIXES.find(candidate => basename.endsWith(candidate));
    if (!suffix)
        return null;
    const logicalName = basename.slice(0, -suffix.length).replace(/^_+/, '');
    return logicalName || null;
}
/** Return the exact leading-underscore visibility prefix on an artifact folder. */
export function artifactFolderVisibilityPrefix(folderName) {
    const basename = String(folderName || '').replaceAll('\\', '/').split('/').at(-1) || '';
    if (!artifactFolderLogicalName(basename))
        return '';
    return basename.match(/^_+/)?.[0] || '';
}
