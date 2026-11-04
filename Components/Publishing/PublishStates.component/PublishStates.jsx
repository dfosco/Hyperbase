import { useEffect, useId, useRef, useState } from 'react'
import { Button as ChromeButton } from './chrome/ui/button.jsx'
import { Input } from './chrome/ui/input.jsx'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './chrome/ui/select.jsx'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator } from './chrome/ui/dropdown-menu.jsx'
import ArrowRight from './chrome/lucide/icons/arrow-right.js'
import Check from './chrome/lucide/icons/check.js'
import ExternalLink from './chrome/lucide/icons/external-link.js'
import X from './chrome/lucide/icons/x.js'
import github from './brands/github.svg'
import netlify from './brands/netlify.svg'
import cloudflare from './brands/cloudflarepages.svg'
import vercel from './brands/vercel.svg'
import './chrome/core.css'
import './chrome/sidepanel.css'
import css from './PublishStates.module.css'
import SharedToast from '../../Feedback/Toast.component/Toast.jsx'

const Toast = ({ kind, children }) => <SharedToast kind={kind} size="small">{children}</SharedToast>

// Local theme composition; the upstream Chrome control stays unchanged.
const Button = ({ variant = 'default', ...props }) => <ChromeButton variant={variant} data-publishing-variant={variant} {...props}/>

export const providers = {
  GitHub: { name:'GitHub Pages', account:'GitHub account', owner:'dfosco', icon:github, color:'#181717', suffix:'github.io', files:['.github/workflows/deploy-pages.yml'], error:'The GitHub Actions build failed.' },
  Vercel: { name:'Vercel', account:'Team', owner:'dfosco', icon:vercel, color:'#000000', suffix:'vercel.app', files:['vercel.json'], error:'Vercel couldn’t find the build output.' },
  Netlify: { name:'Netlify', account:'Team', owner:'Fosco', icon:netlify, color:'#00C7B7', suffix:'netlify.app', files:['netlify.toml'], error:'The upload to Netlify timed out.' },
  Cloudflare: { name:'Cloudflare Pages', account:'Account', owner:'dfosco', icon:cloudflare, color:'#F38020', suffix:'pages.dev', files:['Remote Pages build settings'], error:'The Cloudflare Pages build failed.' },
}
const providerStates = new Set(['Authorize','AuthFailed','AuthCancelled','Configure','ConfigReview','AutoPublishConflict','Deploying','Live','Changes','Failed','Cancelled','Settings','AccessReview'])
const configuredStates = new Set(['Deploying','Live','Changes','Failed','Cancelled','Settings','AccessReview','AutoPublishConflict'])
const accessOptions = {
  GitHub:[['public','Public'],['private','Private · Enterprise Cloud organization']],
  Vercel:[['public','Public production'],['private','Vercel Authentication · all plans'],['password','Password · Pro add-on / Enterprise'],['ips','Trusted IPs · Enterprise']],
  Netlify:[['public','Public'],['private','Private · Netlify login'],['password','Password · Pro']],
  Cloudflare:[['public','Public'],['private','Cloudflare Access · setup required']],
}
const accessHelp = {
  GitHub:'Private Pages requires an Enterprise Cloud organization and an eligible private or internal project repository. Private source alone does not hide the website.',
  Vercel:'Standard Protection leaves production domains public. All Deployments with Vercel Authentication protects production on every plan. Password protection needs a paid Pro add-on or Enterprise; Trusted IPs needs Enterprise.',
  Netlify:'Set access in Netlify, for production and previews separately. Credit-based Free / Personal private projects allow only the Team Owner. Pro supports invitees and passwords. Legacy / Enterprise use different access controls.',
  Cloudflare:'The Pages access toggle protects previews only. Protect production pages.dev, preview aliases and every custom domain with separate Access policies. Verify all routes before publishing.',
}
const authHelp = {
  GitHub:'Proposed browser flow: register a GitHub App, approve repository permissions and validate the callback. No GitHub CLI required.',
  Netlify:'Proposed browser flow: register a Netlify OAuth application and callback. Its token grants API access; it is not a one-time device code.',
  Vercel:'Current no-install option: create a scoped Vercel API token in your browser and paste it locally. Browser OAuth needs a registered integration and secure token exchange. Sign-in identity alone cannot deploy.',
  Cloudflare:'Current no-install option: create an API token in your browser with Account → Cloudflare Pages → Edit, scoped to the intended account. This is not an authorization code.',
}
// One-line guidance for the chosen access option; the full provider rules stay one click away.
const accessHint = {
  GitHub:{public:'Anyone with the link can visit.',private:'Needs an eligible Enterprise Cloud organization repository.'},
  Vercel:{public:'Anyone with the link can visit production.',private:'Visitors sign in with Vercel. Covers production on every plan.',password:'Needs the Pro add-on or Enterprise.',ips:'Needs Enterprise.'},
  Netlify:{public:'Anyone with the link can visit.',private:'You finish this in Netlify. Hypercanvas can’t check it.',password:'Needs Pro. You finish this in Netlify.'},
  Cloudflare:{public:'Anyone with the link can visit.',private:'Every domain needs its own Access policy.'},
}
const accessLabel = (provider,access) => access==='public'?'Public':access==='password'?'Password':access==='ips'?'Trusted IPs':provider==='Vercel'?'Vercel Authentication':provider==='Cloudflare'?'Cloudflare Access':provider==='Netlify'?'Netlify login':'Private organization site'
// Prototype-only map from review screens to the full-file cards on the canvas.
const fileRefs = { GitHub:'F01, F06, F07, F13, F14', Vercel:'F01, F06, F07, F15, F16', Netlify:'F01, F06, F07, F09, F17–F19', Cloudflare:'F01, F06, F07, F09, F20–F22' }
const tokenProviders = new Set(['Vercel','Cloudflare'])
const STEPS = [['Connect GitHub','Choose the account that stores your notebook.'],['Push notebook','Save Hyperbase to a GitHub repository.'],['Publish website','Pick a provider and get a link to share.']]

