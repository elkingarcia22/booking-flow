import type { ChatReply } from "@/lib/chat";
import type { ChatTurn } from "./chatKit";
import type { QuestionKind } from "./chatQuestions";
import { numberWordsToDigits } from "./spokenNumbers";

/** Cuántas opciones se dicen en voz alta; con más, se dicen las primeras y se remite a la lista. */
const SPOKEN_OPTIONS = 4;
const SAMPLE_OPTIONS = 3;

export interface VoiceReplyLabels {
  /** «Puede ser {list}.»: todas las opciones caben en la frase. */
  oneOf: (list: string) => string;
  /** «Por ejemplo, {list}. Las demás las ves en pantalla.»: se dicen algunas. */
  someOf: (list: string) => string;
  /** «¿Cuándo quieres venir?»: el día y la hora en una sola pregunta abierta. */
  when: string;
  /** «Tengo {list}. ¿Te sirve alguna?…»: unas pocas horas propuestas, dichas como lo haría una persona. */
  propose: (list: string) => string;
}

/**
 * Preguntas que en voz se hacen abiertas, sin leer la lista: la persona ya sabe qué contestar
 * («corte y barba», «con Andrés», «el viernes a las 5») y oír las opciones alarga la llamada.
 * Siguen en pantalla para tocarlas. Las demás (sí o no, qué hacemos sin horas…) sí se leen.
 */
const OPEN_KINDS: ReadonlySet<QuestionKind> = new Set(["home", "branch", "person", "relation", "services", "barber", "day", "time", "products", "tip", "more", "editPick", "manage"]);

/**
 * ¿Se leen las opciones? Las de las preguntas abiertas, no; salvo las horas cuando son unas pocas
 * propuestas (la pedida no estaba libre: «a las 4 y 30 o Andrés a las 5»), que sin decirlas no se sabe qué elegir.
 */
const speaksOptions = (kind: QuestionKind, count: number) => !OPEN_KINDS.has(kind) || (kind === "time" && count <= SPOKEN_OPTIONS);

