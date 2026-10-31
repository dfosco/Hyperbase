/**
 * CanvasZoomControl — zoom in/out/reset bar for canvas pages.
 */
import * as Tooltip from '../lib/components/ui/tooltip/index.js'

export default function CanvasZoomControl({ config = {}, data, zoom = 100, tabindex = -1 }) {
  if (!data) return null

  return (
    <div className="hc-flex hc-items-center hc-overflow-hidden hc-rounded-[10px] hc-border-[2.5px] hc-border-border hc-bg-background hc-text-foreground" role="group" aria-label={config.ariaLabel || 'Zoom controls'}>
      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            className="hc-flex hc-size-[38px] hc-cursor-pointer hc-items-center hc-justify-center hc-text-base hc-font-semibold hc-text-foreground hc-transition-colors hc-hover:bg-accent hc-disabled:cursor-default hc-disabled:opacity-30"
            onClick={() => data.zoomOut(zoom)}
            disabled={zoom <= data.ZOOM_MIN}
            aria-label="Decrease zoom"
            tabIndex={tabindex}
          >−</button>
        </Tooltip.Trigger>
        <Tooltip.Content side="top">Decrease zoom</Tooltip.Content>
      </Tooltip.Root>
      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            className="hc-flex hc-h-[38px] hc-min-w-12 hc-cursor-pointer hc-items-center hc-justify-center hc-border-x-2 hc-border-border hc-px-1 hc-text-[13px] hc-font-semibold hc-tabular-nums hc-text-foreground hc-transition-colors hc-hover:bg-accent"
            onClick={() => data.zoomReset()}
            aria-label="Zoom to 100%"
            tabIndex={-1}
          >{zoom}%</button>
        </Tooltip.Trigger>
        <Tooltip.Content side="top">Zoom to 100%</Tooltip.Content>
      </Tooltip.Root>
      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            className="hc-flex hc-size-[38px] hc-cursor-pointer hc-items-center hc-justify-center hc-text-base hc-font-semibold hc-text-foreground hc-transition-colors hc-hover:bg-accent hc-disabled:cursor-default hc-disabled:opacity-30"
            onClick={() => data.zoomIn(zoom)}
            disabled={zoom >= data.ZOOM_MAX}
            aria-label="Increase zoom"
            tabIndex={-1}
          >+</button>
        </Tooltip.Trigger>
        <Tooltip.Content side="top">Increase zoom</Tooltip.Content>
      </Tooltip.Root>
    </div>
  )
}
