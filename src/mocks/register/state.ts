/**
 * Un cierre de caja: lo que se contó frente a lo que debía haber. Un día puede tener varios turnos: cada cierre de
 * turno cuenta lo que entró desde el anterior y el último (`final`) cierra el día.
 */
export interface MockRegisterClosure {
  id: string;
  branchId: string;
  /** AAAA-MM-DD. */
  date: string;
  /** Con cuánto efectivo abrió la caja. */
  opening: number;
  /** El efectivo que entró en el día según las cuentas (cobros, ventas, devoluciones). */
  expectedCash: number;
  /** El efectivo que se contó al cerrar. */
  counted: number;
  /** Contado − (base + esperado): positivo sobra, negativo falta. */
  difference: number;
  note: string;
  closedAt: string;
  closedBy: string;
  /** Lo contado por denominación («20» → 3 billetes), si se contó así. */
  denominations?: Record<string, number> | null;
  /** Se contó sin ver lo esperado (recepción): la diferencia la revisa gerencia. */
  blind?: boolean;
  /** El turno del día (1, 2…); sin él, un cierre de antes de los turnos (el único del día). */
  shift?: number;
  /** Desde cuándo cuenta (el cierre del turno anterior); `null` = desde el inicio del día. */
  from?: string | null;
  /** Si cierra el día; un cierre de turno deja la caja abierta para el siguiente. Sin el campo, cierra el día. */
  final?: boolean;
  /** A quién se le descontó el faltante en la nómina (y el ajuste que lo hace). */
  shortage?: { memberId: string; adjustmentId: string; by: string; at: string } | null;
}

/** Efectivo que entra o sale del cajón durante el día sin ser un cobro: sencillo, un pago a un proveedor, un retiro. */
export interface MockCashMovement {
  id: string;
  branchId: string;
  date: string;
  type: "in" | "out";
  amount: number;
  reason: string;
  at: string;
  by: string;
  /** Una salida que es un gasto (caja menor): el gasto que se registró con ella. */
  expenseId?: string | null;
}

export interface MockRegisterState {
  closures: MockRegisterClosure[];
  movements?: MockCashMovement[];
}

export const emptyRegister = (): MockRegisterState => ({ closures: [], movements: [] });
