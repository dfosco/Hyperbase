import { ChromeDialogs } from './ChromeDialogs.jsx'
import '../prototypes/chrome-overview.prototype/styles/shadcn.css'

export function Default() { return <ChromeDialogs /> }
export function Active() { return <ChromeDialogs initialTitle="Navigation studies" /> }
export function Empty() { return <ChromeDialogs initialTitle="" /> }
export function Narrow() { return <div style={{ width: 340, maxWidth: "100%" }}><ChromeDialogs /></div> }
