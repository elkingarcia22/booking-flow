import * as React from "react"
import { formatDistanceToNowStrict } from "date-fns"
import { es } from "date-fns/locale"
import { SegmentedControl } from "@/components/selection"
import { Text } from "@/components/typography"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import { ThemaIcon } from "@/icons"
import { cn } from "@/lib/utils"
import { CommentAvatar, CommentComposer } from "./CommentComposer"
import { useComments } from "./commentsContext"
import { filterThreads, type CommentReadFilter, type CommentStatusFilter, type CommentThread } from "./commentTypes"

export interface CommentsPanelProps {
  /**
   * Se llama al elegir un hilo de otra vista (su `context` no es el activo):
   * la app cambia de vista para que el pin aparezca.
   */
  onNavigate?: (thread: CommentThread) => void
  className?: string
}

function timeAgo(iso: string) {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: es })
  } catch {
    return ""
  }
}

/**
 * CommentsPanel
 *
 * El panel lateral derecho de los comentarios. Arriba, el botón para pasar a
 * modo comentar y los filtros (pendientes, resueltos o todos; leídos o no
 * leídos); debajo, la lista de hilos. Al elegir uno se abre la conversación
 * con sus respuestas, la caja para responder y las acciones de resolver o
 * marcar como no leído.
 *
 * Se monta junto a la superficie (empuja el contenido, no lo tapa); por
 * debajo de `md` ocupa la pantalla como un drawer.
 */
