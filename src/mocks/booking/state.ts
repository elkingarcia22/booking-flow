/**
 * Lo que la reserva en línea guarda además de las citas (que viven en la
 * agenda, `db.calendar.appointments`, con `source: "online"`): el recibo de
 * cada reserva, lo que se cobró por cada cita y el saldo a favor que deja un
 * reembolso.
 */

export interface MockBookingLine {
  appointmentId: string;
  /** Para quién es la cita, si no es para quien reserva. */
  guestName: string | null;
  guestRelation: string | null;
  price: number;
  paid: number;
  noPreference: boolean;
}

export interface MockReservation {
  id: string;
  number: string;
  createdAt: string;
  customerId: string;
  branchId: string;
  lines: MockBookingLine[];
  products: { productId: string; name: string; qty: number; price: number }[];
  promoCode: string | null;
  totals: { services: number; products: number; discount: number; subtotal: number; tax: number; taxIncluded?: boolean; tip: number; fee: number; feeName: string | null; gift: number; reward: number; prepaid: number; total: number };
  /** De dónde vino quien reservó (UTM del enlace), si se sabe. */
  utm?: { source: string; medium: string; campaign: string } | null;
  /** La tarjeta de regalo usada (su código), si la hubo. */
  giftCode?: string | null;
  payment: { method: "card" | "wallet" | "shop" | "credit" | "gift" | "pse" | "nequi"; status: "paid" | "pending"; last4: string | null; brand: string | null; paid: number };
}

export interface MockSavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  holder: string;
}

/** Un mensaje programado al cliente (WhatsApp por defecto): lo envía el backend real a su hora. */
/** Lo que respondió un cliente por WhatsApp, ya clasificado y ligado a su cita. */
export interface MockInboundReply {
  /** El id de WhatsApp del mensaje (para no aplicarlo dos veces). */
  id: string;
  at: string;
  from: string;
  intent: "confirm" | "reschedule" | "cancel" | "stop" | "start" | "help" | "other";
  text: string;
  /** Por dónde llegó; sin él, WhatsApp. */
  channel?: "whatsapp" | "sms";
  appointmentId: string | null;
  clientId: string | null;
}

export interface MockOutboxMessage {
  id: string;
  appointmentId: string;
  clientId: string;
  to: string;
  channel: "whatsapp" | "sms" | "email";
  /**
   * `manual`: lo escribió el equipo desde la ficha del cliente y salió por wa.me; no pasa por la cola.
   * `receipt` y `rebookLink`: los mandó el equipo desde el panel de la cita (el recibo, el enlace para
   * reagendar), por SMS o correo; salen en el momento.
   */
  kind: "confirmation" | "rescheduled" | "reminder24h" | "reminder2h" | "reminder" | "slotFreed" | "manual" | "reactivation" | "receipt" | "rebookLink" | "payLink" | "queueAlmost" | "giftCard" | "depositLink" | "birthday" | "thanks" | "reviewRequest" | "campaign";
  /** Con `reminder`: a cuántas horas de la cita sale (las que eligió la barbería en Configuración). */
  hoursBefore?: number;
  sendAt: string;
  /** `failed`: WhatsApp lo rechazó; se ve con su motivo y no se reintenta solo. */
  status: "scheduled" | "sent" | "cancelled" | "failed";
  /** Cuándo salió (o se intentó). */
  sentAt?: string;
  /** Mensajes que no son de una cita (la fila sin cita): su entrada y los valores de la plantilla ya listos. */
  queueEntryId?: string;
  params?: string[];
  /** Ya está en la cola de WhatsApp del servidor (la app solo refleja lo que pase allí). */
  queued?: boolean;
  /** Sin WhatsApp conectado: se dio por enviado sin salir del sistema. */
  simulated?: boolean;
  /** El id que da WhatsApp al mensaje enviado. */
  providerId?: string | null;
  error?: string;
  /** El texto de un mensaje manual y para qué era (gracias, volver, cumpleaños, libre). */
  body?: string;
  purpose?: "thanks" | "rebook" | "birthday" | "free";
  /** Quién lo escribió (mensajes manuales). */
  by?: string;
  /** «Se liberó una hora»: cuál, para reservarla en un toque. */
  offer?: { start: string; barberId: string; branchId: string };
  /** La campaña a la que pertenece (Clientes › Campañas). */
  campaignId?: string;
}

/** Una reseña de un barbero: de una cita que ocurrió (o sembrada para la demo, sin cita). */
export interface MockReview {
  id: string;
  appointmentId: string | null;
  clientId: string | null;
  /** «Marcela G.»: el nombre con la inicial del apellido, así se publica. */
  clientName: string;
  barberId: string;
  rating: number;
  comment: string;
  createdAt: string;
  /** Reseña de ejemplo de la demo (no la dejó un cliente): se muestra marcada y nunca con las reales. */
  sample?: boolean;
}

