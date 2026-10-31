import { z } from 'zod';
const jsonValueSchema = z.lazy(() => z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
]));
const dataObjectSchema = z.record(z.string(), jsonValueSchema);
const scopedNameSchema = z.string().trim().min(1).refine((value) => value !== '.' && value !== '..' && !value.includes('/') && !value.includes('\\'), 'must be a single non-empty path segment');
const declarationsSchema = z.object({
    prototype: z.string().trim().min(1).refine((value) => !value.startsWith('/') && !value.includes('\\') && !value.split('/').includes('..'), 'must be a relative prototype identity'),
    scenarios: z.array(z.object({
        name: scopedNameSchema,
        data: dataObjectSchema,
    }).strict()),
    objects: z.record(scopedNameSchema, dataObjectSchema).optional(),
    records: z.record(scopedNameSchema, z.array(dataObjectSchema)).optional(),
}).strict();
/** Validate declarations received from JS/serialized source at runtime. */
export function parseStoryboardStateDeclarations(value) {
    const parsed = declarationsSchema.parse(value);
    return {
        prototype: parsed.prototype,
        scenarios: parsed.scenarios,
        ...(parsed.objects ? { objects: parsed.objects } : {}),
        ...(parsed.records ? { records: parsed.records } : {}),
    };
}
function scoped(prototype, name) {
    return `${prototype}/${name}`;
}
function withoutPrototypeScope(index, prototype) {
    const prefix = `${prototype}/`;
    return Object.fromEntries(Object.entries(index).filter(([name]) => !name.startsWith(prefix)));
}
/**
 * Replace one Storyboard's declarations in the existing Statefully store.
 * Other prototypes and Statefully index fields are preserved. The adapter
 * keeps no parallel copy of declarations or mutable runtime state.
 */
export function replaceStoryboardStateDeclarations(store, untrustedDeclarations) {
    const declarations = parseStoryboardStateDeclarations(untrustedDeclarations);
    const current = store.getIndex();
    const flows = withoutPrototypeScope(current.flows ?? {}, declarations.prototype);
    const objects = withoutPrototypeScope(current.objects ?? {}, declarations.prototype);
    const records = withoutPrototypeScope(current.records ?? {}, declarations.prototype);
    for (const scenario of declarations.scenarios) {
        const name = scoped(declarations.prototype, scenario.name);
        if (Object.hasOwn(flows, name)) {
            throw new TypeError(`Duplicate Storyboard Scenario: ${scenario.name}`);
        }
        flows[name] = scenario.data;
    }
    for (const [name, data] of Object.entries(declarations.objects ?? {})) {
        objects[scoped(declarations.prototype, name)] = data;
    }
    for (const [name, entries] of Object.entries(declarations.records ?? {})) {
        records[scoped(declarations.prototype, name)] = entries;
    }
    const next = { ...current, flows, objects, records };
    store.replaceIndex(next);
    return next;
}
//# sourceMappingURL=statefully.js.map