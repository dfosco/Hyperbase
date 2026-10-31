import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupStoryPreview, createStoryPreview } from './createStoryPreview.js'
import { STORY_PREVIEW_RESULT_TYPE, STORY_PREVIEW_TOKEN_PARAM } from './storyPreviewProtocol.js'

function response(body, status = 201) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function createdStory(overrides = {}) {
  return {
    success: true,
    name: 'pasted-board-a1b2c3d4',
    storyId: 'pasted-board-a1b2c3d4',
    path: 'canvas/pasted-board-a1b2c3d4.story.jsx',
    route: '/components/pasted-board-a1b2c3d4',
    sourceHash: 'sha256-content',
    cleanupToken: 'owned-token',
    ...overrides,
  }
}

function sendProbeResult(status = 'ready', phase = 'render') {
  const append = vi.spyOn(document.body, 'appendChild').mockImplementation((iframe) => {
    queueMicrotask(() => {
      const url = new URL(iframe.src)
      window.dispatchEvent(new MessageEvent('message', {
        origin: window.location.origin,
        source: iframe.contentWindow,
        data: {
          type: STORY_PREVIEW_RESULT_TYPE,
          token: url.searchParams.get(STORY_PREVIEW_TOKEN_PARAM),
          storyId: 'pasted-board-a1b2c3d4',
          exportName: 'Default',
          sourceHash: 'sha256-content',
          status,
          phase,
          error: status === 'failed' ? 'render failed' : undefined,
        },
      }))
    })
    return iframe
  })
  return append
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('createStoryPreview', () => {
  it('creates HTML story source and validates it through a token-bound StoryPage message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(createdStory())))
    const append = sendProbeResult()

    const result = await createStoryPreview({
      source: '<main onclick="alert(1)"><script>alert(2)</script><b>safe</b></main>',
      kind: 'html', language: 'html', canvasName: 'Board', timeoutMs: 500,
    })

    expect(result).toMatchObject({ status: 'ready', storyId: 'pasted-board-a1b2c3d4', cleanupToken: 'owned-token' })
    const [, options] = fetch.mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body).toMatchObject({ location: 'canvas', canvasName: 'Board', format: 'jsx' })
    expect(body.content).toContain('<b>safe</b>')
    expect(body.content).not.toContain('onclick')
    expect(body.content).not.toContain('<script>')
    expect(append).toHaveBeenCalledOnce()
  })

  it('keeps story creation and validation paths under a branch base path', async () => {
    vi.stubEnv('BASE_URL', '/branch--smart-paste/')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(createdStory())))
    const append = sendProbeResult()

    const result = await createStoryPreview({
      source: '<main>Preview</main>', kind: 'html', language: 'html', canvasName: 'Board', timeoutMs: 500,
    })

    expect(result.status).toBe('ready')
    expect(fetch.mock.calls[0][0]).toBe('/branch--smart-paste/_hypercanvas/canvas/create-story')
    expect(new URL(append.mock.calls[0][0].src).pathname).toBe('/branch--smart-paste/stories.html/components/pasted-board-a1b2c3d4')
  })

  it('stores TSX components with a default story export without dropping source', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(createdStory())))
    sendProbeResult()
    const source = 'type Props = { label: string };\nexport function Card({ label }: Props) { return <div>{label}</div> }'

    await createStoryPreview({ source, kind: 'tsx', language: 'tsx', canvasName: 'Board', timeoutMs: 500 })

    const request = JSON.parse(fetch.mock.calls[0][1].body)
    expect(request.format).toBe('tsx')
    expect(request.content).toContain(source)
    expect(request.content).toContain('export { Card as Default }')
  })

  it('cleans up a newly created story when StoryPage reports a render error', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response(createdStory()))
      .mockResolvedValueOnce(response({ success: true, removed: true }, 200)))
    sendProbeResult('failed', 'render')

    const result = await createStoryPreview({ source: '<Widget />', kind: 'jsx', language: null, canvasName: 'Board', timeoutMs: 500 })

    expect(result).toMatchObject({ status: 'failed', phase: 'render', error: 'render failed', cleanup: { status: 'deleted' } })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ cleanupToken: 'owned-token' })
  })

  it('exposes ownership-safe cleanup for a later canvas insertion failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ success: true, removed: true }, 200)))

    await expect(cleanupStoryPreview({ status: 'ready', cleanupToken: 'owned-token' })).resolves.toEqual({ status: 'deleted', error: null })
  })
})
