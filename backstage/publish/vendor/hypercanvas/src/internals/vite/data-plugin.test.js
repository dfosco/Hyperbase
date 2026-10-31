import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync, cpSync, symlinkSync } from 'node:fs'
import { moveNotebookConfigToRoot } from '../../core/notebook/relocate-config.test.helper.js'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EventEmitter } from 'node:events'
import { parse as parseJsonc } from 'jsonc-parser'
import storyboardDataPlugin, { resolveTemplateVars, computeTemplateVars, parseDataFile, buildDataDiscovery } from './data-plugin.js'
import notebookRoutesPlugin from '../../core/notebook/vite-routes-plugin.js'
import { initializeNotebook, inspectNotebook } from '../../core/notebook/notebook.js'
import notebookRuntimePlugin from '../../core/notebook/vite-runtime-plugin.js'

const RESOLVED_ID = '\0virtual:storyboard-data-index'
const STATEFULLY_DATA_INDEX_RESOLVED_ID = '\0virtual:statefully-data-index'
const APP_CONFIG_VIRTUAL_ID = 'virtual:hypercanvas-app-config'

let tmpDir

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'sb-test-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function createPlugin(root) {
  const plugin = storyboardDataPlugin()
  plugin.configResolved({ root: root ?? tmpDir })
  return plugin
}

function writeDataFiles(dir) {
  writeFileSync(
    path.join(dir, 'default.scene.json'),
    JSON.stringify({ title: 'Test' }),
  )
  writeFileSync(
    path.join(dir, 'user.object.json'),
    JSON.stringify({ name: 'Jane' }),
  )
  writeFileSync(
    path.join(dir, 'posts.record.json'),
    JSON.stringify([{ id: '1', title: 'First' }]),
  )
}

