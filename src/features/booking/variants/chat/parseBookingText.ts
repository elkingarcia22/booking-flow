import type { DayWindow } from "../agenda/agendaModel";

/**
 * Lo que se entiende de una frase del cliente en la conversación: qué se quiere
 * hacer, con quién, qué día y a qué hora, o una intención suelta («mis citas»,
 * «sí», «¿dónde quedan?»). Sin modelo de lenguaje: palabras del catálogo de la
 * sede y unas cuantas formas de decir días y horas. Lo que no entiende lo deja
 * fuera y la conversación lo pregunta.
 */

export type ChatIntent = "manage" | "restart" | "info" | "call" | "yes" | "no" | "pay" | "another" | "products" | "note" | "help";

export interface ParsedRequest {
  serviceIds: string[];
  /** `undefined` = no lo dijo; `null` = «con cualquiera». */
  barberId?: string | null;
  /** «AAAA-MM-DD». */
  date?: string;
  /** «HH:mm». */
  time?: string;
  window?: DayWindow;
  intent?: ChatIntent;
}

interface Named {
  id: string;
  name: string;
}

interface ParseContext {
  services: readonly (Named & { isCombo?: boolean; popular?: boolean })[];
  barbers: readonly Named[];
  now: Date;
}

const plain = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9:/+\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Palabras que no distinguen un servicio de otro («Corte clásico» es, para el cliente, «corte»). El
 * cabello o el pelo tampoco: «corte de cabello» es un corte, no el «Tinte de cabello».
 */
const STOPWORDS = new Set(["de", "del", "la", "el", "los", "las", "y", "con", "para", "a", "al", "un", "una", "clasico", "clasica", "+", "cabello", "pelo"]);

/** Otras formas de nombrar lo mismo. */
const SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  // Cómo lo dice la gente: «cortarme el pelo», «motilarme», «pintarme el cabello».
  cortar: ["corte"],
  cortarme: ["corte"],
  cortarse: ["corte"],
  motilar: ["corte"],
  motilarme: ["corte"],
  motilada: ["corte"],
  peluquear: ["corte"],
  peluquearme: ["corte"],
  pintar: ["tinte"],
  pintarme: ["tinte"],
  tenir: ["tinte"],
  tenirme: ["tinte"],
  afeitarme: ["afeitado"],
  afeitar: ["afeitado"],
  afeitada: ["afeitado"],
  rasurar: ["afeitado"],
  degradado: ["fade"],
  desvanecido: ["fade"],
  hijo: ["nino"],
  hija: ["nino"],
  nina: ["nino"],
  kid: ["nino"],
  ceja: ["cejas"],
  color: ["tinte"],
  canas: ["tinte"],
  capilar: ["tratamiento"],
  combo: ["corte", "barba"],
  haircut: ["corte"],
  cut: ["corte"],
  beard: ["barba"],
  shave: ["afeitado"],
};

/** «cortes» → «corte», «barbas» → «barba». */
const stem = (word: string): string => (word.length > 4 && word.endsWith("s") && !word.endsWith("cejas") ? word.slice(0, -1) : word);

const tokensOf = (value: string): string[] => plain(value).split(" ").filter(Boolean).map(stem);

/** Desde cuántas letras una palabra se reconoce aunque tenga un error («cortee», «barva»). */
const FUZZY_MIN_LENGTH = 5;

/** ¿Difieren en una sola letra (de más, de menos o cambiada)? */
function oneEditApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** La palabra de la frase que corresponde a `token` del servicio: igual, o con un error si es larga. */
function wordFor(token: string, pool: ReadonlySet<string>): string | undefined {
  if (pool.has(token)) return token;
  if (token.length < FUZZY_MIN_LENGTH) return undefined;
  return [...pool].find((word) => word.length >= FUZZY_MIN_LENGTH && oneEditApart(word, token));
}

