import { useState } from 'react'
import { Tabs } from '@base-ui/react/tabs'
import { ShellTabs } from '../../../../../../hypercanvas/packages/storyboard/src/core/ui/ShellTabs/ShellTabs.jsx'
import { Button } from '../../../../../../hypercanvas/packages/storyboard/src/core/lib/components/ui/button/index.js'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../../../../../hypercanvas/packages/storyboard/src/core/lib/components/ui/dropdown-menu/index.js'
import { NotebookShellHeader, NotebookShellPanelHeader, NotebookShellTopbar, notebookShellButtonGroup, notebookShellHeaderGeometry } from '../../../../../../hypercanvas/packages/storyboard/src/internals/NotebookShellPresentation/NotebookShellPresentation.jsx'
import PlusIcon from '../../../../../../hypercanvas/packages/storyboard/src/internals/lucide/icons/plus.js'
import XIcon from '../../../../../../hypercanvas/packages/storyboard/src/internals/lucide/icons/x.js'
import SettingsIcon from '../../../../../../hypercanvas/packages/storyboard/src/internals/lucide/icons/settings.js'

const agentTabs = [
  { id: 'agent-1', label: 'Codex', renameable: true },
  { id: 'agent-2', label: 'A very long agent session name that should truncate cleanly', renameable: true },
]
const publishingTabs = [
  { id: 'github-pages', label: 'GitHub', closable: false },
  { id: 'cloudflare-pages', label: 'Cloudflare Pages destination', closable: false },
  { id: 'netlify', label: 'Netlify', closable: false },
]

function InteractiveTabs({ appearance = 'light', width = '100%', closeable = true, domain = 'agent' }) {
  const source = domain === 'publish' ? publishingTabs : agentTabs
  const [items, setItems] = useState(source)
  const [value, setValue] = useState(source[0].id)
  const add = id => {
    const item = domain === 'publish'
      ? { id, label: id === 'cloudflare-pages' ? 'Cloudflare Pages' : 'New destination', closable: false }
      : { id, label: 'New agent', renameable: true }
    setItems(current => current.some(existing => existing.id === id) ? current : [...current, item])
    setValue(id)
  }
  const rename = async (id, label) => setItems(current => current.map(item => item.id === id ? { ...item, label } : item))
  const close = id => {
    const remaining = items.filter(item => item.id !== id)
    setItems(remaining)
    if (value === id) setValue(remaining[0]?.id)
  }
  return (
    <section data-hc-theme={appearance} data-sb-surface="toolbar" style={{ width, minWidth: 0, color: 'var(--hc-color-foreground)', background: 'var(--hc-color-background)', colorScheme: appearance, padding: 12 }}>
      <ShellTabs
        value={value}
        onValueChange={setValue}
        items={items.map(item => ({ ...item, closable: domain === 'agent' && closeable && item.closable !== false }))}
        ariaLabel={domain === 'publish' ? 'Publishing providers' : 'Agent sessions'}
        onClose={domain === 'agent' && closeable ? close : undefined}
        onRename={domain === 'agent' ? rename : undefined}
        addLabel={domain === 'publish' ? 'Add publishing provider' : 'New session'}
        addMenuItems={domain === 'publish'
          ? [{ id: 'cloudflare-pages', label: 'Cloudflare Pages', onSelect: () => add('cloudflare-pages') }]
          : [{ id: 'agent-new', label: 'New session', onSelect: () => add('agent-new') }]}
      >
        {items.map(item => <Tabs.Panel key={item.id} value={item.id} className="hc-min-h-24 hc-p-4 hc-text-sm">{item.label} content stays owned by the consumer.</Tabs.Panel>)}
      </ShellTabs>
    </section>
  )
}

