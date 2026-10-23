import { z } from "zod";
import type { AppMessageKey } from "@/app/i18n/types";

/**
 * El contrato del calendario (docs/API_CONTRACT.md, «Calendario»): lo que el
 * backend manda y lo que la pantalla le pide. Todo lo que se lee se valida
 * con Zod al llegar; las enumeraciones traen código y la interfaz decide
 * cómo se leen (por eso aquí van claves de idioma, no textos).
 */

export const workingRangeSchema = z.object({ start: z.string(), end: z.string() });
export type WorkingRange = z.infer<typeof workingRangeSchema>;

export const barberSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  /** El nombre del nivel («Senior»), o nada. */
  level: z.string().nullable(),
  /** Franjas por día de la semana (0 = domingo). */
  workingHours: z.record(z.string(), z.array(workingRangeSchema)),
  acceptsWalkIns: z.boolean(),
  bookingVisible: z.boolean().optional(),
  /** Lo que cobra por cada servicio (su precio en Equipo); sin entrada, el de la carta. */
  prices: z.record(z.string(), z.number()).optional(),
});
export type Barber = z.infer<typeof barberSchema>;

export const clientTypeSchema = z.enum(["walkin", "new", "retained", "frequent", "vip"]);
export type ClientType = z.infer<typeof clientTypeSchema>;

export const noteKindSchema = z.enum(["note", "medication", "allergy"]);
export type NoteKind = z.infer<typeof noteKindSchema>;

export const clientNoteSchema = z.object({ id: z.string(), kind: noteKindSchema, text: z.string(), createdAt: z.string() });
export type ClientNote = z.infer<typeof clientNoteSchema>;

/**
 * Lo que el equipo reporta de la actitud del cliente al cerrar una cita (grosero,
 * llegó tomado, regatea…): no es una nota más, se cuenta aparte y avisa en sus próximas citas.
 */
export const conductReasonSchema = z.enum(["rude", "disrespect", "intoxicated", "haggles", "hygiene", "other"]);
export type ConductReason = z.infer<typeof conductReasonSchema>;

export const conductReportSchema = z.object({
  id: z.string(),
  reasons: z.array(conductReasonSchema),
  text: z.string(),
  /** La cita en la que pasó, si se reportó desde una. */
  appointmentId: z.string().nullable(),
  by: z.string(),
  createdAt: z.string(),
});
export type ConductReport = z.infer<typeof conductReportSchema>;

export const clientSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  type: clientTypeSchema,
  visits: z.number(),
  cancellations: z.number(),
  noShows: z.number(),
  lastVisitAt: z.string().nullable(),
  preferredBarberId: z.string().nullable(),
  visitEveryDays: z.number().nullable(),
  notes: z.array(clientNoteSchema),
  /** La foto del cliente; sin ella se pintan sus iniciales. */
  avatarUrl: z.string().nullable().optional(),
  /** Su correo, si lo dejó: el recibo y los avisos salen por aquí o por SMS. */
  email: z.string().nullable().optional(),
  /** Bloqueado: no reserva en línea ni se le agenda desde el calendario (lo pone el negocio). */
  blocked: z.boolean().optional(),
  /** Solo puede reservar pagando en línea por adelantado (para quien falla seguido). */
  onlineOnly: z.boolean().optional(),
  /** Los reportes de actitud del equipo, el más reciente primero. */
  conduct: z.array(conductReportSchema).optional(),
});
export type Client = z.infer<typeof clientSchema>;

/** `taxPercent`: la tasa con la que se cobra en la sucursal del catálogo (la del artículo o la de la sucursal). */
export const serviceSchema = z.object({ id: z.string(), name: z.string(), category: z.string(), durationMin: z.number(), price: z.number(), taxPercent: z.number().optional(), imageUrl: z.string().nullable().optional() });
export type Service = z.infer<typeof serviceSchema>;

export const productSchema = z.object({ id: z.string(), name: z.string(), category: z.string(), price: z.number(), taxPercent: z.number().optional(), imageUrl: z.string().nullable().optional() });
export type Product = z.infer<typeof productSchema>;

export const catalogSchema = z.object({
  barbers: z.array(barberSchema),
  clients: z.array(clientSchema),
  services: z.array(serviceSchema),
  products: z.array(productSchema),
  /** Los precios ya traen el impuesto (Configuración › Precios). */
  taxInclusive: z.boolean().optional(),
});
export type CalendarCatalog = z.infer<typeof catalogSchema>;

export const appointmentStatusSchema = z.enum(["scheduled", "arrived", "seated", "paid", "no_show", "cancelled"]);
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

