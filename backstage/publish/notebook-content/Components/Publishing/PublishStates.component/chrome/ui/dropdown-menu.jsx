import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { cn } from "../utils.js"
import { ChevronRightIcon, CheckIcon } from "lucide-react"

function DropdownMenu({
  ...props
}) {
  return <MenuPrimitive.Root data-hc-ui="" data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({
  ...props
}) {
  return <MenuPrimitive.Portal data-hc-ui="" data-slot="dropdown-menu-portal" {...props} />
}

function DropdownMenuTrigger({
  ...props
}) {
  return <MenuPrimitive.Trigger data-hc-ui="" data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  className,
  ...props
}) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="hc-isolate hc-z-50 hc-outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          data-hc-ui="" data-slot="dropdown-menu-content"
          className={cn("hc-z-50 hc-max-h-(--available-height) hc-w-(--anchor-width) hc-min-w-32 hc-origin-(--transform-origin) hc-overflow-x-hidden hc-overflow-y-auto hc-rounded-lg hc-bg-popover hc-p-1 hc-text-popover-foreground hc-shadow-md hc-ring-1 hc-ring-foreground/10 hc-duration-100 hc-outline-none hc-data-[side=bottom]:slide-in-from-top-2 hc-data-[side=inline-end]:slide-in-from-left-2 hc-data-[side=inline-start]:slide-in-from-right-2 hc-data-[side=left]:slide-in-from-right-2 hc-data-[side=right]:slide-in-from-left-2 hc-data-[side=top]:slide-in-from-bottom-2 hc-data-open:animate-in hc-data-open:fade-in-0 hc-data-open:zoom-in-95 hc-data-closed:animate-out hc-data-closed:overflow-hidden hc-data-closed:fade-out-0 hc-data-closed:zoom-out-95", className )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({
  ...props
}) {
  return <MenuPrimitive.Group data-hc-ui="" data-slot="dropdown-menu-group" {...props} />
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}) {
  return (
    <MenuPrimitive.GroupLabel
      data-hc-ui="" data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "hc-px-1.5 hc-py-1 hc-text-xs hc-font-medium hc-text-muted-foreground hc-data-inset:pl-7",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}) {
  return (
    <MenuPrimitive.Item
      data-hc-ui="" data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "hc-group/dropdown-menu-item hc-relative hc-flex hc-cursor-default hc-items-center hc-gap-1.5 hc-rounded-md hc-px-1.5 hc-py-1 hc-text-sm hc-outline-hidden hc-select-none hc-focus:bg-accent hc-focus:text-accent-foreground hc-not-data-[variant=destructive]:focus:**:text-accent-foreground hc-data-inset:pl-7 hc-data-[variant=destructive]:text-destructive hc-data-[variant=destructive]:focus:bg-destructive/10 hc-data-[variant=destructive]:focus:text-destructive hc-dark:data-[variant=destructive]:focus:bg-destructive/20 hc-data-disabled:pointer-events-none hc-data-disabled:opacity-50 hc-[&_svg]:pointer-events-none hc-[&_svg]:shrink-0 hc-[&_svg:not([class*='size-'])]:size-4 hc-data-[variant=destructive]:*:[svg]:text-destructive",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSub({
  ...props
}) {
  return <MenuPrimitive.SubmenuRoot data-hc-ui="" data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-hc-ui="" data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "hc-flex hc-cursor-default hc-items-center hc-gap-1.5 hc-rounded-md hc-px-1.5 hc-py-1 hc-text-sm hc-outline-hidden hc-select-none hc-focus:bg-accent hc-focus:text-accent-foreground hc-not-data-[variant=destructive]:focus:**:text-accent-foreground hc-data-inset:pl-7 hc-data-popup-open:bg-accent hc-data-popup-open:text-accent-foreground hc-data-open:bg-accent hc-data-open:text-accent-foreground hc-[&_svg]:pointer-events-none hc-[&_svg]:shrink-0 hc-[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="hc-ml-auto" />
    </MenuPrimitive.SubmenuTrigger>
  )
}

function DropdownMenuSubContent({
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  className,
  ...props
}) {
  return (
    <DropdownMenuContent
      data-hc-ui="" data-slot="dropdown-menu-sub-content"
      className={cn("hc-w-auto hc-min-w-[96px] hc-rounded-lg hc-bg-popover hc-p-1 hc-text-popover-foreground hc-shadow-lg hc-ring-1 hc-ring-foreground/10 hc-duration-100 hc-data-[side=bottom]:slide-in-from-top-2 hc-data-[side=left]:slide-in-from-right-2 hc-data-[side=right]:slide-in-from-left-2 hc-data-[side=top]:slide-in-from-bottom-2 hc-data-open:animate-in hc-data-open:fade-in-0 hc-data-open:zoom-in-95 hc-data-closed:animate-out hc-data-closed:fade-out-0 hc-data-closed:zoom-out-95", className )}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}) {
  return (
    <MenuPrimitive.CheckboxItem
      data-hc-ui="" data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      className={cn(
        "hc-relative hc-flex hc-cursor-default hc-items-center hc-gap-1.5 hc-rounded-md hc-py-1 hc-pr-8 hc-pl-1.5 hc-text-sm hc-outline-hidden hc-select-none hc-focus:bg-accent hc-focus:text-accent-foreground hc-focus:**:text-accent-foreground hc-data-inset:pl-7 hc-data-disabled:pointer-events-none hc-data-disabled:opacity-50 hc-[&_svg]:pointer-events-none hc-[&_svg]:shrink-0 hc-[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      {...props}
    >
      <span
        className="hc-pointer-events-none hc-absolute hc-right-2 hc-flex hc-items-center hc-justify-center"
        data-hc-ui="" data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon
          />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({
  ...props
}) {
  return (
    <MenuPrimitive.RadioGroup
      data-hc-ui="" data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}) {
  return (
    <MenuPrimitive.RadioItem
      data-hc-ui="" data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      className={cn(
        "hc-relative hc-flex hc-cursor-default hc-items-center hc-gap-1.5 hc-rounded-md hc-py-1 hc-pr-8 hc-pl-1.5 hc-text-sm hc-outline-hidden hc-select-none hc-focus:bg-accent hc-focus:text-accent-foreground hc-focus:**:text-accent-foreground hc-data-inset:pl-7 hc-data-disabled:pointer-events-none hc-data-disabled:opacity-50 hc-[&_svg]:pointer-events-none hc-[&_svg]:shrink-0 hc-[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span
        className="hc-pointer-events-none hc-absolute hc-right-2 hc-flex hc-items-center hc-justify-center"
        data-hc-ui="" data-slot="dropdown-menu-radio-item-indicator"
      >
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon
          />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}) {
  return (
    <MenuPrimitive.Separator
      data-hc-ui="" data-slot="dropdown-menu-separator"
      className={cn("hc--mx-1 hc-my-1 hc-h-px hc-bg-border", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}) {
  return (
    <span
      data-hc-ui="" data-slot="dropdown-menu-shortcut"
      className={cn(
        "hc-ml-auto hc-text-xs hc-tracking-widest hc-text-muted-foreground hc-group-focus/dropdown-menu-item:text-accent-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
