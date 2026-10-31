/** Filter a flattened schema, retaining object groups around matching controls. */
export function filterKnobsByName(knobs, search) {
    const needle = search.trim().toLowerCase();
    if (!needle)
        return knobs;
    const matches = knobs.filter(def => {
        const name = def.label || String(def.id).split('.').pop() || '';
        const humanized = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ');
        return `${name} ${humanized} ${def.id}`.toLowerCase().includes(needle);
    });
    return knobs.filter(def => matches.some(match => {
        if ((def.scope || '') !== (match.scope || ''))
            return false;
        return def.id === match.id
            || (def.type === 'object' && match.id.startsWith(`${def.id}.`))
            || (match.type === 'object' && def.id.startsWith(`${match.id}.`));
    }));
}
