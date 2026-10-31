import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { parseAuthoredNodeIdentity } from "./identity-index.js";
import { createComponentRegistrationIndex } from "./structural-schema.js";
import { getStoryboardSourceRevision, parseStoryboardSourceRevision } from "./source-revision.js";
export class StoryboardSourceEditError extends Error {
    code;
    status;
    constructor(code, message, status = 422) {
        super(message);
        this.name = 'StoryboardSourceEditError';
        this.code = code;
        this.status = status;
    }
}
const locks = new Map();
function parseTsx(sourcePath, source) {
    const parsed = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const diagnostics = parsed.parseDiagnostics;
    if (diagnostics.length > 0) {
        throw new StoryboardSourceEditError('INVALID_TSX', 'Storyboard source contains TSX syntax errors.');
    }
    return parsed;
}
function parseTypeScript(sourcePath, source) {
    const parsed = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const diagnostics = parsed.parseDiagnostics;
    if (diagnostics.length > 0)
        throw new StoryboardSourceEditError('INVALID_TSX', 'Storyboard declarations contain TypeScript syntax errors.');
    return parsed;
}
function jsxName(node) {
    return ts.isIdentifier(node) ? node.text : null;
}
function readSourceIdentity(node) {
    const identities = node.attributes.properties.filter(property => ts.isJsxAttribute(property) && ts.isIdentifier(property.name) && property.name.text === 'data-hc-node');
    if (identities.length === 0)
        return null;
    if (identities.length > 1) {
        throw new StoryboardSourceEditError('INVALID_SOURCE_IDENTITY', 'A JSX element can declare data-hc-node only once.');
    }
    const identity = identities[0];
    if (!ts.isJsxAttribute(identity) || !identity.initializer || !ts.isStringLiteral(identity.initializer)) {
        throw new StoryboardSourceEditError('INVALID_SOURCE_IDENTITY', 'data-hc-node must be a static, non-empty string attribute.');
    }
    const identityIndex = node.attributes.properties.indexOf(identity);
    if (node.attributes.properties.slice(identityIndex + 1).some(ts.isJsxSpreadAttribute)) {
        throw new StoryboardSourceEditError('INVALID_SOURCE_IDENTITY', 'data-hc-node cannot be overridden by a later JSX spread.');
    }
    const value = identity.initializer.text;
    if (!value.trim())
        throw new StoryboardSourceEditError('INVALID_SOURCE_IDENTITY', 'data-hc-node must be a static, non-empty string attribute.');
    return value;
}
function sourceNodes(sourcePath, source, registrations) {
    const file = parseTsx(sourcePath, source);
    const nodes = [];
    const nodeByStart = new Map();
    const seenIdentities = new Set();
    const revision = getStoryboardSourceRevision(source);
    let opaqueCount = 0;
    const visit = (node) => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
            const sourceIdentity = readSourceIdentity(node);
            const fallbackIdentity = `jsx:${revision}:${node.getStart(file)}`;
            const id = sourceIdentity ?? fallbackIdentity;
            if (seenIdentities.has(id)) {
                throw new StoryboardSourceEditError('DUPLICATE_SOURCE_IDENTITY', `Storyboard source identity is duplicated: ${id}`);
            }
            seenIdentities.add(id);
            const name = jsxName(node.tagName);
            const registration = name ? registrations.get(name) : undefined;
            if (registration && name) {
                const parsedNode = { node, name, registration, id, parentId: null };
                nodes.push(parsedNode);
                nodeByStart.set(node.getStart(file), parsedNode);
            }
            else {
                opaqueCount++;
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(file);
    for (const parsedNode of nodes) {
        let ancestor = parsedNode.node.parent;
        while (ancestor) {
            if (ts.isJsxElement(ancestor) && ancestor.openingElement !== parsedNode.node) {
                parsedNode.parentId = nodeByStart.get(ancestor.openingElement.getStart(file))?.id ?? null;
                break;
            }
            ancestor = ancestor.parent;
        }
    }
    return { file, nodes, nodeByStart, opaqueCount };
}
function literalValue(node) {
    if (!node)
        return undefined;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
        return node.text;
    if (ts.isNumericLiteral(node)) {
        const value = Number(node.text);
        return Number.isFinite(value) ? value : undefined;
    }
    if (node.kind === ts.SyntaxKind.TrueKeyword)
        return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword)
        return false;
    if (node.kind === ts.SyntaxKind.NullKeyword)
        return null;
    return undefined;
}
function readLiteralAttributes(node) {
    const props = {};
    for (const property of node.attributes.properties) {
        if (!ts.isJsxAttribute(property) || !ts.isIdentifier(property.name))
            continue;
        if (property.name.text === 'data-hc-node')
            continue;
        const value = property.initializer;
        if (value === undefined) {
            props[property.name.text] = true;
        }
        else if (ts.isStringLiteral(value)) {
            props[property.name.text] = value.text;
        }
        else if (ts.isJsxExpression(value) && value.expression) {
            const literal = literalValue(value.expression);
            if (literal !== undefined)
                props[property.name.text] = literal;
        }
    }
    return props;
}
function stylePropertyName(name) {
    if (!name || ts.isComputedPropertyName(name))
        return null;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name))
        return name.text;
    return null;
}
function literalStyleValue(expression) {
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))
        return expression.text;
    if (ts.isNumericLiteral(expression)) {
        const value = Number(expression.text);
        return Number.isFinite(value) ? value : undefined;
    }
    return undefined;
}
function literalStyleProperties(node, strict = false) {
    const attributes = node.attributes.properties.filter((property) => ts.isJsxAttribute(property) && ts.isIdentifier(property.name) && property.name.text === 'style');
    if (attributes.length > 1) {
        if (strict)
            throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', 'A JSX element can declare style only once.');
        return { attribute: undefined, object: undefined, values: {} };
    }
    const attribute = attributes[0];
    if (!attribute || !ts.isJsxAttribute(attribute))
        return { attribute, object: undefined, values: {} };
    const initializer = attribute.initializer;
    if (!initializer || !ts.isJsxExpression(initializer) || !initializer.expression || !ts.isObjectLiteralExpression(initializer.expression)) {
        if (strict)
            throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', 'Editable layout requires style={{ ... }} with a literal object.');
        return { attribute, object: undefined, values: {} };
    }
    const object = initializer.expression;
    const values = {};
    for (const property of object.properties) {
        if (!ts.isPropertyAssignment(property)) {
            if (strict)
                throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', 'Style spreads and shorthand properties are opaque to layout editing.');
            continue;
        }
        const name = stylePropertyName(property.name);
        const value = literalStyleValue(property.initializer);
        if (!name || value === undefined) {
            if (strict)
                throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', 'Computed style names and values are opaque to layout editing.');
            continue;
        }
        if (name in values) {
            if (strict)
                throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', `Style property "${name}" is declared more than once.`);
            continue;
        }
        values[name] = value;
    }
    return { attribute, object, values };
}
export function inspectStoryboardSource(sourcePath, source, registrations) {
    const parsed = sourceNodes(sourcePath, source, registrations);
    return {
        sourcePath,
        revision: getStoryboardSourceRevision(source),
        opaqueCount: parsed.opaqueCount,
        nodes: parsed.nodes.map(({ node, name, registration, id }) => {
            const location = parsed.file.getLineAndCharacterOfPosition(node.getStart(parsed.file));
            const props = readLiteralAttributes(node);
            return {
                sourcePath,
                nodeId: id,
                component: name,
                kind: registration.kind,
                line: location.line + 1,
                column: location.character + 1,
                props,
                editableProps: Object.fromEntries(Object.entries(registration.props).filter(([prop]) => prop !== 'data-hc-node')),
                layout: literalStyleProperties(node).values,
                editableLayout: registration.layout,
                children: parsed.nodes.filter(child => child.parentId === id).map(child => child.id),
            };
        }),
    };
}
function validateValue(schema, value) {
    switch (schema.type) {
        case 'text':
            if (typeof value !== 'string')
                break;
            return `{${JSON.stringify(value)}}`;
        case 'number':
            if (typeof value === 'number' && Number.isFinite(value)
                && (schema.min === undefined || value >= schema.min)
                && (schema.max === undefined || value <= schema.max))
                return `{${String(value)}}`;
            break;
        case 'boolean':
            if (typeof value === 'boolean')
                return `{${String(value)}}`;
            break;
        case 'enum':
            if (typeof value === 'string' && schema.values.includes(value))
                return `{${JSON.stringify(value)}}`;
            break;
    }
    throw new StoryboardSourceEditError('INVALID_PROP_VALUE', 'Property value does not match its registered schema.');
}
export function editStoryboardProp(sourcePath, source, command, registrations) {
    const target = parseAuthoredNodeIdentity(command.target);
    if (target.sourcePath !== sourcePath) {
        throw new StoryboardSourceEditError('SOURCE_NODE_MISSING', 'Target source path does not match the edited file.');
    }
    const expectedRevision = parseStoryboardSourceRevision(command.expectedRevision);
    const currentRevision = getStoryboardSourceRevision(source);
    if (expectedRevision !== currentRevision) {
        throw new StoryboardSourceEditError('STALE_SOURCE_REVISION', 'Storyboard source changed since it was inspected.', 409);
    }
    const parsed = sourceNodes(sourcePath, source, registrations);
    const matches = parsed.nodes.filter(candidate => candidate.id === target.nodeId);
    if (matches.length === 0)
        throw new StoryboardSourceEditError('SOURCE_NODE_MISSING', 'The selected JSX node no longer exists.', 409);
    if (matches.length !== 1)
        throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', 'The selected JSX node resolves to more than one source element.');
    const selected = matches[0];
    if (command.prop === 'data-hc-node') {
        throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', 'data-hc-node is source identity metadata and cannot be edited as a component prop.');
    }
    const propSchema = selected.registration.props[command.prop];
    if (!propSchema)
        throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', `Property "${command.prop}" is not editable for ${selected.name}.`);
    if (!/^[A-Za-z_$][\w$]*$/.test(command.prop)) {
        throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', 'Only simple JSX property names can be edited.');
    }
    const renderedValue = validateValue(propSchema, command.value);
    const existing = selected.node.attributes.properties.find(property => ts.isJsxAttribute(property) && ts.isIdentifier(property.name) && property.name.text === command.prop);
    let start;
    let end;
    let replacement;
    if (existing) {
        start = existing.getStart(parsed.file);
        end = existing.getEnd();
        replacement = `${command.prop}=${renderedValue}`;
    }
    else {
        start = selected.node.attributes.end;
        end = start;
        replacement = ` ${command.prop}=${renderedValue}`;
    }
    const updated = `${source.slice(0, start)}${replacement}${source.slice(end)}`;
    parseTsx(sourcePath, updated);
    return { source: updated, revision: getStoryboardSourceRevision(updated) };
}
export function editStoryboardLayout(sourcePath, source, command, registrations) {
    const target = parseAuthoredNodeIdentity(command.target);
    if (target.sourcePath !== sourcePath)
        throw new StoryboardSourceEditError('SOURCE_NODE_MISSING', 'Target source path does not match the edited file.');
    if (getStoryboardSourceRevision(source) !== parseStoryboardSourceRevision(command.expectedRevision)) {
        throw new StoryboardSourceEditError('STALE_SOURCE_REVISION', 'Storyboard source changed since it was inspected.', 409);
    }
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(command.field)) {
        throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', 'Only simple inline style field names can be edited.');
    }
    const parsed = sourceNodes(sourcePath, source, registrations);
    const matches = parsed.nodes.filter(candidate => candidate.id === target.nodeId);
    if (matches.length !== 1) {
        throw new StoryboardSourceEditError(matches.length ? 'SOURCE_NODE_AMBIGUOUS' : 'SOURCE_NODE_MISSING', 'The selected JSX node must resolve to exactly one source element.', 409);
    }
    const selected = matches[0];
    const schema = selected.registration.layout[command.field];
    if (!schema)
        throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', `Layout field "${command.field}" is not editable for ${selected.name}.`);
    const rendered = validateValue(schema, command.value).slice(1, -1);
    const { attribute, object } = literalStyleProperties(selected.node, true);
    if (!attribute) {
        const start = selected.node.attributes.end;
        const updated = `${source.slice(0, start)} style={{ ${command.field}: ${rendered} }}${source.slice(start)}`;
        parseTsx(sourcePath, updated);
        return { source: updated, revision: getStoryboardSourceRevision(updated) };
    }
    if (!object)
        throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', 'Editable layout requires style={{ ... }} with a literal object.');
    const existing = object.properties.find(property => ts.isPropertyAssignment(property) && stylePropertyName(property.name) === command.field);
    let updated;
    if (existing && ts.isPropertyAssignment(existing)) {
        const start = existing.getStart(parsed.file);
        const end = existing.getEnd();
        updated = `${source.slice(0, start)}${command.field}: ${rendered}${source.slice(end)}`;
    }
    else {
        const previous = object.properties[object.properties.length - 1];
        if (!previous) {
            const insertionPoint = object.getEnd() - 1;
            updated = `${source.slice(0, insertionPoint)} ${command.field}: ${rendered} ${source.slice(insertionPoint)}`;
        }
        else {
            const closingBrace = object.getEnd() - 1;
            const trailing = source.slice(previous.getEnd(), closingBrace);
            const trailingComma = trailing.indexOf(',');
            const insertionPoint = trailingComma < 0 ? previous.getEnd() : previous.getEnd() + trailingComma + 1;
            const prefix = trailingComma < 0 ? ', ' : ` ${command.field}: ${rendered},`;
            updated = trailingComma < 0
                ? `${source.slice(0, insertionPoint)}${prefix}${command.field}: ${rendered}${source.slice(insertionPoint)}`
                : `${source.slice(0, insertionPoint)}${prefix}${source.slice(insertionPoint)}`;
        }
    }
    parseTsx(sourcePath, updated);
    return { source: updated, revision: getStoryboardSourceRevision(updated) };
}
function unwrapExpression(expression) {
    let current = expression;
    while (ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isParenthesizedExpression(current)) {
        current = current.expression;
    }
    return current;
}
function objectProperty(object, name) {
    const matches = object.properties.filter((property) => ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === name);
    if (matches.length > 1)
        throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', `Declaration property "${name}" is duplicated.`);
    return matches[0];
}
function staticDeclarationIds(object, propertyName) {
    const property = objectProperty(object, propertyName);
    if (!property || !ts.isArrayLiteralExpression(unwrapExpression(property.initializer))) {
        throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', `Storyboard declaration "${propertyName}" must be a static array.`);
    }
    const array = unwrapExpression(property.initializer);
    const ids = new Map();
    for (const item of array.elements) {
        if (!ts.isObjectLiteralExpression(item))
            throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', `Every ${propertyName} entry must be a static object.`);
        const idProperty = objectProperty(item, 'id');
        if (!idProperty || !ts.isStringLiteral(idProperty.initializer)) {
            throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', `Every ${propertyName} entry must have a static string id.`);
        }
        const id = idProperty.initializer.text;
        if (ids.has(id))
            throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', `Storyboard ${propertyName} id "${id}" is duplicated.`);
        ids.set(id, item);
    }
    return { array, ids };
}
function locateBehaviorDeclaration(sourcePath, source, declarationName) {
    const file = parseTypeScript(sourcePath, source);
    const declarations = [];
    for (const statement of file.statements) {
        if (!ts.isVariableStatement(statement) || !statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword))
            continue;
        for (const declaration of statement.declarationList.declarations) {
            if (ts.isIdentifier(declaration.name) && declaration.name.text === declarationName)
                declarations.push(declaration);
        }
    }
    if (declarations.length !== 1 || !declarations[0].initializer) {
        throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', `Expected one exported ${declarationName} declaration.`);
    }
    const expression = unwrapExpression(declarations[0].initializer);
    if (!ts.isObjectLiteralExpression(expression)) {
        throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', `${declarationName} must be a static object literal.`);
    }
    return { file, behavior: expression };
}
export function inspectStoryboardBindings(sourcePath, source, declarationName = 'travelBookingBehavior') {
    const { behavior } = locateBehaviorDeclaration(sourcePath, source, declarationName);
    const { ids: controls } = staticDeclarationIds(behavior, 'controls');
    const { ids: actions } = staticDeclarationIds(behavior, 'actions');
    const { ids: conditions } = staticDeclarationIds(behavior, 'conditions');
    return {
        sourcePath,
        revision: getStoryboardSourceRevision(source),
        controls: [...controls].map(([id, control]) => {
            const action = objectProperty(control, 'action');
            const condition = objectProperty(control, 'condition');
            return {
                id,
                action: action && ts.isStringLiteral(action.initializer) ? action.initializer.text : null,
                condition: condition && ts.isStringLiteral(condition.initializer) ? condition.initializer.text : null,
            };
        }),
        actions: [...actions.keys()],
        conditions: [...conditions.keys()],
    };
}
function updateObjectPropertyValue(source, sourceFile, object, propertyName, value) {
    const existing = objectProperty(object, propertyName);
    if (existing) {
        if (value === null) {
            const start = existing.initializer.getStart(sourceFile);
            const end = existing.initializer.getEnd();
            return `${source.slice(0, start)}undefined${source.slice(end)}`;
        }
        const start = existing.initializer.getStart(sourceFile);
        const end = existing.initializer.getEnd();
        return `${source.slice(0, start)}${JSON.stringify(value)}${source.slice(end)}`;
    }
    if (value === null)
        return source;
    const insertionPoint = object.getEnd() - 1;
    const previous = object.properties[object.properties.length - 1];
    if (!previous)
        return `${source.slice(0, insertionPoint)}${propertyName}: ${JSON.stringify(value)}${source.slice(insertionPoint)}`;
    const trailing = source.slice(previous.getEnd(), insertionPoint);
    const trailingComma = trailing.indexOf(',');
    const point = trailingComma < 0 ? previous.getEnd() : previous.getEnd() + trailingComma + 1;
    return trailingComma < 0
        ? `${source.slice(0, point)}, ${propertyName}: ${JSON.stringify(value)}${source.slice(point)}`
        : `${source.slice(0, point)} ${propertyName}: ${JSON.stringify(value)},${source.slice(point)}`;
}
export function editStoryboardBinding(sourcePath, source, command, declarationName = 'travelBookingBehavior') {
    if (sourcePath.endsWith('.tsx') || !sourcePath.endsWith('.ts')) {
        throw new StoryboardSourceEditError('INVALID_SOURCE_PATH', 'Control bindings can only be edited in a .ts declarations file.', 400);
    }
    if (getStoryboardSourceRevision(source) !== parseStoryboardSourceRevision(command.expectedRevision)) {
        throw new StoryboardSourceEditError('STALE_SOURCE_REVISION', 'Storyboard source changed since it was inspected.', 409);
    }
    const { file, behavior } = locateBehaviorDeclaration(sourcePath, source, declarationName);
    const { ids: controls } = staticDeclarationIds(behavior, 'controls');
    const { ids: actions } = staticDeclarationIds(behavior, 'actions');
    const { ids: conditions } = staticDeclarationIds(behavior, 'conditions');
    const control = controls.get(command.controlId);
    if (!control)
        throw new StoryboardSourceEditError('SOURCE_NODE_MISSING', `Control "${command.controlId}" is not declared.`);
    if (!actions.has(command.actionId))
        throw new StoryboardSourceEditError('INVALID_PROP_VALUE', `Action "${command.actionId}" is not declared.`);
    if (command.conditionId !== null && !conditions.has(command.conditionId)) {
        throw new StoryboardSourceEditError('INVALID_PROP_VALUE', `Condition "${command.conditionId}" is not declared.`);
    }
    if (control.properties.some(property => ts.isSpreadAssignment(property) || (ts.isPropertyAssignment(property) && ts.isComputedPropertyName(property.name)))) {
        throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', `Control "${command.controlId}" uses spreads or computed keys and cannot be edited safely.`);
    }
    const action = objectProperty(control, 'action');
    if (!action || !ts.isStringLiteral(action.initializer)) {
        throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', `Control "${command.controlId}" action must be a static string.`);
    }
    const condition = objectProperty(control, 'condition');
    if (condition && !ts.isStringLiteral(condition.initializer)
        && !(ts.isIdentifier(condition.initializer) && condition.initializer.text === 'undefined')) {
        throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', `Control "${command.controlId}" condition must be a static string or undefined.`);
    }
    let updated = updateObjectPropertyValue(source, file, control, 'action', command.actionId);
    if (command.conditionId !== null) {
        const refreshed = locateBehaviorDeclaration(sourcePath, updated, declarationName);
        const refreshedControl = staticDeclarationIds(refreshed.behavior, 'controls').ids.get(command.controlId);
        if (!refreshedControl)
            throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', 'Control declaration changed during the binding edit.');
        updated = updateObjectPropertyValue(updated, refreshed.file, refreshedControl, 'condition', command.conditionId);
    }
    else {
        const refreshed = locateBehaviorDeclaration(sourcePath, updated, declarationName);
        const refreshedControl = staticDeclarationIds(refreshed.behavior, 'controls').ids.get(command.controlId);
        if (refreshedControl)
            updated = updateObjectPropertyValue(updated, refreshed.file, refreshedControl, 'condition', null);
    }
    locateBehaviorDeclaration(sourcePath, updated, declarationName);
    return { source: updated, revision: getStoryboardSourceRevision(updated) };
}
export function deleteStoryboardNode(sourcePath, source, command, registrations) {
    const target = parseAuthoredNodeIdentity(command.target);
    if (target.sourcePath !== sourcePath) {
        throw new StoryboardSourceEditError('SOURCE_NODE_MISSING', 'Target source path does not match the edited file.');
    }
    const expectedRevision = parseStoryboardSourceRevision(command.expectedRevision);
    if (getStoryboardSourceRevision(source) !== expectedRevision) {
        throw new StoryboardSourceEditError('STALE_SOURCE_REVISION', 'Storyboard source changed since it was inspected.', 409);
    }
    const parsed = sourceNodes(sourcePath, source, registrations);
    const matches = parsed.nodes.filter(candidate => candidate.id === target.nodeId);
    if (matches.length === 0)
        throw new StoryboardSourceEditError('SOURCE_NODE_MISSING', 'The selected JSX node no longer exists.', 409);
    if (matches.length !== 1)
        throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', 'The selected JSX node resolves to more than one source element.');
    const selected = matches[0];
    if (!selected.parentId) {
        throw new StoryboardSourceEditError('SOURCE_NODE_MISSING', 'Root Storyboard nodes cannot be deleted.');
    }
    const parent = parsed.nodes.find(candidate => candidate.id === selected.parentId);
    if (!parent)
        throw new StoryboardSourceEditError('COMPONENT_NOT_REGISTERED', 'The selected node parent is opaque and cannot be safely edited.');
    const slot = parent.registration.slots.children;
    if (!slot || !slot.accepts.includes(selected.registration.kind)) {
        throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', `${parent.name} does not declare a children slot that accepts ${selected.registration.kind} nodes.`);
    }
    const parentElement = ts.isJsxOpeningElement(parent.node) ? parent.node.parent : null;
    if (!parentElement || !ts.isJsxElement(parentElement)) {
        throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', 'The selected parent has no safely editable JSX children.');
    }
    const childElement = ts.isJsxSelfClosingElement(selected.node) ? selected.node : selected.node.parent;
    if (childElement.parent !== parentElement || !parentElement.children.includes(childElement)) {
        throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', 'Only direct JSX children can be deleted; conditional and computed children remain opaque.');
    }
    if (slot.minChildren > 0) {
        const directChildren = parentElement.children.filter(child => ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child));
        const registeredDirectChildren = parsed.nodes.filter(candidate => {
            const child = ts.isJsxSelfClosingElement(candidate.node) ? candidate.node : candidate.node.parent;
            return child.parent === parentElement && parentElement.children.includes(child);
        });
        if (directChildren.length !== registeredDirectChildren.length
            || parentElement.children.some(child => ts.isJsxExpression(child) && child.expression)) {
            throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', 'The parent slot has opaque children, so its minimum cannot be verified safely.');
        }
        if (registeredDirectChildren.length - 1 < slot.minChildren) {
            throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', `${parent.name} requires at least ${slot.minChildren} child nodes.`);
        }
    }
    const start = childElement.getStart(parsed.file);
    const end = childElement.getEnd();
    const updated = `${source.slice(0, start)}${source.slice(end)}`;
    parseTsx(sourcePath, updated);
    return { source: updated, revision: getStoryboardSourceRevision(updated) };
}
export function insertStoryboardNode(sourcePath, source, command, registrations) {
    const target = parseAuthoredNodeIdentity(command.target);
    if (target.sourcePath !== sourcePath) {
        throw new StoryboardSourceEditError('SOURCE_NODE_MISSING', 'Target source path does not match the edited file.');
    }
    if (getStoryboardSourceRevision(source) !== parseStoryboardSourceRevision(command.expectedRevision)) {
        throw new StoryboardSourceEditError('STALE_SOURCE_REVISION', 'Storyboard source changed since it was inspected.', 409);
    }
    if (!Number.isSafeInteger(command.index) || command.index < 0) {
        throw new StoryboardSourceEditError('INVALID_PROP_VALUE', 'Child insertion index must be a non-negative integer.');
    }
    const parsed = sourceNodes(sourcePath, source, registrations);
    const matches = parsed.nodes.filter(candidate => candidate.id === target.nodeId);
    if (matches.length !== 1) {
        throw new StoryboardSourceEditError(matches.length ? 'SOURCE_NODE_AMBIGUOUS' : 'SOURCE_NODE_MISSING', 'The selected JSX node must resolve to exactly one source element.', 409);
    }
    const parent = matches[0];
    if (command.slot !== 'children') {
        throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', 'Only the JSX children slot is currently editable.');
    }
    const slot = parent.registration.slots[command.slot];
    if (!slot)
        throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', `${parent.name} does not declare a ${command.slot} slot.`);
    const childRegistration = registrations.get(command.component);
    if (!childRegistration || !/^[A-Za-z_$][\w$]*$/.test(command.component)) {
        throw new StoryboardSourceEditError('COMPONENT_NOT_REGISTERED', `Component "${command.component}" is not registered for Storyboards.`);
    }
    if (!slot.accepts.includes(childRegistration.kind)) {
        throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', `${parent.name}.${command.slot} does not accept ${childRegistration.kind} nodes.`);
    }
    const props = command.props;
    if (!props || typeof props !== 'object' || Array.isArray(props)) {
        throw new StoryboardSourceEditError('INVALID_PROP_VALUE', 'Inserted component props must be an object.');
    }
    const attributes = Object.entries(props).map(([name, value]) => {
        if (name === 'data-hc-node')
            throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', 'data-hc-node is generated source identity metadata.');
        const schema = childRegistration.props[name];
        if (!schema || !/^[A-Za-z_$][\w$]*$/.test(name)) {
            throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', `Property "${name}" is not editable for ${command.component}.`);
        }
        return `${name}=${validateValue(schema, value)}`;
    });
    const parentNode = parent.node;
    const parentElement = ts.isJsxOpeningElement(parentNode) ? parentNode.parent : null;
    const directChildren = parentElement && ts.isJsxElement(parentElement)
        ? parentElement.children.filter(child => ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child))
        : [];
    if (parentElement && ts.isJsxElement(parentElement)) {
        const registeredDirectChildren = parsed.nodes.filter(candidate => {
            const child = ts.isJsxSelfClosingElement(candidate.node) ? candidate.node : candidate.node.parent;
            return child.parent === parentElement && parentElement.children.includes(child);
        });
        if (directChildren.length !== registeredDirectChildren.length
            || parentElement.children.some(child => ts.isJsxExpression(child) && child.expression)) {
            throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', 'The target slot contains opaque JSX children and cannot be safely edited.');
        }
        if (registeredDirectChildren.some(child => !slot.accepts.includes(child.registration.kind))) {
            throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', `${parent.name}.${command.slot} contains a child kind outside its registered slot schema.`);
        }
        if (command.index > directChildren.length) {
            throw new StoryboardSourceEditError('INVALID_PROP_VALUE', 'Child insertion index is outside the target slot.');
        }
        if (directChildren.length + 1 < slot.minChildren) {
            throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', `${parent.name}.${command.slot} requires at least ${slot.minChildren} child nodes.`);
        }
        const nextChild = directChildren[command.index];
        const insertionPoint = nextChild ? nextChild.getStart(parsed.file) : parentElement.closingElement.getStart(parsed.file);
        if (slot.maxChildren !== undefined && directChildren.length + 1 > slot.maxChildren) {
            throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', `${parent.name}.${command.slot} accepts at most ${slot.maxChildren} child nodes.`);
        }
        const nodeId = randomUUID();
        const attributesText = [`data-hc-node=${JSON.stringify(nodeId)}`, ...attributes].join(' ');
        const childSource = `<${command.component} ${attributesText} />`;
        const updated = `${source.slice(0, insertionPoint)}${childSource}${source.slice(insertionPoint)}`;
        parseTsx(sourcePath, updated);
        return { source: updated, revision: getStoryboardSourceRevision(updated), nodeId };
    }
    if (ts.isJsxSelfClosingElement(parentNode) && command.index === 0) {
        if (slot.minChildren > 1 || (slot.maxChildren !== undefined && slot.maxChildren < 1)) {
            throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', `${parent.name}.${command.slot} cannot accept one child node.`);
        }
        const nodeId = randomUUID();
        const attributesText = [`data-hc-node=${JSON.stringify(nodeId)}`, ...attributes].join(' ');
        const start = parentNode.getStart(parsed.file);
        const end = parentNode.getEnd();
        const opening = source.slice(start, parentNode.attributes.end);
        const childSource = `<${command.component} ${attributesText} />`;
        const updated = `${source.slice(0, start)}${opening}>${childSource}</${command.component === parent.name ? command.component : parent.name}>${source.slice(end)}`;
        parseTsx(sourcePath, updated);
        return { source: updated, revision: getStoryboardSourceRevision(updated), nodeId };
    }
    throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', 'The target JSX node has no safely editable child slot.');
}
function asElementNode(node) {
    return ts.isJsxSelfClosingElement(node.node) ? node.node : node.node.parent;
}
function childrenOf(parent, parsed, slotName = 'children') {
    if (slotName !== 'children')
        throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', 'Only the JSX children slot is currently editable.');
    const slot = parent.registration.slots[slotName];
    if (!slot)
        throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', `${parent.name} does not declare a ${slotName} slot.`);
    if (!ts.isJsxOpeningElement(parent.node) || !ts.isJsxElement(parent.node.parent)) {
        throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', 'The target node must be an open JSX element with a children slot.');
    }
    const element = parent.node.parent;
    const jsxChildren = element.children.filter(child => ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child));
    const registeredChildren = parsed.nodes.filter(candidate => {
        const child = asElementNode(candidate);
        return child.parent === element && element.children.includes(child);
    });
    if (jsxChildren.length !== registeredChildren.length
        || element.children.some(child => ts.isJsxExpression(child) && child.expression)) {
        throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', 'The target slot contains opaque JSX children and cannot be safely edited.');
    }
    if (registeredChildren.some(child => !slot.accepts.includes(child.registration.kind))) {
        throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', `${parent.name}.${slotName} contains a child kind outside its registered slot schema.`);
    }
    return { slot, element, children: registeredChildren.sort((a, b) => asElementNode(a).getStart(parsed.file) - asElementNode(b).getStart(parsed.file)) };
}
function addFreshDuplicateIdentities(sourcePath, snippet) {
    const prefix = 'const __storyboardDuplicate = ';
    const wrapped = parseTsx(sourcePath, `${prefix}${snippet}`);
    const initializer = wrapped.statements[0].declarationList.declarations[0].initializer;
    if (!initializer || (!ts.isJsxElement(initializer) && !ts.isJsxSelfClosingElement(initializer))) {
        throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', 'Only direct JSX elements can be duplicated.');
    }
    const openings = [];
    const visit = (node) => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
            openings.push(node);
        ts.forEachChild(node, visit);
    };
    visit(initializer);
    const edits = [];
    let rootId = '';
    for (const [index, opening] of openings.entries()) {
        const id = randomUUID();
        if (index === 0)
            rootId = id;
        const identity = opening.attributes.properties.find(property => ts.isJsxAttribute(property) && ts.isIdentifier(property.name) && property.name.text === 'data-hc-node');
        if (identity) {
            edits.push({ start: identity.getStart(wrapped) - prefix.length, end: identity.getEnd() - prefix.length, text: `data-hc-node=${JSON.stringify(id)}` });
        }
        else if (index === 0) {
            const insertionPoint = opening.attributes.end - prefix.length;
            edits.push({ start: insertionPoint, end: insertionPoint, text: ` data-hc-node=${JSON.stringify(id)}` });
        }
    }
    let duplicated = snippet;
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
        duplicated = `${duplicated.slice(0, edit.start)}${edit.text}${duplicated.slice(edit.end)}`;
    }
    return { source: duplicated, rootId };
}
export function duplicateStoryboardNode(sourcePath, source, command, registrations) {
    const target = parseAuthoredNodeIdentity(command.target);
    if (target.sourcePath !== sourcePath)
        throw new StoryboardSourceEditError('SOURCE_NODE_MISSING', 'Target source path does not match the edited file.');
    if (getStoryboardSourceRevision(source) !== parseStoryboardSourceRevision(command.expectedRevision)) {
        throw new StoryboardSourceEditError('STALE_SOURCE_REVISION', 'Storyboard source changed since it was inspected.', 409);
    }
    if (!Number.isSafeInteger(command.index) || command.index < 0)
        throw new StoryboardSourceEditError('INVALID_PROP_VALUE', 'Child insertion index must be a non-negative integer.');
    const parsed = sourceNodes(sourcePath, source, registrations);
    const selectedMatches = parsed.nodes.filter(node => node.id === target.nodeId);
    if (selectedMatches.length !== 1)
        throw new StoryboardSourceEditError(selectedMatches.length ? 'SOURCE_NODE_AMBIGUOUS' : 'SOURCE_NODE_MISSING', 'The selected JSX node must resolve to exactly one source element.', 409);
    const selected = selectedMatches[0];
    if (!selected.parentId)
        throw new StoryboardSourceEditError('SOURCE_NODE_MISSING', 'Root Storyboard nodes cannot be duplicated.');
    const parent = parsed.nodes.find(node => node.id === selected.parentId);
    if (!parent)
        throw new StoryboardSourceEditError('COMPONENT_NOT_REGISTERED', 'The selected node parent is opaque and cannot be safely edited.');
    const { slot, element: parentElement, children } = childrenOf(parent, parsed, command.slot);
    if (!slot.accepts.includes(selected.registration.kind))
        throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', `${parent.name}.${command.slot} does not accept ${selected.registration.kind} nodes.`);
    if (command.index > children.length)
        throw new StoryboardSourceEditError('INVALID_PROP_VALUE', 'Child insertion index is outside the target slot.');
    if (children.length + 1 < slot.minChildren)
        throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', `${parent.name}.${command.slot} requires at least ${slot.minChildren} child nodes.`);
    if (slot.maxChildren !== undefined && children.length + 1 > slot.maxChildren) {
        throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', `${parent.name}.${command.slot} accepts at most ${slot.maxChildren} child nodes.`);
    }
    const childElement = asElementNode(selected);
    const snippet = source.slice(childElement.getStart(parsed.file), childElement.getEnd());
    const duplicated = addFreshDuplicateIdentities(sourcePath, snippet);
    const insertionPoint = children[command.index] ? asElementNode(children[command.index]).getStart(parsed.file) : parentElement.closingElement.getStart(parsed.file);
    const updated = `${source.slice(0, insertionPoint)}${duplicated.source}${source.slice(insertionPoint)}`;
    parseTsx(sourcePath, updated);
    return { source: updated, revision: getStoryboardSourceRevision(updated), nodeId: duplicated.rootId };
}
export function reorderStoryboardNode(sourcePath, source, command, registrations) {
    const target = parseAuthoredNodeIdentity(command.target);
    if (target.sourcePath !== sourcePath)
        throw new StoryboardSourceEditError('SOURCE_NODE_MISSING', 'Target source path does not match the edited file.');
    if (getStoryboardSourceRevision(source) !== parseStoryboardSourceRevision(command.expectedRevision)) {
        throw new StoryboardSourceEditError('STALE_SOURCE_REVISION', 'Storyboard source changed since it was inspected.', 409);
    }
    if (!Number.isSafeInteger(command.index) || command.index < 0)
        throw new StoryboardSourceEditError('INVALID_PROP_VALUE', 'Child position must be a non-negative integer.');
    const parsed = sourceNodes(sourcePath, source, registrations);
    const matches = parsed.nodes.filter(node => node.id === target.nodeId);
    if (matches.length !== 1)
        throw new StoryboardSourceEditError(matches.length ? 'SOURCE_NODE_AMBIGUOUS' : 'SOURCE_NODE_MISSING', 'The selected JSX node must resolve to exactly one source element.', 409);
    const selected = matches[0];
    if (!selected.parentId)
        throw new StoryboardSourceEditError('SOURCE_NODE_MISSING', 'Root Storyboard nodes cannot be reordered.');
    const parent = parsed.nodes.find(node => node.id === selected.parentId);
    if (!parent)
        throw new StoryboardSourceEditError('COMPONENT_NOT_REGISTERED', 'The selected node parent is opaque and cannot be safely edited.');
    const { children, element } = childrenOf(parent, parsed);
    const sourceIndex = children.findIndex(child => child.id === selected.id);
    if (sourceIndex < 0)
        throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', 'Only direct registered JSX children can be reordered.');
    const remaining = children.filter(child => child.id !== selected.id);
    if (command.index >= children.length)
        throw new StoryboardSourceEditError('INVALID_PROP_VALUE', 'Child position is outside the target slot.');
    if (command.index === sourceIndex)
        return { source, revision: getStoryboardSourceRevision(source) };
    const moved = asElementNode(selected);
    const start = moved.getStart(parsed.file);
    const end = moved.getEnd();
    const snippet = source.slice(start, end);
    const destination = remaining[command.index]
        ? asElementNode(remaining[command.index]).getStart(parsed.file)
        : element.closingElement.getStart(parsed.file);
    let updated;
    if (destination < start) {
        updated = `${source.slice(0, destination)}${snippet}${source.slice(destination, start)}${source.slice(end)}`;
    }
    else {
        updated = `${source.slice(0, start)}${source.slice(end, destination)}${snippet}${source.slice(destination)}`;
    }
    parseTsx(sourcePath, updated);
    return { source: updated, revision: getStoryboardSourceRevision(updated) };
}
export function reparentStoryboardNode(sourcePath, source, command, registrations) {
    const target = parseAuthoredNodeIdentity(command.target);
    const newParentIdentity = parseAuthoredNodeIdentity(command.parent);
    if (target.sourcePath !== sourcePath || newParentIdentity.sourcePath !== sourcePath) {
        throw new StoryboardSourceEditError('SOURCE_NODE_MISSING', 'Target and parent source paths must match the edited file.');
    }
    if (getStoryboardSourceRevision(source) !== parseStoryboardSourceRevision(command.expectedRevision)) {
        throw new StoryboardSourceEditError('STALE_SOURCE_REVISION', 'Storyboard source changed since it was inspected.', 409);
    }
    if (!Number.isSafeInteger(command.index) || command.index < 0)
        throw new StoryboardSourceEditError('INVALID_PROP_VALUE', 'Child insertion index must be a non-negative integer.');
    const parsed = sourceNodes(sourcePath, source, registrations);
    const targetMatches = parsed.nodes.filter(node => node.id === target.nodeId);
    const parentMatches = parsed.nodes.filter(node => node.id === newParentIdentity.nodeId);
    if (targetMatches.length !== 1 || parentMatches.length !== 1) {
        throw new StoryboardSourceEditError(targetMatches.length > 1 || parentMatches.length > 1 ? 'SOURCE_NODE_AMBIGUOUS' : 'SOURCE_NODE_MISSING', 'Target and parent must each resolve to exactly one source node.', 409);
    }
    const selected = targetMatches[0];
    const newParent = parentMatches[0];
    if (!selected.parentId)
        throw new StoryboardSourceEditError('SOURCE_NODE_MISSING', 'Root Storyboard nodes cannot be reparented.');
    if (selected.id === newParent.id)
        throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', 'A node cannot be reparented into itself.');
    const oldParent = parsed.nodes.find(node => node.id === selected.parentId);
    if (!oldParent)
        throw new StoryboardSourceEditError('COMPONENT_NOT_REGISTERED', 'The current parent is opaque and cannot be safely edited.');
    const oldSlot = oldParent.registration.slots.children;
    if (!oldSlot || !oldSlot.accepts.includes(selected.registration.kind)) {
        throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', `${oldParent.name} does not declare a children slot that accepts ${selected.registration.kind} nodes.`);
    }
    const oldResolved = childrenOf(oldParent, parsed);
    const sourceIndex = oldResolved.children.findIndex(child => child.id === selected.id);
    if (sourceIndex < 0)
        throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', 'Only direct registered JSX children can be reparented.');
    if (oldParent.id === newParent.id) {
        return reorderStoryboardNode(sourcePath, source, {
            type: 'reorderNode', target, expectedRevision: command.expectedRevision, index: command.index,
        }, registrations);
    }
    if (oldResolved.children.length - 1 < oldSlot.minChildren) {
        throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', `${oldParent.name}.children requires at least ${oldSlot.minChildren} child nodes.`);
    }
    const movingElement = asElementNode(selected);
    const movingStart = movingElement.getStart(parsed.file);
    const movingEnd = movingElement.getEnd();
    const newParentStart = newParent.node.getStart(parsed.file);
    const newParentEnd = newParent.node.getEnd();
    if (movingStart <= newParentStart && movingEnd >= newParentEnd) {
        throw new StoryboardSourceEditError('SOURCE_NODE_AMBIGUOUS', 'A node cannot be reparented into its own descendant.');
    }
    const newResolved = childrenOf(newParent, parsed, command.slot);
    if (!newResolved.slot.accepts.includes(selected.registration.kind)) {
        throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', `${newParent.name}.${command.slot} does not accept ${selected.registration.kind} nodes.`);
    }
    if (command.index > newResolved.children.length)
        throw new StoryboardSourceEditError('INVALID_PROP_VALUE', 'Child insertion index is outside the target slot.');
    if (newResolved.children.length + 1 < newResolved.slot.minChildren)
        throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', `${newParent.name}.${command.slot} requires at least ${newResolved.slot.minChildren} child nodes.`);
    if (newResolved.slot.maxChildren !== undefined && newResolved.children.length + 1 > newResolved.slot.maxChildren) {
        throw new StoryboardSourceEditError('PROP_NOT_EDITABLE', `${newParent.name}.${command.slot} accepts at most ${newResolved.slot.maxChildren} child nodes.`);
    }
    const newParentElement = newResolved.element;
    const destinationNode = newResolved.children[command.index];
    const destination = destinationNode ? asElementNode(destinationNode).getStart(parsed.file) : newParentElement.closingElement.getStart(parsed.file);
    const snippet = source.slice(movingStart, movingEnd);
    const updated = destination < movingStart
        ? `${source.slice(0, destination)}${snippet}${source.slice(destination, movingStart)}${source.slice(movingEnd)}`
        : `${source.slice(0, movingStart)}${source.slice(movingEnd, destination)}${snippet}${source.slice(destination)}`;
    parseTsx(sourcePath, updated);
    return { source: updated, revision: getStoryboardSourceRevision(updated) };
}
function isInside(root, candidate) {
    const relative = path.relative(root, candidate);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}
