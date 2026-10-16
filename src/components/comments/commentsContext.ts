import * as React from "react"
import type { CommentAuthor, CommentFilter, CommentLabels, CommentThread } from "./commentTypes"

/** «browse»: se navega la pantalla con normalidad. «comment»: el clic deja un pin. */
export type CommentMode = "browse" | "comment"

/** El pin que se está dejando y todavía no tiene texto. */
export interface CommentDraft {
  x: number
  y: number
  context?: string
}

export interface CommentsContextValue {
  threads: CommentThread[]
  currentUser: CommentAuthor
  labels: CommentLabels
  /** La vista activa: la capa solo pinta los pins de esta. */
  context?: string
  contextLabel?: string
  open: boolean
  setOpen: (open: boolean) => void
  mode: CommentMode
  setMode: (mode: CommentMode) => void
  selectedId: string | null
  select: (id: string | null) => void
  draft: CommentDraft | null
  setDraft: (draft: CommentDraft | null) => void
  filter: CommentFilter
  setFilter: (filter: CommentFilter) => void
  unreadCount: number
  createThread: (body: string, at: CommentDraft) => CommentThread
  reply: (threadId: string, body: string) => void
  setResolved: (threadId: string, resolved: boolean) => void
  setUnread: (threadId: string, unread: boolean) => void
  removeThread: (threadId: string) => void
}

export const CommentsContext = React.createContext<CommentsContextValue | null>(null)

/** El estado compartido entre el botón, la capa de pins y el panel. */
export function useComments(): CommentsContextValue {
  const value = React.useContext(CommentsContext)
  if (!value) throw new Error("useComments se usa dentro de <CommentsProvider>.")
  return value
}
