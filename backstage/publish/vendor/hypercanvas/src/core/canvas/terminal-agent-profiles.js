import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { resolveRuntimeDir } from '../runtimeDir.js';
import { fileURLToPath } from 'node:url';
import { formatCoreCliExecutable, quoteShellWord, resolveCoreCliRuntime } from '../host-tools/runtime.js';
const marker = '<!-- Hypercanvas managed terminal profile -->';
/** Replace a shared executable without a missing or partially written window. */
export function writeTerminalShim(file, content) {
    try {
        if (readFileSync(file, 'utf8') === content)
            return;
    }
    catch { /* missing */ }
    const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
    try {
        writeFileSync(temporary, content, { mode: 0o755, flag: 'wx' });
        renameSync(temporary, file);
    }
    finally {
        rmSync(temporary, { force: true });
    }
}
/** Native tool names differ; omission gives each provider its default tools. */
export function renderNativeTerminalProfile(source, name = 'terminal-agent') {
    const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
    return `---\nname: ${name}\ndescription: Canvas-aware terminal agent with live Notebook context\n---\n\n${marker}\n${body}`;
}
export function ensureTerminalAgentGuidance(root) {
    const destination = join(root, '.agents', 'terminal-agent.agent.md');
    if (!existsSync(destination)) {
        const bundled = resolve(dirname(fileURLToPath(import.meta.url)), '../../../scaffold/terminal-agent.agent.md');
        mkdirSync(join(root, '.agents'), { recursive: true });
        writeFileSync(destination, readFileSync(bundled, 'utf8'), { flag: 'wx' });
    }
    return destination;
}
export function ensureTerminalAgentProfiles(root) {
    ensureTerminalAgentGuidance(root);
    const sources = join(root, '.agents');
    if (!existsSync(sources))
        return;
    for (const filename of readdirSync(sources).filter(file => file.endsWith('.agent.md'))) {
        const name = filename.slice(0, -'.agent.md'.length);
        const sourcePath = join(sources, filename);
        const source = readFileSync(sourcePath, 'utf8');
        for (const provider of ['.github', '.claude']) {
            const directory = join(root, provider, 'agents');
            mkdirSync(directory, { recursive: true });
            const file = join(directory, `${name}.md`);
            if (existsSync(file)) {
                const managedLink = lstatSync(file).isSymbolicLink() && resolve(directory, readlinkSync(file)) === sourcePath;
                const existing = readFileSync(file, 'utf8');
                if (!managedLink && !existing.includes(marker) && existing !== source)
                    continue;
                if (managedLink)
                    unlinkSync(file);
            }
            writeFileSync(file, renderNativeTerminalProfile(source, name));
        }
    }
}
/** Keep headless agents on the same bundled CLI as visible terminal agents. */
export function ensureTerminalAgentCli(root) {
    const directory = join(resolveRuntimeDir(root), 'terminals', 'bin');
    mkdirSync(directory, { recursive: true });
    const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../cli/index.js');
    const runtime = resolveCoreCliRuntime();
    for (const name of ['hypercanvas', 'storyboard']) {
        writeTerminalShim(join(directory, name), `#!/usr/bin/env sh\nexec ${formatCoreCliExecutable(runtime)} ${quoteShellWord(cli)} "$@"\n`);
    }
    return directory;
}
