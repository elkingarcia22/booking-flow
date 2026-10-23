import type { CommentThread } from "@/components/comments";

/**
 * La reserva en línea y la plataforma guardan sus comentarios en la misma hoja. Los de la plataforma
 * llevan la vista `app:<ruta>`; los de la reserva, su versión y dispositivo («mixed:tablet»).
 */
export const PLATFORM_CONTEXT_PREFIX = "app:";

export const platformContextOf = (route: string): string => `${PLATFORM_CONTEXT_PREFIX}${route}`;

export const isPlatformThread = (thread: CommentThread): boolean => thread.context?.startsWith(PLATFORM_CONTEXT_PREFIX) ?? false;

export const isBookingThread = (thread: CommentThread): boolean => !isPlatformThread(thread);