/** Instrucciones para escribir que, dichas, se vuelven para hablar; y lo que solo importa al teclear. */
const VOICE_WORDING: Record<string, ReadonlyArray<[RegExp, string]>> = {
  es: [
    // Los ejemplos y los formatos son para quien escribe: dichos, alargan y suenan a formulario.
    [/\s*(?:Por ejemplo|Ej)\.?:?\s[^.!?]*[.!?]?/g, ""],
    [/\s*Escr[ií]bel[oa] así:[^.!?]*[.!?]?/g, ""],
    [/,? \*{0,2}solo los números\*{0,2}/g, ""],
    [/:\s*\d{2}\/\d{2}(?=[.\s]|$)/g, ""],
    [/,? sin espacios ni signos/g, ""],
    // Tras mandar el código: reenviar o cambiar el número se entienden si se dicen; no hace falta enseñarlos.
    [/\s*¿No te llegó\?[\s\S]*$/, ""],
    [/\bpor WhatsApp\b/g, "por mensaje de texto"],
    [/(?:Escr[ií]belo|Dímelo) aquí/g, "Dímelo"],
    [/\bEscr[ií]beme\b/g, "Dime"],
    [/\bescr[ií]beme\b/g, "dime"],
    [/\bEscr[ií]belo\b/g, "Dímelo"],
    [/\bescr[ií]belo\b/g, "dímelo"],
    [/\bEscr[ií]bela\b/g, "Dímela"],
    [/\bescr[ií]bela\b/g, "dímela"],
    [/\bEscribe\b/g, "Di"],
    [/\bescribe\b/g, "di"],
    // Dicho en voz, como lo pediría una persona (y sin cerrar en «tu…», que la voz alargaba).
    [/Dime tu (\*{0,2})número de celular\1\./g, "¿Me das tu $1número de celular$1?"],
    [/Dímelo (?:aquí )?abajo/g, "Dímelo"],
    [/\s*Elige en la lista o escr[ií]bemelo\./g, ""],
    [/\bPuedes escribirme\b/g, "Puedes pedirme"],
    [/,? como \*{0,2}MM\/AA\*{0,2}/g, ""],
  ],
  en: [
    [/\s*(?:For example|E\.g)\.?:?\s[^.!?]*[.!?]?/g, ""],
    [/,? \*{0,2}digits only\*{0,2}/g, ""],
    [/:\s*\d{2}\/\d{2}(?=[.\s]|$)/g, ""],
    [/,? no spaces or symbols/g, ""],
    [/\s*Didn['’]t get it\?[\s\S]*$/, ""],
    [/\bon WhatsApp\b/g, "by text message"],
    [/\bvia WhatsApp\b/g, "by text message"],
    [/(?:Type it|Tell me) here\b/g, "Tell me"],
    [/\bby WhatsApp\b/g, "by text message"],
    [/\bType\b/g, "Tell me"],
    [/\btype\b/g, "tell me"],
  ],
};

const ES_WEEKDAYS: Record<string, string> = { lun: "lunes", mar: "martes", mie: "miércoles", jue: "jueves", vie: "viernes", sab: "sábado", dom: "domingo" };
const ES_MONTHS: Record<string, string> = { ene: "enero", feb: "febrero", mar: "marzo", abr: "abril", may: "mayo", jun: "junio", jul: "julio", ago: "agosto", sep: "septiembre", sept: "septiembre", oct: "octubre", nov: "noviembre", dic: "diciembre" };
const EN_WEEKDAYS: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const EN_MONTHS: Record<string, string> = { jan: "January", feb: "February", mar: "March", apr: "April", jun: "June", jul: "July", aug: "August", sep: "September", sept: "September", oct: "October", nov: "November", dec: "December" };

const bare = (word: string) => word.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
/** Conserva la mayúscula inicial de lo que se reemplaza («Jue» → «Jueves»). */
const sameCase = (original: string, word: string) => (original[0] === original[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word);

/** «6:00 p. m.» → «a las 6 de la tarde»; «9:30 a. m.» → «a las 9 y 30 de la mañana». */
function spokenTimeEs(prefix: string | undefined, hours: string, minutes: string, meridiem: string): string {
  const hour = Number(hours);
  const isPm = meridiem.toLowerCase() === "p";
  const part = !isPm ? "de la mañana" : hour === 12 ? "del mediodía" : hour < 7 ? "de la tarde" : "de la noche";
  const lead = prefix ?? (hour === 1 ? "a la" : "a las");
  return `${lead} ${hour}${Number(minutes) > 0 ? ` y ${Number(minutes)}` : ""} ${part}`;
}

/**
 * Celulares y códigos como se dictan: un celular en grupos de tres, tres, dos y dos («300, 123, 45, 67»);
 * uno oculto, por sus últimas cifras de a dos; un código de seis, de a dos. Las comas son las pausas.
 */
function spokenDigits(text: string, language: string): string {
  const ending = language === "es" ? "al número terminado en" : "to the number ending in";
  return text
    .replace(language === "es" ? /\b(?:a|al)\s+[•*]{2,}\s?(\d{2})(\d{2})\b/g : /\bto\s+[•*]{2,}\s?(\d{2})(\d{2})\b/g, `${ending} $1, $2`)
    .replace(/\b(\d{3})(\d{3})(\d{2})(\d{2})\b/g, "$1, $2, $3, $4")
    .replace(/\b(\d{3})(\d{2})(\d{2})\b/g, "$1, $2, $3")
    .replace(/\b(\d{2})(\d{2})(\d{2})\b/g, "$1, $2, $3");
}

/** Las abreviaturas de fechas, horas y precios del chat, dichas completas (la voz las lee letra por letra). */
function spokenNumbers(raw: string, language: string): string {
  const text = spokenDigits(raw, language);
  if (language === "es")
    return text
      .replace(/(?:\b(a las|a la)\s+)?\b(\d{1,2}):(\d{2})\s*([ap])\.?\s?m\.?/gi, (_, prefix: string | undefined, h: string, m: string, ap: string) => spokenTimeEs(prefix, h, m, ap))
      .replace(/\b(lun|mar|mi[eé]|jue|vie|s[aá]b|dom)\.?,\s*/gi, (_, day: string) => `${sameCase(day, ES_WEEKDAYS[bare(day)] ?? day)} `)
      .replace(/\bde (ene|feb|mar|abr|may|jun|jul|ago|sept?|oct|nov|dic)\b\.?/gi, (_, month: string) => `de ${ES_MONTHS[bare(month)] ?? month}`)
      .replace(/US\$\s?([\d.,]+)/g, "$1 dólares")
      .replace(/\$\s?([\d.,]+)/g, "$1 pesos")
      .replace(/(\d)\s?%/g, "$1 por ciento");
  return text
    .replace(/(?:\b(at\s))?\b(\d{1,2}):(\d{2})\s*([AP])\.?\s?M\.?/gi, (_, at: string | undefined, h: string, m: string, ap: string) => `${at ?? "at "}${Number(h)}${Number(m) > 0 ? `:${m}` : ""} ${ap.toUpperCase()}M`)
    .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b(?=,)/gi, (day: string) => EN_WEEKDAYS[day.toLowerCase()] ?? day)
    .replace(/\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b\.?(?= \d)/gi, (month: string) => EN_MONTHS[month.toLowerCase().replace(".", "")] ?? month)
    .replace(/US\$\s?([\d.,]+)/g, "$1 dollars")
    .replace(/(\d)\s?%/g, "$1 percent");
}

/**
 * El texto de Clipper como se dice en una llamada: «Dime tu número» en vez de «Escríbeme tu número», y
 * las fechas, horas y precios completos («el viernes 9 de octubre a las 6 de la tarde», «71 dólares»).
 */
export function forVoice(text: string, locale: string): string {
  const language = locale.slice(0, 2);
  const rules = VOICE_WORDING[language] ?? [];
  const spoken = spokenNumbers(rules.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text), language);
  // «… 3:00 p. m.» cerraba la frase con el punto de «m.»: dicha completa, el punto se conserva.
  return /[.!?]$/.test(text.trim()) && !/[.!?…]$/.test(spoken.trim()) ? `${spoken.trim()}.` : spoken;
}

/** Cómo se dicta un correo: «arroba» y «punto» (o «at» y «dot»). */
const SPOKEN_EMAIL: Record<string, { at: RegExp; dot: RegExp }> = {
  es: { at: /\s+arroba\s+/gi, dot: /\s+punto\s+/gi },
  en: { at: /\s+at\s+/gi, dot: /\s+dot\s+/gi },
};

/** «La primera», «el segundo», «the third one»: elegir de una lista por su lugar. */
const SPOKEN_ORDINALS: Record<string, { pattern: RegExp; words: readonly RegExp[] }> = {
  es: {
    pattern: /^(?:el|la)?\s*(\S+)(?:\s+opci[oó]n)?\.?$/i,
    words: [/^primer[oa]?$/i, /^segund[oa]$/i, /^tercer[oa]?$/i, /^cuart[oa]$/i, /^quint[oa]$/i, /^sext[oa]$/i],
  },
  en: {
    pattern: /^(?:the)?\s*(\S+)(?:\s+(?:one|option))?\.?$/i,
    words: [/^first$/i, /^second$/i, /^third$/i, /^fourth$/i, /^fifth$/i, /^sixth$/i],
  },
};

/**
 * Lo dicho como lo entiende el chat escrito: los números dichos con palabras se vuelven cifras, un
 * ordinal («la primera») el número de la opción, y un correo dictado («carlos arroba correo punto com») se
 * vuelve una dirección. Lo demás pasa tal cual.
 */
export function fromVoice(said: string, locale: string): string {
  // Celulares, códigos y horas dichos con palabras o en grupos («trescientos ciento veintitrés…»), a cifras.
  const text = numberWordsToDigits(said, locale.slice(0, 2) === "en" ? "en" : "es");
  const ordinals = SPOKEN_ORDINALS[locale.slice(0, 2)];
  const word = ordinals?.pattern.exec(text.trim())?.[1];
  const place = word ? ordinals.words.findIndex((ordinal) => ordinal.test(word)) : -1;
  if (place >= 0) return String(place + 1);
  const spoken = SPOKEN_EMAIL[locale.slice(0, 2)];
  if (!spoken || !spoken.at.test(text)) return text;
  spoken.at.lastIndex = 0;
  return text.replace(spoken.at, "@").replace(spoken.dot, ".").replace(/\s+/g, "").toLowerCase();
}

/** Sin tildes, mayúsculas ni signos: «No, gracias» y «no gracias» quedan iguales. */
const plainWords = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9:]+/g, " ")
    .trim();
