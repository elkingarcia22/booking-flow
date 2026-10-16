import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ThemaIcon } from "@/icons"
import { cn } from "@/lib/utils"
import { initialsOf, type CommentAuthor } from "./commentTypes"

/** El avatar de quien firma un comentario, con iniciales de respaldo. */
export function CommentAvatar({ author, size = "default", className }: { author: CommentAuthor; size?: "sm" | "default"; className?: string }) {
  return (
    <Avatar size={size} className={className}>
      {author.avatarUrl && <AvatarImage src={author.avatarUrl} alt="" />}
      <AvatarFallback>{initialsOf(author.name)}</AvatarFallback>
    </Avatar>
  )
}

export interface CommentComposerProps {
  onSubmit: (body: string) => void
  onCancel?: () => void
  placeholder?: string
  submitLabel?: string
  cancelLabel?: string
  autoFocus?: boolean
  className?: string
}

/**
 * CommentComposer
 *
 * La caja para escribir un comentario o una respuesta. Enter envía,
 * Shift+Enter baja de línea y Esc cancela (si hay `onCancel`).
 */
export function CommentComposer({ onSubmit, onCancel, placeholder, submitLabel = "Enviar", cancelLabel = "Cancelar", autoFocus, className }: CommentComposerProps) {
  const [body, setBody] = React.useState("")
  const trimmed = body.trim()

  const submit = () => {
    if (!trimmed) return
    onSubmit(trimmed)
    setBody("")
  }

  return (
    <form
      data-slot="comment-composer"
      className={cn("flex flex-col gap-2", className)}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        rows={2}
        className="min-h-16 resize-none"
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            submit()
          } else if (event.key === "Escape" && onCancel) {
            // El Esc de la caja no debe además sacar del modo comentar.
            event.preventDefault()
            event.stopPropagation()
            onCancel()
          }
        }}
      />
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" size="sm" disabled={!trimmed}>
          <ThemaIcon name="send" size="xs" />
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
