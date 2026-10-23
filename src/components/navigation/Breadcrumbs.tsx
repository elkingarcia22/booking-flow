import * as React from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export interface BreadcrumbItem {
  label: string
  /** A dónde lleva este tramo. Sin ella, el tramo es solo contexto —una
   *  sección sin pantalla propia, como "Componentes" o "Fundamentos"— y se
   *  queda como texto, igual que ya pasaba con todos los tramos. */
  onClick?: () => void
}

interface BreadcrumbsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
  /** De la raíz a la página actual. Un string es un tramo sin destino; para
   *  que navegue, pasa `{ label, onClick }`. El último tramo nunca es
   *  clicable —es la página en la que ya se está—, aunque traiga `onClick`. */
  items: readonly (string | BreadcrumbItem)[]
}

const Breadcrumbs = React.forwardRef<HTMLDivElement, BreadcrumbsProps>(
  ({ items, className, ...props }, ref) => {
    return (
      <nav
        ref={ref}
        aria-label="Breadcrumb"
        className={cn("flex min-w-0 items-center space-x-1 text-xs", className)}
        {...props}
      >
        {items.map((raw, index) => {
          const item = typeof raw === "string" ? { label: raw } : raw
          const isLast = index === items.length - 1
          const isClickable = !isLast && !!item.onClick
          // En el celular solo cabe la página actual: los tramos de antes se esconden y ella se recorta.
          const ancestor = !isLast && "max-sm:hidden"

          return (
            <React.Fragment key={index}>
              {isClickable ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className={cn("shrink-0 rounded-sm text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50", ancestor)}
                >
                  {item.label}
                </button>
              ) : (
                <span
                  className={cn(
                    "transition-colors",
                    isLast ? "min-w-0 truncate text-text-primary font-medium" : "shrink-0 text-text-muted cursor-default",
                    ancestor
                  )}
                >
                  {item.label}
                </span>
              )}
              {!isLast && (
                <ChevronRight className="h-3 w-3 text-text-muted shrink-0 max-sm:hidden" />
              )}
            </React.Fragment>
          )
        })}
      </nav>
    )
  }
)

Breadcrumbs.displayName = "Breadcrumbs"

export { Breadcrumbs }
