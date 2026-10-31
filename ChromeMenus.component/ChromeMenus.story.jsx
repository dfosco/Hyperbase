import { ChromeMenuPreview } from './ChromeMenus.jsx'
import '../prototypes/chrome-overview.prototype/styles/shadcn.css'

export function Default() { return <ChromeMenuPreview defaultOpen /> }
export function Active() { return <ChromeMenuPreview defaultOpen initialFavorite /> }
export function Empty() { return <ChromeMenuPreview defaultOpen disabled /> }
export function Narrow() { return <div style={{ width: 320, maxWidth: "100%" }}><ChromeMenuPreview defaultOpen /></div> }
