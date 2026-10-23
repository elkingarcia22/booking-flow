import { z } from "zod";
import type { AppMessageKey } from "@/app/i18n/types";

/**
 * El contrato del equipo (docs/API_CONTRACT.md, «Equipo»): la ficha completa
 * de cada persona, los niveles, el orden de los barberos y las horas de la
 * semana. Todo lo que se lee se valida con Zod al llegar.
 */

export const teamRoleSchema = z.enum(["owner", "admin", "recepcion", "barbero-comision", "barbero-renta"]);
export type TeamRole = z.infer<typeof teamRoleSchema>;

export const memberStatusSchema = z.enum(["active", "invited", "inactive"]);
export type MemberStatus = z.infer<typeof memberStatusSchema>;

export const workingRangeSchema = z.object({ start: z.string(), end: z.string(), breaks: z.array(z.object({ start: z.string(), end: z.string() })).optional() });
export type WorkingRange = z.infer<typeof workingRangeSchema>;

export const levelCriteriaSchema = z.object({ services90: z.number().nullable(), rebookRate: z.number().nullable(), rating: z.number().nullable(), months: z.number().nullable() });
/** Un nivel: su nombre, cuánto sobre la carta cobra quien está en él y lo que hace falta para llegar. */
export const levelSchema = z.object({ id: z.string(), name: z.string(), priceFactor: z.number().optional(), criteria: levelCriteriaSchema.optional() });
export type Level = z.infer<typeof levelSchema>;

export const serviceOverrideSchema = z.object({
  serviceId: z.string(),
  offered: z.boolean(),
  price: z.number().nullable(),
  newClientPrice: z.number().nullable(),
  loyaltyPrice: z.number().nullable(),
  durationMin: z.number().nullable(),
  splitCommission: z.number().nullable(),
  extraCommission: z.number().nullable(),
});
export type ServiceOverride = z.infer<typeof serviceOverrideSchema>;

export const compensationTypeSchema = z.enum(["commission", "scale", "salary"]);
export type CompensationType = z.infer<typeof compensationTypeSchema>;

export const compensationSchema = z.object({
  type: compensationTypeSchema,
  basic: z.number(),
  recurring: z.number().nullable(),
  walkIn: z.number().nullable(),
  noPreference: z.number().nullable(),
  newClient: z.number().nullable(),
  productPercent: z.number().nullable(),
  salary: z.number().nullable(),
  scale: z.array(z.object({ from: z.number(), percent: z.number() })),
});
export type Compensation = z.infer<typeof compensationSchema>;

export const paymentsSchema = z.object({
  rentBase: z.number(),
  walkInDeduction: z.number(),
  newClientDeduction: z.number(),
  noPreferenceDeduction: z.number(),
  bankName: z.string(),
  accountNumber: z.string(),
});
export type Payments = z.infer<typeof paymentsSchema>;

export const permissionColumnSchema = z.enum(["view", "create", "edit", "delete", "active"]);
export type PermissionColumn = z.infer<typeof permissionColumnSchema>;
export const permissionsSchema = z.record(z.string(), z.record(z.string(), z.boolean()));
export type Permissions = Record<string, Partial<Record<PermissionColumn, boolean>>>;

export const reminderChannelSchema = z.enum(["email", "sms", "push"]);
export type ReminderChannel = z.infer<typeof reminderChannelSchema>;

export const memberOptionsSchema = z.object({
  tips: z.boolean(),
  multipleAppointments: z.boolean(),
  newClients: z.boolean(),
  clientCancel: z.object({ enabled: z.boolean(), channels: z.array(reminderChannelSchema), hours: z.number(), minutes: z.number() }),
  intervalMinutes: z.number(),
  reminders: z.array(z.object({ channel: reminderChannelSchema, hours: z.number(), minutes: z.number() })),
  social: z.string(),
  link: z.string(),
});
export type MemberOptions = z.infer<typeof memberOptionsSchema>;

/** Horario fijo: una franja por día de la semana («0» = domingo) o `null`. */
export const weekScheduleSchema = z.record(z.string(), workingRangeSchema.nullable());
export type WeekSchedule = Record<string, WorkingRange | null>;

export const memberSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  role: teamRoleSchema,
  homeBranchId: z.string(),
  branchIds: z.array(z.string()),
  status: memberStatusSchema,
  avatarUrl: z.string().nullable(),
  code: z.string(),
  description: z.string(),
  /** Enlaces personales del barbero; vacío = no se muestra. */
  instagram: z.string(),
  facebook: z.string(),
  bookingVisible: z.boolean(),
  levelId: z.string().nullable(),
  skills: z.array(z.string()),
  gallery: z.array(z.string()),
  isAlsoBarber: z.boolean(),
  services: z.array(serviceOverrideSchema),
  compensation: compensationSchema.nullable(),
  payments: paymentsSchema.nullable(),
  schedule: weekScheduleSchema,
  permissions: permissionsSchema,
  options: memberOptionsSchema,
  createdAt: z.string(),
});
export type TeamMember = z.infer<typeof memberSchema>;

