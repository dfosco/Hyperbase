import { cn } from "../utils.js"

function Skeleton({
  className,
  ...props
}) {
  return (
    <div
      data-hc-ui="" data-slot="skeleton"
      className={cn("hc-animate-pulse hc-rounded-md hc-bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
