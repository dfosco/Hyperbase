import { z } from 'zod';
export declare const STORYBOARD_NODE_KINDS: readonly ["view", "template", "slot", "block", "control"];
export declare const editablePropSchema: z.ZodEffects<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"text">;
    default: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    type: "text";
    default?: string | undefined;
}, {
    type: "text";
    default?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"number">;
    default: z.ZodOptional<z.ZodNumber>;
    min: z.ZodOptional<z.ZodNumber>;
    max: z.ZodOptional<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    type: "number";
    min?: number | undefined;
    max?: number | undefined;
    default?: number | undefined;
}, {
    type: "number";
    min?: number | undefined;
    max?: number | undefined;
    default?: number | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"boolean">;
    default: z.ZodOptional<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    type: "boolean";
    default?: boolean | undefined;
}, {
    type: "boolean";
    default?: boolean | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"enum">;
    values: z.ZodArray<z.ZodString, "many">;
    default: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    values: string[];
    type: "enum";
    default?: string | undefined;
}, {
    values: string[];
    type: "enum";
    default?: string | undefined;
}>]>, {
    type: "text";
    default?: string | undefined;
} | {
    type: "number";
    min?: number | undefined;
    max?: number | undefined;
    default?: number | undefined;
} | {
    type: "boolean";
    default?: boolean | undefined;
} | {
    values: string[];
    type: "enum";
    default?: string | undefined;
}, {
    type: "text";
    default?: string | undefined;
} | {
    type: "number";
    min?: number | undefined;
    max?: number | undefined;
    default?: number | undefined;
} | {
    type: "boolean";
    default?: boolean | undefined;
} | {
    values: string[];
    type: "enum";
    default?: string | undefined;
}>;
export declare const editableLayoutFieldSchema: z.ZodEffects<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"text">;
    default: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    type: "text";
    default?: string | undefined;
}, {
    type: "text";
    default?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"number">;
    default: z.ZodOptional<z.ZodNumber>;
    min: z.ZodOptional<z.ZodNumber>;
    max: z.ZodOptional<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    type: "number";
    min?: number | undefined;
    max?: number | undefined;
    default?: number | undefined;
}, {
    type: "number";
    min?: number | undefined;
    max?: number | undefined;
    default?: number | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"enum">;
    values: z.ZodArray<z.ZodString, "many">;
    default: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    values: string[];
    type: "enum";
    default?: string | undefined;
}, {
    values: string[];
    type: "enum";
    default?: string | undefined;
}>]>, {
    type: "text";
    default?: string | undefined;
} | {
    type: "number";
    min?: number | undefined;
    max?: number | undefined;
    default?: number | undefined;
} | {
    values: string[];
    type: "enum";
    default?: string | undefined;
}, {
    type: "text";
    default?: string | undefined;
} | {
    type: "number";
    min?: number | undefined;
    max?: number | undefined;
    default?: number | undefined;
} | {
    values: string[];
    type: "enum";
    default?: string | undefined;
}>;
export declare const componentRegistrationSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    kind: z.ZodEnum<["view", "template", "slot", "block", "control"]>;
    props: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodEffects<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"text">;
        default: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        type: "text";
        default?: string | undefined;
    }, {
        type: "text";
        default?: string | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"number">;
        default: z.ZodOptional<z.ZodNumber>;
        min: z.ZodOptional<z.ZodNumber>;
        max: z.ZodOptional<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        type: "number";
        min?: number | undefined;
        max?: number | undefined;
        default?: number | undefined;
    }, {
        type: "number";
        min?: number | undefined;
        max?: number | undefined;
        default?: number | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"boolean">;
        default: z.ZodOptional<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        type: "boolean";
        default?: boolean | undefined;
    }, {
        type: "boolean";
        default?: boolean | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"enum">;
        values: z.ZodArray<z.ZodString, "many">;
        default: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        values: string[];
        type: "enum";
        default?: string | undefined;
    }, {
        values: string[];
        type: "enum";
        default?: string | undefined;
    }>]>, {
        type: "text";
        default?: string | undefined;
    } | {
        type: "number";
        min?: number | undefined;
        max?: number | undefined;
        default?: number | undefined;
    } | {
        type: "boolean";
        default?: boolean | undefined;
    } | {
        values: string[];
        type: "enum";
        default?: string | undefined;
    }, {
        type: "text";
        default?: string | undefined;
    } | {
        type: "number";
        min?: number | undefined;
        max?: number | undefined;
        default?: number | undefined;
    } | {
        type: "boolean";
        default?: boolean | undefined;
    } | {
        values: string[];
        type: "enum";
        default?: string | undefined;
    }>>>;
    layout: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodEffects<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"text">;
        default: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        type: "text";
        default?: string | undefined;
    }, {
        type: "text";
        default?: string | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"number">;
        default: z.ZodOptional<z.ZodNumber>;
        min: z.ZodOptional<z.ZodNumber>;
        max: z.ZodOptional<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        type: "number";
        min?: number | undefined;
        max?: number | undefined;
        default?: number | undefined;
    }, {
        type: "number";
        min?: number | undefined;
        max?: number | undefined;
        default?: number | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"enum">;
        values: z.ZodArray<z.ZodString, "many">;
        default: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        values: string[];
        type: "enum";
        default?: string | undefined;
    }, {
        values: string[];
        type: "enum";
        default?: string | undefined;
    }>]>, {
        type: "text";
        default?: string | undefined;
    } | {
        type: "number";
        min?: number | undefined;
        max?: number | undefined;
        default?: number | undefined;
    } | {
        values: string[];
        type: "enum";
        default?: string | undefined;
    }, {
        type: "text";
        default?: string | undefined;
    } | {
        type: "number";
        min?: number | undefined;
        max?: number | undefined;
        default?: number | undefined;
    } | {
        values: string[];
        type: "enum";
        default?: string | undefined;
    }>>>;
    slots: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        accepts: z.ZodDefault<z.ZodArray<z.ZodEnum<["view", "template", "slot", "block", "control"]>, "many">>;
        minChildren: z.ZodDefault<z.ZodNumber>;
        maxChildren: z.ZodOptional<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        accepts: ("control" | "view" | "template" | "slot" | "block")[];
        minChildren: number;
        maxChildren?: number | undefined;
    }, {
        accepts?: ("control" | "view" | "template" | "slot" | "block")[] | undefined;
        minChildren?: number | undefined;
        maxChildren?: number | undefined;
    }>>>;
}, "strict", z.ZodTypeAny, {
    name: string;
    kind: "control" | "view" | "template" | "slot" | "block";
    props: Record<string, {
        type: "text";
        default?: string | undefined;
    } | {
        type: "number";
        min?: number | undefined;
        max?: number | undefined;
        default?: number | undefined;
    } | {
        type: "boolean";
        default?: boolean | undefined;
    } | {
        values: string[];
        type: "enum";
        default?: string | undefined;
    }>;
    layout: Record<string, {
        type: "text";
        default?: string | undefined;
    } | {
        type: "number";
        min?: number | undefined;
        max?: number | undefined;
        default?: number | undefined;
    } | {
        values: string[];
        type: "enum";
        default?: string | undefined;
    }>;
    slots: Record<string, {
        accepts: ("control" | "view" | "template" | "slot" | "block")[];
        minChildren: number;
        maxChildren?: number | undefined;
    }>;
}, {
    name: string;
    kind: "control" | "view" | "template" | "slot" | "block";
    props?: Record<string, {
        type: "text";
        default?: string | undefined;
    } | {
        type: "number";
        min?: number | undefined;
        max?: number | undefined;
        default?: number | undefined;
    } | {
        type: "boolean";
        default?: boolean | undefined;
    } | {
        values: string[];
        type: "enum";
        default?: string | undefined;
    }> | undefined;
    layout?: Record<string, {
        type: "text";
        default?: string | undefined;
    } | {
        type: "number";
        min?: number | undefined;
        max?: number | undefined;
        default?: number | undefined;
    } | {
        values: string[];
        type: "enum";
        default?: string | undefined;
    }> | undefined;
    slots?: Record<string, {
        accepts?: ("control" | "view" | "template" | "slot" | "block")[] | undefined;
        minChildren?: number | undefined;
        maxChildren?: number | undefined;
    }> | undefined;
}>, {
    name: string;
    kind: "control" | "view" | "template" | "slot" | "block";
    props: Record<string, {
        type: "text";
        default?: string | undefined;
    } | {
        type: "number";
        min?: number | undefined;
        max?: number | undefined;
        default?: number | undefined;
    } | {
        type: "boolean";
        default?: boolean | undefined;
    } | {
        values: string[];
        type: "enum";
        default?: string | undefined;
    }>;
    layout: Record<string, {
        type: "text";
        default?: string | undefined;
    } | {
        type: "number";
        min?: number | undefined;
        max?: number | undefined;
        default?: number | undefined;
    } | {
        values: string[];
        type: "enum";
        default?: string | undefined;
    }>;
    slots: Record<string, {
        accepts: ("control" | "view" | "template" | "slot" | "block")[];
        minChildren: number;
        maxChildren?: number | undefined;
    }>;
}, {
    name: string;
    kind: "control" | "view" | "template" | "slot" | "block";
    props?: Record<string, {
        type: "text";
        default?: string | undefined;
    } | {
        type: "number";
        min?: number | undefined;
        max?: number | undefined;
        default?: number | undefined;
    } | {
        type: "boolean";
        default?: boolean | undefined;
    } | {
        values: string[];
        type: "enum";
        default?: string | undefined;
    }> | undefined;
    layout?: Record<string, {
        type: "text";
        default?: string | undefined;
    } | {
        type: "number";
        min?: number | undefined;
        max?: number | undefined;
        default?: number | undefined;
    } | {
        values: string[];
        type: "enum";
        default?: string | undefined;
    }> | undefined;
    slots?: Record<string, {
        accepts?: ("control" | "view" | "template" | "slot" | "block")[] | undefined;
        minChildren?: number | undefined;
        maxChildren?: number | undefined;
    }> | undefined;
}>;
export type StoryboardNodeKind = (typeof STORYBOARD_NODE_KINDS)[number];
export type EditablePropSchema = z.infer<typeof editablePropSchema>;
export type EditableLayoutFieldSchema = z.infer<typeof editableLayoutFieldSchema>;
export type ComponentRegistration = z.infer<typeof componentRegistrationSchema>;
export interface ComponentRegistrationIndex {
    get(name: string): ComponentRegistration | undefined;
    has(name: string): boolean;
    values(): readonly ComponentRegistration[];
}
export declare function parseComponentRegistration(value: unknown): ComponentRegistration;
export declare function createComponentRegistrationIndex(values: readonly unknown[]): ComponentRegistrationIndex;
//# sourceMappingURL=structural-schema.d.ts.map