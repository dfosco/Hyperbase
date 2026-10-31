import { useState } from 'react'
import { Copy, ExternalLink, FilePenLine, MoreHorizontal, Star, Trash2 } from 'lucide-react'
import { Button } from '../ui/button.jsx'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuCheckboxItem, DropdownMenuShortcut } from '../ui/dropdown-menu.jsx'
import css from './ChromeMenus.module.css'

export function ChromeMenus({ trigger, defaultOpen = false, disabled = false, initialFavorite = false, onAction }) {
  const [favorite, setFavorite] = useState(initialFavorite)
  return <DropdownMenu defaultOpen={defaultOpen}>
    <DropdownMenuTrigger render={trigger || <Button variant="outline"><MoreHorizontal data-icon="inline-start" />Page actions</Button>} />
    <DropdownMenuContent align="start" className="w-56">
      <DropdownMenuGroup><DropdownMenuLabel>Chrome Components</DropdownMenuLabel><DropdownMenuItem onClick={() => onAction?.('open')}><ExternalLink />Open in new tab</DropdownMenuItem><DropdownMenuItem disabled={disabled} onClick={() => onAction?.('rename')}><FilePenLine />Rename<DropdownMenuShortcut>↵</DropdownMenuShortcut></DropdownMenuItem><DropdownMenuItem disabled={disabled} onClick={() => onAction?.('duplicate')}><Copy />Duplicate</DropdownMenuItem></DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup><DropdownMenuCheckboxItem checked={favorite} onCheckedChange={setFavorite}><Star />Favorite</DropdownMenuCheckboxItem></DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup><DropdownMenuItem variant="destructive" disabled={disabled} onClick={() => onAction?.('delete')}><Trash2 />Delete page</DropdownMenuItem></DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
}
export function ChromeMenuPreview(props) {
  const [action, setAction] = useState('')
  return <section className={css.stage} aria-label="Page menu preview"><ChromeMenus {...props} onAction={setAction} />{action && <p role="status">Selected: {action}</p>}</section>
}
