/**
 * Las maneras de reservar que se pueden ver en la vista previa. No son
 * pieles: cada una parte de una pregunta distinta.
 * - `guided` (Paso a paso): «¿quién eres?» y una decisión por pantalla.
 * - `agenda-list` (Agenda en lista): «¿cuándo puedes venir?»; sede, servicios y barbero se
 *   eligen en filas, de a una, y quién eres al final. En tablet y monitor cada lista se abre en su
 *   sitio (con buscador) en vez de en una hoja o un modal.
 * - `mixed` (Según el cliente): la portada decide. El cliente nuevo va Paso a paso; el que vuelve,
 *   a la Agenda en lista. Los dos cierran con «Confirma tu cita» y el pago de la Agenda.
 * - `chat` (Conversación): «dime qué necesitas»; se reserva hablando con el asistente.
 */
export type BookingVersion = "guided" | "agenda-list" | "mixed" | "chat";
export const BOOKING_VERSIONS: readonly BookingVersion[] = ["guided", "agenda-list", "mixed", "chat"];

export const isBookingVersion = (value: string | null): value is BookingVersion => value !== null && (BOOKING_VERSIONS as readonly string[]).includes(value);

/** Las que se ofrecen hoy. «Paso a paso» y «Agenda en lista» siguen existiendo (la mixta las usa), pero no se eligen aparte. */
export const HIDDEN_BOOKING_VERSIONS: readonly BookingVersion[] = ["guided", "agenda-list"];
export const DEFAULT_BOOKING_VERSION: BookingVersion = "mixed";
export const isOfferedBookingVersion = (value: string | null): value is BookingVersion => isBookingVersion(value) && !HIDDEN_BOOKING_VERSIONS.includes(value);
