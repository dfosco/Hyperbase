/**
 * StoryPage — renders a .story.jsx module at its own route.
 *
 * Component artifacts open one story with a cross-module variant selector.
 * Embedded widgets remain bare. Legacy standalone routes render all named
 * exports unless ?export=ExportName selects one.
 */
import { Component, useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getStoryData, listStories } from '../../core/data/loader.js'
import { resolveStoryExports } from './storyExports.js'
import { getStoryWrapper } from '../loadConsumerWrapper.js'
import styles from './StoryPage.module.css'
import { reportStoryPreviewResult, STORY_PREVIEW_TOKEN_PARAM } from './storyPreviewProtocol.js'

const StoryWrapper = getStoryWrapper()

const ComponentSetPageLazy = lazy(() => import('./ComponentSetPage.jsx'))

function StoryErrorFallback({ name, error }) {
  return (
    <div className={styles.error}>
      <strong>{name}</strong>
      <span>{String(error?.message || error)}</span>
    </div>
  )
}

class PreviewRenderBoundary extends Component {
  state = { error: null, resetKey: null }

  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    this.props.onError(error)
  }

  render() {
    return this.state.error
      ? <StoryErrorFallback name={this.props.name} error={this.state.error} />
      : this.props.children
  }
}

function PreviewMountReporter({ children, reportSuccess }) {
  useEffect(() => {
    // Give descendant mount effects a chance to report a render failure before
    // the provider treats this preview as ready. If one throws, the boundary
    // unmounts this reporter and cancels the pending success signal.
    const timer = window.setTimeout(reportSuccess, 0)
    return () => window.clearTimeout(timer)
  }, [reportSuccess])
  return children
}

