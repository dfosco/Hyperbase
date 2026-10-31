import {
  generateModalRoutes,
  generateRegularRoutes,
} from '@generouted/react-router/core'

// generouted treats dots, bracket parameters, leading plus and other route
// syntax as structure. A suffix artifact's whole root is one literal segment;
// child segments must continue through generouted unchanged.
const ARTIFACT_ROOT = /(^|\/)([^/]+\.prototype)(?=\/|$)/g

function artifactRootNames(keys) {
  const names = new Set()
  for (const key of keys) {
    for (const match of key.matchAll(ARTIFACT_ROOT)) names.add(match[2])
  }
  return names
}

function protectArtifactRoots(value, replacements) {
  return value.replace(ARTIFACT_ROOT, (_match, prefix, root) => `${prefix}${replacements.get(root)}`)
}

function routeRootReplacements(keys) {
  const names = artifactRootNames(keys)
  let prefix = 'HypercanvasLiteralPrototypeRoot'
  while ([...keys].some(key => key.includes(prefix))) prefix += 'X'
  return new Map([...names].map((name, index) => [name, `${prefix}${index}Token`]))
}

function restoreArtifactRoots(value, replacements) {
  if (typeof value !== 'string') return value
  for (const [name, token] of replacements) value = value.replaceAll(token, name)
  return value
}

function restoreRoute(route, replacements) {
  if (typeof route.path === 'string') route.path = restoreArtifactRoots(route.path, replacements)
  if (typeof route.id === 'string') route.id = restoreArtifactRoots(route.id, replacements)
  if (route.children) route.children.forEach(child => restoreRoute(child, replacements))
  return route
}

export function compileRegularRoutes(files, buildRoute) {
  const originalKeys = new Map()
  const replacements = routeRootReplacements(Object.keys(files))
  const protectedFiles = Object.fromEntries(Object.entries(files).map(([key, module]) => {
    const protectedKey = protectArtifactRoots(key, replacements)
    originalKeys.set(protectedKey, key)
    return [protectedKey, module]
  }))
  const routes = generateRegularRoutes(protectedFiles, (module, key) => buildRoute(module, originalKeys.get(key) ?? restoreArtifactRoots(key, replacements)))
  return routes.map(route => restoreRoute(route, replacements))
}

export function compileModalRoutes(files) {
  const replacements = routeRootReplacements(Object.keys(files))
  const protectedFiles = Object.fromEntries(
    Object.entries(files).map(([key, module]) => [protectArtifactRoots(key, replacements), module]),
  )
  return Object.fromEntries(
    Object.entries(generateModalRoutes(protectedFiles)).map(([key, value]) => [restoreArtifactRoots(key, replacements), value]),
  )
}
