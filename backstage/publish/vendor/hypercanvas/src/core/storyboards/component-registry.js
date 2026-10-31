import { createComponentRegistrationIndex } from "./structural-schema.js";
const commonProps = {
    className: { type: 'text' },
    id: { type: 'text' },
    title: { type: 'text' },
};
const commonLayout = {
    width: { type: 'text' },
    height: { type: 'text' },
    padding: { type: 'text' },
    margin: { type: 'text' },
    gap: { type: 'number', min: 0 },
    display: { type: 'enum', values: ['block', 'flex', 'grid', 'inline-flex'] },
    flexDirection: { type: 'enum', values: ['row', 'row-reverse', 'column', 'column-reverse'] },
    alignItems: { type: 'enum', values: ['stretch', 'start', 'center', 'end'] },
    justifyContent: { type: 'enum', values: ['start', 'center', 'end', 'space-between', 'space-around'] },
    gridTemplateColumns: { type: 'text' },
};
const childSlot = {
    children: { accepts: ['block', 'control'], minChildren: 0 },
};
/**
 * Initial local registry for semantic HTML structure and the Storyboard demo.
 * Event handlers and computed data stay source-owned; only literal props with
 * a declared editor schema are exposed to the source-edit command.
 */
export const storyboardComponentRegistry = createComponentRegistrationIndex([
    ...['main', 'header', 'nav', 'footer', 'section', 'article', 'aside'].map(name => ({
        name,
        kind: 'view',
        props: commonProps,
        layout: commonLayout,
        slots: childSlot,
    })),
    ...['div', 'span', 'p', 'h1', 'h2', 'h3', 'strong', 'em', 'small', 'label', 'ul', 'ol', 'li'].map(name => ({
        name,
        kind: 'block',
        props: commonProps,
        layout: commonLayout,
        slots: childSlot,
    })),
    {
        name: 'button',
        kind: 'block',
        props: {
            ...commonProps,
            type: { type: 'enum', values: ['button', 'submit', 'reset'] },
            disabled: { type: 'boolean' },
        },
        layout: commonLayout,
        slots: childSlot,
    },
    {
        name: 'input',
        kind: 'block',
        props: {
            ...commonProps,
            type: { type: 'enum', values: ['text', 'email', 'number', 'search', 'tel'] },
            placeholder: { type: 'text' },
            autoComplete: { type: 'text' },
            disabled: { type: 'boolean' },
        },
        layout: commonLayout,
        slots: {},
    },
    {
        name: 'a',
        kind: 'block',
        props: { ...commonProps, href: { type: 'text' } },
        layout: commonLayout,
        slots: childSlot,
    },
    ...['SearchView', 'TravelersView', 'PaymentView', 'ConfirmationView'].map(name => ({
        name,
        kind: 'view',
        props: { heading: { type: 'text' } },
        layout: commonLayout,
        slots: childSlot,
    })),
]);
//# sourceMappingURL=component-registry.js.map