const TIME = /\b\d{1,2}:\d{2}\b/;

/**
 * La opción de la pregunta abierta que corresponde a lo dicho, exacta como se escribe: por su lugar
 * («la segunda»), por su hora («la de las 2:30») o por su texto aunque se diga sin signos («no
 * gracias») o solo su comienzo («sí»). `null` si no encaja ninguna o encajan varias.
 */
export function matchSpokenOption(text: string, options: readonly string[], locale: string): string | null {
  if (options.length === 0) return null;
  const place = fromVoice(text, locale);
  if (/^\d+$/.test(place) && place !== text.trim()) return options[Number(place) - 1] ?? null;
  const said = plainWords(text);
  if (!said) return null;
  const exact = options.filter((option) => plainWords(option) === said);
  if (exact.length === 1) return exact[0];
  const time = said.match(TIME)?.[0];
  const byTime = time ? options.filter((option) => plainWords(option).match(TIME)?.[0] === time) : [];
  if (byTime.length === 1) return byTime[0];
  const fits = options.filter((option) => {
    const label = plainWords(option);
    return (label.length >= 3 && ` ${said} `.includes(` ${label} `)) || (said.length >= 2 && label.startsWith(`${said} `));
  });
  if (fits.length === 1) return fits[0];
  // «Con Emilio»: el nombre con que empieza una opción («Emilio a las 3:00»), dicho suelto.
  const words = new Set(said.split(" "));
  const byName = options.filter((option) => {
    const first = plainWords(option).split(" ")[0] ?? "";
    return first.length >= 3 && !/\d/.test(first) && words.has(first);
  });
  return byName.length === 1 ? byName[0] : null;
}

