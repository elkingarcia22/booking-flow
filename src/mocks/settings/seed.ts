import { GENERAL_BOOKING_APPEARANCE } from "@/lib/booking/appearance";
import { defaultWeekHours } from "@/features/branches/branchHours";
/**
 * La configuración del backend simulado. Dos formas de dato:
 *
 * - **Documentos**: un ajuste que es un solo objeto y se guarda entero
 *   (perfil del negocio, reservas, propinas…). Viven en `sections`.
 * - **Listas**: ajustes que son una colección con alta, edición y borrado
 *   (sucursales, cierres, impuestos, datáfonos, pasarelas). Viven en `lists`.
 *
 * Los enlaces y el identificador del widget son de mentira: los reales salen
 * de la cuenta y no se copian a un mock.
 */

export type MockSettingsSection = "business" | "booking" | "pricing" | "tips" | "cardFee" | "commissions" | "payrollCycle" | "notifications" | "company" | "billing" | "marketing";
/** Los datáfonos de la demo: la caja, recepción y dos puestos. */
export const SEED_DEVICES = [
  { id: "dev_caja", name: "Caja principal", serial: "SN-48201", tpn: "TPN-7731", hasAuthKey: true },
  { id: "dev_recepcion", name: "Recepción", serial: "SN-48209", tpn: "TPN-7738", hasAuthKey: true },
  { id: "dev_puesto1", name: "Puesto 1", serial: "SN-48217", tpn: "TPN-7745", hasAuthKey: true },
  { id: "dev_puesto2", name: "Puesto 2", serial: "SN-48224", tpn: "TPN-7752", hasAuthKey: true },
] as const;

/**
 * Una base guardada con los dos datáfonos de antes («Datáfono de la caja» y «Datáfono móvil») pasa a
 * los cuatro de ahora; si alguien ya los cambió en Configuración, se respetan.
 */
export function upgradeDevices<T extends { id: string; name?: unknown }>(devices: readonly T[]): T[] | null {
  const ids = devices.map((device) => device.id).join(",");
  const untouched = ids === "dev_caja,dev_movil" && devices[0].name === "Datáfono de la caja" && devices[1].name === "Datáfono móvil";
  return untouched ? (SEED_DEVICES.map((device) => ({ ...device })) as unknown as T[]) : null;
}

export type MockSettingsList = "branches" | "closures" | "taxGroups" | "devices" | "gateways" | "coupons";

export interface MockListItem {
  id: string;
  [key: string]: unknown;
}

export interface MockSettingsState {
  sections: Record<MockSettingsSection, Record<string, unknown>>;
  lists: Record<MockSettingsList, MockListItem[]>;
  /** La clave secreta de cada pasarela, por su id: se guarda pero nunca se devuelve. */
  gatewaySecrets: Record<string, string>;
}

const DEMO_ACCOUNT = "demo-barberia";
const WIDGET_ID = "00000000-demo-0000-0000-000000000000";

export const DEFAULT_POLICY = [
  "Puedes reservar tu cita en línea cuando quieras.",
  "Para cancelar o reprogramar, hazlo con al menos <<time_for_cancel>> de antelación.",
  "Si cancelas más tarde se cobra el <<fee_cancellation>>% del servicio.",
  "Puedes cancelar en línea hasta <<max_cancellations>> veces; después tendrás que llamarnos.",
].join("\n");

/** Pone al día una configuración guardada en el navegador (hoy: los datáfonos de la demo). */
export function upgradeSettings(settings: MockSettingsState): MockSettingsState {
  const devices = upgradeDevices(settings.lists.devices ?? []);
  // Las sucursales guardadas antes del horario por sede: el del negocio, de lunes a sábado.
  const business = settings.sections.business as { openTime?: string; closeTime?: string };
  const branches = settings.lists.branches.map((item) => (item.hours ? item : { ...item, hours: defaultWeekHours(business.openTime, business.closeTime) }));
  // Lo guardado antes de los cupones y de Marketing: los de la demo y todo apagado salvo los referidos.
  const sections = settings.sections.marketing ? settings.sections : { ...settings.sections, marketing: defaultMarketing() };
  return { ...settings, sections, lists: { ...settings.lists, branches, coupons: settings.lists.coupons ?? defaultCoupons(), ...(devices ? { devices } : {}) } };
}

