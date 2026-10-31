import { useId, useState } from 'react'
import { Button } from '../PublishStates.component/chrome/ui/button.jsx'
import '../PublishStates.component/chrome/core.css'
import css from './PublishFiles.module.css'

export default function PublishFiles({ document }) {
  const [version,setVersion]=useState(document.versions.length>1?1:0)
  const [feedback,setFeedback]=useState('')
  const panelId=useId(),current=document.versions[version]
  async function copy(){try{await navigator.clipboard.writeText(current.text);setFeedback('Copied complete contents')}catch{setFeedback('Select the code to copy complete contents')}}
  return <article className={css.card} data-file-card={document.id} data-hc-ui="" aria-label={document.title}>
    <header className={css.header}><span className={css.kind}>{document.reference} · {document.kind} · design example</span><h2>{document.title}</h2><code className={css.path}>{document.path}</code><p>{document.root}</p></header>
    <dl className={css.metadata}><dt>Write</dt><dd>{document.action}</dd><dt>Owner</dt><dd>{document.owner}</dd><dt>Store</dt><dd>{document.persistence}</dd></dl>
    <nav className={css.tabs} aria-label="File version">{document.versions.map((item,index)=><Button key={item.label} size="xs" variant={version===index?'secondary':'ghost'} aria-pressed={version===index} aria-controls={panelId} onClick={()=>{setVersion(index);setFeedback('')}}>{item.label}</Button>)}</nav>
    <div className={css.codeHeader}><span>{current.language} · {current.text?current.text.split('\n').length:0} lines · full contents</span><Button size="xs" variant="ghost" onClick={copy}>Copy complete contents</Button></div>
    <section className={css.codeArea} id={panelId} aria-label={current.label} tabIndex={0}>{current.absent?<p className={css.absent}>File absent from this provider’s staged output. Source file is retained.</p>:<pre><code>{current.text}</code></pre>}</section>
    <footer className={css.footer}><p>{document.notes}</p>{document.sources.length>0?<div className={css.sources}>{document.sources.map(({url,label},i)=><a key={url} href={url} target="_blank" rel="noreferrer">Source {i+1}: {label}</a>)}</div>:null}<span className={css.feedback} role="status">{feedback}</span></footer>
  </article>
}
