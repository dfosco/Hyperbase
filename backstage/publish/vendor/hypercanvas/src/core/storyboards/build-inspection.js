function referenceName(value) {
    if (Array.isArray(value) || value === null || typeof value !== 'object')
        return null;
    const reference = value.$ref;
    return typeof reference === 'string' ? reference : null;
}
function collectReferences(value, propertyPath, visit) {
    const reference = referenceName(value);
    if (reference !== null) {
        visit(reference, propertyPath);
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((child, index) => collectReferences(child, `${propertyPath}[${index}]`, visit));
        return;
    }
    if (value === null || typeof value !== 'object')
        return;
    for (const [key, child] of Object.entries(value)) {
        collectReferences(child, `${propertyPath}.${key}`, visit);
    }
}
function addNode(nodes, node) {
    if (!nodes.has(node.id))
        nodes.set(node.id, Object.freeze({ ...node, details: Object.freeze([...node.details]) }));
}
function addEdge(edges, edge) {
    if (!edges.has(edge.id))
        edges.set(edge.id, Object.freeze(edge));
}
/** Build a read-only, source-derived model for the Storyboard Build inspector. */
export function buildStoryboardInspectionGraph({ declarations, behavior, structure = [] }) {
    const nodes = new Map();
    const edges = new Map();
    const diagnostics = [];
    const objectNames = new Set(Object.keys(declarations.objects ?? {}));
    const recordNames = new Set(Object.keys(declarations.records ?? {}));
    for (const scenario of declarations.scenarios) {
        const scenarioId = `scenario:${scenario.name}`;
        addNode(nodes, {
            id: scenarioId,
            kind: 'scenario',
            label: scenario.name,
            details: Object.keys(scenario.data).map(key => `Defines ${key}`),
        });
        for (const [key, value] of Object.entries(scenario.data)) {
            collectReferences(value, `${scenario.name}.${key}`, (reference, propertyPath) => {
                const targetKinds = [objectNames.has(reference) ? 'object' : null, recordNames.has(reference) ? 'record' : null].filter(Boolean);
                if (targetKinds.length === 0) {
                    diagnostics.push({
                        code: 'unresolved-reference',
                        message: `${propertyPath} references missing Statefully data "${reference}".`,
                        sourceNode: scenarioId,
                    });
                    return;
                }
                if (targetKinds.length > 1) {
                    diagnostics.push({
                        code: 'ambiguous-reference',
                        message: `${propertyPath} references "${reference}", which is declared as both an Object and a Record.`,
                        sourceNode: scenarioId,
                    });
                    return;
                }
                const kind = targetKinds[0];
                const targetId = `${kind}:${reference}`;
                addNode(nodes, {
                    id: targetId,
                    kind,
                    label: reference,
                    details: [kind === 'object' ? 'Statefully Object' : 'Statefully Record'],
                });
                addEdge(edges, {
                    id: `references:${scenarioId}:${propertyPath}:${targetId}`,
                    kind: 'references',
                    from: scenarioId,
                    to: targetId,
                    detail: propertyPath,
                });
            });
        }
    }
    for (const [name, object] of Object.entries(declarations.objects ?? {})) {
        addNode(nodes, { id: `object:${name}`, kind: 'object', label: name, details: [`Fields: ${Object.keys(object).join(', ') || 'none'}`] });
    }
    for (const [name, records] of Object.entries(declarations.records ?? {})) {
        addNode(nodes, { id: `record:${name}`, kind: 'record', label: name, details: [`${records.length} record${records.length === 1 ? '' : 's'}`] });
    }
    const conditions = new Map(behavior.conditions.map(condition => [condition.id, condition]));
    const actions = new Map(behavior.actions.map(action => [action.id, action]));
    for (const condition of behavior.conditions) {
        const conditionId = `condition:${condition.id}`;
        addNode(nodes, {
            id: conditionId,
            kind: 'condition',
            label: condition.id,
            details: [condition.description, ...(condition.reads ?? []).map(path => `Reads ${path}`)],
        });
        for (const path of condition.reads ?? []) {
            const stateId = `state:${path}`;
            addNode(nodes, { id: stateId, kind: 'state-field', label: path, details: ['Runtime state field'] });
            addEdge(edges, { id: `reads:${conditionId}:${stateId}`, kind: 'reads', from: conditionId, to: stateId, detail: path });
        }
    }
    for (const control of behavior.controls) {
        const controlId = `control:${control.id}`;
        addNode(nodes, {
            id: controlId,
            kind: 'control',
            label: control.id,
            details: [
                `Invokes ${control.action}`,
                ...(control.condition ? [`Guarded by ${control.condition}`] : []),
            ],
        });
        const action = actions.get(control.action);
        if (!action) {
            diagnostics.push({ code: 'unresolved-action', message: `Control "${control.id}" references missing Action "${control.action}".`, sourceNode: controlId });
        }
        else {
            const actionId = `action:${action.id}`;
            addEdge(edges, { id: `invokes:${controlId}:${actionId}`, kind: 'invokes', from: controlId, to: actionId, detail: 'invokes' });
        }
        if (control.condition) {
            if (!conditions.has(control.condition)) {
                diagnostics.push({ code: 'unresolved-condition', message: `Control "${control.id}" references missing Condition "${control.condition}".`, sourceNode: controlId });
            }
            else {
                const conditionId = `condition:${control.condition}`;
                addEdge(edges, { id: `guarded-by:${controlId}:${conditionId}`, kind: 'guarded-by', from: controlId, to: conditionId, detail: 'guarded by' });
            }
        }
    }
    for (const action of behavior.actions) {
        const actionId = `action:${action.id}`;
        addNode(nodes, { id: actionId, kind: 'action', label: action.id, details: action.writes.map(path => `Writes ${path}`) });
        for (const path of action.writes) {
            const stateId = `state:${path}`;
            addNode(nodes, { id: stateId, kind: 'state-field', label: path, details: ['Runtime state field'] });
            addEdge(edges, { id: `writes:${actionId}:${stateId}`, kind: 'writes', from: actionId, to: stateId, detail: path });
        }
    }
    for (const sourceNode of structure) {
        const sourceId = `structure:${sourceNode.sourcePath}:${sourceNode.nodeId}`;
        addNode(nodes, {
            id: sourceId,
            kind: 'structure',
            label: sourceNode.component,
            details: [`${sourceNode.kind} at ${sourceNode.sourcePath}:${sourceNode.line}:${sourceNode.column}`, `Source identity: ${sourceNode.nodeId}`],
        });
    }
    for (const sourceNode of structure) {
        const parentId = `structure:${sourceNode.sourcePath}:${sourceNode.nodeId}`;
        for (const childNodeId of sourceNode.children) {
            const childId = `structure:${sourceNode.sourcePath}:${childNodeId}`;
            if (!nodes.has(childId))
                continue;
            addEdge(edges, { id: `contains:${parentId}:${childId}`, kind: 'contains', from: parentId, to: childId, detail: 'contains' });
        }
    }
    return Object.freeze({
        nodes: Object.freeze([...nodes.values()]),
        edges: Object.freeze([...edges.values()]),
        diagnostics: Object.freeze(diagnostics.map(diagnostic => Object.freeze(diagnostic))),
    });
}
//# sourceMappingURL=build-inspection.js.map