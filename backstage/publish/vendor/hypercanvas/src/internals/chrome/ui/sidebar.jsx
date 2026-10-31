"use client";
import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva } from "class-variance-authority";
import { cn } from "../utils.js"

import { useIsMobile } from "../use-mobile.js"
import { Button } from "./button.jsx"
import { Input } from "./input.jsx"
import { Separator } from "./separator.jsx"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./sheet.jsx"
import { Skeleton } from "./skeleton.jsx"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./tooltip.jsx"
import { PanelLeftIcon } from "lucide-react"

const SIDEBAR_COOKIE_NAME = "sidebar_state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_MOBILE = "18rem"
const SIDEBAR_WIDTH_ICON = "3rem"
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

const SidebarContext = React.createContext(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}) {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = React.useState(false)

  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open
  const setOpen = React.useCallback(
    (value) => {
      const openState = typeof value === "function" ? value(open) : value
      if (setOpenProp) {
        setOpenProp(openState)
      } else {
        _setOpen(openState)
      }

      // This sets the cookie to keep the sidebar state.
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
    },
    [setOpenProp, open]
  )

  // Helper to toggle the sidebar.
  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open)
  }, [isMobile, setOpen, setOpenMobile])

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggleSidebar])

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? "expanded" : "collapsed"

  const contextValue = React.useMemo(() => ({
    state,
    open,
    setOpen,
    isMobile,
    openMobile,
    setOpenMobile,
    toggleSidebar,
  }), [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar])

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-hc-ui="" data-hc-surface="toolbar" data-slot="sidebar-wrapper"
        style={
          {
            "--hc-sidebar-width": SIDEBAR_WIDTH,
            "--hc-sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            ...style
          }
        }
        className={cn(
          "hc-group/sidebar-wrapper hc-flex hc-min-h-svh hc-w-full hc-has-data-[variant=inset]:bg-background",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  dir,
  ...props
}) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

  if (collapsible === "none") {
    return (
      <div
        data-hc-ui="" data-slot="sidebar"
        className={cn(
          "hc-flex hc-h-full hc-w-(--hc-sidebar-width) hc-flex-col hc-bg-background hc-text-foreground",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          dir={dir}
          data-sidebar="sidebar"
          data-hc-ui="" data-slot="sidebar"
          data-mobile="true"
          className="hc-w-(--hc-sidebar-width) hc-bg-background hc-p-0 hc-text-foreground hc-[&>button]:hidden"
          style={
            {
              "--hc-sidebar-width": SIDEBAR_WIDTH_MOBILE
            }
          }
          side={side}
        >
          <SheetHeader className="hc-sr-only">
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeader>
          <div className="hc-flex hc-h-full hc-w-full hc-flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className="hc-group hc-peer hc-hidden hc-text-foreground hc-md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
      data-hc-ui="" data-slot="sidebar"
    >
      {/* This is what handles the sidebar gap on desktop */}
      <div
        data-hc-ui="" data-slot="sidebar-gap"
        className={cn(
          "hc-relative hc-w-(--hc-sidebar-width) hc-bg-transparent hc-transition-[width] hc-duration-200 hc-ease-linear",
          "hc-group-data-[collapsible=offcanvas]:w-0",
          "hc-group-data-[side=right]:rotate-180",
          variant === "floating" || variant === "inset"
            ? "hc-group-data-[collapsible=icon]:w-[calc(var(--hc-sidebar-width-icon)+(--hc-spacing(4)))]"
            : "hc-group-data-[collapsible=icon]:w-(--hc-sidebar-width-icon)"
        )}
      />
      <div
        data-hc-ui="" data-slot="sidebar-container"
        data-side={side}
        className={cn(
          "hc-fixed hc-inset-y-0 hc-z-10 hc-hidden hc-h-svh hc-w-(--hc-sidebar-width) hc-transition-[left,right,width] hc-duration-200 hc-ease-linear hc-data-[side=left]:left-0 hc-data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--hc-sidebar-width)*-1)] hc-data-[side=right]:right-0 hc-data-[side=right]:group-data-[collapsible=offcanvas]:right-[calc(var(--hc-sidebar-width)*-1)] hc-md:flex",
          // Adjust the padding for floating and inset variants.
          variant === "floating" || variant === "inset"
            ? "hc-p-2 hc-group-data-[collapsible=icon]:w-[calc(var(--hc-sidebar-width-icon)+(--hc-spacing(4))+2px)]"
            : "hc-group-data-[collapsible=icon]:w-(--hc-sidebar-width-icon) hc-group-data-[side=left]:border-r hc-group-data-[side=right]:border-l",
          className
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-hc-ui="" data-slot="sidebar-inner"
          className="hc-flex hc-size-full hc-flex-col hc-bg-background hc-group-data-[variant=floating]:rounded-lg hc-group-data-[variant=floating]:shadow-sm hc-group-data-[variant=floating]:ring-1 hc-group-data-[variant=floating]:ring-border"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function SidebarTrigger({
  className,
  onClick,
  ...props
}) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      data-sidebar="trigger"
      data-hc-ui="" data-slot="sidebar-trigger"
      variant="ghost"
      size="icon-sm"
      className={cn(className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeftIcon />
      <span className="hc-sr-only">Toggle Sidebar</span>
    </Button>
  )
}

function SidebarRail({
  className,
  ...props
}) {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      data-sidebar="rail"
      data-hc-ui="" data-slot="sidebar-rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(
        "hc-absolute hc-inset-y-0 hc-z-20 hc-hidden hc-w-4 hc-transition-all hc-ease-linear hc-group-data-[side=left]:-right-4 hc-group-data-[side=right]:left-0 hc-after:absolute hc-after:inset-y-0 hc-after:start-1/2 hc-after:w-[2px] hc-hover:after:bg-border hc-sm:flex hc-ltr:-translate-x-1/2 hc-rtl:-translate-x-1/2",
        "hc-in-data-[side=left]:cursor-w-resize hc-in-data-[side=right]:cursor-e-resize",
        "hc-[[data-side=left][data-state=collapsed]_&]:cursor-e-resize hc-[[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "hc-group-data-[collapsible=offcanvas]:translate-x-0 hc-group-data-[collapsible=offcanvas]:after:left-full hc-hover:group-data-[collapsible=offcanvas]:bg-background",
        "hc-[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "hc-[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarInset({
  className,
  ...props
}) {
  return (
    <main
      data-hc-ui="" data-slot="sidebar-inset"
      className={cn(
        "hc-relative hc-flex hc-w-full hc-flex-1 hc-flex-col hc-bg-background hc-md:peer-data-[variant=inset]:m-2 hc-md:peer-data-[variant=inset]:ml-0 hc-md:peer-data-[variant=inset]:rounded-xl hc-md:peer-data-[variant=inset]:shadow-sm hc-md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarInput({
  className,
  ...props
}) {
  return (
    <Input
      data-hc-ui="" data-slot="sidebar-input"
      data-sidebar="input"
      className={cn("hc-h-8 hc-w-full hc-bg-background hc-shadow-none", className)}
      {...props}
    />
  )
}

function SidebarHeader({
  className,
  ...props
}) {
  return (
    <div
      data-hc-ui="" data-slot="sidebar-header"
      data-sidebar="header"
      className={cn("hc-flex hc-flex-col hc-gap-2 hc-p-2", className)}
      {...props}
    />
  )
}

function SidebarFooter({
  className,
  ...props
}) {
  return (
    <div
      data-hc-ui="" data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn("hc-flex hc-flex-col hc-gap-2 hc-p-2", className)}
      {...props}
    />
  )
}

function SidebarSeparator({
  className,
  ...props
}) {
  return (
    <Separator
      data-hc-ui="" data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn("hc-mx-2 hc-w-auto hc-bg-border", className)}
      {...props}
    />
  )
}

function SidebarContent({
  className,
  ...props
}) {
  return (
    <div
      data-hc-ui="" data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "hc-no-scrollbar hc-flex hc-min-h-0 hc-flex-1 hc-flex-col hc-gap-0 hc-overflow-auto hc-group-data-[collapsible=icon]:overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroup({
  className,
  ...props
}) {
  return (
    <div
      data-hc-ui="" data-slot="sidebar-group"
      data-sidebar="group"
      className={cn("hc-relative hc-flex hc-w-full hc-min-w-0 hc-flex-col hc-p-2", className)}
      {...props}
    />
  )
}

function SidebarGroupLabel({
  className,
  render,
  ...props
}) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps({
      className: cn(
        "hc-flex hc-h-8 hc-shrink-0 hc-items-center hc-rounded-md hc-px-2 hc-text-xs hc-font-medium hc-text-foreground/70 hc-ring-ring hc-outline-hidden hc-transition-[margin,opacity] hc-duration-200 hc-ease-linear hc-group-data-[collapsible=icon]:-mt-8 hc-group-data-[collapsible=icon]:opacity-0 hc-focus-visible:ring-2 hc-[&>svg]:size-4 hc-[&>svg]:shrink-0",
        className
      ),
    }, props),
    render,
    state: {
      slot: "sidebar-group-label",
      sidebar: "group-label",
    },
  });
}

function SidebarGroupAction({
  className,
  render,
  ...props
}) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps({
      className: cn(
        "hc-absolute hc-top-3.5 hc-right-3 hc-flex hc-aspect-square hc-w-5 hc-items-center hc-justify-center hc-rounded-md hc-p-0 hc-text-foreground hc-ring-ring hc-outline-hidden hc-transition-transform hc-group-data-[collapsible=icon]:hidden hc-after:absolute hc-after:-inset-2 hc-hover:bg-muted hc-hover:text-foreground hc-focus-visible:ring-2 hc-md:after:hidden hc-[&>svg]:size-4 hc-[&>svg]:shrink-0",
        className
      ),
    }, props),
    render,
    state: {
      slot: "sidebar-group-action",
      sidebar: "group-action",
    },
  });
}

function SidebarGroupContent({
  className,
  ...props
}) {
  return (
    <div
      data-hc-ui="" data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn("hc-w-full hc-text-sm", className)}
      {...props}
    />
  )
}

function SidebarMenu({
  className,
  ...props
}) {
  return (
    <ul
      data-hc-ui="" data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn("hc-flex hc-w-full hc-min-w-0 hc-flex-col hc-gap-0", className)}
      {...props}
    />
  )
}

