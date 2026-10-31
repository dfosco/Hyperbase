import { STORY_PREVIEW_RESULT_TYPE, STORY_PREVIEW_TOKEN_PARAM } from './storyPreviewProtocol.js'

const PREVIEW_TIMEOUT_MS = 12_000

function createStoryApiUrl() {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  return `${base}/_hypercanvas/canvas/create-story`
}

function slug(value) {
  return String(value || 'canvas').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'canvas'
}

function hashToken() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function cleanHtml(source) {
  const parser = new DOMParser()
  const document = parser.parseFromString(source, 'text/html')
  for (const element of document.body.querySelectorAll('script, iframe, object, embed, base, meta')) element.remove()
  for (const element of document.body.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      const key = attribute.name.toLowerCase()
      const value = attribute.value.trim()
      if (key.startsWith('on') || key === 'srcdoc' || key === 'formaction') {
        element.removeAttribute(attribute.name)
      } else if ((key === 'href' || key === 'src' || key === 'xlink:href') && /^\s*javascript:/i.test(value)) {
        element.removeAttribute(attribute.name)
      }
    }
  }
  return document.body.innerHTML
}

function storySource(source, kind, language) {
  if (kind === 'html') {
    const html = JSON.stringify(cleanHtml(source))
    return `export function Default() {\n  return <div dangerouslySetInnerHTML={{ __html: ${html} }} />\n}\n`
  }

  const text = String(source)
  const isTsx = kind === 'tsx' || language === 'tsx' || language === 'typescript'
  const extension = isTsx ? 'tsx' : 'jsx'
  const defaultFunction = text.match(/\bexport\s+default\s+function\s+([A-Z_$][\w$]*)/)
  const anonymousDefaultFunction = /\bexport\s+default\s+function\s*\(/.test(text)
  const defaultExpression = /\bexport\s+default\s+(?=(?:\(|<|[A-Za-z_$]|\{))/.test(text)
  const namedFunction = text.match(/\bexport\s+(?:async\s+)?function\s+([A-Z_$][\w$]*)/)
  const namedConst = text.match(/\bexport\s+const\s+([A-Z_$][\w$]*)\b/)
  const localFunction = text.match(/\b(?:async\s+)?function\s+([A-Z_$][\w$]*)\s*\(/)
  const localConst = text.match(/\bconst\s+([A-Z_$][\w$]*)\s*=/)
  if (defaultFunction) {
    return { extension, content: text.replace(/\bexport\s+default\s+function\s+/, 'function ') + `\nexport { ${defaultFunction[1]} as Default }\n` }
  }
  if (anonymousDefaultFunction) {
    return { extension, content: text.replace(/\bexport\s+default\s+function\s*\(/, 'function Default(') + '\nexport { Default }\n' }
  }
  if (defaultExpression) {
    return { extension, content: text.replace(/\bexport\s+default\s+/, 'const Default = ') + '\nexport { Default }\n' }
  }
  if (namedFunction || namedConst) {
    const component = (namedFunction || namedConst)[1]
    return { extension, content: text + `\nexport { ${component} as Default }\n` }
  }
  if (localFunction || localConst) {
    const component = (localFunction || localConst)[1]
    return { extension, content: text + `\nexport { ${component} as Default }\n` }
  }

  // A paste that is a JSX element or fragment is wrapped as the story's
  // default export. Syntax and missing-import errors are intentionally left
  // for Vite's real story route to report to the probe.
  const imports = text.match(/^\s*import\s+[^;\n]+;?\s*$/gm) || []
  const jsxSource = imports.length ? text.split('\n').filter((line) => !/^\s*import\s+/.test(line)).join('\n').trim() : text
  return {
    extension,
    content: `${imports.join('\n')}\nexport function Default() {\n  return (\n${jsxSource.split('\n').map((line) => `    ${line}`).join('\n')}\n  )\n}\n`,
  }
}

async function requestJson(url, options) {
  const response = await fetch(url, options)
  let payload = {}
  try { payload = await response.json() } catch { /* handled as a failed API response below */ }
  if (!response.ok || payload.success === false) {
    throw Object.assign(new Error(payload.error || `Story API returned ${response.status}`), { status: response.status, payload })
  }
  return payload
}

async function deleteOwnedStory(cleanupToken) {
  try {
    const result = await requestJson(createStoryApiUrl(), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cleanupToken }),
    })
    return { status: result.removed ? 'deleted' : 'failed', error: result.error || null }
  } catch (error) {
    return {
      status: error.payload?.code === 'OWNED_STORY_MODIFIED' ? 'conflict' : 'failed',
      error: error.message,
    }
  }
}

function probeStory({ route, storyId, sourceHash, timeoutMs }) {
  return new Promise((resolve) => {
    const token = hashToken()
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.title = 'Story preview validation'
    Object.assign(iframe.style, {
      position: 'fixed', left: '-10000px', top: '0', width: '1024px', height: '768px',
      border: '0', opacity: '0', pointerEvents: 'none',
    })

    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
    const page = import.meta.env.DEV ? `${base}/stories.html${route}` : `${base}${route}`
    const url = new URL(page, window.location.href)
    url.searchParams.set('export', 'Default')
    url.searchParams.set('_sb_embed', '')
    url.searchParams.set(STORY_PREVIEW_TOKEN_PARAM, token)
    url.searchParams.set('_sb_preview_hash', sourceHash)

    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      iframe.remove()
      resolve(result)
    }
    const onMessage = (event) => {
      const data = event.data
      if (event.origin !== window.location.origin || event.source !== iframe.contentWindow) return
      if (!data || data.type !== STORY_PREVIEW_RESULT_TYPE || data.token !== token ||
        data.storyId !== storyId || data.exportName !== 'Default' || data.sourceHash !== sourceHash) return
      finish({ status: data.status, phase: data.phase, error: data.error || null })
    }
    const timer = setTimeout(() => finish({ status: 'failed', phase: 'timeout', error: `Story preview did not report a render result within ${timeoutMs}ms` }), timeoutMs)

    window.addEventListener('message', onMessage)
    iframe.src = url.toString()
    document.body.appendChild(iframe)
  })
}

/** Create a canvas-local story, then validate it through its real StoryPage route. */
export async function createStoryPreview({ source, kind, language, canvasName, timeoutMs = PREVIEW_TIMEOUT_MS }) {
  let adapted
  try {
    adapted = storySource(source, kind, language)
  } catch (error) {
    return { status: 'failed', phase: 'adapt', error: error.message || String(error), cleanup: { status: 'not-needed' } }
  }
  const extension = typeof adapted === 'string' ? 'jsx' : adapted.extension
  const content = typeof adapted === 'string' ? adapted : adapted.content
  const uniqueName = `pasted-${slug(canvasName)}-${hashToken().replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase()}`
  let created

  try {
    created = await requestJson(createStoryApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: uniqueName, location: 'canvas', canvasName, format: extension, content }),
    })
  } catch (error) {
    return { status: 'failed', phase: 'create', error: error.message, cleanup: { status: 'not-needed' } }
  }

  const readyResult = {
    status: 'ready', storyId: created.storyId, name: created.name, path: created.path,
    sourceHash: created.sourceHash, cleanupToken: created.cleanupToken,
  }
  if (!created.sourceHash || !created.cleanupToken || !created.route) {
    const cleanup = created.cleanupToken ? await deleteOwnedStory(created.cleanupToken) : { status: 'failed', error: 'Create-story response omitted ownership data' }
    return { status: 'failed', phase: 'create', error: 'Create-story response was incomplete', cleanup }
  }

  try {
    const probe = await probeStory({ route: created.route, storyId: created.storyId, sourceHash: created.sourceHash, timeoutMs })
    if (probe.status === 'ready') return readyResult
    const cleanup = await deleteOwnedStory(created.cleanupToken)
    return { status: 'failed', phase: probe.phase || 'render', error: probe.error || 'Story preview failed to render', cleanup, storyId: created.storyId, path: created.path }
  } catch (error) {
    const cleanup = await deleteOwnedStory(created.cleanupToken)
    return { status: 'failed', phase: 'render', error: error.message, cleanup, storyId: created.storyId, path: created.path }
  }
}

/** Remove a validated preview if canvas insertion later fails. */
export function cleanupStoryPreview(readyResult) {
  if (readyResult?.status !== 'ready' || !readyResult.cleanupToken) {
    return Promise.resolve({ status: 'failed', error: 'Story preview ownership data is missing' })
  }
  return deleteOwnedStory(readyResult.cleanupToken)
}
