import { useState } from 'react'
import { Menu } from '@base-ui/react/menu'
import { MousePointer2 as Cursor, Hand, Minus, Plus, ZoomIn, ZoomOut, Check } from 'lucide-react'
import {
  CanvasToolsSurface,
  CanvasToolsGroup,
  CanvasToolButton,
  CanvasToolValue,
  CanvasToolsPopup,
  CanvasToolMenuItem,
  CanvasToolMenuLabel,
} from '../../../../../../hypercanvas/packages/storyboard/src/internals/CanvasToolsPresentation/CanvasToolsPresentation.jsx'

function ToolStrip({ appearance = 'light', selected = 'pointer', zoom = '100%', openInitially = false }) {
  const [open, setOpen] = useState(openInitially)
  return <CanvasToolsSurface appearance={appearance} aria-label="Canvas tools">
    <CanvasToolsGroup aria-label="Selection tools">
      <CanvasToolButton aria-label="Pointer" aria-pressed={selected === 'pointer'}><Cursor /></CanvasToolButton>
      <CanvasToolButton aria-label="Pan" aria-pressed={selected === 'pan'}><Hand /></CanvasToolButton>
    </CanvasToolsGroup>
    <CanvasToolsGroup aria-label="Zoom controls">
      <CanvasToolButton aria-label="Zoom out"><ZoomOut /></CanvasToolButton>
      <CanvasToolValue aria-label={`Zoom ${zoom}`}>{zoom}</CanvasToolValue>
      <CanvasToolButton aria-label="Zoom in"><ZoomIn /></CanvasToolButton>
      <CanvasToolButton aria-label="Zoom to fit"><Plus /></CanvasToolButton>
    </CanvasToolsGroup>
    <CanvasToolsGroup aria-label="Additional tools">
      <Menu.Root open={open} onOpenChange={setOpen}>
        <Menu.Trigger render={<CanvasToolButton aria-label="More canvas tools" aria-pressed={open}><Plus /></CanvasToolButton>} />
        <Menu.Portal>
          <Menu.Positioner sideOffset={6}>
            <CanvasToolsPopup as={Menu.Popup} appearance={appearance}>
              <Menu.Group>
                <CanvasToolMenuLabel as={Menu.GroupLabel}>Canvas actions</CanvasToolMenuLabel>
                <CanvasToolMenuItem><Check aria-hidden="true" />Auto place</CanvasToolMenuItem>
                <CanvasToolMenuItem><Plus aria-hidden="true" />Add widget</CanvasToolMenuItem>
                <CanvasToolMenuItem><Minus aria-hidden="true" />Remove selection</CanvasToolMenuItem>
              </Menu.Group>
            </CanvasToolsPopup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </CanvasToolsGroup>
  </CanvasToolsSurface>
}

const meta = { title: 'Canvas/Tools', parameters: { layout: 'centered' } }
export default meta

export const DefaultAndSelected = { render: () => <ToolStrip /> }
export const SelectedPanAndZoom = { render: () => <ToolStrip selected="pan" zoom="67%" /> }
export const OpenMenu = { render: () => <ToolStrip openInitially /> }
export const DocsToolbarComposition = {
  render: () => <CanvasToolsSurface aria-label="Docs toolbar">
    <CanvasToolsGroup aria-label="Document editing">
      <CanvasToolButton aria-label="Text block" aria-pressed="true"><Cursor /></CanvasToolButton>
      <CanvasToolButton aria-label="Add block"><Plus /></CanvasToolButton>
      <CanvasToolButton aria-label="Zoom out"><ZoomOut /></CanvasToolButton>
      <CanvasToolValue>100%</CanvasToolValue>
      <CanvasToolButton aria-label="Zoom in"><ZoomIn /></CanvasToolButton>
    </CanvasToolsGroup>
  </CanvasToolsSurface>,
}
