/**
 * Los gastos del backend simulado: lo que sale de caja en cada sucursal. Un
 * gasto fijo se repite con una frecuencia; uno variable pasó una vez. Las
 * fechas son relativas a hoy para que «este mes» siempre tenga algo.
 */

import { dueDatesIn } from "@/features/expenses/payables";
import type { MockExpensePayment } from "../db";

export type MockExpenseKind = "fixed" | "variable";
export type MockExpenseFrequency = "weekly" | "biweekly" | "monthly" | "quarterly" | "semiannual" | "annual";

/** Las categorías por defecto: la base del estado de resultados y de los presupuestos. */
export const EXPENSE_CATEGORY_IDS = ["rent", "utilities", "internet", "supplies", "resale", "cleaning", "maintenance", "advertising", "software", "taxes", "other"] as const;
export type MockExpenseCategory = (typeof EXPENSE_CATEGORY_IDS)[number];
export const EXPENSE_PAYMENT_METHODS = ["cash", "bank", "card", "wallet"] as const;
export type MockExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];

/** Un comprobante (foto o PDF) guardado como data URL; hasta 3 por gasto. */
export interface MockExpenseAttachment {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
}

/** Una categoría de gasto que la barbería crea (además de las de siempre): «Café para clientes», «Uniformes». */
export interface MockExpenseCustomCategory {
  id: string;
  name: string;
  createdAt: string;
}

export interface MockExpense {
  id: string;
  branchId: string;
  /** De quién es: `null` es de la sucursal; un id de equipo, de ese barbero de renta. */
  ownerMemberId: string | null;
  kind: MockExpenseKind;
  name: string;
  amount: number;
  /** Solo en los fijos. */
  frequency: MockExpenseFrequency | null;
  description: string;
  createdAt: string;
  /** AAAA-MM-DD: en un variable, cuándo se gastó; en un fijo, desde cuándo corre. Sin él, el día de `createdAt`. */
  date?: string;
  /** Un fijo terminado deja de contar desde el día siguiente. */
  endDate?: string | null;
  /** Una de las de siempre o una propia (`cat_…`, ver `MockExpenseCustomCategory`). */
  categoryId?: MockExpenseCategory | string;
  /** En los fijos: qué día del mes se paga (1–31; si el mes es más corto, el último). */
  dueDay?: number | null;
  paymentMethod?: MockExpensePaymentMethod | null;
  supplier?: string;
  /** El proveedor guardado (Gastos › Proveedores); `supplier` lleva su nombre. */
  supplierId?: string | null;
  attachments?: MockExpenseAttachment[];
  createdBy?: string | null;
  /** Salió del cajón (caja menor): el movimiento de caja que lo registró. */
  movementId?: string | null;
}

/** Un proveedor: a quién se le paga, con su identificación fiscal y su contacto. Es de la barbería (todas las sedes). */
export interface MockSupplier {
  id: string;
  name: string;
  taxId: string;
  phone: string;
  email: string;
  /** La categoría con que suelen ir sus gastos (se propone al registrar uno). */
  categoryId: string | null;
  notes: string;
  createdAt: string;
}

/** Los proveedores de la demo: los de los gastos de la semilla, con su contacto. */
export function seedSuppliers(expenses: readonly MockExpense[]): MockSupplier[] {
  const byName = new Map<string, MockExpense>();
  for (const expense of expenses) if (expense.supplier && !byName.has(expense.supplier.toLowerCase())) byName.set(expense.supplier.toLowerCase(), expense);
  return [...byName.values()].map((expense, index) => ({
    id: `sup_${index + 1}`,
    name: expense.supplier!,
    taxId: "",
    phone: "",
    email: "",
    categoryId: expense.categoryId ?? null,
    notes: "",
    createdAt: "2026-01-06T12:00:00.000Z",
  }));
}

const DAY_MS = 86_400_000;
const MID_MONTH = 15;

interface Draft {
  branchId?: string;
  ownerMemberId?: string;
  kind: MockExpenseKind;
  name: string;
  amount: number;
  frequency?: MockExpenseFrequency;
  description?: string;
  categoryId: MockExpenseCategory;
  paymentMethod?: MockExpensePaymentMethod;
  supplier?: string;
  /** Hace cuántos días se registró. */
  daysAgo?: number;
  /** O bien: a mediados de hace tantos meses, para que «el mes pasado» no dependa del día de hoy. */
  monthsAgo?: number;
}

