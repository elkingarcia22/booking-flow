import type { CommentAuthor, CommentThread } from "@/components/comments";

/** Quien comenta en la demo. */
export const BOOKING_REVIEWER: CommentAuthor = { id: "me", name: "Tú" };

/**
 * Comentarios iniciales sobre la reserva online (vacíos por defecto).
 */
export function bookingCommentsSeed(): CommentThread[] {
  return [];
}