export const appointmentSourceSchema = z.enum(["internal", "online", "walkin"]);
export const repeatRuleSchema = z.enum(["none", "weekly", "biweekly", "triweekly", "monthly", "bimonthly", "quarterly"]);
export type RepeatRule = z.infer<typeof repeatRuleSchema>;

export const paymentMethodSchema = z.enum(["cash", "card", "link", "mixed", "transfer"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const historyEntrySchema = z.object({ id: z.string(), at: z.string(), actor: z.string(), event: z.string() });
export type HistoryEntry = z.infer<typeof historyEntrySchema>;

export const paymentSchema = z.object({
  method: paymentMethodSchema,
  tip: z.number(),
  tax: z.number(),
  total: z.number(),
  paidAt: z.string(),
  /** Lo que de ese total ya estaba pagado en línea (propina incluida): en caja se cobró el resto. */
  prepaid: z.number().optional(),
  /** Con `mixed`: cuánto fue en efectivo y cuánto con tarjeta. */
  split: z.object({ cash: z.number(), card: z.number() }).optional(),
  /** Lo descontado en la caja y por qué. */
  discount: z.number().optional(),
  discountReason: z.string().nullable().optional(),
  /** Lo pagado con una tarjeta de regalo del cliente. */
  gift: z.object({ code: z.string(), amount: z.number() }).optional(),
  /** La tarjeta de regalo vendida en el mismo cobro (su código y su monto). */
  giftSale: z.object({ code: z.string(), amount: z.number() }).optional(),
  /** El pago dividido en partes, cada una con su método. */
  parts: z.array(z.object({ method: z.enum(["cash", "card", "link", "transfer"]), amount: z.number(), deviceId: z.string().optional() })).optional(),
  /** El datáfono con que se pasó la tarjeta. */
  deviceId: z.string().optional(),
  /** Con transferencia (Nequi, Daviplata, Bre-B, Zelle, banco…): por dónde llegó y su referencia. */
  transfer: z.object({ via: z.string(), reference: z.string().nullable() }).optional(),
  /** El recargo por tarjeta cobrado, como línea aparte (ya está dentro de `total`). */
  surcharge: z.number().optional(),
  surchargeName: z.string().optional(),
  /** El cupón canjeado en la caja (su descuento va en `discount`). */
  coupon: z.string().optional(),
});
export type Payment = z.infer<typeof paymentSchema>;
export type PaymentPart = NonNullable<Payment["parts"]>[number];

/**
 * Lo que ya quedó resuelto al reservar en línea: lo pagado (tarjeta, anticipo,
 * saldo o tarjeta de regalo), la propina y lo descontado (cupón, cortesía o
 * paquete). La caja cobra solo lo que falta: una reserva pagada no se vuelve a cobrar.
 */
export const onlineSettlementSchema = z.object({ reservation: z.string(), method: z.string(), paid: z.number(), tip: z.number(), discount: z.number() });
export type OnlineSettlement = z.infer<typeof onlineSettlementSchema>;

/** Una devolución de la cuenta: desde la caja (efectivo o tarjeta) o al cancelar la reserva (tarjeta o saldo). */
/** Lo devuelto de una línea de la cuenta: un servicio, un producto (vuelve al inventario) o la propina. */
export const refundItemSchema = z.object({ kind: z.enum(["service", "product", "tip"]), id: z.string(), qty: z.number(), amount: z.number() });
export type RefundItem = z.infer<typeof refundItemSchema>;
export const refundSchema = z.object({ amount: z.number(), to: z.enum(["cash", "card", "credit"]), reason: z.string(), at: z.string(), by: z.string(), items: z.array(refundItemSchema).optional() });
export type Refund = z.infer<typeof refundSchema>;

export const depositRequestSchema = z.object({
  amount: z.number(),
  status: z.enum(["requested", "paid", "cancelled"]),
  requestedAt: z.string(),
  by: z.string(),
  channels: z.array(z.enum(["sms", "email"])),
  paidAt: z.string().optional(),
});
export type DepositRequest = z.infer<typeof depositRequestSchema>;

export const productLineSchema = z.object({ productId: z.string(), qty: z.number() });
export type ProductLine = z.infer<typeof productLineSchema>;

export const appointmentSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  clientId: z.string(),
  barberId: z.string(),
  requestedBarberId: z.string().nullable(),
  serviceIds: z.array(z.string()),
  products: z.array(productLineSchema),
  /** ISO local de la sucursal, sin zona. */
  start: z.string(),
  durationMin: z.number(),
  status: appointmentStatusSchema,
  barberReady: z.boolean(),
  walkIn: z.boolean(),
  source: appointmentSourceSchema,
  repeat: repeatRuleSchema,
  seriesId: z.string().nullable(),
  notes: z.string().nullable(),
  /** Fotos del corte que pidió el cliente al reservar en línea. */
  referencePhotos: z.array(z.string()).optional(),
  /** Precios cambiados al cobrar: por servicio (en el orden de `serviceIds`) y por producto (unitario). */
  servicePrices: z.array(z.number().nullable()).optional(),
  productPrices: z.record(z.string(), z.number()).optional(),
  /** Lo descontado al cobrar (en dinero, antes de impuestos). */
  checkoutDiscount: z.number().optional(),
  createdAt: z.string(),
  createdBy: z.string(),
  history: z.array(historyEntrySchema),
  payment: paymentSchema.nullable(),
  online: onlineSettlementSchema.nullable().optional(),
  /** El anticipo pedido desde la cita (`POST /appointments/:id/deposit`): al pagarse pasa a `online.paid`. */
  depositRequest: depositRequestSchema.nullable().optional(),
  refunds: z.array(refundSchema.extend({ id: z.string() })).optional(),
  /** Si el cliente confirmó que viene (por el enlace del mensaje o porque recepción lo marcó); sin él, sin confirmar. */
  confirmation: z.object({ status: z.enum(["confirmed", "declined", "reschedule_requested"]), at: z.string(), via: z.enum(["link", "reception", "whatsapp"]) }).nullable().optional(),
  /** Riesgo de que no venga, por su historial (ver docs/API_CONTRACT.md). */
  /** Le salió el mensaje de confirmación o el recordatorio y no respondió (ver docs/API_CONTRACT.md). */
  noAnswer: z.boolean().optional(),
  risk: z
    .object({ level: z.enum(["low", "medium", "high"]), probability: z.number(), reasons: z.array(z.enum(["pastNoShows", "cancels", "newClient", "farAhead", "unconfirmed", "prepaid", "confirmed"])) })
    .nullable()
    .optional(),
  /**
   * Las citas enlazadas comparten este id: las que salieron de un mismo
   * agendamiento (varias personas o varias citas de una vez) o las que se
   * enlazaron a mano. `null` o sin él, va suelta.
   */
  linkId: z.string().nullable().optional(),
});
export type Appointment = z.infer<typeof appointmentSchema>;

