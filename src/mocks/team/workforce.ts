import { isCovered } from "./shifts";
import { delay, http, HttpResponse, type DefaultBodyType } from "msw";
import { db } from "../db";
import { appointmentsOn, hoursOn } from "../calendar/handlers";
import { dateKey, parseClock, type MockAppointment, type MockTimeBlock } from "../calendar/seed";
import { appointmentAccount } from "../calendar/account";
import { barberFree } from "../booking/logic";
import { forbidden, isBarber, isManager, sessionOf, unauthorized } from "../session";
import { barbersOf, memberName, type MockAbsence, type MockTeamMember } from "./seed";
import { payrollOf } from "../payroll/compute";

/**
 * El equipo en operación (docs/API_CONTRACT.md, «Equipo»): a quién le toca el siguiente cliente sin
 * cita o sin preferencia, las ausencias con aprobación, el rendimiento de cada barbero y la portada
 * del módulo con cifras de la agenda real.
 */

const BASE = "*/api";
const LATENCY_MS = 150;
const DAY_MS = 86_400_000;
const PERFORMANCE_DAYS = 90;
const REBOOK_DAYS = 7;
const SLOT_MIN = 30;
const MAX_NOTE = 300;
const KINDS: readonly MockAbsence["kind"][] = ["vacation", "sick", "personal"];
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const asRecord = (body: DefaultBodyType): Record<string, unknown> => (body && typeof body === "object" ? (body as Record<string, unknown>) : {});
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const round = (value: number) => Math.round(value * 10) / 10;
const pct = (part: number, total: number) => (total > 0 ? round((part / total) * 100) : 0);
const memberOf = (id: string) => db.team.members.find((member) => member.id === id);
const daysBack = (now: Date, count: number) => Array.from({ length: count }, (_, index) => dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - index)));

/* ------------------------------------------------------------------ fila */

export type LineupKind = "walkIn" | "noPreference";

const takenBy = (item: MockAppointment, kind: LineupKind) => (kind === "walkIn" ? item.walkIn : !item.walkIn && item.requestedBarberId === null);

/**
 * A quién le toca: los encendidos en la fila de ese tipo, en su orden; primero quien menos clientes de
 * ese tipo lleva hoy y, a igualdad, el que va antes en la fila. Quien no trabaja hoy no entra; quien
 * está ocupado ahora sigue en la lista, pero el turno pasa al siguiente libre.
 */
export function lineupTurn(branchId: string, kind: LineupKind, at = new Date()) {
  const day = dateKey(at);
  const minute = at.getHours() * 60 + at.getMinutes();
  const barbers = barbersOf(db.team.members, db.team.orders, branchId);
  const entries = db.team.orders.find((item) => item.branchId === branchId)?.[kind] ?? [];
  const ordered = entries.length > 0 ? entries.filter((entry) => entry.enabled).map((entry) => barbers.find((barber) => barber.id === entry.memberId)).filter((member): member is MockTeamMember => Boolean(member)) : barbers;
  const today = appointmentsOn(branchId, day).filter((item) => item.status !== "cancelled");
  const rows = ordered
    .map((member, position) => ({
      memberId: member.id,
      name: memberName(member),
      avatarUrl: member.avatarUrl,
      position: position + 1,
      count: today.filter((item) => item.barberId === member.id && takenBy(item, kind)).length,
      working: hoursOn(member, day).length > 0 && !onAbsence(member.id, day),
      free: barberFree(branchId, member.id, day, minute, SLOT_MIN),
    }))
    .filter((row) => row.working)
    .sort((a, b) => a.count - b.count || a.position - b.position);
  const next = rows.find((row) => row.free) ?? rows[0] ?? null;
  return { kind, next: next?.memberId ?? null, items: rows };
}

/** El orden en que la reserva «sin preferencia» ofrece a los barberos ese día. */
export const lineupRank = (branchId: string, day: string): string[] => lineupTurn(branchId, "noPreference", new Date(`${day}T12:00:00`)).items.map((row) => row.memberId);

/* ------------------------------------------------------------- ausencias */

