import { normalizeSiteDescriptor } from './site.js';
export function migrateWorktopProject(project = {}) {
    const descriptor = {};
    if (typeof project.id === 'string')
        descriptor.id = project.id;
    if (typeof project.title === 'string')
        descriptor.title = project.title;
    if (typeof project.defaultDeployment === 'string' || project.defaultDeployment === null)
        descriptor.defaultDeployment = project.defaultDeployment;
    if (isRecord(project.deployments))
        descriptor.deployments = decodeDeployments(project.deployments);
    else if (typeof project.productionBaseUrl === 'string' && project.productionBaseUrl) {
        descriptor.deployments = { production: { baseUrl: project.productionBaseUrl } };
    }
    if (isRecord(project.capture)) {
        const capture = {};
        if (typeof project.capture.waitUntil === 'string')
            capture.waitUntil = project.capture.waitUntil;
        if (project.capture.delayMs !== undefined)
            capture.delayMs = project.capture.delayMs;
        descriptor.capture = capture;
    }
    const site = normalizeSiteDescriptor(descriptor);
    return {
        site,
        binding: null,
        warnings: ['Machine-local Worktop bindings are not migrated; reconnect the Site on this machine.'],
    };
}
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function decodeDeployments(value) {
    const deployments = {};
    for (const [name, deployment] of Object.entries(value)) {
        if (isRecord(deployment))
            deployments[name] = deployment;
    }
    return deployments;
}
export function migrateWorktopFrameProps(props = {}) {
    if (!props.projectId)
        return { ...props };
    const rest = { ...props };
    delete rest.projectId;
    delete rest.developmentBaseUrl;
    const projectId = props.projectId;
    return { ...rest, siteId: projectId, route: rest.route ?? '' };
}
