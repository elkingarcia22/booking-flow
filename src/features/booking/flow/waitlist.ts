import type { AppMessageKey } from "@/app/i18n/types";
import type { WaitlistWindow } from "../types";

/** El nombre de cada franja de la lista de espera, para la tarjeta y su confirmación. */
export const WINDOW_KEYS: Record<WaitlistWindow, AppMessageKey> = {
  morning: "booking.waitlist.morning",
  afternoon: "booking.waitlist.afternoon",
  evening: "booking.waitlist.evening",
  any: "booking.waitlist.any",
};
