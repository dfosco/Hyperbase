/**
 * Fiber Walker — React fiber tree inspector for DOM elements.
 *
 * Framework-agnostic (zero npm dependencies). Intended for dev-time inspection
 * only; React's fiber keys and `_debugSource` are development internals.
 */
function isRecord(value) {
    return value !== null && typeof value === 'object';
}
function asComponentObject(value) {
    return isRecord(value) ? value : null;
}
/** Find the React fiber key on a DOM element. */
function findFiberKey(el) {
    return Object.keys(el).find((key) => (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')));
}
function isFiberNode(value) {
    return isRecord(value);
}
function isUserComponent(fiber) {
    if (!fiber || !fiber.type)
        return false;
    const type = fiber.type;
    if (typeof type === 'function')
        return true;
    const wrapped = asComponentObject(type);
    if (!wrapped)
        return false;
    if (typeof wrapped.render === 'function')
        return true;
    if (wrapped.$$typeof && typeof wrapped.type === 'function')
        return true;
    if (wrapped.$$typeof && asComponentObject(wrapped.type))
        return true;
    return false;
}
function getComponentName(fiber) {
    if (!fiber || !fiber.type)
        return 'Unknown';
    const type = fiber.type;
    if (typeof type === 'function') {
        const component = type;
        return component.displayName || component.name || 'Anonymous';
    }
    const wrapped = asComponentObject(type);
    if (!wrapped)
        return 'Unknown';
    if (wrapped.displayName)
        return wrapped.displayName;
    if (typeof wrapped.render === 'function') {
        const name = wrapped.render.displayName || wrapped.render.name;
        return isUsableName(name) ? name : 'ForwardRef';
    }
    if (wrapped.type) {
        if (typeof wrapped.type === 'function') {
            const inner = wrapped.type;
            const name = inner.displayName || inner.name;
            return isUsableName(name) ? name : 'Memo';
        }
        const inner = asComponentObject(wrapped.type);
        if (inner?.render) {
            if (inner.displayName)
                return inner.displayName;
            const name = inner.render.displayName || inner.render.name;
            return isUsableName(name) ? name : 'ForwardRef';
        }
    }
    return 'Unknown';
}
function isUsableName(name) {
    return Boolean(name && name.length > 2);
}
function getDebugSource(fiber) {
    if (!fiber || !isRecord(fiber._debugSource))
        return null;
    const source = fiber._debugSource;
    return {
        fileName: typeof source.fileName === 'string' ? source.fileName : null,
        lineNumber: typeof source.lineNumber === 'number' ? source.lineNumber : null,
        columnNumber: typeof source.columnNumber === 'number' ? source.columnNumber : null,
    };
}
/** Return the React fiber node attached to a DOM element, if present. */
export function getFiberFromElement(el) {
    if (!el || typeof el !== 'object')
        return null;
    const key = findFiberKey(el);
    if (!key)
        return null;
    const fiber = Reflect.get(el, key);
    return isFiberNode(fiber) ? fiber : null;
}
/** Find component information for the nearest user component in a fiber chain. */
export function getComponentInfo(fiber) {
    if (!fiber)
        return null;
    const hostSource = getDebugSource(fiber);
    let current = fiber;
    while (current && !isUserComponent(current))
        current = current.return;
    if (!current)
        return null;
    let name = getComponentName(current);
    if (name === 'ForwardRef' || name === 'Memo') {
        let ancestor = current.return;
        while (ancestor) {
            if (isUserComponent(ancestor)) {
                const ancestorName = getComponentName(ancestor);
                if (ancestorName !== 'ForwardRef' && ancestorName !== 'Memo' && ancestorName !== 'Unknown') {
                    name = ancestorName;
                    break;
                }
            }
            ancestor = ancestor.return;
        }
    }
    const ownerFiber = current._debugOwner ?? null;
    return {
        name,
        props: isRecord(current.memoizedProps) ? current.memoizedProps : {},
        source: getDebugSource(current),
        hostSource,
        owner: ownerFiber ? getComponentName(ownerFiber) : null,
    };
}
/** Return all user components in the ancestry chain, from the given fiber up. */
export function getComponentChain(fiber) {
    const chain = [];
    let current = fiber;
    while (current) {
        if (isUserComponent(current)) {
            chain.push({ name: getComponentName(current), source: getDebugSource(current) });
        }
        current = current.return;
    }
    return chain;
}
/** Convenience: inspect a DOM element and return its nearest component info. */
export function inspectElement(el) {
    const fiber = getFiberFromElement(el);
    return fiber ? getComponentInfo(fiber) : null;
}
/** Return all React components in a DOM element's ancestry chain. */
export function inspectElementChain(el) {
    const fiber = getFiberFromElement(el);
    return fiber ? getComponentChain(fiber) : [];
}
