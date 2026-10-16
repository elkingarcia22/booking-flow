import { cn } from "@/lib/utils"
import { CommentAvatar } from "./CommentComposer"
import type { CommentAuthor } from "./commentTypes"

export interface CommentPinProps {
  author: CommentAuthor
  /** Posición en porcentaje de la capa. */
  x: number
  y: number
  selected?: boolean
  unread?: boolean
  resolved?: boolean
  /** Un pin en borrador: late hasta que se escribe el comentario. */
  pending?: boolean
  label: string
  onClick?: () => void
  className?: string
}

/**
 * CommentPin
 *
 * El marcador de un hilo sobre la pantalla: una gota con el avatar de quien
 * lo abrió, con la punta (abajo a la izquierda) en el punto exacto del clic.
 * Un punto primario avisa que hay algo sin leer; resuelto se apaga.
 */
export function CommentPin({ author, x, y, selected, unread, resolved, pending, label, onClick, className }: CommentPinProps) {
  return (
    <button
      type="button"
      data-slot="comment-pin"
      data-selected={selected || undefined}
      aria-label={label}
      aria-pressed={selected}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
      className={cn(
        "pointer-events-auto absolute flex -translate-y-full items-center justify-center rounded-full rounded-bl-none border-2 bg-surface p-0.5 shadow-lg outline-none",
        "transition-transform duration-fast ease-out-expo hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
        selected || pending ? "z-raised scale-110 border-primary" : "border-surface",
        resolved && !selected && "opacity-60",
        className
      )}
      style={{ left: `${x}%`, top: `${y}%`, transformOrigin: "bottom left" }}
    >
      <CommentAvatar author={author} size="sm" />
      {pending && <span aria-hidden className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/30 motion-reduce:hidden" />}
      {unread && !resolved && <span aria-hidden className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-surface bg-primary" />}
    </button>
  )
}