export const blockCategorySchema = z.enum(["sick", "vacation", "holiday", "lunch", "meeting", "business", "personal"]);
export type BlockCategory = z.infer<typeof blockCategorySchema>;
export const blockRepeatSchema = z.enum(["none", "daily", "weekly", "monthly"]);
export type BlockRepeat = z.infer<typeof blockRepeatSchema>;

export const timeBlockSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  barberId: z.string(),
  category: blockCategorySchema,
  repeat: blockRepeatSchema,
  startDate: z.string(),
  endDate: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  description: z.string().nullable(),
  /** Pendiente de aprobar (lo puso un barbero con la aprobación encendida); sin él, aprobado. */
  status: z.literal("pending").optional(),
  requestedBy: z.string().optional(),
});
export type TimeBlock = z.infer<typeof timeBlockSchema>;

export const calendarDaySchema = z.object({
  date: z.string(),
  appointments: z.array(appointmentSchema),
  blocks: z.array(timeBlockSchema),
  /** Las franjas de cada barbero ese día, con las excepciones de la semana ya aplicadas. */
  hours: z.record(z.string(), z.array(workingRangeSchema)).optional(),
});
export type CalendarDay = z.infer<typeof calendarDaySchema>;

/** El día contra el que se valida un cambio de agenda (mover, estirar): sus citas, bloqueos y excepciones, y su fecha. */
export interface TargetDay {
  data: CalendarDay;
  date: Date;
}

export const monthDaySchema = z.object({ date: z.string(), occupancy: z.number().nullable(), count: z.number() });
export const calendarMonthSchema = z.object({ month: z.string(), days: z.array(monthDaySchema) });

/** Las citas de un rango de días, del más antiguo al más nuevo: de ahí sale el buscador. */
export const calendarRangeSchema = z.object({ from: z.string(), to: z.string(), items: z.array(appointmentSchema) });
export type CalendarRange = z.infer<typeof calendarRangeSchema>;
export type CalendarMonth = z.infer<typeof calendarMonthSchema>;

/**
 * El ritmo de la barbería: cuántas citas suele tener cada día de la semana,
 * sacado de las últimas semanas. De ahí sale si un día es suave o pesado.
 */
