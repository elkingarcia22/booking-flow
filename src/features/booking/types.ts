import { z } from "zod";

/**
 * El contrato de la reserva en línea (docs/API_CONTRACT.md, «Reserva en
 * línea»). Es la cara pública de la barbería: no lleva sesión de la app. El
 * cliente se identifica con su celular; para ver y cambiar sus citas pide un
 * código que devuelve un token propio de la reserva.
 */

export const tipOptionSchema = z.object({ id: z.string(), type: z.enum(["percent", "amount"]), value: z.number() });

export const bookingBranchSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  city: z.string(),
  phone: z.string(),
  /** «09:00» y «19:00»: el horario de hoy. */
  opensAt: z.string(),
  closesAt: z.string(),
  imageUrl: z.string().nullable(),
  barbers: z.number(),
});
export type BookingBranch = z.infer<typeof bookingBranchSchema>;

export const bookingShopSchema = z.object({
  name: z.string(),
  logoUrl: z.string().nullable(),
  /** La versión del logo para fondos oscuros. */
  logoDarkUrl: z.string().nullable(),
  coverUrl: z.string().nullable(),
  phone: z.string(),
  currency: z.string(),
  taxPercent: z.number(),
  minNoticeMinutes: z.number(),
  slotMinutes: z.number(),
  cancelHours: z.number(),
  lateFeePercent: z.number(),
  maxCancellations: z.number(),
  policy: z.string(),
  tipOptions: z.array(tipOptionSchema),
  defaultTipId: z.string().nullable(),
  payment: z.object({ card: z.boolean(), payAtShop: z.boolean() }),
  /** El recargo por pagar con tarjeta que la barbería tiene encendido en Configuración, o nada. */
  cardFee: z.object({ name: z.string(), rate: z.number(), type: z.enum(["percent", "amount"]) }).nullable(),
  /** Paquetes que la barbería vende en línea: N visitas de un servicio, con vencimiento. */
  packages: z.array(z.object({ id: z.string(), name: z.string(), serviceId: z.string(), sessions: z.number(), price: z.number(), validDays: z.number(), regular: z.number().default(0) })).default([]),
  /** El anticipo que se pide a algunos clientes para pagar en la barbería, o nada si no se pide. */
  deposit: z.object({ percent: z.number() }).nullable().default(null),
  branches: z.array(bookingBranchSchema),
});
export type BookingShop = z.infer<typeof bookingShopSchema>;

export const branchDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  zipcode: z.string(),
  phone: z.string(),
  /** Abre la dirección en el mapa del dispositivo. */
  mapsUrl: z.string(),
  /** Los enlaces del negocio (Configuración › Negocio); vacío = no se muestra. */
  links: z.object({ website: z.string(), instagram: z.string(), facebook: z.string() }),
  gallery: z.array(z.string()),
  /** Una entrada por día de la semana (0 = domingo); sin horas es un día cerrado. */
  hours: z.array(z.object({ day: z.number(), opensAt: z.string().nullable(), closesAt: z.string().nullable() })),
  barbers: z.number(),
  /** Cierres que vienen (festivos, vacaciones). */
  closures: z.array(z.object({ startDate: z.string(), endDate: z.string(), description: z.string() })),
});
export type BranchDetail = z.infer<typeof branchDetailSchema>;

export const bookingServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  durationMin: z.number(),
  /** El precio base; cada barbero puede cobrar distinto. */
  price: z.number(),
  imageUrl: z.string().nullable(),
  isCombo: z.boolean(),
  popular: z.boolean(),
});
export type BookingService = z.infer<typeof bookingServiceSchema>;

export const bookingBarberSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  level: z.string().nullable(),
  description: z.string(),
  /** En qué es bueno: «Corte clásico», «Barba a navaja»… */
  skills: z.array(z.string()),
  instagram: z.string(),
  facebook: z.string(),
  gallery: z.array(z.string()),
  rating: z.number(),
  reviews: z.number(),
  /** Los servicios que hace y lo que cobra por cada uno. */
  prices: z.record(z.string(), z.number()),
});
export type BookingBarber = z.infer<typeof bookingBarberSchema>;

export const bookingProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  price: z.number(),
  imageUrl: z.string().nullable(),
});
export type BookingProduct = z.infer<typeof bookingProductSchema>;

export const bookingCatalogSchema = z.object({
  services: z.array(bookingServiceSchema),
  barbers: z.array(bookingBarberSchema),
  products: z.array(bookingProductSchema),
});
export type BookingCatalog = z.infer<typeof bookingCatalogSchema>;

export const bookingGuestSchema = z.object({ id: z.string(), name: z.string(), relation: z.string() });
export type BookingGuest = z.infer<typeof bookingGuestSchema>;

