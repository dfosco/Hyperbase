import { showToast } from '../showToast.js'

/** Copy text from a canvas action, including hosts without a working async Clipboard API. */
export async function copyCanvasText(text, label = 'text') {
  const value = String(text ?? '')
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // A permission denial can still allow the user-gesture-based copy command.
  }

  const active = document.activeElement
  const inputSelection = active && ('selectionStart' in active)
    ? { start: active.selectionStart, end: active.selectionEnd, direction: active.selectionDirection }
    : null
  const selection = document.getSelection?.()
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : []
  const field = document.createElement('textarea')
  field.value = value
  field.readOnly = true
  field.setAttribute('aria-hidden', 'true')
  Object.assign(field.style, { position: 'fixed', left: '-10000px', top: '0', opacity: '0' })
  document.body.appendChild(field)
  let copied = false
  try {
    field.focus()
    field.select()
    copied = !!document.execCommand?.('copy')
  } catch {
    copied = false
  } finally {
    field.remove()
    if (selection && ranges.length) {
      selection.removeAllRanges()
      for (const range of ranges) selection.addRange(range)
    }
    active?.focus?.({ preventScroll: true })
    if (inputSelection && active?.setSelectionRange) {
      active.setSelectionRange(inputSelection.start, inputSelection.end, inputSelection.direction)
    }
  }
  if (!copied) showToast(`Could not copy ${label}`)
  return copied
}

export async function copyCanvasImage(blob) {
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })])
      return true
    }
  } catch {
    // Image clipboard has no equivalent document.execCommand fallback.
  }
  showToast('Could not copy image')
  return false
}

export function copySelectedCanvasWidgets(event, selectedIds, canvasId) {
  if (event.defaultPrevented || event.target?.closest?.('input, textarea, select, [contenteditable]')) return false
  if (typeof window !== 'undefined' && window.getSelection()?.isCollapsed === false) return false
  const ids = [...selectedIds].filter((id) => !id.startsWith('jsx-'))
  if (!ids.length || !event.clipboardData?.setData) return false
  event.preventDefault()
  event.clipboardData.setData('text/plain', `${canvasId}::${ids.join(',')}`)
  return true
}