/** Una tarjeta de regalo: se compra para alguien y se gasta en reservas hasta agotar el saldo. */
export interface MockGiftCard {
  code: string;
  initial: number;
  balance: number;
  buyerId: string | null;
  recipientName: string;
  recipientContact: string;
  message: string;
  createdAt: string;
  /** El mensaje con el código que se le mandó a quien la recibe (el último, si se reenvió). */
  messageId?: string | null;
}

/** Llegó a un paso de la reserva: anónimo, para medir dónde se van. */
export interface MockFunnelEvent {
  sessionId: string;
  step: string;
  at: string;
  /** Enlace público, widget en su sitio o vista previa del panel (esta no cuenta). */
  surface: "link" | "widget" | "preview";
  /** De dónde vino: `utm_source`, o «directo». */
  source: string;
}

/** Un paquete comprado: cuántas visitas le quedan de qué servicio, y hasta cuándo. */
export interface MockOwnedPackage {
  id: string;
  packageId: string;
  name: string;
  serviceId: string;
  remaining: number;
  total: number;
  expiresAt: string;
}

export interface MockBookingState {
  reservations: MockReservation[];
  /** id de cliente → saldo a favor. */
  credits: Record<string, number>;
  /** Cada uso de un cupón (reserva o caja): con esto se cumplen los topes. */
  couponRedemptions?: { code: string; clientId: string; at: string; source: "booking" | "checkout"; ref: string }[];
  /** id de cliente → cancelaciones hechas en línea. */
  cancellations: Record<string, number>;
  /** Pasos a los que llegó cada sesión (ver funnel.ts). */
  funnel?: MockFunnelEvent[];
  /** id de cliente → los paquetes que compró y cuántas visitas le quedan. */
  ownedPackages?: Record<string, MockOwnedPackage[]>;
  /** id de cliente → cortesías de cliente frecuente ya usadas. */
  loyaltyUsed?: Record<string, number>;
  /** Tarjetas de regalo compradas (la de prueba de la demo se suma sola, ver giftCards.ts). */
  giftCards?: MockGiftCard[];
  /** Reseñas que dejaron los clientes tras su cita (las de la demo se derivan, ver reviews.ts). */
  reviews?: MockReview[];
  /** Confirmaciones y recordatorios programados por cada reserva (ver reminders.ts). */
  outbox?: MockOutboxMessage[];
  /** Las respuestas de los clientes por WhatsApp ya aplicadas (ver replies.ts). */
  inbound?: MockInboundReply[];
  /** Hasta qué respuesta de la bandeja del servidor se aplicó. */
  inboxCursor?: number;
  /** id de cliente → sus tarjetas tokenizadas. Sin entrada, la clienta de la demo trae las suyas (`DEMO_CARDS`). */
  cards?: Record<string, MockSavedCard[]>;
  /** Ya se le pusieron a la clienta de la demo sus personas guardadas (una sola vez). */
  demoGuestsSeeded?: boolean;
}

export const emptyBooking = (): MockBookingState => ({ reservations: [], credits: {}, cancellations: {} });

/**
 * Celulares de la demo. Cualquier otro número es un cliente nuevo; uno de la
 * agenda (`db.calendar.clients`) también se reconoce.
 */
export const DEMO_PHONES: Readonly<Record<string, string>> = {
  "+573202172738": "cli_001",
  "+573005550101": "cli_001",
  "+573005550102": "cli_003",
};

/** La gente ligada al perfil de la clienta de la demo: para ver «Tu gente» al reservar para otro. */
export const DEMO_GUESTS = [
  { id: "gst_demo_santi", name: "Santiago", relation: "Hijo o hija", visits: 4 },
];
export const DEMO_GUESTS_CLIENT = "cli_001";

/** Las tarjetas que la clienta de la demo ya guardó en otras reservas. */
export const DEMO_CARDS: readonly MockSavedCard[] = [
  { id: "card_demo_visa", brand: "Visa", last4: "4242", expMonth: 12, expYear: 2028, holder: "Marcela Gómez" },
  { id: "card_demo_mc", brand: "Mastercard", last4: "4444", expMonth: 9, expYear: 2027, holder: "Marcela Gómez" },
];

/** Un número bloqueado por la barbería, para ver ese caso. */
export const BLOCKED_PHONE = "+573009999999";

/** El código que «llega» por SMS en la demo para entrar a «Mis citas». */
export const DEMO_OTP = "246810";