export const lastVisitSchema = z.object({ branchId: z.string(), serviceIds: z.array(z.string()), barberId: z.string().nullable(), at: z.string() });
export type LastVisit = z.infer<typeof lastVisitSchema>;

/**
 * Una tarjeta guardada, tal como la devuelve la pasarela al tokenizarla: la marca,
 * los últimos cuatro dígitos y el vencimiento. Nunca el número completo ni el CVC.
 */
export const savedCardSchema = z.object({
  id: z.string(),
  brand: z.string(),
  last4: z.string(),
  expMonth: z.number(),
  expYear: z.number(),
  holder: z.string(),
});
export type SavedCard = z.infer<typeof savedCardSchema>;

/** Lo que se puede cambiar de una tarjeta guardada: el número queda en la pasarela. */
export interface SavedCardInput {
  holder: string;
  expMonth: number;
  expYear: number;
}

/** Un paquete prepagado del cliente: N visitas de un servicio, con vencimiento. */
export const ownedPackageSchema = z.object({ id: z.string(), name: z.string(), serviceId: z.string(), remaining: z.number(), total: z.number(), expiresAt: z.string() });
export type OwnedPackage = z.infer<typeof ownedPackageSchema>;

export const bookingCustomerSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string(),
  isNew: z.boolean(),
  /** «Reserva y pago solo en línea»: no puede elegir pagar en la barbería. */
  onlineOnly: z.boolean(),
  guests: z.array(bookingGuestSchema),
  lastVisit: lastVisitSchema.nullable(),
  /** Saldo a favor de reembolsos anteriores. */
  credit: z.number(),
  upcoming: z.number(),
  /** Sus tarjetas guardadas para pagar sin volver a escribirlas. */
  cards: z.array(savedCardSchema).default([]),
  /** Para pagar en la barbería debe dejar anticipo (cliente nuevo o con inasistencias). */
  depositRequired: z.boolean().default(false),
  /** Sus paquetes con visitas por usar (los vencidos o agotados no vienen). */
  packages: z.array(ownedPackageSchema).default([]),
  /** Su membresía: avance hacia la próxima cortesía y cuántas tiene por usar. */
  loyalty: z.object({ every: z.number(), progress: z.number(), available: z.number(), rewardServiceId: z.string(), rewardName: z.string().default(""), rewardValue: z.number() }).nullable().default(null),
});
export type BookingCustomer = z.infer<typeof bookingCustomerSchema>;

export const visitSuggestionSchema = z.object({
  /** Cada cuántos días suele volver (su frecuencia de visita). */
  everyDays: z.number(),
  lastVisitAt: z.string(),
  /** El día que le toca: última visita + su ritmo. */
  dueDate: z.string(),
  isOverdue: z.boolean(),
  /** La hora a la que suele venir. */
  usualTime: z.string(),
  branchId: z.string(),
  serviceIds: z.array(z.string()),
  /** Horas libres propuestas, la mejor primero: «AAAA-MM-DDTHH:mm» y quién atiende. */
  options: z.array(z.object({ start: z.string(), barberId: z.string(), sameBarber: z.boolean() })),
});
export type VisitSuggestion = z.infer<typeof visitSuggestionSchema>;
export const suggestionResponseSchema = z.object({ suggestion: visitSuggestionSchema.nullable() });

/**
 * Si el celular ya es de un cliente. Al de siempre se le reconoce sin código para su bienvenida: llega
 * su perfil sin lo sensible (sin correo, tarjetas, saldo, paquetes ni membresía) y una sesión de vista
 * previa que solo sirve para su propuesta de visita. Pagar, la lista de espera y «Mis citas» piden el
 * código. Un número bloqueado responde `returning` sin perfil: lo sabe tras el código.
 */
export const phoneCheckSchema = z.object({ returning: z.boolean(), token: z.string().nullable().default(null), customer: bookingCustomerSchema.nullable().default(null) });
export type PhoneCheck = z.infer<typeof phoneCheckSchema>;

/** El código se manda a cualquier número: la respuesta no dice si es cliente. */
export const otpSentSchema = z.object({ sentTo: z.string(), channel: z.enum(["whatsapp", "sms"]) });
export type OtpSent = z.infer<typeof otpSentSchema>;

export const slotSchema = z.object({ time: z.string(), barberIds: z.array(z.string()) });
export type Slot = z.infer<typeof slotSchema>;
export const availabilitySchema = z.object({ date: z.string(), slots: z.array(slotSchema) });
export type Availability = z.infer<typeof availabilitySchema>;

/** Otro barbero que hace lo mismo y tiene horas: lo que tiene en común y sus primeras horas libres. */
export const alternativeSchema = z.object({ barberId: z.string(), skills: z.array(z.string()), date: z.string(), times: z.array(z.string()) });
export type Alternative = z.infer<typeof alternativeSchema>;
export const alternativesSchema = z.object({ date: z.string(), items: z.array(alternativeSchema) });
export type Alternatives = z.infer<typeof alternativesSchema>;

