/**
 * Small deterministic runner for registered Notebook publishing actions.
 * Workflow JSON selects trusted action IDs; it never contains shell strings.
 */
import workflowDefinition from './publish.workflow.json' with { type: 'json' };
export const notebookPublishWorkflow = Object.freeze(workflowDefinition);
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isWorkflowDefinition(value) {
    if (!isRecord(value) || typeof value.name !== 'string' || !Array.isArray(value.steps))
        return false;
    return value.steps.every((step) => isRecord(step)
        && typeof step.id === 'string'
        && typeof step.uses === 'string'
        && (step.with === undefined || isRecord(step.with)));
}
function validateDefinition(definition, actions) {
    if (!isWorkflowDefinition(definition)) {
        throw new TypeError('Workflow definition must have a name and ordered steps.');
    }
    const ids = new Set();
    for (const step of definition.steps) {
        if (!step || typeof step.id !== 'string' || typeof step.uses !== 'string' || ids.has(step.id)) {
            throw new TypeError('Workflow steps require unique IDs and registered action names.');
        }
        if (typeof actions[step.uses] !== 'function') {
            throw new Error(`Workflow action is not registered: ${step.uses}`);
        }
        ids.add(step.id);
    }
}
/** Execute each registered step sequentially with shared inputs and prior outputs. */
export async function runWorkflow({ definition = notebookPublishWorkflow, actions, input = {}, context = {}, runStep = (_id, execute) => execute(), } = {}) {
    const registeredActions = actions || {};
    validateDefinition(definition, registeredActions);
    const outputs = {};
    for (const step of definition.steps) {
        const action = registeredActions[step.uses];
        if (!action)
            throw new Error(`Workflow action is not registered: ${step.uses}`);
        const execute = () => action({ input, context, outputs, step });
        outputs[step.id] = await runStep(step.id, execute);
    }
    return { input, context, outputs };
}
