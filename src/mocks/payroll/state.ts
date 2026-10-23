/**
 * Lo que la nómina guarda. Calcular no se guarda —se recalcula sobre las citas cobradas—, pero
 * pagar sí: al aprobar un periodo queda una foto fija que ya no cambia aunque se edite una cita o
 * una regla. Los ajustes (bono, descuento, adelanto) son del periodo abierto y entran en esa foto.
 */

/** El bono suma; el descuento, el adelanto y el faltante de caja restan. */
export type MockAdjustmentKind = "bonus" | "deduction" | "advance" | "shortage";

export interface MockPayrollAdjustment {
  id: string;
  branchId: string;
  /** El periodo al que pertenece (AAAA-MM-DD). */
  from: string;
  to: string;
  memberId: string;
  kind: MockAdjustmentKind;
  amount: number;
  note: string;
  createdAt: string;
  createdBy: string;
  /** Un faltante de caja cargado desde el cierre: de qué cierre sale. */
  closureId?: string | null;
}

/**
 * Un préstamo a alguien del equipo: se le entregó el dinero y se le descuenta en cuotas iguales, una por
 * ciclo de pago desde el ciclo de `startDate`. La cuota sale sola en la nómina de cada ciclo.
 */
export interface MockLoan {
  id: string;
  branchId: string;
  memberId: string;
  amount: number;
  installments: number;
  /** AAAA-MM-DD: desde el ciclo que contiene esta fecha. */
  startDate: string;
  note: string;
  createdAt: string;
  createdBy: string;
  /** Se canceló (lo pagó de una vez o se perdonó): desde ese día no salen más cuotas. */
  cancelledAt?: string | null;
}

export type MockRunStatus = "approved" | "paid";

export interface MockPayrollRun {
  id: string;
  branchId: string;
  from: string;
  to: string;
  status: MockRunStatus;
  approvedAt: string;
  approvedBy: string;
  paidAt: string | null;
  paidBy: string | null;
  /** Cómo se pagó: efectivo, transferencia, Nequi… */
  method: string | null;
  reference: string | null;
  weeks: number;
  /** La nómina tal como quedó al aprobar. */
  members: unknown[];
}

export interface MockPayrollHistoryEntry {
  id: string;
  branchId: string;
  from: string;
  to: string;
  at: string;
  actor: string;
  event: "approved" | "paid" | "reopened";
  reason: string | null;
}

/** Un pago de renta de un barbero de renta: cuándo, cuánto y con qué. Se cuenta en el periodo de su fecha. */
export interface MockRentPayment {
  id: string;
  branchId: string;
  memberId: string;
  amount: number;
  method: string;
  /** AAAA-MM-DD. */
  date: string;
  note: string;
  by: string;
}

/** «Esto no cuadra»: un barbero reclama su pago de un periodo (o de una cita) y quien gestiona responde. */
export interface MockPayDispute {
  id: string;
  branchId: string;
  memberId: string;
  memberName: string;
  from: string;
  to: string;
  appointmentId: string | null;
  /** «Carlos R. · Corte»: para leerlo sin abrir la cita. */
  appointmentLabel: string | null;
  /** Cuándo fue la cita (su inicio). */
  appointmentAt?: string | null;
  message: string;
  createdAt: string;
  status: "open" | "answered";
  answer: string | null;
  answeredBy: string | null;
  answeredAt: string | null;
}

/** La meta de un barbero por ciclo de pago: la pone quien gestiona; `null` en lo que no se mide. */
export interface MockMemberGoal {
  branchId: string;
  memberId: string;
  serviceSales: number | null;
  productSales: number | null;
  /** % de clientes que dejan la siguiente cita en la semana. */
  rebookRate: number | null;
  setBy: string;
  setAt: string;
}

export interface MockPayrollState {
  runs: MockPayrollRun[];
  adjustments: MockPayrollAdjustment[];
  history: MockPayrollHistoryEntry[];
  rentPayments: MockRentPayment[];
  loans?: MockLoan[];
  disputes?: MockPayDispute[];
  memberGoals?: MockMemberGoal[];
}

export const emptyPayroll = (): MockPayrollState => ({ runs: [], adjustments: [], history: [], rentPayments: [], loans: [], disputes: [], memberGoals: [] });
