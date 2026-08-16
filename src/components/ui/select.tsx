"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

const Select = SelectPrimitive.Root

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 text-left", className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "group/select-trigger flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none",
        // While the list is open the trigger gives up the corner radius on the
        // side the list is on, so the two halves meet flat and become one
        // shape. Base UI reports that side on the trigger itself, which is
        // what lets this stay correct when the popup flips above.
        "data-[popup-open]:data-[popup-side=bottom]:rounded-b-none data-[popup-open]:data-[popup-side=top]:rounded-t-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      {/* The chevron turns over as the list unfolds — the one part of the
          trigger that has to acknowledge the state changed. */}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground transition-transform duration-200 group-data-[popup-open]/select-trigger:rotate-180 motion-reduce:transition-none" />
        }
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  // Overlap the trigger's border by exactly one pixel so the two outlines land
  // on top of each other and read as a single continuous edge, not a hairline
  // gap between two separate boxes.
  sideOffset = -1,
  align = "start",
  alignOffset = 0,
  // Base UI's default overlays the popup on top of the trigger, native-select
  // style: the list covers the control, never lines up with the row it belongs
  // to, and the open animation is suppressed. Anchoring it below the trigger
  // and flush to its start edge is what makes it read as a dropdown.
  alignItemWithTrigger = false,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            "relative isolate z-50 max-h-(--available-height) min-w-(--anchor-width) max-w-[min(28rem,var(--available-width))] overflow-x-hidden overflow-y-auto overscroll-contain rounded-lg border border-input bg-popover text-popover-foreground shadow-lg",
            // Square off the edge that meets the trigger and keep the same
            // border the trigger wears, so control and list share one outline
            // and one corner radius — a single object, not two stacked ones.
            "data-[side=bottom]:rounded-t-none data-[side=top]:rounded-b-none",
            // The wipe has to start from whichever edge is shared, so the
            // direction follows the side Base UI actually placed the popup on.
            "data-[side=bottom]:data-open:animate-select-unfold-down data-[side=top]:data-open:animate-select-unfold-up",
            "data-[side=bottom]:data-closed:animate-select-fold-down data-[side=top]:data-closed:animate-select-fold-up",
            "motion-reduce:animate-none data-[align-trigger=true]:animate-none",
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          {/* Items are inset from the rounded edge. SelectGroup carries its own
              padding for grouped lists; the flat lists this app uses would
              otherwise run their highlight straight into the corner radius. */}
          <SelectPrimitive.List className="p-1 has-[[data-slot=select-group]]:p-0">
            {children}
          </SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-1.5 py-1 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      {/* Long option labels wrap rather than being clipped by the popup edge. */}
      <SelectPrimitive.ItemText className="flex min-w-0 flex-1 gap-2 text-pretty">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
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
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
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
