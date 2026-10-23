import type { LastVisit } from "./types";

/**
 * El enlace para que el cliente reagende él mismo: la barbería se lo manda
 * desde la agenda (por SMS o correo) con lo de su última cita —servicios,
 * barbero y sucursal— y, al identificarse en la reserva en línea, cae directo
 * en elegir la hora; luego paga como en cualquier reserva.
 *
 * `/reservar?reagendar=1&servicios=svc_a,svc_b&barbero=team-04&sucursal=ma`
 */

export interface RebookPrefill {
  branchId: string;
  serviceIds: string[];
  barberId: string | null;
}

const ID = /^[\w-]{1,64}$/;

export function buildRebookLink(origin: string, prefill: RebookPrefill): string {
  const params = new URLSearchParams({ reagendar: "1", servicios: prefill.serviceIds.join(","), sucursal: prefill.branchId });
  if (prefill.barberId) params.set("barbero", prefill.barberId);
  return `${origin}/reservar?${params.toString()}`;
}

/** Lo que trae el enlace, si es uno de reagendar bien formado; si no, `null`. */
export function readRebookLink(search: string): RebookPrefill | null {
  const params = new URLSearchParams(search);
  if (params.get("reagendar") !== "1") return null;
  const serviceIds = (params.get("servicios") ?? "").split(",").filter((id) => ID.test(id));
  const branchId = params.get("sucursal") ?? "";
  const barberId = params.get("barbero");
  if (serviceIds.length === 0 || !ID.test(branchId)) return null;
  return { branchId, serviceIds, barberId: barberId && ID.test(barberId) ? barberId : null };
}

/** Como «repetir la última visita» de la reserva: lleva a elegir la hora con esto ya puesto. */
export const prefillAsLastVisit = (prefill: RebookPrefill): LastVisit => ({ ...prefill, at: new Date().toISOString() });
