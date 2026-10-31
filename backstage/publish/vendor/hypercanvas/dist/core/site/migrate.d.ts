import { normalizeSiteDescriptor } from './site.js';
interface WorktopProject {
    id?: unknown;
    title?: unknown;
    deployments?: unknown;
    productionBaseUrl?: unknown;
    defaultDeployment?: unknown;
    capture?: unknown;
}
export interface MigratedWorktopProject {
    site: ReturnType<typeof normalizeSiteDescriptor>;
    binding: null;
    warnings: string[];
}
export declare function migrateWorktopProject(project?: WorktopProject): MigratedWorktopProject;
export declare function migrateWorktopFrameProps(props?: Record<string, unknown>): Record<string, unknown>;
export {};
