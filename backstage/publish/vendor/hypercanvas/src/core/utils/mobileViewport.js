/**
 * Mobile viewport detection — reactive store for compact viewport state.
 *
 * Uses window.matchMedia for efficient, debounce-free detection.
 * Threshold: 500px (matches the mobile breakpoint for toolbar compacting).
 */
const MOBILE_QUERY = '(max-width: 499px)';
let _isMobile = false;
const _listeners = new Set();
let _mql = null;
function _handleChange(event) {
    _isMobile = event.matches;
    for (const callback of _listeners)
        callback(_isMobile);
}
// Initialize on load (SSR-safe)
if (typeof window !== 'undefined') {
    _mql = window.matchMedia(MOBILE_QUERY);
    _isMobile = _mql.matches;
    _mql.addEventListener('change', _handleChange);
}
/** Returns true when the viewport is narrower than 500px. */
export function isMobile() {
    return _isMobile;
}
/** Subscribe to mobile state changes. */
export function subscribeToMobile(callback) {
    _listeners.add(callback);
    return () => _listeners.delete(callback);
}
/** Check if the device has a coarse pointer (touch device). */
export function isTouchDevice() {
    if (typeof window === 'undefined')
        return false;
    return window.matchMedia('(pointer: coarse)').matches;
}