function matchServices(words: readonly string[], services: ParseContext["services"]): string[] {
  const pool = new Set(words.flatMap((word) => [word, ...(SYNONYMS[word] ?? [])]));
  const indexed = services.map((service) => ({ service, tokens: tokensOf(service.name).filter((token) => !STOPWORDS.has(token)) }));
  const picked: string[] = [];
  // De a uno: el que más palabras de la frase cubre; a igualdad, el más preciso, el que no es combo y el más pedido.
  for (;;) {
    const scored = indexed
      .filter(({ service }) => !picked.includes(service.id))
      .map(({ service, tokens }) => {
        const hits = tokens.map((token) => wordFor(token, pool)).filter((word): word is string => word !== undefined);
        return { service, hits, ratio: tokens.length > 0 ? hits.length / tokens.length : 0 };
      })
      .filter((entry) => entry.hits.length > 0)
      .sort((a, b) => b.hits.length - a.hits.length || b.ratio - a.ratio || Number(Boolean(a.service.isCombo)) - Number(Boolean(b.service.isCombo)) || Number(Boolean(b.service.popular)) - Number(Boolean(a.service.popular)));
    const best = scored[0];
    if (!best) return picked;
    picked.push(best.service.id);
    best.hits.forEach((token) => pool.delete(token));
  }
}

const ANY_BARBER = /\b(cualquiera|cualquier barbero|quien sea|el que (este|tenga)|me da igual|sin preferencia|el primero libre|anyone|any barber)\b/;

function matchBarber(text: string, barbers: readonly Named[]): string | null | undefined {
  if (ANY_BARBER.test(text)) return null;
  const words = new Set(text.split(" "));
  const found = barbers.find((barber) => {
    const parts = plain(barber.name).split(" ");
    return text.includes(plain(barber.name)) || (parts[0] !== undefined && parts[0].length > 2 && words.has(parts[0]));
  });
  return found ? found.id : undefined;
}

const pad = (value: number): string => String(value).padStart(2, "0");
const keyOf = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const plusDays = (date: Date, days: number): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const WEEKDAYS: Readonly<Record<string, number>> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};
const MONTHS: Readonly<Record<string, number>> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

/** «mañana» como día, no «en la mañana» como franja. */
const TOMORROW = /(^|[^a-z])(?<!la |por la |de la |en la )manana\b/;

