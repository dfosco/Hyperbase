import { NotebookShellSidebar, NotebookShellSidebarResizeHandle } from '../../../../../../hypercanvas/packages/storyboard/src/internals/NotebookShellPresentation/NotebookShellPresentation.jsx'
import { useNotebookSidebarResize } from '../../../../../../hypercanvas/packages/storyboard/src/internals/NotebookShell/useNotebookSidebarResize.js'

export default {
  title: 'Notebook shell/Resizable sidebar',
}

const pages = ['Home', 'Hyper Agent notes', 'Publishing', 'Prototypes', 'Components', 'A very long page name that truncates inside a narrow sidebar']

// The same resize hook and handle the Notebook shell uses. The stub canvas sits to the right so a drag can leave the
// handle. The hook runs without writing to the document or storage, so stories never change the real sidebar width.
function ResizableSidebar({ initialWidth }) {
  const sidebar = useNotebookSidebarResize({ initialWidth, publish: false, persist: false })
  return (
    <section style={{ '--sb--notebook-sidebar-width': `${sidebar.width}px`, position: 'relative', display: 'flex', height: 360, width: 760, border: '1px solid var(--hc-color-border)', background: 'var(--hc-color-background)', color: 'var(--hc-color-foreground)' }}>
      <div style={{ position: 'relative', display: 'flex', height: '100%', flex: '0 0 var(--sb--notebook-sidebar-width)' }}>
        {/* While dragging, the width follows the pointer without easing, as the shell's .sidebarResizing does. */}
        <NotebookShellSidebar aria-label="Notebook pages" style={{ height: '100%', transition: sidebar.dragging ? 'none' : undefined }}>
          <div style={{ padding: 8, fontSize: 12 }}>
            {pages.map(name => <div key={name} style={{ padding: '6px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>)}
          </div>
        </NotebookShellSidebar>
        <NotebookShellSidebarResizeHandle dragging={sidebar.dragging} {...sidebar.handleProps} />
      </div>
      <div data-canvas-stub="" style={{ flex: 1, minWidth: 0, padding: 12, fontSize: 12, color: 'var(--hc-color-muted-foreground)' }}>
        Canvas stub: a drag keeps the resize cursor here too.
      </div>
    </section>
  )
}

export const MinimumWidth = { render: () => <ResizableSidebar initialWidth={200} /> }
export const DefaultWidth = { render: () => <ResizableSidebar initialWidth={248} /> }
export const MaximumWidth = { render: () => <ResizableSidebar initialWidth={420} /> }
