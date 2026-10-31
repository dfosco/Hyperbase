/**
 * Evaluate and execute declarations against a caller-owned snapshot. The
 * executor owns no state; a successful command commits through the supplied
 * callback, which should write to the authoritative Statefully session.
 */
export function createStoryboardBehaviorExecutor(behavior, commit) {
    function isEnabled(controlId, state) {
        const control = behavior.controls[controlId];
        if (!control)
            return false;
        return control.condition === undefined || behavior.conditions[control.condition].test(state);
    }
    async function execute(controlId, state, input) {
        const control = behavior.controls[controlId];
        if (!control || !isEnabled(controlId, state))
            return false;
        const action = behavior.actions[control.action];
        const next = await action.run(state, input);
        commit(next);
        return true;
    }
    return Object.freeze({ isEnabled, execute });
}
//# sourceMappingURL=behavior-runtime.js.map