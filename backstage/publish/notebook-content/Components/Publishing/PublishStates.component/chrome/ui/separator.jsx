import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"
import { cn } from "../utils.js"

function Separator({
  className,
  orientation = "horizontal",
  ...props
}) {
  return (
    <SeparatorPrimitive
      data-hc-ui="" data-slot="separator"
      orientation={orientation}
      className={cn(
        "hc-shrink-0 hc-bg-border hc-data-horizontal:h-px hc-data-horizontal:w-full hc-data-vertical:w-px hc-data-vertical:self-stretch",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