export function CommentsPanel({ onNavigate, className }: CommentsPanelProps) {
  const { threads, open, setOpen, mode, setMode, selectedId, select, filter, setFilter, labels, context } = useComments()
  const selected = threads.find((thread) => thread.id === selectedId) ?? null
  const list = React.useMemo(() => filterThreads(threads, filter), [threads, filter])

  if (!open) return null

  const choose = (thread: CommentThread) => {
    select(thread.id)
    if (thread.context && context !== undefined && thread.context !== context) onNavigate?.(thread)
  }

  const statusOptions = [
    { value: "open", label: labels.statusOpen },
    { value: "resolved", label: labels.statusResolved },
    { value: "all", label: labels.statusAll },
  ]
  const readOptions: { value: CommentReadFilter; label: string }[] = [
    { value: "all", label: labels.readAll },
    { value: "unread", label: labels.readUnread },
    { value: "read", label: labels.readRead },
  ]

  return (
    <aside
      role="complementary"
      aria-label={labels.title}
      data-slot="comments-panel"
      className={cn(
        "fixed inset-0 z-drawer flex flex-col bg-surface md:static md:z-auto md:h-full md:w-96 md:shrink-0 md:border-l md:border-border",
        className
      )}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        {selected ? (
          <Button type="button" variant="ghost" size="icon-sm" aria-label={labels.back} onClick={() => select(null)}>
            <ThemaIcon name="arrowLeft" size="sm" />
          </Button>
        ) : null}
        <Text as="h2" weight="semibold" truncate className="min-w-0 flex-1">
          {labels.title}
        </Text>
        <Button
          type="button"
          size="sm"
          variant={mode === "comment" ? "default" : "outline"}
          aria-pressed={mode === "comment"}
          onClick={() => setMode(mode === "comment" ? "browse" : "comment")}
        >
          <ThemaIcon name={mode === "comment" ? "pointer" : "plus"} size="xs" />
          {mode === "comment" ? labels.exit : labels.comment}
          <Kbd>{mode === "comment" ? "Esc" : "C"}</Kbd>
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={labels.close} onClick={() => setOpen(false)}>
          <ThemaIcon name="close" size="sm" />
        </Button>
      </header>

      {selected ? (
        <ThreadDetail thread={selected} />
      ) : (
        <>
          <div className="flex shrink-0 items-center gap-2 px-4 pt-3">
            <SegmentedControl
              className="min-w-0 flex-1"
              options={statusOptions}
              value={filter.status}
              onChange={(value) => setFilter({ ...filter, status: value as CommentStatusFilter })}
              size="sm"
              fullWidth
              ariaLabel={labels.statusFilter}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="icon-sm" aria-label={labels.readFilter} className="relative">
                  <ThemaIcon name="filter" size="xs" />
                  {filter.read !== "all" && <span aria-hidden className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{labels.readFilter}</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={filter.read} onValueChange={(value) => setFilter({ ...filter, read: value as CommentReadFilter })}>
                  {readOptions.map((option) => (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 [scrollbar-gutter:stable]">
            {list.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <ThemaIcon name="chat" size="lg" tone="muted" />
                <Text weight="semibold">{labels.emptyTitle}</Text>
                <Text variant="muted">{labels.emptyDescription}</Text>
              </div>
            ) : (
              <ul className="flex flex-col gap-1">
                {list.map((thread) => (
                  <li key={thread.id}>
                    <ThreadRow thread={thread} onSelect={() => choose(thread)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </aside>
  )
}

function ThreadRow({ thread, onSelect }: { thread: CommentThread; onSelect: () => void }) {
  const { labels } = useComments()
  const root = thread.messages[0]
  if (!root) return null
  const last = thread.messages[thread.messages.length - 1] ?? root
  const replies = thread.messages.length - 1
  return (
    <button
      type="button"
      data-slot="comment-thread-row"
      data-unread={thread.unread || undefined}
      onClick={onSelect}
      className="flex w-full gap-3 rounded-lg px-3 py-3 text-left outline-none transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CommentAvatar author={root.author} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <Text weight={thread.unread ? "semibold" : "medium"} truncate className="min-w-0 flex-1">
            {root.author.name}
          </Text>
          <Text variant="caption" className="shrink-0">
            {timeAgo(last.createdAt)}
          </Text>
          {thread.unread && <span aria-label={labels.readUnread} className="size-2 shrink-0 rounded-full bg-primary" />}
        </div>
        <Text tone={thread.unread ? "default" : "secondary"} className="line-clamp-2">
          {root.body}
        </Text>
        <div className="flex flex-wrap items-center gap-2">
          {replies > 0 && <Text variant="caption">{labels.replies(replies)}</Text>}
          {thread.contextLabel && <Badge variant="neutral">{thread.contextLabel}</Badge>}
          {thread.resolved && (
            <Badge variant="positive">
              <ThemaIcon name="check" size="xs" tone="positive" />
              {labels.resolved}
            </Badge>
          )}
        </div>
      </div>
    </button>
  )
}

function ThreadDetail({ thread }: { thread: CommentThread }) {
  const { reply, setResolved, setUnread, removeThread, select, labels } = useComments()
  const endRef = React.useRef<HTMLLIElement>(null)
  const count = thread.messages.length

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [count])

  return (
    <div data-slot="comment-thread" className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-4 py-2">
        {thread.contextLabel && <Badge variant="neutral">{thread.contextLabel}</Badge>}
        <div className="ml-auto flex items-center gap-1">
          <Button type="button" variant={thread.resolved ? "outline" : "secondary"} size="sm" onClick={() => setResolved(thread.id, !thread.resolved)}>
            <ThemaIcon name={thread.resolved ? "refresh" : "check"} size="xs" />
            {thread.resolved ? labels.reopen : labels.resolve}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={labels.more}>
                <ThemaIcon name="more" size="sm" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setUnread(thread.id, true)
                  select(null)
                }}
              >
                <ThemaIcon name="eyeOff" size="sm" />
                {labels.markUnread}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => removeThread(thread.id)}>
                <ThemaIcon name="close" size="sm" />
                {labels.remove}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ol className="min-h-0 flex-1 overflow-y-auto px-4 pb-2 [scrollbar-gutter:stable]">
        {thread.messages.map((message, index) => (
          <li key={message.id} className={cn("flex gap-3 py-3", index > 0 && "border-t border-border")}>
            <CommentAvatar author={message.author} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <Text weight="semibold" truncate className="min-w-0">
                  {message.author.name}
                </Text>
                <Text variant="caption" className="shrink-0">
                  {timeAgo(message.createdAt)}
                </Text>
              </div>
              <Text className="whitespace-pre-wrap break-words">{message.body}</Text>
            </div>
          </li>
        ))}
        <li ref={endRef} aria-hidden />
      </ol>

      <div className="shrink-0 border-t border-border p-4">
        <CommentComposer key={thread.id} placeholder={labels.replyPlaceholder} submitLabel={labels.send} onSubmit={(body) => reply(thread.id, body)} />
      </div>
    </div>
  )
}
