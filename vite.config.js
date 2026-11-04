import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { defineConfig } from 'vite'
import notebook from '@dfosco/hypercanvas/notebook/vite'
const root = path.dirname(fileURLToPath(import.meta.url))
const runtimeRequire = createRequire(path.join(root, 'vendor/hypercanvas/package.json'))
const runtimePackage = runtimeRequire('./package.json')
if (runtimePackage.dependencies.react !== runtimePackage.dependencies['react-dom']) throw new Error('Portable Notebook React/react-dom pins do not match. Run hypercanvas prepare again to reconcile the runtime.')
function runtimeReact(name) {
  try {
    const manifest = runtimeRequire.resolve(name + '/package.json')
    const relative = path.relative(root, manifest)
    if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error(name + ' resolved outside this Notebook')
    const expected = runtimePackage.dependencies[name]
    const actual = runtimeRequire(manifest).version
    if (actual !== expected) throw new Error(name + ' resolved to ' + actual + ', expected ' + expected)
    return path.dirname(manifest)
  } catch (error) {
    throw new Error('Portable Notebook React dependencies are missing or stale. Run npm install in this Notebook and reconcile its lockfile; the vendored runtime must resolve its exact React/react-dom pair. ' + error.message, { cause: error })
  }
}
const react = runtimeReact('react')
const reactDom = runtimeReact('react-dom')
const reactDomExports = runtimeRequire('react-dom/package.json').exports || {}
const browserAliases = Object.fromEntries(['server', 'static'].filter(name => reactDomExports['./' + name + '.browser']).map(name => ['react-dom/' + name, runtimeRequire.resolve('react-dom/' + name + '.browser')]))
export default defineConfig({ plugins: [notebook({ notebookRoot: path.join(root, '.'), base: process.env.VITE_BASE_PATH || "./" })], resolve: { alias: { ...browserAliases, react, 'react-dom': reactDom, '@': path.join(root, '.') } } })
