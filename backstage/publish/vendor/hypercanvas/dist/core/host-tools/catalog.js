const VERSION_PATTERN = /(?:^|\s)v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)(?=\s|\.(?:\s|$)|$)/m;
export function parseToolVersion(output) {
    return String(output || '').match(VERSION_PATTERN)?.[1] || null;
}
function agent(definition) {
    return Object.freeze({
        ...definition,
        knownPaths: Object.freeze(definition.knownPaths),
        versionArgs: Object.freeze(definition.versionArgs),
    });
}
export const AGENT_CATALOG = Object.freeze([
    agent({
        id: 'codex',
        displayName: 'Codex',
        executable: 'codex',
        knownPaths: ['~/.local/bin/codex', '~/.codex/packages/standalone/current/bin/codex', '/opt/homebrew/bin/codex', '/usr/local/bin/codex'],
        versionArgs: ['--version'],
        parseVersion: parseToolVersion,
    }),
    agent({
        id: 'claude',
        displayName: 'Claude',
        executable: 'claude',
        knownPaths: ['~/.local/bin/claude', '~/.claude/local/claude', '/opt/homebrew/bin/claude', '/usr/local/bin/claude'],
        versionArgs: ['--version'],
        parseVersion: parseToolVersion,
    }),
    agent({
        id: 'copilot',
        displayName: 'Copilot',
        executable: 'copilot',
        knownPaths: ['~/.local/bin/copilot', '/opt/homebrew/bin/copilot', '/usr/local/bin/copilot'],
        versionArgs: ['--version'],
        parseVersion: parseToolVersion,
    }),
    agent({
        id: 'opencode',
        displayName: 'OpenCode',
        executable: 'opencode',
        knownPaths: ['~/.opencode/bin/opencode', '~/.local/bin/opencode', '/opt/homebrew/bin/opencode', '/usr/local/bin/opencode'],
        versionArgs: ['--version'],
        parseVersion: parseToolVersion,
    }),
    agent({
        id: 'gh',
        kind: 'tool',
        displayName: 'GitHub CLI',
        executable: 'gh',
        knownPaths: ['~/.local/bin/gh', '/opt/homebrew/bin/gh', '/usr/local/bin/gh'],
        versionArgs: ['--version'],
        parseVersion: parseToolVersion,
    }),
]);
export const AGENT_IDS = Object.freeze(AGENT_CATALOG.map(({ id }) => id));
export function getAgentDefinition(id) {
    return AGENT_CATALOG.find((entry) => entry.id === id) || null;
}
