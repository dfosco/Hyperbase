import { readAppConfigRaw } from '../../../core/configFile.js';
/**
 * Render an index.jsx for a prototype that uses a template or recipe.
 * Pulled out of workshop/features/createPrototype/server.js so artifact
 * operations can use it without depending on workshop endpoints.
 */
import fs from 'node:fs';
function isPartialConfig(value) {
    if (!value || typeof value !== 'object')
        return false;
    const partial = value;
    return typeof partial.directory === 'string' && typeof partial.name === 'string' &&
        (partial.globals === undefined || (Array.isArray(partial.globals) && partial.globals.every((globalName) => typeof globalName === 'string')));
}
/** Find the main component file (*.jsx|*.tsx) in a partial directory. */
export function findComponentFile(dir) {
    if (!fs.existsSync(dir))
        return null;
    const files = fs.readdirSync(dir);
    const component = files.find((f) => /\.(jsx|tsx)$/.test(f) && !f.startsWith('_') && !f.includes('.test.'));
    return component ? component.replace(/\.(jsx|tsx)$/, '') : null;
}
/** Generate index.jsx that imports a template or recipe component. */
export function renderPartialIndexJsx({ partialEntry, componentFile, componentName, title }) {
    const importPath = `@/${partialEntry.baseDir}/${partialEntry.name}/${componentFile}`;
    if (partialEntry.kind === 'template') {
        return `import ${componentFile} from '${importPath}'

export default function ${componentName}() {
  return (
    <${componentFile} title="${title}">
      <h1>${title}</h1>
      <p>Start building your prototype here.</p>
    </${componentFile}>
  )
}
`;
    }
    // recipe
    return `import ${componentFile} from '${importPath}'

export default function ${componentName}() {
  return (
    <${componentFile}>
      <h1>${title}</h1>
      <p>Start building your prototype here.</p>
    </${componentFile}>
  )
}
`;
}
/** Read the workshop.partials config from storyboard.config.json. */
export function readWorkshopPartials(root) {
    try {
        const raw = readAppConfigRaw(root) ?? '';
        const cfg = JSON.parse(raw);
        const partials = cfg?.workshop?.partials || [];
        return Array.isArray(partials) ? partials.filter(isPartialConfig) : [];
    }
    catch {
        return [];
    }
}
