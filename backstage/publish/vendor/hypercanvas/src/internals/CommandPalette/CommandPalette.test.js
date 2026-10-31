import { describe, expect, it } from 'vitest'
import { getPublishedNotebookCatalog } from './CommandPalette.jsx'

describe('getPublishedNotebookCatalog', () => {
  it('returns the injected static page catalog', () => {
    const pages = [{ id: 'overview', title: 'Overview', route: '/overview' }]
    expect(getPublishedNotebookCatalog({ pages })).toEqual({ pages, error: null })
  })

  it('accepts an empty published catalog', () => {
    expect(getPublishedNotebookCatalog({ pages: [] })).toEqual({ pages: [], error: null })
  })

  it('reports a missing or malformed published catalog', () => {
    expect(getPublishedNotebookCatalog(null)).toEqual({
      pages: [],
      error: 'Published Notebook palette data is missing.',
    })
    expect(getPublishedNotebookCatalog({ pages: {} }).error).toBe('Published Notebook palette data is missing.')
  })
})
