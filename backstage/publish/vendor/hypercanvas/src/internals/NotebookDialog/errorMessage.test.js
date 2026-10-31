import { describe, expect, it } from 'vitest'
import errorMessage from './errorMessage.js'

describe('NotebookDialog error messages', () => {
  it('shows actionable error text without exposing implementation stack traces', () => {
    const failure = Object.assign(new Error('This Notebook uses format version 2.'), {
      code: 'UNSUPPORTED_NOTEBOOK_VERSION',
    })

    expect(errorMessage(failure, 'Fallback')).toBe(
      'UNSUPPORTED_NOTEBOOK_VERSION: This Notebook uses format version 2.',
    )
    expect(errorMessage(failure, 'Fallback')).not.toContain(failure.stack)
  })

  it('handles string failures and empty errors', () => {
    expect(errorMessage('Picker failed', 'Fallback')).toBe('Picker failed')
    expect(errorMessage({}, 'Fallback')).toBe('Fallback')
  })
})
