/**
 * Las maneras de reservar que se pueden ver en la vista previa. No son
 * pieles: cada una parte de una pregunta distinta.
 * - `guided` (Paso a paso): «¿quién eres?» y una decisión por pantalla.
 * - `agenda-select` (Agenda con selector): «¿cuándo puedes venir?»; sede, servicios
 *   y barbero se eligen en campos que abren su lista, y quién eres al final.
 * - `agenda-list` (Agenda en lista): la misma Agenda con selector, con las preguntas en filas y, en
 *   tablet y monitor, cada lista abierta en su sitio (con buscador) en vez de en una hoja o un modal.
 * - `chat` (Conversación): «dime qué necesitas»; se reserva hablando con el asistente.
 */
export type BookingVersion = "guided" | "agenda-select" | "agenda-list" | "chat";
export const BOOKING_VERSIONS: readonly BookingVersion[] = ["guided", "agenda-select", "agenda-list", "chat"];

export const isBookingVersion = (value: string | null): value is BookingVersion => value !== null && (BOOKING_VERSIONS as readonly string[]).includes(value);