/** Palabras que no añaden nada al elegir una opción («quiero el corte clásico, por favor»). */
const FILLER = new Set([
  "quiero", "quisiera", "me", "gustaria", "dame", "pon", "ponme", "el", "la", "los", "las", "un", "una", "uno", "de", "del", "con", "por", "favor", "porfa", "eso", "esa", "ese", "si", "ok", "vale", "listo", "perfecto", "mejor", "opcion",
  "i", "want", "would", "like", "the", "a", "an", "with", "please", "that", "one", "yes", "ok", "okay",
]);

/**
 * ¿Dijo solo la opción (con palabras de relleno)? Así se elige de la lista. Si dijo más —el barbero,
 * el día, la hora—, es una petición completa y va entera a la conversación, que toma todo de una vez
 * y pregunta solo lo que falte.
 */
export function saysOnlyOption(text: string, option: string, locale: string): boolean {
  const optionWords = new Set(plainWords(option).split(" "));
  const rest = plainWords(fromVoice(text, locale))
    .split(" ")
    .filter((word) => word && !optionWords.has(word) && !FILLER.has(word));
  return rest.length === 0;
}

/**
 * Una opción dicha dentro de una frase: «Pagar en la barbería» → «pagar en la barbería». Los nombres
 * propios («Apple Pay o Google Pay», «Andrés») se quedan como están.
 */
function asSpokenOption(option: string): string {
  const [first = "", ...rest] = option.split(" ");
  const hasOtherCapitals = rest.some((word) => /^[A-ZÁÉÍÓÚÑ]/.test(word));
  return !hasOtherCapitals && /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(first) ? option.charAt(0).toLowerCase() + option.slice(1) : option;
}

const endsSentence = (text: string) => /[.!?…:]$/.test(text.trim());
const sentence = (text: string) => (endsSentence(text) ? text.trim() : `${text.trim()}.`);

/**
 * Lo que Clipper dice en el modo voz tras lo que dijo la persona: sus mensajes nuevos de la
 * conversación (la misma que se escribe) y la pregunta abierta, corta. Las listas que la persona
 * ya sabe contestar (servicios, barberos, días, horas) no se leen; las demás sí, como frase
 * («sí, con Andrés o ver los otros»). Las opciones vuelven siempre para tocarlas en pantalla.
 */
export function voiceReplyFromTurns(turns: readonly ChatTurn[], locale: string, labels: VoiceReplyLabels): ChatReply {
  const said = turns.filter((turn) => turn.from === "agent");
  const texts = said.map((turn) => turn.text?.trim()).filter((text): text is string => Boolean(text));
  const question = [...said].reverse().find((turn) => turn.question)?.question;
  const parts = [...texts];
  // El día se pregunta abierto: si dice día y hora, queda lista; si solo el día, después se pide la hora.
  // El saludo ya invita a decir cuándo; el título de sus botones («¿Te sirve alguna de estas horas?») sobra dicho.
  const title = question?.kind === "day" ? labels.when : question?.kind === "home" && texts.length > 0 ? undefined : question?.title;
  if (title && !texts.some((text) => text.includes(title))) parts.push(title);
  const options = question?.options ?? [];
  const list = new Intl.ListFormat(locale, { type: "disjunction" });
  if (question?.kind === "time" && options.length > 0 && speaksOptions(question.kind, options.length)) {
    // Horas propuestas (la pedida no estaba libre): solo las horas, sin «Ver todas las horas», y la puerta abierta a otra.
    const times = options.filter((option) => /\d/.test(option));
    if (times.length > 0) {
      if (title) parts.pop();
      parts.push(labels.propose(list.format(times)));
    }
  } else if (options.length > 1 && question && speaksOptions(question.kind, options.length)) {
    // Una sola opción («No, continuar») no se lee: la pregunta ya se contesta sola.
    const spoken = options.map(asSpokenOption);
    parts.push(options.length <= SPOKEN_OPTIONS ? labels.oneOf(list.format(spoken)) : labels.someOf(list.format(spoken.slice(0, SAMPLE_OPTIONS))));
  }
  // Lo mismo dos veces seguidas (el mensaje y el título de su pregunta) se dice una vez.
  const unique = parts.filter((part, index) => index === 0 || plainWords(part) !== plainWords(parts[index - 1]));
  return { text: forVoice(unique.map(sentence).join(" "), locale), followups: [...options] };
}