export const membersResponseSchema = z.object({ items: z.array(memberSchema), levels: z.array(levelSchema) });
export type MembersResponse = z.infer<typeof membersResponseSchema>;

export const levelsResponseSchema = z.object({ items: z.array(levelSchema) });

export const lineupEntrySchema = z.object({ memberId: z.string(), enabled: z.boolean() });
export type LineupEntry = z.infer<typeof lineupEntrySchema>;

export const branchOrderSchema = z.object({
  branchId: z.string(),
  calendar: z.array(z.string()),
  walkIn: z.array(lineupEntrySchema),
  noPreference: z.array(lineupEntrySchema),
});
export type BranchOrder = z.infer<typeof branchOrderSchema>;

/** Un día de la semana del equipo: el turno que rige, si es una excepción y el horario fijo de ese día de la semana. */
export const scheduleDaySchema = z.object({ date: z.string(), range: workingRangeSchema.nullable(), overridden: z.boolean(), fixed: workingRangeSchema.nullable().optional() });
export type ScheduleDay = z.infer<typeof scheduleDaySchema>;

/** El horario con vigencia que rige una semana: desde/hasta, el ciclo y en qué semana del ciclo va. */
export const planSummarySchema = z.object({ id: z.string(), from: z.string(), to: z.string().nullable(), cycleWeeks: z.number(), cycleWeek: z.number(), templateName: z.string().nullable() });
export type PlanSummary = z.infer<typeof planSummarySchema>;

/** Lo que pasa en la sede un día: un festivo (abierto o cerrado) o un cierre propio (entero o con horario reducido). */
export const dayClosureSchema = z.object({ date: z.string(), kind: z.enum(["holiday", "closure"]), name: z.string(), closed: z.boolean(), open: z.object({ start: z.string(), end: z.string() }).nullable(), id: z.string().nullable() });
export type DayClosure = z.infer<typeof dayClosureSchema>;

export const weekResponseSchema = z.object({
  weekStart: z.string(),
  days: z.array(z.string()),
  rows: z.array(z.object({ memberId: z.string(), name: z.string(), avatarUrl: z.string().nullable(), plan: planSummarySchema.nullable().optional(), days: z.array(scheduleDaySchema) })),
  closures: z.array(dayClosureSchema).optional(),
});
export type WeekResponse = z.infer<typeof weekResponseSchema>;
export type WeekRow = WeekResponse["rows"][number];

/** Una cita por atender que quedaría fuera del horario nuevo (antes de guardar, para moverla o avisar). */
export const scheduleImpactSchema = z.object({
  items: z.array(z.object({ id: z.string(), date: z.string(), start: z.string(), durationMin: z.number(), clientName: z.string(), serviceName: z.string(), barberName: z.string().optional() })),
});
export type ScheduleImpact = z.infer<typeof scheduleImpactSchema>["items"][number];

/** Una semana del horario: `"0".."6"` (domingo = 0), cada día su franja o `null`. */
export const weekPatternSchema = z.record(z.string(), workingRangeSchema.nullable());

export const schedulePlanSchema = z.object({ id: z.string(), memberId: z.string(), from: z.string(), to: z.string().nullable(), cycleWeeks: z.number(), weeks: z.array(weekPatternSchema), templateName: z.string().nullable().optional() });
export type SchedulePlan = z.infer<typeof schedulePlanSchema>;

export const scheduleTemplateSchema = z.object({ id: z.string(), branchId: z.string(), name: z.string(), cycleWeeks: z.number(), weeks: z.array(weekPatternSchema) });
export type ScheduleTemplate = z.infer<typeof scheduleTemplateSchema>;

export const closuresResponseSchema = z.object({
  country: z.string(),
  year: z.number(),
  holidays: z.array(z.object({ date: z.string(), name: z.string(), closed: z.boolean() })),
  closures: z.array(z.object({ id: z.string(), branchId: z.string(), date: z.string(), name: z.string(), open: z.object({ start: z.string(), end: z.string() }).nullable() })),
});
export type ClosuresResponse = z.infer<typeof closuresResponseSchema>;

export const scheduleChangeKindSchema = z.enum(["day", "following", "plan", "template", "copy", "closure"]);
export const scheduleLogSchema = z.object({
  items: z.array(z.object({ id: z.string(), memberId: z.string(), memberName: z.string(), at: z.string(), by: z.string(), kind: scheduleChangeKindSchema, date: z.string(), notify: z.boolean() })),
});
export type ScheduleChange = z.infer<typeof scheduleLogSchema>["items"][number];

