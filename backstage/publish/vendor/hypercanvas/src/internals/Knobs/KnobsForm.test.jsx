import { act, fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import KnobsForm from './KnobsForm.jsx'

vi.mock('../../core/knobs/index.js', async importOriginal => {
  const actual = await importOriginal()
  return {
    ...actual,
    setKnobValue: vi.fn(actual.setKnobValue),
    clearKnobValue: vi.fn(actual.clearKnobValue),
  }
})

function paramsFor(targetWindow = window) {
  return new URLSearchParams(targetWindow.location.hash.replace(/^#/, ''))
}

function setHash(hash, targetWindow = window) {
  if (targetWindow === window) {
    window.history.replaceState(null, '', `/${hash}`)
  } else {
    targetWindow.location.hash = hash
  }
  const HashChangeEventType = targetWindow.HashChangeEvent || HashChangeEvent
  targetWindow.dispatchEvent(new HashChangeEventType('hashchange'))
}

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, '', '/')
  document.body.innerHTML = ''
})

describe('KnobsForm', () => {
  it('renders the empty state when there are no knobs', () => {
    render(<KnobsForm knobs={[]} />)

    expect(screen.getByText('No knobs are available for this selection yet.')).toBeInTheDocument()
  })

  it.each([
    ['text', { id: 'title', type: 'text', label: 'Title', default: 'Hello' }, () => screen.getByLabelText('Title')],
    ['textarea', { id: 'bio', type: 'textarea', label: 'Bio', default: 'About' }, () => screen.getByLabelText('Bio')],
    ['number', { id: 'count', type: 'number', label: 'Count', default: 2, min: 0, max: 5 }, () => screen.getByLabelText('Count')],
    ['slider', { id: 'size', type: 'slider', label: 'Size', default: 5, min: 0, max: 10 }, () => screen.getByLabelText('Size')],
    ['boolean', { id: 'enabled', type: 'boolean', label: 'Enabled', default: true }, () => screen.getByRole('checkbox', { name: 'Enabled' })],
    ['select', { id: 'mode', type: 'select', label: 'Mode', default: 'light', options: ['light', 'dark'] }, () => screen.getByText('Mode')],
    ['radio', { id: 'variant', type: 'radio', label: 'Variant', default: 'small', options: [{ label: 'Small', value: 'small' }, { label: 'Large', value: 'large' }] }, () => screen.getByText('Small')],
    ['range', { id: 'bounds', type: 'range', label: 'Bounds', default: [1, 4], min: 0, max: 10 }, () => screen.getByLabelText('Bounds min')],
    ['date', { id: 'due', type: 'date', label: 'Due date', default: '2026-06-06' }, () => screen.getByLabelText('Due date')],
    ['object', { id: 'theme', type: 'object', label: 'Theme', knobs: [{ id: 'primary', type: 'text', label: 'Primary', default: 'blue' }] }, () => screen.getByRole('group', { name: 'Theme' })],
    ['string-array', { id: 'tags', type: 'string-array', label: 'Tags', default: ['alpha'] }, () => screen.getByLabelText('Tags item 1')],
  ])('renders a field for %s knobs', (_, def, findField) => {
    render(<KnobsForm knobs={[def]} />)

    expect(findField()).toBeInTheDocument()
  })

  it('editing a text field writes the knob value to the hash', () => {
    render(<KnobsForm knobs={[{ id: 'title', type: 'text', label: 'Title', default: 'Default' }]} />)

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Custom' } })

    expect(paramsFor().get('knob.title')).toBe('Custom')
    expect(screen.getByLabelText('Title')).toHaveValue('Custom')
  })

  it('passes number-array input to Statefully as numeric items', () => {
    render(<KnobsForm knobs={[{
      id: 'samples',
      type: 'string-array',
      itemType: 'number',
      label: 'Samples',
      default: [1],
    }]} />)

    fireEvent.change(screen.getByLabelText('Samples item 1'), { target: { value: '2.5' } })

    expect(paramsFor().get('knob.samples')).toBe('[2.5]')
  })

  it('routes writes to the target window hash when target is provided', () => {
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    setHash('#knobTitle=Inside', iframe.contentWindow)

    render(
      <KnobsForm
        knobs={[{ id: 'title', type: 'text', label: 'Title', default: 'Default' }]}
        target={iframe.contentWindow}
      />,
    )

    expect(screen.getByLabelText('Title')).toHaveValue('Inside')

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Iframe value' } })

    expect(paramsFor(iframe.contentWindow).get('knob.title')).toBe('Iframe value')
    expect(paramsFor(window).get('knob.title')).toBeNull()
  })

  it('round-trips boolean true and false hash strings correctly', () => {
    setHash('#knobEnabled=false')
    render(<KnobsForm knobs={[{ id: 'enabled', type: 'boolean', label: 'Enabled', default: true }]} />)

    const checkbox = screen.getByRole('checkbox', { name: 'Enabled' })
    expect(checkbox).not.toBeChecked()

    fireEvent.click(checkbox)

    expect(paramsFor().get('knob.enabled')).toBe('true')
    expect(checkbox).toBeChecked()
  })

  it('marks invalid raw values with inline validation', () => {
    setHash('#knobCount=20')
    render(<KnobsForm knobs={[{ id: 'count', type: 'number', label: 'Count', default: 3, min: 0, max: 10 }]} />)

    expect(screen.getByText('Must be at most 10.')).toBeInTheDocument()
    expect(screen.getByLabelText('Count')).toHaveAttribute('data-invalid', 'true')
    expect(screen.getByLabelText('Count')).toHaveValue(3)
  })

  it('refreshes an iframe form from external canonical, compact, ID-alias, and scope-alias hash-router updates without remounting', () => {
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const initialSrc = iframe.getAttribute('src')
    const originalWindow = iframe.contentWindow
    const addEventListener = vi.spyOn(originalWindow, 'addEventListener')
    const removeEventListener = vi.spyOn(originalWindow, 'removeEventListener')
    const definition = {
      id: 'variant',
      type: 'select',
      label: 'Variant',
      scope: '/Route',
      scopeAliases: ['/route'],
      aliases: ['theme'],
      options: ['small', 'large'],
      default: 'small',
    }
    setHash('#/Route?knob.Route.variant=large', originalWindow)

    const { unmount } = render(<KnobsForm knobs={[definition]} target={iframe} />)
    expect(addEventListener).toHaveBeenCalledWith('hashchange', expect.any(Function))
    const select = screen.getByRole('combobox', { name: 'Variant' })
    expect(select).toHaveTextContent('large')

    for (const [hash, expected] of [
      ['#/Route?knob.Route.variant=small', 'small'],
      ['#/Route?knobRouteVariant=large', 'large'],
      ['#/Route?knob.Route.theme=small', 'small'],
      ['#/Route?knob.route.variant=large', 'large'],
    ]) {
      act(() => setHash(hash, originalWindow))
      expect(select).toHaveTextContent(expected)
      expect(iframe.contentWindow).toBe(originalWindow)
      expect(iframe.getAttribute('src')).toBe(initialSrc)
    }

    unmount()
    expect(removeEventListener).toHaveBeenCalledWith('hashchange', expect.any(Function))
    addEventListener.mockRestore()
    removeEventListener.mockRestore()
    iframe.remove()
  })
})

