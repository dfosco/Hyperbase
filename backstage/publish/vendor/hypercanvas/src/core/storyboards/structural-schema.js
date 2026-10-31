import { z } from 'zod';
export const STORYBOARD_NODE_KINDS = ['view', 'template', 'slot', 'block', 'control'];
export const editablePropSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), default: z.string().optional() }).strict(),
    z.object({ type: z.literal('number'), default: z.number().finite().optional(), min: z.number().finite().optional(), max: z.number().finite().optional() }).strict(),
    z.object({ type: z.literal('boolean'), default: z.boolean().optional() }).strict(),
    z.object({ type: z.literal('enum'), values: z.array(z.string().min(1)).min(1), default: z.string().optional() }).strict(),
]).superRefine((prop, context) => {
    if (prop.type === 'number' && prop.min !== undefined && prop.max !== undefined && prop.min > prop.max) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'min must be less than or equal to max' });
    }
    if (prop.type === 'enum' && prop.default !== undefined && !prop.values.includes(prop.default)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'default must be one of the enum values' });
    }
    if (prop.type === 'enum' && new Set(prop.values).size !== prop.values.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'enum values must be unique' });
    }
});
export const editableLayoutFieldSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), default: z.string().optional() }).strict(),
    z.object({ type: z.literal('number'), default: z.number().finite().optional(), min: z.number().finite().optional(), max: z.number().finite().optional() }).strict(),
    z.object({ type: z.literal('enum'), values: z.array(z.string().min(1)).min(1), default: z.string().optional() }).strict(),
]).superRefine((field, context) => {
    if (field.type === 'number' && field.min !== undefined && field.max !== undefined && field.min > field.max) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'min must be less than or equal to max' });
    }
    if (field.type === 'enum' && field.default !== undefined && !field.values.includes(field.default)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'default must be one of the enum values' });
    }
    if (field.type === 'enum' && new Set(field.values).size !== field.values.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'enum values must be unique' });
    }
});
export const componentRegistrationSchema = z.object({
    name: z.string().trim().min(1),
    kind: z.enum(STORYBOARD_NODE_KINDS),
    props: z.record(z.string(), editablePropSchema).default({}),
    layout: z.record(z.string(), editableLayoutFieldSchema).default({}),
    slots: z.record(z.string(), z.object({
        accepts: z.array(z.enum(STORYBOARD_NODE_KINDS)).default(['block', 'control']),
        minChildren: z.number().int().min(0).default(0),
        maxChildren: z.number().int().min(0).optional(),
    }).strict()).default({}),
}).strict().superRefine((registration, context) => {
    for (const [propName, prop] of Object.entries(registration.props)) {
        if (prop.type === 'number' && prop.default !== undefined) {
            if (prop.min !== undefined && prop.default < prop.min) {
                context.addIssue({ code: z.ZodIssueCode.custom, path: ['props', propName, 'default'], message: 'default is below min' });
            }
            if (prop.max !== undefined && prop.default > prop.max) {
                context.addIssue({ code: z.ZodIssueCode.custom, path: ['props', propName, 'default'], message: 'default is above max' });
            }
        }
    }
    for (const [slotName, slot] of Object.entries(registration.slots)) {
        if (slot.maxChildren !== undefined && slot.minChildren > slot.maxChildren) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['slots', slotName], message: 'minChildren exceeds maxChildren' });
        }
    }
});
export function parseComponentRegistration(value) {
    return componentRegistrationSchema.parse(value);
}
function freezeRegistration(registration) {
    for (const prop of Object.values(registration.props)) {
        if (prop.type === 'enum')
            Object.freeze(prop.values);
        Object.freeze(prop);
    }
    for (const [fieldName, field] of Object.entries(registration.layout)) {
        if (field.type === 'enum')
            Object.freeze(field.values);
        Object.freeze(field);
        if (field.type === 'number' && field.default !== undefined) {
            if (field.min !== undefined && field.default < field.min)
                throw new Error(`Layout default ${fieldName} is below min`);
            if (field.max !== undefined && field.default > field.max)
                throw new Error(`Layout default ${fieldName} is above max`);
        }
    }
    for (const slot of Object.values(registration.slots)) {
        Object.freeze(slot.accepts);
        Object.freeze(slot);
    }
    Object.freeze(registration.props);
    Object.freeze(registration.layout);
    Object.freeze(registration.slots);
    return Object.freeze(registration);
}
export function createComponentRegistrationIndex(values) {
    const registrations = values.map((value) => freezeRegistration(parseComponentRegistration(value)));
    const byName = new Map();
    for (const registration of registrations) {
        if (byName.has(registration.name)) {
            throw new Error(`Duplicate Storyboard component registration: ${registration.name}`);
        }
        byName.set(registration.name, registration);
    }
    const snapshot = Object.freeze([...registrations]);
    return Object.freeze({
        get: (name) => byName.get(name),
        has: (name) => byName.has(name),
        values: () => snapshot,
    });
}
//# sourceMappingURL=structural-schema.js.map