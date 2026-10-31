/** Compatibility facade over Statefully's public target-window knob APIs. */
import * as statefullyCore from '@dfosco/statefully/core';
function requireFunction(name) {
    const value = statefullyCore[name];
    if (typeof value !== 'function') {
        throw new TypeError(`The installed Statefully runtime must expose ${name}().`);
    }
    return value;
}
export function setKnobValue(id, value, options) {
    requireFunction('setKnobValue')(id, value, options);
}
export function clearKnobValue(id, options) {
    requireFunction('clearKnobValue')(id, options);
}
export function serializeKnobValue(value, definition) {
    return requireFunction('serializeKnobValue')(value, definition);
}
