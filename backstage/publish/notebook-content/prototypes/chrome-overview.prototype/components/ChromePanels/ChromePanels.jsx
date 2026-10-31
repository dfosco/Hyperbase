import { useId, useState } from 'react'
import { Info, PanelRight } from 'lucide-react'
import { Button } from '../ui/button.jsx'
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '../ui/sheet.jsx'
import { FieldGroup, Field, FieldLabel } from '../ui/field.jsx'
import { Input } from '../ui/input.jsx'
import { Switch } from '../ui/switch.jsx'
import { Separator } from '../ui/separator.jsx'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '../ui/empty.jsx'
import css from './ChromePanels.module.css'

export function ChromePanels({ defaultOpen = true, empty = false, initialName = "Chrome Components", initialPinned = true, onSave }) {
  const [open, setOpen] = useState(defaultOpen)
  const [name, setName] = useState(initialName)
  const [pinned, setPinned] = useState(initialPinned)
  const id = useId()
  return <section className={css.stage} aria-label="Page details panel preview">
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" />}><PanelRight data-icon="inline-start" />Page details</SheetTrigger>
      <SheetContent>
        <SheetHeader><SheetTitle>Page details</SheetTitle><SheetDescription>{empty ? 'Select a page to view its details.' : 'Manage this page in your notebook.'}</SheetDescription></SheetHeader>
        {empty ? <Empty><EmptyHeader><EmptyMedia variant="icon"><Info /></EmptyMedia><EmptyTitle>No page selected</EmptyTitle><EmptyDescription>Choose a page from the notebook sidebar.</EmptyDescription></EmptyHeader></Empty> : <div className="flex flex-col gap-5 px-4">
          <FieldGroup><Field><FieldLabel htmlFor={id}>Name</FieldLabel><Input id={id} value={name} onChange={event => setName(event.target.value)} /></Field><Field orientation="horizontal"><FieldLabel htmlFor={`${id}-pin`}>Pin to notebook</FieldLabel><Switch id={`${id}-pin`} checked={pinned} onCheckedChange={setPinned} /></Field></FieldGroup>
          <Separator />
          <dl className={css.metadata}><dt>Type</dt><dd>Canvas</dd><dt>Notebook</dt><dd>Hyperbase</dd><dt>Last edited</dt><dd>Just now</dd></dl>
        </div>}
        <SheetFooter><Button disabled={empty || !name.trim()} onClick={() => { onSave?.({ name: name.trim(), pinned }); setOpen(false) }}>Save changes</Button><SheetClose render={<Button variant="outline" />}>Close</SheetClose></SheetFooter>
      </SheetContent>
    </Sheet>
  </section>
}