export const dayRhythmSchema = z.object({
  /** Cuántas semanas hacia atrás se miraron. */
  weeks: z.number(),
  /** Citas de un día abierto cualquiera, en promedio. */
  average: z.number(),
  /** Por día de la semana (0 = domingo): el promedio de citas y cuántos de esos días hubo con agenda. */
  weekdays: z.array(z.object({ weekday: z.number().int().min(0).max(6), average: z.number(), samples: z.number() })),
});
export type DayRhythm = z.infer<typeof dayRhythmSchema>;

export const waitlistEntrySchema = z.object({
  id: z.string(),
  branchId: z.string(),
  clientId: z.string(),
  serviceId: z.string(),
  barberId: z.string().nullable(),
  slots: z.array(z.object({ date: z.string(), time: z.string() })),
  createdAt: z.string(),
});
export type WaitlistEntry = z.infer<typeof waitlistEntrySchema>;
export const waitlistSchema = z.object({ items: z.array(waitlistEntrySchema) });

export const saleSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  items: z.array(productLineSchema),
  method: paymentMethodSchema,
  tax: z.number().optional(),
  total: z.number(),
  paidAt: z.string(),
});
export type Sale = z.infer<typeof saleSchema>;

/* ------------------------------------------------------------- entradas */

export const appointmentInputSchema = z.object({
  clientId: z.string().min(1, "Elige el cliente"),
  barberId: z.string().min(1, "Elige el barbero"),
  serviceIds: z.array(z.string()).min(1, "Elige el servicio"),
  /** ISO local «AAAA-MM-DDTHH:mm». */
  start: z.string().min(16, "Elige fecha y hora"),
  walkIn: z.boolean(),
  repeat: repeatRuleSchema,
  requestedBarberId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  /** Quien agenda sin reglas (dueño, administrador, recepción, barbero de renta) puede pisar otra cita o un bloqueo. */
  force: z.boolean().optional(),
  /** La propuso Clipper y la persona la aprobó: queda «Clipper · nombre» en el historial. */
  actor: z.literal("clipper").optional(),
});
export type AppointmentInput = z.infer<typeof appointmentInputSchema>;

/** Lo que la agenda cambia de la ficha del cliente, de a una cosa. */
export type ClientRestriction = { blocked: boolean } | { onlineOnly: boolean };

export interface AppointmentPatch {
  status?: AppointmentStatus;
  barberReady?: boolean;
  start?: string;
  barberId?: string;
  /** Otro cliente: solo mientras la cita sigue agendada (no ha llegado). */
  clientId?: string;
  durationMin?: number;
  serviceIds?: string[];
  notes?: string | null;
  /** Las fotos del corte (data URL, hasta 3): reemplazan las que tenía. */
  referencePhotos?: string[];
  /** Enlazarla con otras citas (su id de enlace) o desenlazarla (`null`). */
  linkId?: string | null;
  /** Por qué se hace el cambio («movida 15 min porque la anterior se alargó»): queda en el historial. */
  reason?: string;
  /** Saltarse la regla de no pisar: solo quien agenda sin reglas. */
  force?: boolean;
  /** Quién lo decidió cuando no fue la persona que está en pantalla: el asistente o Clipper (con quien lo aprobó). */
  actor?: "assistant" | "clipper";
  /** Recepción marca que el cliente confirmó (por teléfono, en persona) o lo devuelve a sin confirmar. */
  confirmation?: "confirmed" | "pending";
}

export interface CheckoutInput {
  serviceIds: string[];
  products: ProductLine[];
  tip: number;
  method: PaymentMethod;
  /** El recargo por tarjeta, si Configuración lo tiene encendido. */
  surcharge?: number;
  /** Un cupón de la barbería: reemplaza al descuento a mano y queda anotado su uso. */
  coupon?: string;
  /** Con `mixed`: el reparto entre efectivo y tarjeta de lo que se cobra ahora. */
  split?: { cash: number; card: number };
  /** Precios cambiados en la caja: por servicio (en el orden de `serviceIds`, `null` = el de lista) y por producto (unitario). */
  servicePrices?: (number | null)[];
  productPrices?: Record<string, number>;
  /** Un descuento de la caja: porcentaje o monto, con su motivo. */
  discount?: { type: "percent" | "amount"; value: number; reason?: string };
  /** Pagar (en parte) con una tarjeta de regalo del cliente. */
  giftCode?: string;
  giftAmount?: number;
  /** Vender una tarjeta de regalo en el mismo cobro. */
  giftSale?: { amount: number; recipientName: string; recipientContact?: string };
  /** Dividir el pago en partes (al menos dos), cada una con su método. */
  parts?: PaymentPart[];
  /** El datáfono con que se pasa la tarjeta. */
  deviceId?: string;
  /** Con transferencia (o una parte por transferencia): por dónde llegó y la referencia del comprobante. */
  transfer?: { via: string; reference?: string };
}

