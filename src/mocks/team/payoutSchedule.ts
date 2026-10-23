import { db, type MockAccount } from "../db";
import type { MockTeamMember, MockTeamRole } from "./seed";

/**
 * Los cambios de forma de pago con fecha (comisión ↔ renta ↔ salario). Solo lee y escribe `db`: lo usan la sesión (el
 * rol de la cuenta sigue al de su ficha), la nómina (cada periodo con la forma de entonces) y Equipo.
 */

const BARBER_ROLES: readonly MockTeamRole[] = ["barbero-comision", "barbero-renta"];
const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Aplica los cambios programados cuya fecha ya llegó. */
export function applyDuePayoutChanges(now = new Date()): void {
  const today = dayKey(now);
  const due = (db.team.payoutChanges ?? []).filter((change) => change.status === "scheduled" && change.effectiveDate <= today);
  if (due.length === 0) return;
  db.team = {
    ...db.team,
    members: db.team.members.map((member) => {
      const change = due.filter((item) => item.memberId === member.id).sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
      return change ? { ...member, role: change.to, compensation: change.after.compensation, payments: change.after.payments } : member;
    }),
    payoutChanges: (db.team.payoutChanges ?? []).map((item) => (due.includes(item) ? { ...item, status: "applied" as const } : item)),
  };
  db.persist();
}

/** La ficha como era ese día: si después cambió de forma de pago, con la de antes (para la nómina de periodos pasados). */
export function memberAt(member: MockTeamMember, day: string): MockTeamMember {
  const later = (db.team.payoutChanges ?? []).filter((change) => change.memberId === member.id && change.status === "applied" && change.effectiveDate > day).sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))[0];
  return later ? { ...member, role: later.before.role, compensation: later.before.compensation, payments: later.before.payments } : member;
}

/** El rol de la cuenta: el de su ficha si es barbero (cambia de comisión a renta con su ficha); si no, el de la cuenta. */
export function liveTeamRole(account: MockAccount): MockTeamRole {
  const role = account.user.teamRole;
  if (!role || !BARBER_ROLES.includes(role)) return role;
  const member = db.team.members.find((item) => item.id === account.user.memberId);
  return member && BARBER_ROLES.includes(member.role) ? member.role : role;
}

/** La cuenta como se le muestra a la app, con el rol vivo. */
export const liveUser = (account: MockAccount): MockAccount["user"] => ({ ...account.user, teamRole: liveTeamRole(account) });
