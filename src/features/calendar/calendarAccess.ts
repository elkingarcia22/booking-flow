import type { Access } from "@/features/access";
import type { CalendarCatalog, CalendarDay, TimeBlock, WaitlistEntry } from "./types";

/**
 * Lo que el rol deja hacer en el calendario, decidido una vez desde
 * `useAccess()` y repartido por el `ModelContext` a la rejilla, los paneles y
 * el clic derecho. Así ninguna pieza pregunta por el rol a mano y todas
 * ofrecen lo mismo. El detalle por acción está en docs/roles/01-calendario.md.
 */
export interface CalendarAccess {
  /** Con alcance propio (los barberos), el id de su columna: todo se recorta a ella. */
  ownBarberId: string | null;
  /** Pisar otra cita, agendar fuera de horario o mover a la columna de otro. Los barberos nunca. */
  canForce: boolean;
  /** Ofrecer llamar o escribir (SMS o correo) al cliente («Información del cliente» activa). */
  canContact: boolean;
  /** Las cifras agregadas del día (cobrado de previsto, total de la lista, «por vender»). */
  showTotals: boolean;
  canCreateBlock: boolean;
  canRemoveBlocks: boolean;
  /** Ver la ficha del barbero y sus horarios (fila Equipo). */
  canViewTeam: boolean;
  /**
   * Con la cita ya en la barbería, el barbero, la hora y el cliente quedan con candado. Solo para el
   * barbero de comisión: dueño, administrador, recepción y barbero de renta cambian la cita en
   * cualquier estado.
   */
  locksAfterCheckIn: boolean;
  /** Bloquear al cliente o pedirle pago en línea desde la agenda (tras un «No asistió» o una cancelada). */
  canRestrictClients: boolean;
  /** Cambiar el precio de un servicio o producto al cobrar. El barbero de comisión cobra a precio de lista. */
  canEditPrices: boolean;
  /** Borrar una venta hecha por error (la cita vuelve a «en silla» sin pago): dueño y administrador. */
  canVoidSales: boolean;
  /** Aprobar o rechazar ausencias y bloqueos: dueño, administrador y recepción (no los barberos). */
  canDecideTimeOff: boolean;
  /** Registrar la ausencia de cualquiera, ya aprobada: dueño y administrador. */
  canManageTimeOff: boolean;
}

/** Fuera del layout (la doc, las pruebas de piezas sueltas) el calendario se ve entero, como el dueño. */
export const FULL_CALENDAR_ACCESS: CalendarAccess = {
  ownBarberId: null,
  canForce: true,
  canContact: true,
  showTotals: true,
  canCreateBlock: true,
  canRemoveBlocks: true,
  canViewTeam: true,
  locksAfterCheckIn: false,
  canRestrictClients: true,
  canEditPrices: true,
  canVoidSales: true,
  canDecideTimeOff: true,
  canManageTimeOff: true,
};

/**
 * Quién agenda con las reglas de la casa: los barberos (comisión y renta) no
 * pisan citas ni se salen de la jornada; dueño, administrador y recepción sí,
 * porque son quienes arreglan el día cuando hace falta.
 */
export const followsAgendaRules = (access: Pick<Access, "isBarber">): boolean => access.isBarber;

export function calendarAccess(access: Access): CalendarAccess {
  const own = access.scope === "own" ? (access.member?.id ?? null) : null;
  return {
    ownBarberId: own,
    canForce: !followsAgendaRules(access),
    canContact: access.can("client-info", "active"),
    // Recepción cobra cita a cita pero no lleva los números del negocio; el barbero ve los suyos (ya recortados).
    showTotals: access.isBarber || access.can("kpis", "active"),
    canCreateBlock: access.can("block-calendar", "create"),
    canRemoveBlocks: access.can("block-calendar", "delete"),
    canViewTeam: access.can("team"),
    locksAfterCheckIn: access.role === "barbero-comision",
    canRestrictClients: access.role !== "barbero-comision",
    canEditPrices: access.role !== "barbero-comision",
    canVoidSales: access.role === "owner" || access.role === "admin",
    canDecideTimeOff: !access.isBarber,
    canManageTimeOff: access.role === "owner" || access.role === "admin",
  };
}

/** Si se puede quitar ese bloqueo: con el permiso y, con alcance propio, solo los suyos. */
export const canRemoveBlock = (access: CalendarAccess, block: Pick<TimeBlock, "barberId">): boolean =>
  access.canRemoveBlocks && (access.ownBarberId === null || block.barberId === access.ownBarberId);

/** El catálogo con solo su columna: el alta, los bloqueos, los huecos y la Semana dejan de ofrecer a los demás. */
export function scopeCatalog<T extends CalendarCatalog>(catalog: T, ownBarberId: string | null): T {
  if (!ownBarberId) return catalog;
  return { ...catalog, barbers: catalog.barbers.filter((barber) => barber.id === ownBarberId) };
}

/** El día con solo sus citas y sus bloqueos: de ahí salen el pulso, los filtros, la Agenda y los cobros. */
export function scopeDay(day: CalendarDay, ownBarberId: string | null): CalendarDay {
  if (!ownBarberId) return day;
  return {
    ...day,
    appointments: day.appointments.filter((item) => item.barberId === ownBarberId),
    blocks: day.blocks.filter((block) => block.barberId === ownBarberId),
  };
}

/** De la lista de espera, las suyas y las de «cualquier barbero» (las puede tomar). */
export const waitlistInScope = (entry: Pick<WaitlistEntry, "barberId">, ownBarberId: string | null): boolean =>
  !ownBarberId || entry.barberId === null || entry.barberId === ownBarberId;
