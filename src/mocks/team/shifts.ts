import { patternRange, shiftRange } from "./scheduleModel";
import { delay, http, HttpResponse, type DefaultBodyType } from "msw";
import { db } from "../db";
import { forbidden, isBarber, isManager, sessionOf, unauthorized } from "../session";
import { appointmentsOn, hoursOn } from "../calendar/handlers";
import { dateKey } from "../calendar/seed";
import { barbersOf, memberName, type MockTeamMember, type MockWorkingRange } from "./seed";
import { absences } from "./workforce";
import type { MockShiftRequest } from "./operationsState";

/**
 * Turnos abiertos e intercambio (docs/API_CONTRACT.md, «Equipo › Turnos»). Un turno abierto es el día de alguien con
 * ausencia aprobada: un barbero libre ese día lo pide y gerencia aprueba (o gerencia se lo asigna directo). Un cambio es
 * entre dos: uno ofrece su día por un día del otro, el otro acepta y gerencia aprueba. Al aprobarse quedan las
 * excepciones de horario de cada uno y las citas de ese día pasan a quien trabaja.
 */

const BASE = "*/api";
const LATENCY_MS = 200;
const LOOKAHEAD_DAYS = 14;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const asRecord = (body: DefaultBodyType): Record<string, unknown> => (body && typeof body === "object" ? (body as Record<string, unknown>) : {});
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const error = (status: number, code: string, message: string) => HttpResponse.json({ code, message }, { status });
const today = () => dateKey(new Date());
const requests = (): MockShiftRequest[] => db.team.shiftRequests ?? [];
const memberOf = (id: string | null | undefined): MockTeamMember | undefined => db.team.members.find((item) => item.id === id);

/** La franja del día de alguien (con sus descansos): la excepción de esa fecha o su horario fijo. */
function dayRange(member: MockTeamMember, day: string): MockWorkingRange | null {
  return shiftRange(member, day).range;
}

const works = (member: MockTeamMember, day: string) => hoursOn(member, day).length > 0;

/** Si ese turno abierto ya lo cubre alguien (un pedido aprobado). */
export const isCovered = (absenceId: string, day: string) => requests().some((item) => item.kind === "cover" && item.absenceId === absenceId && item.date === day && item.status === "approved");

/** Los turnos abiertos de las dos semanas que vienen: días de trabajo de alguien con ausencia aprobada, sin cubrir. */
export function openShiftsOf(branchId: string, now = new Date()) {
  const shifts = [];
  for (let offset = 0; offset < LOOKAHEAD_DAYS; offset += 1) {
    const day = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));
    for (const absence of absences().filter((item) => item.branchId === branchId && item.status === "approved" && item.startDate <= day && day <= item.endDate)) {
      const member = memberOf(absence.memberId);
      const range = member ? patternRange(member, day) : null;
      if (!member || !range || isCovered(absence.id, day)) continue;
      const pending = requests().filter((item) => item.kind === "cover" && item.absenceId === absence.id && item.date === day && item.status === "pending");
      // Quién puede cubrirlo: los barberos de la sede que ese día no trabajan ni están de ausencia.
      const available = barbersOf(db.team.members, db.team.orders, branchId)
        .filter((other) => other.id !== member.id && !works(other, day) && !absences().some((item) => item.memberId === other.id && item.status === "approved" && item.startDate <= day && day <= item.endDate))
        .map((other) => ({ memberId: other.id, name: memberName(other) }));
      shifts.push({ id: `${absence.id}:${day}`, date: day, absenceId: absence.id, memberId: member.id, memberName: memberName(member), reason: absence.kind, range, available, requests: pending.map((item) => ({ id: item.id, requesterId: item.requesterId, requesterName: item.requesterName })) });
    }
  }
  return shifts;
}

/** Pone (o cambia) la excepción de horario de alguien ese día. */
function setOverride(memberId: string, date: string, range: MockWorkingRange | null) {
  const others = db.team.overrides.filter((item) => !(item.memberId === memberId && item.date === date));
  db.team = { ...db.team, overrides: [...others, { id: `ovr_${memberId}_${date}`, memberId, date, range }] };
}

/** Las citas por atender de un barbero ese día pasan a otro, con su rastro en la cita. */
function moveAppointments(branchId: string, fromId: string, toId: string, date: string, actor: string): number {
  appointmentsOn(branchId, date);
  const target = memberOf(toId);
  let moved = 0;
  db.calendar.appointments = db.calendar.appointments.map((item) => {
    if (item.branchId !== branchId || item.barberId !== fromId || !item.start.startsWith(date) || item.status !== "scheduled" || !target) return item;
    moved += 1;
    return { ...item, barberId: toId, history: [...item.history, { id: `h_${Math.random().toString(36).slice(2, 9)}`, at: new Date().toISOString(), actor, event: `barber:${memberName(target)}` }] };
  });
  return moved;
}

