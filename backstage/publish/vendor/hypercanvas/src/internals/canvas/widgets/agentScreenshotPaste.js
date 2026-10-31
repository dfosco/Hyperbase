/**
 * Canvas-owned image paste routing. Only a single selected, interactive
 * agent terminal may receive screenshot shortcodes. Other paste behavior
 * remains owned by the canvas or the focused editor.
 */

export function getClipboardImageFile(clipboardData) {
  // A rich clipboard may contain both text and image representations. Text
  // wins: never replace an intentional text paste with a screenshot.
  if (!clipboardData?.items || clipboardData.getData?.('text/plain')) return null
  for (const item of clipboardData.items) {
    if (!item?.type?.startsWith('image/')) continue
    const file = item.getAsFile?.()
    if (file) return file
  }
  return null
}

export function getActiveAgentPasteTarget(
  widgetId,
  registry = typeof window !== 'undefined' ? window.__storyboardTerminalRegistry : null,
) {
  const entry = registry?.get(widgetId)
  if (!entry?.isAgent || !entry.canPasteScreenshot || entry.ws?.readyState !== 1) return null
  return typeof entry.pasteText === 'function' ? entry : null
}

export function resolveAgentScreenshotPaste(selectedIds, widgets, clipboardData, registry) {
  if (selectedIds?.size !== 1) return null
  const [widgetId] = selectedIds
  const widget = widgets?.find((candidate) => candidate.id === widgetId)
  const isAgent = widget?.type === 'agent'
    || (widget?.type === 'terminal' && (widget.id.startsWith('agent-') || Boolean(widget.props?.agentId)))
  if (!isAgent) return null

  const file = getClipboardImageFile(clipboardData)
  if (!file) return null
  const terminal = getActiveAgentPasteTarget(widgetId, registry)
  return terminal ? { widgetId, file, terminal } : null
}

/** Preserve PNG clips and encode other browser image formats as actual PNGs. */
export async function imageFileToPngDataUrl(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('Could not read the clipboard image'))
    reader.readAsDataURL(file)
  })
  if (file.type === 'image/png') return dataUrl

  const image = new Image()
  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = () => reject(new Error('Could not decode the clipboard image'))
    image.src = dataUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('PNG conversion is unavailable')
  context.drawImage(image, 0, 0)
  return canvas.toDataURL('image/png')
}
