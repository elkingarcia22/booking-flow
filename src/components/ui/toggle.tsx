import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Toggle as TogglePrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/*
 * Botón de dos estados (activo / inactivo) para ajustes que se ven en el
 * acto: negrita, filtro puesto, vista compacta. Las alturas coinciden con
 * las de `Button` (sm 28px, default 32px, lg 36px) para poder mezclarlos en
 * la misma barra.
 */
const toggleVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 active:bg-muted/70 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 data-[state=on]:bg-primary/10 data-[state=on]:text-primary [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border-border bg-background hover:bg-muted data-[state=on]:border-primary/30",
      },
      size: {
        default: "h-8 min-w-8 px-2.5",
        sm: "h-7 min-w-7 px-2 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 min-w-9 px-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      data-variant={variant}
      data-size={size}
      className={cn(toggleVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