export default function StoryPage({ name }) {
  const location = useLocation()
  const navigate = useNavigate()
  const searchParams = new URLSearchParams(location.search)
  const exportFilter = searchParams.get('export')
  const isEmbed = searchParams.has('_sb_embed')
  const previewToken = searchParams.get(STORY_PREVIEW_TOKEN_PARAM)
  const previewSourceHash = searchParams.get('_sb_preview_hash')
  const isPreview = Boolean(previewToken && previewSourceHash)
  const isComponentSet = searchParams.has('_sb_component_set')
  const componentViewRequested = searchParams.has('_sb_component_view')

  const [, setStoryRevision] = useState(0)
  useEffect(() => {
    const changed = () => setStoryRevision(value => value + 1)
    document.addEventListener('storyboard:story-index-changed', changed)
    return () => document.removeEventListener('storyboard:story-index-changed', changed)
  }, [])
  const story = getStoryData(name)
  const [exports, setExports] = useState(null)
  const [error, setError] = useState(null)

  const reportPreview = useCallback((status, phase, previewError) => reportStoryPreviewResult({
    token: previewToken,
    storyId: name,
    exportName: exportFilter,
    sourceHash: previewSourceHash,
    status,
    phase,
    error: previewError,
  }), [previewToken, name, exportFilter, previewSourceHash])
  const reportPreviewReady = useCallback(() => {
    if (isPreview) reportPreview('ready', 'render')
  }, [isPreview, reportPreview])

  useEffect(() => {
    if (isComponentSet) return
    if (!story?._storyImport) {
      Promise.resolve().then(() => {
        const message = `Story "${name}" not found or missing import`
        setError(message)
        reportPreview('failed', 'import', message)
      })
      return
    }

    let cancelled = false
    story._storyImport()
      .then((mod) => {
        if (cancelled) return
        setExports(resolveStoryExports(mod, { exportNames: story._exportNames }))
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        const message = `Failed to load story "${name}": ${err.message || err}`
        setError(message)
        reportPreview('failed', 'import', message)
      })

    return () => { cancelled = true }
  }, [name, story, isComponentSet, previewToken, previewSourceHash, exportFilter, reportPreview])

  // Signal snapshot-ready after story renders in embed mode.
  useEffect(() => {
    if (!isEmbed || !exports || window.parent === window) return
    Promise.resolve(document.fonts?.ready).then(() => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.__sbSnapshotReady?.()
      }))
    })
  }, [isEmbed, exports])

  // Delegate to ComponentSetPage for grid view (after all hooks)
  if (isComponentSet) {
    return (
      <Suspense fallback={isEmbed ? null : <div className={styles.loading}>Loading component set…</div>}>
        <ComponentSetPageLazy name={name} />
      </Suspense>
    )
  }

  if (error) {
    return (
      <StoryErrorFallback name={name} error={error} />
    )
  }

  if (!exports) {
    if (isEmbed) return null
    return (
      <div className={styles.loading}>Loading story…</div>
    )
  }

  const componentView = Boolean(story?._componentId && (!isEmbed || componentViewRequested))
  const selectedExport = exportFilter || (componentView ? Object.keys(exports)[0] : null)
  const variants = componentView ? listStories().flatMap(storyId => {
    const entry = getStoryData(storyId)
    if (entry?._componentId !== story._componentId) return []
    return (storyId === name ? Object.keys(exports) : entry._exportNames || []).map(exportName => ({
      storyId, exportName, entry, value: JSON.stringify([storyId, exportName]),
    }))
  }) : []
  const renderComponentView = content => !componentView ? content : (
    <section className={styles.componentView} aria-label={`${story._componentName || name} component preview`}>
      <header className={styles.previewToolbar}>
        <strong>{story._componentName || name}</strong>
        <label>Story
          <select aria-label="Story" value={JSON.stringify([name, selectedExport])} onChange={event => {
            const variant = variants.find(item => item.value === event.target.value)
            if (!variant) return
            const params = new URLSearchParams(location.search)
            params.set('export', variant.exportName)
            navigate(`${variant.entry._route}?${params}${location.hash}`)
          }}>
            {variants.map(variant => <option key={variant.value} value={variant.value}>
              {variant.entry._storyFile} / {variant.storyId === name ? exports[variant.exportName]?.storyName : variant.exportName}
            </option>)}
          </select>
        </label>
      </header>
      <div className={styles.previewContent}>{content}</div>
    </section>
  )

  // A component artifact opens a single selectable story; legacy bare story
  // routes keep their all-exports behavior when no export is requested.
  if (selectedExport) {
    const Component = exports[selectedExport]
    if (!Component) {
      return (
        <PreviewFailureReporter report={() => reportPreview('failed', 'export', `Export "${exportFilter}" not found in story "${name}"`)}>
          <StoryErrorFallback name={`${name}/${selectedExport}`} error={`Export "${selectedExport}" not found in story "${name}"`} />
        </PreviewFailureReporter>
      )
    }

    return renderComponentView(
      <Suspense fallback={null}>
        <PreviewRenderBoundary
          key={`${name}:${selectedExport}:${previewToken || ''}`}
          resetKey={exports}
          name={`${name}/${selectedExport}`}
          onError={(renderError) => reportPreview('failed', 'render', renderError)}
        >
          <StoryWrapper>
          <PreviewMountReporter reportSuccess={reportPreviewReady}>
              <Component />
            </PreviewMountReporter>
          </StoryWrapper>
        </PreviewRenderBoundary>
      </Suspense>
    )
  }

  // All exports — render each component bare
  const exportNames = Object.keys(exports)

  if (componentView && exportNames.length === 0) return renderComponentView(
    <StoryErrorFallback name={name} error="This story module has no renderable stories." />,
  )

  return (
    <Suspense fallback={null}>
      <StoryWrapper>
        {exportNames.map((exportName) => {
          const Component = exports[exportName]
          return <Component key={exportName} />
        })}
      </StoryWrapper>
    </Suspense>
  )
}

function PreviewFailureReporter({ report, children }) {
  useEffect(() => { report() }, [report])
  return children
}
