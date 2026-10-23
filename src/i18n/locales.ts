/**
 * Los idiomas del sistema.
 *
 * `id` es la clave interna (y lo que se guarda en el navegador); `intl` es lo
 * que reciben `Intl.DateTimeFormat`, `Intl.NumberFormat` y compañía, que es
 * región y no solo idioma: un español de Colombia escribe 1.284, uno de
 * España también, pero un inglés de Estados Unidos escribe 1,284.
 */
export type LocaleId = "es" | "en" | "fr";

export interface LocaleOption {
  id: LocaleId;
  /** Cómo se llama el idioma en ese idioma: es lo que espera ver quien lo busca. */
  nativeName: string;
  /** Cómo se llama en español, para la documentación. */
  name: string;
  /** Etiqueta BCP 47 para las APIs `Intl` y para el atributo `lang` del documento. */
  intl: string;
}

export const LOCALES: readonly LocaleOption[] = [
  { id: "es", nativeName: "Español", name: "Español", intl: "es-CO" },
  { id: "en", nativeName: "English", name: "Inglés", intl: "en-US" },
  // Francés apagado por ahora (2026-10-21): las traducciones siguen en `messages/`; para reactivarlo,
  // descomenta esta línea.
  // { id: "fr", nativeName: "Français", name: "Francés", intl: "fr-FR" },
];

/**
 * El idioma en que está escrito el sistema: toda clave nace aquí y aquí cae
 * cualquier traducción que falte.
 */
export const SOURCE_LOCALE: LocaleId = "es";

/**
 * El primer recambio cuando una clave no está traducida al idioma pedido.
 * Antes de caer al español, se prueba en inglés: para quien lee francés, el
 * inglés es mejor recambio que un idioma que quizá no conoce.
 */
export const FALLBACK_LOCALE: LocaleId = "en";

export const DEFAULT_LOCALE: LocaleId = "es";

export const LOCALE_STORAGE_KEY = "thema-locale";

export function isLocaleId(value: unknown): value is LocaleId {
  return typeof value === "string" && LOCALES.some((locale) => locale.id === value);
}

export function findLocale(id: string | undefined): LocaleOption {
  return LOCALES.find((locale) => locale.id === id) ?? LOCALES[0];
}

/**
 * El idioma que pide el navegador, si el sistema lo habla. `navigator.languages`
 * viene ordenado por preferencia, así que gana el primero que esté traducido.
 */
export function detectBrowserLocale(): LocaleId | undefined {
  if (typeof navigator === "undefined") return undefined;
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of preferred) {
    const base = tag?.split("-")[0]?.toLowerCase();
    if (isLocaleId(base)) return base;
  }
  return undefined;
}