/**
 * Las ausencias. La demo trae dos solicitudes por aprobar (relativas a hoy) para que se vea el flujo en
 * la agenda: unas vacaciones la semana que viene y un permiso de un día.
 */
export const absences = (): MockAbsence[] => db.team.absences ?? demoAbsences();

const nameOf = (memberId: string) => {
  const member = memberOf(memberId);
  return member ? memberName(member) : memberId;
};

function demoAbsences(now = new Date()): MockAbsence[] {
  const day = (offset: number) => dateKey(new Date(now.getTime() + offset * DAY_MS));
  const nextMonday = (8 - now.getDay()) % 7 || 7;
  const base = { branchId: "ma", note: "", status: "pending" as const, requestedAt: new Date(now.getTime() - DAY_MS).toISOString(), decidedBy: null, decidedAt: null, reason: null, blockId: null };
  return [
    { ...base, id: "abs_demo_vacation", memberId: "team-05", kind: "vacation", startDate: day(nextMonday), endDate: day(nextMonday + 4), note: "Viaje familiar a la costa.", requestedBy: nameOf("team-05") },
    { ...base, id: "abs_demo_personal", memberId: "team-07", kind: "personal", startDate: day(3), endDate: day(3), note: "Diligencia personal en la mañana.", requestedBy: nameOf("team-07") },
  ];
}
const saveAbsences = (items: MockAbsence[]) => {
  db.team = { ...db.team, absences: items };
  db.persist();
};
export const onAbsence = (memberId: string, day: string) => absences().some((item) => item.memberId === memberId && item.status === "approved" && item.startDate <= day && day <= item.endDate);

/** Las citas que ya tiene en esos días: lo que hay que mover antes de aprobar. */
function affected(absence: Pick<MockAbsence, "memberId" | "branchId" | "startDate" | "endDate">) {
  const items: { id: string; start: string; client: string }[] = [];
  for (let day = new Date(`${absence.startDate}T12:00:00`); dateKey(day) <= absence.endDate; day = new Date(day.getTime() + DAY_MS)) {
    for (const item of appointmentsOn(absence.branchId, dateKey(day))) {
      if (item.barberId === absence.memberId && (item.status === "scheduled" || item.status === "arrived")) items.push({ id: item.id, start: item.start, client: db.calendar.clients.find((client) => client.id === item.clientId)?.name ?? "" });
    }
  }
  return items;
}

const view = (absence: MockAbsence) => ({ ...absence, memberName: memberOf(absence.memberId) ? memberName(memberOf(absence.memberId) as MockTeamMember) : absence.memberId, affected: affected(absence) });

/** Aprobada, la ausencia bloquea su agenda esos días (vacaciones o incapacidad en el calendario). */
function blockFor(absence: MockAbsence): MockTimeBlock {
  const member = memberOf(absence.memberId);
  const range = member ? (Object.values(member.schedule).find(Boolean) ?? { start: "09:00", end: "19:00" }) : { start: "09:00", end: "19:00" };
  return { id: `blk_abs_${absence.id}`, branchId: absence.branchId, barberId: absence.memberId, category: absence.kind === "sick" ? "sick" : absence.kind === "vacation" ? "vacation" : "personal", repeat: "daily", startDate: absence.startDate, endDate: absence.endDate, startTime: range.start, endTime: range.end, description: absence.note || null };
}

function approve(absence: MockAbsence, by: string): MockAbsence {
  const block = blockFor(absence);
  db.calendar.blocks = [...db.calendar.blocks.filter((item) => item.id !== block.id), block];
  return { ...absence, status: "approved", decidedBy: by, decidedAt: new Date().toISOString(), blockId: block.id };
}

/* ----------------------------------------------------------- rendimiento */

