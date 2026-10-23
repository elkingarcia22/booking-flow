/**
 * Los textos del consentimiento según el país de la sucursal (docs/API_CONTRACT.md, «Clientes»). Cada país pide
 * algo distinto para usar el celular y los datos de un cliente:
 *
 * - Colombia (Ley 1581 de 2012 y Decreto 1377 de 2013): autorización previa, expresa e informada; decir quién
 *   trata los datos, para qué y cómo ejercer los derechos (conocer, actualizar, rectificar, suprimir, revocar), y
 *   guardar prueba de la autorización.
 * - Estados Unidos (TCPA y las reglas de mensajería de los operadores): para promociones por SMS o WhatsApp, un
 *   consentimiento escrito con una acción del cliente (marcar la casilla), que no sea condición de compra, con la
 *   frecuencia, «pueden aplicar tarifas» y STOP para darse de baja.
 * - México (LFPDPPP): aviso de privacidad con el responsable, las finalidades (las necesarias y las voluntarias,
 *   como la mercadotecnia, que se pueden rechazar) y los derechos ARCO.
 *
 * Es texto de producto escrito a partir de esas normas, no asesoría legal: un abogado de cada país debe revisarlo
 * antes de producción. Cada texto lleva su versión, que se guarda con la aceptación como prueba.
 * Sin dependencias: lo usan la reserva, la app y el backend.
 *
 * Todos los avisos terminan igual: el contacto de la barbería (su teléfono) para ejercer los derechos y que
 * los datos se guardan en servidores de proveedores en Estados Unidos (versión «…-2026-10b»).
 */

export type ConsentCountry = "CO" | "US" | "MX" | "GENERIC";
export type ConsentLocale = "es" | "en";

export interface ConsentPack {
  country: ConsentCountry;
  /** La versión del texto que se aceptó: se guarda con el consentimiento. */
  version: string;
  /** La casilla de promociones (nunca marcada por defecto). */
  marketingLabel: string;
  /** Lo que el cliente debe saber al marcarla. */
  marketingDisclosure: string;
  /** Una línea bajo el formulario. */
  privacyShort: string;
  /** El aviso completo, por párrafos. */
  privacyNotice: readonly string[];
  /** Lo que el equipo le dice al cliente antes de anotar el permiso a mano. */
  staffScript: string;
  /** La política de privacidad completa (`/legal/privacidad`). */
  policyHref: string;
}

const COUNTRY_NAMES: Readonly<Record<string, ConsentCountry>> = {
  co: "CO",
  colombia: "CO",
  us: "US",
  usa: "US",
  "estados unidos": "US",
  "united states": "US",
  mx: "MX",
  "méxico": "MX",
  mexico: "MX",
};

/** El país de la sucursal (código o nombre, como venga) a uno de los paquetes; si no hay, el general. */
export function consentCountryOf(country: string | null | undefined): ConsentCountry {
  return COUNTRY_NAMES[(country ?? "").trim().toLowerCase()] ?? "GENERIC";
}

type Texts = Omit<ConsentPack, "country" | "version" | "policyHref">;
const fill = (text: string, shop: string) => text.replace(/\{shop\}/g, shop);