/** Aplica un pedido aprobado: excepciones de horario y citas. */
function apply(request: MockShiftRequest, actor: string) {
  if (request.kind === "cover" && request.absentMemberId) {
    setOverride(request.requesterId, request.date, request.range);
    moveAppointments(request.branchId, request.absentMemberId, request.requesterId, request.date, actor);
    return;
  }
  if (request.kind === "swap" && request.withMemberId && request.withDate && request.withRange) {
    setOverride(request.requesterId, request.date, null);
    setOverride(request.withMemberId, request.date, request.range);
    setOverride(request.withMemberId, request.withDate, null);
    setOverride(request.requesterId, request.withDate, request.withRange);
    moveAppointments(request.branchId, request.requesterId, request.withMemberId, request.date, actor);
    moveAppointments(request.branchId, request.withMemberId, request.requesterId, request.withDate, actor);
  }
}

function save(next: MockShiftRequest) {
  const exists = requests().some((item) => item.id === next.id);
  db.team = { ...db.team, shiftRequests: exists ? requests().map((item) => (item.id === next.id ? next : item)) : [next, ...requests()] };
  db.persist();
  return next;
}

const newId = () => `shr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

/** Lo que ve cada quien: gerencia, todo lo de la sede; el barbero, lo suyo y lo que le piden. */
function visibleRequests(branchId: string, memberId: string | null) {
  return requests()
    .filter((item) => item.branchId === branchId && (!memberId || item.requesterId === memberId || item.withMemberId === memberId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function coverRequest(shiftId: string, requester: MockTeamMember, status: MockShiftRequest["status"], actor: string): MockShiftRequest | Response {
  const [absenceId, date] = shiftId.split(":");
  const shift = openShiftsOf(absences().find((item) => item.id === absenceId)?.branchId ?? "", new Date(`${today()}T12:00:00`)).find((item) => item.id === shiftId);
  if (!shift) return error(404, "not_found", "Ese turno ya no está abierto.");
  if (requester.id === shift.memberId) return error(422, "validation", "Es el turno de quien falta.");
  if (works(requester, date)) return error(409, "conflict", `${memberName(requester)} ya trabaja ese día.`);
  if (status === "pending" && requests().some((item) => item.kind === "cover" && item.absenceId === absenceId && item.date === date && item.requesterId === requester.id && item.status === "pending")) return error(409, "conflict", "Ya pediste ese turno.");
  const now = new Date().toISOString();
  return { id: newId(), branchId: absences().find((item) => item.id === absenceId)!.branchId, kind: "cover", requesterId: requester.id, requesterName: memberName(requester), date, range: shift.range, absentMemberId: shift.memberId, absenceId, status, createdAt: now, decidedBy: status === "approved" ? actor : null, decidedAt: status === "approved" ? now : null, reason: null };
}

export const shiftHandlers = [
  http.get(`${BASE}/team/shifts`, async ({ request }) => {
    await delay(LATENCY_MS);
    const session = sessionOf(request);
    if (!session) return unauthorized();
    const branchId = new URL(request.url).searchParams.get("branchId") ?? "ma";
    return HttpResponse.json({ open: openShiftsOf(branchId), requests: visibleRequests(branchId, isManager(session) ? null : session.memberId) });
  }),

  // Un barbero libre ese día pide cubrir un turno abierto.
  http.post(`${BASE}/team/shifts/cover`, async ({ request }) => {
    await delay(LATENCY_MS);
    const session = sessionOf(request);
    if (!session) return unauthorized();
    const member = memberOf(session.memberId);
    if (!isBarber(session) || !member) return forbidden("Los turnos los piden los barberos.");
    const created = coverRequest(text(asRecord(await request.json().catch(() => ({}))).shiftId), member, "pending", session.account.user.name);
    if (created instanceof Response) return created;
    return HttpResponse.json(save(created), { status: 201 });
  }),

  // Gerencia asigna el turno directo: queda aprobado y aplicado.
  http.post(`${BASE}/team/shifts/assign`, async ({ request }) => {
    await delay(LATENCY_MS);
    const session = sessionOf(request);
    if (!session) return unauthorized();
    if (!isManager(session)) return forbidden("Asigna el dueño o el administrador.");
    const input = asRecord(await request.json().catch(() => ({})));
    const member = memberOf(text(input.memberId));
    if (!member) return error(422, "validation", "Elige quién lo cubre.");
    const created = coverRequest(text(input.shiftId), member, "approved", session.account.user.name);
    if (created instanceof Response) return created;
    apply(created, session.account.user.name);
    // Los demás pedidos de ese turno quedan sin efecto.
    db.team = { ...db.team, shiftRequests: requests().map((item) => (item.kind === "cover" && item.absenceId === created.absenceId && item.date === created.date && item.status === "pending" ? { ...item, status: "rejected", decidedBy: session.account.user.name, decidedAt: created.decidedAt, reason: "Lo cubrió otra persona." } : item)) };
    return HttpResponse.json(save(created), { status: 201 });
  }),

  // Un barbero ofrece su día por un día de un compañero.
  http.post(`${BASE}/team/shifts/swap`, async ({ request }) => {
    await delay(LATENCY_MS);
    const session = sessionOf(request);
    if (!session) return unauthorized();
    const requester = memberOf(session.memberId);
    if (!isBarber(session) || !requester) return forbidden("Los cambios los piden los barberos.");
    const input = asRecord(await request.json().catch(() => ({})));
    const date = text(input.date);
    const withDate = text(input.withDate);
    const other = memberOf(text(input.withMemberId));
    if (!other || other.id === requester.id || !DAY_KEY.test(date) || !DAY_KEY.test(withDate)) return error(422, "validation", "Elige tu día, con quién y su día.");
    if (date < today() || withDate < today()) return error(422, "validation", "Solo se cambian días que vienen.");
    if (!works(requester, date)) return error(422, "validation", "Ese día no trabajas.");
    if (!works(other, withDate)) return error(422, "validation", `${memberName(other)} no trabaja ese día.`);
    if (works(other, date)) return error(409, "conflict", `${memberName(other)} ya trabaja tu día.`);
    if (works(requester, withDate)) return error(409, "conflict", "Ya trabajas el día que pides.");
    const now = new Date().toISOString();
    const created: MockShiftRequest = { id: newId(), branchId: requester.homeBranchId, kind: "swap", requesterId: requester.id, requesterName: memberName(requester), date, range: dayRange(requester, date)!, withMemberId: other.id, withName: memberName(other), withDate, withRange: dayRange(other, withDate), status: "pending", createdAt: now, decidedBy: null, decidedAt: null, reason: null };
    return HttpResponse.json(save(created), { status: 201 });
  }),

  // El compañero acepta o rechaza el cambio; gerencia aprueba o rechaza.
  http.post(`${BASE}/team/shifts/requests/:id/:action`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const session = sessionOf(request);
    if (!session) return unauthorized();
    const current = requests().find((item) => item.id === params.id);
    if (!current) return error(404, "not_found", "Ese pedido no existe.");
    const action = String(params.action);
    const actor = session.account.user.name;
    const reason = text(asRecord(await request.json().catch(() => ({}))).reason) || null;
    const now = new Date().toISOString();
    if (action === "accept" || action === "decline") {
      if (current.kind !== "swap" || current.withMemberId !== session.memberId) return forbidden("Ese cambio no es contigo.");
      if (current.status !== "pending") return error(409, "conflict", "Ese cambio ya se respondió.");
      return HttpResponse.json(save({ ...current, status: action === "accept" ? "accepted" : "rejected", ...(action === "decline" ? { decidedBy: actor, decidedAt: now, reason } : {}) }));
    }
    if (action === "approve" || action === "reject") {
      if (!isManager(session)) return forbidden("Aprueba el dueño o el administrador.");
      const ready = current.kind === "cover" ? current.status === "pending" : current.status === "accepted" || (action === "reject" && current.status === "pending");
      if (!ready) return error(409, "conflict", current.kind === "swap" && current.status === "pending" ? "Falta que el compañero acepte." : "Ese pedido ya se decidió.");
      if (action === "reject") return HttpResponse.json(save({ ...current, status: "rejected", decidedBy: actor, decidedAt: now, reason }));
      // Al aprobar se vuelve a mirar: puede que alguien ya lo haya cubierto o que el horario haya cambiado.
      if (current.kind === "cover" && current.absenceId && isCovered(current.absenceId, current.date)) return error(409, "conflict", "Ese turno ya lo cubrió otra persona.");
      apply(current, actor);
      return HttpResponse.json(save({ ...current, status: "approved", decidedBy: actor, decidedAt: now }));
    }
    return error(404, "not_found", "Acción desconocida.");
  }),

  // Quien lo pidió lo retira mientras no se haya aprobado.
  http.delete(`${BASE}/team/shifts/requests/:id`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const session = sessionOf(request);
    if (!session) return unauthorized();
    const current = requests().find((item) => item.id === params.id);
    if (!current) return error(404, "not_found", "Ese pedido no existe.");
    if (current.requesterId !== session.memberId) return forbidden("Solo lo retira quien lo pidió.");
    if (current.status !== "pending" && current.status !== "accepted") return error(409, "conflict", "Ese pedido ya se decidió.");
    save({ ...current, status: "cancelled" });
    return new HttpResponse(null, { status: 204 });
  }),
];

