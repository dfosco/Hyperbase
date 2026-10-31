import { useId, useState } from 'react'
import { Button } from '../ui/button.jsx'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../ui/dialog.jsx'
import { FieldGroup, Field, FieldLabel, FieldDescription } from '../ui/field.jsx'
import { Input } from '../ui/input.jsx'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs.jsx'
import css from './ChromeDialogs.module.css'

export function ChromeDialogs({ defaultOpen = true, initialTitle = 'Untitled canvas', onCreate }) {
  const [open, setOpen] = useState(defaultOpen)
  const [title, setTitle] = useState(initialTitle)
  const [kind, setKind] = useState('canvas')
  const [created, setCreated] = useState('')
  const id = useId()
  return <section className={css.stage} aria-label="Create page dialog preview">
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>New page</DialogTrigger>
      <DialogContent>
        <form onSubmit={event => { event.preventDefault(); const name = title.trim(); if (!name) return; onCreate?.({ title: name, type: kind }); setCreated(name); setOpen(false) }} className="flex flex-col gap-5">
          <DialogHeader><DialogTitle>Create a page</DialogTitle><DialogDescription>Add a canvas, prototype, or connected site to Hyperbase.</DialogDescription></DialogHeader>
          <Tabs value={kind} onValueChange={setKind}><TabsList className="w-full"><TabsTrigger value="canvas">Canvas</TabsTrigger><TabsTrigger value="prototype">Prototype</TabsTrigger><TabsTrigger value="site">Site</TabsTrigger></TabsList></Tabs>
          <FieldGroup><Field><FieldLabel htmlFor={id}>Page name</FieldLabel><Input id={id} value={title} onChange={event => setTitle(event.target.value)} placeholder="Name your page" autoFocus /><FieldDescription>You can rename it later.</FieldDescription></Field></FieldGroup>
          <DialogFooter><DialogClose render={<Button variant="outline" />}>Cancel</DialogClose><Button type="submit" disabled={!title.trim()}>Create {kind}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {created && <p role="status">Created “{created}”</p>}
  </section>
}
