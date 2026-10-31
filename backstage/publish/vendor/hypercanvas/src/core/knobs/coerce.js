/** Compatibility facade over Statefully's public typed knob codec. */
import * as statefullyCore from '@dfosco/statefully/core';
export function coerceByType(rawValue, definition = {}) {
    if (typeof statefullyCore.coerce !== 'function') {
        throw new TypeError('The installed Statefully runtime must expose coerce().');
    }
    const type = definition.type === 'text' ? 'string' : definition.type;
    return statefullyCore.coerce(rawValue, type, undefined, definition);
}
