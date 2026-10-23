import { delay, http, HttpResponse } from "msw";
import { db } from "../db";
import { forbidden, isBarber, sessionOf, unauthorized } from "../session";
import { appointmentAccount } from "../calendar/account";
import { appointmentsOn } from "../calendar/handlers";
import { dateKey, type MockAppointment } from "../calendar/seed";

/**
 * El libro de pagos (docs/API_CONTRACT.md, «Transacciones»): cada movimiento de dinero del periodo, en el
 * orden en que pasó y sin borrar nada. Sale de lo que ya se registra —el cobro de la cita (por medio si fue
 * mixto), lo pagado en línea al reservar, la propina, cada devolución y cada venta de mostrador— y no se
 * puede editar: una corrección es otro movimiento (una devolución), nunca un cambio de uno anterior.
 */

const BASE = "*/api";
const LATENCY_MS = 200;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 62;
/** Lo pagado en línea puede ser de una cita que aún no llega: se mira la agenda que viene. */
const ONLINE_AHEAD_DAYS = 60;

export type LedgerKind = "charge" | "online" | "tip" | "refund" | "sale" | "void";
export interface LedgerEntry {
  id: string;
  at: string;
  kind: LedgerKind;
  /** Medio: efectivo, tarjeta, enlace, el de la pasarela en línea o saldo a favor. */
  method: string;
  /** Positivo entra; negativo sale (devoluciones). */
  amount: number;
  /** Quién lo registró. */
  by: string;
  concept: string;
  appointmentId: string | null;
  saleId: string | null;
}

const round = (value: number) => Math.round(value * 100) / 100;
const clientName = (id: string) => db.calendar.clients.find((client) => client.id === id)?.name ?? "";
/** Quien cobró: la línea «cobrada» del historial (o, si no está, el barbero). */
export const chargedBy = (item: MockAppointment): string | null => [...item.history].reverse().find((entry) => entry.event === "status:paid" || entry.event.startsWith("paid:"))?.actor ?? null;

/** El cobro de la cita (por medio si fue mixto) y su propina: lo que se guarda si luego se borra la venta. */
export function paymentEntriesOf(item: MockAppointment): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  const base = { appointmentId: item.id, saleId: null, concept: clientName(item.clientId) };
  if (item.status === "paid" && item.payment) {
    const payment = item.payment;
    const by = chargedBy(item) ?? "";
    const due = round(Math.max(0, appointmentAccount(item).total - (payment.prepaid ?? 0)));
    if (payment.split) {
      if (payment.split.cash > 0) entries.push({ ...base, id: `charge:${item.id}:cash`, at: payment.paidAt, kind: "charge", method: "cash", amount: round(payment.split.cash), by });
      if (payment.split.card > 0) entries.push({ ...base, id: `charge:${item.id}:card`, at: payment.paidAt, kind: "charge", method: "card", amount: round(payment.split.card), by });
    } else if (due > 0) {
      entries.push({ ...base, id: `charge:${item.id}`, at: payment.paidAt, kind: "charge", method: payment.method, amount: due, by });
    }
    if (payment.tip > 0 && !payment.split) entries.push({ ...base, id: `tip:${item.id}`, at: payment.paidAt, kind: "tip", method: payment.method, amount: round(payment.tip), by });
  }
  return entries;
}

function entriesOf(item: MockAppointment): LedgerEntry[] {
  const concept = clientName(item.clientId);
  const base = { appointmentId: item.id, saleId: null, concept };
  const entries: LedgerEntry[] = [];
  if (item.online && item.online.paid > 0) {
    entries.push({ ...base, id: `online:${item.id}`, at: item.createdAt, kind: "online", method: item.online.method, amount: round(item.online.paid), by: "Reserva en línea" });
  }
  // Lo que se cobró y luego se borró sigue en el libro, con su contramovimiento al lado.
  for (const voided of item.voidedPayments ?? []) {
    voided.entries.forEach((original, index) => {
      entries.push({ ...base, id: `${voided.id}:${index}`, at: original.at, kind: original.kind, method: original.method, amount: original.amount, by: original.by });
      entries.push({ ...base, id: `${voided.id}:${index}:void`, at: voided.at, kind: "void", method: original.method, amount: -original.amount, by: voided.by, concept: `${concept} · ${voided.reason}` });
    });
  }
  entries.push(...paymentEntriesOf(item));
  for (const refund of item.refunds ?? []) {
    entries.push({ ...base, id: `refund:${refund.id}`, at: refund.at, kind: "refund", method: refund.to, amount: -round(refund.amount), by: refund.by });
  }
  return entries;
}

