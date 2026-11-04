import { Home, PanelLeft, PanelRight, Search, FolderOpen, Folder, FileText, Settings, Plus } from 'lucide-react'
import { Button } from '../../../../../hypercanvas/packages/storyboard/src/internals/chrome/ui/button.jsx'
import {
  NotebookShellFrame,
  NotebookShellSidebar,
  NotebookShellHeader,
  NotebookShellSearch,
  NotebookShellNavigation,
  NotebookShellFooter,
  NotebookShellTopbar,
  NotebookShellRow,
  NotebookShellIconButton,
} from '../../../../../hypercanvas/packages/storyboard/src/internals/NotebookShellPresentation/NotebookShellPresentation.jsx'

function NotebookContents({ width = '100%', height = 640, narrow = false, open = true, selected = 'welcome' }) {
  return <NotebookShellFrame style={{ width, height, minHeight: height, position: 'relative' }} data-layout={narrow ? 'narrow' : 'desktop'}>
    {open && <NotebookShellSidebar aria-label="Notebook sidebar" data-hc-surface="toolbar" style={narrow ? { position: 'absolute', inset: '40px auto 0 0', width: 'min(272px, 86vw)', zIndex: 20 } : undefined}>
      <NotebookShellHeader>
        <Home aria-hidden="true" />
        <span className="hc-min-w-0 hc-flex-1 hc-truncate hc-font-medium">Hypercanvas Demo</span>
        <NotebookShellIconButton aria-label="Collapse sidebar"><PanelLeft aria-hidden="true" /></NotebookShellIconButton>
      </NotebookShellHeader>
      <NotebookShellSearch aria-label="Filter pages" placeholder="Filter pages" />
      <NotebookShellNavigation aria-label="Primary pages">
        <NotebookShellRow icon={Home} selected={selected === 'home'} aria-current={selected === 'home' ? 'page' : undefined}>Home</NotebookShellRow>
        <ul>
          <li>
            <NotebookShellRow leading={<FolderOpen aria-hidden="true" />} aria-expanded="true">Design</NotebookShellRow>
            <ul>
              <li><NotebookShellRow depth={1} icon={FileText}>Foundations</NotebookShellRow></li>
              <li><NotebookShellRow depth={1} icon={FileText} selected={selected === 'welcome'} aria-current={selected === 'welcome' ? 'page' : undefined}>Welcome Canvas</NotebookShellRow></li>
              <li><NotebookShellRow depth={1} icon={FileText}>Patterns Canvas</NotebookShellRow></li>
            </ul>
          </li>
          <li><NotebookShellRow leading={<Folder aria-hidden="true" />} aria-expanded="false">Research</NotebookShellRow></li>
        </ul>
      </NotebookShellNavigation>
      <NotebookShellFooter className="hc-flex-col hc-items-stretch hc-gap-1.5">
        <Button size="sm" className="hc-w-full"><Plus data-icon="inline-start" />New page</Button>
        <Button variant="ghost" className="hc-w-full hc-justify-start"><Settings aria-hidden="true" />Settings</Button>
      </NotebookShellFooter>
    </NotebookShellSidebar>}
    <main style={{ display: 'flex', minWidth: 0, flex: 1, flexDirection: 'column' }}>
      <NotebookShellTopbar>
        {!open && <NotebookShellIconButton aria-label="Open notebook sidebar"><PanelRight aria-hidden="true" /></NotebookShellIconButton>}
        <span className="hc-min-w-0 hc-flex-1 hc-truncate">Design / Welcome Canvas</span>
        <NotebookShellIconButton aria-label="Search"><Search aria-hidden="true" /></NotebookShellIconButton>
      </NotebookShellTopbar>
      <section style={{ minWidth: 0, flex: 1, overflow: 'auto', padding: 24 }}>
        <h1 style={{ margin: 0, font: '500 20px/1.4 var(--hc-font-sans)' }}>Welcome Canvas</h1>
        <p style={{ color: 'var(--hc-color-foreground-muted)' }}>The content surface keeps its own background when the sidebar is hidden.</p>
      </section>
    </main>
  </NotebookShellFrame>
}

const meta = { title: 'Notebook/Sidebar', parameters: { layout: 'fullscreen' } }
export default meta

export const Expanded = { render: () => <NotebookContents /> }
export const SelectedNestedRows = { render: () => <NotebookContents selected="welcome" /> }
export const CollapsedNoSidebar = { render: () => <NotebookContents open={false} /> }
export const NarrowDrawer = { render: () => <NotebookContents width={390} height={844} narrow /> , parameters: { viewport: { defaultViewport: 'notebookNarrow' } } }
