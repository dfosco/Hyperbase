import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NestedArtifactRepairDialog, NotebookSidebarTree } from './NotebookSidebarTree.jsx'

const artifact = (id, parentPath = 'A/B/C', extra = {}) => ({
  kind: 'artifact', ref: { kind: 'artifact', id }, id, pageId: id, artifactKind: 'prototype',
  name: `${id}.prototype`, title: id, path: `${parentPath}/${id}.prototype`, parentPath, depth: parentPath.split('/').length + 1,
  payloadPath: `${parentPath}/${id}.prototype/index.jsx`, route: `/${id}`, siteId: null, available: true, diagnostics: [], ...extra,
})
const folder = (name, path, depth, children = [], reorderSiblings = true) => ({
  kind: 'folder', ref: { kind: 'folder', path }, name, path, parentPath: path.split('/').slice(0, -1).join('/'), depth,
  capabilities: { reorderSiblings }, children,
})
function makeTree(overrides = {}) {
  const leaf = folder('Three', 'One/Two/Three', 3, [
    folder('Four', 'One/Two/Three/Four', 4, [artifact('Detail', 'One/Two/Three/Four')]),
    artifact('Sibling', 'One/Two/Three'),
  ])
  const level2 = folder('Two', 'One/Two', 2, [leaf, artifact('Shallow', 'One/Two')])
  const root = { kind: 'folder', ref: null, name: 'Notebook', path: '', parentPath: null, depth: 0, capabilities: { reorderSiblings: true }, children: [folder('One', 'One', 1, [level2]), artifact('RootPage', '')] }
  return { root: { ...root, ...overrides.root }, capabilities: { reorderSiblings: true }, ...overrides }
}

afterEach(() => vi.restoreAllMocks())

