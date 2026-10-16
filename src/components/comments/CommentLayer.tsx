import * as React from "react"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Text } from "@/components/typography"
import { ThemaIcon } from "@/icons"
import { cn } from "@/lib/utils"
import { CommentComposer } from "./CommentComposer"
import { CommentPin } from "./CommentPin"
import { useComments } from "./commentsContext"
import { filterThreads } from "./commentTypes"

export interface CommentLayerProps extends React.ComponentProps<"div"> {
  /** Oculta la pastilla «Haz clic donde quieras comentar · Navegar». */
  hideHint?: boolean
}

const clamp = (value: number) => Math.min(100, Math.max(0, value))

/**
 * CommentLayer
 *
 * Envuelve la superficie que se comenta. Con el panel abierto pinta los pins
 * de la vista activa encima del contenido; en modo comentar, un clic en
 * cualquier punto deja un pin en borrador con su caja de texto al lado.
 *
 * En modo navegar el contenido se usa con normalidad (los pins siguen a la
 * vista); `C` o «Comentar» vuelven a comentar y `Esc` o «Navegar» salen.
 */
export function CommentLayer({ hideHint = false, className, children, ...props }: CommentLayerProps) {
  const { threads, open, mode, setMode, draft, setDraft, createThread, selectedId, select, filter, context, currentUser, labels } = useComments()
  const ref = React.useRef<HTMLDivElement>(null)

  const visible = React.useMemo(() => {
    const filtered = filterThreads(threads, filter)
    const selected = threads.find((thread) => thread.id === selectedId)
    // El hilo elegido se ve aunque el filtro lo deje fuera.
    if (selected && !filtered.includes(selected)) filtered.push(selected)
    return filtered.filter((thread) => context === undefined || thread.context === undefined || thread.context === context)
  }, [threads, filter, selectedId, context])

  const place = (event: React.MouseEvent<HTMLDivElement>) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box || box.width === 0 || box.height === 0) return
    select(null)
    setDraft({ x: clamp(((event.clientX - box.left) / box.width) * 100), y: clamp(((event.clientY - box.top) / box.height) * 100), context })
  }

  return (
    <div ref={ref} data-slot="comment-layer" data-comment-mode={open ? mode : undefined} className={cn("relative", className)} {...props}>
      {children}
      {open && (
        <div className="pointer-events-none absolute inset-0 z-raised">
          {mode === "comment" && <div aria-hidden className="pointer-events-auto absolute inset-0 cursor-crosshair" onClick={place} />}

          {visible.map((thread) => {
            const root = thread.messages[0]
            if (!root) return null
            return (
              <CommentPin
                key={thread.id}
                author={root.author}
                x={thread.x}
                y={thread.y}
                selected={thread.id === selectedId}
                unread={thread.unread}
                resolved={thread.resolved}
                label={`${root.author.name}: ${root.body}`}
                onClick={() => select(thread.id === selectedId ? null : thread.id)}
              />
            )
          })}

          {draft && (
            <>
              <CommentPin author={currentUser} x={draft.x} y={draft.y} pending label={labels.placeholder} />
              <div
                data-slot="comment-draft"
                className={cn(
                  "pointer-events-auto absolute z-popover w-72 rounded-lg border border-border bg-popover p-3 shadow-lg",
                  draft.x > 60 ? "-translate-x-full -ml-3" : "ml-10",
                  draft.y > 60 ? "-translate-y-full" : "-translate-y-8"
                )}
                style={{ left: `${draft.x}%`, top: `${draft.y}%` }}
                onClick={(event) => event.stopPropagation()}
              >
                <CommentComposer
                  autoFocus
                  placeholder={labels.placeholder}
                  submitLabel={labels.send}
                  cancelLabel={labels.cancel}
                  onCancel={() => setDraft(null)}
                  onSubmit={(body) => createThread(body, draft)}
                />
              </div>
            </>
          )}

          {mode === "comment" && !hideHint && (
            <div className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-popover py-1.5 pl-4 pr-1.5 shadow-lg">
              <ThemaIcon name="chat" size="xs" tone="primary" />
              <Text size="sm" weight="medium" className="whitespace-nowrap">
                {labels.hint}
              </Text>
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode("browse")}>
                <ThemaIcon name="pointer" size="xs" />
                {labels.exit}
                <Kbd>Esc</Kbd>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