describe('storyboardDataPlugin', () => {
  it('keeps the public Design Notebook runtime imports bound to typed source modules', () => {
    const plugin = createPlugin(tmpDir)
    for (const name of ['react', 'route']) {
      const resolved = plugin.resolveId(`design-notebook/runtime/${name}`)
      expect(resolved).toMatch(new RegExp(`/first-look/runtime/${name}\\.ts$`))
      expect(existsSync(resolved)).toBe(true)
    }
  })
  it('resolves exact Statefully compatibility entries against the pinned implementation', () => {
    const plugin = createPlugin(tmpDir)
    const resolved = plugin.resolveId('@dfosco/statefully/react')
    expect(resolved).toBe('\0virtual:hypercanvas-statefully/react')
    expect(plugin.load(resolved)).toContain(fileURLToPath(import.meta.resolve('@dfosco/statefully/react')))
    expect(plugin.resolveId('@dfosco/statefully/session')).toBe(plugin.resolveId('@dfosco/statefully'))
    expect(plugin.resolveId('@dfosco/statefully/knobs')).toBe(plugin.resolveId('@dfosco/statefully'))
    expect(plugin.resolveId('@dfosco/statefully/session/unknown')).toBeUndefined()
    expect(existsSync(fileURLToPath(import.meta.resolve('@dfosco/statefully/react')))).toBe(true)
    expect(plugin.resolveId('@dfosco/statefully/unrelated')).toBeUndefined()
  })
  it('indexes arbitrary story filenames under one component identity and scopes secondary modules', () => {
    initializeNotebook(tmpDir, { title: 'Component stories' })
    const folder = path.join(tmpDir, 'Research', 'Button.component')
    mkdirSync(path.join(folder, 'variants'), { recursive: true })
    writeFileSync(path.join(folder, '.hypercanvas-artifact.json'), JSON.stringify({ formatVersion: 1, id: 'button-id', kind: 'component' }))
    writeFileSync(path.join(folder, 'examples.stories.tsx'), 'export const Primary = { args: { label: "Primary" } }; export const Secondary = {}')
    writeFileSync(path.join(folder, 'variants', 'More.story.jsx'), 'export function Disabled() { return null }')
    const catalog = inspectNotebook(tmpDir)
    expect(catalog.artifacts.filter(item => item.kind === 'component')).toEqual([
      expect.objectContaining({ id: 'button-id', available: true, route: '/components/Button', payloadPath: 'Research/Button.component/examples.stories.tsx' }),
    ])
    const discovery = buildDataDiscovery(tmpDir, { contentOnly: true })
    expect(discovery.stories.Button).toMatchObject({ _route: '/components/Button', _componentId: 'button-id', _exportNames: ['Primary', 'Secondary'] })
    expect(discovery.stories['Button/variants/More']).toMatchObject({ _route: '/components/Button/variants/More', _componentId: 'button-id', _exportNames: ['Disabled'] })
  })
  it('loads the remaining data when a canvas is deleted before its watcher invalidates the cached index', () => {
    const file = path.join(tmpDir, 'removed.canvas.jsonl')
    writeFileSync(file, JSON.stringify({ event: 'canvas_created', title: 'Removed', widgets: [] }) + '\n')
    writeFileSync(path.join(tmpDir, 'kept.object.json'), JSON.stringify({ label: 'Still present' }))
    const plugin = createPlugin(tmpDir)
    expect(plugin.load(RESOLVED_ID)).toContain('Removed')
    rmSync(file)
    const code = plugin.load(RESOLVED_ID)
    expect(code).not.toContain('Removed')
    expect(code).toContain('Still present')
  })

  it.each([
    ['Hypercanvas Beta # café%20', true],
    ['Hypercanvas Beta # café%20.app', false],
  ])('handles theme generation under %s without an encoded sibling (writable: %s)', (directoryName, writable) => {
    // Load a real module copy in Node so import.meta.url reflects the installed
    // bundle path. A fixture root alone would leave the plugin in this checkout.
    const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
    const shellRoot = path.join(tmpDir, directoryName, 'Contents', 'Resources', 'hypercanvas-core', 'storyboard')
    const copiedPackage = path.join(shellRoot, 'packages', 'storyboard')
    mkdirSync(copiedPackage, { recursive: true })
    cpSync(path.join(packageRoot, 'src/internals'), path.join(copiedPackage, 'dist/internals'), { recursive: true })
    cpSync(path.join(packageRoot, 'dist/core'), path.join(copiedPackage, 'dist/core'), { recursive: true })
    writeFileSync(path.join(shellRoot, 'package.json'), '{"type":"module"}')
    symlinkSync(path.resolve(packageRoot, '../../node_modules'), path.join(shellRoot, 'node_modules'), 'dir')
    writeFileSync(path.join(shellRoot, 'storyboard.config.json'), JSON.stringify({
      theming: { surfaces: { regression: {} } },
    }))
    const themesPath = path.join(copiedPackage, 'dist', 'core', 'styles', 'themes.generated.css')
    const shippedThemes = readFileSync(themesPath, 'utf8')
    if (writable) rmSync(themesPath, { force: true })

    execFileSync(process.execPath, ['--input-type=module', '-e', `
      import path from 'node:path'
      import { pathToFileURL } from 'node:url'
      const root = process.argv[1]
      const moduleUrl = pathToFileURL(path.join(root, 'packages/storyboard/dist/internals/vite/data-plugin.js'))
      const { default: createPlugin } = await import(moduleUrl)
      createPlugin().configResolved({ root, command: 'build', build: { outDir: 'dist' } })
    `, shellRoot], { cwd: shellRoot, encoding: 'utf8', timeout: 15_000 })

    expect(existsSync(themesPath)).toBe(true)
    if (writable) expect(readFileSync(themesPath, 'utf8')).toContain('data-sb-regression-theme')
    else expect(readFileSync(themesPath, 'utf8')).toBe(shippedThemes)
    expect(existsSync(path.join(tmpDir, encodeURIComponent(directoryName)))).toBe(false)
  })

  it("has name 'storyboard-data'", () => {
    const plugin = storyboardDataPlugin()
    expect(plugin.name).toBe('storyboard-data')
  })

  it("has enforce 'pre'", () => {
    const plugin = storyboardDataPlugin()
    expect(plugin.enforce).toBe('pre')
  })

  it('config() excludes @dfosco/hypercanvas from optimizeDeps', () => {
    const plugin = storyboardDataPlugin()
    const config = plugin.config()
    expect(config.optimizeDeps.exclude).toContain('@dfosco/hypercanvas')
  })

  it('config() includes markdown pipeline stack in optimizeDeps so Vite pre-bundles transitive CJS deps', () => {
    const plugin = storyboardDataPlugin()
    const config = plugin.config()
    expect(config.optimizeDeps.include).toContain('remark-parse')
    expect(config.optimizeDeps.include).toContain('remark-gfm')
    expect(config.optimizeDeps.include).toContain('rehype-sanitize')
  })

  it('does not request optimization for unused Primer packages absent from runtime dependencies', () => {
    const include = storyboardDataPlugin().config().optimizeDeps.include
    expect(include).toContain('@primer/octicons-react')
    expect(include).not.toContain('@primer/octicons')
    expect(include).not.toContain('@primer/react')
    expect(include).not.toContain('react-compiler-runtime')
  })

  it('uses the application discovery root when the Notebook runtime has no active root', () => {
    const appRoot = path.join(tmpDir, 'application')
    mkdirSync(appRoot, { recursive: true })
    writeFileSync(path.join(appRoot, 'hypercanvas.config.json'), JSON.stringify({ workspace: { label: 'Fallback app root' } }))
    const plugin = storyboardDataPlugin({ notebookRuntime: { status: () => ({ root: null }) } })
    plugin.configResolved({ root: appRoot, command: 'build', build: { outDir: 'dist' } })

    expect(plugin.load(APP_CONFIG_VIRTUAL_ID)).toContain('Fallback app root')
  })

  it("resolveId returns resolved ID for 'virtual:storyboard-data-index'", () => {
    const plugin = createPlugin()
    expect(plugin.resolveId('virtual:storyboard-data-index')).toBe(RESOLVED_ID)
  })

  it('provides the pinned Statefully data index and Design Notebook runtime imports', () => {
    const adapter = {
      getIndex: () => ({ flows: { 'borrow-flow/default': { title: 'Borrow flow' } }, objects: {}, records: {}, prototypes: {}, components: {} }),
      getDiagnostics: () => [],
    }
    const plugin = storyboardDataPlugin({ statefullyAdapter: adapter })
    expect(plugin.resolveId('virtual:statefully-data-index')).toBe(STATEFULLY_DATA_INDEX_RESOLVED_ID)
    expect(plugin.resolveId('@dfosco/statefully/data-runtime')).toMatch(/node_modules\/.*statefully\/src\/core\/data\.js$/)
    const indexModule = plugin.load(STATEFULLY_DATA_INDEX_RESOLVED_ID)
    expect(indexModule).toContain("import { init } from '@dfosco/statefully/data-runtime';")
    expect(indexModule).toContain('"borrow-flow/default"')
    expect(indexModule).toContain('init(statefullyIndex)')
    expect(plugin.resolveId('design-notebook/runtime/route')).toMatch(/first-look[\\/]runtime[\\/]route\.ts$/)
    expect(plugin.resolveId('design-notebook/runtime/react')).toMatch(/first-look[\\/]runtime[\\/]react\.ts$/)
  })

  it('routes Statefully React and generated index imports through the same data-store module ID', () => {
    const plugin = createPlugin()
    const statefullyReactSource = fileURLToPath(import.meta.resolve('@dfosco/statefully/react'))
    const transformed = plugin.transform(
      "import { getDefaultStore } from './core/data.js'",
      `${statefullyReactSource}?v=optimizer-version`,
    )

    expect(transformed?.code).toContain("from '@dfosco/statefully/data-runtime'")
    expect(plugin.resolveId('@dfosco/statefully/data-runtime')).toMatch(/node_modules\/.*statefully\/src\/core\/data\.js$/)
  })

  it('resolveId returns undefined for other IDs', () => {
    const plugin = createPlugin()
    expect(plugin.resolveId('some-other-module')).toBeUndefined()
  })

  it('resolves source loader imports from StoryPage, ComponentSetPage, context, and the Core barrel to the public singleton', async () => {
    const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
    const importCases = [
      [path.join(packageRoot, 'src/internals/story/StoryPage.jsx'), '../../core/data/loader.js'],
      [path.join(packageRoot, 'src/internals/story/ComponentSetPage.jsx'), '../../core/data/loader.js'],
      [path.join(packageRoot, 'src/internals/context.jsx'), '../core/data/loader.js'],
      [path.join(packageRoot, 'src/core/index.ts'), './data/loader.js'],
    ]
    const resolve = vi.fn(async () => ({ id: path.join(packageRoot, 'dist/core/data/loader.js') }))
    const plugin = createPlugin()

    for (const [importer, source] of importCases) {
      await expect(plugin.resolveId.call({ resolve }, source, importer)).resolves.toEqual({
        id: path.join(packageRoot, 'dist/core/data/loader.js'),
      })
    }

    expect(resolve).toHaveBeenCalledTimes(importCases.length)
    expect(resolve).toHaveBeenCalledWith(
      '@dfosco/hypercanvas/core/data/loader',
      importCases[0][0],
      { skipSelf: true },
    )
    expect(plugin.resolveId.call({ resolve }, '@dfosco/hypercanvas/core/data/loader', importCases[0][0])).toBeUndefined()

    const applicationImporter = path.join(tmpDir, 'src/internals/appWidget.js')
    mkdirSync(path.dirname(applicationImporter), { recursive: true })
    writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'consumer-app' }))
    mkdirSync(path.join(tmpDir, 'src/core/data'), { recursive: true })
    writeFileSync(path.join(tmpDir, 'src/core/data/loader.js'), 'export const getStoryData = () => null')
    expect(plugin.resolveId.call({ resolve }, '../../core/data/loader.js', applicationImporter)).toBeUndefined()
  })

  it('seeds one data-loader instance for source readers, the package loader, and the Core barrel', async () => {
    const applicationRoot = path.join(tmpDir, 'application')
    const notebookRoot = path.join(tmpDir, 'notebook')
    const vendoredPackage = path.join(applicationRoot, 'vendor', 'hypercanvas')
    const sourceDirectory = path.join(vendoredPackage, 'src')
    const componentFolder = path.join(notebookRoot, 'Team', 'PublishedCard.component')
    const prototypeFolder = path.join(notebookRoot, 'Team', 'Account.prototype')
    mkdirSync(path.join(applicationRoot, 'src'), { recursive: true })
    mkdirSync(path.join(sourceDirectory, 'internals', 'story'), { recursive: true })
    mkdirSync(path.join(sourceDirectory, 'internals'), { recursive: true })
    mkdirSync(path.join(sourceDirectory, 'core', 'data'), { recursive: true })
    mkdirSync(componentFolder, { recursive: true })
    mkdirSync(prototypeFolder, { recursive: true })
    writeFileSync(path.join(applicationRoot, 'package.json'), JSON.stringify({ name: 'loader-singleton-fixture', type: 'module' }))
    writeFileSync(path.join(vendoredPackage, 'package.json'), JSON.stringify({ name: '@dfosco/hypercanvas', type: 'module' }))
    symlinkSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../node_modules'), path.join(applicationRoot, 'node_modules'), 'dir')
    writeFileSync(path.join(sourceDirectory, 'core', 'data', 'loader.js'), [
      'export const getStoryData = () => null',
      'export const loadFlow = () => { throw new Error("unredirected source loader") }',
      'export const loadRecord = () => { throw new Error("unredirected source loader") }',
    ].join('\n'))
    writeFileSync(path.join(sourceDirectory, 'internals', 'story', 'StoryPage.js'), [
      "import { getStoryData } from '../../core/data/loader.js'",
      'export const readStoryPage = (name) => getStoryData(name)',
    ].join('\n'))
    writeFileSync(path.join(sourceDirectory, 'internals', 'story', 'ComponentSetPage.js'), [
      "import { getStoryData } from '../../core/data/loader.js'",
      'export const readComponentSetPage = (name) => getStoryData(name)',
    ].join('\n'))
    writeFileSync(path.join(sourceDirectory, 'internals', 'context.js'), [
      "import { loadFlow, loadRecord } from '../core/data/loader.js'",
      'export const readContextFlow = (name) => loadFlow(name)',
      'export const readContextRecord = (name) => loadRecord(name)',
    ].join('\n'))

    initializeNotebook(notebookRoot, { title: 'Loader singleton fixture' })
    writeFileSync(path.join(componentFolder, '.hypercanvas-artifact.json'), JSON.stringify({
      formatVersion: 1, id: 'published-card-marker-id', kind: 'component',
    }))
    writeFileSync(path.join(componentFolder, 'PublishedCard.component.json'), JSON.stringify({ knobs: [] }))
    writeFileSync(path.join(componentFolder, 'PublishedCard.story.jsx'), 'export const Default = () => null')
    writeFileSync(path.join(prototypeFolder, '.hypercanvas-artifact.json'), JSON.stringify({
      formatVersion: 1, id: 'account-prototype-marker-id', kind: 'prototype',
    }))
    writeFileSync(path.join(prototypeFolder, 'Account.prototype.json'), JSON.stringify({ title: 'Account' }))
    writeFileSync(path.join(prototypeFolder, 'index.jsx'), 'export default function Account() { return null }')
    writeFileSync(path.join(prototypeFolder, 'default.flow.json'), JSON.stringify({ title: 'Flow from the virtual index' }))
    writeFileSync(path.join(prototypeFolder, 'posts.record.json'), JSON.stringify([{ id: 'post-1', title: 'Record from the virtual index' }]))
    writeFileSync(path.join(applicationRoot, 'src', 'entry.js'), [
      "import { stories } from 'virtual:storyboard-data-index'",
      "import { findRecord, getStoryData, loadFlow, loadRecord } from '@dfosco/hypercanvas/core/data/loader'",
      "import { findRecord as findRecordFromCore, getStoryData as getStoryDataFromCore, loadFlow as loadFlowFromCore, loadRecord as loadRecordFromCore } from '@dfosco/hypercanvas/core'",
      "import { readStoryPage } from '../vendor/hypercanvas/src/internals/story/StoryPage.js'",
      "import { readComponentSetPage } from '../vendor/hypercanvas/src/internals/story/ComponentSetPage.js'",
      "import { readContextFlow, readContextRecord } from '../vendor/hypercanvas/src/internals/context.js'",
      'export const reads = {',
      '  indexedStory: stories.PublishedCard,',
      '  sourceStoryPage: readStoryPage("PublishedCard"),',
      '  sourceComponentSetPage: readComponentSetPage("PublishedCard"),',
      '  packageStory: getStoryData("PublishedCard"),',
      '  coreStory: getStoryDataFromCore("PublishedCard"),',
      '  sourceFlow: readContextFlow("Account/default"),',
      '  packageFlow: loadFlow("Account/default"),',
      '  coreFlow: loadFlowFromCore("Account/default"),',
      '  sourceRecord: readContextRecord("Account/posts"),',
      '  packageRecord: loadRecord("Account/posts"),',
      '  coreRecord: loadRecordFromCore("Account/posts"),',
      '  packageFoundRecord: findRecord("Account/posts", "post-1"),',
      '  coreFoundRecord: findRecordFromCore("Account/posts", "post-1"),',
      '}',
    ].join('\n'))

    const outputDirectory = path.join(applicationRoot, 'compiled')
    const pluginPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data-plugin.js')
    execFileSync(process.execPath, ['--input-type=module', '-e', `
      import path from 'node:path'
      import { pathToFileURL } from 'node:url'
      import { writeFileSync } from 'node:fs'
      import assert from 'node:assert/strict'
      import { build, createServer } from 'vite'
      const [applicationRoot, notebookRoot, outputDirectory, pluginPath] = process.argv.slice(1)
      const sourceLoader = await createServer({
        configFile: false,
        root: applicationRoot,
        cacheDir: path.join(applicationRoot, '.vite-test-cache'),
        optimizeDeps: { noDiscovery: true, include: [] },
        appType: 'custom',
        server: { middlewareMode: true },
      })
      try {
        const { default: createPlugin } = await sourceLoader.ssrLoadModule(pluginPath)
        await build({
          configFile: false,
          root: applicationRoot,
          plugins: [createPlugin({ notebookRuntime: { status: () => ({ root: notebookRoot }) } })],
          build: {
          ssr: path.join(applicationRoot, 'src', 'entry.js'),
            outDir: outputDirectory,
            emptyOutDir: true,
            rollupOptions: {
              input: path.join(applicationRoot, 'src', 'entry.js'),
              output: { entryFileNames: 'entry.js', inlineDynamicImports: true },
            },
          },
        })
      } finally {
        await sourceLoader.close()
      }
      const entryModule = await import(pathToFileURL(path.join(outputDirectory, 'entry.js')).href)
      const { reads } = entryModule
      assert.equal(reads.indexedStory._route, '/components/PublishedCard')
      assert.equal(reads.sourceStoryPage, reads.indexedStory)
      assert.equal(reads.sourceComponentSetPage, reads.indexedStory)
      assert.equal(reads.packageStory, reads.indexedStory)
      assert.equal(reads.coreStory, reads.indexedStory)
      assert.deepEqual(reads.sourceFlow, { title: 'Flow from the virtual index', _route: '/Account.prototype' })
      assert.deepEqual(reads.packageFlow, reads.sourceFlow)
      assert.deepEqual(reads.coreFlow, reads.sourceFlow)
      assert.deepEqual(reads.sourceRecord, [{ id: 'post-1', title: 'Record from the virtual index' }])
      assert.deepEqual(reads.packageRecord, reads.sourceRecord)
      assert.deepEqual(reads.coreRecord, reads.sourceRecord)
      assert.deepEqual(reads.packageFoundRecord, { id: 'post-1', title: 'Record from the virtual index' })
      assert.deepEqual(reads.coreFoundRecord, reads.packageFoundRecord)
      const storyModule = await reads.indexedStory._storyImport()
      assert.equal(typeof storyModule.Default, 'function')
      writeFileSync(path.join(outputDirectory, 'assertions.json'), JSON.stringify({
        storyRoute: reads.indexedStory._route,
        sourceStoryPageSharesIndex: reads.sourceStoryPage === reads.indexedStory,
        sourceComponentSetSharesIndex: reads.sourceComponentSetPage === reads.indexedStory,
        packageStorySharesIndex: reads.packageStory === reads.indexedStory,
        coreStorySharesIndex: reads.coreStory === reads.indexedStory,
        sourceFlow: reads.sourceFlow,
        packageFlow: reads.packageFlow,
        coreFlow: reads.coreFlow,
        sourceRecord: reads.sourceRecord,
        packageRecord: reads.packageRecord,
        coreRecord: reads.coreRecord,
        packageFoundRecord: reads.packageFoundRecord,
        coreFoundRecord: reads.coreFoundRecord,
        namedStoryExportLoaded: typeof storyModule.Default === 'function',
      }))
    `, applicationRoot, notebookRoot, outputDirectory, pluginPath], {
      cwd: applicationRoot,
      encoding: 'utf8',
      timeout: 60_000,
    })

    const assertions = JSON.parse(readFileSync(path.join(outputDirectory, 'assertions.json'), 'utf8'))
    expect(assertions).toEqual({
      storyRoute: '/components/PublishedCard',
      sourceStoryPageSharesIndex: true,
      sourceComponentSetSharesIndex: true,
      packageStorySharesIndex: true,
      coreStorySharesIndex: true,
      sourceFlow: { title: 'Flow from the virtual index', _route: '/Account.prototype' },
      packageFlow: { title: 'Flow from the virtual index', _route: '/Account.prototype' },
      coreFlow: { title: 'Flow from the virtual index', _route: '/Account.prototype' },
      sourceRecord: [{ id: 'post-1', title: 'Record from the virtual index' }],
      packageRecord: [{ id: 'post-1', title: 'Record from the virtual index' }],
      coreRecord: [{ id: 'post-1', title: 'Record from the virtual index' }],
      packageFoundRecord: { id: 'post-1', title: 'Record from the virtual index' },
      coreFoundRecord: { id: 'post-1', title: 'Record from the virtual index' },
      namedStoryExportLoaded: true,
    })
  })

  it('load generates valid module code with init() call', () => {
    writeDataFiles(tmpDir)
    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain("import { init } from '@dfosco/hypercanvas/core/data/loader'")
    expect(code).toContain("import { initKnobs } from '@dfosco/hypercanvas/core/knobs/discovery'")
    expect(code).toContain('init({ flows, objects, records, prototypes, folders, canvases, stories, scopeAliases })')
    expect(code).toContain('"Test"')
    expect(code).toContain('"Jane"')
    expect(code).toContain('"First"')
    // Backward-compat alias
    expect(code).toContain('const scenes = flows')
    expect(code).toContain('export { flows, scenes, objects, records, prototypes, prototypeKnobs, componentKnobs, folders, canvases, canvasAliases, scopeAliases, stories, notebookWidgets, notebookToolHandlers }')
  })

  it('rebuilds the virtual data index when the active Notebook root changes', () => {
    const firstRoot = path.join(tmpDir, 'first')
    const secondRoot = path.join(tmpDir, 'second')
    mkdirSync(firstRoot)
    mkdirSync(secondRoot)
    writeFileSync(path.join(firstRoot, 'first.flow.json'), JSON.stringify({ title: 'First Notebook' }))
    writeFileSync(path.join(secondRoot, 'second.flow.json'), JSON.stringify({ title: 'Second Notebook' }))
    mkdirSync(path.join(firstRoot, 'widgets'))
    mkdirSync(path.join(secondRoot, 'widgets'))
    writeFileSync(path.join(firstRoot, 'widgets', 'First.jsx'), 'export default function First() {}')
    writeFileSync(path.join(secondRoot, 'widgets', 'Second.jsx'), 'export default function Second() {}')
    writeFileSync(path.join(firstRoot, 'widgets.config.json'), JSON.stringify({ widgets: { first: { entry: 'widgets/First.jsx' } } }))
    writeFileSync(path.join(secondRoot, 'widgets.config.json'), JSON.stringify({ widgets: { second: { entry: 'widgets/Second.jsx' } } }))
    const previousRoot = process.env.HYPERCANVAS_NOTEBOOK_ROOT

    try {
      process.env.HYPERCANVAS_NOTEBOOK_ROOT = firstRoot
      const plugin = createPlugin(tmpDir)
      const firstCode = plugin.load(RESOLVED_ID)
      expect(firstCode).toContain('First Notebook')
      expect(firstCode).toContain('First.jsx')

      process.env.HYPERCANVAS_NOTEBOOK_ROOT = secondRoot
      const switchedCode = plugin.load(RESOLVED_ID)
      expect(switchedCode).toContain('Second Notebook')
      expect(switchedCode).not.toContain('First Notebook')
      expect(switchedCode).toContain('Second.jsx')
      expect(switchedCode).not.toContain('First.jsx')
    } finally {
      if (previousRoot === undefined) delete process.env.HYPERCANVAS_NOTEBOOK_ROOT
      else process.env.HYPERCANVAS_NOTEBOOK_ROOT = previousRoot
    }
  })

  it('generates Notebook-local widget components and custom tool handler imports', () => {
    const notebookRoot = path.join(tmpDir, 'notebook')
    mkdirSync(path.join(notebookRoot, 'widgets'), { recursive: true })
    mkdirSync(path.join(notebookRoot, 'tools', 'handlers'), { recursive: true })
    writeFileSync(path.join(notebookRoot, 'widgets', 'Badge.jsx'), 'export default function Badge() {}')
    writeFileSync(path.join(notebookRoot, 'tools', 'handlers', 'hello.js'), 'export const id = "hello"')
    writeFileSync(path.join(notebookRoot, 'widgets.config.json'), JSON.stringify({
      widgets: { badge: { label: 'Badge', entry: 'widgets/Badge.jsx', props: { width: { type: 'number', default: 200 } } } },
    }))
    writeFileSync(path.join(notebookRoot, 'toolbar.config.json'), JSON.stringify({
      tools: { hello: { label: 'Hello', handler: 'custom:hello', surface: 'command-toolbar', render: 'button' } },
    }))
    const previousRoot = process.env.HYPERCANVAS_NOTEBOOK_ROOT

    try {
      process.env.HYPERCANVAS_NOTEBOOK_ROOT = notebookRoot
      const code = createPlugin(tmpDir).load(RESOLVED_ID)
      expect(code).toContain('notebookWidgets')
      expect(code).toContain('/notebook/widgets/Badge.jsx')
      expect(code).toContain('Badge.jsx')
      expect(code).toContain('__notebookLazy')
      expect(code).toContain('notebookToolHandlers')
      expect(code).toContain('tools/handlers/hello.js')
    } finally {
      if (previousRoot === undefined) delete process.env.HYPERCANVAS_NOTEBOOK_ROOT
      else process.env.HYPERCANVAS_NOTEBOOK_ROOT = previousRoot
    }
  })

  it('loads backstage widget/tool entries with legacy fallback and respects explicit root entries in mixed layouts', () => {
    const notebookRoot = path.join(tmpDir, 'backstage-notebook')
    for (const directory of ['backstage/widgets', 'backstage/tools/handlers', 'widgets']) mkdirSync(path.join(notebookRoot, directory), { recursive: true })
    writeFileSync(path.join(notebookRoot, 'backstage/widgets/Badge.jsx'), 'export default function Badge() {}')
    writeFileSync(path.join(notebookRoot, 'widgets/Badge.jsx'), 'export default function LegacyBadge() {}')
    writeFileSync(path.join(notebookRoot, 'backstage/tools/handlers/hello.js'), 'export const id = "hello"')
    writeFileSync(path.join(notebookRoot, 'widgets.config.json'), JSON.stringify({ widgets: {
      explicit: { entry: 'widgets/Badge.jsx' }, backstage: { entry: 'backstage/widgets/Badge.jsx' },
    } }))
    writeFileSync(path.join(notebookRoot, 'toolbar.config.json'), JSON.stringify({ tools: {
      hello: { handler: 'custom:hello', surface: 'command-toolbar', render: 'button' },
    } }))
    const previousRoot = process.env.HYPERCANVAS_NOTEBOOK_ROOT
    try {
      process.env.HYPERCANVAS_NOTEBOOK_ROOT = notebookRoot
      const code = createPlugin(tmpDir).load(RESOLVED_ID)
      expect(code).toContain('/backstage-notebook/widgets/Badge.jsx')
      expect(code).toContain('/backstage-notebook/backstage/widgets/Badge.jsx')
      expect(code).toContain('/backstage-notebook/backstage/tools/handlers/hello.js')
      rmSync(path.join(notebookRoot, 'widgets/Badge.jsx'))
      expect(createPlugin(tmpDir).load(RESOLVED_ID)).not.toContain('"/backstage-notebook/widgets/Badge.jsx"')
    } finally {
      if (previousRoot === undefined) delete process.env.HYPERCANVAS_NOTEBOOK_ROOT
      else process.env.HYPERCANVAS_NOTEBOOK_ROOT = previousRoot
    }
  })

  it('rejects Notebook widget module entries that escape the widgets directory', () => {
    const notebookRoot = path.join(tmpDir, 'notebook')
    mkdirSync(notebookRoot, { recursive: true })
    writeFileSync(path.join(notebookRoot, 'widgets.config.json'), JSON.stringify({
      widgets: { unsafe: { label: 'Unsafe', entry: '../outside.jsx' } },
    }))
    const previousRoot = process.env.HYPERCANVAS_NOTEBOOK_ROOT

    try {
      process.env.HYPERCANVAS_NOTEBOOK_ROOT = notebookRoot
      expect(() => createPlugin(tmpDir).load(RESOLVED_ID)).toThrow(/inside widgets/)
    } finally {
      if (previousRoot === undefined) delete process.env.HYPERCANVAS_NOTEBOOK_ROOT
      else process.env.HYPERCANVAS_NOTEBOOK_ROOT = previousRoot
    }
  })

  it('load returns null for other IDs', () => {
    const plugin = createPlugin()
    expect(plugin.load('other-id')).toBeNull()
  })

  it('duplicate data files throw an error', () => {
    writeFileSync(
      path.join(tmpDir, 'dup.scene.json'),
      JSON.stringify({ a: 1 }),
    )
    const subDir = path.join(tmpDir, 'nested')
    mkdirSync(subDir, { recursive: true })
    writeFileSync(
      path.join(subDir, 'dup.scene.json'),
      JSON.stringify({ a: 2 }),
    )

    const plugin = createPlugin()
    expect(() => plugin.load(RESOLVED_ID)).toThrow(/Duplicate flow "dup"/)
  })

  it('allows same object name in global and prototype without clash', () => {
    mkdirSync(path.join(tmpDir, 'src', 'data'), { recursive: true })
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'Dashboard'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'data', 'user.object.json'),
      JSON.stringify({ name: 'Global' }),
    )
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'Dashboard', 'user.object.json'),
      JSON.stringify({ name: 'Local' }),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    // Both should exist without error
    expect(code).toContain('"user"')
    expect(code).toContain('"Dashboard/user"')
    expect(code).toContain('"Global"')
    expect(code).toContain('"Local"')
  })

  it('allows same object name in different prototypes without clash', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'A'), { recursive: true })
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'B'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'A', 'nav.object.json'),
      JSON.stringify({ from: 'A' }),
    )
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'B', 'nav.object.json'),
      JSON.stringify({ from: 'B' }),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('"A/nav"')
    expect(code).toContain('"B/nav"')
  })

  it('handles JSONC files (with comments)', () => {
    writeFileSync(
      path.join(tmpDir, 'commented.scene.jsonc'),
      '{\n  // This is a comment\n  "title": "JSONC Scene"\n}\n',
    )
    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('"JSONC Scene"')
  })

  it('normalizes .scene files into flow category in the index', () => {
    writeFileSync(
      path.join(tmpDir, 'legacy.scene.json'),
      JSON.stringify({ title: 'Legacy Scene' }),
    )
    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    // .scene.json files should be normalized to the flows category
    expect(code).toContain('"Legacy Scene"')
    expect(code).toContain('init({ flows, objects, records, prototypes, folders, canvases, stories, scopeAliases })')
  })

  it('buildStart resets the index cache', () => {
    writeDataFiles(tmpDir)
    const plugin = createPlugin()

    // First load builds the index
    const code1 = plugin.load(RESOLVED_ID)
    expect(code1).toContain('"Test"')

    // Add a new file
    writeFileSync(
      path.join(tmpDir, 'extra.scene.json'),
      JSON.stringify({ title: 'Extra' }),
    )

    // Without buildStart, cached index is used — "Extra" won't appear
    const code2 = plugin.load(RESOLVED_ID)
    expect(code2).not.toContain('"Extra"')

    // After buildStart, index is rebuilt
    plugin.buildStart()
    const code3 = plugin.load(RESOLVED_ID)
    expect(code3).toContain('"Extra"')
  })
})