describe('NotebookSidebarTree', () => {
  it('hides backstage/publish fallback subtrees while respecting explicit canonical replacement rules', () => {
    const children = [
      folder('backstage', 'backstage', 1, [artifact('Support', 'backstage')]),
      folder('publish', 'publish', 1, [artifact('Generated', 'publish')]),
      folder('_private', '_private', 1, [artifact('Private', '_private')]),
      folder('Research', 'Research', 1, [artifact('Visible', 'Research')]),
    ]
    const tree = makeTree({ root: { children } })
    const { rerender } = render(<NotebookSidebarTree tree={tree} />)
    expect(screen.queryByRole('button', { name: /^backstage$/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^publish$/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Support$/ })).toBeNull()
    expect(screen.getByRole('button', { name: /^Research$/ })).toBeTruthy()
    rerender(<NotebookSidebarTree tree={{ ...tree, sidebarIgnored: [] }} published />)
    expect(screen.getByRole('button', { name: /^backstage$/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^publish$/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^_private$/ })).toBeNull()
  })

  it('keeps levels one and two inline and pushes depth three into a focused panel', async () => {
    render(<NotebookSidebarTree tree={makeTree()} />)
    expect(screen.getByRole('button', { name: /^One$/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Two$/ })).toBeTruthy()
    const three = screen.getByRole('button', { name: /^Three$/ })
    const panel = screen.getByTestId('notebook-tree-panel')
    panel.scrollTop = 37
    three.focus()
    fireEvent.click(three)
    expect(screen.getByText('Three', { selector: 'strong' })).toBeTruthy()
    expect(screen.queryByText('One/Two/Three')).toBeNull()
    expect(panel.scrollTop).toBe(0)
    expect(screen.getByRole('button', { name: /^Four$/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.queryByText('Three', { selector: 'strong' })).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Three$/ })))
    expect(panel.scrollTop).toBe(37)
  })

  it('reveals active deep links and falls back when the focused folder is removed', async () => {
    const onContextChange = vi.fn()
    const { rerender } = render(<NotebookSidebarTree tree={makeTree()} activePageId="Detail" onContextChange={onContextChange} />)
    expect(await screen.findByText('Four', { selector: 'strong' })).toBeTruthy()
    rerender(<NotebookSidebarTree tree={makeTree({ root: { children: [folder('One', 'One', 1, [folder('Two', 'One/Two', 2, [])])] } })} activePageId="Detail" onContextChange={onContextChange} />)
    await waitFor(() => expect(screen.queryByText('Four', { selector: 'strong' })).toBeNull())
    expect(onContextChange).toHaveBeenLastCalledWith('One/Two')
  })

  it('reopens collapsed shallow ancestors when a deep route becomes active', () => {
    const tree = makeTree()
    const { rerender } = render(<NotebookSidebarTree tree={tree} />)
    fireEvent.click(screen.getByRole('button', { name: /^Two$/ }))
    expect(screen.queryByRole('button', { name: /^Three$/ })).toBeNull()
    rerender(<NotebookSidebarTree tree={tree} activePageId="Detail" />)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('button', { name: /^One$/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /^Two$/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /^Three$/ })).toBeTruthy()
  })

  it('prunes folder-only hidden artifact paths without deriving a payload rename', () => {
    const hidden = artifact('board-marker', '', {
      name: '_Board.canvas', title: 'Board', path: '_Board.canvas',
      payloadPath: 'Board.canvas.jsonl', route: '/canvas/Board',
    })
    const tree = makeTree({ root: { children: [hidden] } })
    render(<NotebookSidebarTree tree={tree} pages={[{ id: 'board-marker', type: 'canvas', route: '/canvas/Board', available: true }]} />)
    expect(screen.queryByRole('button', { name: /^Board$/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Nested artifact diagnostics/ })).toBeNull()
    expect(tree.root.children[0].payloadPath).toBe('Board.canvas.jsonl')
    expect(tree.root.children[0].route).toBe('/canvas/Board')
  })

  it('does not render drag or reorder handles', () => {
    render(<NotebookSidebarTree tree={makeTree()} />)
    fireEvent.click(screen.getByRole('button', { name: /^Three$/ }))
    expect(screen.queryByRole('button', { name: /Reorder/ })).toBeNull()
  })

  it('does not offer actions for ambiguous refs and preserves Site service status by siteId', () => {
    const ambiguous = artifact('Duplicate', 'One/Two', { ref: null, available: false, diagnostics: [{ code: 'DUPLICATE_ARTIFACT_ID', message: 'Duplicate marker' }] })
    const site = { ...artifact('site-page', '', { id: 'site-page', pageId: 'site-page', artifactKind: 'site', siteId: 'docs', title: 'Docs', name: 'Docs', path: null, payloadPath: null, parentPath: '', depth: 1 }) }
    const tree = makeTree({ root: { children: [ambiguous, site] } })
    const actions = vi.fn(() => <button type="button">Page actions</button>)
    const onContextChange = vi.fn()
    render(<NotebookSidebarTree tree={tree} pages={[{ id: 'site-page', type: 'site', route: '/sites/docs', available: true, siteId: 'docs' }]} sites={[{ id: 'docs', binding: { status: 'running' } }]} renderArtifactActions={actions} onContextChange={onContextChange} />)
    expect(screen.getByText('Duplicate')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Reorder Duplicate/ })).toBeNull()
    expect(screen.getByTitle('Site running')).toBeTruthy()
    expect(actions.mock.calls.every(([page]) => page.id === 'site-page')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /^Docs/ }))
    expect(onContextChange).toHaveBeenLastCalledWith('')
  })

  it('shows each repair violation and exposes busy, collision, retry, and success states through onRepair', async () => {
    const diagnostics = [
      { code: 'NESTED_ARTIFACT', message: 'Nested folder one', path: 'outer/inner', nestedArtifact: { kind: 'prototype', path: 'outer/inner' }, proposedDestination: 'inner' },
      { code: 'NESTED_ARTIFACT', message: 'Nested folder two', path: 'outer/two', nestedArtifact: { kind: 'canvas', path: 'outer/two' }, proposedDestination: 'two' },
    ]
    const onRepair = vi.fn().mockRejectedValueOnce(Object.assign(new Error('destination collision'), { code: 'COLLISION' })).mockResolvedValueOnce(undefined)
    render(<NestedArtifactRepairDialog diagnostics={diagnostics} open onOpenChange={vi.fn()} onRepair={onRepair} />)
    expect(screen.getAllByText('Nested artifact').length).toBe(2)
    fireEvent.click(screen.getAllByRole('button', { name: 'Repair this path' })[0])
    expect(await screen.findByText(/proposed destination.*“inner”.*occupied.*resolve that conflict.*retry/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry repair' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Repair completed. Waiting for refreshed diagnostics.')
    expect(screen.getByRole('button', { name: 'Repair completed' })).toBeDisabled()
    expect(onRepair).toHaveBeenCalledTimes(2)
    expect(onRepair).toHaveBeenCalledWith(diagnostics[0])
  })
})
