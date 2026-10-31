import { ChromeTopbar } from './ChromeTopbar.jsx'
import '../prototypes/chrome-overview.prototype/styles/shadcn.css'

export function Default() { return <ChromeTopbar /> }
export function Active() { return <ChromeTopbar status="Saving…" canGoForward /> }
export function SidebarCollapsed() { return <ChromeTopbar sidebarOpen={false} /> }
export function Empty() { return <ChromeTopbar title="" status="Unsaved" canGoBack={false} /> }
export function Narrow() { return <div style={{ width: 360, maxWidth: "100%" }}><ChromeTopbar /></div> }