describe('prototype scoping', () => {
  it('prefixes flows inside src/prototypes/{Name}/ with the prototype name', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'Dashboard'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'Dashboard', 'default.flow.json'),
      JSON.stringify({ title: 'Dashboard Default' }),
    )
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'Dashboard', 'signup.flow.json'),
      JSON.stringify({ title: 'Dashboard Signup' }),
    )
    // Global flow in src/data/
    mkdirSync(path.join(tmpDir, 'src', 'data'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'data', 'default.flow.json'),
      JSON.stringify({ title: 'Global Default' }),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('"Dashboard/default"')
    expect(code).toContain('"Dashboard/signup"')
    expect(code).toContain('"default"')
    expect(code).toContain('"Dashboard Default"')
    expect(code).toContain('"Global Default"')
  })

  it('prefixes records inside src/prototypes/{Name}/ with the prototype name', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'Blog'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'Blog', 'posts.record.json'),
      JSON.stringify([{ id: '1', title: 'Scoped Post' }]),
    )
    // Global record
    mkdirSync(path.join(tmpDir, 'src', 'data'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'data', 'posts.record.json'),
      JSON.stringify([{ id: '1', title: 'Global Post' }]),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('"Blog/posts"')
    expect(code).toContain('"posts"')
    expect(code).toContain('"Scoped Post"')
    expect(code).toContain('"Global Post"')
  })

  it('prefixes objects inside src/prototypes/{Name}/', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'Dashboard'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'Dashboard', 'helpers.object.json'),
      JSON.stringify({ util: true }),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    // Object should be scoped as "Dashboard/helpers"
    expect(code).toContain('"Dashboard/helpers"')
  })

  it('allows same flow name in different prototypes without clash', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'A'), { recursive: true })
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'B'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'A', 'default.flow.json'),
      JSON.stringify({ from: 'A' }),
    )
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'B', 'default.flow.json'),
      JSON.stringify({ from: 'B' }),
    )

    const plugin = createPlugin()
    // Should not throw (no duplicate)
    const code = plugin.load(RESOLVED_ID)
    expect(code).toContain('"A/default"')
    expect(code).toContain('"B/default"')
  })

  it('normalizes .scene.json inside prototypes to scoped flow', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'Legacy'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'Legacy', 'old.scene.json'),
      JSON.stringify({ compat: true }),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    // Should be indexed as a scoped flow, not a scene
    expect(code).toContain('"Legacy/old"')
    expect(code).toContain('flows')
  })
})

describe('catalog-backed suffix artifact data indexing', () => {
  it('indexes stable Canvas IDs from a manifestless Design Notebook', () => {
    const fixtureRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../..',
      'test/fixtures/design-notebook-example',
    )
    cpSync(fixtureRoot, tmpDir, { recursive: true })

    const discovery = buildDataDiscovery(tmpDir, { contentOnly: true })

    expect(discovery.canvases['checkout-review']).toMatchObject({
      title: 'Borrow flow review',
      _route: '/canvas/checkout-review',
    })
  })

  it('emits prototype scope aliases as lookup-only canonical mappings, hidden included', () => {
    initializeNotebook(tmpDir, { title: 'Scope alias mapping' })
    const prototypeFolder = path.join(tmpDir, 'Team', 'Widget.prototype')
    mkdirSync(prototypeFolder, { recursive: true })
    writeFileSync(path.join(prototypeFolder, '.hypercanvas-artifact.json'), JSON.stringify({
      formatVersion: 1,
      id: 'widget-id',
      kind: 'prototype',
      migrationAliases: { legacyScopes: { prototype: 'OldWidget', folder: 'Team' } },
    }))
    writeFileSync(path.join(prototypeFolder, 'index.jsx'), 'export default function Widget() { return null }')
    writeFileSync(path.join(prototypeFolder, 'default.flow.json'), JSON.stringify({ title: 'Widget' }))
    const hiddenFolder = path.join(tmpDir, 'Team', '_Hidden.prototype')
    mkdirSync(hiddenFolder, { recursive: true })
    writeFileSync(path.join(hiddenFolder, '.hypercanvas-artifact.json'), JSON.stringify({
      formatVersion: 1,
      id: 'hidden-id',
      kind: 'prototype',
      migrationAliases: { legacyScopes: { prototype: 'OldHidden', folder: 'Team' } },
    }))
    writeFileSync(path.join(hiddenFolder, 'index.jsx'), 'export default function Hidden() { return null }')
    writeFileSync(path.join(hiddenFolder, 'default.flow.json'), JSON.stringify({ title: 'Hidden' }))

    expect(inspectNotebook(tmpDir).artifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'prototype', migrationAliases: { legacyScopes: { prototype: 'OldWidget', folder: 'Team' } } }),
    ]))
    const discovery = buildDataDiscovery(tmpDir, { contentOnly: true })
    // `_` is sidebar visibility only: hidden prototypes participate in the
    // data index and keep their legacy scope aliases like visible ones.
    expect(discovery.scopeAliases).toEqual({ OldWidget: 'Widget', OldHidden: 'Hidden' })
    expect(discovery.flows['Widget/default']).toBeDefined()
    expect(discovery.flows['Hidden/default']).toBeDefined()
    const generated = createPlugin(tmpDir).load(RESOLVED_ID)
    // Hidden aliases are sent alongside visible ones (init drops nothing).
    expect(generated).toContain('const scopeAliases = {"OldHidden":"Hidden","OldWidget":"Widget"}')
    expect(generated).toContain('init({ flows, objects, records, prototypes, folders, canvases, stories, scopeAliases })')
  })

  it('indexes suffix artifacts under Notebook parents omitted by source-repository scans', () => {
    initializeNotebook(tmpDir, { title: 'Ordinary parent folders' })
    const prototypeFolder = path.join(tmpDir, 'fixtures', 'Account.prototype')
    mkdirSync(prototypeFolder, { recursive: true })
    writeFileSync(path.join(prototypeFolder, '.hypercanvas-artifact.json'), JSON.stringify({
      formatVersion: 1, id: 'fixtures-prototype-id', kind: 'prototype',
    }))
    writeFileSync(path.join(prototypeFolder, 'index.jsx'), 'export default function Account() { return null }')
    writeFileSync(path.join(prototypeFolder, 'Account.prototype.json'), JSON.stringify({ title: 'Account' }))
    writeFileSync(path.join(prototypeFolder, 'default.flow.json'), JSON.stringify({ title: 'Default' }))
    writeFileSync(path.join(prototypeFolder, 'data.object.json'), JSON.stringify({ path: '${currentProto}/data' }))

    const canvasFolder = path.join(tmpDir, 'artifacts', 'Roadmap.canvas')
    mkdirSync(canvasFolder, { recursive: true })
    writeFileSync(path.join(canvasFolder, '.hypercanvas-artifact.json'), JSON.stringify({
      formatVersion: 1, id: 'artifacts-canvas-id', kind: 'canvas',
    }))
    writeFileSync(path.join(canvasFolder, 'Roadmap.canvas.jsonl'), JSON.stringify({
      event: 'canvas_created', title: 'Roadmap', widgets: [],
    }) + '\n')

    const discovery = buildDataDiscovery(tmpDir, { contentOnly: true })

    expect(discovery.prototypes.Account).toMatchObject({
      dirName: 'Account', route: '/Account.prototype', artifactId: 'fixtures-prototype-id',
    })
    expect(discovery.flows['Account/default']._route).toBe('/Account.prototype')
    expect(discovery.objects['Account/data'].path).toBe('fixtures/Account.prototype/data')
    expect(discovery.canvases['artifacts-canvas-id']).toMatchObject({
      title: 'Roadmap', _route: '/canvas/Roadmap',
    })
  })

  it('keeps prototype logical scopes and canonical routes independent of parent and marker identity', () => {
    initializeNotebook(tmpDir, { title: 'Nested artifacts' })
    const prototypeFolder = path.join(tmpDir, 'Teams', 'Research', 'Account.prototype')
    mkdirSync(path.join(prototypeFolder, 'flows'), { recursive: true })
    writeFileSync(path.join(prototypeFolder, '.hypercanvas-artifact.json'), JSON.stringify({
      formatVersion: 1, id: 'opaque-prototype-id', kind: 'prototype',
    }))
    writeFileSync(path.join(prototypeFolder, 'index.jsx'), 'export default function Account() { return null }')
    writeFileSync(path.join(prototypeFolder, 'Account.prototype.json'), JSON.stringify({ title: 'Account' }))
    writeFileSync(path.join(prototypeFolder, 'default.flow.json'), JSON.stringify({ title: 'Default', meta: { default: true } }))
    writeFileSync(path.join(prototypeFolder, 'flows', 'nav.object.json'), JSON.stringify({ path: '${currentProto}/nav' }))
    writeFileSync(path.join(prototypeFolder, 'flows', 'posts.record.json'), JSON.stringify([{ path: '${currentProtoDir}/posts' }]))
    writeFileSync(path.join(prototypeFolder, 'flows', 'legacy.scene.json'), JSON.stringify({ title: 'Scene alias' }))

    const discovery = buildDataDiscovery(tmpDir, { contentOnly: true })

    expect(discovery.prototypes.Account).toMatchObject({
      dirName: 'Account', route: '/Account.prototype', artifactId: 'opaque-prototype-id',
    })
    expect(discovery.flows['Account/default']._route).toBe('/Account.prototype')
    expect(discovery.objects['Account/nav'].path).toBe('Teams/Research/Account.prototype/nav')
    expect(discovery.records['Account/posts'][0].path).toBe('Teams/Research/posts')
    expect(discovery.flows['Account/legacy']?.title).toBe('Scene alias')
    expect(discovery.flows['Teams/Research/Account/default']).toBeUndefined()
  })

  it('keeps hidden non-prototype artifacts addressable while excluding hidden/nested prototype routes', () => {
    initializeNotebook(tmpDir, { title: 'Nested artifacts' })
    const canvasFolder = path.join(tmpDir, 'Teams', 'Boards', 'Board.canvas')
    mkdirSync(canvasFolder, { recursive: true })
    writeFileSync(path.join(canvasFolder, '.hypercanvas-artifact.json'), JSON.stringify({
      formatVersion: 1, id: 'canvas-stable-opaque', kind: 'canvas',
    }))
    writeFileSync(path.join(canvasFolder, 'Board.canvas.jsonl'), JSON.stringify({
      event: 'canvas_created', title: 'Board', widgets: [],
    }) + '\n')

    const hiddenCanvasFolder = path.join(tmpDir, '_Archive', 'HiddenBoard.canvas')
    mkdirSync(hiddenCanvasFolder, { recursive: true })
    writeFileSync(path.join(hiddenCanvasFolder, '.hypercanvas-artifact.json'), JSON.stringify({
      formatVersion: 1, id: 'hidden-canvas-stable', kind: 'canvas',
    }))
    writeFileSync(path.join(hiddenCanvasFolder, 'HiddenBoard.canvas.jsonl'), JSON.stringify({
      event: 'canvas_created', title: 'Hidden board', widgets: [],
    }) + '\n')

    const hiddenComponentFolder = path.join(tmpDir, '_Archive', 'HiddenWidget.component')
    mkdirSync(hiddenComponentFolder, { recursive: true })
    writeFileSync(path.join(hiddenComponentFolder, '.hypercanvas-artifact.json'), JSON.stringify({
      formatVersion: 1, id: 'hidden-component-stable', kind: 'component',
    }))
    writeFileSync(path.join(hiddenComponentFolder, 'HiddenWidget.component.json'), JSON.stringify({
      knobs: [{ name: 'density', type: 'number' }],
    }))
    writeFileSync(path.join(hiddenComponentFolder, 'HiddenWidget.story.jsx'), 'export default function HiddenWidget() { return null }')

    const hiddenFolder = path.join(tmpDir, '_Archive', 'Hidden.prototype')
    mkdirSync(hiddenFolder, { recursive: true })
    writeFileSync(path.join(hiddenFolder, 'index.jsx'), 'export default function Hidden() { return null }')
    writeFileSync(path.join(hiddenFolder, 'Hidden.prototype.json'), JSON.stringify({ title: 'Hidden' }))
    writeFileSync(path.join(hiddenFolder, '.hypercanvas-artifact.json'), JSON.stringify({
      formatVersion: 1, id: 'hidden-prototype', kind: 'prototype',
    }))

    const parentFolder = path.join(tmpDir, 'Team', 'Owner.prototype')
    const nestedFolder = path.join(parentFolder, 'Sub.prototype')
    mkdirSync(nestedFolder, { recursive: true })
    writeFileSync(path.join(parentFolder, 'index.jsx'), 'export default function Owner() { return null }')
    writeFileSync(path.join(parentFolder, 'Owner.prototype.json'), JSON.stringify({ title: 'Owner' }))
    writeFileSync(path.join(parentFolder, '.hypercanvas-artifact.json'), JSON.stringify({
      formatVersion: 1, id: 'owner-prototype', kind: 'prototype',
    }))
    writeFileSync(path.join(nestedFolder, 'index.jsx'), 'export default function Sub() { return null }')
    writeFileSync(path.join(nestedFolder, 'Sub.prototype.json'), JSON.stringify({ title: 'Sub' }))
    writeFileSync(path.join(nestedFolder, '.hypercanvas-artifact.json'), JSON.stringify({
      formatVersion: 1, id: 'nested-prototype', kind: 'prototype',
    }))
    writeFileSync(path.join(nestedFolder, 'hidden.flow.json'), JSON.stringify({ title: 'Invalid nested flow' }))

    const discovery = buildDataDiscovery(tmpDir, { contentOnly: true })
    expect(discovery.canvases['canvas-stable-opaque']).toMatchObject({ title: 'Board', _route: '/canvas/Board' })
    expect(discovery.canvasAliases.Board).toBe('canvas-stable-opaque')
    expect(discovery.canvasAliases['Teams/Boards/Board']).toBe('canvas-stable-opaque')
    expect(discovery.canvases['hidden-canvas-stable']).toMatchObject({ title: 'Hidden board' })
    expect(discovery.canvasAliases.HiddenBoard).toBe('hidden-canvas-stable')
    expect(discovery.canvasAliases['_Archive/HiddenBoard']).toBe('hidden-canvas-stable')
    expect(discovery.stories.HiddenWidget._route).toBe('/components/HiddenWidget')
    // `_` is sidebar-only: hidden and nested prototypes stay in the data
    // index under their logical names; nested folders still win the data
    // scope for their own payloads.
    expect(discovery.prototypes.Hidden).toMatchObject({ title: 'Hidden', dirName: 'Hidden', route: '/Hidden.prototype' })
    expect(discovery.prototypes.Sub).toBeUndefined()
    expect(discovery.flows['Sub/hidden']).toBeUndefined()
  })

  it('keeps folder-hidden canvases and components addressable while hiding prototypes', async () => {
    initializeNotebook(tmpDir, { title: 'Underscore catalog artifacts' })

    const canvasFolder = path.join(tmpDir, '_Board.canvas')
    mkdirSync(canvasFolder, { recursive: true })
    writeFileSync(path.join(canvasFolder, '.hypercanvas-artifact.json'), JSON.stringify({
      formatVersion: 1, id: 'underscore-board-id', kind: 'canvas',
    }))
    writeFileSync(path.join(canvasFolder, 'Board.canvas.jsonl'), JSON.stringify({
      event: 'canvas_created', title: 'Underscore board', widgets: [],
    }) + '\n')

    const componentFolder = path.join(tmpDir, '_Widget.component')
    mkdirSync(componentFolder, { recursive: true })
    writeFileSync(path.join(componentFolder, '.hypercanvas-artifact.json'), JSON.stringify({
      formatVersion: 1, id: 'underscore-widget-id', kind: 'component',
    }))
    writeFileSync(path.join(componentFolder, 'Widget.component.json'), JSON.stringify({ knobs: [] }))
    writeFileSync(path.join(componentFolder, 'Widget.story.jsx'), 'export default function Widget() { return null }')

    const prototypeFolder = path.join(tmpDir, '_Guide.prototype')
    mkdirSync(prototypeFolder, { recursive: true })
    writeFileSync(path.join(prototypeFolder, 'Guide.prototype.json'), JSON.stringify({ title: 'Guide' }))
    writeFileSync(path.join(prototypeFolder, 'index.jsx'), 'export default function Guide() { return null }')
    writeFileSync(path.join(prototypeFolder, '.hypercanvas-artifact.json'), JSON.stringify({
      formatVersion: 1, id: 'underscore-guide-id', kind: 'prototype',
    }))

    const discovery = buildDataDiscovery(tmpDir, { contentOnly: true })
    expect(discovery.canvases['underscore-board-id']).toMatchObject({
      title: 'Underscore board', _route: '/canvas/Board',
    })
    expect(discovery.stories.Widget._route).toBe('/components/Widget')
    expect(discovery.prototypes._Guide).toBeUndefined()
    const { resolveStoryName } = await import('../canvas/isolation/storyRouteResolver.js')
    expect(resolveStoryName('/components/Widget', discovery.stories)).toBe('Widget')
  })

  it('keeps legacy source-repo underscore parser exclusions', () => {
    expect(parseDataFile('src/canvas/_Board.canvas.jsonl')).toBeNull()
    expect(parseDataFile('src/components/_Widget.story.jsx')).toBeNull()
  })

  it('uses the catalog route for a primary component story and resolves the actual isolated route', async () => {
    initializeNotebook(tmpDir, { title: 'Component route' })
    const componentFolder = path.join(tmpDir, 'Team', 'Widget.component')
    mkdirSync(componentFolder, { recursive: true })
    writeFileSync(path.join(componentFolder, '.hypercanvas-artifact.json'), JSON.stringify({
      formatVersion: 1, id: 'widget-component-id', kind: 'component',
    }))
    writeFileSync(path.join(componentFolder, 'Widget.story.jsx'), 'export const Default = () => null')
    writeFileSync(path.join(componentFolder, 'Widget.component.json'), JSON.stringify({ knobs: [] }))

    const discovery = buildDataDiscovery(tmpDir, { contentOnly: true })
    expect(discovery.stories.Widget._route).toBe('/components/Widget')

    const { resolveStoryName } = await import('../canvas/isolation/storyRouteResolver.js')
    expect(resolveStoryName('/components/Widget', discovery.stories)).toBe('Widget')
    expect(resolveStoryName('/components/Widget/Widget', discovery.stories)).toBeNull()
  })
})

