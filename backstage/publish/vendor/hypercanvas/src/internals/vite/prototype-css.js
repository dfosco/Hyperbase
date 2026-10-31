/** Prototype CSS is explicit and belongs to the prototype, never to Core. */
import fs from 'node:fs'
import path from 'node:path'
import { parse as parseJsonc } from 'jsonc-parser'

function inside(root, file) {
  const relative = path.relative(root, file)
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

export function resolvePrototypeCss(directory, metadata) {
  const css = metadata?.css ?? metadata?.meta?.css
  if (css === undefined) return null
  if (!css || typeof css !== 'object' || Array.isArray(css)) throw new Error('Prototype css must be an object with library and entry')
  if (Object.keys(css).some(key => !['library', 'entry'].includes(key))) throw new Error('Unknown prototype css option; use library and entry')
  const { library, entry } = css
  if (typeof library !== 'string' || !/^(?:css|(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+)$/.test(library)) {
    throw new Error('Prototype css.library must be "css" or an npm package name')
  }
  if (typeof entry !== 'string' || !entry.startsWith('./') || !entry.endsWith('.css') || /[\0?#\\]/.test(entry)) {
    throw new Error('Prototype css.entry must be a relative ./stylesheet.css path')
  }
  const root = fs.realpathSync(directory)
  const candidate = path.resolve(root, entry)
  if (!inside(root, candidate)) throw new Error('Prototype CSS entry must stay inside its prototype directory')
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) throw new Error(`Prototype CSS entry is missing: ${candidate}`)
  const file = fs.realpathSync(candidate)
  if (!inside(root, file)) throw new Error('Prototype CSS symlink escapes its prototype directory')
  let packageFile = null
  if (library !== 'css') {
    packageFile = path.join(root, 'package.json')
    if (!fs.existsSync(packageFile)) throw new Error(`Declare ${library} in ${packageFile} and install it before loading this prototype`)
    const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'))
    const version = pkg.dependencies?.[library] || pkg.devDependencies?.[library]
    if (typeof version !== 'string' || !version.trim()) throw new Error(`Prototype package.json must explicitly declare its ${library} dependency`)
  }
  return { library, entry: file, packageFile }
}

/** Called by the existing data plugin, so consumers need no extra plugin. */
export function prototypeCssTransform(code, id) {
  const [file, query = ''] = id.split('?', 2)
  const params = new URLSearchParams(query)
  if (params.has('raw') || params.has('url') || params.has('worker')) return null
  if (!/\.(?:[jt]sx?|mdx)$/.test(file) || !file.split(path.sep).includes('prototypes')) return null
  let directory = path.dirname(file)
  while (directory !== path.dirname(directory) && path.basename(directory) !== 'prototypes') {
    if (!fs.existsSync(directory)) return null
    const files = fs.readdirSync(directory).filter(name => /\.prototype\.jsonc?$/.test(name)).sort()
    const configured = files.flatMap(name => {
      const metadataFile = path.join(directory, name)
      const errors = []
      const metadata = parseJsonc(fs.readFileSync(metadataFile, 'utf8'), errors)
      if (errors.length) throw new Error(`Invalid prototype metadata: ${metadataFile}`)
      if (metadata?.css === undefined && metadata?.meta?.css === undefined) return []
      return [{ metadataFile, css: resolvePrototypeCss(directory, metadata) }]
    })
    if (configured.length > 1) throw new Error(`Only one CSS declaration is allowed per prototype directory: ${directory}`)
    if (configured.length === 1) {
      const { metadataFile, css } = configured[0]
      this?.addWatchFile?.(metadataFile)
      this?.addWatchFile?.(css.entry)
      if (css.packageFile) this?.addWatchFile?.(css.packageFile)
      // Normal module imports let Vite compile the prototype's own stylesheet,
      // track HMR and resolve its own packages. Never import Core Tailwind here.
      const frontmatter = file.endsWith('.mdx') ? /^(?:---\r?\n)[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(code)?.[0] || '' : ''
      return { code: `${frontmatter}import ${JSON.stringify(css.entry)};\n${code.slice(frontmatter.length)}`, map: null }
    }
    directory = path.dirname(directory)
  }
  return null
}
