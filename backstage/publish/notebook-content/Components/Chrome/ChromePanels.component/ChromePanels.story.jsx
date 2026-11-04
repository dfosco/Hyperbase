import { ChromePanels } from './ChromePanels.jsx'
import '../../../prototypes/chrome-overview.prototype/styles/shadcn.css'

export function Default() { return <ChromePanels /> }
export function Active() { return <ChromePanels initialName="Navigation studies" initialPinned={false} /> }
export function Empty() { return <ChromePanels empty /> }
export function Narrow() { return <div style={{ width: 340, maxWidth: "100%" }}><ChromePanels /></div> }