export const blockInputSchema = z.object({
  barberId: z.string().min(1, "Elige el barbero"),
  category: blockCategorySchema,
  repeat: blockRepeatSchema,
  startDate: z.string().min(10, "Elige la fecha de inicio"),
  endDate: z.string().min(10, "Elige la fecha fin"),
  startTime: z.string().min(5, "Elige la hora de inicio"),
  endTime: z.string().min(5, "Elige la hora de cierre"),
  description: z.string().nullable(),
});
export type BlockInput = z.infer<typeof blockInputSchema>;

export interface WaitlistInput {
  branchId: string;
  clientId: string;
  serviceId: string;
  barberId: string | null;
  slots: { date: string; time: string }[];
}

export interface SaleInput {
  branchId: string;
  items: ProductLine[];
  method: PaymentMethod;
  /** Quién vendió: comisiona en su nómina; `null`, la venta es de la barbería. */
  sellerId?: string | null;
}

export interface NoteInput {
  kind: NoteKind;
  text: string;
}

export interface ConductInput {
  reasons: ConductReason[];
  text: string;
  appointmentId: string | null;
}

/* --------------------------------------------------------------- claves */

export type CalendarView = "agenda" | "day" | "week" | "month";
export const CALENDAR_VIEWS: readonly CalendarView[] = ["agenda", "day", "week", "month"];

/** El filtro «Equipo»: los que trabajan, todos, o un barbero por id. */
export type TeamFilter = "working" | "all" | (string & {});

export const STATUS_KEYS: Record<AppointmentStatus, AppMessageKey> = {
  scheduled: "calendar.status.scheduled",
  arrived: "calendar.status.arrived",
  seated: "calendar.status.seated",
  paid: "calendar.status.paid",
  no_show: "calendar.status.noShow",
  cancelled: "calendar.status.cancelled",
};

export const CLIENT_TYPE_KEYS: Record<ClientType, AppMessageKey> = {
  walkin: "calendar.clientType.walkin",
  new: "calendar.clientType.new",
  retained: "calendar.clientType.retained",
  frequent: "calendar.clientType.frequent",
  vip: "calendar.clientType.vip",
};

export const REPEAT_KEYS: Record<RepeatRule, AppMessageKey> = {
  none: "calendar.repeat.none",
  weekly: "calendar.repeat.weekly",
  biweekly: "calendar.repeat.biweekly",
  triweekly: "calendar.repeat.triweekly",
  monthly: "calendar.repeat.monthly",
  bimonthly: "calendar.repeat.bimonthly",
  quarterly: "calendar.repeat.quarterly",
};

export const BLOCK_CATEGORY_KEYS: Record<BlockCategory, AppMessageKey> = {
  sick: "calendar.block.category.sick",
  vacation: "calendar.block.category.vacation",
  holiday: "calendar.block.category.holiday",
  lunch: "calendar.block.category.lunch",
  meeting: "calendar.block.category.meeting",
  business: "calendar.block.category.business",
  personal: "calendar.block.category.personal",
};

export const BLOCK_REPEAT_KEYS: Record<BlockRepeat, AppMessageKey> = {
  none: "calendar.block.repeat.none",
  daily: "calendar.block.repeat.daily",
  weekly: "calendar.block.repeat.weekly",
  monthly: "calendar.block.repeat.monthly",
};

export const PAYMENT_METHOD_KEYS: Record<PaymentMethod, AppMessageKey> = {
  cash: "calendar.checkout.cash",
  card: "calendar.checkout.card",
  link: "calendar.checkout.link",
  mixed: "calendar.checkout.mixed",
  transfer: "calendar.checkout.transfer",
};

export const NOTE_KIND_KEYS: Record<NoteKind, AppMessageKey> = {
  note: "calendar.notes.note",
  medication: "calendar.notes.medication",
  allergy: "calendar.notes.allergies",
};

export const CONDUCT_REASON_KEYS: Record<ConductReason, AppMessageKey> = {
  rude: "calendar.conduct.reason.rude",
  disrespect: "calendar.conduct.reason.disrespect",
  intoxicated: "calendar.conduct.reason.intoxicated",
  haggles: "calendar.conduct.reason.haggles",
  hygiene: "calendar.conduct.reason.hygiene",
  other: "calendar.conduct.reason.other",
};