function atomicWrite(root, filePath, source) {
    const canonicalRoot = fs.realpathSync.native(root);
    if (!isInside(canonicalRoot, filePath)) {
        throw new StoryboardSourceEditError('UNSAFE_SOURCE_PATH', 'Storyboard source path is outside the active Notebook.');
    }
    const parentDirectory = fs.realpathSync.native(path.dirname(filePath));
    if (!isInside(canonicalRoot, parentDirectory)) {
        throw new StoryboardSourceEditError('UNSAFE_SOURCE_PATH', 'Storyboard source parent resolves outside the active Notebook.');
    }
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink() || !isInside(canonicalRoot, fs.realpathSync.native(filePath))) {
        throw new StoryboardSourceEditError('UNSAFE_SOURCE_PATH', 'Storyboard source path resolves through a symlink.');
    }
    const temporary = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`);
    try {
        fs.writeFileSync(temporary, source, { encoding: 'utf8', flag: 'wx', mode: stat.mode & 0o777 });
        fs.renameSync(temporary, filePath);
    }
    finally {
        try {
            fs.rmSync(temporary, { force: true });
        }
        catch { /* atomic rename already succeeded */ }
    }
}
async function withSourceLock(filePath, operation) {
    const key = path.resolve(filePath);
    const previous = locks.get(key) ?? Promise.resolve();
    let release;
    const current = new Promise(resolve => { release = resolve; });
    locks.set(key, current);
    await previous.catch(() => { });
    try {
        return await operation();
    }
    finally {
        release();
        if (locks.get(key) === current)
            locks.delete(key);
    }
}
function resolveSourceScope(runtime, fallbackRoot, body, requireScope = true) {
    const status = runtime?.status();
    if (status?.active && status.root && typeof status.notebook?.manifest?.id === 'string') {
        if (requireScope && (body.notebookId !== status.notebook.manifest.id || body.generation !== status.generation)) {
            throw Object.assign(new StoryboardSourceEditError('UNSAFE_SOURCE_PATH', 'The active Notebook changed; reload Storyboard source.', 409), { code: 'NOTEBOOK_SCOPE_CONFLICT' });
        }
        return { root: status.root, notebookId: status.notebook.manifest.id, generation: status.generation ?? 0, kind: 'notebook' };
    }
    if (!fallbackRoot) {
        throw Object.assign(new StoryboardSourceEditError('UNSAFE_SOURCE_PATH', 'There is no active Notebook or Storyboard workspace root.', 409), { code: 'NOTEBOOK_SCOPE_CONFLICT' });
    }
    let canonicalRoot;
    try {
        canonicalRoot = fs.realpathSync.native(fallbackRoot);
        if (!fs.statSync(canonicalRoot).isDirectory())
            throw new Error('Workspace source root is not a directory.');
    }
    catch {
        throw new StoryboardSourceEditError('UNSAFE_SOURCE_PATH', 'Storyboard workspace source root is unavailable.', 409);
    }
    if (requireScope && (body.notebookId !== 'workspace-root' || body.generation !== 0)) {
        throw Object.assign(new StoryboardSourceEditError('UNSAFE_SOURCE_PATH', 'The active source scope changed; reload Storyboard source.', 409), { code: 'NOTEBOOK_SCOPE_CONFLICT' });
    }
    return { root: canonicalRoot, notebookId: 'workspace-root', generation: 0, kind: 'workspace-root' };
}
function sourceFile(scope, value, resolvePath, extension = '.tsx') {
    if (typeof value !== 'string' || !value.startsWith('prototypes/') || !value.endsWith(extension)) {
        throw new StoryboardSourceEditError('INVALID_SOURCE_PATH', `Storyboard source path must name a ${extension} file under prototypes.`, 400);
    }
    let absolutePath;
    try {
        if (scope.kind === 'notebook') {
            absolutePath = resolvePath(scope.root, value);
        }
        else {
            if (value.includes('\\') || value.includes('\0') || value.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
                throw new Error('Workspace source path must be normalized and contained.');
            }
            absolutePath = path.resolve(scope.root, value);
            if (!isInside(scope.root, absolutePath) || !isInside(scope.root, fs.realpathSync.native(absolutePath))
                || fs.lstatSync(absolutePath).isSymbolicLink()) {
                throw new Error('Workspace source path resolves outside its root or through a symlink.');
            }
        }
    }
    catch (error) {
        throw new StoryboardSourceEditError('UNSAFE_SOURCE_PATH', error instanceof Error ? error.message : 'Invalid Notebook source path.', 400);
    }
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
        throw new StoryboardSourceEditError('SOURCE_NOT_FOUND', 'Storyboard source file was not found.', 404);
    }
    return { path: value, absolutePath };
}
/** Notebook/workspace-scoped inspect and schema-validated TSX Storyboard edits. */
export function createStoryboardSourceRoutes({ runtime, fallbackRoot = null, registrations = createComponentRegistrationIndex([]), behaviorDeclarationName = 'travelBookingBehavior', resolvePath, sendJson, eventSender = () => { }, }) {
    const sourceHistories = new Map();
    const historyKey = (scope, sourcePath) => `${scope.root}\0${scope.notebookId}\0${scope.generation}\0${sourcePath}`;
    const historyFor = (scope, sourcePath) => {
        const key = historyKey(scope, sourcePath);
        let history = sourceHistories.get(key);
        if (!history) {
            history = { undo: [], redo: [] };
            sourceHistories.set(key, history);
        }
        return history;
    };
    const historyStatus = (scope, sourcePath) => {
        const history = sourceHistories.get(historyKey(scope, sourcePath));
        return { canUndo: Boolean(history?.undo.length), canRedo: Boolean(history?.redo.length) };
    };
    const persistEdit = (scope, sourcePath, absolutePath, before, after) => {
        if (before === after)
            return;
        atomicWrite(scope.root, absolutePath, after);
        const history = historyFor(scope, sourcePath);
        history.undo.push({
            before,
            after,
            beforeRevision: getStoryboardSourceRevision(before),
            afterRevision: getStoryboardSourceRevision(after),
        });
        if (history.undo.length > 100)
            history.undo.shift();
        history.redo = [];
    };
    return async function storyboardSourceRoutes(_req, res, context) {
        const body = context.body ?? {};
        try {
            if (context.method === 'GET' && context.path.split('?', 1)[0] === '/source') {
                const url = new URL(context.path, 'http://localhost');
                const scope = resolveSourceScope(runtime, fallbackRoot, body, false);
                const requestedPath = url.searchParams.get('path');
                const declarationFile = typeof requestedPath === 'string' && requestedPath.endsWith('.ts') && !requestedPath.endsWith('.tsx');
                const sourcePath = sourceFile(scope, requestedPath, resolvePath, declarationFile ? '.ts' : '.tsx');
                const source = fs.readFileSync(sourcePath.absolutePath, 'utf8');
                if (declarationFile) {
                    return sendJson(res, 200, {
                        ...scope,
                        ...inspectStoryboardBindings(sourcePath.path, source, behaviorDeclarationName),
                        history: historyStatus(scope, sourcePath.path),
                    });
                }
                return sendJson(res, 200, {
                    ...scope,
                    ...inspectStoryboardSource(sourcePath.path, source, registrations),
                    history: historyStatus(scope, sourcePath.path),
                });
            }
            if (context.method === 'POST' && ['/source/undo', '/source/redo'].includes(context.path.split('?', 1)[0])) {
                const operation = context.path.split('?', 1)[0] === '/source/undo' ? 'undo' : 'redo';
                const expectedType = operation === 'undo' ? 'undoSource' : 'redoSource';
                if (typeof body.notebookId !== 'string' || !Number.isInteger(body.generation)
                    || typeof body.path !== 'string' || typeof body.expectedRevision !== 'string' || body.type !== expectedType) {
                    return sendJson(res, 400, { error: { code: 'INVALID_STORYBOARD_SOURCE_COMMAND', message: `notebookId, generation, path, expectedRevision, and a ${expectedType} command are required.` } });
                }
                const scope = resolveSourceScope(runtime, fallbackRoot, body);
                const historyExtension = body.path.endsWith('.ts') && !body.path.endsWith('.tsx') ? '.ts' : '.tsx';
                const sourcePath = sourceFile(scope, body.path, resolvePath, historyExtension);
                return await withSourceLock(sourcePath.absolutePath, () => {
                    const current = fs.readFileSync(sourcePath.absolutePath, 'utf8');
                    const currentRevision = getStoryboardSourceRevision(current);
                    const expectedRevision = parseStoryboardSourceRevision(body.expectedRevision);
                    if (currentRevision !== expectedRevision) {
                        throw new StoryboardSourceEditError('STALE_SOURCE_REVISION', 'Storyboard source changed since history was inspected.', 409);
                    }
                    const history = sourceHistories.get(historyKey(scope, sourcePath.path));
                    const stack = operation === 'undo' ? history?.undo : history?.redo;
                    const entry = stack?.[stack.length - 1];
                    if (!entry || !history) {
                        throw new StoryboardSourceEditError('SOURCE_HISTORY_EMPTY', `There is no source ${operation} operation available.`, 409);
                    }
                    const stackRevision = operation === 'undo' ? entry.afterRevision : entry.beforeRevision;
                    if (currentRevision !== stackRevision) {
                        throw new StoryboardSourceEditError('SOURCE_HISTORY_CONFLICT', 'Source history no longer matches the current file revision.', 409);
                    }
                    const restored = operation === 'undo' ? entry.before : entry.after;
                    atomicWrite(scope.root, sourcePath.absolutePath, restored);
                    stack.pop();
                    if (operation === 'undo')
                        history.redo.push(entry);
                    else {
                        history.undo.push(entry);
                        if (history.undo.length > 100)
                            history.undo.shift();
                    }
                    const revision = getStoryboardSourceRevision(restored);
                    const status = historyStatus(scope, sourcePath.path);
                    eventSender({ type: 'custom', event: 'storyboard:source-updated', data: { path: sourcePath.path, revision } });
                    return sendJson(res, 200, {
                        ...scope,
                        path: sourcePath.path,
                        revision,
                        content: restored,
                        history: status,
                    });
                });
            }
            if (context.method === 'POST' && context.path.split('?', 1)[0] === '/source/prop') {
                if (typeof body.notebookId !== 'string' || !Number.isInteger(body.generation)
                    || typeof body.path !== 'string' || typeof body.expectedRevision !== 'string'
                    || typeof body.prop !== 'string' || !('value' in body) || body.type !== 'setProp') {
                    return sendJson(res, 400, { error: { code: 'INVALID_STORYBOARD_SOURCE_COMMAND', message: 'notebookId, generation, path, expectedRevision, and a setProp command are required.' } });
                }
                if (typeof body.target !== 'object' || body.target === null) {
                    return sendJson(res, 400, { error: { code: 'INVALID_STORYBOARD_SOURCE_COMMAND', message: 'target source identity is required.' } });
                }
                const scope = resolveSourceScope(runtime, fallbackRoot, body);
                const target = parseAuthoredNodeIdentity(body.target);
                const sourcePath = sourceFile(scope, body.path, resolvePath);
                if (target.sourcePath !== sourcePath.path) {
                    throw new StoryboardSourceEditError('SOURCE_NODE_MISSING', 'Target source identity does not match the requested file.', 409);
                }
                return await withSourceLock(sourcePath.absolutePath, () => {
                    const before = fs.readFileSync(sourcePath.absolutePath, 'utf8');
                    const edited = editStoryboardProp(sourcePath.path, before, {
                        type: 'setProp',
                        target,
                        expectedRevision: body.expectedRevision,
                        prop: body.prop,
                        value: body.value,
                    }, registrations);
                    const latest = fs.readFileSync(sourcePath.absolutePath, 'utf8');
                    if (getStoryboardSourceRevision(latest) !== parseStoryboardSourceRevision(body.expectedRevision)) {
                        throw new StoryboardSourceEditError('STALE_SOURCE_REVISION', 'Storyboard source changed before the edit could be written.', 409);
                    }
                    persistEdit(scope, sourcePath.path, sourcePath.absolutePath, before, edited.source);
                    eventSender({ type: 'custom', event: 'storyboard:source-updated', data: { path: sourcePath.path, revision: edited.revision } });
                    return sendJson(res, 200, {
                        ...scope,
                        path: sourcePath.path,
                        revision: edited.revision,
                        content: edited.source,
                        history: historyStatus(scope, sourcePath.path),
                    });
                });
            }
            if (context.method === 'POST' && context.path.split('?', 1)[0] === '/source/layout') {
                if (typeof body.notebookId !== 'string' || !Number.isInteger(body.generation)
                    || typeof body.path !== 'string' || typeof body.expectedRevision !== 'string'
                    || typeof body.field !== 'string' || !('value' in body) || body.type !== 'setLayout') {
                    return sendJson(res, 400, { error: { code: 'INVALID_STORYBOARD_SOURCE_COMMAND', message: 'notebookId, generation, path, expectedRevision, and a setLayout command are required.' } });
                }
                if (typeof body.target !== 'object' || body.target === null) {
                    return sendJson(res, 400, { error: { code: 'INVALID_STORYBOARD_SOURCE_COMMAND', message: 'target source identity is required.' } });
                }
                const scope = resolveSourceScope(runtime, fallbackRoot, body);
                const target = parseAuthoredNodeIdentity(body.target);
                const sourcePath = sourceFile(scope, body.path, resolvePath);
                if (target.sourcePath !== sourcePath.path)
                    throw new StoryboardSourceEditError('SOURCE_NODE_MISSING', 'Target source identity does not match the requested file.', 409);
                return await withSourceLock(sourcePath.absolutePath, () => {
                    const before = fs.readFileSync(sourcePath.absolutePath, 'utf8');
                    const edited = editStoryboardLayout(sourcePath.path, before, {
                        type: 'setLayout', target, expectedRevision: body.expectedRevision,
                        field: body.field, value: body.value,
                    }, registrations);
                    const latest = fs.readFileSync(sourcePath.absolutePath, 'utf8');
                    if (getStoryboardSourceRevision(latest) !== parseStoryboardSourceRevision(body.expectedRevision))
                        throw new StoryboardSourceEditError('STALE_SOURCE_REVISION', 'Storyboard source changed before the edit could be written.', 409);
                    persistEdit(scope, sourcePath.path, sourcePath.absolutePath, before, edited.source);
                    eventSender({ type: 'custom', event: 'storyboard:source-updated', data: { path: sourcePath.path, revision: edited.revision } });
                    return sendJson(res, 200, { ...scope, path: sourcePath.path, revision: edited.revision, content: edited.source, history: historyStatus(scope, sourcePath.path) });
                });
            }
            if (context.method === 'POST' && context.path.split('?', 1)[0] === '/source/binding') {
                if (typeof body.notebookId !== 'string' || !Number.isInteger(body.generation)
                    || typeof body.path !== 'string' || typeof body.expectedRevision !== 'string'
                    || typeof body.controlId !== 'string' || typeof body.actionId !== 'string'
                    || !('conditionId' in body) || (body.conditionId !== null && typeof body.conditionId !== 'string')
                    || body.type !== 'setBinding') {
                    return sendJson(res, 400, { error: { code: 'INVALID_STORYBOARD_SOURCE_COMMAND', message: 'notebookId, generation, path, expectedRevision, controlId, actionId, conditionId, and a setBinding command are required.' } });
                }
                const scope = resolveSourceScope(runtime, fallbackRoot, body);
                const sourcePath = sourceFile(scope, body.path, resolvePath, '.ts');
                return await withSourceLock(sourcePath.absolutePath, () => {
                    const before = fs.readFileSync(sourcePath.absolutePath, 'utf8');
                    const edited = editStoryboardBinding(sourcePath.path, before, {
                        type: 'setBinding',
                        controlId: body.controlId,
                        actionId: body.actionId,
                        conditionId: body.conditionId,
                        expectedRevision: body.expectedRevision,
                    }, behaviorDeclarationName);
                    const latest = fs.readFileSync(sourcePath.absolutePath, 'utf8');
                    if (getStoryboardSourceRevision(latest) !== parseStoryboardSourceRevision(body.expectedRevision)) {
                        throw new StoryboardSourceEditError('STALE_SOURCE_REVISION', 'Storyboard declarations changed before the binding could be written.', 409);
                    }
                    persistEdit(scope, sourcePath.path, sourcePath.absolutePath, before, edited.source);
                    eventSender({ type: 'custom', event: 'storyboard:source-updated', data: { path: sourcePath.path, revision: edited.revision } });
                    return sendJson(res, 200, {
                        ...scope,
                        path: sourcePath.path,
                        revision: edited.revision,
                        content: edited.source,
                        history: historyStatus(scope, sourcePath.path),
                    });
                });
            }
            if (context.method === 'POST' && context.path.split('?', 1)[0] === '/source/delete') {
                if (typeof body.notebookId !== 'string' || !Number.isInteger(body.generation)
                    || typeof body.path !== 'string' || typeof body.expectedRevision !== 'string'
                    || body.type !== 'deleteNode') {
                    return sendJson(res, 400, { error: { code: 'INVALID_STORYBOARD_SOURCE_COMMAND', message: 'notebookId, generation, path, expectedRevision, and a deleteNode command are required.' } });
                }
                if (typeof body.target !== 'object' || body.target === null) {
                    return sendJson(res, 400, { error: { code: 'INVALID_STORYBOARD_SOURCE_COMMAND', message: 'target source identity is required.' } });
                }
                const scope = resolveSourceScope(runtime, fallbackRoot, body);
                const target = parseAuthoredNodeIdentity(body.target);
                const sourcePath = sourceFile(scope, body.path, resolvePath);
                if (target.sourcePath !== sourcePath.path) {
                    throw new StoryboardSourceEditError('SOURCE_NODE_MISSING', 'Target source identity does not match the requested file.', 409);
                }
                return await withSourceLock(sourcePath.absolutePath, () => {
                    const before = fs.readFileSync(sourcePath.absolutePath, 'utf8');
                    const edited = deleteStoryboardNode(sourcePath.path, before, {
                        type: 'deleteNode',
                        target,
                        expectedRevision: body.expectedRevision,
                    }, registrations);
                    const latest = fs.readFileSync(sourcePath.absolutePath, 'utf8');
                    if (getStoryboardSourceRevision(latest) !== parseStoryboardSourceRevision(body.expectedRevision)) {
                        throw new StoryboardSourceEditError('STALE_SOURCE_REVISION', 'Storyboard source changed before the edit could be written.', 409);
                    }
                    persistEdit(scope, sourcePath.path, sourcePath.absolutePath, before, edited.source);
                    eventSender({ type: 'custom', event: 'storyboard:source-updated', data: { path: sourcePath.path, revision: edited.revision } });
                    return sendJson(res, 200, {
                        ...scope,
                        path: sourcePath.path,
                        revision: edited.revision,
                        content: edited.source,
                        history: historyStatus(scope, sourcePath.path),
                    });
                });
            }
            if (context.method === 'POST' && context.path.split('?', 1)[0] === '/source/insert') {
                if (typeof body.notebookId !== 'string' || !Number.isInteger(body.generation)
                    || typeof body.path !== 'string' || typeof body.expectedRevision !== 'string'
                    || body.type !== 'insertNode' || typeof body.slot !== 'string'
                    || !Number.isSafeInteger(body.index) || typeof body.component !== 'string') {
                    return sendJson(res, 400, { error: { code: 'INVALID_STORYBOARD_SOURCE_COMMAND', message: 'notebookId, generation, path, expectedRevision, slot, index, component, and an insertNode command are required.' } });
                }
                if (typeof body.target !== 'object' || body.target === null
                    || typeof body.props !== 'object' || body.props === null || Array.isArray(body.props)) {
                    return sendJson(res, 400, { error: { code: 'INVALID_STORYBOARD_SOURCE_COMMAND', message: 'target source identity and object props are required.' } });
                }
                const scope = resolveSourceScope(runtime, fallbackRoot, body);
                const target = parseAuthoredNodeIdentity(body.target);
                const sourcePath = sourceFile(scope, body.path, resolvePath);
                if (target.sourcePath !== sourcePath.path) {
                    throw new StoryboardSourceEditError('SOURCE_NODE_MISSING', 'Target source identity does not match the requested file.', 409);
                }
                return await withSourceLock(sourcePath.absolutePath, () => {
                    const before = fs.readFileSync(sourcePath.absolutePath, 'utf8');
                    const edited = insertStoryboardNode(sourcePath.path, before, {
                        type: 'insertNode',
                        target,
                        expectedRevision: body.expectedRevision,
                        slot: body.slot,
                        index: body.index,
                        component: body.component,
                        props: body.props,
                    }, registrations);
                    const latest = fs.readFileSync(sourcePath.absolutePath, 'utf8');
                    if (getStoryboardSourceRevision(latest) !== parseStoryboardSourceRevision(body.expectedRevision)) {
                        throw new StoryboardSourceEditError('STALE_SOURCE_REVISION', 'Storyboard source changed before the edit could be written.', 409);
                    }
                    persistEdit(scope, sourcePath.path, sourcePath.absolutePath, before, edited.source);
                    eventSender({ type: 'custom', event: 'storyboard:source-updated', data: { path: sourcePath.path, revision: edited.revision } });
                    return sendJson(res, 200, {
                        ...scope,
                        path: sourcePath.path,
                        revision: edited.revision,
                        content: edited.source,
                        history: historyStatus(scope, sourcePath.path),
                        nodeId: edited.nodeId,
                    });
                });
            }
            if (context.method === 'POST' && context.path.split('?', 1)[0] === '/source/duplicate') {
                if (typeof body.notebookId !== 'string' || !Number.isInteger(body.generation)
                    || typeof body.path !== 'string' || typeof body.expectedRevision !== 'string'
                    || body.type !== 'duplicateNode' || typeof body.slot !== 'string' || !Number.isSafeInteger(body.index)) {
                    return sendJson(res, 400, { error: { code: 'INVALID_STORYBOARD_SOURCE_COMMAND', message: 'notebookId, generation, path, expectedRevision, slot, index, and a duplicateNode command are required.' } });
                }
                if (typeof body.target !== 'object' || body.target === null) {
                    return sendJson(res, 400, { error: { code: 'INVALID_STORYBOARD_SOURCE_COMMAND', message: 'target source identity is required.' } });
                }
                const scope = resolveSourceScope(runtime, fallbackRoot, body);
                const target = parseAuthoredNodeIdentity(body.target);
                const sourcePath = sourceFile(scope, body.path, resolvePath);
                if (target.sourcePath !== sourcePath.path)
                    throw new StoryboardSourceEditError('SOURCE_NODE_MISSING', 'Target source identity does not match the requested file.', 409);
                return await withSourceLock(sourcePath.absolutePath, () => {
                    const before = fs.readFileSync(sourcePath.absolutePath, 'utf8');
                    const edited = duplicateStoryboardNode(sourcePath.path, before, {
                        type: 'duplicateNode', target, expectedRevision: body.expectedRevision,
                        slot: body.slot, index: body.index,
                    }, registrations);
                    const latest = fs.readFileSync(sourcePath.absolutePath, 'utf8');
                    if (getStoryboardSourceRevision(latest) !== parseStoryboardSourceRevision(body.expectedRevision)) {
                        throw new StoryboardSourceEditError('STALE_SOURCE_REVISION', 'Storyboard source changed before the edit could be written.', 409);
                    }
                    persistEdit(scope, sourcePath.path, sourcePath.absolutePath, before, edited.source);
                    eventSender({ type: 'custom', event: 'storyboard:source-updated', data: { path: sourcePath.path, revision: edited.revision } });
                    return sendJson(res, 200, { ...scope, path: sourcePath.path, revision: edited.revision, content: edited.source, nodeId: edited.nodeId, history: historyStatus(scope, sourcePath.path) });
                });
            }
            if (context.method === 'POST' && context.path.split('?', 1)[0] === '/source/reorder') {
                if (typeof body.notebookId !== 'string' || !Number.isInteger(body.generation)
                    || typeof body.path !== 'string' || typeof body.expectedRevision !== 'string'
                    || body.type !== 'reorderNode' || !Number.isSafeInteger(body.index)) {
                    return sendJson(res, 400, { error: { code: 'INVALID_STORYBOARD_SOURCE_COMMAND', message: 'notebookId, generation, path, expectedRevision, index, and a reorderNode command are required.' } });
                }
                if (typeof body.target !== 'object' || body.target === null)
                    return sendJson(res, 400, { error: { code: 'INVALID_STORYBOARD_SOURCE_COMMAND', message: 'target source identity is required.' } });
                const scope = resolveSourceScope(runtime, fallbackRoot, body);
                const target = parseAuthoredNodeIdentity(body.target);
                const sourcePath = sourceFile(scope, body.path, resolvePath);
                if (target.sourcePath !== sourcePath.path)
                    throw new StoryboardSourceEditError('SOURCE_NODE_MISSING', 'Target source identity does not match the requested file.', 409);
                return await withSourceLock(sourcePath.absolutePath, () => {
                    const before = fs.readFileSync(sourcePath.absolutePath, 'utf8');
                    const edited = reorderStoryboardNode(sourcePath.path, before, {
                        type: 'reorderNode', target, expectedRevision: body.expectedRevision, index: body.index,
                    }, registrations);
                    const latest = fs.readFileSync(sourcePath.absolutePath, 'utf8');
                    if (getStoryboardSourceRevision(latest) !== parseStoryboardSourceRevision(body.expectedRevision))
                        throw new StoryboardSourceEditError('STALE_SOURCE_REVISION', 'Storyboard source changed before the edit could be written.', 409);
                    persistEdit(scope, sourcePath.path, sourcePath.absolutePath, before, edited.source);
                    eventSender({ type: 'custom', event: 'storyboard:source-updated', data: { path: sourcePath.path, revision: edited.revision } });
                    return sendJson(res, 200, { ...scope, path: sourcePath.path, revision: edited.revision, content: edited.source, history: historyStatus(scope, sourcePath.path) });
                });
            }
            if (context.method === 'POST' && context.path.split('?', 1)[0] === '/source/reparent') {
                if (typeof body.notebookId !== 'string' || !Number.isInteger(body.generation)
                    || typeof body.path !== 'string' || typeof body.expectedRevision !== 'string'
                    || body.type !== 'reparentNode' || typeof body.slot !== 'string' || !Number.isSafeInteger(body.index)) {
                    return sendJson(res, 400, { error: { code: 'INVALID_STORYBOARD_SOURCE_COMMAND', message: 'notebookId, generation, path, expectedRevision, slot, index, and a reparentNode command are required.' } });
                }
                if (typeof body.target !== 'object' || body.target === null || typeof body.parent !== 'object' || body.parent === null) {
                    return sendJson(res, 400, { error: { code: 'INVALID_STORYBOARD_SOURCE_COMMAND', message: 'target and parent source identities are required.' } });
                }
                const scope = resolveSourceScope(runtime, fallbackRoot, body);
                const target = parseAuthoredNodeIdentity(body.target);
                const parent = parseAuthoredNodeIdentity(body.parent);
                const sourcePath = sourceFile(scope, body.path, resolvePath);
                if (target.sourcePath !== sourcePath.path || parent.sourcePath !== sourcePath.path)
                    throw new StoryboardSourceEditError('SOURCE_NODE_MISSING', 'Target and parent source identities must match the requested file.', 409);
                return await withSourceLock(sourcePath.absolutePath, () => {
                    const before = fs.readFileSync(sourcePath.absolutePath, 'utf8');
                    const edited = reparentStoryboardNode(sourcePath.path, before, {
                        type: 'reparentNode', target, parent, expectedRevision: body.expectedRevision,
                        slot: body.slot, index: body.index,
                    }, registrations);
                    const latest = fs.readFileSync(sourcePath.absolutePath, 'utf8');
                    if (getStoryboardSourceRevision(latest) !== parseStoryboardSourceRevision(body.expectedRevision))
                        throw new StoryboardSourceEditError('STALE_SOURCE_REVISION', 'Storyboard source changed before the edit could be written.', 409);
                    persistEdit(scope, sourcePath.path, sourcePath.absolutePath, before, edited.source);
                    eventSender({ type: 'custom', event: 'storyboard:source-updated', data: { path: sourcePath.path, revision: edited.revision } });
                    return sendJson(res, 200, { ...scope, path: sourcePath.path, revision: edited.revision, content: edited.source, history: historyStatus(scope, sourcePath.path) });
                });
            }
            return sendJson(res, 404, { error: { code: 'ROUTE_NOT_FOUND', message: `Unknown Storyboard source route: ${context.method} ${context.path}` } });
        }
        catch (error) {
            const status = error instanceof StoryboardSourceEditError ? error.status : 400;
            return sendJson(res, status, {
                error: {
                    code: error instanceof StoryboardSourceEditError ? error.code : 'INVALID_STORYBOARD_SOURCE_REQUEST',
                    message: error instanceof Error ? error.message : 'Storyboard source request failed.',
                },
            });
        }
    };
}
export const __test = { atomicWrite, sourceNodes, withSourceLock };
//# sourceMappingURL=source-editor.js.map