function PanelHeaderSpecimen({ appearance = 'light', domain = 'agent', variant = 'titlebar-free', width = 460, initialItems, directAdd = false }) {
  const isAgent = domain === 'agent'
  const heading = isAgent ? 'Hyper Agent' : 'Publish'
  const source = initialItems || (isAgent ? agentTabs : publishingTabs)
  const [value, setValue] = useState(source[0]?.id)
  const [items, setItems] = useState(source)
  const add = id => {
    const item = isAgent ? { id, label: 'New session', renameable: true } : { id, label: 'Cloudflare Pages', closable: false }
    setItems(current => current.some(existing => existing.id === id) ? current : [...current, item])
    setValue(id)
  }
  const rename = async (id, label) => setItems(current => current.map(item => item.id === id ? { ...item, label } : item))
  const close = id => {
    const remaining = items.filter(item => item.id !== id)
    setItems(remaining)
    if (value === id) setValue(remaining[0]?.id)
  }
  const tabs = <ShellTabs
    variant={variant}
    heading={variant === 'titlebar-free' ? heading : undefined}
    value={value}
    onValueChange={setValue}
    items={items.map(item => ({ ...item, closable: isAgent && item.closable !== false }))}
    ariaLabel={isAgent ? 'Agent sessions' : 'Publishing providers'}
    onClose={isAgent ? close : undefined}
    onRename={isAgent ? rename : undefined}
    beforeAddActions={variant === 'titlebar-free' && <Button variant="ghost" size="icon-sm" aria-label="Panel settings"><SettingsIcon size={14} aria-hidden="true" /></Button>}
    afterAddActions={variant === 'titlebar-free' && <Button variant="ghost" size="icon-sm" aria-label="Close panel"><XIcon size={14} aria-hidden="true" /></Button>}
    addLabel={isAgent ? 'New session' : 'Add publishing provider'}
    onAdd={directAdd ? () => add(isAgent ? 'agent-new' : 'cloudflare-pages') : undefined}
    addMenuItems={directAdd ? [] : isAgent
      ? [{ id: 'agent-new', label: 'New session', onSelect: () => add('agent-new') }]
      : [{ id: 'cloudflare-pages', label: 'Cloudflare Pages', onSelect: () => add('cloudflare-pages') }]}
  >
    {items.map(item => <Tabs.Panel key={item.id} value={item.id} className="hc-min-h-20 hc-p-3 hc-text-sm">{heading} content stays mounted for {item.label}.</Tabs.Panel>)}
  </ShellTabs>

  return (
    <section data-hc-theme={appearance} data-sb-surface="toolbar" style={{ width, minWidth: 0, color: 'var(--hc-color-foreground)', background: 'var(--hc-color-background)', colorScheme: appearance, border: '1px solid var(--hc-color-border)' }}>
      {variant === 'titled' && <NotebookShellPanelHeader className={`${notebookShellHeaderGeometry} hc-justify-between hc-bg-[var(--hc-color-shell-header)] hc-px-3 hc-border-b hc-border-border`}>
        <h2 className="hc-min-w-0 hc-flex-1 hc-truncate hc-m-0 hc-font-sans hc-text-sm hc-font-semibold hc-leading-5">{heading}</h2>
        {isAgent && <Button variant="ghost" size="icon-sm" aria-label="Panel settings"><SettingsIcon size={14} aria-hidden="true" /></Button>}
        <Button variant="ghost" size="icon-sm" aria-label="Close panel"><XIcon size={14} aria-hidden="true" /></Button>
      </NotebookShellPanelHeader>}
      {tabs}
    </section>
  )
}

const meta = { title: 'Notebook/Shared Shell Tabs', parameters: { layout: 'padded' } }
export default meta

