import * as React from "react";

/**
 * Qué cuenta cada tarjeta de la agenda. Como la densidad, es una preferencia
 * de la persona y no de la pantalla: la recepcionista que cobra quiere ver el
 * precio; el barbero, el servicio y si el cliente trae una nota. Vive fuera de
 * React y se guarda para sobrevivir a una recarga.
 *
 * Las alergias no se pueden apagar: avisan siempre con su icono de alerta.
 */
export interface CalendarCardPrefs {
  /** La etiqueta del tipo de cliente (Nuevo, Frecuente, VIP…). */
  clientType: boolean;
  service: boolean;
  price: boolean;
  time: boolean;
  /** La píldora de en qué va: en espera, en silla, cobrada… */
  status: boolean;
  /** El botón del siguiente paso: Check-in, Sentar, Cobrar. */
  nextStep: boolean;
  /** Icono si el cliente tiene notas en su ficha o la cita trae una. */
  notes: boolean;
  /** Icono si pidió a este barbero. */
  requested: boolean;
  /** Icono de reserva online o de llegada sin cita. */
  origin: boolean;
  /** Icono si la cita se repite. */
  repeat: boolean;
  /** Icono de primera visita. */
  firstVisit: boolean;
  /**
   * El estilo del color cuando las tarjetas se tiñen: pastel (suave, por defecto) o vivo
   * —más color, una barra a la izquierda y el texto en el mismo tono—.
   */
  vivid: boolean;
}

export type CalendarCardPref = keyof CalendarCardPrefs;

export const DEFAULT_CARD_PREFS: CalendarCardPrefs = {
  clientType: true,
  service: true,
  price: true,
  time: true,
  status: true,
  nextStep: true,
  notes: true,
  requested: true,
  origin: false,
  repeat: false,
  firstVisit: false,
  vivid: false,
};

const STORAGE_KEY = "thema.calendar.card.v1";

function read(): CalendarCardPrefs {
  if (typeof window === "undefined") return DEFAULT_CARD_PREFS;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Record<string, unknown>> | null;
    if (!stored || typeof stored !== "object") return DEFAULT_CARD_PREFS;
    // Solo se toman claves conocidas y booleanas: lo demás vuelve a su valor por defecto.
    const entries = (Object.keys(DEFAULT_CARD_PREFS) as CalendarCardPref[]).map((key) => [key, typeof stored[key] === "boolean" ? stored[key] : DEFAULT_CARD_PREFS[key]]);
    return Object.fromEntries(entries) as CalendarCardPrefs;
  } catch {
    return DEFAULT_CARD_PREFS;
  }
}

let prefs = read();
const listeners = new Set<() => void>();

function write(next: CalendarCardPrefs): void {
  prefs = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Almacenamiento bloqueado: la sesión sigue, solo que sin recordarlo.
  }
  listeners.forEach((listener) => listener());
}

export const setCalendarCardPref = (key: CalendarCardPref, value: boolean): void => {
  if (prefs[key] !== value) write({ ...prefs, [key]: value });
};

export const resetCalendarCardPrefs = (): void => write(DEFAULT_CARD_PREFS);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Las preferencias de la tarjeta y cómo cambiarlas; cualquier pantalla que las use se entera. */
export function useCalendarCardPrefs(): [CalendarCardPrefs, (key: CalendarCardPref, value: boolean) => void, () => void] {
  const value = React.useSyncExternalStore(subscribe, () => prefs, () => DEFAULT_CARD_PREFS);
  return [value, setCalendarCardPref, resetCalendarCardPrefs];
}
