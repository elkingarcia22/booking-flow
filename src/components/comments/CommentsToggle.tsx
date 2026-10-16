import { Button } from "@/components/ui/button"
import { ThemaIcon } from "@/icons"
import { cn } from "@/lib/utils"
import { useComments } from "./commentsContext"

export interface CommentsToggleProps {
  /** Solo el icono (el contador sigue visible). */
  iconOnly?: boolean
  className?: string
}

/**
 * CommentsToggle
 *
 * El botón de cabecera que abre y cierra el panel de comentarios. Lleva el
 * número de hilos pendientes sin leer y queda presionado mientras el panel
 * está abierto.
 */
export function CommentsToggle({ iconOnly = false, className }: CommentsToggleProps) {
  const { open, setOpen, unreadCount, labels } = useComments()
  return (
    <Button
      type="button"
      variant={open ? "secondary" : "outline"}
      size={iconOnly ? "icon-sm" : "sm"}
      aria-pressed={open}
      aria-label={iconOnly ? labels.toggle : undefined}
      title={unreadCount > 0 ? `${labels.toggle} · ${labels.unreadCount(unreadCount)}` : labels.toggle}
      data-slot="comments-toggle"
      className={cn("relative", className)}
      onClick={() => setOpen(!open)}
    >
      <ThemaIcon name="chat" size="xs" />
      {!iconOnly && <span className="hidden md:inline">{labels.toggle}</span>}
      {unreadCount > 0 && (
        <span
          aria-label={labels.unreadCount(unreadCount)}
          className={cn(
            "flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold leading-none text-primary-foreground tabular-nums",
            iconOnly && "absolute -right-1.5 -top-1.5"
          )}
        >
          {unreadCount}
        </span>
      )}
    </Button>
  )
}
