import { z } from 'zod';
const authoredNodeIdentitySchema = z.object({
    sourcePath: z.string().min(1),
    nodeId: z.string().min(1),
}).strict();
const runtimeInstanceIdentitySchema = authoredNodeIdentitySchema.extend({
    instancePath: z.string().min(1),
}).strict();
export function parseAuthoredNodeIdentity(value) {
    return authoredNodeIdentitySchema.parse(value);
}
export function parseRuntimeInstanceIdentity(value) {
    return runtimeInstanceIdentitySchema.parse(value);
}
function identityKey(identity) {
    return JSON.stringify([identity.sourcePath, identity.nodeId]);
}
export function createRuntimeIdentityIndex(values) {
    const bySource = new Map();
    const seenInstances = new Set();
    for (const value of values) {
        const instance = Object.freeze(parseRuntimeInstanceIdentity(value));
        const instanceKey = JSON.stringify([instance.sourcePath, instance.nodeId, instance.instancePath]);
        if (seenInstances.has(instanceKey)) {
            throw new Error(`Duplicate Storyboard runtime instance identity: ${instance.instancePath}`);
        }
        seenInstances.add(instanceKey);
        const key = identityKey(instance);
        const instances = bySource.get(key) ?? [];
        instances.push(instance);
        bySource.set(key, instances);
    }
    for (const instances of bySource.values())
        Object.freeze(instances);
    return Object.freeze({
        resolve(identity) {
            const instances = bySource.get(identityKey(parseAuthoredNodeIdentity(identity))) ?? [];
            if (instances.length === 0)
                return { status: 'missing' };
            if (instances.length === 1)
                return { status: 'unique', instance: instances[0] };
            return { status: 'ambiguous', instances };
        },
        instancesFor(identity) {
            return bySource.get(identityKey(parseAuthoredNodeIdentity(identity))) ?? [];
        },
        size: seenInstances.size,
    });
}
//# sourceMappingURL=identity-index.js.map