export const LightAndDark = { render: () => <div style={{ display: 'grid', gap: 20 }}><InteractiveTabs appearance="light" /><InteractiveTabs appearance="dark" /></div> }
export const NarrowOverflowAndLongLabels = { render: () => <InteractiveTabs width={320} appearance="light" />, parameters: { viewport: { defaultViewport: 'notebookNarrow' } } }
export const WithoutCloseOverlay = { render: () => <InteractiveTabs closeable={false} appearance="dark" /> }
export const SplitButtonGroupStates = {
  render: () => <div style={{ display: 'grid', gap: 20 }}>
    <section data-hc-theme="light" data-sb-surface="toolbar" style={{ display: 'grid', gap: 12, width: 'max-content', color: 'var(--hc-color-foreground)', background: 'var(--hc-color-background)', colorScheme: 'light', padding: 12 }}>
      <div data-slot="button-group" role="group" aria-label="Open in browser controls" className={notebookShellButtonGroup}>
        <Button variant="outline" size="sm">Open in browser</Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" aria-label="Browser viewing options"><span aria-hidden="true">⌄</span></Button>} />
          <DropdownMenuContent align="end" aria-label="Browser viewing options"><DropdownMenuItem>Notebook UI</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div data-slot="button-group" role="group" aria-label="Open notebook links" className={notebookShellButtonGroup}>
        <Button variant="outline" size="sm" href="#notebook-home">Notebook home</Button>
        <Button variant="outline" size="sm" href="#published-site">Published site</Button>
      </div>
    </section>
    <section data-hc-theme="dark" data-sb-surface="toolbar" style={{ display: 'grid', gap: 12, width: 'max-content', color: 'var(--hc-color-foreground)', background: 'var(--hc-color-background)', colorScheme: 'dark', padding: 12 }}>
      <div data-slot="button-group" role="group" aria-label="Disabled browser controls" className={notebookShellButtonGroup}>
        <Button variant="outline" size="sm" disabled>Open in browser</Button>
        <Button variant="outline" size="icon-sm" disabled aria-label="Browser viewing options"><span aria-hidden="true">⌄</span></Button>
      </div>
      <div data-slot="button-group" role="group" aria-label="RTL browser controls" dir="rtl" className={notebookShellButtonGroup}>
        <Button variant="outline" size="sm">Open in browser</Button>
        <Button variant="outline" size="icon-sm" aria-label="Browser viewing options"><span aria-hidden="true">⌄</span></Button>
      </div>
    </section>
  </div>,
}
export const TitledHeaderAlternative = { render: () => <div style={{ display: 'grid', gap: 20 }}><PanelHeaderSpecimen domain="agent" variant="titled" /><PanelHeaderSpecimen domain="publish" variant="titled" /></div> }
export const TitlebarFreeLightAndDark = { render: () => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20 }}><PanelHeaderSpecimen domain="agent" appearance="light" /><PanelHeaderSpecimen domain="publish" appearance="light" /><PanelHeaderSpecimen domain="agent" appearance="dark" /><PanelHeaderSpecimen domain="publish" appearance="dark" /></div> }
export const TitlebarFreeNarrow = { render: () => <div style={{ display: 'grid', width: 320, gap: 16 }}><PanelHeaderSpecimen domain="agent" width="100%" /><PanelHeaderSpecimen domain="publish" width="100%" /><PanelHeaderSpecimen domain="agent" appearance="dark" width="100%" /><PanelHeaderSpecimen domain="publish" appearance="dark" width="100%" /></div>, parameters: { viewport: { defaultViewport: 'notebookNarrow' } } }
export const TitlebarFreeNarrowDirectAdd = { render: () => <div style={{ display: 'grid', gap: 16 }}><PanelHeaderSpecimen width={300} directAdd /><PanelHeaderSpecimen width={300} appearance="dark" directAdd /></div> }
export const EmptyPublishTitlebar = { render: () => <PanelHeaderSpecimen domain="publish" width={300} initialItems={[]} directAdd /> }
export const TitlebarFreeWide = { render: () => <PanelHeaderSpecimen width={640} /> }
export const RenameableAgentTabs = { render: () => <PanelHeaderSpecimen domain="agent" width={520} /> }
export const HeaderAlignmentSpecimen = {
  render: () => <div data-hc-theme="light" style={{ display: 'grid', gridTemplateColumns: '248px minmax(260px, 1fr) minmax(320px, 420px)', width: '100%', color: 'var(--hc-color-foreground)', background: 'var(--hc-color-background)', border: '1px solid var(--hc-color-border)' }}>
    <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '248px minmax(260px, 1fr) minmax(320px, 420px)', borderBottom: '1px solid var(--hc-color-border)' }}>
      <NotebookShellHeader><span className="hc-min-w-0 hc-truncate hc-font-sans hc-text-sm hc-font-semibold hc-leading-5">Project notebook name that truncates</span></NotebookShellHeader>
      <NotebookShellTopbar><span className="hc-min-w-0 hc-flex-1 hc-truncate">Artifact navigation</span><Button variant="ghost" size="icon-sm" aria-label="Open sidebar"><PlusIcon size={14} /></Button></NotebookShellTopbar>
      <NotebookShellPanelHeader className={`${notebookShellHeaderGeometry} hc-justify-between hc-bg-[var(--hc-color-shell-header)] hc-px-3 hc-border-b hc-border-border`}><span className="hc-min-w-0 hc-flex-1 hc-truncate hc-font-sans hc-text-sm hc-font-semibold hc-leading-5">Hyper Agent</span><Button variant="ghost" size="icon-sm" aria-label="Panel settings"><SettingsIcon size={14} /></Button><Button variant="ghost" size="icon-sm" aria-label="Close panel"><XIcon size={14} /></Button></NotebookShellPanelHeader>
    </div>
    <div style={{ gridColumn: '2 / -1', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
      <div style={{ borderRight: '1px solid var(--hc-color-border)' }}><PanelHeaderSpecimen domain="agent" width="100%" /></div>
      <PanelHeaderSpecimen domain="publish" width="100%" />
    </div>
  </div>,
}
