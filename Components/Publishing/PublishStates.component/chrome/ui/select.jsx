import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cn } from "../utils.js"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

const Select = SelectPrimitive.Root

function SelectGroup({
  className,
  ...props
}) {
  return (
    <SelectPrimitive.Group
      data-hc-ui="" data-slot="select-group"
      className={cn("hc-scroll-my-1 hc-p-1", className)}
      {...props}
    />
  )
}

function SelectValue({
  className,
  ...props
}) {
  return (
    <SelectPrimitive.Value
      data-hc-ui="" data-slot="select-value"
      className={cn("hc-flex hc-flex-1 hc-text-left", className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}) {
  return (
    <SelectPrimitive.Trigger
      data-hc-ui="" data-slot="select-trigger"
      data-size={size}
      className={cn(
        "hc-flex hc-w-fit hc-items-center hc-justify-between hc-gap-1.5 hc-rounded-lg hc-border hc-border-input hc-bg-transparent hc-py-2 hc-pr-2 hc-pl-2.5 hc-text-sm hc-whitespace-nowrap hc-transition-colors hc-outline-none hc-select-none hc-focus-visible:border-ring hc-focus-visible:ring-3 hc-focus-visible:ring-ring/50 hc-disabled:cursor-not-allowed hc-disabled:opacity-50 hc-aria-invalid:border-destructive hc-aria-invalid:ring-3 hc-aria-invalid:ring-destructive/20 hc-data-placeholder:text-muted-foreground hc-data-[size=default]:h-8 hc-data-[size=sm]:h-7 hc-data-[size=sm]:rounded-[min(var(--hc-radius-md),10px)] hc-*:data-[slot=select-value]:line-clamp-1 hc-*:data-[slot=select-value]:flex hc-*:data-[slot=select-value]:items-center hc-*:data-[slot=select-value]:gap-1.5 hc-dark:bg-input/30 hc-dark:hover:bg-input/50 hc-dark:aria-invalid:border-destructive/50 hc-dark:aria-invalid:ring-destructive/40 hc-[&_svg]:pointer-events-none hc-[&_svg]:shrink-0 hc-[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon className="hc-pointer-events-none hc-size-4 hc-text-muted-foreground" />
        }
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="hc-isolate hc-z-50"
      >
        <SelectPrimitive.Popup
          data-hc-ui="" data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn("hc-relative hc-isolate hc-z-50 hc-max-h-(--available-height) hc-w-(--anchor-width) hc-min-w-36 hc-origin-(--transform-origin) hc-overflow-x-hidden hc-overflow-y-auto hc-rounded-lg hc-bg-popover hc-text-popover-foreground hc-shadow-md hc-ring-1 hc-ring-foreground/10 hc-duration-100 hc-data-[align-trigger=true]:animate-none hc-data-[side=bottom]:slide-in-from-top-2 hc-data-[side=inline-end]:slide-in-from-left-2 hc-data-[side=inline-start]:slide-in-from-right-2 hc-data-[side=left]:slide-in-from-right-2 hc-data-[side=right]:slide-in-from-left-2 hc-data-[side=top]:slide-in-from-bottom-2 hc-data-open:animate-in hc-data-open:fade-in-0 hc-data-open:zoom-in-95 hc-data-closed:animate-out hc-data-closed:fade-out-0 hc-data-closed:zoom-out-95", className )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}) {
  return (
    <SelectPrimitive.GroupLabel
      data-hc-ui="" data-slot="select-label"
      className={cn("hc-px-1.5 hc-py-1 hc-text-xs hc-text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}) {
  return (
    <SelectPrimitive.Item
      data-hc-ui="" data-slot="select-item"
      className={cn(
        "hc-relative hc-flex hc-w-full hc-cursor-default hc-items-center hc-gap-1.5 hc-rounded-md hc-py-1 hc-pr-8 hc-pl-1.5 hc-text-sm hc-outline-hidden hc-select-none hc-focus:bg-accent hc-focus:text-accent-foreground hc-not-data-[variant=destructive]:focus:**:text-accent-foreground hc-data-disabled:pointer-events-none hc-data-disabled:opacity-50 hc-[&_svg]:pointer-events-none hc-[&_svg]:shrink-0 hc-[&_svg:not([class*='size-'])]:size-4 hc-*:[span]:last:flex hc-*:[span]:last:items-center hc-*:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="hc-flex hc-flex-1 hc-shrink-0 hc-gap-2 hc-whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="hc-pointer-events-none hc-absolute hc-right-2 hc-flex hc-size-4 hc-items-center hc-justify-center" />
        }
      >
        <CheckIcon className="hc-pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}) {
  return (
    <SelectPrimitive.Separator
      data-hc-ui="" data-slot="select-separator"
      className={cn("hc-pointer-events-none hc--mx-1 hc-my-1 hc-h-px hc-bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-hc-ui="" data-slot="select-scroll-up-button"
      className={cn(
        "hc-top-0 hc-z-10 hc-flex hc-w-full hc-cursor-default hc-items-center hc-justify-center hc-bg-popover hc-py-1 hc-[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronUpIcon
      />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-hc-ui="" data-slot="select-scroll-down-button"
      className={cn(
        "hc-bottom-0 hc-z-10 hc-flex hc-w-full hc-cursor-default hc-items-center hc-justify-center hc-bg-popover hc-py-1 hc-[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronDownIcon
      />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
