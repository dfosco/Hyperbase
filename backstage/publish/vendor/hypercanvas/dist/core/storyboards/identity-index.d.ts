import { z } from 'zod';
declare const authoredNodeIdentitySchema: z.ZodObject<{
    sourcePath: z.ZodString;
    nodeId: z.ZodString;
}, "strict", z.ZodTypeAny, {
    sourcePath: string;
    nodeId: string;
}, {
    sourcePath: string;
    nodeId: string;
}>;
declare const runtimeInstanceIdentitySchema: z.ZodObject<{
    sourcePath: z.ZodString;
    nodeId: z.ZodString;
} & {
    instancePath: z.ZodString;
}, "strict", z.ZodTypeAny, {
    sourcePath: string;
    nodeId: string;
    instancePath: string;
}, {
    sourcePath: string;
    nodeId: string;
    instancePath: string;
}>;
export type AuthoredNodeIdentity = z.infer<typeof authoredNodeIdentitySchema>;
export type RuntimeInstanceIdentity = z.infer<typeof runtimeInstanceIdentitySchema>;
export type RuntimeIdentityResolution = {
    status: 'missing';
} | {
    status: 'unique';
    instance: RuntimeInstanceIdentity;
} | {
    status: 'ambiguous';
    instances: readonly RuntimeInstanceIdentity[];
};
export interface RuntimeIdentityIndex {
    resolve(identity: AuthoredNodeIdentity): RuntimeIdentityResolution;
    instancesFor(identity: AuthoredNodeIdentity): readonly RuntimeInstanceIdentity[];
    size: number;
}
export declare function parseAuthoredNodeIdentity(value: unknown): AuthoredNodeIdentity;
export declare function parseRuntimeInstanceIdentity(value: unknown): RuntimeInstanceIdentity;
export declare function createRuntimeIdentityIndex(values: readonly unknown[]): RuntimeIdentityIndex;
export {};
//# sourceMappingURL=identity-index.d.ts.map