function matchDate(text: string, now: Date): string | undefined {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (/\bpasado manana\b/.test(text)) return keyOf(plusDays(today, 2));
  if (/\b(hoy|today|ahora|ya mismo)\b/.test(text)) return keyOf(today);
  if (TOMORROW.test(text) || /\btomorrow\b/.test(text)) return keyOf(plusDays(today, 1));
  const named = /\b(\d{1,2}) de ([a-z]+)\b/.exec(text);
  if (named && MONTHS[named[2]] !== undefined) {
    const candidate = new Date(today.getFullYear(), MONTHS[named[2]], Number(named[1]));
    return keyOf(candidate < today ? new Date(today.getFullYear() + 1, MONTHS[named[2]], Number(named[1])) : candidate);
  }
  const slash = /\b(\d{1,2})\/(\d{1,2})\b/.exec(text);
  if (slash) {
    const candidate = new Date(today.getFullYear(), Number(slash[2]) - 1, Number(slash[1]));
    return keyOf(candidate < today ? new Date(today.getFullYear() + 1, candidate.getMonth(), candidate.getDate()) : candidate);
  }
  for (const [name, weekday] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${name}\\b`).test(text)) return keyOf(plusDays(today, (weekday - today.getDay() + 7) % 7));
  }
  const dayOnly = /\bel (\d{1,2})\b(?! ?(:|h\b|am|pm|de la))/.exec(text);
  if (dayOnly) {
    const day = Number(dayOnly[1]);
    if (day >= 1 && day <= 31) {
      const candidate = new Date(today.getFullYear(), today.getMonth(), day);
      return keyOf(candidate < today ? new Date(today.getFullYear(), today.getMonth() + 1, day) : candidate);
    }
  }
  return undefined;
}

/** Sin «am/pm», una hora de barbería: de 1 a 7 es de la tarde; de 8 a 11, de la mañana. */
const BUSINESS_PM_UNTIL = 7;

function matchTime(text: string): { time?: string; window?: DayWindow } {
  const window: DayWindow | undefined = /\b(en|por|de) la manana\b|\btemprano\b|\bmorning\b/.test(text)
    ? "morning"
    : /\b(en|por|de) la tarde\b|\bafternoon\b/.test(text)
      ? "afternoon"
      : /\b(en|por|de) la noche\b|\bde noche\b|\bevening\b/.test(text)
        ? "evening"
        : undefined;
  if (/\bmediodia\b|\bnoon\b/.test(text)) return { time: "12:00", window };
  const match =
    /\b(?:a las|a la|tipo|como a las|at)\s+(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm|a m|p m|h)\b)?(?:\s+y\s+(media|cuarto))?/.exec(text) ??
    /\b(\d{1,2}):(\d{2})\s*(am|pm|a m|p m)?/.exec(text) ??
    /\b(\d{1,2})\s*(am|pm|a m|p m|h)\b/.exec(text) ??
    /\b(\d{1,2})\s+de la (manana|tarde|noche)\b/.exec(text);
  if (!match) return { window };
  let hours = Number(match[1]);
  let minutes = 0;
  const rest = match.slice(2).filter((part): part is string => typeof part === "string");
  for (const part of rest) {
    if (/^\d{2}$/.test(part)) minutes = Number(part);
    if (part === "media") minutes = 30;
    if (part === "cuarto") minutes = 15;
  }
  const meridiem = rest.find((part) => /^(am|pm|a m|p m|manana|tarde|noche)$/.test(part));
  const isPm = meridiem === "pm" || meridiem === "p m" || meridiem === "tarde" || meridiem === "noche" || window === "afternoon" || window === "evening";
  const isAm = meridiem === "am" || meridiem === "a m" || meridiem === "manana" || window === "morning";
  if (isPm && hours < 12) hours += 12;
  else if (!isAm && hours >= 1 && hours <= BUSINESS_PM_UNTIL) hours += 12;
  if (hours > 23 || minutes > 59) return { window };
  return { time: `${pad(hours)}:${pad(minutes)}`, window };
}

const INTENTS: readonly [ChatIntent, RegExp][] = [
  ["restart", /\b(empezar de nuevo|empezar otra vez|reiniciar|borrar todo|start over)\b/],
  ["manage", /\b(mis citas|mi cita|ver citas|cancelar|reagendar|reprogramar|mover la cita|cambiar (mi|la) cita|my appointments?|cancel|reschedule)\b/],
  ["call", /\b(llamar|llamada|telefono|hablar con (alguien|una persona)|persona real|humano|call)\b/],
  ["info", /\b(horario|horarios|a que hora (abren|cierran)|abren|cierran|direccion|donde (quedan|estan|queda)|ubicacion|como llego|hours|address|where)\b/],
  ["products", /\b(productos?|tienda|cera|pomada|shampoo|aceite|products?)\b/],
  ["note", /\b(nota|foto|referencia|note|photo)\b/],
  ["another", /\b(otra cita|otra persona|alguien mas|tambien (para|mi)|mi hijo|mi hija|mi pareja|another)\b/],
  ["pay", /\b(pagar|confirmar|confirmo|eso es todo|nada mas|asi esta bien|checkout|pay)\b/],
  ["no", /^(no|nop|nel|otra|otro|algo distinto|diferente|no gracias|no thanks)\b/],
  ["yes", /^(si|sip|dale|ok|okay|listo|perfecto|de una|claro|va|bueno|yes|sure|yep)\b/],
  ["help", /\b(ayuda|no entiendo|que puedo|help)\b/],
];

export function parseBookingText(input: string, { services, barbers, now }: ParseContext): ParsedRequest {
  const text = plain(input);
  const words = tokensOf(input).filter((word) => !STOPWORDS.has(word));
  const intent = INTENTS.find(([, pattern]) => pattern.test(text))?.[0];
  const { time, window } = matchTime(text);
  const result: ParsedRequest = { serviceIds: intent === "products" ? [] : matchServices(words, services) };
  const barberId = matchBarber(text, barbers);
  if (barberId !== undefined) result.barberId = barberId;
  const date = matchDate(text, now);
  if (date) result.date = date;
  if (time) result.time = time;
  if (window) result.window = window;
  if (intent) result.intent = intent;
  return result;
}

/** El celular escrito en el chat como número en formato internacional (Colombia por defecto). */
export function phoneFromText(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+57${digits}`;
  if (digits.length === 12 && digits.startsWith("57")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** Un código de seis cifras escrito en el chat. */
const CODE_DIGITS = 6;

export function codeFromText(input: string): string | null {
  // En cualquier formato: «246810», «246 810», «24 68 10», «2-4-6-8-1-0».
  const digits = input.replace(/\D/g, "");
  if (digits.length === CODE_DIGITS) return digits;
  const match = /\b(\d{3})\s?(\d{3})\b/.exec(input);
  return match ? `${match[1]}${match[2]}` : null;
}

export { numberWordsToDigits } from "./spokenNumbers";
