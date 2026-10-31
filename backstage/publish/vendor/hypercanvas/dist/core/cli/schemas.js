export const prototypeSchema = {
    name: {
        type: 'string',
        description: 'Prototype slug (kebab-case). Derived from --title when omitted.',
        aliases: ['n'],
    },
    title: {
        type: 'string',
        description: 'Display title. Required if --name is omitted.',
        aliases: ['t'],
    },
    folder: {
        type: 'string',
        description: 'Parent folder compatibility field',
        aliases: ['f'],
    },
    parentPath: {
        type: 'string',
        description: 'Notebook-relative ordinary creation parent (canonical)',
        aliases: ['parent'],
    },
    partial: {
        type: 'string',
        description: 'Template/recipe name',
        aliases: ['p'],
    },
    author: {
        type: 'string',
        description: 'Author name(s)',
        aliases: ['a'],
    },
    description: {
        type: 'string',
        description: 'Prototype description',
        aliases: ['d'],
    },
    url: {
        type: 'string',
        description: 'External URL (makes it an external prototype)',
    },
    flow: {
        type: 'boolean',
        default: false,
        description: 'Create a default flow file',
    },
};
export const canvasSchema = {
    name: {
        type: 'string',
        required: true,
        description: 'Canvas name (kebab-case)',
        aliases: ['n'],
    },
    title: {
        type: 'string',
        description: 'Display title',
        aliases: ['t'],
    },
    folder: {
        type: 'string',
        description: 'Parent folder compatibility field',
        aliases: ['f'],
    },
    parentPath: {
        type: 'string',
        description: 'Notebook-relative ordinary creation parent (canonical)',
        aliases: ['parent'],
    },
    'folder-kind': {
        type: 'string',
        description: 'When creating a new folder: "workspace" → <folder>.folder/ (workspace grouping), "pages" → <folder>/ (multi-page canvas). Ignored when the folder already exists.',
        default: 'pages',
    },
    grid: {
        type: 'boolean',
        default: true,
        description: 'Show dot grid',
    },
    jsx: {
        type: 'boolean',
        default: false,
        description: 'Include JSX companion file',
    },
    description: {
        type: 'string',
        description: 'Optional description',
        aliases: ['d'],
    },
};
export const flowSchema = {
    name: {
        type: 'string',
        required: true,
        description: 'Flow name (kebab-case)',
        aliases: ['n'],
    },
    prototype: {
        type: 'string',
        required: true,
        description: 'Target prototype name',
        aliases: ['p'],
    },
    title: {
        type: 'string',
        description: 'Display title',
        aliases: ['t'],
    },
    folder: {
        type: 'string',
        description: 'Parent .folder directory',
        aliases: ['f'],
    },
    globals: {
        type: 'array',
        description: '$global object names',
        aliases: ['g'],
    },
    'copy-from': {
        type: 'string',
        description: 'Existing flow to copy from',
    },
    author: {
        type: 'string',
        description: 'Author name(s)',
        aliases: ['a'],
    },
    description: {
        type: 'string',
        description: 'Flow description',
        aliases: ['d'],
    },
    'starting-page': {
        type: 'string',
        description: 'Starting page path',
    },
};
export const pageSchema = {
    prototype: {
        type: 'string',
        required: true,
        description: 'Target prototype name',
        aliases: ['p'],
    },
    path: {
        type: 'string',
        required: true,
        description: 'Page path (e.g. settings/general)',
    },
    folder: {
        type: 'string',
        description: 'Parent .folder directory',
        aliases: ['f'],
    },
    template: {
        type: 'string',
        description: 'Page template name',
        aliases: ['t'],
    },
};
export const widgetSchema = {
    canvas: {
        type: 'string',
        required: true,
        description: 'Target canvas name',
        aliases: ['c'],
    },
    x: {
        type: 'number',
        description: 'X position (omit for auto-positioning)',
    },
    y: {
        type: 'number',
        description: 'Y position (omit for auto-positioning)',
    },
    near: {
        type: 'string',
        description: 'Place near this widget ID (default: auto-selects last widget). Use --near false to disable',
    },
    direction: {
        type: 'string',
        default: 'right',
        description: 'Direction from reference widget: right, left, above, below, above-right, below-right, above-left, below-left',
        aliases: ['dir'],
    },
    gap: {
        type: 'number',
        description: 'Spacing between widgets in grid spaces (default: 1)',
    },
    resolve: {
        type: 'boolean',
        default: false,
        description: 'Run server-side collision detection on the target position',
    },
    props: {
        type: 'string',
        description: 'Widget props as JSON string',
    },
    'props-file': {
        type: 'string',
        description: 'Path to a JSON file containing widget props (avoids shell escaping)',
        aliases: ['pf'],
    },
    name: {
        type: 'string',
        description: 'Alias for agent/terminal widgets (human-readable nickname)',
        aliases: ['n'],
    },
    json: {
        type: 'boolean',
        default: false,
        description: 'Output result as JSON (includes widget id)',
    },
};
export const componentSchema = {
    name: {
        type: 'string',
        required: true,
        description: 'Component name (kebab-case)',
        aliases: ['n'],
    },
    directory: {
        type: 'string',
        description: 'Subdirectory inside src/components/',
        aliases: ['d'],
    },
    folder: {
        type: 'string',
        description: 'Parent folder compatibility field for Notebook artifacts',
        aliases: ['f'],
    },
    parentPath: {
        type: 'string',
        description: 'Notebook-relative ordinary creation parent (canonical)',
        aliases: ['parent'],
    },
};
