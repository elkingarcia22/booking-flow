import type { DraftItem } from "../../bookingState";
import type { BookingBarber, BookingService, Slot } from "../../types";

/**
 * Las cuentas de la agenda, sin interfaz: qué horas tiene cada barbero
 * el día que se mira, cómo se reparten en mañana, tarde y noche y cuántos
 * quedan libres a cada hora descontando lo que ya va en el carrito.
 */

export type DayWindow = "morning" | "afternoon" | "evening";
export const DAY_WINDOWS: readonly DayWindow[] = ["morning", "afternoon", "evening"];

/** Desde aquí es tarde y desde aquí noche (las mismas fronteras que el selector de horas). */
const AFTERNOON_FROM = 12 * 60;
const EVENING_FROM = 18 * 60;

const minutesOf = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};

export function windowOf(time: string): DayWindow {
  const minute = minutesOf(time);
  if (minute < AFTERNOON_FROM) return "morning";
  return minute < EVENING_FROM ? "afternoon" : "evening";
}

/** El servicio con que abre la agenda para que haya horas desde el primer momento: el más pedido que no es combo. */
export function defaultServiceId(services: readonly BookingService[]): string | null {
  const popular = services.find((service) => service.popular && !service.isCombo) ?? services.find((service) => service.popular);
  return (popular ?? services[0])?.id ?? null;
}

/** Quienes hacen todo lo elegido, con el de la última visita primero y luego por nota. */
export function ableBarbers(barbers: readonly BookingBarber[], serviceIds: readonly string[], firstId: string | null): BookingBarber[] {
  return barbers
    .filter((barber) => serviceIds.every((id) => barber.prices[id] !== undefined))
    .sort((a, b) => Number(b.id === firstId) - Number(a.id === firstId) || b.rating - a.rating);
}

/** Las citas del carrito que caen ese día a esa hora (la que se está cambiando no cuenta). */
function cartAt(items: readonly DraftItem[], day: string, time: string, skipIndex: number | null): DraftItem[] {
  return items.filter((item, index) => index !== skipIndex && item.start === `${day}T${time}`);
}

export interface TimeOption {
  time: string;
  /** Quiénes pueden a esa hora, ya sin los que tiene apartados el carrito. */
  barberIds: string[];
  /** Ya apartó esa hora sin preferencia de barbero. */
  taken: boolean;
}

/**
 * Las horas del día sin mirar quién atiende, por franja. Cada cita del carrito a
 * esa hora ocupa a un barbero: si ya no queda ninguno libre, la hora sale.
 */
export function timesByWindow(slots: readonly Slot[], day: string, items: readonly DraftItem[], skipIndex: number | null): { window: DayWindow; options: TimeOption[] }[] {
  const options = slots
    .map((slot) => {
      const booked = cartAt(items, day, slot.time, skipIndex);
      const pinned = new Set(booked.map((item) => item.barberId).filter((id): id is string => id !== null));
      const loose = booked.filter((item) => item.barberId === null).length;
      const free = slot.barberIds.filter((id) => !pinned.has(id));
      return { time: slot.time, barberIds: free.slice(0, Math.max(0, free.length - loose)), taken: loose > 0 };
    })
    .filter((option) => option.barberIds.length > 0 || option.taken);
  return DAY_WINDOWS.map((window) => ({ window, options: options.filter((option) => windowOf(option.time) === window) })).filter((group) => group.options.length > 0);
}