function SidebarMenuItem({
  className,
  ...props
}) {
  return (
    <li
      data-hc-ui="" data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("hc-group/menu-item hc-relative", className)}
      {...props}
    />
  )
}

const sidebarMenuButtonVariants = cva(
  "hc-peer/menu-button hc-group/menu-button hc-flex hc-w-full hc-items-center hc-gap-2 hc-overflow-hidden hc-rounded-md hc-p-2 hc-text-left hc-text-sm hc-ring-ring hc-outline-hidden hc-transition-[width,height,padding] hc-group-has-data-[sidebar=menu-action]/menu-item:pr-8 hc-group-data-[collapsible=icon]:size-8! hc-group-data-[collapsible=icon]:p-2! hc-hover:bg-muted hc-hover:text-foreground hc-focus-visible:ring-2 hc-active:bg-muted hc-active:text-foreground hc-disabled:pointer-events-none hc-disabled:opacity-50 hc-aria-disabled:pointer-events-none hc-aria-disabled:opacity-50 hc-data-open:hover:bg-muted hc-data-open:hover:text-foreground hc-data-active:bg-muted hc-data-active:font-medium hc-data-active:text-foreground hc-[&_svg]:size-4 hc-[&_svg]:shrink-0 hc-[&>span:last-child]:truncate",
  {
    variants: {
      variant: {
        default: "hc-hover:bg-muted hc-hover:text-foreground",
        outline:
          "hc-bg-background hc-shadow-[0_0_0_1px_var(--hc-color-border)] hc-hover:bg-muted hc-hover:text-foreground hc-hover:shadow-[0_0_0_1px_var(--hc-color-background-muted)]",
      },
      size: {
        default: "hc-h-8 hc-text-sm",
        sm: "hc-h-7 hc-text-xs",
        lg: "hc-h-12 hc-text-sm hc-group-data-[collapsible=icon]:p-0!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function SidebarMenuButton({
  render,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}) {
  const { isMobile, state } = useSidebar()
  const comp = useRender({
    defaultTagName: "button",
    props: mergeProps({
      className: cn(sidebarMenuButtonVariants({ variant, size }), className),
    }, props),
    render: !tooltip ? render : <TooltipTrigger render={render} />,
    state: {
      slot: "sidebar-menu-button",
      sidebar: "menu-button",
      size,
      active: isActive,
    },
  })

  if (!tooltip) {
    return comp
  }

  if (typeof tooltip === "string") {
    tooltip = {
      children: tooltip,
    }
  }

  return (
    <Tooltip>
      {comp}
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== "collapsed" || isMobile}
        {...tooltip}
      />
    </Tooltip>
  )
}

function SidebarMenuAction({
  className,
  render,
  showOnHover = false,
  ...props
}) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps({
      className: cn(
        "hc-absolute hc-top-1.5 hc-right-1 hc-flex hc-aspect-square hc-w-5 hc-items-center hc-justify-center hc-rounded-md hc-p-0 hc-text-foreground hc-ring-ring hc-outline-hidden hc-transition-transform hc-group-data-[collapsible=icon]:hidden hc-peer-hover/menu-button:text-foreground hc-peer-data-[size=default]/menu-button:top-1.5 hc-peer-data-[size=lg]/menu-button:top-2.5 hc-peer-data-[size=sm]/menu-button:top-1 hc-after:absolute hc-after:-inset-2 hc-hover:bg-muted hc-hover:text-foreground hc-focus-visible:ring-2 hc-md:after:hidden hc-[&>svg]:size-4 hc-[&>svg]:shrink-0",
        showOnHover &&
          "hc-group-focus-within/menu-item:opacity-100 hc-group-hover/menu-item:opacity-100 hc-peer-data-active/menu-button:text-foreground hc-aria-expanded:opacity-100 hc-md:opacity-0",
        className
      ),
    }, props),
    render,
    state: {
      slot: "sidebar-menu-action",
      sidebar: "menu-action",
    },
  });
}

