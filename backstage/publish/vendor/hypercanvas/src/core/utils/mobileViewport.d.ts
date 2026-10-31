/**
 * Mobile viewport detection — reactive store for compact viewport state.
 *
 * Uses window.matchMedia for efficient, debounce-free detection.
 * Threshold: 500px (matches the mobile breakpoint for toolbar compacting).
 */
/** Returns true when the viewport is narrower than 500px. */
export declare function isMobile(): boolean;
/** Subscribe to mobile state changes. */
export declare function subscribeToMobile(callback: (mobile: boolean) => void): () => void;
/** Check if the device has a coarse pointer (touch device). */
export declare function isTouchDevice(): boolean;
