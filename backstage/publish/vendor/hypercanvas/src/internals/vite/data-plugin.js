import fs from 'node:fs'
import { prototypeCssTransform } from './prototype-css.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, execSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { globSync } from 'glob'
import { parse as parseJsonc, modify, applyEdits } from 'jsonc-parser'
import { materializeFromText } from '../../core/canvas/materializer.js'
import { toCanvasId } from '../../core/canvas/identity.js'
import { artifactFolderLogicalName } from '../../core/artifact/visibility.js'
import { isAtomicCanvasStagingFile, isCanvasWriteInFlight } from '../../core/canvas/writeGuard.js'
import { getConfig } from '../../core/stores/configSchema.js'
import { normalizeCanvasAutoPlace } from '../../core/stores/canvasConfig.js'
import { APP_CONFIG_PRIMARY, APP_CONFIG_LEGACY, appConfigCandidates, resolveAppConfigPath, resolveAppConfigWritePath, resolveConfigFileCandidates, resolveConfigFilePath } from '../../core/configFile.js'
import { resolveRuntimeDir } from '../../core/runtimeDir.js'
import { renderInlineBootstrapScript } from '../../core/stores/themeBootstrap.js'
import { generateThemesCss, GENERATED_THEMES_CSS_FILENAME } from '../../core/styles/generateThemesCss.js'
import { list as listRunningServers } from '../../core/worktree/serverRegistry.js'
import { listWorktrees } from '../../core/worktree/port.js'
import { buildArtifactManifest, resolveManifestEnv } from '../../core/data/artifactManifest.js'
import { createIsolationMiddleware } from '../canvas/isolation/createIsolationMiddleware.js'
import { notebookPrototypeRouteSource } from '../../core/notebook/vite-routes-plugin.js'
import { hasNotebookManifest, inspectNotebook, notebookSupportImportCandidates, resolveNotebookSupportPath } from '../../core/notebook/notebook.js'
import { notebookContentPath } from '../../core/notebook/layout.js'
import { statefullyCompatibilityModule } from './statefullyCompatibility.js'

const VIRTUAL_MODULE_ID = 'virtual:storyboard-data-index'
const RESOLVED_ID = '\0' + VIRTUAL_MODULE_ID
const STATEFULLY_DATA_INDEX_VIRTUAL_ID = 'virtual:statefully-data-index'
const STATEFULLY_DATA_INDEX_RESOLVED_ID = '\0' + STATEFULLY_DATA_INDEX_VIRTUAL_ID
const STATEFULLY_DATA_RUNTIME_ID = '@dfosco/statefully/data-runtime'
const STATEFULLY_REACT_SOURCE = fileURLToPath(import.meta.resolve('@dfosco/statefully/react'))
const STATEFULLY_CORE_SOURCE = fileURLToPath(import.meta.resolve('@dfosco/statefully'))
const STATEFULLY_COMPAT_HELPER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'statefullyCompatibility.js')
const STATEFULLY_COMPAT_CORE = '\0virtual:hypercanvas-statefully/core'
const STATEFULLY_COMPAT_REACT = '\0virtual:hypercanvas-statefully/react'
const STATEFULLY_DATA_RUNTIME_SOURCE = path.resolve(path.dirname(STATEFULLY_REACT_SOURCE), 'core/data.js')
function designNotebookRuntimeModule(name) {
  const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../core/notebook/first-look/runtime')
  const source = path.join(directory, `${name}.ts`)
  return fs.existsSync(source) ? source : source.replace(/\.ts$/, '.js')
}
const DESIGN_NOTEBOOK_ROUTE_RUNTIME = designNotebookRuntimeModule('route')
const DESIGN_NOTEBOOK_REACT_RUNTIME = designNotebookRuntimeModule('react')
const APP_CONFIG_VIRTUAL_ID = 'virtual:hypercanvas-app-config'
// Notebook prototype route map, served by this plugin (not the notebook-routes
// plugin) because the data plugin is part of every consumer's Vite config —
// the library's isolated `prototypes.html` entry can therefore import it in
// notebook runtimes and scaffold repos alike. Without it the iframe entry
// only sees application-root prototypes (`/src/prototypes/**`) and renders
// Notebook prototypes as a blank route.
const PROTOTYPE_ROUTES_VIRTUAL_ID = 'virtual:storyboard-notebook-prototype-routes'

// Keep in sync with isNotebookPrototypeRouteMapEvent() in the Notebook route
// plugin. This copy avoids requiring a rebuilt Core module from this source
// plugin while the source and packaged Core are at different revisions.
function isNotebookPrototypeRouteMapEvent(root, file, event) {
  if (!root || !file) return false
  const absoluteRoot = path.resolve(root)
  const absoluteFile = path.resolve(file)
  const relativePath = path.relative(absoluteRoot, absoluteFile)
  if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) return false
  const relative = relativePath.replaceAll(path.sep, '/')
  const segments = relative.split('/')
  const filename = segments.at(-1) || ''

  const suffixPrototypeIndex = segments.findIndex(segment => segment.endsWith('.prototype'))
  const isLegacyPrototype = segments[0] === 'prototypes'
    && !segments.some(segment => /\.(prototype|component|canvas|site)$/.test(segment))
  const isSuffixPrototype = suffixPrototypeIndex >= 0
    && !segments.slice(suffixPrototypeIndex + 1, -1).some(segment => /\.(prototype|component|canvas|site)$/.test(segment))
  if (!isLegacyPrototype && !isSuffixPrototype) return false

  if (filename === '.hypercanvas-artifact.json') return suffixPrototypeIndex >= 0
  if (/\.prototype\.jsonc?$/i.test(filename) && suffixPrototypeIndex >= 0) return true
  if (/\.flow\.json$/i.test(filename)) return true
  return event !== 'change' && /\.(jsx|tsx|mdx)$/i.test(filename)
}

function createSiblingOrderChangeTracker(initialRaw) {
  let previousRaw = initialRaw
  const classify = (nextRaw) => {
    const parse = raw => {
      if (raw === null || raw === undefined) return {}
      if (typeof raw !== 'string') return null
      const errors = []
      const value = parseJsonc(raw, errors)
      return errors.length === 0 && value && typeof value === 'object' && !Array.isArray(value) ? value : null
    }
    const stableJson = value => {
      if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
      if (!value || typeof value !== 'object') return JSON.stringify(value)
      return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
    }
    const withoutOrder = value => {
      const result = structuredClone(value)
      if (result.notebook && typeof result.notebook === 'object' && !Array.isArray(result.notebook)) {
        delete result.notebook.siblingOrder
        if (Object.keys(result.notebook).length === 0) delete result.notebook
      }
      return result
    }
    const previous = parse(previousRaw)
    const next = parse(nextRaw)
    if (!previous || !next) return 'other'
    if (stableJson(previous) === stableJson(next)) return 'unchanged'
    return stableJson(withoutOrder(previous)) === stableJson(withoutOrder(next)) ? 'order-only' : 'other'
  }
  return {
    observe(nextRaw) {
      const result = classify(nextRaw)
      previousRaw = nextRaw
      return result
    },
  }
}

let _onHotPoolConfigChange = null
export function setOnHotPoolConfigChange(fn) { _onHotPoolConfigChange = fn }

const GLOB_PATTERN = '**/*.{flow,scene,object,record,prototype,folder,component}.{json,jsonc}'
const CANVAS_GLOB_PATTERN = '**/*.canvas.jsonl'
const CANVAS_META_GLOB_PATTERN = '**/*.meta.json'
const STORY_GLOB_PATTERN = '**/*.{story,stories}.{js,jsx,ts,tsx}'

export function canvasViewportScope(root) {
  return createHash('sha256').update(fs.realpathSync(root)).digest('hex')
}

/**
 * Extract the data name and type suffix from a file path.
 * Flows, records, and objects inside src/prototypes/{Name}/ get prefixed with
 * the prototype name (e.g. "Dashboard/default", "Dashboard/helpers").
 * Directories ending in .folder/ are skipped when extracting prototype scope.
 *
 * e.g. "src/data/default.flow.json"                → { name: "default",           suffix: "flow" }
 *      "src/prototypes/Dashboard/default.flow.json" → { name: "Dashboard/default", suffix: "flow" }
 *      "src/prototypes/Dashboard/helpers.object.json"→ { name: "Dashboard/helpers", suffix: "object" }
 *      "src/prototypes/X.folder/Dashboard/default.flow.json" → { name: "Dashboard/default", suffix: "flow", folder: "X" }
 */
/**
 * Parse top-level named exports (Capitalized identifiers) from a story
 * source file. Mirrors the regex used by canvas/server.js:parseExportNames
 * so that downstream UI (CanvasCreateMenu, WidgetArtifactDialog) can decide
 * between rendering a single component vs a component-set without a runtime
 * import of the story module.
 */
function parseStoryExportNames(filePath) {
  try {
    const src = fs.readFileSync(filePath, 'utf-8')
    const names = []
    const re = /export\s+(?:function|const|class)\s+([A-Z]\w*)/g
    let m
    while ((m = re.exec(src)) !== null) names.push(m[1])
    return names
  } catch { return [] }
}

// `_`-prefixed folders are sidebar-only visibility. In Notebook mode their
// data stays addressable under the logical name, so leading underscores are
// stripped from every segment before name/route derivation. In legacy source
// repositories (`src/…` layouts) `_` ancestor folders keep the older
// private-dataset convention and are still skipped. Underscore-prefixed file
// basenames keep the private-module rule in both modes.
function logicalDataPath(filePath) {
  return filePath.replace(/\\/g, '/').split('/').map(seg => seg.replace(/^_+/, '')).join('/')
}

function hasUnderscoreAncestor(filePath) {
  const segments = filePath.replace(/\\/g, '/').split('/')
  if (segments[0] === 'src') segments[0] = 'src'
  return segments.slice(0, -1).some(seg => seg.startsWith('_'))
}

