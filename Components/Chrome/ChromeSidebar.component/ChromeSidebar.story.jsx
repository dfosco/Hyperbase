import { ChromeSidebar } from './ChromeSidebar.jsx'
import '../../../prototypes/chrome-overview.prototype/styles/shadcn.css'

export function Default() { return <ChromeSidebar /> }
export function Active() { return <ChromeSidebar initialActive="navigation" /> }
export function Empty() { return <ChromeSidebar pages={[]} /> }
export function Narrow() { return <div style={{ width: 240, maxWidth: "100%" }}><ChromeSidebar /></div> }
