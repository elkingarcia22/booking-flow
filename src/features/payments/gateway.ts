/**
 * La pasarela de pagos en el navegador: los campos de la tarjeta son suyos y lo que sale hacia
 * nuestro servidor es un **token**, nunca el número ni el CVC. Es lo que hacen Stripe Elements,
 * Wompi o Mercado Pago con sus campos alojados (iframes): así la barbería queda en el alcance mínimo
 * de PCI DSS (SAQ A) y un servidor comprometido no puede filtrar tarjetas que nunca vio.
 *
 * Aquí la pasarela está simulada: valida el número (Luhn y vencimiento) y emite un token
 * `tok_sim_…` con la marca, los últimos 4 y el vencimiento, como el objeto de método de pago de
 * Stripe. Para conectar una pasarela real se cambia solo `tokenizeCard`; el resto de la app ya
 * manda el token.
 */

/** El número de prueba que el banco «rechaza» (como `4000 0000 0000 0002` en Stripe). */
export const DECLINED_TEST_CARD = "4000000000000002";

/** El formato de un token de la pasarela simulada: `tok_sim_ok_…` se cobra, `tok_sim_decline_…` no. */
export const SIMULATED_TOKEN = /^tok_sim_(ok|decline)_[A-Za-z0-9]{16}$/;

export interface CardFields {
  number: string;
  name: string;
  /** «MM/AA». */
  expiry: string;
}

/** Lo que la pasarela devuelve y sí puede viajar: el token y lo que se muestra de la tarjeta. */
export interface CardToken {
  token: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  name: string;
}

/** Lo que va en el cobro: el token y si se guarda para la próxima. */
export type CardTokenInput = CardToken & { save: boolean };

const digitsOf = (value: string): string => value.replace(/\D/g, "");

function luhn(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  [...digits].reverse().forEach((char, index) => {
    let value = Number(char);
    if (index % 2 === 1) value = value * 2 > 9 ? value * 2 - 9 : value * 2;
    sum += value;
  });
  return sum % 10 === 0;
}

const brandOf = (digits: string): string => (digits.startsWith("4") ? "Visa" : digits.startsWith("5") || digits.startsWith("2") ? "Mastercard" : digits.startsWith("34") || digits.startsWith("37") ? "Amex" : "Tarjeta");

const TOKEN_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const TOKEN_LENGTH = 16;

function randomId(): string {
  const bytes = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => TOKEN_CHARS[byte % TOKEN_CHARS.length]).join("");
}

/**
 * Convierte la tarjeta en un token. `null` si la pasarela no la acepta (número o vencimiento mal):
 * la pantalla ya lo valida antes, así que es raro.
 */
export async function tokenizeCard(fields: CardFields): Promise<CardToken | null> {
  const digits = digitsOf(fields.number);
  const [month, year] = fields.expiry.split("/").map((part) => Number(digitsOf(part)));
  if (!luhn(digits) || !month || month < 1 || month > 12 || !year) return null;
  const outcome = digits === DECLINED_TEST_CARD ? "decline" : "ok";
  return { token: `tok_sim_${outcome}_${randomId()}`, brand: brandOf(digits), last4: digits.slice(-4), expMonth: month, expYear: year < 100 ? 2000 + year : year, name: fields.name.trim() };
}
