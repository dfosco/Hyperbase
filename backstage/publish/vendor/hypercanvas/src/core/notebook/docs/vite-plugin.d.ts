import type { Plugin } from 'vite';
import type { DocArtifact } from './discovery.node.js';
type HostArtifact = {
    id: string;
    type?: string;
    kind?: string;
    [key: string]: unknown;
};
export type DocumentHost = {
    root: () => string | null | undefined;
    catalog?: () => HostArtifact[] | Promise<HostArtifact[]>;
    documents?: () => DocArtifact[] | Promise<DocArtifact[]>;
    loadSource?: (artifact: DocArtifact) => string | Promise<string>;
    mode?: 'local' | 'static';
};
/** Vite module/assets transport. Replace catalog/discovery downstream, not the renderer. */
export default function documentsPlugin(host?: DocumentHost): Plugin;
export {};