/** Cómo va un barbero en los últimos 90 días, con los datos de su agenda y sus reseñas. */
export function memberPerformance(memberId: string, branchId: string, now = new Date()) {
  const member = memberOf(memberId);
  const days = daysBack(now, PERFORMANCE_DAYS);
  const mine = days.flatMap((day) => appointmentsOn(branchId, day)).filter((item) => item.barberId === memberId);
  const paid = mine.filter((item) => item.status === "paid" && item.payment);
  const booked = mine.filter((item) => item.status !== "cancelled");
  const revenue = paid.reduce((sum, item) => sum + appointmentAccount(item).total - appointmentAccount(item).tax, 0);
  const products = paid.reduce((sum, item) => sum + item.products.reduce((total, row) => total + row.qty, 0), 0);
  const tips = paid.reduce((sum, item) => sum + (item.payment?.tip ?? 0), 0);
  // Rebooking: de los que cobró, cuántos dejaron agendada otra cita con él en la semana siguiente.
  const all = db.calendar.appointments.filter((item) => item.barberId === memberId);
  const rebooked = paid.filter((item) => all.some((other) => other.clientId === item.clientId && other.id !== item.id && other.createdAt >= item.start && new Date(other.createdAt).getTime() - new Date(item.start).getTime() <= REBOOK_DAYS * DAY_MS)).length;
  // Retención: de sus clientes de los primeros 45 días del periodo, cuántos volvieron con él después.
  const half = days[Math.floor(PERFORMANCE_DAYS / 2)];
  const early = new Set(paid.filter((item) => item.start.slice(0, 10) < half).map((item) => item.clientId));
  const back = [...early].filter((clientId) => paid.some((item) => item.clientId === clientId && item.start.slice(0, 10) >= half)).length;
  // Ocupación: minutos de cita sobre minutos de jornada.
  const scheduled = member ? days.reduce((sum, day) => sum + hoursOn(member, day).reduce((total, range) => total + parseClock(range.end) - parseClock(range.start), 0), 0) : 0;
  const busy = booked.reduce((sum, item) => sum + item.durationMin, 0);
  const reviews = (db.booking.reviews ?? []).filter((review) => review.barberId === memberId);
  return {
    memberId,
    days: PERFORMANCE_DAYS,
    services: paid.length,
    occupancy: pct(busy, scheduled),
    rebookRate: pct(rebooked, paid.length),
    retention: pct(back, early.size),
    avgTicket: paid.length ? Math.round((revenue / paid.length) * 100) / 100 : 0,
    productsPerService: paid.length ? round(products / paid.length) : 0,
    tips: Math.round(tips * 100) / 100,
    noShows: mine.filter((item) => item.status === "no_show").length,
    noShowRate: pct(mine.filter((item) => item.status === "no_show").length, mine.length),
    rating: reviews.length ? round(reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) : null,
    reviews: reviews.length,
  };
}

/* ---------------------------------------------------------------- portada */

const WEEKS = 7;

/** Minutos de jornada de la persona en esos días. */
const scheduledMinutes = (member: MockTeamMember, days: readonly string[]) => days.reduce((sum, day) => sum + (onAbsence(member.id, day) ? 0 : hoursOn(member, day).reduce((total, range) => total + parseClock(range.end) - parseClock(range.start), 0)), 0);

/** La agenda de la sucursal por día y barbero, leída una sola vez para toda la portada. */
type Agenda = Map<string, Map<string, MockAppointment[]>>;
function agendaOf(branchId: string, days: readonly string[]): Agenda {
  const agenda: Agenda = new Map();
  for (const day of days) {
    const byBarber = new Map<string, MockAppointment[]>();
    for (const item of appointmentsOn(branchId, day)) byBarber.set(item.barberId, [...(byBarber.get(item.barberId) ?? []), item]);
    agenda.set(day, byBarber);
  }
  return agenda;
}
const itemsOf = (agenda: Agenda, memberId: string, days: readonly string[]) => days.flatMap((day) => agenda.get(day)?.get(memberId) ?? []);

/** De sus clientes de la primera mitad del periodo, cuántos volvieron con él en la segunda. */
function retentionOf(agenda: Agenda, memberId: string, days: readonly string[]): number {
  const half = days[Math.floor(days.length / 2)];
  const paid = itemsOf(agenda, memberId, days).filter((item) => item.status === "paid");
  const early = new Set(paid.filter((item) => item.start.slice(0, 10) < half).map((item) => item.clientId));
  const late = new Set(paid.filter((item) => item.start.slice(0, 10) >= half).map((item) => item.clientId));
  return pct([...early].filter((id) => late.has(id)).length, early.size);
}

