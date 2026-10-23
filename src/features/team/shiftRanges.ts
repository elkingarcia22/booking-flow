/**
 * Los turnos partidos (docs/API_CONTRACT.md, «Equipo › Horario»): un día de trabajo es una franja de entrada a salida
 * con descansos dentro (el almuerzo, la pausa de la tarde). La agenda, la reserva y las horas de la semana lo ven como
 * varias franjas. Sin dependencias: lo usan la pantalla y el servidor.
 */

export interface Clock {
  start: string;
  end: string;
}

export interface ShiftDay extends Clock {
  /** Los descansos del día, dentro de la franja; sin ellos, se trabaja de corrido. */
  breaks?: readonly Clock[];
}

/** Cuántos descansos admite un día. */
export const MAX_BREAKS = 3;

const minutes = (clock: string): number => {
  const [hours, mins] = clock.split(":").map(Number);
  return hours * 60 + (mins || 0);
};

/** Las franjas de trabajo del día: la de entrada a salida menos los descansos, en orden. */
export function rangesOf(day: ShiftDay): Clock[] {
  const breaks = [...(day.breaks ?? [])].filter((item) => minutes(item.end) > minutes(item.start)).sort((a, b) => minutes(a.start) - minutes(b.start));
  const ranges: Clock[] = [];
  let cursor = day.start;
  for (const pause of breaks) {
    if (minutes(pause.start) > minutes(cursor)) ranges.push({ start: cursor, end: pause.start });
    if (minutes(pause.end) > minutes(cursor)) cursor = pause.end;
  }
  if (minutes(day.end) > minutes(cursor)) ranges.push({ start: cursor, end: day.end });
  return ranges;
}

/** Los minutos que se trabajan ese día (sin los descansos). */
export const workedMinutes = (day: ShiftDay): number => rangesOf(day).reduce((sum, range) => sum + minutes(range.end) - minutes(range.start), 0);

/** Si los descansos son válidos: dentro de la franja, con fin después del inicio y sin pisarse entre sí. */
export function validBreaks(day: ShiftDay): boolean {
  const breaks = [...(day.breaks ?? [])].sort((a, b) => minutes(a.start) - minutes(b.start));
  if (breaks.length > MAX_BREAKS) return false;
  let last = minutes(day.start);
  for (const pause of breaks) {
    if (minutes(pause.start) <= last || minutes(pause.end) <= minutes(pause.start) || minutes(pause.end) >= minutes(day.end)) return false;
    last = minutes(pause.end);
  }
  return true;
}
