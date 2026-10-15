import type { ChatQuestion, ChatQuestionChoice } from "@/lib/chat";

/**
 * Las preguntas de la conversación como datos: lo que se lee (las opciones y su
 * detalle) y lo que significa cada opción para la reserva (`values`). Así la
 * tarjeta del sistema (`ChatQuestionCard`) solo pinta y la conversación decide.
 */

export type QuestionKind =
  | "home"
  | "branch"
  | "person"
  | "relation"
  | "services"
  | "barber"
  | "day"
  | "time"
  | "noTimes"
  | "waitlist"
  | "more"
  | "editPick"
  | "editWhat"
  /** Cuál servicio de una cita va aparte (otra parte de la visita). */
  | "splitWhich"
  | "products"
  | "tip"
  | "discount"
  | "method"
  | "card"
  | "confirm"
  | "after"
  | "repeat"
  | "manage"
  | "manageWhat"
  | "cancelConfirm"
  | "refund"
  | "consent"
  | "blocked"
  | "next"
  | "branchConfirm"
  | "branchInfo"
  | "barberConfirm"
  | "cardSave"
  | "receiptTo";

export interface BookingQuestion extends ChatQuestion {
  kind: QuestionKind;
  /** Lo que vale cada opción, por su texto. */
  values: Readonly<Record<string, string>>;
}

export interface QuestionEntry extends ChatQuestionChoice {
  label: string;
  value: string;
}

type QuestionExtras = Partial<Omit<ChatQuestion, "options" | "details" | "title">>;

/** Arma una pregunta: los textos repetidos se numeran para que cada opción sea única. */
export function makeQuestion(kind: QuestionKind, title: string, entries: readonly QuestionEntry[], extras: QuestionExtras = {}): BookingQuestion {
  const seen = new Map<string, number>();
  const options: string[] = [];
  const values: Record<string, string> = {};
  const details: Record<string, ChatQuestionChoice> = {};
  for (const entry of entries) {
    const count = (seen.get(entry.label) ?? 0) + 1;
    seen.set(entry.label, count);
    const label = count > 1 ? `${entry.label} (${count})` : entry.label;
    options.push(label);
    values[label] = entry.value;
    const detail: ChatQuestionChoice = {};
    if (entry.description) detail.description = entry.description;
    if (entry.emoji) detail.emoji = entry.emoji;
    if ("image" in entry) detail.image = entry.image ?? null;
    if (Object.keys(detail).length > 0) details[label] = detail;
  }
  return { kind, title, options, values, details, ...extras };
}

const plain = (value: string): string => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/**
 * Lo que escribió en la caja como respuesta a la pregunta abierta: el número de
 * una opción, su texto o un trozo que solo aparece en una.
 */
export function matchOption(question: ChatQuestion, text: string): string | null {
  const typed = plain(text);
  if (!typed) return null;
  const number = Number(typed);
  if (Number.isInteger(number) && number >= 1 && number <= question.options.length) return question.options[number - 1] ?? null;
  const exact = question.options.find((option) => plain(option) === typed);
  if (exact) return exact;
  const partial = question.options.filter((option) => plain(option).includes(typed) || (typed.length > 3 && typed.includes(plain(option))));
  return partial.length === 1 ? (partial[0] ?? null) : null;
}

const STEM = 5;
const MIN_WORD = 4;
const FILLER = new Set(["quiero", "quisiera", "porfa", "favor", "para", "como", "esto", "este", "esta", "puedes", "podrias", "dame", "mejor"]);
/** Verbos que se dicen de varias formas y significan lo mismo en una opción: «mándame» = «enviarme». */
const SYNONYMS: readonly [RegExp, string][] = [
  [/^(mand|pas(a|e)m)/, "envia"],
  [/^(pon|agend|anot|guard)/, "agreg"],
  [/^(termin|nada mas|ya esta)/, "listo"],
];

const stems = (text: string): Set<string> =>
  new Set(
    plain(text)
      // Un correo escrito es una respuesta propia («A otro correo»), no palabras que comparar.
      .replace(/\S+@\S+/g, " ")
      .replace(/[^a-z0-9ñ\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= MIN_WORD && !FILLER.has(word))
      .map((word) => SYNONYMS.find(([pattern]) => pattern.test(word))?.[1] ?? word.replace(/s$/, "").slice(0, STEM))
  );

/**
 * Cuando ni el número ni el texto coinciden, la opción que comparte más
 * palabras con lo escrito («mándame el recibo» → «Enviarme el recibo por
 * correo»), solo si una gana sola. Va después de las preguntas de pasada, para
 * que «cambiar de barbero» no se tome por «Cambiar o quitar una cita».
 */
export function matchOptionLoosely(question: ChatQuestion, text: string): string | null {
  const typed = stems(text);
  if (typed.size === 0) return null;
  const scored = question.options.map((option) => ({ option, score: [...stems(option)].filter((stem) => typed.has(stem)).length }));
  const best = Math.max(...scored.map((entry) => entry.score));
  const winners = scored.filter((entry) => entry.score === best);
  return best > 0 && winners.length === 1 ? (winners[0]?.option ?? null) : null;
}

/** Una línea de ticket en Markdown: «- Corte clásico · Andrés · vie 9 oct — US$ 35». */
export const orderLine = (label: string, amount: string, detail?: string): string => `- ${detail ? `**${label}** · ${detail}` : `**${label}**`} — ${amount}`;