const PACKS: Readonly<Record<ConsentCountry, { version: string; es: Texts; en: Texts }>> = {
  CO: {
    version: "co-2026-10b",
    es: {
      marketingLabel: "Autorizo a {shop} a enviarme promociones y novedades por WhatsApp, SMS y correo.",
      marketingDisclosure: "Es voluntario y no cambia tus citas. Puedes retirar esta autorización cuando quieras respondiendo «BAJA» o pidiéndolo en la barbería.",
      privacyShort: "{shop} trata tus datos para agendar, recordarte y cobrar tus citas, según la Ley 1581 de 2012.",
      privacyNotice: [
        "Responsable: {shop}, que usa Barberlytics para gestionar su agenda.",
        "Finalidades: agendar, confirmar y recordar tus citas; cobrarlas y facturarlas; atender tus solicitudes. Si lo autorizas, también enviarte promociones.",
        "Tus derechos: conocer, actualizar, rectificar y suprimir tus datos, y revocar esta autorización, pidiéndolo a la barbería por su teléfono o en el local.",
        "Las alergias o medicamentos que anote la barbería son datos sensibles: no estás obligado a darlos.",
      ],
      staffScript: "Pregúntale si autoriza recibir promociones por WhatsApp, SMS o correo, dile que es voluntario y que puede retirarlo cuando quiera (Ley 1581 de 2012). Márcalo solo si dijo que sí hoy.",
    },
    en: {
      marketingLabel: "I authorize {shop} to send me promotions and news by WhatsApp, SMS and email.",
      marketingDisclosure: "It's voluntary and doesn't affect your appointments. You can withdraw it any time by replying “STOP” or asking at the shop.",
      privacyShort: "{shop} processes your data to book, remind you of and charge your appointments, under Colombian Law 1581 of 2012.",
      privacyNotice: [
        "Controller: {shop}, which uses Barberlytics to run its schedule.",
        "Purposes: booking, confirming and reminding you of appointments; charging and invoicing them; handling your requests. If you authorize it, also sending you promotions.",
        "Your rights: know, update, correct and delete your data, and revoke this authorization, by asking the shop by phone or in person.",
        "Allergies or medications the shop notes are sensitive data: you don't have to provide them.",
      ],
      staffScript: "Ask whether they authorize promotions by WhatsApp, SMS or email, tell them it's voluntary and can be withdrawn any time (Law 1581 of 2012). Mark it only if they said yes today.",
    },
  },
  US: {
    version: "us-2026-10b",
    es: {
      marketingLabel: "Sí, quiero recibir promociones de {shop} por mensaje de texto, WhatsApp y correo.",
      marketingDisclosure: "Al marcarla aceptas recibir mensajes de promoción automatizados al número que diste. No es condición para reservar ni comprar. Hasta 4 mensajes al mes; pueden aplicar tarifas de mensajes y datos. Responde STOP para darte de baja o HELP para ayuda.",
      privacyShort: "{shop} usa tus datos para tus citas y no los vende. Los mensajes de tus citas no necesitan este permiso.",
      privacyNotice: [
        "Quién: {shop}, que usa Barberlytics para gestionar su agenda.",
        "Para qué: agendar, confirmar y recordar tus citas y cobrarlas. Solo si marcas la casilla, también promociones.",
        "No vendemos tus datos. Puedes pedir verlos o borrarlos escribiendo a la barbería.",
      ],
      staffScript: "Para promociones por texto hace falta su consentimiento escrito: que lo marque él en la reserva o te lo confirme por escrito. Dile que no es condición para reservar y que puede responder STOP.",
    },
    en: {
      marketingLabel: "Yes, I want to receive promotions from {shop} by text message, WhatsApp and email.",
      marketingDisclosure: "By checking this you agree to receive automated marketing messages at the number you gave. Consent is not a condition of booking or purchase. Up to 4 msgs/month; msg & data rates may apply. Reply STOP to opt out or HELP for help.",
      privacyShort: "{shop} uses your data for your appointments and doesn't sell it. Appointment messages don't need this permission.",
      privacyNotice: [
        "Who: {shop}, which uses Barberlytics to run its schedule.",
        "Why: booking, confirming and reminding you of appointments and charging them. Only if you check the box, promotions too.",
        "We don't sell your data. You can ask to see or delete it by writing to the shop.",
      ],
      staffScript: "Promotional texts need their written consent: they check it in the booking or confirm it to you in writing. Tell them it's not a condition of booking and they can reply STOP.",
    },
  },
  MX: {
    version: "mx-2026-10b",
    es: {
      marketingLabel: "Acepto que {shop} use mis datos para enviarme promociones y novedades.",
      marketingDisclosure: "Es una finalidad secundaria y voluntaria: si no la aceptas, igual puedes reservar. Puedes oponerte cuando quieras respondiendo «BAJA» o pidiéndolo en la barbería.",
      privacyShort: "Aviso de privacidad simplificado: {shop} trata tus datos para agendar y cobrar tus citas.",
      privacyNotice: [
        "Responsable: {shop}, que usa Barberlytics para gestionar su agenda.",
        "Finalidades primarias: agendar, confirmar y recordar tus citas, y cobrarlas. Finalidad secundaria (si la aceptas): promociones.",
        "Derechos ARCO: puedes acceder, rectificar, cancelar u oponerte al uso de tus datos, o revocar tu consentimiento, pidiéndolo a la barbería.",
      ],
      staffScript: "Explícale que las promociones son una finalidad voluntaria del aviso de privacidad y que puede oponerse cuando quiera. Márcalo solo si lo aceptó hoy.",
    },
    en: {
      marketingLabel: "I agree that {shop} may use my data to send me promotions and news.",
      marketingDisclosure: "This is a secondary, voluntary purpose: you can book either way. You can object any time by replying “STOP” or asking at the shop.",
      privacyShort: "Simplified privacy notice: {shop} processes your data to book and charge your appointments.",
      privacyNotice: [
        "Controller: {shop}, which uses Barberlytics to run its schedule.",
        "Primary purposes: booking, confirming and reminding you of appointments, and charging them. Secondary purpose (if you accept): promotions.",
        "ARCO rights: you can access, correct, cancel or object to the use of your data, or revoke consent, by asking the shop.",
      ],
      staffScript: "Explain that promotions are a voluntary purpose in the privacy notice and that they can object any time. Mark it only if they accepted today.",
    },
  },
  GENERIC: {
    version: "gen-2026-10b",
    es: {
      marketingLabel: "Quiero recibir promociones y novedades de {shop}.",
      marketingDisclosure: "Es voluntario y no cambia tus citas. Puedes darte de baja cuando quieras.",
      privacyShort: "{shop} usa tus datos solo para tus citas.",
      privacyNotice: ["Quién: {shop}, que usa Barberlytics para gestionar su agenda.", "Para qué: tus citas y, si lo aceptas, promociones.", "Puedes pedir ver, corregir o borrar tus datos a la barbería."],
      staffScript: "Pregúntale si quiere recibir promociones y dile que puede darse de baja cuando quiera. Márcalo solo si dijo que sí hoy.",
    },
    en: {
      marketingLabel: "I want to receive promotions and news from {shop}.",
      marketingDisclosure: "It's voluntary and doesn't affect your appointments. You can unsubscribe any time.",
      privacyShort: "{shop} uses your data only for your appointments.",
      privacyNotice: ["Who: {shop}, which uses Barberlytics to run its schedule.", "Why: your appointments and, if you accept, promotions.", "You can ask the shop to see, correct or delete your data."],
      staffScript: "Ask whether they want promotions and tell them they can unsubscribe any time. Mark it only if they said yes today.",
    },
  },
};