export interface PlanInput {
  memberIds: string[];
  from: string;
  to: string | null;
  weeks: WeekSchedule[];
  templateName?: string | null;
  saveAsTemplate?: string;
  notify: boolean;
  branchId: string;
}

export interface ClosureInput {
  branchId: string;
  date: string;
  name: string;
  open: { start: string; end: string } | null;
  notify?: boolean;
}

/** Hasta dónde llega un cambio de turno: solo esa fecha, o ese día de la semana desde esa fecha («este y los siguientes»). */
export type ShiftScope = "day" | "following";

export const scheduleOverrideSchema = z.object({ id: z.string(), memberId: z.string(), date: z.string(), range: workingRangeSchema.nullable() });

/* ------------------------------------------------------------- entradas */

/** Lo que se captura en cada pestaña; el backend recibe lo mismo al crear y al editar. */
export interface ProfileInput {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  description: string;
  instagram: string;
  facebook: string;
  bookingVisible: boolean;
  levelId: string | null;
  skills: string[];
  gallery: string[];
  avatarUrl: string | null;
  isAlsoBarber: boolean;
}

export interface MemberDraft {
  role: TeamRole;
  branchId: string;
  profile: ProfileInput;
  services: ServiceOverride[];
  compensation: Compensation | null;
  payments: Payments | null;
  schedule: WeekSchedule;
  permissions: Permissions;
  options: MemberOptions;
}

export type MemberPatch = Partial<
  ProfileInput & {
    services: ServiceOverride[];
    compensation: Compensation;
    payments: Payments;
    schedule: WeekSchedule;
    permissions: Permissions;
    options: MemberOptions;
    status: MemberStatus;
  }
>;

export const profileInputSchema = z.object({
  firstName: z.string().trim().min(2, "Escribe el nombre"),
  lastName: z.string().trim().min(2, "Escribe el apellido"),
  phone: z.string().trim().min(8, "Escribe el celular"),
  email: z.string().trim().min(1, "Escribe el correo").email("Ese correo no parece válido"),
  levelId: z.string().nullable(),
});

/* --------------------------------------------------------------- claves */

export const TEAM_ROLE_KEYS: Record<TeamRole, AppMessageKey> = {
  owner: "role.owner",
  admin: "role.admin",
  recepcion: "role.reception",
  "barbero-comision": "role.barberCommission",
  "barbero-renta": "role.barberRent",
};

export const ROLE_PITCH_KEYS: Record<TeamRole, AppMessageKey> = {
  owner: "teamMember.role.ownerPitch",
  admin: "teamMember.role.adminPitch",
  recepcion: "teamMember.role.receptionPitch",
  "barbero-comision": "teamMember.role.commissionPitch",
  "barbero-renta": "teamMember.role.rentPitch",
};

export const MEMBER_STATUS_KEYS: Record<MemberStatus, AppMessageKey> = {
  active: "userStatus.active",
  invited: "userStatus.invited",
  inactive: "userStatus.inactive",
};

export const COMPENSATION_TYPE_KEYS: Record<CompensationType, AppMessageKey> = {
  commission: "teamMember.compensation.commission",
  scale: "teamMember.compensation.scale",
  salary: "teamMember.compensation.salary",
};

export const CHANNEL_KEYS: Record<ReminderChannel, AppMessageKey> = {
  email: "teamMember.channel.email",
  sms: "teamMember.channel.sms",
  push: "teamMember.channel.push",
};

export const isBarberRole = (role: TeamRole): boolean => role === "barbero-comision" || role === "barbero-renta";
export const attendsChair = (member: Pick<TeamMember, "role" | "isAlsoBarber">): boolean => isBarberRole(member.role) || member.isAlsoBarber;
export const memberName = (member: Pick<TeamMember, "firstName" | "lastName">): string => `${member.firstName} ${member.lastName}`;

/** Las pestañas de la ficha según el rol: un gerente solo tiene perfil y permisos. */
export type MemberTab = "profile" | "services" | "compensation" | "payments" | "schedule" | "permissions" | "options";

export function memberTabs(role: TeamRole, isAlsoBarber = false): MemberTab[] {
  if (isBarberRole(role) || isAlsoBarber) {
    return ["profile", "services", role === "barbero-renta" ? "payments" : "compensation", "schedule", "permissions", "options"];
  }
  return ["profile", "permissions"];
}

export const MEMBER_TAB_KEYS: Record<MemberTab, AppMessageKey> = {
  profile: "teamMember.tab.profile",
  services: "teamMember.tab.services",
  compensation: "teamMember.tab.compensation",
  payments: "teamMember.tab.payments",
  schedule: "teamMember.tab.schedule",
  permissions: "teamMember.tab.permissions",
  options: "teamMember.tab.options",
};
