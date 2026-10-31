/** Compatibility facade over Statefully's public knob key builders. */
import * as statefullyCore from '@dfosco/statefully/core';
export function buildKnobKey(id, options) {
    if (typeof statefullyCore.buildKnobKey !== 'function') {
        throw new TypeError('The installed Statefully runtime must expose buildKnobKey().');
    }
    return statefullyCore.buildKnobKey(id, options);
}
export function buildLegacyKnobKey(id, options) {
    if (typeof statefullyCore.buildLegacyKnobKey !== 'function') {
        throw new TypeError('The installed Statefully runtime must expose buildLegacyKnobKey().');
    }
    return statefullyCore.buildLegacyKnobKey(id, options);
}
