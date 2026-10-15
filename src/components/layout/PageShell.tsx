import * as React from "react"
import { cn } from "@/lib/utils"

interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Ancho máximo del contenido. Los tres anchos del sistema son `narrow`
   * (720px: formularios y asistentes), `normal` (1140px: la mayoría de las
   * pantallas) y `wide` (1600px: tableros densos). `enterprise`,
   * `constrained` y `full` se mantienen por compatibilidad.
   */
  maxWidth?: "narrow" | "normal" | "wide" | "enterprise" | "full" | "constrained"
}

const PageShell = React.forwardRef<HTMLDivElement, PageShellProps>(
  ({ className, maxWidth = "enterprise", children, ...props }, ref) => {
    const maxWidthClass = {
      narrow: "max-w-narrow",
      normal: "max-w-normal",
      wide: "max-w-wide",
      enterprise: "max-w-[1600px]",
      constrained: "max-w-[1200px]",
      full: "max-w-full",
    }[maxWidth]

    return (
      <main
        ref={ref}
        className={cn(
          "flex-1 overflow-y-auto bg-background p-page transition-all scroll-smooth",
          className
        )}
        {...props}
      >
        {/* El aire entre secciones sale del token, no de un 32px fijo: así
            sigue a la densidad que elija quien mira, igual que el interior de
            los componentes. */}
        <div className={cn("mx-auto flex flex-col space-y-section", maxWidthClass)}>
          {children}
        </div>
      </main>
    )
  }
)
PageShell.displayName = "PageShell"

export { PageShell }