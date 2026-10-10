/**
 * Números dichos en voz alta, a cifras. El reconocimiento de voz devuelve un celular de muchas formas
 * —«300 123 45 67», «trescientos ciento veintitrés cuarenta y cinco sesenta y siete», «tres cero cero
 * uno…», mezclado—; aquí todas quedan en cifras seguidas para que el chat las entienda igual que si se
 * hubieran escrito. También una hora dicha con palabras («a las tres» → «a las 3»).
 *
 * Solo se convierte lo que es claramente un número: una serie de 6 cifras o más (un celular, un
 * código) o la hora después de «a las». «Un corte», «a los dos» o «dos cortes» se quedan como están.
 */

type Language = "es" | "en";

const fold = (word: string) =>
  word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.,;:!?¿¡]/g, "");

const ES_ZERO = new Set(["cero"]);
const ES_UNITS: Record<string, number> = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9 };
const ES_TEENS: Record<string, number> = {
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};
const ES_TENS: Record<string, number> = { veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
const ES_HUNDREDS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500,
  seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
};
const EN_ZERO = new Set(["zero", "oh"]);
const EN_UNITS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
const EN_TEENS: Record<string, number> = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const EN_TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/** Cifras ya escritas, con lo que suele acompañarlas en un celular («(300)», «123-45»). */
const DIGITS = /^[(+]?\d[\d().-]*$/;
/** Lo mínimo para tratar una serie como celular o código. */
const MIN_RUN_DIGITS = 6;
const MAX_HOUR = 12;
const TIME_LEAD = /^(a las|a la|las|at)$/;

interface Group {
  digits: string;
  next: number;
}

/** Un número dicho a partir de `at` («ciento veintitrés», «cuarenta y cinco», «three hundred»), o `null`. */
function readGroup(words: readonly string[], at: number, language: Language): Group | null {
  const word = words[at];
  if (word === undefined) return null;
  if (DIGITS.test(word)) return { digits: word.replace(/\D/g, ""), next: at + 1 };
  const zero = language === "es" ? ES_ZERO : EN_ZERO;
  const units = language === "es" ? ES_UNITS : EN_UNITS;
  const teens = language === "es" ? ES_TEENS : EN_TEENS;
  const tens = language === "es" ? ES_TENS : EN_TENS;
  if (zero.has(word)) return { digits: "0", next: at + 1 };
  let value = 0;
  let next = at;
  if (language === "es" && ES_HUNDREDS[word] !== undefined) {
    value = ES_HUNDREDS[word];
    next += 1;
  } else if (language === "en" && units[word] !== undefined && words[at + 1] === "hundred") {
    value = units[word] * 100;
    next += 2;
  }
  const rest = words[next];
  if (rest !== undefined && teens[rest] !== undefined) return { digits: String(value + teens[rest]), next: next + 1 };
  if (rest !== undefined && tens[rest] !== undefined) {
    value += tens[rest];
    next += 1;
    // «cuarenta y cinco» / «forty five».
    const joiner = language === "es" ? words[next] === "y" : false;
    const unit = words[next + (joiner ? 1 : 0)];
    if (unit !== undefined && units[unit] !== undefined && (joiner || language === "en")) return { digits: String(value + units[unit]), next: next + (joiner ? 2 : 1) };
    return { digits: String(value), next };
  }
  if (rest !== undefined && units[rest] !== undefined) return { digits: String(value + units[rest]), next: next + 1 };
  return next > at ? { digits: String(value), next } : null;
}

/** Cambia por cifras los celulares, códigos y horas dichos con palabras; lo demás queda igual. */
export function numberWordsToDigits(input: string, language: Language): string {
  const original = input.trim().split(/\s+/).filter(Boolean);
  const words = original.map(fold);
  const out: string[] = [];
  let at = 0;
  while (at < words.length) {
    const groups: Group[] = [];
    let cursor = at;
    for (;;) {
      const group = readGroup(words, cursor, language);
      if (!group) break;
      groups.push(group);
      cursor = group.next;
      if (words[cursor] === "-") cursor += 1;
    }
    if (groups.length === 0) {
      out.push(original[at]);
      at += 1;
      continue;
    }
    const digits = groups.map((group) => group.digits).join("");
    const lead = [words[at - 2], words[at - 1]].filter(Boolean).join(" ");
    const isHour = groups.length === 1 && (TIME_LEAD.test(lead) || TIME_LEAD.test(words[at - 1] ?? "")) && Number(digits) >= 1 && Number(digits) <= MAX_HOUR;
    const trailing = original[cursor - 1]?.match(/[.,;:!?]+$/)?.[0] ?? "";
    if (digits.length >= MIN_RUN_DIGITS || isHour) out.push(`${digits}${trailing}`);
    else out.push(...original.slice(at, cursor));
    at = cursor;
  }
  return out.join(" ");
}