it('filters names and nested controls without changing values or limiting Reset to defaults', () => {
  const knobs = [
    { id: 'theme', type: 'object', label: 'Theme', knobs: [
      { id: 'primary', type: 'text', label: 'Primary color', default: 'blue' },
      { id: 'secondary', type: 'text', label: 'Secondary color', default: 'gray' },
    ] },
    { id: 'showSocial', type: 'boolean', default: true },
    { id: 'note', type: 'text', label: 'Note', description: 'primary', default: 'hello' },
  ]
  const { rerender } = render(<KnobsForm knobs={knobs} />)
  fireEvent.change(screen.getByLabelText('Primary color'), { target: { value: 'red' } })
  fireEvent.change(screen.getByLabelText('Secondary color'), { target: { value: 'green' } })
  const originalHash = window.location.hash
  rerender(<KnobsForm knobs={knobs} search="  PRIMARY  " />)
  expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument()
  expect(screen.getByLabelText('Primary color')).toHaveValue('red')
  expect(screen.queryByLabelText('Secondary color')).toBeNull()
  expect(screen.queryByLabelText('Note')).toBeNull()
  expect(window.location.hash).toBe(originalHash)
  fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }))
  rerender(<KnobsForm knobs={knobs} search="" />)
  expect(screen.getByLabelText('Secondary color')).toHaveValue('gray')
  rerender(<KnobsForm knobs={knobs} search="show social" />)
  expect(screen.getByRole('checkbox', { name: 'Show Social' })).toBeInTheDocument()
  rerender(<KnobsForm knobs={knobs} search="no such knob" />)
  expect(screen.getByRole('status')).toHaveTextContent('No knobs match your search.')
})
