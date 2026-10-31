/// <reference types="node" />
/**
 * Server-side reader for terminal + agents config.
 *
 * Replaces direct `JSON.parse(readFileSync('storyboard.config.json')).canvas.agents`
 * reads in terminal-server / hot-pool / canvas server / terminal-welcome /
 * server-plugin so the new `terminal.config.json` (and the library's default
 * one shipped under `node_modules/@dfosco/storyboard/terminal.config.json`)
 * is honored everywhere with leaf-level merge.
 *
 * Resolution order (lowest → highest priority), all leaf-merged:
 *   1. Library default `<root>/{packages/storyboard,node_modules/@dfosco/storyboard}/terminal.config.json`
 *   2. `storyboard.config.json` `canvas.terminal` + `canvas.agents` (legacy)
 *   3. Root `terminal.config.json`
 *
 * Returns `{ terminal, agents, showAgentsInAddMenu }`. Empty objects when
 * nothing is configured (rather than null) so callers can spread freely.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseJsonc } from 'jsonc-parser';
import { readAppConfig, resolveConfigFilePath } from '../configFile.js';
/** Same shape as data-plugin's `deepMergeBuild`. */
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function deepMerge(target, source) {
    if (!source || typeof source !== 'object')
        return target;
    if (!target || typeof target !== 'object')
        return source;
    const targetRecord = target;
    const sourceRecord = source;
    const result = { ...targetRecord };
    for (const key of Object.keys(sourceRecord)) {
        const sv = sourceRecord[key];
        const tv = targetRecord[key];
        if (isRecord(sv) && isRecord(tv)) {
            result[key] = deepMerge(tv, sv);
        }
        else {
            result[key] = sv;
        }
    }
    return result;
}
function readJson(filePath) {
    try {
        const errors = [];
        const parsed = parseJsonc(readFileSync(filePath, 'utf8'), errors);
        return errors.length === 0 ? parsed : null;
    }
    catch {
        return null;
    }
}
function resolveLibTerminalConfig(root) {
    const candidates = [
        join(root, 'packages', 'storyboard', 'terminal.config.json'),
        join(root, 'packages', 'hypercanvas', 'terminal.config.json'),
        join(root, 'node_modules', '@dfosco', 'hypercanvas', 'terminal.config.json'),
    ];
    for (const p of candidates) {
        if (existsSync(p)) {
            const parsed = readJson(p);
            if (isRecord(parsed))
                return parsed;
        }
    }
    return null;
}
function storyboardTerminalLayer(config) {
    const canvas = isRecord(config) && isRecord(config.canvas) ? config.canvas : {};
    const hotPool = isRecord(config) ? config.hotPool : undefined;
    return {
        ...(canvas.terminal ? { terminal: canvas.terminal } : {}),
        ...(canvas.agents ? { agents: canvas.agents } : {}),
        ...(canvas.showAgentsInAddMenu !== undefined
            ? { showAgentsInAddMenu: canvas.showAgentsInAddMenu }
            : {}),
        ...(hotPool ? { hotPool } : {}),
    };
}
/**
 * Read the merged terminal + agents + hotPool config for a project root.
 *
 * @param {string} [root] - Project root, defaults to `process.cwd()`.
 * @param {string} [fallbackRoot] - Application root used beneath project overrides.
 * @returns {{ terminal: object, agents: object, showAgentsInAddMenu: boolean|undefined, hotPool: object }}
 */
export function readTerminalConfigMerged(root = process.cwd(), fallbackRoot = process.cwd()) {
    const lib = resolveLibTerminalConfig(fallbackRoot) || resolveLibTerminalConfig(root) || {};
    const fallbackSb = root === fallbackRoot ? {} : readAppConfig(fallbackRoot) || {};
    const fallbackTerminal = root === fallbackRoot ? {} : readJson(resolveConfigFilePath(fallbackRoot, 'terminal.config.json')) || {};
    const sb = readAppConfig(root) || {};
    const userTerminal = readJson(resolveConfigFilePath(root, 'terminal.config.json')) || {};
    const fallback = deepMerge(storyboardTerminalLayer(fallbackSb), fallbackTerminal);
    const notebook = deepMerge(storyboardTerminalLayer(sb), userTerminal);
    const merged = deepMerge(deepMerge(lib, fallback), notebook);
    return {
        terminal: isRecord(merged.terminal) ? merged.terminal : {},
        agents: isRecord(merged.agents) ? merged.agents : {},
        showAgentsInAddMenu: merged.showAgentsInAddMenu,
        hotPool: isRecord(merged.hotPool) ? merged.hotPool : {},
    };
}
/**
 * Convenience: just the agents map.
 */
export function readAgentsConfig(root = process.cwd(), fallbackRoot = process.cwd()) {
    return readTerminalConfigMerged(root, fallbackRoot).agents;
}
/**
 * Convenience: just the terminal-widget settings.
 */
export function readTerminalSettings(root = process.cwd(), fallbackRoot = process.cwd()) {
    return readTerminalConfigMerged(root, fallbackRoot).terminal;
}
/**
 * Convenience: just the hotPool config.
 */
export function readHotPoolConfig(root = process.cwd(), fallbackRoot = process.cwd()) {
    return readTerminalConfigMerged(root, fallbackRoot).hotPool;
}
