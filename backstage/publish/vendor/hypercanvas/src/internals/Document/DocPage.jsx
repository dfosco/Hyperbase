import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import * as initial from 'virtual:hypercanvas-documents'
import Document from './Document.jsx'
import { createDocumentResolvers } from './resolvers.js'

export default function DocPage() {
  const { docId } = useParams()
  const [data, setData] = useState(() => initial.getDocumentSnapshot())
  useEffect(() => {
    const update = event => setData(event.detail)
    window.addEventListener('hypercanvas:documents-updated', update)
    return () => window.removeEventListener('hypercanvas:documents-updated', update)
  }, [])
  const { documents, artifacts, contents, assets, mode } = data
  const resolvers = useMemo(() => createDocumentResolvers({ artifacts, assets, mode, base: import.meta.env.BASE_URL }), [artifacts, assets, mode])
  const matches = documents.filter(item => item.id === docId)
  const artifact = matches[0]
  const entry = artifact && contents[artifact.path]
  return <Document {...resolvers} artifact={matches.length === 1 ? artifact : { ...artifact, available: false }} artifacts={artifacts} Content={entry?.Content} source={entry?.source} diagnostics={entry?.diagnostics} mode={mode} />
}
