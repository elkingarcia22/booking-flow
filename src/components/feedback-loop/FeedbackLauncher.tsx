import * as React from "react"
import { ThemaIcon } from "@/icons"
import { cn } from "@/lib/utils"

export interface FeedbackLauncherProps extends Omit<React.ComponentProps<"button">, "children"> {
  /** Solo el icono. Úsalo cuando la persona ya lo abrió una vez: ya sabe qué es. */
  collapsed?: boolean
  /** Un pulso suave alrededor, para una campaña que todavía no ha recibido su opinión. */
  highlight?: boolean
  /** El panel que abre está abierto (`aria-expanded`). */
  expanded?: boolean
  label?: string
}

/**
 * FeedbackLauncher
 *
 * El botón flotante que abre el panel de feedback, fijo en la esquina inferior
 * derecha y por encima del contenido. Empieza como pastilla con texto para
 * que se entienda sin explicarlo y, una vez usado, se contrae a un círculo
 * que no tapa nada.
 *
 * En pantallas angostas sube lo justo para no montarse sobre el botón de
 * acciones (`ActionFab`), que vive en la misma esquina.
 *
 * @example
 * <FeedbackLauncher collapsed={yaLoAbrio} onClick={abrirPanel} data-tour="feedback-launcher" />
 */
export function FeedbackLauncher({
  collapsed = false,
  highlight = false,
  expanded,
  label = "Feedback",
  className,
  ...props
}: FeedbackLauncherProps) {
  return (
    <button
      type="button"
      aria-label={collapsed ? label : undefined}
      aria-expanded={expanded}
      aria-haspopup="dialog"
      title={collapsed ? label : undefined}
      data-slot="feedback-launcher"
      className={cn(
        "group fixed bottom-24 right-4 z-rail flex h-12 items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-foreground shadow-rail outline-none md:bottom-6 md:right-6",
        "transition-transform duration-fast ease-out-expo active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none",
        collapsed ? "w-12" : "px-5",
        className
      )}
      {...props}
    >
      {highlight && (
        <span aria-hidden className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/40 motion-reduce:hidden" />
      )}
      <ThemaIcon name="feedback" size="sm" tone="inverse" className="transition-transform duration-fast group-hover:scale-110 motion-reduce:transition-none" />
      {!collapsed && <span className="text-sm uppercase tracking-wide">{label}</span>}
    </button>
  )
}
