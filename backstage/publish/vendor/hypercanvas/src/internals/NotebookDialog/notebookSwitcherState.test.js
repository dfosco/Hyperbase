import { describe, expect, it } from 'vitest'
import { mergeNotebookEntries, notebookRootKey } from './notebookSwitcherState.js'

describe('Notebook switcher state', () => {
  it('shows the current Notebook when recent history is empty or stale', () => {
    expect(mergeNotebookEntries([], {
      active: true,
      root: '/work/current',
      notebook: { manifest: { title: 'Current' } },
    })).toEqual([expect.objectContaining({
      name: 'Current', path: '/work/current', current: true, recent: false,
    })])
  })

  it('marks a matching recent root current without duplicating it', () => {
    const entries = mergeNotebookEntries([
      { root: '/work/current/', title: 'Older title', available: true },
      { root: '/work/other', title: 'Current', available: true },
    ], { active: true, root: '/work/current', notebook: { manifest: { title: 'Current' } } })

    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ path: '/work/current/', name: 'Current', current: true, recent: true })
  })

  it('preserves different roots with matching display names', () => {
    const entries = mergeNotebookEntries([
      { root: '/work/first', title: 'Demo' },
      { root: '/work/second', title: 'Demo' },
    ], { active: false })

    expect(entries.map(entry => entry.path)).toEqual(['/work/first', '/work/second'])
  })

  it('normalizes separator and trailing-slash aliases without case folding', () => {
    expect(notebookRootKey('C:\\work\\book\\')).toBe('C:/work/book')
    expect(notebookRootKey('/work/Demo')).not.toBe(notebookRootKey('/work/demo'))
  })
})