describe('flow route inference', () => {
  it('injects _route for flows inside src/prototypes/', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'Dashboard'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'Dashboard', 'default.flow.json'),
      JSON.stringify({ title: 'Dashboard Flow' }),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('"_route":"/Dashboard"')
  })

  it('injects _route for flows inside .folder/ directories', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'MyFolder.folder', 'Example'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'MyFolder.folder', 'Example', 'basic.flow.json'),
      JSON.stringify({ title: 'Example Flow' }),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    // .folder/ should be stripped from the inferred route
    expect(code).toContain('"_route":"/Example"')
    expect(code).not.toContain('MyFolder')
  })

  it('injects _route with nested path for deeply placed flows', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'App', 'settings'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'App', 'settings', 'prefs.flow.json'),
      JSON.stringify({ title: 'Settings Prefs' }),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('"_route":"/App/settings"')
  })

  it('does NOT inject _route for global flows outside src/prototypes/', () => {
    mkdirSync(path.join(tmpDir, 'src', 'data'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'data', 'global.flow.json'),
      JSON.stringify({ title: 'Global Flow' }),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).not.toContain('"_route"')
  })

  it('does NOT inject _route when flow has explicit route field', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'Dashboard'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'Dashboard', 'custom.flow.json'),
      JSON.stringify({ route: '/custom-page', title: 'Custom Route' }),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    // Should have the explicit route but NOT _route
    expect(code).toContain('"route":"/custom-page"')
    expect(code).not.toContain('"_route"')
  })

  it('does not log info when multiple flows share the same route', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'Dashboard'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'Dashboard', 'happy.flow.json'),
      JSON.stringify({ title: 'Happy Path' }),
    )
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'Dashboard', 'error.flow.json'),
      JSON.stringify({ title: 'Error State' }),
    )

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const plugin = createPlugin()
    plugin.load(RESOLVED_ID)

    const routeLog = logSpy.mock.calls.find(call =>
      typeof call[0] === 'string' && call[0].includes('Route "/Dashboard" has 2 flows')
    )
    expect(routeLog).toBeUndefined()
    logSpy.mockRestore()
  })

  it('warns when multiple flows on same route have meta.default: true', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'Dashboard'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'Dashboard', 'a.flow.json'),
      JSON.stringify({ meta: { default: true }, title: 'A' }),
    )
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'Dashboard', 'b.flow.json'),
      JSON.stringify({ meta: { default: true }, title: 'B' }),
    )

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const plugin = createPlugin()
    plugin.load(RESOLVED_ID)

    const warnCall = warnSpy.mock.calls.find(call =>
      typeof call[0] === 'string' && call[0].includes('meta.default: true')
    )
    expect(warnCall).toBeTruthy()
    logSpy.mockRestore()
    warnSpy.mockRestore()
  })
})

describe('folder grouping', () => {
  it('discovers .folder.json files and keys them by folder directory name', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'Getting Started.folder'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'Getting Started.folder', 'getting-started.folder.json'),
      JSON.stringify({ meta: { title: 'Getting Started', description: 'Intro' } }),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('"Getting Started"')
    expect(code).toContain('"Intro"')
    expect(code).toContain('folders')
  })

  it('scopes prototypes inside .folder/ directories correctly', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'MyFolder.folder', 'Dashboard'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'MyFolder.folder', 'Dashboard', 'default.flow.json'),
      JSON.stringify({ title: 'Dashboard Default' }),
    )
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'MyFolder.folder', 'Dashboard', 'dashboard.prototype.json'),
      JSON.stringify({ meta: { title: 'Dashboard' } }),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    // Flow should be scoped to prototype, not folder
    expect(code).toContain('"Dashboard/default"')
    expect(code).not.toContain('"MyFolder.folder/default"')
    expect(code).not.toContain('"MyFolder/default"')
    // Prototype should have folder field injected
    expect(code).toContain('"folder":"MyFolder"')
  })

  it('scopes objects inside .folder/ directories to their prototype', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'X.folder', 'Proto'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'X.folder', 'Proto', 'helpers.object.json'),
      JSON.stringify({ util: true }),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    // Object should be scoped to prototype, not folder
    expect(code).toContain('"Proto/helpers"')
    expect(code).not.toContain('"X/helpers"')
  })

  it('scopes records inside .folder/ directories to their prototype', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'X.folder', 'Blog'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'X.folder', 'Blog', 'posts.record.json'),
      JSON.stringify([{ id: '1', title: 'Post' }]),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('"Blog/posts"')
    expect(code).not.toContain('"X/posts"')
  })

  it('keeps duplicate prototype-scoped flows out of the runtime index and reports their conflict', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'A.folder', 'Settings'), { recursive: true })
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'B.folder', 'Settings'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'A.folder', 'Settings', 'default.flow.json'),
      JSON.stringify({ from: 'A' }),
    )
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'B.folder', 'Settings', 'default.flow.json'),
      JSON.stringify({ from: 'B' }),
    )

    const discovery = buildDataDiscovery(tmpDir)
    expect(discovery.flows['Settings/default']).toBeUndefined()
    expect(discovery._dataScopeConflicts).toEqual([
      expect.objectContaining({ name: 'Settings/default', suffix: 'flow', paths: expect.any(Array) }),
    ])
  })

  it('throws on nested .folder/ directories', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'Outer.folder', 'Inner.folder', 'Proto'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'Outer.folder', 'Inner.folder', 'Proto', 'default.flow.json'),
      JSON.stringify({ title: 'Nested' }),
    )

    const plugin = createPlugin()
    expect(() => plugin.load(RESOLVED_ID)).toThrow(/Nested .folder directories are not supported/)
  })

  it('throws on empty nested .folder/ directories', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'Outer.folder', 'Inner.folder'), { recursive: true })

    const plugin = createPlugin()
    expect(() => plugin.load(RESOLVED_ID)).toThrow(/Nested .folder directories are not supported/)
  })
})

describe('underscore prefix ignoring', () => {
  it('ignores _-prefixed data files', () => {
    writeFileSync(
      path.join(tmpDir, '_draft.flow.json'),
      JSON.stringify({ title: 'Draft' }),
    )
    writeFileSync(
      path.join(tmpDir, 'visible.flow.json'),
      JSON.stringify({ title: 'Visible' }),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('"Visible"')
    expect(code).not.toContain('"Draft"')
  })

  it('ignores data files inside _-prefixed directories', () => {
    mkdirSync(path.join(tmpDir, '_archive'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, '_archive', 'old.flow.json'),
      JSON.stringify({ title: 'Archived' }),
    )
    writeFileSync(
      path.join(tmpDir, 'current.flow.json'),
      JSON.stringify({ title: 'Current' }),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('"Current"')
    expect(code).not.toContain('"Archived"')
  })

  it('ignores prototype.json inside _-prefixed directories', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', '_WIP'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', '_WIP', 'wip.prototype.json'),
      JSON.stringify({ meta: { title: 'Work in Progress' } }),
    )
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'Live'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'Live', 'live.prototype.json'),
      JSON.stringify({ meta: { title: 'Live' } }),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('"Live"')
    expect(code).not.toContain('"Work in Progress"')
  })

  it('does not ignore files with _ in the middle of the name', () => {
    writeFileSync(
      path.join(tmpDir, 'my_flow.flow.json'),
      JSON.stringify({ title: 'Has Underscore' }),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('"Has Underscore"')
  })
})

describe('resolveTemplateVars', () => {
  it('replaces variables in a simple string', () => {
    const result = resolveTemplateVars('/${currentDir}/page', { currentDir: 'src/data' })
    expect(result).toBe('/src/data/page')
  })

  it('replaces multiple variables in one string', () => {
    const result = resolveTemplateVars('${currentProto} in ${currentProtoDir}', {
      currentProto: 'src/prototypes/main.folder/Example',
      currentProtoDir: 'src/prototypes/main.folder',
    })
    expect(result).toBe('src/prototypes/main.folder/Example in src/prototypes/main.folder')
  })

  it('replaces variables in nested objects', () => {
    const input = {
      nav: { url: '/${currentDir}/page', label: 'Go' },
      meta: { proto: '${currentProto}' },
    }
    const vars = { currentDir: 'src/data', currentProto: 'src/prototypes/App' }
    const result = resolveTemplateVars(input, vars)

    expect(result.nav.url).toBe('/src/data/page')
    expect(result.nav.label).toBe('Go')
    expect(result.meta.proto).toBe('src/prototypes/App')
  })

  it('replaces variables in arrays', () => {
    const input = ['/${currentDir}/a', '/${currentDir}/b']
    const result = resolveTemplateVars(input, { currentDir: 'here' })
    expect(result).toEqual(['/here/a', '/here/b'])
  })

  it('replaces variables in deeply nested structures', () => {
    const input = {
      items: [
        { links: [{ url: '/${currentDir}/x' }] },
      ],
    }
    const result = resolveTemplateVars(input, { currentDir: 'deep' })
    expect(result.items[0].links[0].url).toBe('/deep/x')
  })

  it('does not modify non-string values', () => {
    const input = { count: 42, active: true, empty: null }
    const result = resolveTemplateVars(input, { currentDir: 'test' })
    expect(result).toEqual({ count: 42, active: true, empty: null })
  })

  it('returns input unchanged when no variables match', () => {
    const input = { url: '/static/path', name: 'no vars here' }
    const result = resolveTemplateVars(input, { currentDir: 'test' })
    expect(result).toEqual(input)
  })

  it('leaves unknown variable patterns as-is', () => {
    const result = resolveTemplateVars('${unknownVar}/path', { currentDir: 'test' })
    expect(result).toBe('${unknownVar}/path')
  })

  it('does not mutate the original object', () => {
    const input = { url: '/${currentDir}/page' }
    const original = JSON.parse(JSON.stringify(input))
    resolveTemplateVars(input, { currentDir: 'test' })
    expect(input).toEqual(original)
  })

  it('handles empty vars object', () => {
    const input = { url: '/${currentDir}/page' }
    const result = resolveTemplateVars(input, {})
    expect(result.url).toBe('/${currentDir}/page')
  })

  it('handles multiple occurrences of the same variable', () => {
    const result = resolveTemplateVars('${currentDir}/${currentDir}', { currentDir: 'x' })
    expect(result).toBe('x/x')
  })
})

