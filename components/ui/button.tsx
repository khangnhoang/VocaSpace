import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-[12px] border border-transparent bg-clip-padding text-sm font-semibold leading-5 outline-none transition-[color,background-color,border-color,box-shadow,opacity] duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)] focus-visible:ring-2 focus-visible:ring-route focus-visible:ring-offset-2 focus-visible:ring-offset-background active:brightness-95 active:shadow-inner motion-reduce:transition-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-correction aria-invalid:ring-correction/25 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-action text-action-foreground hover:bg-action/90",
        outline:
          "border-border bg-background text-foreground hover:border-route/35 hover:bg-muted aria-expanded:border-route/35 aria-expanded:bg-muted",
        secondary:
          "border-border bg-background text-foreground hover:border-route/35 hover:bg-muted aria-expanded:border-route/35 aria-expanded:bg-muted",
        ghost:
          "text-foreground hover:bg-muted aria-expanded:bg-muted",
        destructive:
          "bg-correction text-white hover:bg-correction/90",
        "destructive-quiet":
          "text-correction hover:bg-correction-quiet aria-expanded:bg-correction-quiet",
        link: "text-route underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-2 px-3.5 [&_svg:not([class*='size-'])]:size-[18px]",
        xs: "h-6 gap-1 rounded-[8px] px-2 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-3 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-11 gap-2 px-5 [&_svg:not([class*='size-'])]:size-5",
        icon: "size-9 [&_svg:not([class*='size-'])]:size-[18px]",
        "icon-xs":
          "size-6 rounded-[8px] [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm":
          "size-8 [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-11 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"
  const resolvedVariant = variant ?? "default"
  const resolvedSize = size ?? "default"

  return (
    <Comp
      data-slot="button"
      data-variant={resolvedVariant}
      data-size={resolvedSize}
      data-icon-only={resolvedSize.startsWith("icon") ? "true" : undefined}
      className={cn(buttonVariants({ variant: resolvedVariant, size: resolvedSize, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
