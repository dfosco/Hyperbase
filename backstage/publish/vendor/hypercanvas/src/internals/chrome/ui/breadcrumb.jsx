import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cn } from "../utils.js"
import { ChevronRightIcon, MoreHorizontalIcon } from "lucide-react"

function Breadcrumb({
  className,
  ...props
}) {
  return (
    <nav
      aria-label="breadcrumb"
      data-hc-ui="" data-slot="breadcrumb"
      className={cn(className)}
      {...props}
    />
  )
}

function BreadcrumbList({
  className,
  ...props
}) {
  return (
    <ol
      data-hc-ui="" data-slot="breadcrumb-list"
      className={cn(
        "hc-flex hc-flex-wrap hc-items-center hc-gap-1.5 hc-text-sm hc-wrap-break-word hc-text-muted-foreground hc-pl-0",
        className
      )}
      {...props}
    />
  )
}

function BreadcrumbItem({
  className,
  ...props
}) {
  return (
    <li
      data-hc-ui="" data-slot="breadcrumb-item"
      className={cn("hc-inline-flex hc-items-center hc-gap-1", className)}
      {...props}
    />
  )
}

function BreadcrumbLink({
  className,
  render,
  ...props
}) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps({
      className: cn("hc-transition-colors hc-hover:text-foreground", className),
    }, props),
    render,
    state: {
      slot: "breadcrumb-link",
    },
  });
}

function BreadcrumbPage({
  className,
  ...props
}) {
  return (
    <span
      data-hc-ui="" data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("hc-font-normal hc-text-foreground", className)}
      {...props}
    />
  )
}

function BreadcrumbSeparator({
  children,
  className,
  ...props
}) {
  return (
    <li
      data-hc-ui="" data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("hc-[&>svg]:size-3.5", className)}
      {...props}
    >
      {children ?? (
        <ChevronRightIcon />
      )}
    </li>
  )
}

function BreadcrumbEllipsis({
  className,
  ...props
}) {
  return (
    <span
      data-hc-ui="" data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn(
        "hc-flex hc-size-5 hc-items-center hc-justify-center hc-[&>svg]:size-4",
        className
      )}
      {...props}
    >
      <MoreHorizontalIcon
      />
      <span className="hc-sr-only">More</span>
    </span>
  )
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}