function parseDataFile(filePath, { notebookMode = false } = {}) {
  const base = path.basename(filePath)

  // Handle .canvas.jsonl files
  const canvasJsonlMatch = base.match(/^(.+)\.canvas\.jsonl$/)
  if (canvasJsonlMatch) {
    if (canvasJsonlMatch[1].startsWith('_')) return null
    if (!notebookMode && hasUnderscoreAncestor(filePath)) return null
    const normalized = logicalDataPath(filePath)

    const baseName = canvasJsonlMatch[1]
    let name = baseName
    let inferredRoute = null
    const canvasFolderMatch = normalized.match(/(?:^|\/)src\/canvas\/([^/]+)\.folder\//)
    const canvasFolderName = canvasFolderMatch ? canvasFolderMatch[1] : null
    const folderDirMatch = normalized.match(/(?:^|\/)src\/prototypes\/([^/]+)\.folder\//)
    const folderName = folderDirMatch ? folderDirMatch[1] : null

    // Preserve legacy route aliases while retaining the source path in the
    // page identity. Route collisions are surfaced by the Notebook catalog.
    const stripDraft = (p) => p.split('/').filter(seg => seg !== 'drafts').join('/')
    const canvasCheck = normalized.match(/(?:^|\/)src\/canvas\//)
    if (canvasCheck) {
      const dirPath = normalized.substring(0, normalized.lastIndexOf('/'))
      // Path-based ID: include folder context for uniqueness.
      // .folder dirs contribute their name (sans .folder suffix) to the ID.
      const idBase = (dirPath + '/')
        .replace(/^.*?src\/canvas\//, '')
        .replace(/\.folder\/?/g, '/')
        .replace(/\/+/g, '/')
        .replace(/\/$/, '')
      name = idBase ? `${idBase}/${baseName}` : baseName
      inferredRoute = '/canvas/' + stripDraft(name)
      inferredRoute = inferredRoute.replace(/\/+/g, '/').replace(/\/$/, '') || '/canvas'
    }
    const protoCheck = normalized.match(/(?:^|\/)src\/prototypes\//)
    if (!canvasCheck && protoCheck) {
      const dirPath = normalized.substring(0, normalized.lastIndexOf('/'))
      // For prototypes, .folder is purely organizational — strip entirely
      const idBase = (dirPath + '/')
        .replace(/^.*?src\/prototypes\//, '')
        .replace(/[^/]*\.folder\/?/g, '')
        .replace(/\/+/g, '/')
        .replace(/\/$/, '')
      name = idBase ? `${idBase}/${baseName}` : baseName
      inferredRoute = '/canvas/' + stripDraft(name)
      inferredRoute = inferredRoute.replace(/\/+/g, '/').replace(/\/$/, '') || '/canvas'
    }
    // Derive the legacy workspace group while preserving the old route alias.
    const groupBase = stripDraft(name)
    const groupSlashIdx = groupBase.lastIndexOf('/')
    const group = canvasFolderName || (groupSlashIdx > 0 ? groupBase.substring(0, groupSlashIdx) : null)
    // Extract a relative path for toCanvasId (it expects src/canvas/... or src/prototypes/...)
    const canvasIdInput = normalized.replace(/^.*?(src\/(?:canvas|prototypes)\/)/, '$1')
    const id = toCanvasId(canvasIdInput)
    return { name, suffix: 'canvas', ext: 'jsonl', folder: canvasFolderName || folderName, inferredRoute, id, group }
  }

  // Handle canvas .meta.json files
  const metaMatch = base.match(/^(.+)\.meta\.json$/)
  if (metaMatch) {
    const normalized = filePath.replace(/\\/g, '/')
    // Only handle meta files inside src/canvas/ directories
    const canvasCheck = normalized.match(/(?:^|\/)src\/canvas\//)
    if (!canvasCheck) return null
    // Skip _-prefixed internal files.
    if (metaMatch[1].startsWith('_')) return null
    if (!notebookMode && hasUnderscoreAncestor(filePath)) return null
    return { name: logicalDataPath(metaMatch[1]), suffix: 'canvas-meta', ext: 'json', inferredRoute: null }
  }

  // Handle .story.jsx / .story.tsx files
  const storyMatch = base.match(/^(.+)\.stor(?:y|ies)\.(js|jsx|ts|tsx)$/)
  if (storyMatch) {
    if (storyMatch[1].startsWith('_')) return null
    if (!notebookMode && hasUnderscoreAncestor(filePath)) return null
    const normalized = logicalDataPath(filePath)
    const name = storyMatch[1]
    let inferredRoute = null

    // All stories route under /components/ regardless of directory location
    const canvasCheck = normalized.match(/(?:^|\/)src\/canvas\//)
    const componentsCheck = normalized.match(/(?:^|\/)src\/components\//)
    // Keep the preexisting route alias so collisions stay explicit.
    const stripDraft = (p) => p.split('/').filter(seg => seg !== 'drafts').join('/')
    if (canvasCheck) {
      const dirPath = normalized.substring(0, normalized.lastIndexOf('/'))
      const routeBase = (dirPath + '/')
        .replace(/^.*?src\/canvas\//, '')
        .replace(/[^/]*\.folder\/?/g, '')
        .replace(/\/$/, '')
      inferredRoute = '/components/' + (routeBase ? routeBase + '/' : '') + name
      inferredRoute = stripDraft(inferredRoute).replace(/\/+/g, '/').replace(/\/$/, '') || '/components'
    } else if (componentsCheck) {
      const dirPath = normalized.substring(0, normalized.lastIndexOf('/'))
      const routeBase = (dirPath + '/')
        .replace(/^.*?src\/components\//, '')
        .replace(/[^/]*\.folder\/?/g, '')
        .replace(/\/$/, '')
      inferredRoute = '/components/' + (routeBase ? routeBase + '/' : '') + name
      inferredRoute = stripDraft(inferredRoute).replace(/\/+/g, '/').replace(/\/$/, '') || '/components'
    }

    return { name, suffix: 'story', ext: storyMatch[2], inferredRoute }
  }

  const match = base.match(/^(.+)\.(flow|scene|object|record|prototype|folder|component)\.(jsonc?)$/)
  if (!match) return null

  // Skip _-prefixed internal files.
  if (match[1].startsWith('_')) return null
  if (!notebookMode && hasUnderscoreAncestor(filePath)) return null

  // In Notebook mode `_` folder segments strip for identity (logicalDataPath);
  // legacy source repositories skip them above.
  const normalized = logicalDataPath(filePath)
  // Normalize .scene → .flow for backward compatibility
  const suffix = match[2] === 'scene' ? 'flow' : match[2]
  let name = match[1]

  // Detect if this file is inside a .folder/ directory
  const folderDirMatch = normalized.match(/(?:^|\/)src\/prototypes\/([^/]+)\.folder\//)
  const folderName = folderDirMatch ? folderDirMatch[1] : null

  // Folder metadata files are keyed by their folder directory name (sans .folder suffix)
  if (suffix === 'folder') {
    if (folderName) {
      name = folderName
    }
    return { name, suffix, ext: match[3] }
  }

  // Prototype metadata files are keyed by their prototype directory name
  // (skip .folder/ and `drafts/` segments when determining prototype name).
  if (suffix === 'prototype') {
    const protoMatch = normalized.match(/(?:^|\/)src\/prototypes\/(?:(?:[^/]+\.folder|drafts)\/)*([^/]+)\//)
    if (protoMatch) {
      name = protoMatch[1]
    }
    return { name, suffix, ext: match[3], folder: folderName }
  }

  // Component metadata files are keyed by their component config basename.
  if (suffix === 'component') {
    return { name, suffix, ext: match[3] }
  }

  // Scope flows, records, and objects inside src/prototypes/{Name}/ with a prefix
  // (skip .folder/ and `drafts/` segments when determining prototype name).
  const protoMatch = normalized.match(/(?:^|\/)src\/prototypes\/(?:(?:[^/]+\.folder|drafts)\/)*([^/]+)\//)
  if (protoMatch) {
    name = `${protoMatch[1]}/${name}`
  }

  // Infer route for prototype-scoped flows from their file path.
  // Mirrors the generouted route regex: strip src/prototypes/, *.folder/,
  // and `drafts/` segments.
  let inferredRoute = null
  if (suffix === 'flow') {
    const protoCheck = normalized.match(/(?:^|\/)src\/prototypes\//)
    if (protoCheck) {
      const dirPath = normalized.substring(0, normalized.lastIndexOf('/'))
      inferredRoute = '/' + dirPath
        .replace(/^.*?src\/prototypes\//, '')
        .replace(/[^/]*\.folder\//g, '')
        .split('/').filter(seg => seg !== 'drafts').join('/')
      // Normalize trailing slash and double slashes
      inferredRoute = inferredRoute.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
    }
  }

  return { name, suffix, ext: match[3], inferredRoute }
}

/**
 * Batch-fetch git metadata (author + lastModified) for multiple files in a
 * single subprocess, avoiding per-file git overhead during startup.
 *
 * Returns a Map<absPath, { gitAuthor: string|null, lastModified: string|null }>
 */
function batchGitMetadata(root, filePaths) {
  const result = new Map()
  if (filePaths.length === 0) return result

  // Initialize all entries
  for (const fp of filePaths) {
    result.set(fp, { gitAuthor: null, lastModified: null })
  }

  // This metadata is optional for standalone Notebooks. Check repository
  // membership once before running the batch logs; execSync re-emits a failed
  // child's stderr, so each probe otherwise writes a fatal message on startup.
  if (!isGitRepository(root)) return result

  try {
    // Batch lastModified: one git log call with all paths
    // git log -1 gives the most recent commit touching any of these paths,
    // but we need per-path data. Use --name-only to correlate.
    // For efficiency, use a single git log with --format and --name-only
    // that outputs one record per commit touching these files.
    const allDirs = [...new Set(filePaths.map(fp => path.dirname(fp)))]

    // Get lastModified per directory in one call using git log --format
    // We output "MARKER<sep>dir<sep>date" per commit, then take the latest per dir.
    const logResult = execFileSync('git', ['log', '--format=%aI', '--name-only', '--', ...allDirs], {
      cwd: root,
      encoding: 'utf-8',
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    }).trim()

    if (logResult) {
      const dirDates = new Map() // dir → most recent date
      let currentDate = null
      for (const line of logResult.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
          currentDate = trimmed
          continue
        }
        if (!currentDate) continue
        const dir = path.dirname(path.resolve(root, trimmed))
        if (!dirDates.has(dir)) {
          dirDates.set(dir, currentDate)
        }
      }
      for (const fp of filePaths) {
        const dir = path.dirname(fp)
        const entry = result.get(fp)
        if (dirDates.has(dir) && entry) {
          entry.lastModified = dirDates.get(dir)
        }
      }
    }
  } catch (error) {
    warnGitMetadataFailure('last-modified timestamps', root, error)
  }

  // Batch gitAuthor: use git log for each file's creation author.
  // Unfortunately --follow --diff-filter=A doesn't combine well with multiple
  // paths, so batch them in a single shell invocation using a for loop.
  try {
    const relPaths = filePaths.map(fp => path.relative(root, fp))
    // Build a shell script that outputs "PATH<tab>AUTHOR" per file. `echo -n`
    // is not portable across the /bin/sh implementations used by Node, and
    // paths need shell quoting because Notebooks may contain spaces or quotes.
    const shellQuote = value => `'${value.replace(/'/g, `'\\''`)}'`
    const cmds = relPaths.map(rp =>
      `printf '%s\\t' ${shellQuote(rp)} && git log --follow --diff-filter=A --format="%aN" -- ${shellQuote(rp)}`
    ).join(' && ')
    const authorResult = execSync(cmds, {
      cwd: root, encoding: 'utf-8', timeout: 10000, shell: true, maxBuffer: 1024 * 1024,
    }).trim()

    if (authorResult) {
      for (const line of authorResult.split('\n')) {
        const tabIdx = line.indexOf('\t')
        if (tabIdx < 0) continue
        const relPath = line.slice(0, tabIdx)
        const author = line.slice(tabIdx + 1).trim()
        if (!author) continue
        const absPath2 = path.resolve(root, relPath)
        const entry = result.get(absPath2)
        if (entry) entry.gitAuthor = author
      }
    }
  } catch (error) {
    warnGitMetadataFailure('author metadata', root, error)
  }

  return result
}

function isGitRepository(root) {
  const check = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: root,
    encoding: 'utf-8',
    timeout: 10000,
  })

  if (check.status === 0 && check.stdout.trim() === 'true') return true

  const stderr = String(check.stderr || '').trim()
  if (!isMissingGitRepository(check, stderr)) {
    const reason = check.error?.message || stderr || `git rev-parse exited with status ${check.status}`
    console.warn(`[storyboard] Could not inspect optional Git metadata in ${root}: ${reason}`)
  }
  return false
}

function warnGitMetadataFailure(field, root, error) {
  const stderr = error?.stderr ? String(error.stderr).trim() : ''
  const reason = stderr || error?.message || String(error)
  console.warn(`[storyboard] Could not read optional Git ${field} in ${root}: ${reason}`)
}

function isMissingGitRepository(result, stderr = String(result.stderr || '').trim()) {
  return result.status !== 0 && /not a git repository/i.test(stderr)
}

/**
 * Scan the repo for all data files, validate uniqueness, return the index.
 */
function buildIndex(root, opts = {}) {
  const { contentOnly = false } = opts
  // Notebook mode trusts `_` visibility prefixes to be sidebar-only; legacy
  // source repositories keep skipping `_` ancestor folders.
  // Source-repository scans omit fixtures and generated artifacts. A content-
  // only Notebook can use any ordinary folder name, so its glob exclusions
  // mirror the catalog's NOTEBOOK_INFRASTRUCTURE_DIRECTORIES from site.ts.
  const ignore = contentOnly
    ? ['.git/**', '.hypercanvas/**', '.storyboard/**', '.vite/**', 'node_modules/**', 'build/**', 'coverage/**', 'dist/**', 'publish/**', 'backstage/publish/**', 'public/**', 'storybook-static/**', '.storyboard-public/**']
    : ['node_modules/**', 'dist/**', '.git/**', '.worktrees/**', 'worktrees/**', 'public/**', 'fixtures/**', 'desktop/resources/**', 'packages/mygo/resources/**', 'artifacts/**', 'releases/**', 'notebooks/**']
  const files = globSync(contentOnly ? `**/*.{flow,scene,object,record,prototype,folder,component}.{json,jsonc}` : GLOB_PATTERN, { cwd: root, ignore, absolute: false })
  const canvasFiles = globSync(CANVAS_GLOB_PATTERN, { cwd: root, ignore, absolute: false })
  const canvasMetaFiles = globSync(CANVAS_META_GLOB_PATTERN, { cwd: root, ignore, absolute: false })
  const storyFiles = globSync(STORY_GLOB_PATTERN, { cwd: root, ignore, absolute: false })

  // New-format Notebook artifacts can live under any ordinary folder. Build
  // the data index from the accepted catalog so the physical location is not
  // mistaken for the prototype's authored logical name or route.
  // Portable first-look Notebooks can be manifestless. Inspect the read-only
  // catalog for every content-only root so their stable Canvas IDs are present
  // in the runtime index, alongside the Statefully prototype route map.
  const notebookMode = contentOnly || hasNotebookManifest(root)
  const notebookArtifacts = notebookMode
    ? inspectNotebook(root).artifacts
    : []

  // Detect nested .folder/ directories (not supported)
  // Scan directories directly since empty nested folders have no data files
  const folderDirs = globSync(contentOnly ? 'prototypes/**/*.folder' : 'src/prototypes/**/*.folder', { cwd: root, ignore, absolute: false })
  for (const dir of folderDirs) {
    const normalized = dir.replace(/\\/g, '/')
    const segments = normalized.split('/').filter(s => s.endsWith('.folder'))
    if (segments.length > 1) {
      throw new Error(
        `[storyboard-data] Nested .folder directories are not supported.\n` +
        `  Found at: ${dir}\n` +
        `  Folders can only be one level deep inside src/prototypes/.`
      )
    }
  }

  const index = { flow: {}, object: {}, record: {}, prototype: {}, folder: {}, component: {}, canvas: {}, 'canvas-meta': {}, story: {} }
  const seen = {} // "name.suffix" or "id.suffix" → absolute path (for duplicate detection)
  const dataScopeConflicts = []
  const protoFolders = {} // prototype name → folder name (for injection)
  const flowRoutes = {} // flow name → inferred route (for _route injection)
  const canvasRoutes = {} // canvas name → inferred route
  const canvasAliases = {} // unique basename and legacy grouped path → stable ID
  const canvasNameCount = {} // canvas basename → count (for ambiguity detection)
  const ambiguousCanvasAliases = new Set()
  const registerCanvasAlias = (alias, id) => {
    if (!alias || ambiguousCanvasAliases.has(alias)) return
    if (Object.hasOwn(canvasAliases, alias) && canvasAliases[alias] !== id) {
      delete canvasAliases[alias]
      ambiguousCanvasAliases.add(alias)
      return
    }
    canvasAliases[alias] = id
  }
  const canvasGroups = {} // canvas name → group name (shared folder prefix)
  const storyRoutes = {} // story name → inferred route
  const artifactContexts = {}
  const scopeAliases = {}
  const scopeAliasTargets = new Map()
  for (const artifact of notebookArtifacts) {
    if (artifact.kind !== 'prototype' || !artifact.available) continue
    const oldScope = artifact.migrationAliases?.legacyScopes?.prototype
    const canonicalScope = artifactFolderLogicalName(path.posix.basename(artifact.folderPath))
    if (!oldScope || !canonicalScope || oldScope === canonicalScope) continue
    if (scopeAliasTargets.has(oldScope) && scopeAliasTargets.get(oldScope) !== canonicalScope) {
      throw new Error(`[storyboard-data] Conflicting legacy prototype scope alias "${oldScope}"`)
    }
    scopeAliasTargets.set(oldScope, canonicalScope)
  }
  for (const [oldScope, canonicalScope] of scopeAliasTargets) {
    // A compatibility name must never shadow a real canonical prototype.
    if (notebookArtifacts.some(artifact => artifact.kind === 'prototype'
      && artifact.available
      && artifactFolderLogicalName(path.posix.basename(artifact.folderPath)) === oldScope
      && artifactFolderLogicalName(path.posix.basename(artifact.folderPath)) !== canonicalScope)) {
      throw new Error(`[storyboard-data] Legacy prototype scope alias "${oldScope}" conflicts with a canonical prototype`)
    }
    scopeAliases[oldScope] = canonicalScope
  }

  for (const relPath of [...files, ...canvasFiles, ...canvasMetaFiles, ...storyFiles]) {
    const normalizedPath = relPath.replaceAll('\\', '/')
    const artifact = notebookArtifacts
      .filter(item => normalizedPath === item.folderPath || normalizedPath.startsWith(`${item.folderPath}/`))
      .sort((left, right) => right.folderPath.length - left.folderPath.length)[0]
    let parsePath = contentOnly && !relPath.startsWith('src/') ? `src/${relPath}` : relPath
    if (notebookMode) {
      // In contentOnly mode the `src/…` projection is the canonical identity;
      // in a Notebook dev scan the same remap keeps artifact payloads scoped
      // to their logical prototype, canvas, or component name regardless of
      // the physical Notebook folder that carries them.
      const suffixAncestor = normalizedPath.split('/').slice(0, -1).findIndex(segment => /\.(prototype|component|canvas|site)$/.test(segment))
      if (suffixAncestor >= 0 && !artifact) continue
      if (artifact) {
        // Sidebar visibility is the only effect of a `_` prefix; hidden
        // prototype identities stay routable and their data stays indexed.
        // Availability still gates invalid payloads. Site routes are handled
        // by the Site route layer.
        if (!artifact.available || artifact.kind === 'site') continue
        const artifactPrefix = `${artifact.folderPath}/`
        const inside = normalizedPath.slice(artifactPrefix.length)
        const nestedBoundary = inside.split('/').slice(0, -1).some(segment => /\.(prototype|component|canvas|site)$/.test(segment))
        if (nestedBoundary) continue
        const logicalName = artifactFolderLogicalName(path.posix.basename(artifact.folderPath))
        if (!logicalName) continue
        if (artifact.kind === 'canvas') {
          if (normalizedPath !== artifact.payloadPath) continue
          parsePath = `src/canvas/${logicalName}.canvas.jsonl`
        } else if (artifact.kind === 'prototype') {
          parsePath = `src/prototypes/${logicalName}/${inside}`
        } else {
          parsePath = `src/components/${logicalName}/${inside}`
        }
      }
    }
    const parsed = parseDataFile(parsePath, { notebookMode })
    if (!parsed) continue

    if (artifact) {
      const logicalName = artifactFolderLogicalName(path.posix.basename(artifact.folderPath))
      if (!logicalName) continue
      if (artifact.kind === 'canvas') {
        parsed.id = artifact.id
        parsed.name = logicalName
        parsed.inferredRoute = artifact.route
        // Keep the route-shaped path alias that legacy canvas IDs exposed.
        // The marker ID is the primary identity, while grouped links continue
        // to resolve through this compatibility alias.
        parsed.legacyPathId = toCanvasId(`canvas/${artifact.folderPath}/${path.posix.basename(artifact.payloadPath)}`)
      } else if (artifact.kind === 'prototype') {
        if (parsed.suffix === 'prototype') parsed.name = logicalName
        if (parsed.suffix === 'flow' && parsed.inferredRoute && artifact.route) {
          const suffix = parsed.inferredRoute.slice(`/${logicalName}`.length)
          parsed.inferredRoute = `${artifact.route}${suffix}`
        }
      } else if (artifact.kind === 'component' && parsed.suffix === 'story') {
        const inside = normalizedPath.slice(`${artifact.folderPath}/`.length).replace(/\.stor(?:y|ies)\.[jt]sx?$/, '')
        const primary = normalizedPath === artifact.payloadPath
        parsed.name = primary ? logicalName : `${logicalName}/${inside}`
        parsed.inferredRoute = primary ? artifact.route : `${artifact.route}/${inside.split('/').map(encodeURIComponent).join('/')}`
      }
    }

    // Canvas files use path-based IDs for dedup; others use basename
    const dedupKey = parsed.suffix === 'canvas' && parsed.id
      ? `${parsed.id}.${parsed.suffix}`
      : `${parsed.name}.${parsed.suffix}`
    const absPath = path.resolve(root, relPath)
    if (artifact) artifactContexts[absPath] = artifact

    if (seen[dedupKey]) {
      if (['flow', 'object', 'record'].includes(parsed.suffix) && parsed.name.includes('/')) {
        dataScopeConflicts.push({ key: dedupKey, name: parsed.name, suffix: parsed.suffix, paths: [seen[dedupKey], absPath] })
        delete index[parsed.suffix][parsed.name]
        delete flowRoutes[parsed.name]
        seen[dedupKey] = absPath
        continue
      }
      const hint = parsed.suffix === 'folder'
          ? '  Folder names must be unique across the project.'
          : parsed.suffix === 'canvas'
          ? '  Canvas IDs must be unique. Move or rename one file to resolve the collision.'
          : '  Flows, records, and objects are scoped to their prototype directory.\n' +
            '  If both files are global (outside src/prototypes/), rename one to avoid the collision.'

      throw new Error(
        `[storyboard-data] Duplicate ${parsed.suffix} "${parsed.id || parsed.name}"\n` +
        `  Found at: ${seen[dedupKey]}\n` +
        `  And at:   ${absPath}\n` +
        hint
      )
    }

    seen[dedupKey] = absPath

    // Canvas: index only by canonical ID. Basename aliases go in a separate map
    // so listCanvases() and viewfinder don't show duplicates.
    if (parsed.suffix === 'canvas' && parsed.id) {
      index.canvas[parsed.id] = absPath
      if (artifact?.kind === 'canvas' && parsed.legacyPathId) {
        registerCanvasAlias(parsed.legacyPathId, parsed.id)
      }
      if (artifact?.kind === 'canvas') {
        for (const legacyId of artifact.migrationAliases?.legacyCanvasIds || []) registerCanvasAlias(legacyId, parsed.id)
      }
      // Track basename for alias resolution (only when unique)
      canvasNameCount[parsed.name] = (canvasNameCount[parsed.name] || 0) + 1
      if (canvasNameCount[parsed.name] === 1) {
        registerCanvasAlias(parsed.name, parsed.id)
      } else {
        delete canvasAliases[parsed.name]
        ambiguousCanvasAliases.add(parsed.name)
      }
    } else {
      index[parsed.suffix][parsed.name] = absPath
    }

    // Track which folder a prototype belongs to
    if (parsed.suffix === 'prototype' && parsed.folder) {
      protoFolders[parsed.name] = parsed.folder
    }

    // Track inferred routes for flows
    if (parsed.suffix === 'flow' && parsed.inferredRoute) {
      flowRoutes[parsed.name] = parsed.inferredRoute
    }

    // Track inferred routes for canvases (keyed by canonical ID)
    if (parsed.suffix === 'canvas' && parsed.inferredRoute) {
      const canvasKey = parsed.id || parsed.name
      canvasRoutes[canvasKey] = parsed.inferredRoute
    }

    // Track canvas groups (canvases sharing a folder prefix)
    // Use canonical ID as key to match the canvas index
    if (parsed.suffix === 'canvas' && parsed.group) {
      const groupKey = parsed.id || parsed.name
      canvasGroups[groupKey] = parsed.group
    }

    // Track inferred routes for stories
    if (parsed.suffix === 'story' && parsed.inferredRoute) {
      storyRoutes[parsed.name] = parsed.inferredRoute
    }

  }

  return { index, protoFolders, flowRoutes, canvasRoutes, canvasAliases, canvasGroups, storyRoutes, dataScopeConflicts, artifactContexts, notebookArtifacts, scopeAliases }
}

/**
 * Recursively walk a parsed JSON value and replace `${varName}` patterns
 * in every string value. Only string values are processed — keys, numbers,
 * booleans, and null are left untouched.
 */
function resolveTemplateVars(obj, vars) {
  if (typeof obj === 'string') {
    let result = obj
    for (const [key, value] of Object.entries(vars)) {
      result = result.replaceAll(`\${${key}}`, value)
    }
    return result
  }
  if (Array.isArray(obj)) return obj.map(item => resolveTemplateVars(item, vars))
  if (obj !== null && typeof obj === 'object') {
    const out = {}
    for (const [key, value] of Object.entries(obj)) {
      out[key] = resolveTemplateVars(value, vars)
    }
    return out
  }
  return obj
}

/**
 * Compute path-based template variables for a data file.
 *
 * - currentDir:      directory of the file, relative to project root
 * - currentProto:    path to the prototype directory (e.g. src/prototypes/main.folder/Example)
 * - currentProtoDir: path to the first parent *.folder directory (e.g. src/prototypes/main.folder)
 */
function computeTemplateVars(absPath, root, artifact = null) {
  const relPath = path.relative(root, absPath).replace(/\\/g, '/')
  const currentDir = path.dirname(relPath).replace(/\\/g, '/')

  const protoMatch = relPath.match(/^(src\/prototypes\/(?:[^/]+\.folder\/)?[^/]+)\//)
  const currentProto = protoMatch && !protoMatch[1].endsWith('.folder') ? protoMatch[1] : ''

  const folderMatch = relPath.match(/^(src\/prototypes\/[^/]+\.folder)\//)
  const currentProtoDir = folderMatch ? folderMatch[1] : ''

  if (artifact?.kind === 'prototype') {
    return {
      currentDir,
      currentProto: artifact.folderPath,
      currentProtoDir: path.posix.dirname(artifact.folderPath) === '.' ? '' : path.posix.dirname(artifact.folderPath),
    }
  }
  return { currentDir, currentProto, currentProtoDir }
}

/**
 * Generate the virtual module source code.
 * Reads each data file, parses JSONC at build time, and emits pre-parsed
 * JavaScript objects — no runtime parsing needed.
 */
/**
 * Detect the indent style used by an existing JSON source. Falls back to
 * tabs when the source is empty or single-line.
 */
function detectFormatting(raw) {
  const m = raw.match(/^(\t|[ ]+)(?=["{[])/m)
  if (!m) return { tabSize: 1, insertSpaces: false }
  if (m[1] === '\t') return { tabSize: 1, insertSpaces: false }
  return { tabSize: m[1].length, insertSpaces: true }
}

/** Raw (tolerant-JSONC) application config object for a project root. */
function readAppConfigSource(appRoot) {
  for (const filePath of appConfigCandidates(appRoot)) {
    try {
      const parsed = parseJsonc(fs.readFileSync(filePath, 'utf-8'), [])
      if (parsed && typeof parsed === 'object') return parsed
    } catch { /* try the legacy name */ }
  }
  return null
}

/**
 * Build the virtual app-config module source for a Notebook/app root: the
 * resolved raw config (primary file, legacy fallback, package baseline),
 * embedded as a pure-JSON module so library entries survive the filename
 * rename without caring which file exists on disk.
 */
function buildAppConfigModule(appRoot, coreRoot) {
  const raw = readAppConfigSource(appRoot)
    || readCoreConfigFile(coreRoot, APP_CONFIG_PRIMARY)
    || readCoreConfigFile(coreRoot, APP_CONFIG_LEGACY)
    || {}
  return `const appConfig = JSON.parse(${JSON.stringify(JSON.stringify(raw))})\nexport default appConfig\n`
}

/**
 * Read the application config from the project root: primary
 * `hypercanvas.config.json` first, legacy `storyboard.config.json` as the
 * backwards-compatible fallback. Returns the parsed and defaulted config
 * object, or null if neither exists.
 */
function readConfig(root, coreRoot = root) {
  for (const configPath of appConfigCandidates(root)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8')
      const errors = []
      const config = parseJsonc(raw, errors)
      // Treat malformed JSON (e.g. mid-edit partial saves) as missing config
      if (errors.length > 0) return readBaselineConfig(coreRoot, configPath)
      // Normalize each layer before schema defaults can mask omitted Notebook
      // fields. This also preserves flat legacy settings and rejects invalid
      // Notebook values without losing the packaged internal configuration.
      const internalConfig = readCoreConfigFile(coreRoot, APP_CONFIG_PRIMARY)
        || readCoreConfigFile(coreRoot, APP_CONFIG_LEGACY)
      const internalAutoPlace = normalizeCanvasAutoPlace(internalConfig?.canvas?.autoPlace)
      const autoPlace = normalizeCanvasAutoPlace(config?.canvas?.autoPlace, internalAutoPlace)
      const resolved = getConfig(config)
      return {
        config: { ...resolved, canvas: { ...resolved.canvas, autoPlace } },
        configPath,
      }
    } catch {
      // try the legacy file, then the baseline
    }
  }
  return readBaselineConfig(coreRoot, resolveAppConfigPath(root))
}

/**
 * Fallback for when the consumer's application config is missing or
 * malformed. Reads the canonical baseline from the Hypercanvas package
 * itself (workspace or installed copy), then merges through getConfig so
 * the runtime never sees a missing themes block or other required keys.
 *
 * Returns `{ config: null }` only if no baseline is found anywhere, which
 * preserves the historical contract for callers that handle null.
 */
function readBaselineConfig(root, configPath) {
  const baseline = readCoreConfigFile(root, APP_CONFIG_PRIMARY)
    || readCoreConfigFile(root, APP_CONFIG_LEGACY)
  if (baseline) return { config: getConfig(baseline), configPath }
  return { config: null, configPath }
}

/**
   * Read toolbar.config.json from @dfosco/hypercanvas.
 * Returns the full config object with modes array.
 * Falls back to hardcoded defaults if not found.
 */
function readModesConfig(root) {
  const fallback = {
    modes: [
      { name: 'prototype', label: 'Navigate', hue: '#2a2a2a' },
      { name: 'inspect', label: 'Develop', hue: '#7655a4' },
      { name: 'present', label: 'Collaborate', hue: '#2a9d8f' },
      { name: 'plan', label: 'Canvas', hue: '#4a7fad' },
    ],
  }

  // Try local workspace path first (monorepo), then node_modules
  const candidates = [
    path.resolve(root, 'packages/storyboard/toolbar.config.json'),
    path.resolve(root, 'packages/storyboard/configs/modes.config.json'),
    path.resolve(root, 'node_modules/@dfosco/hypercanvas/toolbar.config.json'),
    path.resolve(root, 'node_modules/@dfosco/hypercanvas/configs/modes.config.json'),
  ]

  for (const filePath of candidates) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed.modes) && parsed.modes.length > 0) {
        return { modes: parsed.modes }
      }
    } catch {
      // try next candidate
    }
  }

  return fallback
}

/**
 * Read a JSON/JSONC file, returning null on failure.
 */
function readJsonFile(filePath) {  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const errors = []
    const parsed = parseJsonc(raw, errors)
    return errors.length === 0 ? parsed : null
  } catch {
    return null
  }
}

/**
 * Find a core config file from either the monorepo workspace or node_modules.
 */
function readCoreConfigFile(root, filename) {
  for (const p of coreConfigFileCandidates(root, filename)) {
    const parsed = readJsonFile(p)
    if (parsed) return parsed
  }
  return null
}

function coreConfigFileCandidates(root, filename) {
  return [
    path.resolve(root, `packages/storyboard/${filename}`),
    path.resolve(root, `packages/hypercanvas/${filename}`),
    path.resolve(root, `node_modules/@dfosco/hypercanvas/${filename}`),
  ]
}

/**
 * Resolve the absolute path of a library config file (returns the first
 * candidate that exists, or null). Used by syncScaffoldDir to copy raw
 * file contents (including comments) rather than re-serializing parsed JSON.
 */
function resolveCoreConfigFilePath(root, filename) {
  const candidates = [
    path.resolve(root, `packages/storyboard/${filename}`),
    path.resolve(root, `packages/hypercanvas/${filename}`),
    path.resolve(root, `node_modules/@dfosco/hypercanvas/${filename}`),
  ]
  for (const p of candidates) {
    try { fs.accessSync(p); return p } catch { /* try next */ }
  }
  return null
}

const SCAFFOLD_README = `# .hypercanvas/scaffold/

This directory is **always rewritten on dev-server boot** to reflect the
library's current default config files. The Hypercanvas server **never reads
config from this directory** — these files are reference copies for you to
customize.

## How to customize

1. Pick the config file you want to override (e.g. \`terminal.config.json\`).
2. Copy it next to the active application config. Projects may keep these files at the root or group them under \`config/\`; existing files are updated in place.
3. Copy only the keys you want to change from this reference, then edit them.
   Unspecified values inherit library defaults, so future updates (such as new
   agents or readiness signals) continue to reach your project.

## Why a separate directory?

- Customers who don't want to customize don't see config clutter at the root.
- Customers who do want to customize have all the defaults available as a
  living reference, version-bumped with every Hypercanvas release.
- Project files override the defaults; missing files mean "use library
  defaults". No empty placeholder files cluttering the project.

## What's in here

| File | What it covers |
|------|----------------|
| \`hypercanvas.config.json\` | Top-level config: themes, surfaces, modes, comments, workshop, customer-mode, repository |
| \`terminal.config.json\` | Terminal widgets + canvas agent CLIs (copilot/claude/codex/opencode) |
| \`toolbar.config.json\` | Toolbar tool registry + visibility |
| \`commandpalette.config.json\` | Command palette entries |
| \`paste.config.json\` | URL → widget paste rules |
| \`widgets.config.json\` | Widget defaults (size, behavior) |

Don't edit files in this directory — your changes will be overwritten on
the next dev-server boot. Copy a file to the root or \`config/\` first, then
keep only the settings you intend to customize.
`

const SCAFFOLD_FILES = [
  'hypercanvas.config.json',
  'storyboard.config.json',
  'terminal.config.json',
  'toolbar.config.json',
  'commandpalette.config.json',
  'paste.config.json',
  'widgets.config.json',
  'mascot.config.json',
]

/**
 * Sync `.hypercanvas/scaffold/` (legacy `.storyboard/scaffold/` for existing
 * Notebooks) with the library's current default config files. Always
 * overwrites — users must copy to the project root to customize. Idempotent
 * and best-effort.
 */
function syncScaffoldDir(root) {
  const runtimeRoot = resolveRuntimeDir(root)
  const scaffoldDir = path.resolve(runtimeRoot, 'scaffold')
  try { fs.mkdirSync(scaffoldDir, { recursive: true }) } catch { /* empty */ }

  const readmePath = path.resolve(scaffoldDir, 'README.md')
  try { fs.writeFileSync(readmePath, SCAFFOLD_README) } catch { /* empty */ }

  for (const filename of SCAFFOLD_FILES) {
    const src = resolveCoreConfigFilePath(root, filename)
    if (!src) continue
    const dest = path.resolve(scaffoldDir, filename)
    try {
      const raw = fs.readFileSync(src, 'utf-8')
      fs.writeFileSync(dest, raw)
    } catch { /* skip on error */ }
  }
}

/**
 * Deep-merge helper (same as loader.js deepMerge but available at build time).
 * Arrays are replaced, not concatenated. Objects are recursively merged.
 */
function deepMergeBuild(target, source) {
  if (!source || typeof source !== 'object') return target
  if (!target || typeof target !== 'object') return source
  const result = { ...target }
  for (const key of Object.keys(source)) {
    const sv = source[key]
    const tv = target[key]
    if (sv && typeof sv === 'object' && !Array.isArray(sv) && tv && typeof tv === 'object' && !Array.isArray(tv)) {
      result[key] = deepMergeBuild(tv, sv)
    } else if (Array.isArray(sv) && Array.isArray(tv) && sv.length > 0 && tv.length > 0 && sv[0]?.id && tv[0]?.id) {
      // Id-based array merge: override matching entries by id, keep the rest, append new ones
      const targetMap = new Map(tv.map(item => [item.id, item]))
      for (const item of sv) {
        targetMap.set(item.id, item.id && targetMap.has(item.id)
          ? deepMergeBuild(targetMap.get(item.id), item)
          : item)
      }
      result[key] = [...targetMap.values()]
    } else {
      result[key] = sv
    }
  }
  return result
}

/**
 * Build the unified config object by reading and merging all config sources.
 *
 * Priority (lowest → highest):
 *   configSchema defaults → core domain configs → storyboard.config.json → user domain configs
 *
 * Domain-specific config files (toolbar.config.json, commandpalette.config.json, etc.)
 * always win over storyboard.config.json — specificity beats generality.
 * Deep merge is used at every layer: objects are recursively merged (keys append),
 * arrays and scalars are replaced.
 *
 * Returns { unified, warnings } where warnings is an array of overlap messages.
 */
function buildUnifiedConfig(root, coreRoot = root) {
  const warnings = []

  // 1. Read core defaults (lowest priority domain configs)
  const coreToolbar = readCoreConfigFile(coreRoot, 'toolbar.config.json') || {}
  const coreCommandPalette = readCoreConfigFile(coreRoot, 'commandpalette.config.json') || {}
  const corePaste = readCoreConfigFile(coreRoot, 'paste.config.json') || {}
  const coreWidgets = readCoreConfigFile(coreRoot, 'widgets.config.json') || {}
  const coreTerminal = readCoreConfigFile(coreRoot, 'terminal.config.json') || {}

  // 2. Read storyboard.config.json (middle priority)
  // Use the schema-defaulted config for most things, but also read
  // the raw file to know which keys were explicitly set by the user.
  const { config: sbConfig } = readConfig(root, coreRoot)
  const rawSbConfig = readJsonFile(resolveAppConfigPath(root))
    || {}

  // 3. Apply storyboard.config.json overrides on top of core domain configs.
  // Only merge when the user explicitly defined the key in storyboard.config.json
  // (not from configSchema defaults, which would overwrite core config with empty arrays).
  const afterSbToolbar = rawSbConfig.toolbar
    ? deepMergeBuild(coreToolbar, sbConfig.toolbar)
    : coreToolbar
  const afterSbCommandPalette = rawSbConfig.commandPalette
    ? deepMergeBuild(coreCommandPalette, sbConfig.commandPalette)
    : coreCommandPalette
  const afterSbPaste = rawSbConfig.paste
    ? deepMergeBuild(corePaste, sbConfig.paste || {})
    : corePaste
  const afterSbWidgets = rawSbConfig.widgets
    ? deepMergeBuild(coreWidgets, sbConfig.widgets || {})
    : coreWidgets
  // For terminal/agents, slot canvas.terminal + canvas.agents from storyboard.config.json
  // into the same shape as terminal.config.json so the merge is uniform.
  const rawCanvas = rawSbConfig.canvas || {}
  const sbTerminalLike = (rawSbConfig.hotPool || rawCanvas.terminal || rawCanvas.agents)
    ? {
        ...(rawCanvas.terminal ? { terminal: sbConfig.canvas.terminal } : {}),
        ...(rawCanvas.agents ? { agents: sbConfig.canvas.agents } : {}),
        ...(rawSbConfig.hotPool ? { hotPool: sbConfig.hotPool } : {}),
      }
    : null
  const afterSbTerminal = sbTerminalLike
    ? deepMergeBuild(coreTerminal, sbTerminalLike)
    : coreTerminal

  // 4. Read user domain config files (highest priority)
  const userFiles = [
    { domain: 'widgets', filename: 'widgets.config.json' },
    { domain: 'paste', filename: 'paste.config.json' },
    { domain: 'toolbar', filename: 'toolbar.config.json' },
    { domain: 'commandPalette', filename: 'commandpalette.config.json' },
    { domain: 'terminal', filename: 'terminal.config.json' },
  ]

  const userConfigs = {}
  for (const { domain, filename } of userFiles) {
    const filePath = resolveConfigFilePath(root, filename)
    const parsed = readJsonFile(filePath)
    if (parsed) userConfigs[domain] = { data: parsed, filename }
  }

  // 5. Apply user domain configs on top of everything (highest priority)
  const finalToolbar = userConfigs.toolbar
    ? deepMergeBuild(afterSbToolbar, userConfigs.toolbar.data)
    : afterSbToolbar
  const finalCommandPalette = userConfigs.commandPalette
    ? deepMergeBuild(afterSbCommandPalette, userConfigs.commandPalette.data)
    : afterSbCommandPalette
  const finalPaste = userConfigs.paste
    ? deepMergeBuild(afterSbPaste, userConfigs.paste.data)
    : afterSbPaste
  const finalWidgets = userConfigs.widgets
    ? deepMergeBuild(afterSbWidgets, userConfigs.widgets.data)
    : afterSbWidgets
  const finalTerminal = userConfigs.terminal
    ? deepMergeBuild(afterSbTerminal, userConfigs.terminal.data)
    : afterSbTerminal

  // 6. Detect overlaps between storyboard.config.json and user domain configs
  const domainOverlapChecks = [
    { sbKey: 'toolbar', domain: 'toolbar', label: 'toolbar.config.json' },
    { sbKey: 'commandPalette', domain: 'commandPalette', label: 'commandpalette.config.json' },
    { sbKey: 'paste', domain: 'paste', label: 'paste.config.json' },
    { sbKey: 'widgets', domain: 'widgets', label: 'widgets.config.json' },
  ]
  for (const { sbKey, domain, label } of domainOverlapChecks) {
    if (rawSbConfig[sbKey] && userConfigs[domain]) {
      const overlaps = findOverlappingKeys(rawSbConfig[sbKey], userConfigs[domain].data)
      for (const key of overlaps) {
        warnings.push(`Config overlap: "${key}" is defined in both storyboard.config.json.${sbKey} and ${label} — ${label} wins.`)
      }
    }
  }
  // Check explicit legacy app config and dedicated terminal config values.
  // The merged object also contains core defaults and can combine both
  // storyboard.config.json.hotPool and storyboard.config.json.canvas settings;
  // comparing it wholesale reports false overlaps and the wrong source path.
  if (userConfigs.terminal) {
    const rawTerminalConfig = userConfigs.terminal.data
    const overlapSources = [
      {
        appValue: rawCanvas.terminal,
        terminalValue: rawTerminalConfig.terminal,
        prefix: 'terminal',
        appSource: 'storyboard.config.json.canvas.terminal',
        terminalSource: 'terminal.config.json.terminal',
      },
      {
        appValue: rawCanvas.agents,
        terminalValue: rawTerminalConfig.agents,
        prefix: 'agents',
        appSource: 'storyboard.config.json.canvas.agents',
        terminalSource: 'terminal.config.json.agents',
      },
      {
        appValue: rawSbConfig.hotPool,
        terminalValue: rawTerminalConfig.hotPool,
        prefix: 'hotPool',
        appSource: 'storyboard.config.json.hotPool',
        terminalSource: 'terminal.config.json.hotPool',
      },
    ]
    for (const { appValue, terminalValue, prefix, appSource, terminalSource } of overlapSources) {
      for (const key of findConflictingLeafPaths(appValue, terminalValue, prefix)) {
        warnings.push(`Config overlap: "${key}" differs between ${appSource} and ${terminalSource} — terminal.config.json wins.`)
      }
    }
  }

  // 7. Build the unified config object.
  // Start from the schema-defaulted sbConfig so every top-level key from
  // storyboard.config.json (and every schema default) flows to initConfig().
  // Then override the domain-specific slices that have their own dedicated
  // config files merged above (toolbar/commandPalette/paste/widgets/terminal).
  const sbCanvas = sbConfig?.canvas || {}
  const unified = {
    ...(sbConfig || {}),
    toolbar: finalToolbar,
    commandPalette: finalCommandPalette,
    paste: finalPaste,
    widgets: finalWidgets,
    hotPool: finalTerminal?.hotPool || sbConfig?.hotPool || {},
    canvas: {
      ...sbCanvas,
      terminal: deepMergeBuild(sbCanvas.terminal || {}, finalTerminal.terminal || {}),
      agents: deepMergeBuild(sbCanvas.agents || {}, finalTerminal.agents || {}),
      ...(finalTerminal.showAgentsInAddMenu !== undefined ? { showAgentsInAddMenu: finalTerminal.showAgentsInAddMenu } : {}),
    },
  }

  return { unified, warnings }
}

/**
 * Find top-level keys that exist in both objects (overlap detection).
 */
function findOverlappingKeys(a, b, prefix = '') {
  const overlaps = []
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return overlaps
  for (const key of Object.keys(a)) {
    if (key in b) {
      const path = prefix ? `${prefix}.${key}` : key
      overlaps.push(path)
    }
  }
  return overlaps
}

/**
 * Return shared JSON leaf paths whose explicit values differ. Objects are
 * compared recursively so equal/disjoint leaves do not produce warnings.
 */
function findConflictingLeafPaths(a, b, prefix) {
  const isRecordValue = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  if (isRecordValue(a) && isRecordValue(b)) {
    const conflicts = []
    for (const key of Object.keys(a)) {
      if (!(key in b)) continue
      conflicts.push(...findConflictingLeafPaths(a[key], b[key], `${prefix}.${key}`))
    }
    return conflicts
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length === b.length && a.every((value, index) => jsonValuesEqual(value, b[index]))) return []
    return [prefix]
  }
  return jsonValuesEqual(a, b) ? [] : [prefix]
}

function jsonValuesEqual(a, b) {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => jsonValuesEqual(value, b[index]))
  }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  return aKeys.length === bKeys.length
    && aKeys.every((key) => key in b && jsonValuesEqual(a[key], b[key]))
}

function extractPrototypeKnobs(parsed) {
  if (Array.isArray(parsed?.meta?.knobs)) return parsed.meta.knobs
  if (Array.isArray(parsed?.knobs)) return parsed.knobs
  return []
}

function extractComponentKnobs(parsed) {
  if (Array.isArray(parsed?.knobs)) return parsed.knobs
  if (Array.isArray(parsed?.meta?.knobs)) return parsed.meta.knobs
  return []
}

function viteModulePath(absPath, moduleRoot) {
  const relative = path.relative(moduleRoot, absPath)
  if (relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
    return '/' + relative.replace(/\\/g, '/')
  }
  return '/@fs/' + path.resolve(absPath).replace(/\\/g, '/')
}

function isPathInside(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

function packageNameForPath(filePath) {
  let directory = path.dirname(filePath)
  while (true) {
    const packagePath = path.join(directory, 'package.json')
    if (fs.existsSync(packagePath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
        if (typeof packageJson.name === 'string') return packageJson.name
      } catch {
        return null
      }
    }
    const parent = path.dirname(directory)
    if (parent === directory) return null
    directory = parent
  }
}

function isHypercanvasSourceLoaderImport(source, importer) {
  if (!source || !importer || importer.startsWith('\0')) return false
  const cleanSource = source.split('?')[0].split('#')[0].replaceAll('\\', '/')
  const cleanImporter = importer.split('?')[0].split('#')[0]
  const resolvedSource = path.resolve(path.dirname(cleanImporter), cleanSource)
  if (!/(?:^|[\\/])src[\\/]core[\\/]data[\\/]loader\.(?:[cm]?js|[cm]?ts)$/.test(resolvedSource)) return false
  return packageNameForPath(resolvedSource) === '@dfosco/hypercanvas'
}

/** Resolve an executable Notebook extension entry without allowing path escape or symlink escape. */
function resolveNotebookExtensionEntry(root, entry, directory, description, explicit = true) {
  const normalized = typeof entry === 'string' ? entry.replaceAll('\\', '/') : ''
  const segments = normalized.split('/')
  const extension = path.extname(normalized).toLowerCase()
  const supportedExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx', '.mts'])
  if (
    (!normalized.startsWith(`${directory}/`) && !normalized.startsWith(`backstage/${directory}/`))
    || normalized.startsWith('/')
    || segments.some(segment => !segment || segment === '.' || segment === '..')
    || !supportedExtensions.has(extension)
  ) {
    throw new Error(`[storyboard] Invalid ${description} entry "${entry}". Use a JavaScript/TypeScript module path inside ${directory}/.`)
  }

  const notebookRoot = fs.realpathSync.native(root)
  const absPath = resolveNotebookSupportPath(notebookRoot, normalized, { preferRoot: explicit })
  const allowedRoot = path.resolve(notebookRoot, absPath.startsWith(path.join(notebookRoot, 'backstage') + path.sep) ? `backstage/${directory}` : directory)
  if (!isPathInside(allowedRoot, absPath)) {
    throw new Error(`[storyboard] Invalid ${description} entry "${entry}". It must stay inside ${directory}/.`)
  }

  try {
    const realRoot = fs.realpathSync.native(notebookRoot)
    const realAllowedRoot = fs.realpathSync.native(allowedRoot)
    const realPath = fs.realpathSync.native(absPath)
    if (!isPathInside(realRoot, realAllowedRoot) || !isPathInside(realAllowedRoot, realPath) || !fs.statSync(realPath).isFile()) {
      throw new Error('outside the allowed extension directory or not a file')
    }
  } catch (error) {
    throw new Error(`[storyboard] Could not resolve ${description} entry "${entry}" under ${notebookRoot}: ${error.message}`)
  }

  return absPath
}

function generateNotebookExtensionMaps({ config, unifiedConfig, root, moduleRoot, imports, declarations }) {
  let i = 0
  const widgetDefinitions = {
    ...(config?.widgets || {}),
    ...(unifiedConfig?.widgets?.widgets || {}),
  }
  const widgetEntries = []
  let hasLazyWidget = false

  for (const [type, rawDefinition] of Object.entries(widgetDefinitions)) {
    if (!rawDefinition || typeof rawDefinition !== 'object' || Array.isArray(rawDefinition)) continue
    const { entry, ...definition } = rawDefinition
    const variable = `_notebookWidget${i++}`
    declarations.push(`const ${variable} = ${JSON.stringify(definition)}`)
    if (entry !== undefined) {
      const absPath = resolveNotebookExtensionEntry(root, entry, 'widgets', `widget "${type}"`)
      const modulePath = viteModulePath(absPath, moduleRoot)
      declarations.push(`${variable}.component = __notebookLazy(() => import(${JSON.stringify(modulePath)}))`)
      hasLazyWidget = true
    }
    widgetEntries.push(`  ${JSON.stringify(type)}: ${variable}`)
  }

  if (hasLazyWidget) imports.push(`import { lazy as __notebookLazy } from 'react'`)
  declarations.push(`const notebookWidgets = {\n${widgetEntries.join(',\n')}\n}`)

  const tools = unifiedConfig?.toolbar?.tools || {}
  const handlerEntries = new Map()
  for (const [toolId, toolConfig] of Object.entries(tools)) {
    const handlerRef = toolConfig?.handler
    if (typeof handlerRef !== 'string' || !handlerRef.startsWith('custom:')) continue
    const handlerId = handlerRef.slice('custom:'.length)
    if (!/^[A-Za-z0-9_-]+$/.test(handlerId)) {
      throw new Error(`[storyboard] Invalid custom tool handler id "${handlerId}" in toolbar tool "${toolId}".`)
    }
    const entry = toolConfig.entry || `tools/handlers/${handlerId}.js`
    if (handlerEntries.has(handlerId) && handlerEntries.get(handlerId).entry !== entry) {
      throw new Error(`[storyboard] Custom tool handler "${handlerId}" has conflicting entries.`)
    }
    handlerEntries.set(handlerId, { entry, explicit: toolConfig.entry !== undefined })
  }

  const toolEntries = []
  for (const [handlerId, { entry, explicit }] of handlerEntries) {
    let absPath
    try {
      absPath = resolveNotebookExtensionEntry(root, entry, 'tools', `tool handler "${handlerId}"`, explicit)
    } catch (error) {
      if (explicit) throw error
      console.warn(`[storyboard] ${error.message}; custom tool "${handlerId}" will not load.`)
      continue
    }
    toolEntries.push(`  ${JSON.stringify(handlerId)}: () => import(${JSON.stringify(viteModulePath(absPath, moduleRoot))})`)
  }
  declarations.push(`const notebookToolHandlers = {\n${toolEntries.join(',\n')}\n}`)
}

function buildDiscoveryResult({ index, protoFolders, flowRoutes, canvasRoutes, canvasAliases, canvasGroups, storyRoutes, dataScopeConflicts = [], artifactContexts = {}, notebookArtifacts = [], scopeAliases = {} }, root, moduleRoot = root) {
  const viewportScope = Object.keys(index.canvas || {}).length ? canvasViewportScope(root) : null
  const discovery = {
    flows: {},
    objects: {},
    records: {},
    prototypes: {},
    prototypeKnobs: {},
    componentKnobs: {},
    folders: {},
    canvases: {},
    canvasAliases: canvasAliases || {},
    scopeAliases: scopeAliases || {},
    stories: {},
  }
  const INDEX_KEYS = ['flow', 'object', 'record', 'prototype', 'folder', 'canvas']
  const resultKeys = {
    flow: 'flows',
    object: 'objects',
    record: 'records',
    prototype: 'prototypes',
    folder: 'folders',
    canvas: 'canvases',
  }
  const resolvedFlowRoutes = {}

  // Batch-fetch git metadata for all prototype + canvas files in 1-2 subprocesses
  const gitPaths = [
    ...Object.values(index.prototype || {}),
    ...Object.values(index.canvas || {}),
  ]
  const gitMeta = batchGitMetadata(root, gitPaths)

  // Read canvas-meta files and build a directory-based lookup
  const canvasMetaByDir = {}
  for (const [, absPath] of Object.entries(index['canvas-meta'] || {})) {
    try {
      const raw = fs.readFileSync(absPath, 'utf-8')
      const parsed = parseJsonc(raw)
      if (parsed) {
        // Key by the parent directory path relative to src/canvas/
        const dirPath = path.dirname(absPath).replace(/\\/g, '/')
        const canvasRelDir = dirPath.replace(/^.*?src\/canvas\//, '')
        canvasMetaByDir[canvasRelDir] = parsed
        // Drafts canvases derive their group with `drafts/` stripped, so also
        // index the meta under the stripped dir so the group lookup matches.
        const canvasRelDirPublic = canvasRelDir.split('/').filter(seg => seg !== 'drafts').join('/')
        if (canvasRelDirPublic !== canvasRelDir) canvasMetaByDir[canvasRelDirPublic] = parsed
      }
    } catch { /* skip invalid meta files */ }
  }

  for (const suffix of INDEX_KEYS) {
    for (const [name, absPath] of Object.entries(index[suffix])) {
      const artifact = artifactContexts[absPath]
      let raw
      try { raw = fs.readFileSync(absPath, 'utf-8') } catch (error) {
        // A deletion can reach the browser before the debounced unlink watcher
        // rebuilds this index. Omit that file rather than failing the whole UI.
        if (error.code === 'ENOENT') continue
        throw error
      }
      let parsed = suffix === 'canvas'
        ? materializeFromText(raw)
        : parseJsonc(raw)

      // Auto-fill gitAuthor for prototype metadata from git history
      if (suffix === 'prototype' && parsed && !parsed.gitAuthor) {
        const meta = gitMeta.get(absPath)
        if (meta?.gitAuthor) {
          parsed = { ...parsed, gitAuthor: meta.gitAuthor }
        }
      }

      if (suffix === 'prototype' && parsed && artifact?.kind === 'prototype') {
        // Keep the authored logical name as the data key; the catalog marker
        // remains separate from both that name and the public route.
        parsed = {
          ...parsed,
          dirName: name,
          route: artifact.route,
          artifactId: artifact.id,
        }
      }

      // Auto-fill lastModified from git history for prototypes and canvases
      if ((suffix === 'prototype' || suffix === 'canvas') && parsed) {
        const meta = gitMeta.get(absPath)
        if (meta?.lastModified) {
          parsed = { ...parsed, lastModified: meta.lastModified }
        }
      }

      // Inject folder association into prototype metadata
      if (suffix === 'prototype' && protoFolders[name]) {
        parsed = { ...parsed, folder: protoFolders[name] }
      }

      // Load prototype-level config overrides from the prototype directory.
      // Any config file placed alongside the .prototype.json becomes an override
      // for that domain when the prototype is active.
      if (suffix === 'prototype') {
        const protoDir = path.dirname(absPath)
        const protoConfigFiles = [
          { filename: 'toolbar.config.json', key: 'toolbarConfig' },
          { filename: 'commandpalette.config.json', key: 'commandPaletteConfig' },
          { filename: 'widgets.config.json', key: 'widgetsConfig' },
          { filename: 'paste.config.json', key: 'pasteConfig' },
        ]
        for (const { filename, key } of protoConfigFiles) {
          const cfgPath = path.join(protoDir, filename)
          if (fs.existsSync(cfgPath)) {
            try {
              const cfgRaw = fs.readFileSync(cfgPath, 'utf-8')
              const cfg = parseJsonc(cfgRaw)
              if (cfg) {
                parsed = { ...parsed, [key]: cfg }
              }
            } catch { /* skip invalid config */ }
          }
        }
      }

      // Inject inferred _route into flow data (explicit route takes precedence)
      if (suffix === 'flow' && flowRoutes[name] && !parsed?.route) {
        parsed = { ...parsed, _route: flowRoutes[name] }
      }

      // Track resolved route for multi-flow logging
      if (suffix === 'flow') {
        const route = parsed?.route || parsed?._route || null
        if (route) {
          resolvedFlowRoutes[name] = { route, isDefault: parsed?.meta?.default === true }
        }
      }

      // Auto-fill gitAuthor for canvas metadata from git history
      if (suffix === 'canvas' && parsed && !parsed.gitAuthor) {
        const meta = gitMeta.get(absPath)
        if (meta?.gitAuthor) {
          parsed = { ...parsed, gitAuthor: meta.gitAuthor }
        }
      }

      // Inject inferred route, group, and resolve JSX companion for canvases
      if (suffix === 'canvas') {
        parsed = { ...parsed, _viewportScope: viewportScope }
        if (canvasRoutes[name]) {
          parsed = { ...parsed, _route: canvasRoutes[name] }
        }
        if (canvasGroups[name]) {
          parsed = { ...parsed, _group: canvasGroups[name] }
        }
        // Inject canvas folder metadata from .meta.json
        if (canvasGroups[name] && canvasMetaByDir[canvasGroups[name]]) {
          parsed = { ...parsed, _canvasMeta: canvasMetaByDir[canvasGroups[name]] }
        }
        // Inject folder association
        const folderDirMatch = path.relative(root, absPath).replace(/\\/g, '/').match(/(?:^|\/)src\/(?:prototypes|canvas)\/([^/]+)\.folder\//)
        if (folderDirMatch) {
          parsed = { ...parsed, _folder: folderDirMatch[1] }
        }
        // Resolve JSX companion file path
        if (parsed?.jsx) {
          const jsxPath = path.resolve(path.dirname(absPath), parsed.jsx)
          if (fs.existsSync(jsxPath)) {
            const relJsx = viteModulePath(jsxPath, moduleRoot)
            parsed = { ...parsed, _jsxModule: relJsx }
          } else {
            console.warn(
              `[storyboard-data] Canvas "${name}" references JSX file "${parsed.jsx}" but it was not found at ${jsxPath}`
            )
          }
        }
      }

      // Resolve template variables (${currentDir}, ${currentProto}, ${currentProtoDir})
      const templateVars = computeTemplateVars(absPath, root, artifact)
      if (!templateVars.currentProto && raw.includes('${currentProto}')) {
        console.warn(
          `[storyboard-data] \${currentProto} used in "${path.relative(root, absPath)}" ` +
          `but file is not inside a prototype directory. Variable resolves to empty string.`
        )
      }
      if (!templateVars.currentProtoDir && raw.includes('${currentProtoDir}')) {
        console.warn(
          `[storyboard-data] \${currentProtoDir} used in "${path.relative(root, absPath)}" ` +
          `but file is not inside a .folder directory. Variable resolves to empty string.`
        )
      }
      parsed = resolveTemplateVars(parsed, templateVars)

      if (suffix === 'prototype') {
        const knobs = extractPrototypeKnobs(parsed)
        discovery.prototypeKnobs[name] = knobs
        // The knobs panel looks knobs up by the first URL segment, which for
        // notebook prototypes is the public route rather than the logical name.
        const routeKey = typeof artifact?.route === 'string'
          ? artifact.route.split('/').filter(Boolean)[0]
          : null
        if (routeKey) {
          let decoded = routeKey
          try { decoded = decodeURIComponent(routeKey) } catch { /* keep literal */ }
          if (!(decoded in discovery.prototypeKnobs)) discovery.prototypeKnobs[decoded] = knobs
        }
      }

      discovery[resultKeys[suffix]][name] = parsed
    }
  }

  // A valid prototype can consist of source modules without a metadata JSON
  // file. Seed those logical names from the catalog so viewfinder/publication
  // indexes still use Name while direct links use the catalog's Name.prototype.
  for (const artifact of notebookArtifacts) {
    if (artifact.kind !== 'prototype' || !artifact.available) continue
    const name = artifactFolderLogicalName(path.posix.basename(artifact.folderPath))
    if (!name) continue
    if (discovery.prototypes[name]) continue
    discovery.prototypes[name] = {
      dirName: name,
      route: artifact.route,
      artifactId: artifact.id,
      title: artifact.title,
    }
  }

  for (const [name, absPath] of Object.entries(index.component || {})) {
    const raw = fs.readFileSync(absPath, 'utf-8')
    let parsed = parseJsonc(raw)
    parsed = resolveTemplateVars(parsed, computeTemplateVars(absPath, root))
    discovery.componentKnobs[name] = extractComponentKnobs(parsed)
  }

  // Generate story entries (code modules with dynamic imports, not JSON data)
  for (const [name, absPath] of Object.entries(index.story || {})) {
    const relModule = viteModulePath(absPath, moduleRoot)
    const storyMeta = { _storyModule: relModule, _exportNames: parseStoryExportNames(absPath) }
    if (storyRoutes[name]) {
      storyMeta._route = storyRoutes[name]
    }
    const artifact = artifactContexts[absPath]
    if (artifact?.kind === 'component') {
      storyMeta._componentId = artifact.id
      storyMeta._componentRoute = artifact.route
      storyMeta._componentName = artifact.title
      storyMeta._storyFile = path.posix.relative(artifact.folderPath, path.relative(root, absPath).replaceAll('\\', '/'))
    }
    discovery.stories[name] = storyMeta
  }

  discovery._resolvedFlowRoutes = resolvedFlowRoutes
  if (dataScopeConflicts.length) discovery._dataScopeConflicts = dataScopeConflicts
  return discovery
}

export function buildDataDiscovery(root, opts = {}) {
  return buildDiscoveryResult(buildIndex(root, opts), root)
}

function generateModule(buildResult, root, applicationRoot = root) {
  const discovery = buildDiscoveryResult(buildResult, root, applicationRoot)
  const declarations = []
  const INDEX_KEYS = [
    ['flow', 'flows'],
    ['object', 'objects'],
    ['record', 'records'],
    ['prototype', 'prototypes'],
    ['folder', 'folders'],
    ['canvas', 'canvases'],
  ]
  const entries = { flow: [], object: [], record: [], prototype: [], folder: [], canvas: [] }
  const storyEntries = []
  const resolvedFlowRoutes = discovery._resolvedFlowRoutes || {}
  let i = 0

  for (const [suffix, key] of INDEX_KEYS) {
    for (const [name, parsed] of Object.entries(discovery[key])) {
      const varName = `_d${i++}`
      if (suffix === 'canvas' && parsed._jsxModule) {
        declarations.push(`const ${varName} = Object.assign(${JSON.stringify(parsed)}, { _jsxImport: () => import(${JSON.stringify(parsed._jsxModule)}) })`)
      } else {
        declarations.push(`const ${varName} = ${JSON.stringify(parsed)}`)
      }
      entries[suffix].push(`  ${JSON.stringify(name)}: ${varName}`)
    }
  }

  for (const [name, storyMeta] of Object.entries(discovery.stories || {})) {
    const varName = `_d${i++}`
    declarations.push(
      `const ${varName} = Object.assign(${JSON.stringify(storyMeta)}, { _storyImport: () => import(${JSON.stringify(storyMeta._storyModule)}) })`
    )
    storyEntries.push(`  ${JSON.stringify(name)}: ${varName}`)
  }

  const imports = [
    `import { init } from '@dfosco/hypercanvas/core/data/loader'`,
    `import { initKnobs } from '@dfosco/hypercanvas/core/knobs/discovery'`,
  ]
  const initCalls = [
    `init({ flows, objects, records, prototypes, folders, canvases, stories, scopeAliases })`,
    `initKnobs({ prototypeKnobs, componentKnobs })`,
  ]

  // Build unified config from all sources
  const { unified: unifiedConfig, warnings: configWarnings } = buildUnifiedConfig(root, applicationRoot)
  for (const w of configWarnings) {
    console.warn(`[storyboard] ⚠ ${w}`)
  }
  const { config } = readConfig(root, applicationRoot)
  generateNotebookExtensionMaps({ config, unifiedConfig, root, moduleRoot: applicationRoot, imports, declarations })
  imports.push(`import { initConfig } from '@dfosco/hypercanvas/core/stores/configStore'`)
  initCalls.push(`initConfig(${JSON.stringify(unifiedConfig)})`)

  // Feature flags from storyboard.config.json
  if (config?.featureFlags && Object.keys(config.featureFlags).length > 0) {
    imports.push(`import { initFeatureFlags } from '@dfosco/hypercanvas/core/stores/featureFlags'`)
    initCalls.push(`initFeatureFlags(${JSON.stringify(config.featureFlags)})`)
  }

  // Plugin configuration from storyboard.config.json
  if (config?.plugins && Object.keys(config.plugins).length > 0) {
    imports.push(`import { initPlugins } from '@dfosco/hypercanvas/core/stores/plugins'`)
    initCalls.push(`initPlugins(${JSON.stringify(config.plugins)})`)
  }

  // Modes configuration from storyboard.config.json
  if (config?.modes) {
    imports.push(`import { initModesConfig, registerMode, syncModeClasses, initTools } from '@dfosco/hypercanvas/core/modes/modes'`)
    initCalls.push(`initModesConfig(${JSON.stringify(config.modes)})`)

    if (config.modes.enabled) {
      imports.push(`import '@dfosco/hypercanvas/modes.css'`)

      const modesConfig = readModesConfig(root)
      const modes = config.modes.defaults || modesConfig.modes
      for (const m of modes) {
        initCalls.push(`registerMode(${JSON.stringify(m.name)}, { label: ${JSON.stringify(m.label)} })`)
      }

      initCalls.push(`syncModeClasses()`)
    }
  }

  // UI config from storyboard.config.json (menu visibility overrides)
  if (config?.ui) {
    imports.push(`import { initUIConfig } from '@dfosco/hypercanvas/core/stores/uiConfig'`)
    initCalls.push(`initUIConfig(${JSON.stringify(config.ui)})`)
  }

  // Customer mode config from storyboard.config.json
  if (config?.customerMode) {
    imports.push(`import { initCustomerModeConfig } from '@dfosco/hypercanvas/core/stores/customerModeConfig'`)
    initCalls.push(`initCustomerModeConfig(${JSON.stringify(config.customerMode)})`)
  }

  // Client toolbar overrides from the active root toolbar.config.json.
  // Emit null when the file is absent so re-evaluating this virtual module
  // clears an earlier pending override in the client store.
  const clientToolbarPath = resolveConfigFilePath(root, 'toolbar.config.json')
  let clientToolbarOverrides = null
  try {
    if (fs.existsSync(clientToolbarPath)) {
      const raw = fs.readFileSync(clientToolbarPath, 'utf-8')
      const errors = []
      const parsed = parseJsonc(raw, errors)
      if (parsed && errors.length === 0) {
        clientToolbarOverrides = parsed
      }
    }
  } catch { /* skip if unreadable */ }
  imports.push(`import { setClientToolbarOverrides } from '@dfosco/hypercanvas/core/stores/toolbarConfigStore'`)
  initCalls.push(`setClientToolbarOverrides(${JSON.stringify(clientToolbarOverrides)})`)

  // Log info when multiple flows target the same route
  const routeGroups = {}
  for (const [name, { route, isDefault }] of Object.entries(resolvedFlowRoutes)) {
    if (!routeGroups[route]) routeGroups[route] = []
    routeGroups[route].push({ name, isDefault })
  }
  for (const [route, flows] of Object.entries(routeGroups)) {
    if (flows.length > 1) {
      const defaults = flows.filter(f => f.isDefault)
      if (defaults.length > 1) {
        console.warn(
          `[storyboard-data] Warning: Route "${route}" has ${defaults.length} flows with meta.default: true.\n` +
          `  Only one flow per route should be marked as default.`
        )
      }
    }
  }

  return [
    imports.join('\n'),
    '',
    declarations.join('\n'),
    '',
    `const flows = {\n${entries.flow.join(',\n')}\n}`,
    `const objects = {\n${entries.object.join(',\n')}\n}`,
    `const records = {\n${entries.record.join(',\n')}\n}`,
    `const prototypes = {\n${entries.prototype.join(',\n')}\n}`,
    `const prototypeKnobs = ${JSON.stringify(discovery.prototypeKnobs || {})}`,
    `const componentKnobs = ${JSON.stringify(discovery.componentKnobs || {})}`,
    `const folders = {\n${entries.folder.join(',\n')}\n}`,
    `const canvases = {\n${entries.canvas.join(',\n')}\n}`,
    `const stories = {\n${storyEntries.join(',\n')}\n}`,
    '',
    `// Legacy basename → canonical ID aliases (only unique basenames)`,
    `const canvasAliases = ${JSON.stringify(discovery.canvasAliases || {})}`,
    `const scopeAliases = ${JSON.stringify(discovery.scopeAliases || {})}`,
    '',
    '// Backward-compatible alias',
    'const scenes = flows',
    '',
    initCalls.join('\n'),
    '',
    `export { flows, scenes, objects, records, prototypes, prototypeKnobs, componentKnobs, folders, canvases, canvasAliases, scopeAliases, stories, notebookWidgets, notebookToolHandlers }`,
    `export const index = { flows, scenes, objects, records, prototypes, prototypeKnobs, componentKnobs, folders, canvases, canvasAliases, scopeAliases, stories, notebookWidgets, notebookToolHandlers }`,
    `export default index`,
    '',
    '// Live-patch canvas data on Hypercanvas server events so SPA navigation shows fresh state',
    'if (typeof window !== "undefined") {',
    '  const storyModuleUrl = (modulePath, timestamp) => {',
    '    const relative = modulePath.replace("/@fs//", "/@fs/").replace(/^\\/+/, "")',
    '    const url = new URL(relative, new URL(import.meta.env.BASE_URL, window.location.origin))',
    '    if (timestamp) url.searchParams.set("t", timestamp)',
    '    return url.href',
    '  }',
    '  window.addEventListener("storyboard:canvas-file-changed", (event) => {',
    '    const data = event.detail',
    '    if (!data) return',
    '    const id = data.canvasId || data.name',
    '    if (data.removed) {',
    '      delete canvases[id]',
    '    } else if (data.metadata) {',
    '      // Merge into existing entry to preserve build-time fields (_jsxModule, _jsxImport, etc.)',
    '      canvases[id] = canvases[id]',
    '        ? Object.assign({}, canvases[id], data.metadata)',
    '        : data.metadata',
    '    }',
    '    init({ flows, objects, records, prototypes, folders, canvases, stories, scopeAliases })',
    '    initKnobs({ prototypeKnobs, componentKnobs })',
    '    document.dispatchEvent(new CustomEvent("storyboard:canvas-index-changed"))',
    '  })',
    '  window.addEventListener("storyboard:story-file-changed", (event) => {',
    '    const data = event.detail',
    '    if (!data) return',
    '    if (data.stories) {',
    '      for (const name of Object.keys(stories)) if (!(name in data.stories)) delete stories[name]',
    '      for (const [name, metadata] of Object.entries(data.stories)) {',
    '        // Keep untouched imports and React previews stable while reconciling the full index.',
    '        if (metadata._storyModule !== data.changedModule && JSON.stringify(stories[name]) === JSON.stringify(metadata)) continue',
    '        const moduleUrl = storyModuleUrl(metadata._storyModule, data.timestamp)',
    '        stories[name] = { ...metadata, _storyImport: () => import(/* @vite-ignore */ moduleUrl) }',
    '      }',
    '    } else if (data.removed) {',
    '      delete stories[data.name]',
    '    } else {',
    '      const moduleUrl = storyModuleUrl(data._storyModule, data.timestamp)',
    '      stories[data.name] = { ...stories[data.name], ...data,',
    '        _storyImport: () => import(/* @vite-ignore */ moduleUrl) }',
    '    }',
    '    init({ flows, objects, records, prototypes, folders, canvases, stories, scopeAliases })',
    '    initKnobs({ prototypeKnobs, componentKnobs })',
    '    document.dispatchEvent(new CustomEvent("storyboard:story-index-changed"))',
    '  })',
    '}',
    '',
    '// Filesystem watcher updates arrive through Vite custom HMR events.',
    'if (import.meta.hot && typeof window !== "undefined") {',
    '  import.meta.hot.on("storyboard:canvas-file-changed", (data) => window.dispatchEvent(new CustomEvent("storyboard:canvas-file-changed", { detail: data })))',
    '  import.meta.hot.on("storyboard:story-file-changed", (data) => window.dispatchEvent(new CustomEvent("storyboard:story-file-changed", { detail: data })))',
    '}',
  ].join('\n')
}

/**
 * Resolve the on-disk path for the generated themes CSS file
 * (`themes.generated.css`, a sibling of `tailwind.css`). Returns null
 * when the styles dir lives inside `node_modules` or a packaged `.app` —
 * published packages and signed apps ship their generated CSS and must never
 * trigger writes into their source trees.
 */
function resolveGeneratedThemesCssPath() {
  const stylesDir = path.dirname(fileURLToPath(new URL('../../core/styles/tailwind.css', import.meta.url)))
  if (stylesDir.split(path.sep).some(segment => segment === 'node_modules' || segment.endsWith('.app'))) return null
  return path.join(stylesDir, GENERATED_THEMES_CSS_FILENAME)
}

/**
 * Write `themes.generated.css` next to `tailwind.css` from the project's
 * themes config. No-op when:
 *  - the styles dir is inside `node_modules` or a packaged `.app` (the file
 *    ships pre-built), or
 *  - the new content is byte-identical to what's already on disk (avoids
 *    a chokidar → HMR feedback loop on every config touch).
 *
 * Returns the absolute path written (or null when skipped) so callers can
 * invalidate the corresponding Vite module graph entry.
 */
function writeThemesCssFile(rootDir, coreRoot = rootDir) {
  const outPath = resolveGeneratedThemesCssPath()
  if (!outPath) return null
  const { config: sbCfg } = readConfig(rootDir, coreRoot)
  const themesCfg = (sbCfg && sbCfg.theming) || getConfig({}).theming
  const next = generateThemesCss(themesCfg)
  try {
    const prev = fs.readFileSync(outPath, 'utf-8')
    if (prev === next) return outPath
  } catch { /* file may not exist yet */ }
  try {
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, next)
    return outPath
  } catch {
    return null
  }
}

/**
 * Vite plugin for storyboard data discovery.
 *
 * - Scans the repo for *.flow.json, *.scene.json (compat), *.object.json, *.record.json, *.canvas.jsonl, *.story.{jsx,tsx}
 * - Validates no two files share the same name+suffix (hard build error)
 * - Generates a virtual module `virtual:storyboard-data-index`
 * - Writes `themes.generated.css` next to `tailwind.css` exposing the
 *   `@custom-variant dark` Tailwind scaffolding for every configured
 *   theme surface (re-written on storyboard.config.json changes). A real
 *   on-disk file — not a virtual module — because `@tailwindcss/vite` and
 *   the standalone `tailwindcss` CLI resolve CSS `@import` paths through
 *   their own resolver that bypasses the Vite plugin chain.
 * - Watches for file additions/removals in dev mode
 */
export default function storyboardDataPlugin({ notebookRuntime = null, statefullyAdapter = null } = {}) {
  let root = ''
  let applicationRoot = ''
  let discoveryRoot = ''
  let contentOnly = false
  let buildResult = null
  let devServer = null
  let watchedContentRoot = null
  // Set by configResolved — true during `vite` (dev), false during `vite build`.
  let isBuild = false
  let outDir = ''

  // The active Notebook can switch at runtime via
  // /_hypercanvas/notebook-runtime/open, which only sets
  // HYPERCANVAS_NOTEBOOK_ROOT — no file watcher event fires for that.
  // Re-resolve the discovery root on every index request so the data
  // surface follows the switch, invalidating the cached index when the
  // root changed.
  function currentIndex() {
    const notebookRoot = notebookRuntime
      ? notebookRuntime.status().root
      : (process.env.HYPERCANVAS_NOTEBOOK_ROOT ? path.resolve(process.env.HYPERCANVAS_NOTEBOOK_ROOT) : null)
    const activeRoot = notebookRoot ?? root
    if (root && activeRoot !== discoveryRoot) {
      discoveryRoot = activeRoot
      contentOnly = activeRoot !== root
      buildResult = null
    }
    syncContentRootWatcher(activeRoot)
    if (!buildResult) buildResult = buildIndex(discoveryRoot, { contentOnly })
    return buildResult
  }

  function syncContentRootWatcher(activeRoot) {
    if (!devServer) return
    const nextRoot = activeRoot && activeRoot !== root ? path.resolve(activeRoot) : null
    if (nextRoot === watchedContentRoot) return
    if (watchedContentRoot) devServer.watcher.unwatch(watchedContentRoot)
    watchedContentRoot = nextRoot
    if (watchedContentRoot) devServer.watcher.add(watchedContentRoot)
  }

  return {
    name: 'storyboard-data',
    enforce: 'pre',
    transform(code, id) {
      const prototypeCss = prototypeCssTransform.call(this, code, id)
      if (prototypeCss) return prototypeCss

      // Statefully's React entry and the generated data-index must import its
      // default store through the same Vite module ID. Vite may append an
      // optimized-dependency version query to the package's relative import;
      // resolving both imports through this private alias avoids two stores.
      const sourcePath = id.split('?', 1)[0]
      if (path.resolve(sourcePath) !== STATEFULLY_REACT_SOURCE) return null
      const rewritten = code.replace(
        /(['"])\.\/core\/data\.js\1/g,
        `'${STATEFULLY_DATA_RUNTIME_ID}'`,
      )
      return rewritten === code ? null : { code: rewritten, map: null }
    },

    config() {
      return {
        optimizeDeps: {
          // @dfosco/hypercanvas is excluded (virtual module), so Vite
          // can't trace into its deps. Include the markdown pipeline entry
          // points so Vite pre-bundles the full chain — covers all transitive
          // CJS packages (debug, extend, etc.) without whack-a-mole.
          include: [
            'cmdk',
            'remark-parse', 'remark-gfm', 'remark-rehype',
            'rehype-raw', 'rehype-sanitize', 'rehype-stringify',
            'use-sync-external-store/shim', 'use-sync-external-store/shim/with-selector',
            'feather-icons', '@primer/octicons-react', 'ansi-to-html',
            'react-is',
            // Canvas schemas enter through a lazy route after workspace mount.
            'zod',
          ],
          exclude: ['@dfosco/hypercanvas', '@dfosco/statefully'],
        },
      }
    },

    configResolved(config) {
      root = config.root
      applicationRoot = root
      discoveryRoot = notebookRuntime
        ? (notebookRuntime.status().root || root)
        : (process.env.HYPERCANVAS_NOTEBOOK_ROOT ? path.resolve(process.env.HYPERCANVAS_NOTEBOOK_ROOT) : root)
      contentOnly = discoveryRoot !== root
      isBuild = config.command === 'build'
      outDir = path.resolve(root, config.build?.outDir || 'dist')

      // On dev boot, sync .storyboard/scaffold/ with the library's current
      // default config files as an up-to-date reference for partial overrides
      // for customizations. Files in .storyboard/scaffold/ are NEVER read by
      // the server — only files at the project root are. Always overwrites.
      if (config.command === 'serve') {
        try { syncScaffoldDir(root) } catch { /* best-effort */ }
      }

      // Write `themes.generated.css` so Tailwind can resolve the @import in
      // tailwind.css on the very first request. Runs for both `serve` and
      // `build`; safely no-ops inside node_modules or a packaged .app.
      try { writeThemesCssFile(discoveryRoot, applicationRoot) } catch { /* best-effort */ }
    },

    resolveId(id, importer) {
      const notebookRoot = notebookRuntime ? notebookRuntime.status().root : process.env.HYPERCANVAS_NOTEBOOK_ROOT
      const candidates = notebookRoot ? notebookSupportImportCandidates(notebookRoot, id, importer, applicationRoot) : []
      if (candidates.length) return (async () => {
        for (const candidate of candidates) {
          const resolved = await this.resolve(candidate, importer, { skipSelf: true })
          if (resolved) return resolved
        }
        return null
      })()
      if (id === '@dfosco/statefully/react') return STATEFULLY_COMPAT_REACT
      if (['@dfosco/statefully', '@dfosco/statefully/core', '@dfosco/statefully/session', '@dfosco/statefully/knobs'].includes(id)) return STATEFULLY_COMPAT_CORE
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_ID
      if (id === STATEFULLY_DATA_INDEX_VIRTUAL_ID) return STATEFULLY_DATA_INDEX_RESOLVED_ID
      if (id === STATEFULLY_DATA_RUNTIME_ID) return STATEFULLY_DATA_RUNTIME_SOURCE
      if (id === APP_CONFIG_VIRTUAL_ID) return id
      if (id === PROTOTYPE_ROUTES_VIRTUAL_ID) return id
      if (id === 'design-notebook/runtime/route') return DESIGN_NOTEBOOK_ROUTE_RUNTIME
      if (id === 'design-notebook/runtime/react') return DESIGN_NOTEBOOK_REACT_RUNTIME

      // App source imports the stateful loader relatively, while the virtual
      // data index imports its public package export. Resolve those relative
      // imports to that same package module so init() and every data consumer
      // share one loader instance in generated Notebook projects.
      if (id.startsWith('.') && isHypercanvasSourceLoaderImport(id, importer)) {
        return this.resolve('@dfosco/hypercanvas/core/data/loader', importer, { skipSelf: true }).then(resolved => {
          if (!resolved) this.error('Could not resolve the shared @dfosco/hypercanvas core data loader.')
          return resolved
        })
      }

      return undefined
    },

    load(id) {
      if (id === STATEFULLY_COMPAT_CORE || id === STATEFULLY_COMPAT_REACT) return statefullyCompatibilityModule({ coreSource: STATEFULLY_CORE_SOURCE, reactSource: STATEFULLY_REACT_SOURCE, helperSource: STATEFULLY_COMPAT_HELPER, react: id === STATEFULLY_COMPAT_REACT })
      if (id === RESOLVED_ID) {
        return generateModule(currentIndex(), discoveryRoot, applicationRoot)
      }
      if (id === APP_CONFIG_VIRTUAL_ID) {
        // The raw application config as a pure-JSON module. Resolves the
        // active file (primary hypercanvas.config.json, legacy fallback,
        // JSONC tolerated) so library entries stay filename-agnostic after
        // the Storyboard → Hypercanvas rename.
        let appRoot = discoveryRoot
        let configSourceRoot = applicationRoot
        if (notebookRuntime) {
          try {
            const activeRoot = notebookRuntime.status().root
            if (typeof activeRoot === 'string' && activeRoot.length > 0) appRoot = activeRoot
          } catch { /* keep discovery root */ }
        }
        return buildAppConfigModule(appRoot, configSourceRoot)
      }
      if (id === STATEFULLY_DATA_INDEX_RESOLVED_ID) {
        const index = statefullyAdapter?.getIndex?.() ?? { flows: {}, objects: {}, records: {}, prototypes: {}, components: {} }
        const diagnostics = statefullyAdapter?.getDiagnostics?.() ?? []
        // React imports the package's source-level core/data.js from react.jsx.
        // Initializing through the optimized package root creates a second
        // default store, leaving PrototypeProvider with an empty index.
        return `import { init } from '${STATEFULLY_DATA_RUNTIME_ID}';\nconst statefullyIndex = ${JSON.stringify(index)};\ninit(statefullyIndex);\nexport default statefullyIndex;\nexport const index = statefullyIndex;\nexport const diagnostics = ${JSON.stringify(diagnostics)};`
      }
      if (id === PROTOTYPE_ROUTES_VIRTUAL_ID) {
        // Route maps follow the active Notebook only — application-root
        // prototypes are already covered by the entry's own glob.
        const notebookRoot = notebookRuntime
          ? notebookRuntime.status().root
          : (process.env.HYPERCANVAS_NOTEBOOK_ROOT ? path.resolve(process.env.HYPERCANVAS_NOTEBOOK_ROOT) : null)
        return notebookPrototypeRouteSource(notebookRoot)
      }
      return null
    },

    configureServer(server) {
      devServer = server
      statefullyAdapter?.setModuleInvalidator?.(() => {
        const module = server.moduleGraph.getModuleById(STATEFULLY_DATA_INDEX_RESOLVED_ID)
        if (module) server.moduleGraph.invalidateModule(module)
        server.ws.send({ type: 'full-reload' })
      })
      currentIndex()
      // ── Iframe-isolation middlewares ──────────────────────────────
      // Both `prototypes.html` (prototype embeds) and `stories.html`
      // (story / component-set widgets) follow the same recipe — see
      // .agents/plans/vite-isolation.md and internals/canvas/isolation/
      // for the shared primitive. The middleware factory keeps both
      // surfaces in lockstep so a fix to one benefits the other.
      const prototypesEntryPath = new URL('../canvas/isolation/prototypesEntry.jsx', import.meta.url).pathname
      server.middlewares.use(createIsolationMiddleware(
        {
          name: 'prototypes.html',
          entryPath: prototypesEntryPath,
          surface: 'prototype',
          title: 'Hypercanvas · Prototypes',
          getThemes: () => readConfig(discoveryRoot, applicationRoot).config.theming,
        },
        { renderInlineBootstrapScript, server },
      ))

      const storiesEntryPath = new URL('../canvas/isolation/storiesEntry.jsx', import.meta.url).pathname
      server.middlewares.use(createIsolationMiddleware(
        {
          name: 'stories.html',
          entryPath: storiesEntryPath,
          // Use the prototype surface so stories follow the same theme as
          // prototype embeds (users toggle "prototype" in the theme menu
          // and expect both surfaces to track together).
          surface: 'prototype',
          title: 'Hypercanvas · Stories',
          getThemes: () => readConfig(discoveryRoot, applicationRoot).config.theming,
        },
        { renderInlineBootstrapScript, server },
      ))

      // ── Notebook prototype route map invalidation ─────────────────
      // Notebook prototype files live outside the application root, so Vite's
      // own module graph never invalidates the route map when they change.
      // Mirror the notebook-routes plugin's triggers for the data-plugin-hosted
      // map. When that plugin is registered it owns the full-reload broadcast;
      // otherwise this is the only route map in play and must broadcast itself.
      function notebookRootForRoutes() {
        return notebookRuntime
          ? notebookRuntime.status().root
          : (process.env.HYPERCANVAS_NOTEBOOK_ROOT ? path.resolve(process.env.HYPERCANVAS_NOTEBOOK_ROOT) : null)
      }
      function invalidatePrototypeRouteMap() {
        const module = server.moduleGraph.getModuleById(PROTOTYPE_ROUTES_VIRTUAL_ID)
        if (module) server.moduleGraph.invalidateModule(module)
        // The notebook-routes plugin's own watcher handler already broadcasts
        // a full-reload for these events; avoid a second one.
        if (!server.__hypercanvasNotebookRoutesReload) server.ws.send({ type: 'full-reload' })
      }
      const updatePrototypeRoutes = (file = '', eventType = 'add') => {
        if (isAtomicCanvasStagingFile(file)) return
        const notebookRoot = notebookRootForRoutes()
        if (!isNotebookPrototypeRouteMapEvent(notebookRoot, file, eventType)) return false
        invalidatePrototypeRouteMap()
        return true
      }
      server.watcher.on('add', (file) => updatePrototypeRoutes(file, 'add'))
      server.watcher.on('change', (file) => updatePrototypeRoutes(file, 'change'))
      server.watcher.on('unlink', (file) => updatePrototypeRoutes(file, 'unlink'))

      // ── Stories list API ──────────────────────────────────────────
      // Serves the list of discovered stories for the CLI and UI story picker.
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next()
        let url = req.url
        const baseNoTrail = (server.config.base || '/').replace(/\/$/, '')
        if (baseNoTrail && url.startsWith(baseNoTrail)) {
          url = url.slice(baseNoTrail.length) || '/'
        }
        if (!url.startsWith('/_hypercanvas/stories/list') && !url.startsWith('/_storyboard/stories/list')) return next()

        const current = currentIndex()
        const storyEntries = Object.entries(current.index.story || {})
        const storyRoutes = current.storyRoutes || {}
        const stories = storyEntries.map(([name]) => ({
          name,
          route: storyRoutes[name] || null,
        }))

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ stories }))
      })

      // ── Config API ────────────────────────────────────────────────
      // Read and write the application config (hypercanvas.config.json,
      // legacy storyboard.config.json stays writable in place) with
      // format-preserving edits.
      // GET  /_hypercanvas/config → { config, raw }
      // PUT  /_hypercanvas/config ← { updates: { "path.to.key": value, ... } }
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next()
        let url = req.url
        const baseNoTrail = (server.config.base || '/').replace(/\/$/, '')
        if (baseNoTrail && url.startsWith(baseNoTrail)) {
          url = url.slice(baseNoTrail.length) || '/'
        }
        if (!url.startsWith('/_hypercanvas/config') && !url.startsWith('/_storyboard/config')) return next()
        // Exact match — avoid catching /config-something
        const configBase = url.startsWith('/_hypercanvas/config') ? '/_hypercanvas/config' : '/_storyboard/config'
        if (url !== configBase && !url.startsWith(`${configBase}?`)) return next()

        let configPath
        try {
          configPath = notebookRuntime
            ? notebookRuntime.resolveAppConfigWritePath()
            : resolveAppConfigWritePath(discoveryRoot)
        } catch (error) {
          res.writeHead(409, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: error.message, code: error.code }))
          return
        }

        if (req.method === 'GET') {
          try {
            const raw = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf-8') : '{}'
            const { unified: config } = buildUnifiedConfig(discoveryRoot, applicationRoot)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ config, raw }))
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }

        if (req.method === 'PUT') {
          let body = ''
          for await (const chunk of req) body += chunk
          try {
            const { updates } = JSON.parse(body)
            if (!updates || typeof updates !== 'object') {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Missing updates object' }))
              return
            }

            const raw = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf-8') : '{\n}\n'
            const formatting = detectFormatting(raw)
            let next = raw
            for (const [dotPath, value] of Object.entries(updates)) {
              const pathSegments = dotPath.split('.')
              const edits = modify(next, pathSegments, value, { formattingOptions: formatting })
              next = applyEdits(next, edits)
            }
            fs.writeFileSync(configPath, next, 'utf-8')

            if (_onHotPoolConfigChange && Object.keys(updates).some(k => k.startsWith('hotPool.'))) {
              try { _onHotPoolConfigChange() } catch { /* best effort */ }
            }

            const { unified: config } = buildUnifiedConfig(discoveryRoot, applicationRoot)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ config, raw: next }))
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }

        next()
      })

      // Watch for data file changes in dev mode
      const watcher = server.watcher
      const knownCanvasIds = new Set(Object.keys(currentIndex().index.canvas || {}))
      const pendingCanvasUnlinks = new Map()

      const parseWatchedFile = (filePath) => {
        // A Notebook switch changes discoveryRoot without restarting Vite.
        // Normalize watcher paths exactly like buildIndex() so an external
        // `canvas/foo.canvas.jsonl` is not re-added as `canvas/foo` alongside
        // its content-only `foo` identity.
        currentIndex()
        const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath)
        const relative = path.relative(discoveryRoot, absolute)
        const outsideDiscoveryRoot = relative === '..'
          || relative.startsWith(`..${path.sep}`)
          || path.isAbsolute(relative)
        if (contentOnly && outsideDiscoveryRoot) return null
        const normalized = relative.replace(/\\/g, '/')
        let parsePath = contentOnly ? `src/${normalized}` : normalized
        let artifact = null
        if (contentOnly) {
          const catalog = inspectNotebook(discoveryRoot)
          artifact = catalog.artifacts
            .filter(item => normalized === item.folderPath || normalized.startsWith(`${item.folderPath}/`))
            .sort((left, right) => right.folderPath.length - left.folderPath.length)[0] || null
          const suffixAncestor = normalized.split('/').slice(0, -1).findIndex(segment => /\.(prototype|component|canvas|site)$/.test(segment))
          if (suffixAncestor >= 0 && !artifact) return null
          if (artifact) {
            if (!artifact.available || artifact.kind === 'site') return null
            const inside = normalized.slice(`${artifact.folderPath}/`.length)
            if (inside.split('/').slice(0, -1).some(segment => /\.(prototype|component|canvas|site)$/.test(segment))) return null
            const logicalName = artifactFolderLogicalName(path.posix.basename(artifact.folderPath))
            if (!logicalName) return null
            if (artifact.kind === 'canvas') {
              if (normalized !== artifact.payloadPath) return null
              parsePath = `src/canvas/${logicalName}.canvas.jsonl`
            } else if (artifact.kind === 'prototype') {
              parsePath = `src/prototypes/${logicalName}/${inside}`
            } else {
              parsePath = `src/components/${logicalName}/${inside}`
            }
          }
        }
        const parsed = parseDataFile(parsePath, { notebookMode: contentOnly })
        if (!parsed || !artifact) return parsed
        const logicalName = artifactFolderLogicalName(path.posix.basename(artifact.folderPath))
        if (!logicalName) return null
        if (artifact.kind === 'canvas') {
          parsed.id = artifact.id
          parsed.name = logicalName
          parsed.inferredRoute = artifact.route
        } else if (artifact.kind === 'prototype') {
          if (parsed.suffix === 'prototype') parsed.name = logicalName
          if (parsed.suffix === 'flow' && parsed.inferredRoute && artifact.route) {
            parsed.inferredRoute = `${artifact.route}${parsed.inferredRoute.slice(`/${logicalName}`.length)}`
          }
        } else if (artifact.kind === 'component' && parsed.suffix === 'story') {
          const inside = normalized.slice(`${artifact.folderPath}/`.length).replace(/\.stor(?:y|ies)\.[jt]sx?$/, '')
          const primary = normalized === artifact.payloadPath
          parsed.name = primary ? logicalName : `${logicalName}/${inside}`
          parsed.inferredRoute = primary ? artifact.route : `${artifact.route}/${inside.split('/').map(encodeURIComponent).join('/')}`
        }
        return parsed
      }

      const isNotebookExtensionFile = (filePath) => {
        currentIndex()
        const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath)
        const relative = path.relative(discoveryRoot, absolute)
        if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return false
        return ['widgets', 'tools'].includes(relative.split(path.sep)[0])
      }

      const triggerFullReload = () => {
        buildResult = null
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) {
          server.moduleGraph.invalidateModule(mod)
          server.ws.send({ type: 'full-reload' })
        }
      }

      // Mark the virtual module as stale so the next page load rebuilds it,
      // but do NOT trigger a full-reload (avoids losing canvas editing state).
      const softInvalidate = () => {
        buildResult = null
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
      }

      const invalidateCatalogMarker = (filePath, eventType) => {
        currentIndex()
        if (!contentOnly || path.basename(filePath) !== '.hypercanvas-artifact.json') return false
        const absolute = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(discoveryRoot, filePath)
        const relative = path.relative(discoveryRoot, absolute)
        if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return false
        buildResult = null
        const module = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (module) server.moduleGraph.invalidateModule(module)
        const routeHandled = isNotebookPrototypeRouteMapEvent(discoveryRoot, absolute, eventType)
        // The route-map watcher owns the single reload for prototype markers.
        // Other catalog markers still change the data index and need a reload.
        if (!routeHandled) server.ws.send({ type: 'full-reload', path: absolute })
        return true
      }

      // Read a canvas file and build HMR metadata for the client-side listener.
      const readCanvasMetadata = (filePath, parsed) => {
        try {
          const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(discoveryRoot, filePath)
          const raw = fs.readFileSync(absPath, 'utf-8')
          const materialized = materializeFromText(raw)
          const result = { ...materialized, _viewportScope: canvasViewportScope(discoveryRoot) }
          // Inject _route and _folder the same way generateModule does
          if (parsed.inferredRoute) result._route = parsed.inferredRoute
          const folderDirMatch = path.relative(discoveryRoot, absPath).replace(/\\/g, '/').match(/(?:^|\/)(?:src\/)?(?:prototypes|canvas)\/([^/]+)\.folder\//)
          if (folderDirMatch) result._folder = folderDirMatch[1]
          return result
        } catch {
          return null
        }
      }

      // A primary story's removal can promote another module and change its
      // story ID/route. Publish the complete index atomically, including the
      // empty case, rather than patching only the watcher event's old name.
      const publishStoryIndex = (filePath) => {
        if (!/\.stor(?:y|ies)\.[jt]sx?$/.test(filePath)) return false
        const absolute = path.resolve(root, filePath)
        const relative = path.relative(discoveryRoot, absolute)
        if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return false
        softInvalidate()
        const stories = buildDiscoveryResult(currentIndex(), discoveryRoot, applicationRoot).stories
        server.ws.send({ type: 'custom', event: 'storyboard:story-file-changed', data: {
          stories, changedModule: viteModulePath(absolute, applicationRoot), timestamp: Date.now(),
        } })
        return true
      }

      const invalidate = (filePath) => {
        const normalized = filePath.replace(/\\/g, '/')
        if (isAtomicCanvasStagingFile(normalized)) return
        if (invalidateCatalogMarker(filePath, 'change')) return
        if (isNotebookPrototypeRouteMapEvent(discoveryRoot, filePath, 'change')) {
          buildResult = null
          const module = server.moduleGraph.getModuleById(RESOLVED_ID)
          if (module) server.moduleGraph.invalidateModule(module)
          return
        }
        // Canvas .jsonl content changes are mutated at runtime by the canvas
        // server API. A full-reload would create a feedback loop (save →
        // file change → reload → lose editing state). Instead, soft-invalidate
        // the virtual module (so page refresh picks up changes) and send a
        // custom HMR event with updated metadata so the canvas page and
        // viewfinder can react in place.
        if (/\.canvas\.jsonl$/.test(normalized)) {
          // If this file change was caused by the canvas server API, it has
          // already pushed an HMR event via pushCanvasUpdate(). Skip the
          // duplicate watcher-triggered event to prevent stale-data rollbacks.
          const absPath = path.resolve(root, filePath)
          if (!isCanvasWriteInFlight(absPath)) {
            const parsed = parseWatchedFile(filePath)
            if (parsed?.suffix === 'canvas' && parsed?.id) {
              const metadata = readCanvasMetadata(filePath, parsed)
              server.ws.send({
                type: 'custom',
                event: 'storyboard:canvas-file-changed',
                data: { canvasId: parsed.id, name: parsed.id, ...(metadata ? { metadata } : {}) },
              })
            }
          }
          softInvalidate()
          return
        }

        // Invalidate when any config file inside a prototype changes
        const protoConfigPattern = /\/(toolbar|commandpalette|widgets|paste|terminal)\.config\.json$/
        if (protoConfigPattern.test(normalized) && normalized.includes('/prototypes/')) {
          buildResult = null
          const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
          if (mod) {
            server.moduleGraph.invalidateModule(mod)
            server.ws.send({ type: 'full-reload', path: normalized })
          }
          return
        }

        // Invalidate when root toolbar.config.json changes
        const toolbarPaths = resolveConfigFileCandidates(root, 'toolbar.config.json')
        if (toolbarPaths.some(toolbarPath => normalized === toolbarPath.split(path.sep).join('/') || normalized === toolbarPath)) {
          buildResult = null
          const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
          if (mod) {
            server.moduleGraph.invalidateModule(mod)
            server.ws.send({ type: 'full-reload', path: normalized })
          }
          return
        }

        if (publishStoryIndex(filePath)) return
        const parsed = parseWatchedFile(filePath)
        // Also invalidate when files are added/removed inside .folder/ directories
        const inFolder = normalized.includes('.folder/')
        const inExtensionDirectory = isNotebookExtensionFile(filePath)
        if (!parsed && !inFolder && !inExtensionDirectory) return
        if (inExtensionDirectory) {
          triggerFullReload()
          return
        }
        // Source files inside .folder/ dirs (jsx, css, etc.) are handled by
        // Vite's built-in HMR / React Fast Refresh — don't full-reload for them.
        if (!parsed && inFolder) return

        // Rebuild index and invalidate virtual module
        buildResult = null
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) {
          server.moduleGraph.invalidateModule(mod)
          server.ws.send({ type: 'full-reload' })
        }
      }

      const invalidateOnAddRemove = (filePath, eventType) => {
        if (isAtomicCanvasStagingFile(filePath)) return
        if (invalidateCatalogMarker(filePath, eventType)) return
        const routeMapEvent = isNotebookPrototypeRouteMapEvent(discoveryRoot, filePath, eventType)
        if (publishStoryIndex(filePath)) return
        const parsed = parseWatchedFile(filePath)
        const inFolder = filePath.replace(/\\/g, '/').includes('.folder/')
        if (!parsed && !inFolder && !routeMapEvent) return
        // Source files (jsx, css, etc.) inside .folder/ dirs are handled by
        // Vite's built-in HMR — don't trigger a full-reload for them.
        if (!parsed && inFolder) return

        // Canvas writers/editors can emit unlink+add for an in-place save.
        // Treat canvas add/unlink as runtime data updates and never full-reload
        // from watcher events. Canvas pages sync from disk via custom WS events.
        if (parsed?.suffix === 'canvas') {
          const canvasId = parsed.id || parsed.name
          if (eventType === 'unlink') {
            const timer = setTimeout(() => {
              pendingCanvasUnlinks.delete(canvasId)
              knownCanvasIds.delete(canvasId)
              server.ws.send({
                type: 'custom',
                event: 'storyboard:canvas-file-changed',
                data: { canvasId, name: canvasId, removed: true },
              })
              softInvalidate()
            }, 1500)
            pendingCanvasUnlinks.set(canvasId, timer)
            return
          }

          if (eventType === 'add') {
            const metadata = readCanvasMetadata(filePath, parsed)
            const pending = pendingCanvasUnlinks.get(canvasId)
            if (pending) {
              // unlink+add pair = in-place save (atomic write), not a real remove
              clearTimeout(pending)
              pendingCanvasUnlinks.delete(canvasId)
              server.ws.send({
                type: 'custom',
                event: 'storyboard:canvas-file-changed',
                data: { canvasId, name: canvasId, ...(metadata ? { metadata } : {}) },
              })
              softInvalidate()
              return
            }

            if (knownCanvasIds.has(canvasId)) {
              server.ws.send({
                type: 'custom',
                event: 'storyboard:canvas-file-changed',
                data: { canvasId, name: canvasId, ...(metadata ? { metadata } : {}) },
              })
              softInvalidate()
              return
            }

            knownCanvasIds.add(canvasId)
            server.ws.send({
              type: 'custom',
              event: 'storyboard:canvas-file-changed',
              data: { canvasId, name: canvasId, ...(metadata ? { metadata } : {}) },
            })
            softInvalidate()
            return
          }
        }

        // The route watcher sends the single reload for prototype route events.
        // Other supported data additions/removals still need to refresh the app.
        if (routeMapEvent) {
          buildResult = null
          const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
          if (mod) server.moduleGraph.invalidateModule(mod)
          return
        }
        triggerFullReload()
      }

      // Watch both application config names. The primary name takes precedence
      // when present; a legacy-only notebook migrates to primary on sibling-order writes.
      const { configPath } = readConfig(discoveryRoot, applicationRoot)
      watcher.add(configPath)
      watcher.add(path.resolve(discoveryRoot, 'config'))
      const appConfigPaths = new Set(appConfigCandidates(discoveryRoot))
      for (const appConfigPath of appConfigPaths) watcher.add(appConfigPath)
      const readWatchedConfig = () => {
        for (const appConfigPath of appConfigPaths) {
          try { return fs.readFileSync(appConfigPath, 'utf-8') } catch { /* try the legacy name */ }
        }
        return null
      }
      const siblingOrderTracker = createSiblingOrderChangeTracker(readWatchedConfig())

      // Watch all root domain config files for changes
      const domainConfigNames = [
        'toolbar.config.json',
        'commandpalette.config.json',
        'paste.config.json',
        'widgets.config.json',
        'terminal.config.json',
      ]
      const domainConfigFiles = domainConfigNames.flatMap(f => resolveConfigFileCandidates(discoveryRoot, f))
      // Package defaults are merged into the virtual module, but live outside
      // discoveryRoot when the active Notebook is external. Watch all Core
      // candidates so edits invalidate the same merged module as overrides.
      const coreToolbarConfigFiles = coreConfigFileCandidates(applicationRoot, 'toolbar.config.json')
      const watchedConfigPaths = new Set([...appConfigPaths, ...domainConfigFiles])
      watchedConfigPaths.add(path.resolve(discoveryRoot, 'config'))
      for (const filePath of coreToolbarConfigFiles) watchedConfigPaths.add(filePath)
      for (const p of domainConfigFiles) watcher.add(p)
      for (const p of coreToolbarConfigFiles) watcher.add(p)
      watcher.add(['widgets', 'tools'].map(directory => path.resolve(discoveryRoot, directory)))

      const invalidateConfig = (filePath) => {
        const resolved = path.resolve(filePath)
        if (!watchedConfigPaths.has(resolved)) return false

        if (appConfigPaths.has(resolved)) {
          const raw = readWatchedConfig()
          const classification = siblingOrderTracker.observe(raw)
          if (classification === 'unchanged') return true
          if (classification === 'order-only') {
            if (!notebookRuntime) {
              server.ws.send({
                type: 'custom',
                event: 'storyboard:notebook-order-changed',
                data: {},
              })
            }
            return true
          }
        }

        buildResult = null
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) {
          server.moduleGraph.invalidateModule(mod)
          server.ws.send({ type: 'full-reload', path: resolved })
        }
        // Only the application config supplies theme surfaces. Toolbar and
        // other domain config changes do not affect the generated CSS.
        if (appConfigPaths.has(resolved)) {
          const themesPath = writeThemesCssFile(discoveryRoot, applicationRoot)
          if (themesPath) {
            const mods = server.moduleGraph.getModulesByFile(themesPath)
            if (mods) {
              for (const m of mods) server.moduleGraph.invalidateModule(m)
            }
          }
        }
        return true
      }

      watcher.on('add', (filePath) => {
        if (!invalidateConfig(filePath)) invalidateOnAddRemove(filePath, 'add')
      })
      watcher.on('unlink', (filePath) => {
        if (!invalidateConfig(filePath)) invalidateOnAddRemove(filePath, 'unlink')
      })
      watcher.on('change', (filePath) => {
        if (!invalidateConfig(filePath)) {
          if (!invalidateCatalogMarker(filePath, 'change')) invalidate(filePath)
        }
      })

      // Cross-plugin hook: lets the artifact route force a synchronous index
      // rebuild + HMR notify after writing a new file, so the client doesn't
      // race chokidar (which can lag 50-300ms behind a writeFile call) and
      // hit a 404 on the just-created canvas/story/page.
      globalThis.__HYPERCANVAS_NOTIFY_ARTIFACT_CHANGE__ = (filePath, eventType = 'add') => {
        try {
          if (filePath) invalidateOnAddRemove(filePath, eventType)
          else softInvalidate()
        } catch { /* best-effort */ }
      }
    },


    handleHotUpdate(ctx) {
      const normalized = ctx.file.replace(/\\/g, '/')
      if (isAtomicCanvasStagingFile(normalized)) {
        // Atomic canvas replacement writes a sibling temp file before rename.
        // It is not a route or module update; let the final canvas event drive
        // the client update without Vite's fallback full-page reload.
        return []
      }
      if (/\.canvas\.jsonl$/.test(normalized)) {
        // Canvas JSONL: the watcher 'change' handler soft-invalidates and
        // emits a custom HMR event. Drop Vite's default full-reload.
        return []
      }

      // Prototype / component / template edits: defer to Fast Refresh.
      // Returning ctx.modules unchanged keeps Vite's normal HMR pipeline —
      // module-level updates flow, no full-reload fallback. If Fast Refresh
      // can't apply (mixed-export file etc.), the unified document policy
      // will hold the resulting full reload and let the user apply it
      // manually for those edge cases.
      if (/\/src\/(prototypes|components|templates)\//.test(normalized)
          && /\.(jsx?|tsx?|mdx)$/.test(normalized)) {
        return ctx.modules
      }

      return undefined
    },

    // Inject __SB_BRANCHES__ + __SB_CURRENT_BRANCH__ into HTML so the
    // Viewfinder/BranchBar can reflect the live git state. With the
    // proxy/daemon removed, the URL no longer carries a /branch--<name>/
    // segment to parse, so we read `git branch --show-current` server-side.
    transformIndexHtml(html, ctx) {
      // Only inject in dev mode
      if (!ctx.server) return html

      let currentBranch = null
      const branchResult = spawnSync('git', ['branch', '--show-current'], {
        cwd: root,
        encoding: 'utf-8',
        timeout: 10000,
      })
      if (branchResult.status === 0) {
        currentBranch = branchResult.stdout.trim() || null
      } else if (!isMissingGitRepository(branchResult)) {
        const stderr = String(branchResult.stderr || '').trim()
        const reason = branchResult.error?.message || stderr || `git branch exited with status ${branchResult.status}`
        console.warn(`[storyboard] Could not read the optional current branch in ${root}: ${reason}`)
      }

      const scripts = []
      if (currentBranch) {
        scripts.push(`<script>window.__SB_CURRENT_BRANCH__ = ${JSON.stringify(currentBranch)};</script>`)
      }

      try {
        const servers = listRunningServers()
        const runningByName = new Map(servers.map(s => [s.worktree, s]))
        const onDisk = listWorktrees()
        const allNames = new Set([...onDisk, ...runningByName.keys()])
        if (allNames.size > 0) {
          const branches = []
          for (const name of allNames) {
            if (name === 'main') continue
            const srv = runningByName.get(name)
            branches.push({
              branch: name,
              folder: `branch--${name}`,
              running: !!srv,
              port: srv?.port ?? null,
              url: srv ? `http://localhost:${srv.port}/storyboard/` : null,
            })
          }
          if (branches.length > 0) {
            scripts.push(`<script>window.__SB_BRANCHES__ = ${JSON.stringify(branches)};</script>`)
          }
        }
      } catch { /* fall through */ }

      if (scripts.length === 0) return html
      return html.replace('</head>', `${scripts.join('\n')}\n</head>`)
    },

    // Rebuild index on each build start
    buildStart() {
      buildResult = null
    },

    closeBundle() {
      if (!isBuild) return
      if (!outDir || !fs.existsSync(outDir)) return

      const discovery = buildDiscoveryResult(currentIndex(), discoveryRoot, applicationRoot)
      const env = resolveManifestEnv({ env: process.env, cwd: root })
      const manifest = buildArtifactManifest({ discovery, env })
      const outPath = path.resolve(outDir, 'artifacts.json')
      fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`)
    },

    // Emit terminal snapshots into the build so TerminalReadWidget can
    // fetch them as static files in production (no dev-server API).
    generateBundle() {
      // 1. Consolidated snapshot indexes (agents.snapshot.json + agents-txt.snapshot.json)
      // The public dir keeps whichever name the project already tracks.
      const publicDirs = [
        notebookContentPath(discoveryRoot, 'assets', '.hypercanvas-public', 'terminal-snapshots'),
        notebookContentPath(discoveryRoot, 'assets', '.storyboard-public', 'terminal-snapshots'),
      ]
      const emittedIds = new Set()
      for (const publicDir of publicDirs) {
        if (!fs.existsSync(publicDir)) continue
        for (const file of fs.readdirSync(publicDir)) {
          if (file !== 'agents.snapshot.json' && file !== 'agents-txt.snapshot.json') continue
          const full = path.join(publicDir, file)
          const source = fs.readFileSync(full, 'utf-8')
          this.emitFile({
            type: 'asset',
            fileName: `_hypercanvas/terminal-snapshots/${file}`,
            source,
          })
          if (file === 'agents.snapshot.json') {
            try {
              const parsed = JSON.parse(source)
              for (const id of Object.keys(parsed?.agents || {})) emittedIds.add(id)
            } catch { /* empty */ }
          }
        }
      }

      // 2. Runtime snapshots (nested by canvas dir) — skip if already in index.
      // Both runtime directory names are walked (legacy first).
      for (const runtimeName of ['.storyboard', '.hypercanvas']) {
        const legacyDir = path.resolve(discoveryRoot, `${runtimeName}/terminal-snapshots`)
        if (!fs.existsSync(legacyDir)) continue
        const walk = (dir) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true })
          for (const entry of entries) {
            const full = path.join(dir, entry.name)
            if (entry.isDirectory()) {
              walk(full)
            } else if (entry.name.endsWith('.json') && !entry.name.startsWith('~')) {
              const widgetId = entry.name.replace(/\.json$/, '')
              if (emittedIds.has(widgetId)) continue
              const rel = path.relative(legacyDir, full).replace(/\\/g, '/')
              this.emitFile({
                type: 'asset',
                fileName: `_hypercanvas/terminal-snapshots/${rel}`,
                source: fs.readFileSync(full, 'utf-8'),
              })
            }
          }
        }
        walk(legacyDir)
      }
    },
  }
}

/**
 * Vite plugin that copies terminal snapshots into the build output
 * so TerminalReadWidget can fetch them as static files in production.
 *
 * Sources (in priority order):
 *   1. assets/.hypercanvas-public/terminal-snapshots/agents.snapshot.json (consolidated index — all agents)
 *   2. assets/.hypercanvas-public/terminal-snapshots/agents-txt.snapshot.json (text payloads, keyed by widgetId)
 *   3. legacy assets/.storyboard-public/terminal-snapshots/* equivalents
 *   4. <runtime>/terminal-snapshots/<canvasDir>/<widgetId>.json (legacy, nested)
 *
 * All are emitted to `_hypercanvas/terminal-snapshots/` in the build.
 */
export function terminalSnapshotPlugin() {
  return {
    name: 'hypercanvas-terminal-snapshots',

    generateBundle() {
      // The committed public snapshot directory keeps whichever name the
      // project already tracks (legacy `.storyboard-public` stays readable).
      const publicDirs = [
        notebookContentPath(process.cwd(), 'assets', '.hypercanvas-public', 'terminal-snapshots'),
        notebookContentPath(process.cwd(), 'assets', '.storyboard-public', 'terminal-snapshots'),
      ]
      const emittedIds = new Set()
      for (const publicDir of publicDirs) {
        if (!fs.existsSync(publicDir)) continue
        for (const file of fs.readdirSync(publicDir)) {
          if (file !== 'agents.snapshot.json' && file !== 'agents-txt.snapshot.json') continue
          const full = path.join(publicDir, file)
          const source = fs.readFileSync(full, 'utf-8')
          this.emitFile({
            type: 'asset',
            fileName: `_hypercanvas/terminal-snapshots/${file}`,
            source,
          })
          if (file === 'agents.snapshot.json') {
            try {
              const parsed = JSON.parse(source)
              for (const id of Object.keys(parsed?.agents || {})) emittedIds.add(id)
            } catch { /* empty */ }
          }
        }
      }

      const legacyDir = path.resolve('.storyboard/terminal-snapshots')
      if (fs.existsSync(legacyDir)) {
        const walk = (dir) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true })
          for (const entry of entries) {
            const full = path.join(dir, entry.name)
            if (entry.isDirectory()) {
              walk(full)
            } else if (entry.name.endsWith('.json') && !entry.name.startsWith('~')) {
              const widgetId = entry.name.replace(/\.json$/, '')
              if (emittedIds.has(widgetId)) continue
              const rel = path.relative(legacyDir, full).replace(/\\/g, '/')
              this.emitFile({
                type: 'asset',
                fileName: `_hypercanvas/terminal-snapshots/${rel}`,
                source: fs.readFileSync(full, 'utf-8'),
              })
            }
          }
        }
        walk(legacyDir)
      }
    },
  }
}

// Exported for testing
export { resolveTemplateVars, computeTemplateVars, parseDataFile, buildDiscoveryResult }