describe('computeTemplateVars', () => {
  it('computes currentDir for a file in src/data/', () => {
    const root = '/project'
    const absPath = '/project/src/data/nav.object.json'
    const vars = computeTemplateVars(absPath, root)

    expect(vars.currentDir).toBe('src/data')
    expect(vars.currentProto).toBe('')
    expect(vars.currentProtoDir).toBe('')
  })

  it('computes all three vars for a file in a prototype inside a folder', () => {
    const root = '/project'
    const absPath = '/project/src/prototypes/main.folder/Example/sidenav.object.json'
    const vars = computeTemplateVars(absPath, root)

    expect(vars.currentDir).toBe('src/prototypes/main.folder/Example')
    expect(vars.currentProto).toBe('src/prototypes/main.folder/Example')
    expect(vars.currentProtoDir).toBe('src/prototypes/main.folder')
  })

  it('computes vars for a file in a subdirectory of a prototype', () => {
    const root = '/project'
    const absPath = '/project/src/prototypes/main.folder/Example/data/deep.object.json'
    const vars = computeTemplateVars(absPath, root)

    expect(vars.currentDir).toBe('src/prototypes/main.folder/Example/data')
    expect(vars.currentProto).toBe('src/prototypes/main.folder/Example')
    expect(vars.currentProtoDir).toBe('src/prototypes/main.folder')
  })

  it('computes vars for a file in a prototype without a folder', () => {
    const root = '/project'
    const absPath = '/project/src/prototypes/Dashboard/nav.object.json'
    const vars = computeTemplateVars(absPath, root)

    expect(vars.currentDir).toBe('src/prototypes/Dashboard')
    expect(vars.currentProto).toBe('src/prototypes/Dashboard')
    expect(vars.currentProtoDir).toBe('')
  })

  it('computes vars for a root-level file', () => {
    const root = '/project'
    const absPath = '/project/config.object.json'
    const vars = computeTemplateVars(absPath, root)

    expect(vars.currentDir).toBe('.')
    expect(vars.currentProto).toBe('')
    expect(vars.currentProtoDir).toBe('')
  })

  it('returns empty currentProto for a file directly inside a .folder (not in a prototype)', () => {
    const root = '/project'
    const absPath = '/project/src/prototypes/main.folder/nav.object.json'
    const vars = computeTemplateVars(absPath, root)

    expect(vars.currentDir).toBe('src/prototypes/main.folder')
    expect(vars.currentProto).toBe('')
    expect(vars.currentProtoDir).toBe('src/prototypes/main.folder')
  })
})

describe('template variable integration', () => {
  it('resolves ${currentDir} in object files', () => {
    mkdirSync(path.join(tmpDir, 'src', 'data'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'data', 'nav.object.json'),
      JSON.stringify({ url: '/${currentDir}/page' }),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('/src/data/page')
    expect(code).not.toContain('${currentDir}')
  })

  it('resolves ${currentProto} and ${currentProtoDir} in prototype files', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'App.folder', 'Dashboard'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'App.folder', 'Dashboard', 'nav.object.json'),
      JSON.stringify({
        proto: '${currentProto}',
        folder: '${currentProtoDir}',
        dir: '${currentDir}',
      }),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('src/prototypes/App.folder/Dashboard')
    expect(code).toContain('src/prototypes/App.folder')
    expect(code).not.toContain('${currentProto}')
    expect(code).not.toContain('${currentProtoDir}')
    expect(code).not.toContain('${currentDir}')
  })

  it('resolves variables in flow files', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'Example.folder', 'Demo'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'Example.folder', 'Demo', 'default.flow.json'),
      JSON.stringify({
        nav: [{ label: 'Home', url: '/${currentDir}' }],
      }),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('/src/prototypes/Example.folder/Demo')
    expect(code).not.toContain('${currentDir}')
  })

  it('resolves variables in record files', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'Blog'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'Blog', 'posts.record.json'),
      JSON.stringify([
        { id: '1', link: '/${currentProto}/post/1' },
      ]),
    )

    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('/src/prototypes/Blog/post/1')
    expect(code).not.toContain('${currentProto}')
  })

  it('warns when ${currentProto} is used outside a prototype', () => {
    mkdirSync(path.join(tmpDir, 'src', 'data'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'data', 'nav.object.json'),
      JSON.stringify({ url: '/${currentProto}/page' }),
    )

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const plugin = createPlugin()
    plugin.load(RESOLVED_ID)

    const warnCall = warnSpy.mock.calls.find(call =>
      typeof call[0] === 'string' && call[0].includes('${currentProto}')
    )
    expect(warnCall).toBeTruthy()
    warnSpy.mockRestore()
  })

  it('warns when ${currentProtoDir} is used outside a .folder', () => {
    mkdirSync(path.join(tmpDir, 'src', 'prototypes', 'Dashboard'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'prototypes', 'Dashboard', 'nav.object.json'),
      JSON.stringify({ folder: '${currentProtoDir}' }),
    )

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const plugin = createPlugin()
    plugin.load(RESOLVED_ID)

    const warnCall = warnSpy.mock.calls.find(call =>
      typeof call[0] === 'string' && call[0].includes('${currentProtoDir}')
    )
    expect(warnCall).toBeTruthy()
    warnSpy.mockRestore()
  })
})

// ── Canvas watcher / HMR tests ──────────────────────────────────────