/** Los cupones con los que nace la demo (los de antes, ahora editables). */
function defaultCoupons(): MockListItem[] {
  const base = { validFrom: null, validTo: null, serviceIds: [], maxUses: null, minAppointments: null, firstVisitOnly: false, perClient: null, active: true, createdAt: "2026-01-06T12:00:00.000Z" };
  return [
    { ...base, id: "cpn_bienvenido", code: "BIENVENIDO10", type: "percent", value: 10, firstVisitOnly: true, perClient: 1, description: "Bienvenida: se aplica solo a quien reserva por primera vez." },
    { ...base, id: "cpn_familia", code: "FAMILIA15", type: "percent", value: 15, minAppointments: 2, description: "Dos o más citas en la misma reserva." },
    { ...base, id: "cpn_barber5", code: "BARBER5", type: "amount", value: 5, perClient: 1, description: "" },
  ];
}

/** Referidos y mensajes automáticos. */
function defaultMarketing(): Record<string, unknown> {
  return {
    referral: { enabled: true, reward: 5, maxPerReferrer: 10 },
    automations: { birthday: { enabled: false }, thanks: { enabled: false, delayHours: 3 }, review: { enabled: false, delayHours: 2 } },
  };
}

export function seedSettings(): MockSettingsState {
  return {
    // La de la demo tiene forma de clave de prueba de Stripe; no es de ninguna cuenta.
    gatewaySecrets: { gw_stripe: "sk_test_demo_barberia" },
    sections: {
      business: { timezone: "America/New_York", timeFormat: "12h", weekStart: "monday", openTime: "09:00", closeTime: "19:00", holidays: ["new-year", "independence", "thanksgiving", "christmas"], website: "https://barberia.example.com", instagram: "https://instagram.com/barberlytics", facebook: "https://facebook.com/barberlytics", googleMaps: "" },
      booking: {
        minNotice: 30,
        minNoticeUnit: "minutes",
        slotInterval: 30,
        surge: { enabled: false, occupancy: 80, increase: 10, increaseType: "percent" },
        waitlist: { acceptMinutes: 15, arriveMinutes: 15 },
        paymentMethods: { card: true, payAtShop: true },
        // Sin anticipo de entrada: quien paga en la barbería no deja nada. Se activa en Configuración (nuevo o tras faltar).
        deposit: { enabled: false, percent: 30, newClients: true, afterNoShows: 1 },
        // Cada 10 visitas, un corte clásico de cortesía.
        loyalty: { enabled: true, every: 10, rewardServiceId: "svc_corte" },
        // Paquetes prepagados: varias visitas de un servicio con descuento, con vencimiento.
        packages: [
          { id: "pkg_cortes4", name: "4 cortes clásicos", serviceId: "svc_corte", sessions: 4, price: 120, validDays: 120 },
          { id: "pkg_combo3", name: "3 corte + barba", serviceId: "svc_combo", sessions: 3, price: 160, validDays: 90 },
          { id: "pkg_fade6", name: "6 fades", serviceId: "svc_fade", sessions: 6, price: 230, validDays: 180 },
        ],
        cancelHours: 3,
        // Los bloqueos que pone un barbero (de renta) esperan aprobación: se ven rayados hasta entonces.
        blocksNeedApproval: true,
        lateFeePercent: 10,
        maxCancellations: 5,
        policy: DEFAULT_POLICY,
        // La reserva arranca con la marca por defecto (Configuración › Reserva online › Apariencia).
        appearance: GENERAL_BOOKING_APPEARANCE,
        links: { widgetId: WIDGET_ID, scriptUrl: "https://widgets.example.com/barberia-widgets.js", bookingUrl: `https://reservas.example.com/book/${DEMO_ACCOUNT}`, frontDeskUrl: `https://reservas.example.com/front-desk/${DEMO_ACCOUNT}`, portalUrl: `https://reservas.example.com/portal/${DEMO_ACCOUNT}` },
      },
      pricing: { currency: "USD", taxInclusive: false },
      tips: { options: [{ id: "tip_1", type: "percent", value: 15 }, { id: "tip_2", type: "percent", value: 20 }, { id: "tip_3", type: "percent", value: 25 }, { id: "tip_4", type: "amount", value: 5 }], defaultId: "tip_2", checkout: "unset" },
      // Encendido en la demo: se ve en el cobro de la agenda y en la reserva en línea (pagar en la barbería lo evita).
      cardFee: { enabled: true, name: "Recargo por tarjeta", rate: 3, type: "percent" },
      commissions: { deductDiscounts: true, deductTaxes: true, deductServiceCost: false, deductProductCost: false },
      payrollCycle: { cycle: "weekly", startDay: 1 },
      notifications: { toggles: {}, thresholds: {}, reminderHours: [24, 2] },
      // Referidos encendidos (5 de saldo a favor para cada uno); los mensajes automáticos, apagados hasta que el dueño los prenda.
      marketing: defaultMarketing(),
      company: { name: "Barbería Demo", legalName: "Barbería Demo LLC", identification: "12-3456789", website: "https://barberia.example.com", phone: "+16175550100", country: "Estados Unidos" },
      billing: {
        plan: { name: "Grow", cycle: "annual", price: 50, nextInvoiceAt: "2026-10-28" },
        details: { name: "Barbería Demo LLC", address: "88 Newbury St", city: "Boston", state: "Massachusetts", email: "facturas@barberia.example.com" },
        method: { brand: "visa", last4: "4242" },
        invoices: [
          { id: "inv_002", concept: "Grow", total: 50, date: "2026-07-27" },
          { id: "inv_001", concept: "Grow (prueba gratis)", total: 0, date: "2026-05-25" },
        ],
      },
    },
    lists: {
      branches: [
        { id: "ma", name: "Massachusetts", legalName: "Barbería Demo LLC", taxId: "12-3456789", country: "Estados Unidos", state: "Massachusetts", city: "Boston", address: "88 Newbury St", zipcode: "02116", phone: "+16175550100", currency: "USD", language: "es", timezone: "America/New_York", taxGroupId: "tax_ma", gatewayId: "gw_stripe", description: "", hours: defaultWeekHours("08:00", "22:00"), status: "active", createdAt: "2026-01-06T12:00:00.000Z" },
        { id: "nc", name: "North Carolina", legalName: "Barbería Demo LLC", taxId: "12-3456789", country: "Estados Unidos", state: "North Carolina", city: "Charlotte", address: "210 W Trade St", zipcode: "28202", phone: "+17045550110", currency: "USD", language: "es", timezone: "America/New_York", taxGroupId: "tax_nc", gatewayId: "gw_stripe", description: "", hours: defaultWeekHours("09:00", "20:00"), status: "active", createdAt: "2026-02-10T12:00:00.000Z" },
        { id: "ri", name: "Rhode Island", legalName: "Barbería Demo LLC", taxId: "12-3456789", country: "Estados Unidos", state: "Rhode Island", city: "Providence", address: "134 Thayer St", zipcode: "02906", phone: "+14015550120", currency: "USD", language: "es", timezone: "America/New_York", taxGroupId: "tax_ri", gatewayId: "gw_stripe", description: "", hours: defaultWeekHours("08:00", "21:00"), status: "active", createdAt: "2026-03-18T12:00:00.000Z" },
        { id: "ut", name: "Utah", legalName: "Barbería Demo LLC", taxId: "12-3456789", country: "Estados Unidos", state: "Utah", city: "Salt Lake City", address: "55 W 200 S", zipcode: "84101", phone: "+18015550130", currency: "USD", language: "es", timezone: "America/Denver", taxGroupId: "tax_ut", gatewayId: "gw_stripe", description: "", hours: defaultWeekHours("09:00", "19:00"), status: "active", createdAt: "2026-04-22T12:00:00.000Z" },
      ],
      coupons: defaultCoupons(),
      closures: [{ id: "cls_001", startDate: "2026-12-24", endDate: "2026-12-26", branchIds: ["ma", "nc", "ri", "ut"], description: "Navidad" }],
      // Uno por estado (tasas de demostración, no de una declaración real) y el IVA para una sucursal en Colombia.
      taxGroups: [
        { id: "tax_ma", name: "Massachusetts", taxes: [{ name: "Estatal", percent: 6.25 }] },
        { id: "tax_nc", name: "North Carolina", taxes: [{ name: "Estatal", percent: 4.75 }, { name: "Condado", percent: 2.5 }] },
        { id: "tax_ri", name: "Rhode Island", taxes: [{ name: "Estatal", percent: 7 }] },
        { id: "tax_ut", name: "Utah", taxes: [{ name: "Estatal", percent: 4.85 }, { name: "Local", percent: 2.4 }] },
        { id: "tax_co_iva", name: "IVA Colombia", taxes: [{ name: "IVA", percent: 19 }] },
      ],
      // Cuatro datáfonos: el cobro con tarjeta elige en una lista con cuál se pasa.
      devices: SEED_DEVICES.map((device) => ({ ...device })),
      gateways: [{ id: "gw_stripe", provider: "stripe", name: "Stripe", publicKey: "pk_test_demo_barberia", hasSecret: true, connected: true }],
    },
  };
}
