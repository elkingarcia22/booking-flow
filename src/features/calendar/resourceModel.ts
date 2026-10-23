import { formatClock } from "@/components/scheduling";
import { findClient, isActive, serviceSlots, type ModelContext } from "./calendarModel";
import type { Appointment, CalendarCatalog } from "./types";

/**
 * Los recursos especiales en la agenda (un sillón de lavado, el vaporizador…):
 * qué citas del día los ocupan y cuándo se piden más de los que hay. Un
 * recurso se ocupa solo durante el tramo de su servicio, no toda la cita.
 * Sin interfaz, para el filtro de la agenda y las pruebas.
 */

/** Lo que la agenda necesita de un recurso (el de Servicios trae más). */
export interface AgendaResource {
  id: string;
  name: string;
  units: number;
  serviceIds: readonly string[];
}

/** Lo que hace falta de una cita para saber qué recurso ocupa y cuándo (sirve también para una que aún no existe). */
export type ResourceCandidate = Pick<Appointment, "id" | "serviceIds" | "barberId" | "durationMin" | "start" | "status">;

/** Del catálogo solo hacen falta los servicios (su duración) y los barberos. */
export type ResourceCatalog = Pick<CalendarCatalog, "services" | "barbers">;

export interface ResourceUse<T extends ResourceCandidate = Appointment> {
  appointment: T;
  start: Date;
  end: Date;
}

/** Un momento en que se piden más unidades de las que hay. */
export interface ResourceClash {
  start: Date;
  end: Date;
  appointmentIds: string[];
}

export interface ResourceDay {
  uses: ResourceUse[];
  clashes: ResourceClash[];
}

/** Los tramos de las citas vivas del día que ocupan el recurso, por hora. */
export function resourceUses<T extends ResourceCandidate>(resource: AgendaResource, appointments: readonly T[], catalog: ResourceCatalog): ResourceUse<T>[] {
  return appointments
    .filter(isActive)
    .flatMap((appointment) =>
      serviceSlots(catalog, appointment)
        .filter((slot) => resource.serviceIds.includes(slot.service.id))
        .map((slot) => ({ appointment, start: slot.start, end: slot.end }))
    )
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Cuándo el recurso no da abasto: en cada comienzo de un tramo se cuenta
 * cuántos están en curso; con más que las unidades hay choque. Los choques
 * con las mismas citas se cuentan una vez.
 */
export function resourceClashes(resource: AgendaResource, uses: readonly ResourceUse<ResourceCandidate>[]): ResourceClash[] {
  const clashes = new Map<string, ResourceClash>();
  for (const use of uses) {
    const at = use.start.getTime();
    const running = uses.filter((other) => other.start.getTime() <= at && at < other.end.getTime());
    if (running.length <= resource.units) continue;
    const ids = [...new Set(running.map((item) => item.appointment.id))].sort();
    const key = ids.join(",");
    const end = new Date(Math.min(...running.map((item) => item.end.getTime())));
    if (!clashes.has(key)) clashes.set(key, { start: use.start, end, appointmentIds: ids });
  }
  return [...clashes.values()];
}

export function resourceDay(resource: AgendaResource, appointments: readonly Appointment[], catalog: ResourceCatalog): ResourceDay {
  const uses = resourceUses(resource, appointments, catalog);
  return { uses, clashes: resourceClashes(resource, uses) };
}

/** Un recurso que una cita no puede usar a esa hora: ya lo ocupan tantas citas como unidades hay. */
export interface ResourceConflict<T extends ResourceCandidate = Appointment> {
  resource: AgendaResource;
  /** Las citas que ya lo ocupan en ese momento. */
  with: T[];
  /** Cuándo empieza el choque. */
  at: Date;
}

/**
 * Si una cita (nueva o movida) pide un recurso que a esa hora ya está
 * completo. Se mira cada tramo suyo que usa un recurso, en su comienzo y en
 * cada momento en que empieza otro uso dentro de él. La cita misma no cuenta
 * contra sí (se excluye por id); una cancelada no ocupa nada.
 */
export function resourceConflict<T extends ResourceCandidate>(resources: readonly AgendaResource[], appointments: readonly T[], catalog: ResourceCatalog, candidate: ResourceCandidate): ResourceConflict<T> | null {
  if (!isActive(candidate)) return null;
  const others = appointments.filter((item) => item.id !== candidate.id);
  for (const resource of resources) {
    const mine = resourceUses(resource, [candidate], catalog);
    if (mine.length === 0) continue;
    const theirs = resourceUses(resource, others, catalog);
    for (const use of mine) {
      const from = use.start.getTime();
      const to = use.end.getTime();
      const moments = [from, ...theirs.map((other) => other.start.getTime()).filter((at) => at > from && at < to)];
      for (const at of moments) {
        const running = theirs.filter((other) => other.start.getTime() <= at && at < other.end.getTime());
        if (running.length >= resource.units) return { resource, with: [...new Map(running.map((item) => [item.appointment.id, item.appointment])).values()], at: new Date(at) };
      }
    }
  }
  return null;
}

/** El choque en una frase, como los demás de la agenda: qué recurso, a qué hora y quién lo ocupa. */
export function resourceReason(conflict: ResourceConflict | null, ctx: Pick<ModelContext, "t" | "catalog" | "intl">): string | null {
  if (!conflict) return null;
  const names = conflict.with.map((item) => findClient(ctx.catalog, item.clientId)?.name.split(" ")[0] ?? "").filter(Boolean);
  return ctx.t("calendar.clash.resource", { resource: conflict.resource.name, time: formatClock(conflict.at, ctx.intl), names: names.join(", ") });
}

/** Si el filtro de servicios ya es exactamente el de un recurso (o lo contiene entero). */
export const resourceSelected = (resource: Pick<AgendaResource, "serviceIds">, serviceIds: readonly string[]): boolean =>
  resource.serviceIds.length > 0 && resource.serviceIds.every((id) => serviceIds.includes(id));

/** Marcar un recurso suma sus servicios al filtro; desmarcarlo los quita. */
export function toggleResource(resource: Pick<AgendaResource, "serviceIds">, serviceIds: readonly string[]): string[] {
  if (resourceSelected(resource, serviceIds)) return serviceIds.filter((id) => !resource.serviceIds.includes(id));
  return [...new Set([...serviceIds, ...resource.serviceIds])];
}