describe('canvas watcher behavior', () => {
  /** Helper: create a mock Vite dev server for configureServer */
  function createMockServer(root) {
    const listeners = {}
    const wsSent = []
    const invalidatedModules = []
    const middlewareHandlers = []

    return {
      wsSent,
      invalidatedModules,
      listeners,
      config: { root, base: '/' },
      watcher: {
        add: vi.fn(),
        unwatch: vi.fn(),
        on(event, fn) {
          if (!listeners[event]) listeners[event] = []
          listeners[event].push(fn)
        },
      },
      moduleGraph: {
        getModuleById(id) {
          if (id === RESOLVED_ID) return { id: RESOLVED_ID }
          return null
        },
        invalidateModule(mod) {
          invalidatedModules.push(mod.id)
        },
      },
      ws: {
        send(msg) { wsSent.push(msg) },
      },
      middlewares: {
        handlers: middlewareHandlers,
        use(fn) { middlewareHandlers.push(fn) },
      },
    }
  }

  /** Emit a watcher event on the mock server */
  function emit(server, event, filePath) {
    for (const fn of (server.listeners[event] || [])) {
      fn(filePath)
    }
  }

  it('reconciles all story metadata on edit, primary removal, and last-story removal', () => {
    const notebookRoot = path.join(tmpDir, 'story-notebook')
    initializeNotebook(notebookRoot, { title: 'Stories' })
    const component = path.join(notebookRoot, 'Card.component')
    mkdirSync(component)
    const first = path.join(component, 'a.stories.tsx')
    const second = path.join(component, 'b.story.jsx')
    writeFileSync(first, 'export const Primary = {}')
    writeFileSync(second, 'export function Secondary() { return null }')
    const previousRoot = process.env.HYPERCANVAS_NOTEBOOK_ROOT
    process.env.HYPERCANVAS_NOTEBOOK_ROOT = notebookRoot
    try {
      const plugin = createPlugin(tmpDir)
      plugin.load(RESOLVED_ID)
      const server = createMockServer(tmpDir)
      plugin.configureServer(server)
      const latest = () => server.wsSent.filter(message => message.event === 'storyboard:story-file-changed').at(-1).data
      writeFileSync(first, 'export const Updated = {}')
      emit(server, 'change', first)
      expect(latest().stories.Card).toMatchObject({ _exportNames: ['Updated'], _route: '/components/Card' })
      expect(latest().changedModule).toBe(latest().stories.Card._storyModule)
      rmSync(first)
      emit(server, 'unlink', first)
      expect(Object.keys(latest().stories)).toEqual(['Card'])
      expect(latest().stories.Card).toMatchObject({ _exportNames: ['Secondary'], _route: '/components/Card' })
      rmSync(second)
      emit(server, 'unlink', second)
      expect(latest().stories).toEqual({})
      expect(server.wsSent.filter(message => message.type === 'full-reload')).toEqual([])
    } finally {
      if (previousRoot === undefined) delete process.env.HYPERCANVAS_NOTEBOOK_ROOT
      else process.env.HYPERCANVAS_NOTEBOOK_ROOT = previousRoot
    }
  })

  it('keeps unchanged client story imports while reconciling edits, promotion and removal', () => {
    const code = createPlugin(tmpDir).load(RESOLVED_ID)
    const clientPatch = code.slice(code.indexOf('// Live-patch canvas data'), code.indexOf('// Filesystem watcher updates'))
      .replaceAll('import.meta.env.BASE_URL', JSON.stringify('/branch--hmr/'))
    const first = { _storyModule: '/src/first.story.jsx', _exportNames: ['Counter'], _storyImport: vi.fn() }
    const second = { _storyModule: '/src/second.story.jsx', _exportNames: ['Other'], _storyImport: vi.fn() }
    const stories = { First: first, Second: second }
    const listeners = new Map()
    const init = vi.fn()
    const document = { dispatchEvent: vi.fn() }
    const window = { location: { origin: 'http://localhost' }, addEventListener: (name, listener) => listeners.set(name, listener) }
    class CustomEvent { constructor(type) { this.type = type } }
    // Execute the emitted listener, including its real reconciliation logic.
    new Function('window', 'document', 'CustomEvent', 'init', 'initKnobs', 'stories', `
      const flows = {}, objects = {}, records = {}, prototypes = {}, folders = {}, canvases = {}, scopeAliases = {}, prototypeKnobs = {}, componentKnobs = {};
      ${clientPatch}
    `)(window, document, CustomEvent, init, vi.fn(), stories)
    const publish = data => listeners.get('storyboard:story-file-changed')({ detail: data })
    const metadata = entry => JSON.parse(JSON.stringify(entry))
    publish({ stories: { First: metadata(first), Second: metadata(second) }, changedModule: second._storyModule, timestamp: 1 })
    expect(stories.First).toBe(first)
    expect(stories.First._storyImport).toBe(first._storyImport)
    expect(stories.Second).not.toBe(second)
    expect(stories.Second._storyImport).not.toBe(second._storyImport)
    publish({ stories: { First: metadata(second) }, changedModule: first._storyModule, timestamp: 2 })
    expect(Object.keys(stories)).toEqual(['First'])
    expect(stories.First._storyModule).toBe(second._storyModule)
    expect(stories.First._storyImport).not.toBe(first._storyImport)
    publish({ stories: {}, changedModule: second._storyModule, timestamp: 3 })
    expect(stories).toEqual({})
    expect(init).toHaveBeenCalledTimes(3)
    expect(document.dispatchEvent).toHaveBeenCalledTimes(3)
  })

  function writeCanvasFile(dir, name, title) {
    const canvasDir = path.join(dir, 'src', 'canvas')
    mkdirSync(canvasDir, { recursive: true })
    const evt = { event: 'canvas_created', title: title || name, timestamp: Date.now() }
    writeFileSync(path.join(canvasDir, `${name}.canvas.jsonl`), JSON.stringify(evt) + '\n')
  }

  function embeddedConfig(code) {
    const line = code.split('\n').find(entry => entry.startsWith('initConfig('))
    expect(line).toBeDefined()
    return JSON.parse(line.slice('initConfig('.length, -1))
  }

  async function invokeMiddleware(server, req) {
    const response = {
      statusCode: 200,
      headers: null,
      body: '',
      writeHead(statusCode, headers) {
        this.statusCode = statusCode
        this.headers = headers
      },
      end(body = '') { this.body += body },
    }
    const request = {
      ...req,
      [Symbol.asyncIterator]: async function* () {
        if (req.body) yield req.body
      },
    }
    for (const handler of server.middlewares.handlers) {
      let passed = false
      await handler(request, response, () => { passed = true })
      if (!passed) break
    }
    return response
  }

  it.each(['/', '/branch--preview/'])('inlines the canonical Notebook theming registry in story frames at %s', async base => {
    writeFileSync(path.join(tmpDir, 'hypercanvas.config.json'), JSON.stringify({
      theming: {
        themes: { light: { label: 'Notebook light' }, dark: { label: 'Notebook dark', attrs: { 'data-color-mode': 'dark' } } },
        surfaces: { prototype: { sync: true } }, default: 'light',
      },
    }))
    const plugin = createPlugin(tmpDir)
    const server = createMockServer(tmpDir)
    server.config.base = base
    server.transformIndexHtml = vi.fn(async (_url, html) => html)
    plugin.configureServer(server)
    const response = await invokeMiddleware(server, { url: `${base}stories.html/components/Button?_sb_embed&_sb_theme_target=prototype&theme=dark`, method: 'GET' })
    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('Notebook dark')
    expect(response.body).toContain('data-color-mode')
  })

  it('reads and writes storyboard.config.json in the external Notebook root', async () => {
    const notebookRoot = path.join(tmpDir, 'notebook')
    mkdirSync(notebookRoot, { recursive: true })
    writeFileSync(
      path.join(notebookRoot, 'storyboard.config.json'),
      '{\n  "featureFlags": {\n    "fromNotebook": false\n  }\n}\n',
    )
    const previousRoot = process.env.HYPERCANVAS_NOTEBOOK_ROOT
    process.env.HYPERCANVAS_NOTEBOOK_ROOT = notebookRoot

    try {
      const plugin = createPlugin(tmpDir)
      const server = createMockServer(tmpDir)
      plugin.configureServer(server)

      const getResponse = await invokeMiddleware(server, { method: 'GET', url: '/_hypercanvas/config' })
      expect(getResponse.statusCode).toBe(200)
      expect(JSON.parse(getResponse.body).raw).toContain('fromNotebook')

      const putResponse = await invokeMiddleware(server, {
        method: 'PUT',
        url: '/_hypercanvas/config',
        body: JSON.stringify({ updates: { 'featureFlags.fromNotebook': true } }),
      })
      expect(putResponse.statusCode).toBe(200)
      expect(JSON.parse(readFileSync(path.join(notebookRoot, 'storyboard.config.json'), 'utf8')).featureFlags.fromNotebook).toBe(true)
      expect(existsSync(path.join(tmpDir, 'storyboard.config.json'))).toBe(false)
    } finally {
      if (previousRoot === undefined) delete process.env.HYPERCANVAS_NOTEBOOK_ROOT
      else process.env.HYPERCANVAS_NOTEBOOK_ROOT = previousRoot
    }
  })

  it('reads, watches, and writes grouped application and domain config without a root shadow', async () => {
    const applicationRoot = path.join(tmpDir, 'application')
    const notebookRoot = path.join(tmpDir, 'grouped-notebook')
    const configDirectory = path.join(notebookRoot, 'config')
    mkdirSync(configDirectory, { recursive: true })
    const appPath = path.join(configDirectory, 'hypercanvas.config.json')
    const toolbarPath = path.join(configDirectory, 'toolbar.config.json')
    writeFileSync(appPath, '{\n  // grouped app config\n  "sidebarIgnored": [],\n  "featureFlags": {"grouped": true}\n}\n')
    writeFileSync(toolbarPath, JSON.stringify({ tools: { groupedTool: { label: 'Grouped toolbar' } } }))
    const runtime = {
      status: () => ({ active: true, root: notebookRoot }),
      resolveAppConfigWritePath: () => appPath,
    }
    const plugin = storyboardDataPlugin({ notebookRuntime: runtime })
    plugin.configResolved({ root: applicationRoot })
    const server = createMockServer(applicationRoot)
    plugin.configureServer(server)

    const resolved = embeddedConfig(plugin.load(RESOLVED_ID))
    expect(resolved.sidebarIgnored).toEqual([])
    expect(resolved.toolbar.tools.groupedTool.label).toBe('Grouped toolbar')
    expect(server.watcher.add).toHaveBeenCalledWith(appPath)
    expect(server.watcher.add).toHaveBeenCalledWith(toolbarPath)

    const getResponse = await invokeMiddleware(server, { method: 'GET', url: '/_hypercanvas/config' })
    expect(getResponse.statusCode).toBe(200)
    expect(JSON.parse(getResponse.body).raw).toContain('// grouped app config')
    const putResponse = await invokeMiddleware(server, {
      method: 'PUT', url: '/_hypercanvas/config',
      body: JSON.stringify({ updates: { 'featureFlags.grouped': false } }),
    })
    expect(putResponse.statusCode).toBe(200)
    expect(parseJsonc(readFileSync(appPath, 'utf8')).featureFlags.grouped).toBe(false)
    expect(existsSync(path.join(notebookRoot, 'hypercanvas.config.json'))).toBe(false)

    writeFileSync(toolbarPath, JSON.stringify({ tools: { groupedTool: { label: 'Updated grouped toolbar' } } }))
    emit(server, 'change', toolbarPath)
    expect(server.invalidatedModules).toContain(RESOLVED_ID)
    expect(embeddedConfig(plugin.load(RESOLVED_ID)).toolbar.tools.groupedTool.label).toBe('Updated grouped toolbar')
  })

  it('invalidates package toolbar defaults and Notebook toolbar add/unlink before page refresh', () => {
    const applicationRoot = path.join(tmpDir, 'application')
    const packageConfigPath = path.join(applicationRoot, 'packages', 'storyboard', 'toolbar.config.json')
    const notebookRoot = path.join(tmpDir, 'active-notebook')
    const notebookConfigPath = path.join(notebookRoot, 'toolbar.config.json')
    mkdirSync(path.dirname(packageConfigPath), { recursive: true })

    const writeToolbar = (filePath, icon, meta, label) => writeFileSync(filePath, JSON.stringify({
      tools: {
        'canvas-snap': { icon, meta, label },
      },
    }))
    writeToolbar(packageConfigPath, 'primer/apps', { strokeWeight: 2, scale: 1 }, 'Package default')
    initializeNotebook(notebookRoot, { id: 'toolbar-inheritance', configRoot: applicationRoot })
    moveNotebookConfigToRoot(notebookRoot)
    // Model a Notebook where the user removed the generated override so the
    // runtime inherits package defaults and observes subsequent add/unlink.
    rmSync(notebookConfigPath)
    expect(existsSync(notebookConfigPath)).toBe(false)

    const plugin = storyboardDataPlugin({ notebookRuntime: { status: () => ({ root: notebookRoot }) } })
    plugin.configResolved({ root: applicationRoot })
    const server = createMockServer(applicationRoot)
    plugin.configureServer(server)

    const initial = embeddedConfig(plugin.load(RESOLVED_ID))
    expect(initial.toolbar.tools['canvas-snap']).toMatchObject({ icon: 'primer/apps', label: 'Package default' })
    expect(server.watcher.add).toHaveBeenCalledWith(packageConfigPath)

    // Editing the package default must invalidate a warmed virtual module. A
    // normal page refresh then reads this latest package value, not the
    // previous in-memory buildResult.
    writeToolbar(packageConfigPath, 'primer/home-fill', { strokeWeight: 1, scale: 4 }, 'Updated package default')
    emit(server, 'change', packageConfigPath)
    expect(server.invalidatedModules).toContain(RESOLVED_ID)
    expect(server.wsSent.some(message => message.type === 'full-reload' && message.path === packageConfigPath)).toBe(true)

    let refreshed = embeddedConfig(plugin.load(RESOLVED_ID))
    expect(refreshed.toolbar.tools['canvas-snap']).toMatchObject({
      icon: 'primer/home-fill',
      meta: { strokeWeight: 1, scale: 4 },
      label: 'Updated package default',
    })
    expect(plugin.load(RESOLVED_ID)).toContain('setClientToolbarOverrides(null)')

    // A new Notebook override is higher priority than the package value.
    writeToolbar(notebookConfigPath, 'iconoir/perspective-view', { strokeWeight: 3, scale: 0.7 }, 'Notebook override')
    const explicitOverride = readFileSync(notebookConfigPath, 'utf8')
    initializeNotebook(notebookRoot, { configRoot: applicationRoot })
    expect(readFileSync(notebookConfigPath, 'utf8')).toBe(explicitOverride)
    emit(server, 'add', notebookConfigPath)
    expect(server.wsSent.some(message => message.type === 'full-reload' && message.path === notebookConfigPath)).toBe(true)
    refreshed = embeddedConfig(plugin.load(RESOLVED_ID))
    expect(refreshed.toolbar.tools['canvas-snap']).toMatchObject({ icon: 'iconoir/perspective-view', label: 'Notebook override' })
    expect(plugin.load(RESOLVED_ID)).toContain('setClientToolbarOverrides({"tools":{"canvas-snap"')

    // In-place edits of the override must take effect on refresh too.
    writeToolbar(notebookConfigPath, 'primer/search', { strokeWeight: 2, scale: 1.1 }, 'Changed Notebook override')
    emit(server, 'change', notebookConfigPath)
    expect(server.wsSent.some(message => message.type === 'full-reload' && message.path === notebookConfigPath)).toBe(true)
    refreshed = embeddedConfig(plugin.load(RESOLVED_ID))
    expect(refreshed.toolbar.tools['canvas-snap']).toMatchObject({
      icon: 'primer/search',
      meta: { strokeWeight: 2, scale: 1.1 },
      label: 'Changed Notebook override',
    })

    // Removing the override restores current package defaults, including the
    // just-edited icon metadata, and explicitly clears any pending client override.
    rmSync(notebookConfigPath)
    emit(server, 'unlink', notebookConfigPath)
    expect(server.wsSent.some(message => message.type === 'full-reload' && message.path === notebookConfigPath)).toBe(true)
    refreshed = embeddedConfig(plugin.load(RESOLVED_ID))
    expect(refreshed.toolbar.tools['canvas-snap']).toMatchObject({
      icon: 'primer/home-fill',
      meta: { strokeWeight: 1, scale: 4 },
      label: 'Updated package default',
    })
    expect(plugin.load(RESOLVED_ID)).toContain('setClientToolbarOverrides(null)')
  })

  it('suppresses first-time sibling-order config reload independently across data and Notebook watchers', async () => {
    const applicationRoot = path.join(tmpDir, 'application')
    const notebookRoot = path.join(tmpDir, 'active-notebook')
    const primaryConfigPath = path.join(notebookRoot, 'hypercanvas.config.json')
    const legacyConfigPath = path.join(notebookRoot, 'storyboard.config.json')
    mkdirSync(notebookRoot, { recursive: true })
    writeFileSync(legacyConfigPath, '{\n  "featureFlags": {"keep": true}\n}\n')
    const runtime = {
      status: () => ({ active: true, root: notebookRoot, generation: 11, notebook: { manifest: { id: 'nb-test' } } }),
      watchPaths: () => [notebookRoot],
      resolveAppConfigWritePath: () => existsSync(primaryConfigPath) ? primaryConfigPath : legacyConfigPath,
    }
    const server = createMockServer(applicationRoot)
    server.config.server = { fs: { allow: [] } }
    server.httpServer = new EventEmitter()

    const dataPlugin = storyboardDataPlugin({ notebookRuntime: runtime })
    dataPlugin.configResolved({ root: applicationRoot })
    dataPlugin.configureServer(server)
    const runtimePlugin = notebookRuntimePlugin({ runtime, filesystemGrants: { resolveDirectory: () => notebookRoot } })
    runtimePlugin.configureServer(server)

    const internalWrite = await invokeMiddleware(server, {
      method: 'PUT',
      url: '/_hypercanvas/config',
      body: JSON.stringify({ updates: { 'notebook.siblingOrder': { '': [] } } }),
    })
    expect(internalWrite.statusCode).toBe(200)
    emit(server, 'change', legacyConfigPath)
    expect(server.wsSent.some(message => message.type === 'full-reload')).toBe(false)
    expect(server.invalidatedModules).not.toContain(RESOLVED_ID)
    expect(server.wsSent.filter(message => message.event === 'storyboard:notebook-order-changed')).toHaveLength(1)

    writeFileSync(primaryConfigPath, '{\n  "featureFlags": {"keep": true},\n  "notebook": {"siblingOrder": {"": [{"kind":"folder","path":"canvas"}]}}\n}\n')
    emit(server, 'add', primaryConfigPath)
    expect(server.wsSent.some(message => message.type === 'full-reload')).toBe(false)
    expect(server.invalidatedModules).not.toContain(RESOLVED_ID)
    expect(server.wsSent.filter(message => message.event === 'storyboard:notebook-order-changed')).toHaveLength(2)

    writeFileSync(primaryConfigPath, '{\n  "featureFlags": {"keep": true},\n  "notebook": {"siblingOrder": {"": []}}\n}\n')
    emit(server, 'change', primaryConfigPath)
    expect(server.wsSent.some(message => message.type === 'full-reload')).toBe(false)
    expect(server.invalidatedModules).not.toContain(RESOLVED_ID)
    expect(server.wsSent.filter(message => message.event === 'storyboard:notebook-order-changed')).toHaveLength(3)

    const toolbarPath = path.join(notebookRoot, 'toolbar.config.json')
    writeFileSync(toolbarPath, '{"tools":{}}\n')
    emit(server, 'change', toolbarPath)
    expect(server.wsSent.some(message => message.type === 'full-reload')).toBe(true)
    expect(server.invalidatedModules).toContain(RESOLVED_ID)
  })

  it('soft-invalidates virtual module on canvas content change (no full-reload)', () => {
    writeCanvasFile(tmpDir, 'test-canvas', 'Original Title')
    const plugin = createPlugin()
    // Force initial buildResult
    plugin.load(RESOLVED_ID)

    const server = createMockServer(tmpDir)
    plugin.configureServer(server)

    // Simulate a canvas file content change
    const canvasPath = path.join(tmpDir, 'src', 'canvas', 'test-canvas.canvas.jsonl')
    emit(server, 'change', canvasPath)

    // Should have sent custom HMR event (not full-reload)
    const customEvents = server.wsSent.filter(m => m.type === 'custom')
    const fullReloads = server.wsSent.filter(m => m.type === 'full-reload')

    expect(customEvents.length).toBe(1)
    expect(customEvents[0].event).toBe('storyboard:canvas-file-changed')
    expect(customEvents[0].data.canvasId).toBe('test-canvas')
    expect(fullReloads.length).toBe(0)

    // Should have invalidated the virtual module
    expect(server.invalidatedModules).toContain(RESOLVED_ID)
  })

  it('ignores only atomic canvas staging files across watcher add, change, and unlink events', () => {
    const plugin = createPlugin()
    plugin.load(RESOLVED_ID)
    const server = createMockServer(tmpDir)
    plugin.configureServer(server)
    const stagingPath = path.join(tmpDir, 'src', 'canvas', 'test.canvas.jsonl.61742559-4bd6-49d1-af4d-17aac594772c.tmp')

    emit(server, 'add', stagingPath)
    emit(server, 'change', stagingPath)
    emit(server, 'unlink', stagingPath)

    expect(server.wsSent).toEqual([])
    expect(server.invalidatedModules).not.toContain(RESOLVED_ID)
  })

  it('includes metadata in HMR event for canvas content changes', () => {
    writeCanvasFile(tmpDir, 'meta-canvas', 'My Canvas Title')
    const plugin = createPlugin()
    plugin.load(RESOLVED_ID)

    const server = createMockServer(tmpDir)
    plugin.configureServer(server)

    emit(server, 'change', path.join(tmpDir, 'src', 'canvas', 'meta-canvas.canvas.jsonl'))

    const event = server.wsSent.find(m => m.type === 'custom')
    expect(event.data.metadata).toBeDefined()
    expect(event.data.metadata.title).toBe('My Canvas Title')
  })

  it('soft-invalidates on canvas file add (new canvas)', () => {
    const plugin = createPlugin()
    plugin.load(RESOLVED_ID)

    const server = createMockServer(tmpDir)
    plugin.configureServer(server)

    // Create the file after the server is configured
    writeCanvasFile(tmpDir, 'new-canvas', 'Brand New')
    emit(server, 'add', path.join(tmpDir, 'src', 'canvas', 'new-canvas.canvas.jsonl'))

    const customEvents = server.wsSent.filter(m => m.type === 'custom')
    const fullReloads = server.wsSent.filter(m => m.type === 'full-reload')

    expect(customEvents.length).toBe(1)
    expect(customEvents[0].data.canvasId).toBe('new-canvas')
    expect(customEvents[0].data.metadata).toBeDefined()
    expect(fullReloads.length).toBe(0)
    expect(server.invalidatedModules).toContain(RESOLVED_ID)
  })

  it('keeps external Notebook canvas IDs content-relative in watcher events', () => {
    const notebookRoot = path.join(tmpDir, 'notebook')
    const canvasDir = path.join(notebookRoot, 'canvas')
    mkdirSync(canvasDir, { recursive: true })
    const canvasPath = path.join(canvasDir, 'welcome.canvas.jsonl')
    writeFileSync(canvasPath, `${JSON.stringify({ event: 'canvas_created', title: 'Welcome Canvas' })}\n`)
    const previousRoot = process.env.HYPERCANVAS_NOTEBOOK_ROOT
    process.env.HYPERCANVAS_NOTEBOOK_ROOT = notebookRoot

    try {
      const plugin = createPlugin(tmpDir)
      plugin.load(RESOLVED_ID)
      const server = createMockServer(tmpDir)
      plugin.configureServer(server)

      emit(server, 'add', canvasPath)

      const event = server.wsSent.find(message => message.type === 'custom')
      expect(event.data.canvasId).toBe('welcome')
      expect(event.data.canvasId).not.toBe('canvas/welcome')
    } finally {
      if (previousRoot === undefined) delete process.env.HYPERCANVAS_NOTEBOOK_ROOT
      else process.env.HYPERCANVAS_NOTEBOOK_ROOT = previousRoot
    }
  })

  it('soft-invalidates on canvas file unlink after timeout (true delete)', async () => {
    writeCanvasFile(tmpDir, 'doomed-canvas', 'Gone Soon')
    const plugin = createPlugin()
    plugin.load(RESOLVED_ID)

    const server = createMockServer(tmpDir)
    plugin.configureServer(server)

    emit(server, 'unlink', path.join(tmpDir, 'src', 'canvas', 'doomed-canvas.canvas.jsonl'))

    // Immediately after unlink — no event yet (deferred by 1500ms)
    expect(server.wsSent.length).toBe(0)

    // Wait for deferred timer
    await new Promise(resolve => setTimeout(resolve, 1600))

    const customEvents = server.wsSent.filter(m => m.type === 'custom')
    expect(customEvents.length).toBe(1)
    expect(customEvents[0].data.canvasId).toBe('doomed-canvas')
    expect(customEvents[0].data.removed).toBe(true)
    expect(server.invalidatedModules).toContain(RESOLVED_ID)
  })

  it('cancels deferred unlink on add (atomic write / in-place save)', async () => {
    writeCanvasFile(tmpDir, 'saved-canvas', 'Saved')
    const plugin = createPlugin()
    plugin.load(RESOLVED_ID)

    const server = createMockServer(tmpDir)
    plugin.configureServer(server)

    const canvasPath = path.join(tmpDir, 'src', 'canvas', 'saved-canvas.canvas.jsonl')

    // Simulate atomic write: unlink then add within 1500ms
    emit(server, 'unlink', canvasPath)
    emit(server, 'add', canvasPath)

    // Should have sent one event immediately (the add cancelling the unlink)
    const customEvents = server.wsSent.filter(m => m.type === 'custom')
    expect(customEvents.length).toBe(1)
    expect(customEvents[0].data.canvasId).toBe('saved-canvas')
    expect(customEvents[0].data.removed).toBeUndefined()
    expect(server.invalidatedModules).toContain(RESOLVED_ID)

    // Wait past the unlink timer — should NOT get a second event
    await new Promise(resolve => setTimeout(resolve, 1600))
    const allCustom = server.wsSent.filter(m => m.type === 'custom')
    expect(allCustom.length).toBe(1)
  })

  it('does not full-reload notebook prototype routes after ordinary source edits', () => {
    const notebookRoot = path.join(tmpDir, 'external-notebook')
    const prototypeRoot = path.join(notebookRoot, 'prototypes', 'Landing')
    mkdirSync(prototypeRoot, { recursive: true })
    writeFileSync(path.join(prototypeRoot, 'index.jsx'), 'export default function Landing() {}')

    const plugin = storyboardDataPlugin({
      notebookRuntime: { status: () => ({ root: notebookRoot }) },
    })
    plugin.configResolved({ root: tmpDir })
    const server = createMockServer(tmpDir)
    plugin.configureServer(server)
    const fullReloads = () => server.wsSent.filter(message => message.type === 'full-reload')

    for (const filename of ['index.jsx', 'widget.tsx', 'helper.mjs', 'style.css']) {
      emit(server, 'change', path.join(prototypeRoot, filename))
    }
    expect(fullReloads()).toHaveLength(0)

    emit(server, 'change', path.join(prototypeRoot, 'success.flow.json'))
    expect(fullReloads().length).toBeGreaterThan(0)

    server.wsSent.length = 0
    emit(server, 'add', path.join(prototypeRoot, 'New.jsx'))
    expect(fullReloads().length).toBeGreaterThan(0)

    server.wsSent.length = 0
    emit(server, 'unlink', path.join(prototypeRoot, 'Old.jsx'))
    expect(fullReloads().length).toBeGreaterThan(0)

    server.wsSent.length = 0
    const stagingFile = path.join(prototypeRoot, 'demo.canvas.jsonl.61742559-4bd6-49d1-af4d-17aac594772c.tmp')
    emit(server, 'add', stagingFile)
    emit(server, 'change', stagingFile)
    emit(server, 'unlink', stagingFile)
    expect(fullReloads()).toHaveLength(0)
  })

  it('watches only the active external Notebook root for nested data and marker changes', () => {
    const applicationRoot = path.join(tmpDir, 'application')
    const firstRoot = path.join(tmpDir, 'notebooks', 'first')
    const secondRoot = path.join(tmpDir, 'notebooks', 'second')
    initializeNotebook(firstRoot, { title: 'First Notebook' })
    initializeNotebook(secondRoot, { title: 'Second Notebook' })
    let activeRoot = firstRoot
    const runtime = { status: () => ({ root: activeRoot }) }
    const dataPlugin = storyboardDataPlugin({ notebookRuntime: runtime })
    dataPlugin.configResolved({ root: applicationRoot })
    expect(dataPlugin.load(RESOLVED_ID)).not.toContain('Account/default')

    const routePlugin = notebookRoutesPlugin({ runtime })
    const server = createMockServer(applicationRoot)
    routePlugin.configureServer(server)
    dataPlugin.configureServer(server)
    expect(server.watcher.add).toHaveBeenCalledWith(firstRoot)
    dataPlugin.load(RESOLVED_ID)
    expect(server.watcher.add.mock.calls.filter(([watched]) => watched === firstRoot)).toHaveLength(1)

    const prototypeFolder = path.join(firstRoot, 'Team', 'Portfolio', 'Account.prototype')
    mkdirSync(prototypeFolder, { recursive: true })
    writeFileSync(path.join(prototypeFolder, '.hypercanvas-artifact.json'), JSON.stringify({
      formatVersion: 1, id: 'account-marker', kind: 'prototype',
    }))
    emit(server, 'add', path.join(prototypeFolder, '.hypercanvas-artifact.json'))
    expect(server.wsSent.filter(message => message.type === 'full-reload')).toHaveLength(1)

    writeFileSync(path.join(prototypeFolder, 'index.jsx'), 'export default function Account() { return null }')
    emit(server, 'add', path.join(prototypeFolder, 'index.jsx'))
    expect(server.wsSent.filter(message => message.type === 'full-reload')).toHaveLength(2)

    writeFileSync(path.join(prototypeFolder, 'default.flow.json'), JSON.stringify({ message: 'Scoped account flow data' }))
    emit(server, 'add', path.join(prototypeFolder, 'default.flow.json'))
    expect(server.wsSent.filter(message => message.type === 'full-reload')).toHaveLength(3)
    expect(dataPlugin.load(RESOLVED_ID)).toContain('Account/default')
    expect(dataPlugin.load(RESOLVED_ID)).toContain('Scoped account flow data')

    writeFileSync(path.join(prototypeFolder, 'default.flow.json'), JSON.stringify({ message: 'Updated account flow data' }))
    emit(server, 'change', path.join(prototypeFolder, 'default.flow.json'))
    expect(server.wsSent.filter(message => message.type === 'full-reload')).toHaveLength(4)
    expect(dataPlugin.load(RESOLVED_ID)).toContain('Updated account flow data')

    rmSync(path.join(prototypeFolder, 'default.flow.json'))
    emit(server, 'unlink', path.join(prototypeFolder, 'default.flow.json'))
    expect(server.wsSent.filter(message => message.type === 'full-reload')).toHaveLength(5)
    expect(dataPlugin.load(RESOLVED_ID)).not.toContain('Updated account flow data')

    const invalidationsBeforeMarkerChange = server.invalidatedModules.length
    const reloadsBeforeMarkerChange = server.wsSent.filter(message => message.type === 'full-reload').length
    writeFileSync(path.join(prototypeFolder, '.hypercanvas-artifact.json'), JSON.stringify({
      formatVersion: 1, id: 'account-marker-updated', kind: 'prototype',
    }))
    emit(server, 'change', path.join(prototypeFolder, '.hypercanvas-artifact.json'))
    expect(server.invalidatedModules.length).toBeGreaterThan(invalidationsBeforeMarkerChange)
    expect(server.wsSent.filter(message => message.type === 'full-reload')).toHaveLength(reloadsBeforeMarkerChange + 1)
    expect(dataPlugin.load(RESOLVED_ID)).toContain('account-marker-updated')

    const invalidationsBeforeMarkerUnlink = server.invalidatedModules.length
    const reloadsBeforeMarkerUnlink = server.wsSent.filter(message => message.type === 'full-reload').length
    rmSync(path.join(prototypeFolder, '.hypercanvas-artifact.json'))
    emit(server, 'unlink', path.join(prototypeFolder, '.hypercanvas-artifact.json'))
    expect(server.invalidatedModules.length).toBeGreaterThan(invalidationsBeforeMarkerUnlink)
    expect(server.wsSent.filter(message => message.type === 'full-reload')).toHaveLength(reloadsBeforeMarkerUnlink + 1)
    expect(dataPlugin.load(RESOLVED_ID)).not.toContain('account-marker-updated')

    const unrelatedInvalidations = server.invalidatedModules.length
    const unrelatedReloads = server.wsSent.filter(message => message.type === 'full-reload').length
    const readme = path.join(prototypeFolder, 'README.md')
    const asset = path.join(prototypeFolder, 'logo.svg')
    const style = path.join(prototypeFolder, 'style.css')
    writeFileSync(readme, 'Notes')
    writeFileSync(asset, '<svg/>')
    writeFileSync(style, '.account { color: red }')
    emit(server, 'add', readme)
    emit(server, 'add', asset)
    emit(server, 'add', style)
    emit(server, 'change', path.join(prototypeFolder, 'index.jsx'))
    expect(server.invalidatedModules).toHaveLength(unrelatedInvalidations)
    expect(server.wsSent.filter(message => message.type === 'full-reload')).toHaveLength(unrelatedReloads)

    activeRoot = secondRoot
    expect(dataPlugin.load(RESOLVED_ID)).not.toContain('Account/default')
    expect(server.watcher.unwatch).toHaveBeenCalledWith(firstRoot)
    expect(server.watcher.add).toHaveBeenCalledWith(secondRoot)
    expect(server.watcher.add.mock.calls.filter(([watched]) => watched === secondRoot)).toHaveLength(1)

    const afterRebindInvalidations = server.invalidatedModules.length
    const staleRootFlow = path.join(prototypeFolder, 'inactive.flow.json')
    writeFileSync(staleRootFlow, JSON.stringify({ message: 'inactive' }))
    emit(server, 'add', staleRootFlow)
    expect(server.invalidatedModules).toHaveLength(afterRebindInvalidations)
    expect(server.wsSent.filter(message => message.type === 'full-reload')).toHaveLength(reloadsBeforeMarkerUnlink + 1)
    expect(dataPlugin.load(RESOLVED_ID)).not.toContain('inactive')
  })

  it('handleHotUpdate returns empty array for canvas files (suppresses full-reload)', () => {
    const plugin = createPlugin()
    const result = plugin.handleHotUpdate({
      file: path.join(tmpDir, 'src', 'canvas', 'test.canvas.jsonl'),
      server: createMockServer(tmpDir),
      modules: [],
    })
    expect(result).toEqual([])
  })

  it('suppresses Vite fallback reload only for UUID-named atomic canvas replacement temp files', () => {
    const plugin = createPlugin()
    const stagingResult = plugin.handleHotUpdate({
      file: path.join(tmpDir, 'src', 'canvas', 'test.canvas.jsonl.61742559-4bd6-49d1-af4d-17aac594772c.tmp'),
      server: createMockServer(tmpDir),
      modules: [],
    })
    const ordinaryTempResult = plugin.handleHotUpdate({
      file: path.join(tmpDir, 'src', 'canvas', 'test.canvas.jsonl.backup.tmp'),
      server: createMockServer(tmpDir),
      modules: [],
    })
    expect(stagingResult).toEqual([])
    expect(ordinaryTempResult).toBeUndefined()
  })

  it('handleHotUpdate does not send duplicate HMR events', () => {
    const plugin = createPlugin()
    const server = createMockServer(tmpDir)
    plugin.handleHotUpdate({
      file: path.join(tmpDir, 'src', 'canvas', 'test.canvas.jsonl'),
      server,
      modules: [],
    })
    // handleHotUpdate should NOT send events (invalidate() handles it)
    expect(server.wsSent.length).toBe(0)
  })

  it('generated virtual module includes server-event listener for canvas updates', () => {
    writeCanvasFile(tmpDir, 'hmr-canvas', 'HMR Test')
    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('window.addEventListener')
    expect(code).toContain('storyboard:canvas-file-changed')
    expect(code).toContain('import.meta.hot.on("storyboard:canvas-file-changed"')
    expect(code).toContain('data.removed')
    expect(code).toContain('data.metadata')
    // Should merge into existing entries to preserve build-time fields
    expect(code).toContain('Object.assign')
  })

  it('page refresh after canvas add yields updated module with new canvas', () => {
    const plugin = createPlugin()
    // First load — no canvases
    const code1 = plugin.load(RESOLVED_ID)
    expect(code1).not.toContain('"refresh-canvas"')

    // Simulate adding a canvas and clearing buildResult (what softInvalidate does)
    writeCanvasFile(tmpDir, 'refresh-canvas', 'After Refresh')

    // Manually clear buildResult by loading a fresh plugin instance with the same root
    const plugin2 = createPlugin()
    const code2 = plugin2.load(RESOLVED_ID)
    expect(code2).toContain('"refresh-canvas"')
    expect(code2).toContain('After Refresh')
  })

  // ── Story file discovery ──────────────────────────────────────────

  it('discovers .story.jsx files and generates _storyImport', () => {
    writeDataFiles(tmpDir)
    writeFileSync(
      path.join(tmpDir, 'button-patterns.story.jsx'),
      'export function Primary() { return null }',
    )
    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('"button-patterns"')
    expect(code).toContain('_storyModule')
    expect(code).toContain('_storyImport')
    expect(code).toContain('.story.jsx')
  })

  it('does not index an inactive repository notebook', () => {
    const notebookRoot = path.join(tmpDir, 'notebooks', 'hyperbase')
    const storyPath = path.join(notebookRoot, 'components', 'Chrome', 'chrome.story.jsx')
    mkdirSync(path.dirname(storyPath), { recursive: true })
    writeFileSync(storyPath, 'export function Default() { return null }')
    const inactive = createPlugin().load(RESOLVED_ID)
    expect(inactive).not.toContain('chrome.story.jsx')
    const active = storyboardDataPlugin({ notebookRuntime: { status: () => ({ root: notebookRoot }) } })
    active.configResolved({ root: tmpDir })
    expect(active.load(RESOLVED_ID)).toContain('chrome.story.jsx')
  })

  it('uses Vite filesystem imports for stories in an external Notebook', () => {
    const notebookRoot = path.join(tmpDir, 'notebook')
    const applicationRoot = path.join(tmpDir, 'application')
    const storyPath = path.join(notebookRoot, 'components', 'Slider', 'slider.story.jsx')
    mkdirSync(path.dirname(storyPath), { recursive: true })
    mkdirSync(applicationRoot)
    writeFileSync(storyPath, 'export function Default() { return null }')

    const plugin = storyboardDataPlugin({
      notebookRuntime: { status: () => ({ root: notebookRoot }) },
    })
    plugin.configResolved({ root: applicationRoot })
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain(`"_storyModule":"/@fs/${storyPath}"`)
    expect(code).toContain(`import("/@fs/${storyPath}")`)
    expect(code).not.toContain('import("/components/Slider/slider.story.jsx")')
  })

  it('discovers .story.tsx files', () => {
    writeDataFiles(tmpDir)
    writeFileSync(
      path.join(tmpDir, 'card.story.tsx'),
      'export function Default() { return null }',
    )
    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('"card"')
    expect(code).toContain('card.story.tsx')
  })

  it('skips _-prefixed story files', () => {
    writeDataFiles(tmpDir)
    writeFileSync(
      path.join(tmpDir, '_draft.story.jsx'),
      'export function Draft() { return null }',
    )
    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).not.toContain('"_draft"')
  })

  it('throws on duplicate story names', () => {
    writeDataFiles(tmpDir)
    mkdirSync(path.join(tmpDir, 'a'), { recursive: true })
    mkdirSync(path.join(tmpDir, 'b'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'a', 'dupe.story.jsx'),
      'export function A() { return null }',
    )
    writeFileSync(
      path.join(tmpDir, 'b', 'dupe.story.jsx'),
      'export function B() { return null }',
    )
    const plugin = createPlugin()
    expect(() => plugin.load(RESOLVED_ID)).toThrow(/Duplicate story "dupe"/)
  })

  it('includes stories in the init() call and exports', () => {
    writeDataFiles(tmpDir)
    writeFileSync(
      path.join(tmpDir, 'test.story.jsx'),
      'export function Test() { return null }',
    )
    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('const stories = {')
    expect(code).toContain('init({ flows, objects, records, prototypes, folders, canvases, stories, scopeAliases })')
    expect(code).toContain('export { flows, scenes, objects, records, prototypes, prototypeKnobs, componentKnobs, folders, canvases, canvasAliases, scopeAliases, stories, notebookWidgets, notebookToolHandlers }')
  })

  it('infers /components/ route for stories in src/canvas/', () => {
    writeDataFiles(tmpDir)
    mkdirSync(path.join(tmpDir, 'src', 'canvas'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'canvas', 'button-patterns.story.jsx'),
      'export function Primary() { return null }',
    )
    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('"button-patterns"')
    expect(code).toContain('"/components/button-patterns"')
    expect(code).toContain('_route')
  })

  it('infers /components/ route for stories in src/components/', () => {
    writeDataFiles(tmpDir)
    mkdirSync(path.join(tmpDir, 'src', 'components'), { recursive: true })
    writeFileSync(
      path.join(tmpDir, 'src', 'components', 'text-input.story.jsx'),
      'export function Default() { return null }',
    )
    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('"text-input"')
    expect(code).toContain('"/components/text-input"')
  })

  it('stories outside src/canvas/ or src/components/ have no inferred route', () => {
    writeDataFiles(tmpDir)
    writeFileSync(
      path.join(tmpDir, 'orphan.story.jsx'),
      'export function Default() { return null }',
    )
    const plugin = createPlugin()
    const code = plugin.load(RESOLVED_ID)

    expect(code).toContain('"orphan"')
    // Should not have _route since it's not in a recognized directory
    expect(code).not.toContain('"/orphan"')
  })
})