function Brand({provider='GitHub'}) {
  const p=providers[provider]
  return <span className={css.brand} aria-hidden="true"><span data-brand={provider} style={{maskImage:`url("${p.icon}")`,WebkitMaskImage:`url("${p.icon}")`,backgroundColor:p.color}}/></span>
}
function Choice({label,value,onChange,options,id,hint}) {
  return <div className={css.field}><label htmlFor={id}>{label}</label><Select value={value} onValueChange={onChange}><SelectTrigger id={id} className={css.full} aria-label={label}><SelectValue>{options.find(o=>o.value===value)?.label}</SelectValue></SelectTrigger><SelectContent className={css.selectPopup}>{options.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>{hint&&<small>{hint}</small>}</div>
}
// Proposed surface capability; this does not change the app's SidePanel API.
function SidePanelShell({title='Publish',allowDocking=false,initialPosition='side',notebook,navigation,children,onClose}) {
  const [position,setPosition]=useState(initialPosition),titleId=useId()
  return <aside className={`sb-sidepanel ${css.panel}`} data-shell="shared" data-position={allowDocking?position:'side'} data-allow-docking={allowDocking} data-hc-ui="" aria-labelledby={titleId}>
    <header className={`sb-sidepanel-header ${css.header}`}><span className={`sb-sidepanel-title ${css.title}`} id={titleId}>{title}{notebook&&<span className={css.notebook} title={`Notebook: ${notebook}`}><span aria-hidden="true">·</span><span className={css.srOnly}>notebook</span>{notebook}</span>}</span><div className="sb-sidepanel-actions">{allowDocking&&<Button variant="ghost" size="icon-xs" aria-label={position==='side'?'Dock to bottom':'Dock to side'} onClick={()=>setPosition(position==='side'?'bottom':'side')}>▤</Button>}<Button variant="ghost" size="icon-xs" aria-label="Close panel" onClick={onClose}><X size={16}/></Button></div></header>
    {navigation}<div className={css.body}>{children}</div>
  </aside>
}
// Compact setup position: one eyebrow line instead of a separate stepper row.
function SetupProgress({step}) {
  return <div className={css.progressEyebrow}><span>Step {step+1} of 3</span><ol aria-label="Publishing setup">{STEPS.map(([label],i)=><li key={label} aria-current={i===step?'step':undefined} data-complete={i<step}><span className={css.srOnly}>{label}{i<step?', complete':i===step?', current':''}</span></li>)}</ol></div>
}
function WelcomeSteps() {
  return <ol className={css.welcomeSteps} aria-label="Publishing setup">{STEPS.map(([label,description],i)=><li key={label}><span className={css.stepNumber} aria-hidden="true">{i+1}</span><div><strong>{label}</strong><small>{description}</small></div></li>)}</ol>
}
function PublishArtwork() {
  return <div className={css.welcomeArt} aria-hidden="true"><div className={css.artBrowser}><div className={css.artTitle}><span/><span/><span/><strong>Hyperbase</strong></div><div className={css.artPages}><div/><div/><div/></div></div><span className={css.artArrow}>↗</span></div>
}
function Screen({title,lede,children,actions,eyebrow,label}) {
  return <section className={css.screen} aria-label={label}>{eyebrow}{title&&<h2>{title}</h2>}{lede&&<p className={css.lede}>{lede}</p>}{children}{actions&&<div className={css.actions}>{actions}</div>}</section>
}
function FileList({files}) {
  return <ul className={css.files}>{files.map(([path,action])=><li key={path}>{/[./]/.test(path)&&!path.includes(' ')?<code>{path}</code>:<span>{path}</span>}<small>{action}</small></li>)}</ul>
}
// Local adaptation of HyperAgent's persistent tab strip. Shared primitives stay intact.
const tabStatus=d=>d.state==='Deploying'?['busy','publishing']:['Failed','AuthFailed'].includes(d.state)?['error','failed']:d.state==='Changes'?['pending','unpublished changes']:d.hadLive?['live','live']:null
function PanelProviderTabs({destinations,selected,active,onSelect,onAdd,id}) {
  const refs=useRef({}),keys=Object.keys(destinations)
  function onKey(event,index){const next=event.key==='Home'?0:event.key==='End'?keys.length-1:event.key==='ArrowRight'?(index+1)%keys.length:event.key==='ArrowLeft'?(index+keys.length-1)%keys.length:null;if(next===null)return;event.preventDefault();onSelect(keys[next]);refs.current[keys[next]]?.focus();refs.current[keys[next]]?.scrollIntoView({block:'nearest',inline:'nearest'})}
  return <nav className={css.providerNavigation} aria-label="Publishing providers"><div role="tablist" aria-label="Publishing provider" className={css.providerTabs}>{keys.map((key,index)=>{const status=tabStatus(destinations[key]);return <Button ref={element=>{refs.current[key]=element}} role="tab" id={`${id}-tab-${key}`} aria-controls={`${id}-panel-${key}`} aria-selected={selected===key&&active} tabIndex={selected===key?0:-1} key={key} variant="ghost" aria-label={providers[key].name} aria-description={status?.[1]} onKeyDown={event=>onKey(event,index)} onClick={()=>onSelect(key)}><Brand provider={key}/><span>{key}</span>{status&&<span className={css.tabStatus} data-status={status[0]} title={status[1]} aria-hidden="true"/>}</Button>})}</div><Button variant="ghost" size="icon-xs" className={css.addProvider} aria-label="Add publishing provider" title="Add publishing provider" onClick={onAdd}><span aria-hidden="true">+</span></Button></nav>
}
const sourceStates=['RepositoryPush','RepositoryPushing','RepositoryPushed','RepositoryPushFailed','RepositoryPushCancelled']
const gitStates=['GitDisconnected','GitAuthorize','GitAuthFailed','GitAuthCancelled']
const settingsValues = x => ({project:x.project,access:x.access,accessChecked:x.accessChecked,configReviewed:x.configReviewed,triggersReviewed:x.triggersReviewed,dirty:x.dirty})
function seed(provider,state,access='public') {
  const value={state,project:'hyperbase',publishedProject:'hyperbase',publishedAccess:access,access,configured:configuredStates.has(state),hadLive:['Live','Changes','Failed','Settings'].includes(state),accessChecked:configuredStates.has(state)&&state!=='AccessReview',configReviewed:configuredStates.has(state),triggersReviewed:configuredStates.has(state)&&state!=='AutoPublishConflict',dirty:false}
  return state==='Settings'?{...value,returnTo:'Live',saved:settingsValues(value)}:value
}

export default function PublishStates({initialState='GitDisconnected',initialProvider='GitHub',initialAccess='public',multiple=false,inspector=false,initialSurface}) {
  const id=useId()
  const menuInitial=['ToolMenu','ToolSetupFailed'].includes(initialState)
  const [provider,setProvider]=useState(initialProvider)
  const [view,setView]=useState(providerStates.has(initialState)?'Provider':initialState)
  const [destinations,setDestinations]=useState(()=>{
    const base=multiple||menuInitial?{GitHub:seed('GitHub','Changes'),Vercel:seed('Vercel','Live')}:{}
    if(multiple)Object.assign(base,{Netlify:seed('Netlify','Failed'),Cloudflare:seed('Cloudflare','Configure')})
    if(initialState==='ToolSetupFailed')base.Netlify=seed('Netlify','AuthFailed')
    if(providerStates.has(initialState))base[initialProvider]=seed(initialProvider,initialState,initialAccess)
    return base
  })
  const [surface,setSurface]=useState(initialSurface||(menuInitial?'menu':initialState==='ToolFirstUse'?'tool':'panel'))
  const [repository,setRepository]=useState('hyperbase'),[visibility,setVisibility]=useState(initialProvider==='GitHub'&&initialAccess==='private'?'private':'public')
  const [message,setMessage]=useState(''),[reviewed,setReviewed]=useState(false),[browserOpened,setBrowserOpened]=useState(false)
  const [accessConfirmed,setAccessConfirmed]=useState(false)
  const [pushStarted,setPushStarted]=useState(null),[sourcePushed,setSourcePushed]=useState(initialState==='RepositoryPushed'||providerStates.has(initialState)||initialState==='HostSelect'||menuInitial||multiple)
  const [repositoryReused,setRepositoryReused]=useState(false),[pushTriggersReviewed,setPushTriggersReviewed]=useState(false)
  const p=providers[provider],d=destinations[provider]||seed(provider,'Authorize')
  const state=view==='Provider'?d.state:view
  const liveAccess=d.publishedAccess||d.access
  const eligiblePrivatePages=initialProvider==='GitHub'&&initialAccess==='private'
  const canVerifyAccess=provider!=='GitHub'||d.access==='public'||eligiblePrivatePages
  const configured=Object.values(destinations).some(x=>x.configured)
  const anyProvider=Object.keys(destinations).length>0
  const url=provider==='GitHub'?(d.access==='private'&&d.accessChecked?'hyperbase-a1b2.pages.github.io':`dfosco.github.io/${repository}/`):`${d.project}.${p.suffix}`
  const publishedUrl=provider==='GitHub'?(liveAccess==='private'?'hyperbase-a1b2.pages.github.io':`dfosco.github.io/${repository}/`):`${d.publishedProject||'hyperbase'}.${p.suffix}`
  const sourceRepository=`${eligiblePrivatePages?'example-enterprise':'dfosco'} / ${repository}`
  const sourceDetail=`${visibility==='public'?'Public':'Private'} · main`
  const patch=(values,key=provider)=>setDestinations(old=>({...old,[key]:{...(old[key]||seed(key,'Authorize')),...values}}))
  const go=(next)=>{setMessage('');setReviewed(false);setBrowserOpened(false);if(providerStates.has(next)){patch({state:next});setView('Provider')}else setView(next)}
  const selectProvider=key=>{setProvider(key);setView('Provider');setMessage('');setReviewed(false)}
  const choose=key=>{setProvider(key);setDestinations(old=>({...old,[key]:old[key]||seed(key,key==='GitHub'?'Configure':'Authorize')}));setView('Provider');setMessage('')}
  const startPush=()=>{setSourcePushed(false);setPushStarted(Date.now());go('RepositoryPushing')}
  useEffect(()=>{if(!pushStarted)return;const timer=setTimeout(()=>{setSourcePushed(true);setPushStarted(null);setView('RepositoryPushed')},1400);return()=>clearTimeout(timer)},[pushStarted])
  const startPublish=()=>{setSurface('panel');setView('Provider');patch({state:'Deploying',configured:true,configReviewed:true,triggersReviewed:true,dirty:false,phase:'push',started:Date.now()})}
  const reviewPublish=()=>{setSurface('panel');go('ConfigReview')}
  const needsAccessReview=()=>!d.accessChecked&&(d.access!=='public'||provider==='Netlify')
  const confirmReview=()=>{if(needsAccessReview()){go('AccessReview');return}startPublish()}
  const publishSelected=()=>{setSurface('panel');if(d.configured&&!d.triggersReviewed){go('AutoPublishConflict');return}if(needsAccessReview()){go('AccessReview');return}startPublish()}
  // Settings edits stay independent per provider; Cancel restores the values from when settings opened.
  const overview=x=>x.hadLive?(x.dirty?'Changes':'Live'):'Configure'
  const openSettings=()=>{setSurface('panel');setView('Provider');setMessage('');patch({state:'Settings',returnTo:d.state==='Settings'?d.returnTo:d.state,saved:d.state==='Settings'?d.saved:settingsValues(d)})}
  const cancelSettings=()=>{const back=d.returnTo&&d.returnTo!=='Settings'?d.returnTo:overview({...d,dirty:false});patch({...(d.saved||{}),state:back,saved:null,returnTo:null})}
  const saveSettings=()=>{const next=d.dirty?(d.hadLive?'Changes':'Configure'):(d.returnTo||overview(d));patch({dirty:false,saved:null,returnTo:null,state:next});setMessage(d.hadLive&&d.dirty?'Settings saved. Publish to apply them to the website.':'Settings saved.')}
  useEffect(()=>{
    if(!Object.values(destinations).some(x=>x.state==='Deploying'&&x.started))return
    const timer=setInterval(()=>setDestinations(old=>Object.fromEntries(Object.entries(old).map(([key,value])=>[key,value.state==='Deploying'&&value.started&&Date.now()-value.started>=1400?{...value,state:'Live',hadLive:true,publishedProject:value.project,publishedAccess:value.access,started:null}:value.state==='Deploying'&&value.started&&value.phase==='push'&&Date.now()-value.started>=500?{...value,phase:'publish'}:value]))),150)
    return()=>clearInterval(timer)
  },[destinations])
  const toolClick=()=>setSurface(configured?'menu':'panel')
  const tool=<Button variant="outline" aria-label="Publish tool" aria-expanded={surface!=='tool'} onClick={toolClick}>↑ Publish</Button>
  const tabs=anyProvider&&<PanelProviderTabs destinations={destinations} selected={provider} active={view==='Provider'} onSelect={selectProvider} onAdd={()=>go('HostSelect')} id={id}/>
  const setupStep=gitStates.includes(state)?0:['RepositoryCreate','RepositoryExisting','RepositoryConflict',...sourceStates].includes(state)?1:2
  const eyebrow=!configured&&<SetupProgress step={setupStep}/>
  const accessText=x=>`${accessLabel(provider,x)}${x==='public'?'':provider==='Netlify'?' · confirmed by you':' · verified'}`
  const statusLabel=d.state==='AuthFailed'?'Setup failed':d.state==='Deploying'?'Publishing…':d.state==='Changes'?'Unpublished changes':d.state==='Live'?'Live':d.state==='Failed'?'Publish failed':'Not published'

  // Prototype scaffolding: scenario shortcuts and integration notes stay outside the product surface.
  const scenario=surface!=='panel'?[]:gitStates.slice(1).includes(state)?[['Simulate approval',()=>go('RepositoryCreate')],['Simulate failure',()=>go('GitAuthFailed')]]
    :state==='RepositoryPushing'?[['Simulate push failure',()=>{setPushStarted(null);go('RepositoryPushFailed')}]]
    :view!=='Provider'?[]
    :['Authorize','AuthFailed','AuthCancelled'].includes(state)?[['Simulate verified access',()=>go('Configure')],['Simulate failure',()=>go('AuthFailed')]]
    :['Configure','Settings'].includes(state)?[['Existing files found',reviewPublish],['Automatic publishing conflict',()=>go('AutoPublishConflict')]]
    :state==='ConfigReview'?[['Other sites would auto-publish',()=>go('AutoPublishConflict')]]
    :state==='Deploying'?[['Simulate failure',()=>patch({state:'Failed',started:null})]]:[]
  const note=gitStates.includes(state)?authHelp.GitHub:view==='Provider'&&['Authorize','AuthFailed','AuthCancelled'].includes(state)?authHelp[provider]:view==='Provider'&&['ConfigReview','AccessReview','AutoPublishConflict','Configure','Settings'].includes(state)?`Full file and remote-setting contents: ${fileRefs[provider]} in the matching canvas section. Credentials never belong in these files.`:state==='RepositoryConflict'?'Full Before/After contents: F04 README.md and F01 in canvas section 01.':null
  const prototype=<div className={css.prototype} aria-label="Prototype controls" role="group">
    {(scenario.length>0||message)&&<div className={css.scenario}><span>Preview</span>{scenario.map(([label,run])=><Button key={label} variant="outline" size="xs" onClick={run}>{label}</Button>)}{message&&<span role="status" className={css.feedback}>{message}</span>}</div>}
    {note&&<details className={css.note}><summary>Integration note</summary><p>{note}</p></details>}
    <p className={css.simulation}>Interactive design. No account connection, file write or deployment.</p>
  </div>

  const accessDetails=<details className={css.disclosure}><summary>About website access on {p.name}</summary><p>{accessHelp[provider]}</p>{provider==='GitHub'&&<p>Free plans publish Pages from public repositories. Private source needs an eligible paid plan, separately from website access.</p>}</details>
  const settingsFields=<>
    <Choice label={p.account} id={`${id}-account`} value={p.owner} onChange={()=>{}} options={[{value:p.owner,label:p.owner}]}/>
    {provider!=='GitHub'&&<div className={css.field}><label htmlFor={`${id}-project`}>{provider==='Netlify'?'Site name':'Project name'}</label><Input id={`${id}-project`} value={d.project} onChange={e=>patch({project:e.target.value,dirty:true,accessChecked:false,configReviewed:false,triggersReviewed:false})} required pattern="[A-Za-z0-9-]+"/><small>{url}</small></div>}
    <Choice label={provider==='Netlify'?'Requested website access':'Website access'} id={`${id}-access`} value={d.access} onChange={access=>patch({access,accessChecked:false,dirty:true})} options={accessOptions[provider].map(([value,label])=>({value,label}))} hint={accessHint[provider][d.access]}/>
    {accessDetails}
    <dl className={css.metadata}>{provider==='GitHub'&&<><dt>Website</dt><dd>{url}</dd></>}<dt>Source</dt><dd>{sourceRepository}<small>{sourceDetail}</small></dd></dl>
  </>

  if(inspector)return <div className={css.preview} data-publish-state="InspectorDocking">{surface==='tool'?tool:<SidePanelShell title="Inspector" allowDocking initialPosition={initialState==='InspectorDockBottom'?'bottom':'side'} onClose={()=>setSurface('tool')}><Screen title="Panel placement" lede="Inspector can dock to the side or bottom. Publish uses this same shell, fixed to the side."><details className={css.disclosure} open><summary>Proposed surface capability</summary><code className={css.code}>SidePanelShell allowDocking={'{true}'}<br/>Publish: allowDocking={'{false}'}</code></details></Screen></SidePanelShell>}{prototype}</div>
  return <div className={css.preview} data-publish-state={state} data-provider={provider} data-surface={surface}>
    {surface!=='panel'&&(configured?<DropdownMenu open={surface==='menu'} onOpenChange={open=>open?setSurface('menu'):setSurface(old=>old==='menu'?'tool':old)}>
      <div className={css.toolbar}><DropdownMenuTrigger render={tool}/></div>
      <DropdownMenuContent className={css.chromeMenu} aria-label="Publish menu">
        <DropdownMenuGroup><DropdownMenuLabel>Publish Hyperbase to</DropdownMenuLabel><DropdownMenuRadioGroup value={provider} onValueChange={selectProvider}>{Object.keys(destinations).map(key=><DropdownMenuRadioItem key={key} value={key} closeOnClick={false}><Brand provider={key}/>{providers[key].name}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuGroup>
        <DropdownMenuSeparator/>
        <DropdownMenuGroup><DropdownMenuLabel>{p.name} · {statusLabel}</DropdownMenuLabel>
        {d.configured&&d.state!=='Deploying'?<DropdownMenuItem onClick={publishSelected}>{d.state==='Failed'?'Retry publish':d.state==='Changes'?'Publish changes':'Publish'} to {p.name}</DropdownMenuItem>:<DropdownMenuItem onClick={()=>{setSurface('panel');setView('Provider')}}>{d.state==='Deploying'?'View progress':'Finish setup'}</DropdownMenuItem>}
        {d.hadLive&&<DropdownMenuItem onClick={()=>setMessage('Website link preview only.')}>Open website<ExternalLink size={14}/></DropdownMenuItem>}
        </DropdownMenuGroup><DropdownMenuSeparator/>
        <DropdownMenuItem onClick={()=>d.configured?openSettings():(setSurface('panel'),setView('Provider'))}>Publishing settings</DropdownMenuItem>
        <DropdownMenuItem onClick={()=>{setSurface('panel');go('HostSelect')}}>Add publishing provider</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>:<div className={css.toolbar}>{tool}</div>)}
    {surface==='panel'&&<SidePanelShell notebook="Hyperbase" navigation={tabs} onClose={()=>setSurface('tool')}>
      {state==='ToolFirstUse'&&<section className={css.welcome}><PublishArtwork/><h2>Put your notebook on the web</h2><p className={css.lede}>Share your canvases and prototypes with one website link.</p><WelcomeSteps/><Button className={css.full} onClick={()=>go('GitAuthorize')}><Brand/>Connect GitHub<ArrowRight size={14}/></Button><small>You choose where to publish and who can visit.</small></section>}
      {gitStates.includes(state)&&<Screen eyebrow={eyebrow} title="Connect GitHub" lede="Sign in to GitHub in your browser. Hyperbase’s source is saved to a repository you choose."
        actions={state==='GitDisconnected'?<Button className={css.grow} onClick={()=>go('GitAuthorize')}><Brand/>Connect GitHub</Button>:<><Button className={css.grow} onClick={()=>{go('GitAuthorize');setBrowserOpened(true)}}>Open GitHub<ExternalLink size={14}/></Button><Button variant="outline" onClick={()=>go('GitAuthCancelled')}>Cancel</Button></>}>
        {['GitAuthFailed','GitAuthCancelled'].includes(state)&&<Toast kind="error">{state==='GitAuthCancelled'?'Authorization cancelled. No repository was connected.':'Authorization failed. Your notebook is unchanged.'}</Toast>}
        {browserOpened&&<p className={css.waiting} role="status"><span className={css.spinner} aria-hidden="true"/>Waiting for GitHub…</p>}
      </Screen>}
      {['RepositoryCreate','RepositoryExisting'].includes(state)&&<Screen eyebrow={eyebrow} title="Choose a repository">
        <p className={css.account}><Brand/>Signed in as dfosco</p>
        <div className={css.segmented} role="group" aria-label="Repository setup"><Button variant={state==='RepositoryCreate'?'secondary':'ghost'} aria-pressed={state==='RepositoryCreate'} onClick={()=>go('RepositoryCreate')}>New repository</Button><Button variant={state==='RepositoryExisting'?'secondary':'ghost'} aria-pressed={state==='RepositoryExisting'} onClick={()=>go('RepositoryExisting')}>Existing</Button></div>
        <form onSubmit={e=>{e.preventDefault();go(state==='RepositoryExisting'?'RepositoryConflict':'RepositoryPush')}}>{state==='RepositoryCreate'?<><div className={css.field}><label htmlFor={`${id}-repo`}>Repository name</label><Input id={`${id}-repo`} value={repository} onChange={e=>setRepository(e.target.value)} required pattern="[A-Za-z0-9._-]+"/></div><Choice label="Source visibility" id={`${id}-source`} value={visibility} onChange={setVisibility} options={[{value:'public',label:'Public'},{value:'private',label:'Private'}]} hint="Who can see the source. Website access is chosen later."/></>:<Choice label="Repository" id={`${id}-existing`} value={repository} onChange={setRepository} options={[{value:'hyperbase',label:'dfosco / hyperbase'},{value:'notebook-site',label:'dfosco / notebook-site'}]} hint="Existing files are compared before anything is replaced."/>}<div className={css.actions}><Button type="submit" className={css.grow}>{state==='RepositoryCreate'?'Create repository':'Continue'}</Button></div></form>
      </Screen>}
      {state==='RepositoryConflict'&&<Screen eyebrow={eyebrow} title="Review existing files" lede={`dfosco / ${repository} already has files Hypercanvas would replace. Nothing has changed yet.`}
        actions={<><Button className={css.grow} disabled={!reviewed} onClick={()=>{setRepositoryReused(true);go('RepositoryPush')}}>Use this repository</Button><Button variant="outline" onClick={()=>go('RepositoryExisting')}>Cancel</Button></>}>
        <FileList files={[['README.md','Keep'],['backstage/publish/package.json','Replace'],['.github/workflows/deploy-pages.yml','Replace']]}/>
        <label className={css.checkbox}><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>I reviewed the proposed changes</label>
      </Screen>}
      {state==='RepositoryPush'&&<Screen eyebrow={eyebrow} label="Push notebook source" title="Push your notebook" lede="Save Hyperbase to GitHub. Its website isn’t published yet."
        actions={<><Button className={css.grow} disabled={repositoryReused&&!pushTriggersReviewed} onClick={startPush}>Push notebook<ArrowRight size={14}/></Button><Button variant="outline" onClick={()=>go('RepositoryCreate')}>Back</Button></>}>
        <dl className={css.metadata}><dt>Repository</dt><dd>{sourceRepository}<small>{sourceDetail}</small></dd></dl>
        {repositoryReused&&<><Toast kind="warning">Pushing can trigger websites already connected to this repository.</Toast><label className={css.checkbox}><input type="checkbox" checked={pushTriggersReviewed} onChange={e=>setPushTriggersReviewed(e.target.checked)}/>I checked automatic publishing for this repository</label></>}
      </Screen>}
      {state==='RepositoryPushing'&&<Screen eyebrow={eyebrow} label="Push notebook source" title="Pushing to GitHub…" lede="Your website isn’t published yet."
        actions={<Button variant="outline" onClick={()=>{setPushStarted(null);go('RepositoryPushCancelled')}}>Cancel push</Button>}>
        <ol className={css.progress}><li data-done="true"><Check size={14}/><span>Prepare notebook</span></li><li><span className={css.spinner} aria-label="Loading"/><span>Push to {sourceRepository}</span></li></ol>
      </Screen>}
      {state==='RepositoryPushed'&&<Screen eyebrow={eyebrow} label="Push notebook source" title="Notebook saved to GitHub" lede="Next, choose where to publish its website."
        actions={<Button className={css.grow} onClick={()=>go('HostSelect')}>Choose publishing provider<ArrowRight size={14}/></Button>}>
        <dl className={css.metadata}><dt>Repository</dt><dd>{sourceRepository}<small>Pushed · main</small></dd><dt>Website</dt><dd>Not published</dd></dl>
      </Screen>}
      {['RepositoryPushFailed','RepositoryPushCancelled'].includes(state)&&<Screen eyebrow={eyebrow} label="Push notebook source" title={state==='RepositoryPushFailed'?'Push failed':'Push stopped'}
        actions={<><Button className={css.grow} onClick={startPush}>Retry push</Button><Button variant="outline" onClick={()=>go('RepositoryPush')}>Back</Button></>}>
        <Toast kind="error">{state==='RepositoryPushFailed'?'GitHub couldn’t confirm the update. Check repository access and try again.':'Stopped waiting. Check GitHub before retrying; the push may have finished.'}</Toast>
        <p className={css.help}>No website publishing has started. Your local notebook is unchanged.</p>
      </Screen>}
      {state==='HostSelect'&&<Screen eyebrow={eyebrow} title={configured?'Add publishing provider':'Choose a publishing provider'} lede="Each provider publishes and is set up separately.">
        <div className={css.providers}>{Object.entries(providers).map(([key,item])=><Button key={key} variant="outline" className={css.providerChoice} onClick={()=>choose(key)}><Brand provider={key}/><span>{item.name}</span><small>{destinations[key]?'Added':''}</small><ArrowRight size={14}/></Button>)}</div>
      </Screen>}
      {Object.keys(destinations).filter(key=>key!==provider||view!=='Provider').map(key=><section role="tabpanel" id={`${id}-panel-${key}`} aria-labelledby={`${id}-tab-${key}`} hidden key={key}/>)}
      {view==='Provider'&&<section role="tabpanel" id={`${id}-panel-${provider}`} aria-labelledby={`${id}-tab-${provider}`}>
        {['Authorize','AuthFailed','AuthCancelled'].includes(state)&&<Screen eyebrow={eyebrow} title={`Connect ${p.name}`} lede={tokenProviders.has(provider)?`Create an API token in ${p.name}, then paste it here.`:`Sign in to ${p.name} in your browser to allow publishing.`}
          actions={tokenProviders.has(provider)?<><Button className={css.grow} disabled>Connect</Button><Button variant="outline" onClick={()=>go('AuthCancelled')}>Cancel</Button></>:<><Button className={css.grow} onClick={()=>{go('Authorize');setBrowserOpened(true)}}>Open {p.name}<ExternalLink size={14}/></Button><Button variant="outline" onClick={()=>go('AuthCancelled')}>Cancel</Button></>}>
          {state!=='Authorize'&&<Toast kind="error">{state==='AuthCancelled'?'Connection cancelled. Other providers are unchanged.':'Access couldn’t be verified. Check permissions and try again.'}</Toast>}
          {tokenProviders.has(provider)&&<><Button variant="outline" className={css.full} onClick={()=>setBrowserOpened(true)}>Create token in {p.name}<ExternalLink size={14}/></Button><div className={css.field}><label htmlFor={`${id}-token`}>API token</label><Input id={`${id}-token`} type="password" readOnly value="" placeholder="Token entry is off in this preview"/><small>Kept on this computer, never in notebook files.</small></div></>}
          {browserOpened&&<p className={css.waiting} role="status">{tokenProviders.has(provider)?'Browser step preview opened. No external connection.':<><span className={css.spinner} aria-hidden="true"/>Waiting for {p.name}…</>}</p>}
        </Screen>}
        {state==='Configure'&&<form onSubmit={e=>{e.preventDefault();publishSelected()}}><Screen eyebrow={eyebrow} title={`Set up ${p.name}`} actions={<Button type="submit" className={css.grow}>Publish</Button>}>{settingsFields}</Screen></form>}
        {state==='Settings'&&<form onSubmit={e=>{e.preventDefault();saveSettings()}}><Screen title="Settings" actions={<><Button type="submit" className={css.grow}>Save settings</Button><Button type="button" variant="outline" onClick={cancelSettings}>Cancel</Button></>}>{settingsFields}</Screen></form>}
        {state==='ConfigReview'&&<Screen eyebrow={eyebrow} title="Review publishing files" lede={`Some files ${p.name} needs already exist. Compare them before replacing.`}
          actions={<><Button className={css.grow} disabled={!reviewed} onClick={confirmReview}>Replace and publish</Button><Button variant="outline" onClick={()=>go('Configure')}>Keep existing</Button></>}>
          <FileList files={[[p.files[0],provider==='Cloudflare'?'Remote':'Replace'],['Shared build files','Update'],['Notebook publishing settings','Update']]}/>
          <label className={css.checkbox}><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>I reviewed files and automatic publishing</label>
        </Screen>}
        {state==='AutoPublishConflict'&&<Screen title="Other websites may publish too" lede={`Pushing Hyperbase can trigger automatic publishing on other providers connected to this repository. Turn those triggers off to publish only to ${p.name}.`}
          actions={<><Button className={css.grow} onClick={()=>go('ConfigReview')}>Back to review</Button><Button variant="outline" onClick={openSettings}>Settings</Button></>}>
          <Toast kind="error">Publishing is paused until automatic triggers are reviewed.</Toast>
        </Screen>}
        {state==='AccessReview'&&<Screen title="Finish website access" lede={provider==='Netlify'?'Set access in Netlify for production and previews. Hypercanvas can’t check this setting.':`${accessLabel(provider,d.access)} isn’t active until it’s set up in ${p.name}.`}
          actions={!canVerifyAccess?<Button variant="outline" className={css.grow} onClick={()=>go('Configure')}>Back to settings</Button>:provider==='Netlify'?<><Button className={css.grow} disabled={!accessConfirmed} onClick={()=>{patch({accessChecked:true,state:'Configure',dirty:true});setView('Provider')}}>Continue</Button><Button variant="outline" onClick={()=>go('Configure')}>Back</Button></>:<><Button className={css.grow} onClick={()=>{patch({accessChecked:true,state:'Configure',dirty:true});setView('Provider')}}>Check again</Button><Button variant="outline" onClick={()=>go('Configure')}>Back</Button></>}>
          <dl className={css.metadata}><dt>Requested</dt><dd>{accessOptions[provider].find(([key])=>key===d.access)?.[1]}</dd><dt>Status</dt><dd>{d.accessChecked?'Verified':'Pending'}</dd></dl>
          {canVerifyAccess?<Button variant="outline" className={css.full} onClick={()=>setMessage('Provider settings link preview only.')}>Open {p.name} settings<ExternalLink size={14}/></Button>:<Toast kind="error">This personal repository can’t publish a private Pages site. Choose an eligible Enterprise Cloud organization repository.</Toast>}
          {provider==='Netlify'&&<label className={css.checkbox}><input type="checkbox" checked={accessConfirmed} onChange={e=>setAccessConfirmed(e.target.checked)}/>I set access for production and previews in Netlify</label>}
          {accessDetails}
        </Screen>}
        {state==='Deploying'&&<Screen title={`Publishing to ${p.name}…`} lede="Other providers aren’t affected." actions={<Button variant="outline" onClick={()=>patch({state:'Cancelled',started:null})}>Cancel publish</Button>}>
          <ol className={css.progress}><li data-done={d.phase!=='push'}>{d.phase==='push'?<span className={css.spinner} aria-label="Loading"/>:<Check size={14}/>}<span>Push notebook to GitHub</span><small>{d.phase==='push'?'Running':'Done'}</small></li><li>{d.phase==='push'?<span className={css.pending}/>:<span className={css.spinner} aria-label="Loading"/>}<span>Publish to {p.name}</span><small>{d.phase==='push'?'Queued':'Running'}</small></li></ol>
        </Screen>}
        {state==='Live'&&<Screen title="Website is live" lede={publishedUrl} actions={<><Button className={css.grow} onClick={()=>setMessage('Website link preview only.')}>Open website<ExternalLink size={14}/></Button><Button variant="outline" onClick={openSettings}>Settings</Button></>}>
          <dl className={css.metadata}><dt>Access</dt><dd>{accessText(liveAccess)}</dd><dt>Published</dt><dd>Just now</dd></dl>
          {provider==='GitHub'&&liveAccess==='private'&&<p className={css.help}>Organization site from a private repository. Only repository readers can visit.</p>}
        </Screen>}
        {state==='Changes'&&<Screen title="Unpublished changes" lede={`${publishedUrl} shows the previous version.`} actions={<><Button className={css.grow} onClick={publishSelected}>Publish changes</Button><Button variant="outline" onClick={openSettings}>Settings</Button></>}>
          <ul className={css.changes}><li>Chrome Overview<small>Edited</small></li><li>Publish flows<small>Added</small></li></ul>
        </Screen>}
        {['Failed','Cancelled'].includes(state)&&<Screen title={state==='Failed'?'Publish failed':'Publish cancelled'} lede={d.hadLive?`${publishedUrl} still shows the previous version.`:'Nothing has been published yet.'} actions={<><Button className={css.grow} onClick={startPublish}>Retry publish</Button><Button variant="outline" onClick={openSettings}>Settings</Button></>}>
          <Toast kind="error">{state==='Failed'?p.error:`Stopped waiting. A job ${p.name} already started may still finish; check its dashboard.`}</Toast>
          <p className={css.help}>Notebook changes and provider settings are saved.</p>
        </Screen>}
      </section>}
    </SidePanelShell>}
    {prototype}
  </div>
}