const DRAFTS: readonly Draft[] = [
  { kind: "fixed", name: "Renta del local", categoryId: "rent", paymentMethod: "bank", supplier: "Inmobiliaria Newbury", amount: 3200, frequency: "monthly", description: "88 Newbury St. Se paga el día 1.", daysAgo: 210 },
  { kind: "fixed", name: "Servicios públicos", categoryId: "utilities", paymentMethod: "bank", supplier: "Eversource", amount: 420, frequency: "monthly", description: "Luz, agua y gas.", daysAgo: 210 },
  { kind: "fixed", name: "Limpieza", categoryId: "cleaning", paymentMethod: "cash", supplier: "Clean Pro", amount: 120, frequency: "weekly", description: "Dos visitas por semana.", daysAgo: 180 },
  { kind: "fixed", name: "Internet y teléfono", categoryId: "internet", paymentMethod: "card", supplier: "Comcast", amount: 75, frequency: "monthly", daysAgo: 200 },
  { kind: "fixed", name: "Seguro del local", categoryId: "other", paymentMethod: "bank", supplier: "Liberty Mutual", amount: 1800, frequency: "annual", description: "Póliza contra daños y responsabilidad civil.", daysAgo: 150 },
  { kind: "fixed", name: "Lavandería de toallas", categoryId: "cleaning", paymentMethod: "cash", amount: 90, frequency: "biweekly", daysAgo: 120 },
  { kind: "fixed", name: "Mantenimiento de aire acondicionado", categoryId: "maintenance", paymentMethod: "card", amount: 240, frequency: "quarterly", daysAgo: 100 },
  { kind: "variable", name: "Reparación de silla 3", categoryId: "maintenance", paymentMethod: "card", supplier: "Takara Belmont", amount: 180, description: "Cambio de la bomba hidráulica.", daysAgo: 0 },
  { kind: "variable", name: "Café e insumos de la sala", categoryId: "supplies", paymentMethod: "cash", amount: 64, daysAgo: 0 },
  { kind: "variable", name: "Publicidad en redes", categoryId: "advertising", paymentMethod: "card", supplier: "Meta", amount: 150, description: "Campaña de reapertura.", daysAgo: 0 },
  { kind: "variable", name: "Afilado de tijeras", categoryId: "maintenance", paymentMethod: "cash", amount: 90, monthsAgo: 1 },
  { kind: "variable", name: "Pintura de la fachada", categoryId: "maintenance", paymentMethod: "bank", amount: 460, monthsAgo: 1 },
  /* Lo que Paola Zuluaga (renta, team-30) compra para su silla: no es gasto de la barbería. */
  { ownerMemberId: "team-30", kind: "fixed", name: "Cuchillas y navajas", categoryId: "supplies", paymentMethod: "card", amount: 35, frequency: "monthly", description: "Repuesto de cuchillas para su navaja.", daysAgo: 90 },
  { ownerMemberId: "team-30", kind: "variable", name: "Máquina de corte inalámbrica", categoryId: "supplies", paymentMethod: "card", supplier: "Wahl", amount: 160, daysAgo: 0 },
  { ownerMemberId: "team-30", kind: "variable", name: "Pomadas para su silla", categoryId: "resale", paymentMethod: "cash", amount: 48, monthsAgo: 1 },
  { branchId: "nc", kind: "fixed", name: "Renta del local", categoryId: "rent", paymentMethod: "bank", supplier: "Inmobiliaria Newbury", amount: 2400, frequency: "monthly", daysAgo: 190 },
  { branchId: "nc", kind: "variable", name: "Letrero nuevo", categoryId: "advertising", paymentMethod: "bank", amount: 320, daysAgo: 0 },
];

const createdOf = (draft: Draft, now: Date): Date => (draft.monthsAgo === undefined ? new Date(now.getTime() - (draft.daysAgo ?? 0) * DAY_MS) : new Date(now.getFullYear(), now.getMonth() - draft.monthsAgo, MID_MONTH, 12));
const dayKey = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** La fecha del gasto: la suya o, en los guardados antes del campo, el día en que se registró. */
export const expenseDate = (expense: Pick<MockExpense, "date" | "createdAt">): string => expense.date ?? dayKey(new Date(expense.createdAt));

/** ¿Un fijo corre en algún día entre `from` y `to` (AAAA-MM-DD)? */
export const fixedActiveIn = (expense: MockExpense, from: string, to: string): boolean => expenseDate(expense) <= to && (expense.endDate == null || expense.endDate >= from);

export function seedExpenses(now = new Date()): MockExpense[] {
  return DRAFTS.map((draft, index) => ({
    id: `exp_${String(index + 1).padStart(3, "0")}`,
    branchId: draft.branchId ?? "ma",
    ownerMemberId: draft.ownerMemberId ?? null,
    kind: draft.kind,
    name: draft.name,
    amount: draft.amount,
    frequency: draft.kind === "fixed" ? (draft.frequency ?? "monthly") : null,
    description: draft.description ?? "",
    createdAt: createdOf(draft, now).toISOString(),
    date: dayKey(createdOf(draft, now)),
    endDate: null,
    categoryId: draft.categoryId,
    paymentMethod: draft.paymentMethod ?? null,
    supplier: draft.supplier ?? "",
    attachments: [],
    createdBy: "Carolina Vargas",
  }));
}

/** Hasta cuántos días atrás la demo da por pagados los vencimientos: lo de la última semana sale vencido. */
const DEMO_PAID_BEFORE_DAYS = 7;

/**
 * Los vencimientos ya pagados de la demo (cuentas por pagar): todo lo que venció este mes y el anterior hasta hace una
 * semana, pagado ese mismo día; lo de los últimos días queda vencido para que la lista tenga de todo.
 */
export function seedExpensePayments(expenses: readonly MockExpense[], now = new Date()): MockExpensePayment[] {
  const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const cutoff = key(new Date(now.getFullYear(), now.getMonth(), now.getDate() - DEMO_PAID_BEFORE_DAYS));
  const months = [key(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7), key(now).slice(0, 7)];
  return expenses
    .filter((expense) => expense.kind === "fixed")
    .flatMap((expense) =>
      months
        .flatMap((month) => dueDatesIn({ kind: expense.kind, frequency: expense.frequency, start: expenseDate(expense), endDate: expense.endDate ?? null, dueDay: expense.dueDay ?? null }, month))
        .filter((dueDate) => dueDate < cutoff)
        .map((dueDate) => ({ id: `exp_pay_${expense.id}_${dueDate}`, expenseId: expense.id, dueDate, amount: expense.amount, paidAt: `${dueDate}T15:00:00.000Z`, method: expense.paymentMethod ?? "bank", by: "Administración" }))
    );
}
