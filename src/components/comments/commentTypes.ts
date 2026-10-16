/**
 * El modelo de los comentarios sobre una pantalla, al estilo de Figma: cada
 * hilo es un pin clavado en un punto de la superficie y una conversación.
 *
 * La posición va en porcentaje del contenedor (`CommentLayer`), no en píxeles:
 * así el pin sigue en su sitio aunque la ventana cambie de ancho.
 */

export interface CommentAuthor {
  id: string
  name: string
  avatarUrl?: string
}

export interface CommentMessage {
  id: string
  author: CommentAuthor
  body: string
  /** Fecha ISO 8601. */
  createdAt: string
}

export interface CommentThread {
  id: string
  /** Horizontal, de 0 a 100, en porcentaje del ancho de la capa. */
  x: number
  /** Vertical, de 0 a 100, en porcentaje del alto de la capa. */
  y: number
  /**
   * En qué vista se dejó (p. ej. `"tablet"` o `"monitor"`). La capa solo
   * pinta los pins de la vista activa; el panel los lista todos.
   */
  context?: string
  /** El nombre legible de esa vista, para la lista del panel. */
  contextLabel?: string
  resolved: boolean
  /** Hay algo en el hilo que la persona actual todavía no ha visto. */
  unread: boolean
  /** El primero es el comentario que abre el hilo; el resto, respuestas. */
  messages: CommentMessage[]
}

export type CommentStatusFilter = "open" | "resolved" | "all"
export type CommentReadFilter = "all" | "unread" | "read"

export interface CommentFilter {
  status: CommentStatusFilter
  read: CommentReadFilter
}

export const DEFAULT_COMMENT_FILTER: CommentFilter = { status: "open", read: "all" }

/** Los hilos que pasan el filtro, del más reciente al más antiguo. */
export function filterThreads(threads: readonly CommentThread[], filter: CommentFilter): CommentThread[] {
  return threads
    .filter((thread) => {
      if (filter.status === "open" && thread.resolved) return false
      if (filter.status === "resolved" && !thread.resolved) return false
      if (filter.read === "unread" && !thread.unread) return false
      if (filter.read === "read" && thread.unread) return false
      return true
    })
    .sort((a, b) => lastActivity(b) - lastActivity(a))
}

export function lastActivity(thread: CommentThread): number {
  const last = thread.messages[thread.messages.length - 1]
  return last ? new Date(last.createdAt).getTime() : 0
}

/** Las iniciales de un nombre, para el avatar de respaldo. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

/** Los textos de la familia. Vienen en español; cada app puede reemplazarlos. */
export interface CommentLabels {
  title: string
  toggle: string
  comment: string
  commenting: string
  close: string
  back: string
  placeholder: string
  replyPlaceholder: string
  send: string
  cancel: string
  resolve: string
  reopen: string
  markRead: string
  markUnread: string
  remove: string
  more: string
  statusOpen: string
  statusResolved: string
  statusAll: string
  readAll: string
  readUnread: string
  readRead: string
  readFilter: string
  statusFilter: string
  emptyTitle: string
  emptyDescription: string
  hint: string
  exit: string
  resolved: string
  replies: (count: number) => string
  unreadCount: (count: number) => string
}

export const DEFAULT_COMMENT_LABELS: CommentLabels = {
  title: "Comentarios",
  toggle: "Comentarios",
  comment: "Comentar",
  commenting: "Comentando",
  close: "Cerrar comentarios",
  back: "Volver a la lista",
  placeholder: "Escribe un comentario…",
  replyPlaceholder: "Responder…",
  send: "Enviar",
  cancel: "Cancelar",
  resolve: "Resolver",
  reopen: "Reabrir",
  markRead: "Marcar como leído",
  markUnread: "Marcar como no leído",
  remove: "Eliminar hilo",
  more: "Más acciones",
  statusOpen: "Pendientes",
  statusResolved: "Resueltos",
  statusAll: "Todos",
  readAll: "Leídos y no leídos",
  readUnread: "Solo no leídos",
  readRead: "Solo leídos",
  readFilter: "Lectura",
  statusFilter: "Estado de los comentarios",
  emptyTitle: "Sin comentarios aquí",
  emptyDescription: "Pulsa «Comentar» (o la tecla C) y haz clic en cualquier punto de la pantalla.",
  hint: "Haz clic donde quieras comentar",
  exit: "Navegar",
  resolved: "Resuelto",
  replies: (count) => (count === 1 ? "1 respuesta" : `${count} respuestas`),
  unreadCount: (count) => (count === 1 ? "1 sin leer" : `${count} sin leer`),
}
