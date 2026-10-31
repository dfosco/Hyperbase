import path from 'node:path';
import { SiteStore } from '../../site/site.js';
import { isFirstLookId } from '../first-look/contract.js';
/** Adapt the authoritative catalog without rescanning or mutating its snapshots. */
export function documentCatalog(snapshot) {
    const documents = snapshot.artifacts.filter(artifact => artifact.kind === 'doc').map(artifact => {
        const payload = artifact.payloadPath || artifact.descriptorPath || artifact.folderPath;
        const id = isFirstLookId(artifact.id) ? artifact.id : `invalid:${payload}`;
        return {
            ...structuredClone(artifact), id, type: 'doc', kind: 'doc', portable: true,
            path: payload, payloadPath: payload,
            folderPath: path.posix.dirname(payload) === '.' ? '' : path.posix.dirname(payload),
            route: artifact.route || `/docs/${encodeURIComponent(id)}`,
            metadata: structuredClone(artifact.descriptor || {}),
            diagnostics: artifact.diagnostics.map(item => ({ ...item, path: item.path || payload })),
        };
    });
    const artifacts = snapshot.artifacts
        .filter(artifact => artifact.kind !== 'doc').map(artifact => structuredClone(artifact));
    for (const page of snapshot.pages) {
        if (page.type === 'doc' || typeof page.id !== 'string')
            continue;
        // Portable page records project the same artifact, not another identity.
        const existing = artifacts.find(artifact => artifact.id === page.id
            && (artifact.folderPath === page.path || artifact.payloadPath === page.path));
        if (existing)
            continue;
        const site = page.type === 'site' && typeof page.siteId === 'string' ? new SiteStore(snapshot.root).get(page.siteId) : null;
        artifacts.push({
            ...structuredClone(page), id: page.type === 'site' && typeof page.siteId === 'string' ? page.siteId : page.id,
            ...(site ? { descriptor: { published: { url: site.productionBaseUrl }, local: { developmentUrl: site.binding?.developmentBaseUrl } } } : {}),
        });
    }
    return { documents, artifacts };
}