/** El primer hueco libre desde hoy («Lo antes posible»), o nada en dos semanas. */
export const earliestSchema = z.object({ slot: z.object({ date: z.string(), time: z.string(), barberId: z.string() }).nullable() });
export type Earliest = z.infer<typeof earliestSchema>;

/** Las reseñas públicas de un barbero: nombre con inicial, nota, comentario y fecha. */
export const barberReviewSchema = z.object({ id: z.string(), clientName: z.string(), rating: z.number(), comment: z.string(), createdAt: z.string() });
export type BarberReview = z.infer<typeof barberReviewSchema>;
export const barberReviewsSchema = z.object({ items: z.array(barberReviewSchema), total: z.number() });
export const reviewSavedSchema = z.object({ id: z.string(), rating: z.number() });

/** El paquete comprado (ya en la cuenta del cliente) y con qué se pagó. */
export const packagePurchasedSchema = z.object({ package: ownedPackageSchema, paidWith: z.string() });
export type PackagePurchased = z.infer<typeof packagePurchasedSchema>;
export interface PackagePurchaseInput {
  packageId: string;
  card?: { number: string; name: string; expiry: string; save: boolean };
  savedCardId?: string;
}

/** Una tarjeta de regalo válida y su saldo. */
export const giftCheckSchema = z.object({ code: z.string(), balance: z.number() });
export type GiftCheck = z.infer<typeof giftCheckSchema>;
/** La tarjeta de regalo comprada: su código, a dónde se mandó y con qué se pagó. */
export const giftPurchasedSchema = z.object({ code: z.string(), amount: z.number(), sentTo: z.string(), paidWith: z.string() });
export type GiftPurchased = z.infer<typeof giftPurchasedSchema>;
export interface GiftPurchaseInput {
  amount: number;
  recipientName: string;
  recipientContact: string;
  message: string;
  card?: { number: string; name: string; expiry: string; save: boolean };
  savedCardId?: string;
}

/** El embudo de la reserva en línea para el dueño: cuántas sesiones llegan a cada paso y de dónde vienen. */
export const funnelSchema = z.object({
  days: z.number(),
  demo: z.boolean(),
  started: z.number(),
  bookings: z.number(),
  conversion: z.number(),
  steps: z.array(z.object({ step: z.string(), sessions: z.number(), rate: z.number() })),
  sources: z.array(z.object({ source: z.string(), sessions: z.number(), bookings: z.number() })),
});
export type BookingFunnel = z.infer<typeof funnelSchema>;

export const waitlistWindowSchema = z.enum(["morning", "afternoon", "evening", "any"]);
export type WaitlistWindow = z.infer<typeof waitlistWindowSchema>;
export const waitlistJoinedSchema = z.object({ id: z.string(), date: z.string(), window: waitlistWindowSchema });
export type WaitlistJoined = z.infer<typeof waitlistJoinedSchema>;
export interface WaitlistInput {
  branchId: string;
  date: string;
  serviceIds: readonly string[];
  barberId: string | null;
  window: WaitlistWindow;
}

export const bookedStatusSchema = z.enum(["scheduled", "completed", "cancelled", "no_show"]);
export type BookedStatus = z.infer<typeof bookedStatusSchema>;

export const bookedAppointmentSchema = z.object({
  id: z.string(),
  reservationId: z.string().nullable(),
  branchId: z.string(),
  branchName: z.string(),
  personName: z.string(),
  guestRelation: z.string().nullable(),
  serviceIds: z.array(z.string()),
  serviceNames: z.array(z.string()),
  barberId: z.string(),
  barberName: z.string(),
  barberAvatarUrl: z.string().nullable(),
  noPreference: z.boolean(),
  /** ISO local de la sucursal, sin zona. */
  start: z.string(),
  durationMin: z.number(),
  price: z.number(),
  /** Lo que ya se pagó por esta cita en línea. */
  paid: z.number(),
  status: bookedStatusSchema,
  /** Su calificación, si ya la dejó (solo las citas que ocurrieron se califican). */
  review: z.object({ rating: z.number() }).nullable().default(null),
});
export type BookedAppointment = z.infer<typeof bookedAppointmentSchema>;

/** Dejar una cita fija: las que se agendaron y los días que no hubo hueco. */
export const repeatResultSchema = z.object({ created: z.array(bookedAppointmentSchema), skipped: z.array(z.string()) });
export type RepeatResult = z.infer<typeof repeatResultSchema>;