/** Lo que llevan todos los avisos al final: con quién hablar y dónde están los datos. */
const CLOSING: Readonly<Record<ConsentLocale, { contact: string; hosting: string }>> = {
  es: { contact: "Contacto de {shop} para tus datos: {contact}.", hosting: "Tus datos se guardan en servidores de proveedores en Estados Unidos." },
  en: { contact: "Contact {shop} about your data: {contact}.", hosting: "Your data is stored on provider servers in the United States." },
};

const POLICY_HREF = "/legal/privacidad";

/** Los textos de ese país, en ese idioma, con el nombre de la barbería y, si lo hay, su teléfono. */
export function consentPack(country: string | null | undefined, locale: ConsentLocale, shop: string, contact?: string | null): ConsentPack {
  const code = consentCountryOf(country);
  const pack = PACKS[code];
  const texts = pack[locale];
  const closing = [...(contact ? [CLOSING[locale].contact.replace("{contact}", contact)] : []), CLOSING[locale].hosting];
  return {
    country: code,
    version: pack.version,
    marketingLabel: fill(texts.marketingLabel, shop),
    marketingDisclosure: fill(texts.marketingDisclosure, shop),
    privacyShort: fill(texts.privacyShort, shop),
    privacyNotice: [...texts.privacyNotice, ...closing].map((paragraph) => fill(paragraph, shop)),
    staffScript: fill(texts.staffScript, shop),
    policyHref: POLICY_HREF,
  };
}

/** La versión vigente para ese país: la que el servidor guarda con cada aceptación. */
export const consentVersionOf = (country: string | null | undefined): string => PACKS[consentCountryOf(country)].version;

/**
 * El permiso aparte para anotar alergias y medicamentos (datos sensibles en Colombia; datos de salud con leyes
 * propias en algunos estados de EE. UU.). Es explícito, facultativo, distinto del de promociones, y sin él no se
 * guardan. Retirarlo borra lo anotado. Un solo texto para todos los países, con su versión como prueba.
 */
export const HEALTH_CONSENT_VERSION = "health-2026-10";

export interface HealthConsentTexts {
  label: string;
  disclosure: string;
  staffScript: string;
}

const HEALTH_TEXTS: Readonly<Record<ConsentLocale, HealthConsentTexts>> = {
  es: {
    label: "Autorizo a {shop} a anotar mis alergias o medicamentos para cuidar mi atención.",
    disclosure: "Es voluntario y aparte de las promociones. Solo lo ve quien te atiende. Puedes retirarlo cuando quieras y se borra lo anotado.",
    staffScript: "Pregúntale si quiere que anotemos sus alergias o medicamentos para cuidarlo en el servicio. Dile que es voluntario, que solo lo ve quien lo atiende y que puede retirarlo cuando quiera. Márcalo solo si dijo que sí hoy.",
  },
  en: {
    label: "I authorize {shop} to record my allergies or medication to take care of me during service.",
    disclosure: "It's voluntary and separate from promotions. Only whoever serves you sees it. You can withdraw it any time and what was recorded is deleted.",
    staffScript: "Ask whether they want us to record allergies or medication to take care of them. Tell them it's voluntary, only whoever serves them sees it and they can withdraw it any time. Mark it only if they said yes today.",
  },
};

export const healthConsentTexts = (locale: ConsentLocale, shop: string): HealthConsentTexts => {
  const texts = HEALTH_TEXTS[locale];
  return { label: fill(texts.label, shop), disclosure: fill(texts.disclosure, shop), staffScript: fill(texts.staffScript, shop) };
};
