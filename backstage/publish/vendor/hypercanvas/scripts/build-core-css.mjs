#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileCoreStyles } from '../src/internals/vite/core-css.js'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const development = process.argv.includes('--dev')
if (process.argv.slice(2).some(arg => arg !== '--dev')) throw new Error('Usage: build-core-css.mjs [--dev]')
const { css, manifest } = await compileCoreStyles({ packageRoot, development })
for (const output of ['dist/tailwind.css', 'dist/core/styles/tailwind.css']) {
  const file = path.join(packageRoot, output)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, css)
}
fs.writeFileSync(path.join(packageRoot, 'dist/core-css.manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`[hypercanvas:css] ${manifest.mode}: ${manifest.classes.length} classes, ${manifest.variables.length} variables, ${Buffer.byteLength(css)} bytes`)
