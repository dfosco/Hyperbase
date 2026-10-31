export const STORY_PREVIEW_TOKEN_PARAM = '_sb_preview_token'
export const STORY_PREVIEW_RESULT_TYPE = 'hypercanvas:story-preview-result'

export function reportStoryPreviewResult({
  token,
  storyId,
  exportName,
  sourceHash,
  status,
  phase,
  error,
  windowObject = typeof window === 'undefined' ? null : window,
}) {
  if (!token || !windowObject || windowObject.parent === windowObject) return false

  const message = {
    type: STORY_PREVIEW_RESULT_TYPE,
    token,
    storyId,
    exportName,
    sourceHash,
    status,
    phase,
    ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}),
  }

  windowObject.parent.postMessage(message, windowObject.location.origin)
  return true
}
