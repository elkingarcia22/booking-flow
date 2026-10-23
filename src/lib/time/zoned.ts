/**
 * La hora de la sede. Las citas se guardan como hora local de la sucursal sin zona («2026-10-20T10:30:00»);
 * para saber si ya pasó, cuándo sale un recordatorio o cómo la ve un cliente en otra zona hay que pasar
 * de esa hora local a un instante real, con la zona de la sucursal (`America/New_York`, `America/Bogota`…).
 * Sin dependencias: lo usan el backend simulado, la reserva y el servidor.
 */

const pad = (value: number): string => String(value).padStart(2, "0");

/** La hora de pared en esa zona para un instante: «AAAA-MM-DDTHH:mm». */
export function wallClock(timeZone: string, at: Date = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at)
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Cuántos minutos le lleva esa zona a UTC en ese instante (Nueva York en verano: −240). */
export function offsetMinutes(timeZone: string, at: Date): number {
  const local = wallClock(timeZone, at);
  const asUtc = Date.UTC(Number(local.slice(0, 4)), Number(local.slice(5, 7)) - 1, Number(local.slice(8, 10)), Number(local.slice(11, 13)), Number(local.slice(14, 16)));
  return Math.round((asUtc - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}

/** El instante real de una hora local de la sede («2026-10-20T10:30»), con el cambio de horario resuelto. */
export function instantOf(localIso: string, timeZone: string): Date {
  const guess = Date.UTC(Number(localIso.slice(0, 4)), Number(localIso.slice(5, 7)) - 1, Number(localIso.slice(8, 10)), Number(localIso.slice(11, 13) || 0), Number(localIso.slice(14, 16) || 0));
  const first = guess - offsetMinutes(timeZone, new Date(guess)) * 60_000;
  // Cerca del cambio de horario el primer cálculo puede caer del otro lado: se corrige con el offset de ese instante.
  return new Date(guess - offsetMinutes(timeZone, new Date(first)) * 60_000);
}

/** «−04:00», para los formatos que piden la hora con su desfase (Outlook). */
export function offsetLabel(timeZone: string, at: Date): string {
  const minutes = offsetMinutes(timeZone, at);
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Si la zona existe para el navegador o el servidor. */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
