import { useState } from 'react'
import { Command } from 'cmdk'
import { ArrowRight, FileText, Settings, Sparkles } from 'lucide-react'
import { Button } from '../../../../../../hypercanvas/packages/storyboard/src/internals/chrome/ui/button.jsx'
import {
  StudioPaletteDialog,
  StudioPaletteSearch,
  StudioPaletteRow,
} from '../../../../../../hypercanvas/packages/storyboard/src/internals/CommandPalettePresentation/CommandPalettePresentation.jsx'
import { studioPaletteParts } from '../../../../../../hypercanvas/packages/storyboard/src/internals/CommandPalettePresentation/paletteParts.js'

function Palette({ openInitially = true, empty = false, width = 560, nestedInitially = false, queryInitially = '' }) {
  const [open, setOpen] = useState(openInitially)
  const [nested, setNested] = useState(nestedInitially)
  const [query, setQuery] = useState(queryInitially)
  return <>
    {!open && <Button variant="outline" onClick={() => setOpen(true)}>Open command palette</Button>}
    <StudioPaletteDialog open={open} onOpenChange={setOpen} width={width}>
      <Command loop shouldFilter={!nested} onKeyDown={event => {
        if (event.key === 'Escape' && nested) {
          event.preventDefault()
          event.stopPropagation()
          setNested(false)
        }
      }}>
        <StudioPaletteSearch count={empty ? 0 : 3}>
          <Command.Input className={studioPaletteParts.input} value={query} onValueChange={setQuery} placeholder="Search commands and artifacts…" aria-label="Search commands and artifacts" />
        </StudioPaletteSearch>
        <Command.List className={studioPaletteParts.list}>
          <Command.Empty className={studioPaletteParts.empty}>No matching commands.</Command.Empty>
          {!empty && (nested ? <>
            <Command.Group heading="Navigation" className="hc-px-2">
              <Command.Item value="back to commands" className={studioPaletteParts.row} onSelect={() => setNested(false)}><StudioPaletteRow icon={<ArrowRight className="hc-rotate-180" />} label="Back to commands" /></Command.Item>
            </Command.Group>
            <Command.Group heading="Switch theme" className="hc-px-2">
              <Command.Item value="dark" className={studioPaletteParts.row}><StudioPaletteRow icon={<Settings />} label="Dark" /></Command.Item>
              <Command.Item value="light" className={studioPaletteParts.row}><StudioPaletteRow icon={<Settings />} label="Light" /></Command.Item>
            </Command.Group>
          </> : <Command.Group heading="Actions" className="hc-px-2">
            <Command.Item value="open canvas" className={studioPaletteParts.row}><StudioPaletteRow icon={<FileText />} label="Open Welcome Canvas" description="Design / Welcome Canvas" hint="↵" /></Command.Item>
            <Command.Item value="settings" className={studioPaletteParts.row}><StudioPaletteRow icon={<Settings />} label="Open settings" description="Notebook preferences" hint="⌘ ," /></Command.Item>
            <Command.Item value="agent" className={studioPaletteParts.row}><StudioPaletteRow icon={<Sparkles />} label="Open Hyper Agent" description="Ask for a change" hint="⌘ K" /></Command.Item>
            <Command.Item value="switch theme" className={studioPaletteParts.row} onSelect={() => setNested(true)}><StudioPaletteRow icon={<ArrowRight />} label="Switch theme" description="Choose a theme" hint="↵" /></Command.Item>
          </Command.Group>)}
        </Command.List>
      </Command>
    </StudioPaletteDialog>
  </>
}

const meta = { title: 'Studio/Command Palette', parameters: { viewport: { defaultViewport: 'notebookDesktop' } } }
export default meta

export const Results = { render: () => <Palette /> }
export const Empty = { render: () => <Palette empty /> }
export const Trigger = { render: () => <Palette openInitially={false} /> }
export const Narrow = { render: () => <Palette width={560} />, parameters: { viewport: { defaultViewport: 'notebookNarrow' } } }
export const Nested = { render: () => <Palette nestedInitially /> }
export const SearchResults = { render: () => <Palette queryInitially="theme" /> }
