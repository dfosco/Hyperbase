import { describe, expect, it } from 'vitest'
import { createDocumentResolvers } from './resolvers.js'
describe('document host resolution', () => {
  const artifacts = [{ id: 'demo', type: 'prototype', route: '/demo', views: [{ id: 'request', path: '/request?mode=1#anchor' }] },
    { id: 'site', type: 'site', folderPath: 'web.site', descriptor: { local: { developmentUrl: 'http://localhost:3000' }, published: { url: 'https://example.org' }, views: [{ id: 'books', path: '/books', screenshot: 'poster.png' }] } }]
  it('uses actual content-only paths, preserving prototype root and exact view state', () => {
    const resolver = createDocumentResolvers({ artifacts, base: '/branch--docs/' })
    expect(resolver.resolveArtifact('demo', { kind: 'prototype', viewId: 'request' }).url).toBe('/branch--docs/prototypes.html/demo/request?mode=1&_sb_embed=#anchor')
    expect(resolver.resolveArtifact('demo', { kind: 'prototype', viewId: 'missing' }).available).toBe(false)
  })
  it('preserves Site view routes and static screenshot/link semantics', () => {
    const resolver = createDocumentResolvers({ artifacts, mode: 'static', assets: { 'web.site/poster.png': '/assets/poster.png' } })
    expect(resolver.resolveArtifact('site', { kind: 'site', viewId: 'books' })).toEqual({ available: true, url: 'https://example.org/books', screenshot: '/assets/poster.png' })
    expect(resolver.resolveArtifact('site', { kind: 'site', viewId: 'missing' }).available).toBe(false)
  })
  it('uses the consumer Statefully entry for exact portable views under a branch', () => {
    const portable = { ...artifacts[0], runtime: { id: '@dfosco/statefully', version: '0.2.1' } }
    const resolver = createDocumentResolvers({ artifacts: [portable], base: '/branch--docs/' })
    expect(resolver.resolveArtifact('demo', { kind: 'prototype', viewId: 'request' }).url)
      .toBe('/branch--docs/__notebook/prototypes/demo/request?mode=1&_sb_embed=#anchor')
    expect(resolver.resolveArtifact('demo', { kind: 'prototype', viewId: 'missing' }).available).toBe(false)
  })
  it('parses canonical query/hash before appending a selected view', () => {
    const resolver = createDocumentResolvers({ artifacts: [{ ...artifacts[0], route: '/demo?base=1#original' }] })
    expect(resolver.resolveArtifact('demo', { kind: 'prototype', viewId: 'request' }).url).toBe('/prototypes.html/demo/request?base=1&mode=1&_sb_embed=#anchor')
  })
  it('prefers local development view over explicit published URL and supports relative static bases', () => {
    const site = { ...artifacts[1], views: [{ id: 'books', path: '/books', publishedUrl: 'https://published.example/books' }] }
    expect(createDocumentResolvers({ artifacts: [site] }).resolveArtifact('site', { kind: 'site', viewId: 'books' }).url).toBe('http://localhost:3000/books')
    expect(createDocumentResolvers({ artifacts, mode: 'static', base: './', baseUrl: 'https://host.example/branch/docs/review' }).resolveArtifact('demo', { kind: 'prototype', viewId: 'request' }).url).toBe('/branch/demo/request?mode=1&_sb_embed=#anchor')
  })
  it('rejects duplicate or mismatched kinds and resolves only declared assets', () => {
    const resolver = createDocumentResolvers({ artifacts: [...artifacts, artifacts[0]] })
    expect(resolver.resolveArtifact('demo', { kind: 'prototype' }).available).toBe(false)
    expect(resolver.resolveAsset('../secret').available).toBe(false)
  })
})