function SidebarMenuBadge({
  className,
  ...props
}) {
  return (
    <div
      data-hc-ui="" data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        "hc-pointer-events-none hc-absolute hc-right-1 hc-flex hc-h-5 hc-min-w-5 hc-items-center hc-justify-center hc-rounded-md hc-px-1 hc-text-xs hc-font-medium hc-text-foreground hc-tabular-nums hc-select-none hc-group-data-[collapsible=icon]:hidden hc-peer-hover/menu-button:text-foreground hc-peer-data-[size=default]/menu-button:top-1.5 hc-peer-data-[size=lg]/menu-button:top-2.5 hc-peer-data-[size=sm]/menu-button:top-1 hc-peer-data-active/menu-button:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}) {
  // Random width between 50 to 90%.
  const [width] = React.useState(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`
  })

  return (
    <div
      data-hc-ui="" data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn("hc-flex hc-h-8 hc-items-center hc-gap-2 hc-rounded-md hc-px-2", className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="hc-size-4 hc-rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="hc-h-4 hc-max-w-(--skeleton-width) hc-flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width
          }
        }
      />
    </div>
  );
}

function SidebarMenuSub({
  className,
  ...props
}) {
  return (
    <ul
      data-hc-ui="" data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        "hc-mx-3.5 hc-flex hc-min-w-0 hc-translate-x-px hc-flex-col hc-gap-1 hc-border-l hc-border-border hc-px-2.5 hc-py-0.5 hc-group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSubItem({
  className,
  ...props
}) {
  return (
    <li
      data-hc-ui="" data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn("hc-group/menu-sub-item hc-relative", className)}
      {...props}
    />
  )
}

function SidebarMenuSubButton({
  render,
  size = "md",
  isActive = false,
  className,
  ...props
}) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps({
      className: cn(
        "hc-flex hc-h-7 hc-min-w-0 hc--translate-x-px hc-items-center hc-gap-2 hc-overflow-hidden hc-rounded-md hc-px-2 hc-text-foreground hc-ring-ring hc-outline-hidden hc-group-data-[collapsible=icon]:hidden hc-hover:bg-muted hc-hover:text-foreground hc-focus-visible:ring-2 hc-active:bg-muted hc-active:text-foreground hc-disabled:pointer-events-none hc-disabled:opacity-50 hc-aria-disabled:pointer-events-none hc-aria-disabled:opacity-50 hc-data-[size=md]:text-sm hc-data-[size=sm]:text-xs hc-data-active:bg-muted hc-data-active:text-foreground hc-[&>span:last-child]:truncate hc-[&>svg]:size-4 hc-[&>svg]:shrink-0 hc-[&>svg]:text-foreground",
        className
      ),
    }, props),
    render,
    state: {
      slot: "sidebar-menu-sub-button",
      sidebar: "menu-sub-button",
      size,
      active: isActive,
    },
  });
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
}