export const totalsSchema = z.object({
  services: z.number(),
  products: z.number(),
  discount: z.number(),
  subtotal: z.number(),
  tax: z.number(),
  tip: z.number(),
  /** El recargo por pagar con tarjeta (0 si se paga en la barbería o no hay recargo). */
  fee: z.number().default(0),
  feeName: z.string().nullable().default(null),
  gift: z.number().default(0),
  reward: z.number().default(0),
  prepaid: z.number().default(0),
  total: z.number(),
});

/** `gift`: la tarjeta de regalo cubre todo y no hay nada más que cobrar. */
export const payMethodSchema = z.enum(["card", "wallet", "shop", "credit", "gift"]);
export type PayMethod = z.infer<typeof payMethodSchema>;

export const reservationSchema = z.object({
  id: z.string(),
  number: z.string(),
  createdAt: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  email: z.string(),
  phone: z.string(),
  appointments: z.array(bookedAppointmentSchema),
  products: z.array(z.object({ productId: z.string(), name: z.string(), qty: z.number(), price: z.number() })),
  promoCode: z.string().nullable(),
  totals: totalsSchema,
  payment: z.object({ method: payMethodSchema, status: z.enum(["paid", "pending"]), last4: z.string().nullable(), brand: z.string().nullable(), paid: z.number() }),
});
export type Reservation = z.infer<typeof reservationSchema>;

export const myAppointmentsSchema = z.object({ upcoming: z.array(bookedAppointmentSchema), past: z.array(bookedAppointmentSchema), reservations: z.array(reservationSchema) });
export type MyAppointments = z.infer<typeof myAppointmentsSchema>;

/**
 * El código verificado dice quién es: alguien que vuelve (con su perfil), un número nuevo (con una
 * sesión para crear el perfil) o un número bloqueado (sin sesión).
 */
export const otpVerifySchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("known"), token: z.string(), customer: bookingCustomerSchema }),
  z.object({ status: z.literal("new"), token: z.string(), customer: z.null() }),
  z.object({ status: z.literal("blocked"), token: z.null(), customer: z.null() }),
]);
export type OtpVerify = z.infer<typeof otpVerifySchema>;

export const cancelResultSchema = z.object({ appointment: bookedAppointmentSchema, fee: z.number(), refund: z.number(), refundTo: z.enum(["card", "credit", "none"]) });
export type CancelResult = z.infer<typeof cancelResultSchema>;

export const receiptSentSchema = z.object({ channel: z.enum(["email", "sms"]), to: z.string() });
export type ReceiptSent = z.infer<typeof receiptSentSchema>;

/* ------------------------------------------------------------- entradas */

/** El celular no va: es el verificado con el código (la sesión). */
export interface NewCustomerInput {
  firstName: string;
  lastName: string;
  email: string;
  marketing: boolean;
}

export interface ReservationItemInput {
  /** `null` es para quien reserva; si no, un invitado guardado o uno nuevo por nombre. */
  guestId: string | null;
  guestName?: string;
  guestRelation?: string;
  serviceIds: string[];
  /** `null` = sin preferencia: el backend asigna el primer barbero libre. */
  barberId: string | null;
  /** «AAAA-MM-DDTHH:mm». */
  start: string;
  /** Las partes de una misma visita comparten este id: el servidor las anota juntas en la agenda. */
  visitId?: string;
}

/** Quien reserva es el de la sesión (`x-booking-token`), no un id del navegador. */
export interface ReservationInput {
  branchId: string;
  items: ReservationItemInput[];
  products: { productId: string; qty: number }[];
  tipId: string | null;
  promoCode: string | null;
  method: PayMethod;
  /**
   * Tarjeta nueva. El CVC no viaja a nuestro servidor: va directo a la pasarela
   * (aquí, simulada). `save` la guarda tokenizada para la próxima.
   */
  card?: { number: string; name: string; expiry: string; save: boolean };
  /** O una tarjeta guardada; se le pide el CVC otra vez en el celular, que tampoco viaja aquí. */
  savedCardId?: string;
  /** Tarjeta de regalo: paga primero; lo que sobra queda en ella. */
  giftCode?: string;
  /** Usar una cortesía de cliente frecuente (descuenta el servicio de cortesía). */
  useReward?: boolean;
  /** Usar sus paquetes: cada cita que incluya un servicio con visitas por usar descuenta una. */
  usePackages?: boolean;
  /** De dónde vino (UTM del enlace), para saber qué canal trae reservas. */
  utm?: { source: string; medium: string; campaign: string };
  /** Fotos del corte que quiere (hasta 3; data URL JPEG/PNG/WebP, ≤ ~1,5 MB cada una): las ve el barbero en la cita. */
  referencePhotos?: string[];
  notes?: string;
}

export interface RescheduleInput {
  start: string;
  barberId: string | null;
}
