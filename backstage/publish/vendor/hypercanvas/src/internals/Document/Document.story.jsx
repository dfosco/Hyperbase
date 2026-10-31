import Document from './Document.jsx'
const artifact = { id: 'example', title: 'Document', available: true }
export function Prose() { return <Document artifact={artifact} Content={() => <><h2>Source-order content</h2><p>Portable Markdown and explicit embeds.</p></>} /> }
