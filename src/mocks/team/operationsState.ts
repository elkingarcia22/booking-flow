import type { MockCompensation, MockPayments, MockTeamRole, MockWorkingRange } from "./seed";

/**
 * Lo que guarda la operación del equipo además de las fichas: los fichajes, los pedidos de turno (cubrir uno abierto o
 * cambiarlo con alguien) y los cambios de forma de pago con fecha. Vive en `db.team`.
 */

/** Una entrada y su salida (`null` mientras sigue en turno). */
export interface MockTimeEntry {
  id: string;
  branchId: string;
  memberId: string;
  clockIn: string;
  clockOut: string | null;
  /** Quién lo marcó: la persona o quien gestiona (si lo corrigió). */
  by: string;
}

export type MockShiftRequestStatus = "pending" | "accepted" | "approved" | "rejected" | "cancelled";

/**
 * Un pedido de turno:
 * - `cover`: alguien libre ese día toma el turno de quien falta (ausencia aprobada); lo aprueba gerencia.
 * - `swap`: dos se cambian un día cada uno; acepta el compañero y aprueba gerencia.
 * Al aprobarse quedan las excepciones de horario y las citas pasan a quien trabaja.
 */
export interface MockShiftRequest {
  id: string;
  branchId: string;
  kind: "cover" | "swap";
  requesterId: string;
  requesterName: string;
  date: string;
  range: MockWorkingRange;
  /** Cubrir: de quién es el turno y su ausencia. */
  absentMemberId?: string | null;
  absenceId?: string | null;
  /** Cambio: con quién y qué día suyo. */
  withMemberId?: string | null;
  withName?: string | null;
  withDate?: string | null;
  withRange?: MockWorkingRange | null;
  status: MockShiftRequestStatus;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  reason: string | null;
}

/**
 * Un cambio de forma de pago: desde `effectiveDate` la persona pasa a `to`. `before` guarda cómo estaba, para que la
 * nómina de los periodos anteriores se siga calculando con su forma de entonces.
 */
export interface MockPayoutChange {
  id: string;
  memberId: string;
  effectiveDate: string;
  from: MockTeamRole;
  to: MockTeamRole;
  before: { role: MockTeamRole; compensation: MockCompensation | null; payments: MockPayments | null };
  after: { compensation: MockCompensation | null; payments: MockPayments | null };
  status: "scheduled" | "applied" | "cancelled";
  note: string;
  createdBy: string;
  createdAt: string;
}