function weekOf(member: MockTeamMember, agenda: Agenda, days: readonly string[]) {
  const items = itemsOf(agenda, member.id, days).filter((item) => item.status !== "cancelled");
  const paid = items.filter((item) => item.status === "paid" && item.payment);
  return {
    occupancy: pct(items.reduce((sum, item) => sum + item.durationMin, 0), scheduledMinutes(member, days)),
    services: paid.length,
    revenue: Math.round(paid.reduce((sum, item) => sum + appointmentAccount(item).total - appointmentAccount(item).tax, 0)),
  };
}

/** Turnos sin cubrir: los días de la semana que viene en que alguien con horario tiene una ausencia aprobada. */
function openShifts(branchId: string, now: Date) {
  const shifts: { id: string; dayOffset: number; slot: string; branchId: string; chair: number; reason: MockAbsence["kind"]; memberName: string }[] = [];
  const barbers = barbersOf(db.team.members, db.team.orders, branchId);
  for (let offset = 0; offset < 7; offset += 1) {
    const day = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));
    barbers.forEach((member, index) => {
      const absence = absences().find((item) => item.memberId === member.id && item.status === "approved" && item.startDate <= day && day <= item.endDate);
      const range = hoursOn(member, day)[0];
      if (absence && range && !isCovered(absence.id, day)) shifts.push({ id: `${absence.id}:${day}`, dayOffset: offset, slot: `${range.start} – ${range.end}`, branchId, chair: index + 1, reason: absence.kind, memberName: memberName(member) });
    });
  }
  return shifts;
}

/**
 * La portada de Equipo con datos de la agenda: cada persona de la sucursal con su semana (ocupación,
 * servicios, lo que generó y lo que se le liquida), los turnos sin cubrir por ausencias y la serie de
 * las últimas 7 semanas de cada lectura del pulso.
 */
export function teamHome(branchId: string, now = new Date()) {
  const week = daysBack(now, 7);
  const today = dateKey(now);
  const barbers = barbersOf(db.team.members, db.team.orders, branchId);
  const people = db.team.members.filter((member) => member.branchIds.includes(branchId));
  const period = daysBack(now, PERFORMANCE_DAYS);
  const agenda = agendaOf(branchId, daysBack(now, Math.max(PERFORMANCE_DAYS, WEEKS * 7)));
  const unclosed = week.slice(1).filter((day) => [...(agenda.get(day)?.values() ?? [])].flat().some((item) => item.status === "paid") && !(db.register?.closures ?? []).some((closure) => closure.branchId === branchId && closure.date === day && closure.final !== false)).length;
  const weekly = (offset: number) => daysBack(new Date(now.getTime() - offset * 7 * DAY_MS), 7);
  const members = people.map((member) => {
    const chair = barbers.findIndex((item) => item.id === member.id);
    const works = chair >= 0;
    const current = works ? weekOf(member, agenda, week) : null;
    const payroll = member.role === "owner" ? null : payrollOf(member, week.flatMap((day) => [...(agenda.get(day)?.values() ?? [])].flat()), 1, branchId, []);
    const rent = member.role === "barbero-renta" && payroll ? payroll.net : null;
    return {
      id: member.id,
      name: memberName(member),
      email: member.email,
      role: member.role,
      branchId: member.branchIds[0] ?? branchId,
      status: member.status,
      chair: works ? chair + 1 : null,
      occupancy: current?.occupancy ?? null,
      services: current?.services ?? null,
      revenue: current?.revenue ?? null,
      payout: payroll ? Math.round(Math.abs(payroll.net)) : null,
      retention: works ? retentionOf(agenda, member.id, period) : null,
      // Renta: si debe (neto negativo), vencida; si no, los días que faltan para el corte de la semana.
      rentDueOffset: rent === null ? null : rent < 0 ? -1 : 6 - ((now.getDay() + 6) % 7),
      openRegisters: member.role === "recepcion" || member.role === "admin" ? unclosed : 0,
      lastActiveOffset: member.status === "invited" ? null : 0,
    };
  });
  const occupancySeries = Array.from({ length: WEEKS }, (_, index) => {
    const days = weekly(WEEKS - 1 - index);
    const rows = barbers.map((member) => weekOf(member, agenda, days));
    return rows.length ? round(rows.reduce((sum, row) => sum + row.occupancy, 0) / rows.length) : 0;
  });
  const servicesSeries = Array.from({ length: WEEKS }, (_, index) => {
    const days = weekly(WEEKS - 1 - index);
    return barbers.reduce((sum, member) => sum + weekOf(member, agenda, days).services, 0);
  });
  const shiftsSeries = Array.from({ length: WEEKS }, (_, index) => {
    const days = weekly(WEEKS - 1 - index);
    return absences().filter((item) => item.branchId === branchId && item.status === "approved" && item.startDate <= days[0] && days[days.length - 1] <= item.endDate).length;
  });
  const scheduledToday = barbers.filter((member) => hoursOn(member, today).length > 0);
  const absentToday = scheduledToday.filter((member) => onAbsence(member.id, today));
  return {
    members,
    openShifts: openShifts(branchId, now),
    series: { ocupacion: occupancySeries, agenda: occupancySeries, servicios: servicesSeries, turnos: shiftsSeries },
    pendingAbsences: absences().filter((item) => item.branchId === branchId && item.status === "pending").length,
    absentToday: absentToday.map((member) => ({ memberId: member.id, name: memberName(member) })),
  };
}

