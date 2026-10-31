#!/usr/bin/env node
/**
 * Generate the theme CSS after Core compilation and before tests or packaging.
 * Both source Tailwind builds and compiled Core consumers need this asset.
 * A clean build must not depend on a previous Vite session having written it.
 *
 * Config precedence: repository hypercanvas.config.json, repository legacy
 * storyboard.config.json, package hypercanvas.config.json, package legacy
 * storyboard.config.json. With no config, emit the legacy surface variants.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const packageDir = path.resolve(here, '..')
const repoRoot = path.resolve(packageDir, '..', '..')
const coreStylesModule = path.join(packageDir, 'dist', 'core', 'styles', 'generateThemesCss.js')
if (!fs.existsSync(coreStylesModule)) {
  throw new Error('Compiled Core is required before generating theme CSS. Run `npm run build:core` first.')
}
const { generateThemesCss, GENERATED_THEMES_CSS_FILENAME } = await import(pathToFileURL(coreStylesModule).href)

const candidates = [
  path.join(repoRoot, 'hypercanvas.config.json'),
  path.join(repoRoot, 'storyboard.config.json'),
  path.join(packageDir, 'hypercanvas.config.json'),
  path.join(packageDir, 'storyboard.config.json'),
]

let themesCfg = null
let usedPath = null
for (const candidate of candidates) {
  if (!fs.existsSync(candidate)) continue
  try {
    const raw = JSON.parse(fs.readFileSync(candidate, 'utf-8'))
    themesCfg = raw?.theming || {}
    usedPath = candidate
    break
  } catch (err) {
    console.warn(`[gen-themes-css] failed to parse ${candidate}: ${err.message}`)
  }
}

if (!usedPath) {
  console.warn('[gen-themes-css] no Hypercanvas config found; emitting legacy-only dark variant')
  themesCfg = {}
}

const css = generateThemesCss(themesCfg)
const source = usedPath ? path.relative(repoRoot, usedPath) : '(none)'
for (const tree of ['src', 'dist']) {
  const stylesDir = path.join(packageDir, tree, 'core', 'styles')
  const outPath = path.join(stylesDir, GENERATED_THEMES_CSS_FILENAME)
  // Avoid touching unchanged source assets: Core's watcher observes this tree.
  if (fs.existsSync(outPath) && fs.readFileSync(outPath, 'utf8') === css) continue
  fs.mkdirSync(stylesDir, { recursive: true })
  fs.writeFileSync(outPath, css)
  console.log(`[gen-themes-css] wrote ${path.relative(repoRoot, outPath)} (source: ${source})`)
}
