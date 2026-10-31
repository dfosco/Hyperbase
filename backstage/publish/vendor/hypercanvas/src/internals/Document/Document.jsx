import { Component, createContext, useContext, useMemo } from 'react'
import css from './Document.module.css'

const DocumentContext = createContext(null)
function Unavailable({ children }) { return <p role="status" className={css.unavailable}>{children}</p> }
class DocumentBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() { return this.state.error ? <Unavailable>Document rendering failed: {this.state.error.message}</Unavailable> : this.props.children }
}
function AssetImage({ src = '', alt = '', ...props }) {
  const context = useContext(DocumentContext)
  const resolved = context?.resolveAsset(src, { basePath: context.artifact.folderPath, mode: context.mode })
  return resolved?.available && resolved.url
    ? <img {...props} src={resolved.url} alt={alt} loading="lazy" />
    : <Unavailable>Image unavailable: {src}</Unavailable>
}
export function Image(props) { return <figure><AssetImage {...props} /></figure> }
function ArtifactEmbed({ artifactId, viewId, kind, title }) {
  const context = useContext(DocumentContext)
  const resolved = context?.resolveArtifact(artifactId, { kind, viewId, mode: context.mode })
  if (!resolved?.available || !resolved.url) return <Unavailable>{resolved?.diagnostics?.[0]?.message || `${kind} unavailable: ${artifactId || 'missing artifactId'}`}</Unavailable>
  if (kind === 'site') return <figure className={css.embed}>{resolved.screenshot ? <a href={resolved.url}><img src={resolved.screenshot} alt={title || artifactId} /></a> : <Unavailable>Site screenshot unavailable: {artifactId}</Unavailable>}<figcaption><a href={resolved.url}>Open {title || artifactId}</a></figcaption></figure>
  return <figure className={css.embed} data-artifact-id={artifactId} data-view-id={viewId}>
    <iframe title={title || `${kind} ${artifactId}${viewId ? ` ${viewId}` : ''}`} src={resolved.url} loading="lazy" />
    <figcaption><a href={resolved.url}>Open {title || artifactId}</a></figcaption>
  </figure>
}
export function Prototype(props) { return <ArtifactEmbed {...props} kind="prototype" /> }
export function Site(props) { return <ArtifactEmbed {...props} kind="site" /> }
export function CanvasWidget({ type, props = {} }) {
  const fallback = props.fallback
  return fallback?.type === 'text' && typeof fallback.text === 'string'
    ? <aside className={css.unavailable}>{fallback.text}</aside>
    : <Unavailable>Unsupported widget: {type || 'unknown'}</Unavailable>
}

/** Reusable reader; the host owns source loading, compilation and resolution. */
export default function Document({ Content, artifact, artifacts = [], mode = 'local', resolveArtifact, resolveAsset, source = '', diagnostics = [] }) {
  const context = useMemo(() => ({ artifact, mode, resolveArtifact, resolveAsset }), [artifact, mode, resolveArtifact, resolveAsset])
  const referenceDiagnostics = (Array.isArray(artifact?.metadata?.references) ? artifact.metadata.references : []).flatMap(id => {
    const matches = artifacts.filter(item => item.id === id)
    return matches.length !== 1 || matches[0].available === false ? [{ code: 'UNAVAILABLE_DOCUMENT_REFERENCE', message: `Declared reference ${id} is missing, ambiguous or unavailable.` }] : []
  })
  const allDiagnostics = [...(artifact?.diagnostics || []), ...diagnostics, ...referenceDiagnostics]
  return <article className={css.document} data-document-id={artifact?.id} data-render-mode={mode}>
    <header><h1>{artifact?.title || 'Document unavailable'}</h1></header>
    {allDiagnostics.length > 0 && <section aria-label="Document diagnostics" role="status"><ul>{allDiagnostics.map((item, i) => <li key={i}><code>{item.code}</code> {item.path}{item.line ? `:${item.line}` : ''} {item.message}</li>)}</ul></section>}
    {Content && artifact?.available !== false ? <DocumentBoundary key={source}><DocumentContext.Provider value={context}><Content components={{ img: AssetImage }} /></DocumentContext.Provider></DocumentBoundary> : <Unavailable>This document is unavailable.</Unavailable>}
  </article>
}
