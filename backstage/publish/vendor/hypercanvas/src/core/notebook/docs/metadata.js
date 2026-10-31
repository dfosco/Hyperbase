import { parseDocument } from 'yaml';
export const DOC_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
/** Parse identity without serializing, normalizing or rewriting authored source. */
export function readDocMetadata(source, sourcePath) {
    const diagnostics = [];
    const issue = (message, line = 1) => diagnostics.push({ code: 'INVALID_DOCUMENT_FRONTMATTER', message, path: sourcePath, line });
    const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
    let metadata = {};
    if (!match)
        issue('A Doc must begin with YAML identity frontmatter.');
    else {
        const yaml = parseDocument(match[1], { uniqueKeys: true, version: '1.2' });
        for (const error of yaml.errors)
            issue(error.message, (error.linePos?.[0]?.line ?? 1) + 1);
        try {
            const value = yaml.toJS({ maxAliasCount: 100 });
            if (value && typeof value === 'object' && !Array.isArray(value))
                metadata = value;
            else
                issue('Frontmatter must be a mapping.');
        }
        catch (error) {
            issue(String(error));
        }
        if (metadata.formatVersion !== 1)
            issue('formatVersion must be 1.');
        if (typeof metadata.id !== 'string' || !DOC_ID.test(metadata.id))
            issue('id must be a stable artifact ID.');
        if (typeof metadata.title !== 'string' || !metadata.title.trim())
            issue('title must be non-empty.');
        if (metadata.references !== undefined && (!Array.isArray(metadata.references) || metadata.references.some(id => typeof id !== 'string' || !DOC_ID.test(id))))
            issue('references must be stable artifact IDs.');
    }
    return { metadata, body: match ? source.slice(match[0].length) : source, lineOffset: match ? match[0].split('\n').length - 1 : 0, diagnostics };
}
