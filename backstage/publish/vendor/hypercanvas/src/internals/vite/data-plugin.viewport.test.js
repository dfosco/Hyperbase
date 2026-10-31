// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { buildDataDiscovery, canvasViewportScope } from './data-plugin.js'

// Discovery's unrelated git-author fallback must not invoke Git for fixtures.
vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => { throw new Error('Fixture has no git history') }),
  spawnSync: vi.fn(() => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository' })),
}))

let fixture
beforeEach(() => { fixture = mkdtempSync(path.join(tmpdir(), 'canvas-viewport-scope-')) })
afterEach(() => { rmSync(fixture, { recursive: true, force: true }) })

function writeCanvas(root, name = 'overview', title = name) {
  const directory = path.join(root, 'src', 'canvas')
  mkdirSync(directory, { recursive: true })
  writeFileSync(path.join(directory, `${name}.canvas.jsonl`), JSON.stringify({ event: 'canvas_created', title, widgets: [] }) + '\n')
}
function scopes(root) {
  return Object.values(buildDataDiscovery(root).canvases).map((canvas) => canvas._viewportScope)
}

describe('Canvas viewport discovery scope', () => {
  it('separates the same canvas ID in different Notebook roots', () => {
    const first = path.join(fixture, 'first')
    const second = path.join(fixture, 'second')
    writeCanvas(first)
    writeCanvas(second)
    expect(Object.keys(buildDataDiscovery(first).canvases)).toEqual(Object.keys(buildDataDiscovery(second).canvases))
    expect(scopes(first)[0]).toMatch(/^[a-f0-9]{64}$/)
    expect(scopes(first)[0]).not.toBe(scopes(second)[0])
  })

  it('shares one stable scope across canvases and later discovery passes', () => {
    writeCanvas(fixture)
    writeCanvas(fixture, 'details')
    const before = scopes(fixture)
    expect(before).toHaveLength(2)
    expect(before[0]).toBe(before[1])
    writeCanvas(fixture, 'overview', 'Edited title')
    expect(scopes(fixture)).toEqual(before)
  })

  it('uses the same scope when the physical root is reached through a symlink', () => {
    const physical = path.join(fixture, 'physical')
    const alias = path.join(fixture, 'alias')
    writeCanvas(physical)
    symlinkSync(physical, alias, 'dir')
    expect(canvasViewportScope(alias)).toEqual(canvasViewportScope(physical))
  })
})