describe('parseDataFile — canvas path-based IDs', () => {
  it('flat canvas in src/canvas/ gets basename-only ID', () => {
    const result = parseDataFile('src/canvas/overview.canvas.jsonl')
    expect(result.name).toBe('overview')
    expect(result.inferredRoute).toBe('/canvas/overview')
    expect(result.group).toBeNull()
  })

  it('canvas inside .folder/ gets path-based ID', () => {
    const result = parseDataFile('src/canvas/research.folder/interviews.canvas.jsonl')
    expect(result.name).toBe('research/interviews')
    expect(result.inferredRoute).toBe('/canvas/research/interviews')
    expect(result.group).toBe('research')
  })

  it('duplicate basenames in different folders get distinct IDs', () => {
    const a = parseDataFile('src/canvas/alpha.folder/overview.canvas.jsonl')
    const b = parseDataFile('src/canvas/beta.folder/overview.canvas.jsonl')
    expect(a.name).toBe('alpha/overview')
    expect(b.name).toBe('beta/overview')
    expect(a.name).not.toBe(b.name)
  })

  it('prototype-scoped canvas gets path-based ID', () => {
    const result = parseDataFile('src/prototypes/Dashboard/plan.canvas.jsonl')
    expect(result.name).toBe('Dashboard/plan')
    expect(result.inferredRoute).toBe('/canvas/Dashboard/plan')
  })

  it('prototype inside .folder/ strips folder from ID', () => {
    const result = parseDataFile('src/prototypes/main.folder/Dashboard/plan.canvas.jsonl')
    expect(result.name).toBe('Dashboard/plan')
    expect(result.inferredRoute).toBe('/canvas/Dashboard/plan')
  })

  it('skips _-prefixed canvas files', () => {
    expect(parseDataFile('src/canvas/_draft.canvas.jsonl')).toBeNull()
  })

  it('skips canvas files in _-prefixed directories', () => {
    expect(parseDataFile('src/canvas/_hidden/public.canvas.jsonl')).toBeNull()
  })

  it('includes canvas files inside drafts/ dirs and preserves legacy routes', () => {
    const file = parseDataFile('src/canvas/drafts/scratch.canvas.jsonl')
    expect(file).not.toBeNull()
    expect(file.name).toBe('drafts/scratch')
    // Public route drops `drafts/` so locally-gitignored canvases reuse the
    // same URL as their non-prefixed counterpart.
    expect(file.inferredRoute).toBe('/canvas/scratch')
    const inDir = parseDataFile('src/canvas/drafts/private/notes.canvas.jsonl')
    expect(inDir).not.toBeNull()
    expect(inDir.name).toBe('drafts/private/notes')
    expect(inDir.inferredRoute).toBe('/canvas/private/notes')
    const inSubdir = parseDataFile('src/canvas/dfosco-explorations/drafts/notes.canvas.jsonl')
    expect(inSubdir).not.toBeNull()
    expect(inSubdir.name).toBe('dfosco-explorations/drafts/notes')
    expect(inSubdir.inferredRoute).toBe('/canvas/dfosco-explorations/notes')
  })

  it('canvas outside known directories gets basename-only ID', () => {
    const result = parseDataFile('random/path/notes.canvas.jsonl')
    expect(result.name).toBe('notes')
    expect(result.inferredRoute).toBeNull()
  })

  it('sets group for grouped canvases', () => {
    const result = parseDataFile('src/canvas/ux.folder/onboarding.canvas.jsonl')
    expect(result.group).toBe('ux')
  })

  it('sets group to null for ungrouped canvases', () => {
    const result = parseDataFile('src/canvas/standalone.canvas.jsonl')
    expect(result.group).toBeNull()
  })
})

