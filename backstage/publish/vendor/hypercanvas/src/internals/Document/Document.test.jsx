import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Document, { Site } from './Document.jsx'
describe('semantic document reader', () => {
  it('renders invalid metadata diagnostics without attempting array operations', () => {
    render(<Document artifact={{ id: 'bad', available: false, metadata: { references: 'invalid' }, diagnostics: [{ code: 'INVALID_DOCUMENT_FRONTMATTER', message: 'Invalid references' }] }} />)
    expect(screen.getByText('INVALID_DOCUMENT_FRONTMATTER')).toBeTruthy()
    expect(screen.getByText('This document is unavailable.')).toBeTruthy()
  })
  it('presents Site screenshots and destination links without an external iframe', () => {
    const { container } = render(<Document artifact={{ id: 'review', title: 'Review', available: true }} Content={() => <Site artifactId="books" />} resolveArtifact={() => ({ available: true, url: 'https://example.org/books', screenshot: '/poster.png' })} />)
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.querySelector('img').src).toContain('/poster.png')
    expect(screen.getByRole('link', { name: 'Open books' }).href).toBe('https://example.org/books')
  })
})