export function ledgerOf(branchId: string, from: string, to: string, ownBarberId: string | null = null): { entries: LedgerEntry[]; totals: { in: number; out: number; net: number; byMethod: Record<string, number>; byKind: Record<string, number> } } {
  const start = new Date(`${from}T12:00:00`);
  const days = Math.round((new Date(`${to}T12:00:00`).getTime() - start.getTime()) / DAY_MS) + 1;
  // La agenda del periodo (y la que viene, por lo pagado en línea al reservar) queda sembrada.
  for (let index = 0; index < days + ONLINE_AHEAD_DAYS; index++) appointmentsOn(branchId, dateKey(new Date(start.getTime() + index * DAY_MS)));
  const inRange = (at: string) => {
    const day = dateKey(new Date(at));
    return day >= from && day <= to;
  };
  const appointments = db.calendar.appointments.filter((item) => item.branchId === branchId && (ownBarberId === null || item.barberId === ownBarberId));
  const sales =
    ownBarberId === null
      ? db.calendar.sales
          .filter((sale) => sale.branchId === branchId)
          .map((sale): LedgerEntry => ({ id: `sale:${sale.id}`, at: sale.paidAt, kind: "sale", method: sale.method, amount: round(sale.total), by: "", concept: "", appointmentId: null, saleId: sale.id }))
      : [];
  const entries = [...appointments.flatMap(entriesOf), ...sales].filter((entry) => inRange(entry.at)).sort((a, b) => a.at.localeCompare(b.at));
  const sum = (values: readonly number[]) => round(values.reduce((total, value) => total + value, 0));
  const byMethod: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  for (const entry of entries) {
    byMethod[entry.method] = round((byMethod[entry.method] ?? 0) + entry.amount);
    byKind[entry.kind] = round((byKind[entry.kind] ?? 0) + entry.amount);
  }
  const incoming = sum(entries.filter((entry) => entry.amount > 0).map((entry) => entry.amount));
  const outgoing = sum(entries.filter((entry) => entry.amount < 0).map((entry) => -entry.amount));
  return { entries, totals: { in: incoming, out: outgoing, net: round(incoming - outgoing), byMethod, byKind } };
}

export const ledgerHandlers = [
  http.get(`${BASE}/payments`, async ({ request }) => {
    await delay(LATENCY_MS);
    const session = sessionOf(request);
    if (!session) return unauthorized();
    const params = new URL(request.url).searchParams;
    const from = params.get("from") ?? "";
    const to = params.get("to") ?? "";
    if (!DAY_KEY.test(from) || !DAY_KEY.test(to) || to < from) return HttpResponse.json({ code: "validation", message: "El rango de fechas no es válido." }, { status: 422 });
    if (Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / DAY_MS) + 1 > MAX_RANGE_DAYS) return HttpResponse.json({ code: "validation", message: `El rango no puede pasar de ${MAX_RANGE_DAYS} días.` }, { status: 422 });
    // El de comisión no lleva caja; el de renta ve los movimientos de sus cuentas.
    if (session.teamRole === "barbero-comision") return forbidden("El libro de pagos es de la caja.");
    const own = isBarber(session) ? session.memberId : null;
    return HttpResponse.json({ from, to, ...ledgerOf(params.get("branchId") ?? "ma", from, to, own) });
  }),
];
