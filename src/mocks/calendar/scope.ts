import { db } from "../db";
import { agendaBarbers, isOwnClient } from "../customers/handlers";
import { isBarber, sessionOf } from "../session";
import type { MockAppointment, MockClient, MockTimeBlock } from "./seed";

/**
 * La agenda que ve un barbero, recortada en el servidor (docs/roles/01-calendario.md y
 * docs/API_CONTRACT.md, «Permisos en el servidor»): su columna, sus citas y sus bloqueos. De los
 * clientes recibe la ficha de los suyos; del resto, solo el nombre, para poder buscarlo al agendar.
 * La pantalla recortaba esto mismo (`calendarAccess.ts`); ahora no depende de ella.
 */

/** La ficha del barbero que llama, o `null` si no es barbero (dueño, administrador, recepción). */
export function barberOf(request: Request): string | null {
  const session = sessionOf(request);
  return session && isBarber(session) ? session.memberId : null;
}

/**
 * Los clientes que son suyos, con la misma regla que Clientes (`isOwnClient`): lo prefiere, o lo atendió o
 * lo tiene agendado en el último año, según la ficha o la agenda real. La agenda se lee una sola vez.
 */
export function ownClientIds(memberId: string): Set<string> {
  const agenda = agendaBarbers();
  return new Set(db.calendar.clients.filter((client) => isOwnClient(client, memberId, agenda)).map((client) => client.id));
}

/** Un cliente ajeno: el nombre y la foto para encontrarlo; sin teléfono, correo, notas de salud ni historial. */
export const redactClient = (client: MockClient): MockClient => ({ ...client, phone: "", email: null, notes: [], conduct: [], visits: 0, cancellations: 0, noShows: 0, lastVisitAt: null, preferredBarberId: null, visitEveryDays: null });

export const ownAppointments = <T extends Pick<MockAppointment, "barberId">>(items: readonly T[], memberId: string | null): T[] => (memberId ? items.filter((item) => item.barberId === memberId) : [...items]);
export const ownBlocks = (blocks: readonly MockTimeBlock[], memberId: string | null): MockTimeBlock[] => (memberId ? blocks.filter((block) => block.barberId === memberId) : [...blocks]);