/* -------------------------------------------------------------- endpoints */

export const workforceHandlers = [
  http.get(`${BASE}/team/lineup/turn`, async ({ request }) => {
    await delay(LATENCY_MS);
    if (!sessionOf(request)) return unauthorized();
    const params = new URL(request.url).searchParams;
    const kind: LineupKind = params.get("kind") === "noPreference" ? "noPreference" : "walkIn";
    return HttpResponse.json(lineupTurn(params.get("branchId") ?? "ma", kind));
  }),

  http.get(`${BASE}/team/home`, async ({ request }) => {
    await delay(LATENCY_MS);
    if (!sessionOf(request)) return unauthorized();
    return HttpResponse.json(teamHome(new URL(request.url).searchParams.get("branchId") ?? "ma"));
  }),

  http.get(`${BASE}/team/members/:id/performance`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const session = sessionOf(request);
    if (!session) return unauthorized();
    // Un barbero ve su rendimiento, no el de sus colegas.
    if (isBarber(session) && session.memberId !== params.id) return forbidden("Solo puedes ver tu propio rendimiento.");
    if (!memberOf(String(params.id))) return HttpResponse.json({ code: "not_found", message: "Esa persona no está en el equipo." }, { status: 404 });
    return HttpResponse.json(memberPerformance(String(params.id), new URL(request.url).searchParams.get("branchId") ?? "ma"));
  }),

  /** Las ausencias de la sucursal; un barbero solo ve las suyas. */
  http.get(`${BASE}/team/absences`, async ({ request }) => {
    await delay(LATENCY_MS);
    const session = sessionOf(request);
    if (!session) return unauthorized();
    const branchId = new URL(request.url).searchParams.get("branchId") ?? "ma";
    const items = absences()
      .filter((item) => item.branchId === branchId && (isBarber(session) ? item.memberId === session.memberId : true))
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
      .map(view);
    return HttpResponse.json({ items });
  }),

  /**
   * Pedir una ausencia. El barbero por comisión (y recepción) la pide para sí y queda pendiente; el de
   * renta la registra aprobada; el dueño y el administrador la crean para cualquiera, ya aprobada.
   */
  http.post(`${BASE}/team/absences`, async ({ request }) => {
    await delay(LATENCY_MS);
    const session = sessionOf(request);
    if (!session) return unauthorized();
    const input = asRecord(await request.json().catch(() => ({})));
    const manager = isManager(session);
    const memberId = manager ? text(input.memberId) || session.memberId : session.memberId;
    const kind = KINDS.find((item) => item === input.kind);
    const startDate = text(input.startDate);
    const endDate = text(input.endDate) || startDate;
    const member = memberOf(memberId);
    const fields: Record<string, string[]> = {};
    if (!member) fields.memberId = ["Elige a la persona."];
    if (!kind) fields.kind = ["Elige el tipo de ausencia."];
    if (!DAY_KEY.test(startDate)) fields.startDate = ["Elige desde cuándo."];
    else if (!DAY_KEY.test(endDate) || endDate < startDate) fields.endDate = ["El fin no puede ser antes del inicio."];
    if (Object.keys(fields).length > 0) return HttpResponse.json({ code: "validation", message: "Revisa los campos marcados.", fields }, { status: 422 });
    if (absences().some((item) => item.memberId === memberId && item.status !== "rejected" && item.startDate <= endDate && startDate <= item.endDate)) return HttpResponse.json({ code: "conflict", message: "Ya hay una ausencia en esas fechas." }, { status: 409 });
    let absence: MockAbsence = {
      id: `abs_${Date.now().toString(36)}`,
      memberId,
      branchId: text(input.branchId) || member?.branchIds[0] || "ma",
      kind: kind as MockAbsence["kind"],
      startDate,
      endDate,
      note: text(input.note).slice(0, MAX_NOTE),
      status: "pending",
      requestedBy: session.account.user.name,
      requestedAt: new Date().toISOString(),
      decidedBy: null,
      decidedAt: null,
      reason: null,
      blockId: null,
    };
    // Sin aprobación: lo crea quien gestiona, o es un barbero de renta (decide su propia agenda).
    if (manager || member?.role === "barbero-renta") absence = approve(absence, session.account.user.name);
    saveAbsences([absence, ...absences()]);
    return HttpResponse.json(view(absence), { status: 201 });
  }),

  http.post(`${BASE}/team/absences/:id/:decision`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const session = sessionOf(request);
    if (!session) return unauthorized();
    // Deciden el dueño, el administrador y recepción (quien lleva la agenda); los barberos no.
    if (!isManager(session) && session.teamRole !== "recepcion") return forbidden("Las ausencias las aprueba la barbería.");
    const absence = absences().find((item) => item.id === params.id);
    if (!absence) return HttpResponse.json({ code: "not_found", message: "Esa ausencia no existe." }, { status: 404 });
    if (absence.status !== "pending") return HttpResponse.json({ code: "conflict", message: "Esa ausencia ya se decidió." }, { status: 409 });
    const input = asRecord(await request.json().catch(() => ({})));
    let decided: MockAbsence;
    if (params.decision === "approve") decided = approve(absence, session.account.user.name);
    else if (params.decision === "reject") {
      const reason = text(input.reason);
      if (reason.length < 3) return HttpResponse.json({ code: "validation", message: "Di por qué se rechaza.", fields: { reason: ["Di por qué se rechaza."] } }, { status: 422 });
      decided = { ...absence, status: "rejected", reason, decidedBy: session.account.user.name, decidedAt: new Date().toISOString() };
    } else return HttpResponse.json({ code: "not_found", message: "Acción desconocida." }, { status: 404 });
    saveAbsences(absences().map((item) => (item.id === decided.id ? decided : item)));
    return HttpResponse.json(view(decided));
  }),

  /** Cancelar una ausencia (la propia pendiente, o cualquiera si gestiona): quita su bloqueo. */
  http.delete(`${BASE}/team/absences/:id`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const session = sessionOf(request);
    if (!session) return unauthorized();
    const absence = absences().find((item) => item.id === params.id);
    if (!absence) return HttpResponse.json({ code: "not_found", message: "Esa ausencia no existe." }, { status: 404 });
    if (!isManager(session) && (absence.memberId !== session.memberId || absence.status === "approved")) return forbidden("Una ausencia aprobada la cancela el dueño o el administrador.");
    if (absence.blockId) db.calendar.blocks = db.calendar.blocks.filter((item) => item.id !== absence.blockId);
    saveAbsences(absences().filter((item) => item.id !== absence.id));
    return new HttpResponse(null, { status: 204 });
  }),
];
