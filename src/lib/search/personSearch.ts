/**
 * Buscar a una persona —cliente, barbero, usuario— como se pregunta en el
 * mostrador: por su nombre, por su celular o por su correo. Es la misma regla
 * en todos los buscadores de la aplicación:
 *
 * - **Nombre**: sin tildes ni mayúsculas y con las palabras en cualquier
 *   orden («gómez marce» encuentra a Marcela Gómez).
 * - **Celular**: desde tres cifras, comparando solo las cifras, así
 *   «300 123», «300-123» o «+57 300123» encuentran «+57 300 123 4567».
 * - **Correo**: entero o en parte («@gmail», «marcela.g»).
 */

export interface SearchablePerson {
  name: string;
  phone?: string | null;
  email?: string | null;
}

/** Desde cuántas cifras lo escrito se busca también como celular. */
const MIN_PHONE_DIGITS = 3;

/** Sin tildes ni mayúsculas y con un solo espacio: «Ingresó» y «ingreso» son lo mismo. */
export const normalizeSearch = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const digitsOf = (text: string): string => text.replace(/\D/g, "");

/** Lo escrito parece un número de teléfono (cifras con espacios, guiones, paréntesis o «+»). */
const looksLikePhone = (query: string): boolean => /^[\d\s()+.-]+$/.test(query.trim()) && digitsOf(query).length >= MIN_PHONE_DIGITS;

/**
 * La misma regla para un texto cualquiera (la fila de una lista, una opción de
 * un selector): están **todas** las palabras escritas, sin tildes ni
 * mayúsculas y en cualquier orden; o, si lo escrito es un número, sus cifras
 * aparecen seguidas en el texto aunque allí lleven espacios o signos.
 */
export function matchesSearchText(haystack: string, query: string): boolean {
  const needle = normalizeSearch(query);
  if (!needle) return true;
  const text = normalizeSearch(haystack);
  if (needle.split(" ").every((word) => text.includes(word))) return true;
  return looksLikePhone(query) && text.split(/[^\d\s()+.-]+/).some((chunk) => digitsOf(chunk).includes(digitsOf(query)));
}

/** ¿Lo escrito encuentra a esta persona por su nombre, su celular o su correo? Sin nada escrito, sí. */
export function matchesPerson(person: SearchablePerson, query: string): boolean {
  const needle = normalizeSearch(query);
  if (!needle) return true;
  const name = normalizeSearch(person.name);
  if (needle.split(" ").every((word) => name.includes(word))) return true;
  // Solo si lo escrito es un número: «ana 300» no es un celular.
  if (person.phone && looksLikePhone(query) && digitsOf(person.phone).includes(digitsOf(query))) return true;
  return Boolean(person.email) && normalizeSearch(person.email ?? "").includes(needle.replace(/\s/g, ""));
}

/**
 * Todo lo que se puede buscar de una persona en un solo texto (nombre,
 * celular, sus cifras juntas y correo), para los selectores que filtran por
 * texto (`SearchableSelect`, `keywords`).
 */
export function personSearchText(person: SearchablePerson): string {
  return normalizeSearch([person.name, person.phone, person.phone ? digitsOf(person.phone) : null, person.email].filter(Boolean).join(" "));
}