describe('buildDataDiscovery — legacy drafts paths', () => {
  function writePage(dir, name, title) {
    const evt = { event: 'canvas_created', title, timestamp: Date.now() }
    writeFileSync(path.join(dir, `${name}.canvas.jsonl`), JSON.stringify(evt) + '\n')
  }

  it('attaches .meta.json to a drafts/ canvas group (drafts-stripped key reconciliation)', () => {
    const groupDir = path.join(tmpDir, 'src', 'canvas', 'drafts', 'security-vision')
    mkdirSync(groupDir, { recursive: true })
    writePage(groupDir, '1-security-vision', 'Security Vision')
    writePage(groupDir, '2-confidence-scores', 'Confidence Scores')
    writeFileSync(
      path.join(groupDir, 'security-vision.meta.json'),
      JSON.stringify({
        title: 'Security Vision',
        pageOrder: ['security-vision/1-security-vision', 'security-vision/2-confidence-scores'],
      }),
    )

    const discovery = buildDataDiscovery(tmpDir)
    const page = discovery.canvases['drafts/security-vision/1-security-vision']
    expect(page).toBeTruthy()
    expect(page._group).toBe('security-vision')
    // Before the fix this was null because the meta was keyed under
    // "drafts/security-vision" while the group lookup used "security-vision".
    expect(page._canvasMeta).toBeTruthy()
    expect(page._canvasMeta.title).toBe('Security Vision')
  })

  it('includes prototype stories and data under drafts while reporting colliding data scopes', () => {
    const publicProto = path.join(tmpDir, 'src', 'prototypes', 'Dashboard')
    const draftProto = path.join(tmpDir, 'src', 'prototypes', 'drafts', 'Dashboard')
    mkdirSync(publicProto, { recursive: true })
    mkdirSync(draftProto, { recursive: true })
    writeFileSync(path.join(publicProto, 'user.object.json'), JSON.stringify({ label: 'public' }))
    writeFileSync(path.join(draftProto, 'user.object.json'), JSON.stringify({ label: 'draft' }))
    writeFileSync(path.join(draftProto, 'Preview.story.jsx'), 'export function Preview() { return null }')

    const discovery = buildDataDiscovery(tmpDir)
    expect(discovery._dataScopeConflicts).toHaveLength(1)
    expect(discovery._dataScopeConflicts[0].name).toBe('Dashboard/user')
    expect(discovery.objects['Dashboard/user']).toBeUndefined()
    expect(discovery.stories.Preview).toBeTruthy()
  })
})

describe('buildDataDiscovery — content-only Notebook boundaries', () => {
  it('excludes generated publish canvases from the editable index', () => {
    const sourceDir = path.join(tmpDir, 'canvas')
    const publishDir = path.join(tmpDir, 'publish', 'canvas')
    mkdirSync(sourceDir, { recursive: true })
    mkdirSync(publishDir, { recursive: true })
    const event = JSON.stringify({ event: 'canvas_created', title: 'Welcome', timestamp: Date.now() }) + '\n'
    writeFileSync(path.join(sourceDir, 'welcome.canvas.jsonl'), event)
    writeFileSync(path.join(publishDir, 'welcome.canvas.jsonl'), event)

    const discovery = buildDataDiscovery(tmpDir, { contentOnly: true })
    expect(Object.keys(discovery.canvases)).toEqual(['welcome'])
  })
})

describe('optional Git metadata discovery', () => {
  it('keeps standalone Notebook metadata fallbacks without Git fatal diagnostics', () => {
    const prototypeDir = path.join(tmpDir, 'src', 'prototypes', 'Example')
    const canvasDir = path.join(tmpDir, 'src', 'canvas')
    mkdirSync(prototypeDir, { recursive: true })
    mkdirSync(canvasDir, { recursive: true })
    writeFileSync(path.join(prototypeDir, 'example.prototype.json'), JSON.stringify({ meta: { title: 'Example' } }))
    writeFileSync(path.join(canvasDir, 'overview.canvas.jsonl'), JSON.stringify({ event: 'canvas_created', title: 'Overview', widgets: [] }) + '\n')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const discovery = buildDataDiscovery(tmpDir)

    expect(discovery.prototypes.Example).toBeDefined()
    expect(discovery.prototypes.Example.gitAuthor).toBeUndefined()
    expect(discovery.canvases.overview.lastModified).toBeUndefined()
    const transformedHtml = createPlugin(tmpDir).transformIndexHtml('<html></html>', { server: {} })
    expect(transformedHtml).not.toContain('__SB_CURRENT_BRANCH__')
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('preserves Git author and modification metadata for repository-backed Notebooks', () => {
    const root = path.join(tmpDir, 'git-notebook')
    const prototypeDir = path.join(root, 'src', 'prototypes', 'Example')
    const canvasDir = path.join(root, 'src', 'canvas')
    mkdirSync(prototypeDir, { recursive: true })
    mkdirSync(canvasDir, { recursive: true })
    writeFileSync(path.join(prototypeDir, 'example.prototype.json'), JSON.stringify({ meta: { title: 'Example' } }))
    writeFileSync(path.join(canvasDir, 'overview.canvas.jsonl'), JSON.stringify({ event: 'canvas_created', title: 'Overview', widgets: [] }) + '\n')
    execFileSync('git', ['init', '-q', root])
    execFileSync('git', ['-C', root, 'config', 'user.name', 'Notebook Test Author'])
    execFileSync('git', ['-C', root, 'config', 'user.email', 'notebook-test@example.com'])
    execFileSync('git', ['-C', root, 'add', 'src'])
    execFileSync('git', ['-C', root, 'commit', '-qm', 'Add Notebook data'])

    const discovery = buildDataDiscovery(root)

    expect(discovery.prototypes.Example.gitAuthor).toBe('Notebook Test Author')
    expect(discovery.prototypes.Example.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(discovery.canvases.overview.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('terminal config overlap diagnostics', () => {
  it('warns only for conflicting explicit leaves and names the actual config sources', () => {
    writeFileSync(path.join(tmpDir, 'storyboard.config.json'), JSON.stringify({
      hotPool: {
        enabled: true,
        pools: { codex: { pool_size: 1 }, claude: { pool_size: 1 } },
      },
      canvas: {
        terminal: { shell: '/bin/zsh' },
        agents: { codex: { command: 'codex', model: 'fast' } },
      },
    }))
    writeFileSync(path.join(tmpDir, 'terminal.config.json'), JSON.stringify({
      hotPool: {
        enabled: false,
        pools: { codex: { pool_size: 1 }, local: { pool_size: 2 } },
      },
      terminal: { shell: '/bin/zsh', font: 'Mono' },
      agents: { codex: { command: 'codex', model: 'accurate' } },
    }))

    const messages = []
    const originalWarn = console.warn
    console.warn = (...args) => messages.push(args.join(' '))
    try {
      createPlugin(tmpDir).load(RESOLVED_ID)
    } finally {
      console.warn = originalWarn
    }

    expect(messages).toEqual([
      expect.stringContaining('Config overlap: "agents.codex.model" differs between storyboard.config.json.canvas.agents and terminal.config.json.agents — terminal.config.json wins.'),
      expect.stringContaining('Config overlap: "hotPool.enabled" differs between storyboard.config.json.hotPool and terminal.config.json.hotPool — terminal.config.json wins.'),
    ])
    expect(messages.join('\n')).not.toContain('terminal.shell')
    expect(messages.join('\n')).not.toContain('is defined in both storyboard.config.json.canvas and terminal.config.json')
  })
})

describe('storyboardDataPlugin — notebook prototype route map', () => {
  const VIRTUAL_ID = 'virtual:storyboard-notebook-prototype-routes'

  afterEach(() => {
    delete process.env.HYPERCANVAS_NOTEBOOK_ROOT
  })

  it('resolves itself and serves Notebook prototypes when a Notebook root is active', () => {
    const notebook = mkdtempSync(path.join(tmpdir(), 'sb-nb-routes-'))
    try {
      mkdirSync(path.join(notebook, 'prototypes', 'Landing'), { recursive: true })
      writeFileSync(path.join(notebook, 'prototypes', 'Landing', 'index.jsx'), 'export default function Landing() {}')
      process.env.HYPERCANVAS_NOTEBOOK_ROOT = notebook

      const plugin = storyboardDataPlugin()
      plugin.configResolved({ root: tmpDir })

      expect(plugin.resolveId(VIRTUAL_ID)).toBe(VIRTUAL_ID)
      const source = plugin.load(VIRTUAL_ID)
      expect(source).toContain('"/src/prototypes/Landing/index.jsx"')
      expect(source).toContain(path.join(notebook, 'prototypes', 'Landing', 'index.jsx'))
    } finally {
      rmSync(notebook, { recursive: true, force: true })
    }
  })

  it('serves an empty map without an active Notebook (scaffold repos keep their glob routes)', () => {
    const plugin = storyboardDataPlugin()
    plugin.configResolved({ root: tmpDir })
    const source = plugin.load(VIRTUAL_ID)
    expect(source).toContain('export const PROTOTYPE_ROUTES = {')
    expect(source).toContain('export const PROTOTYPE_MODALS = {')
    expect(source).not.toContain('import(')
  })
})
