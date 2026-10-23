import * as React from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  detectBrowserLocale,
  findLocale,
  isLocaleId,
  type LocaleId,
} from "./locales";
import { LocaleContext, type AppMessages, type LocaleContextValue } from "./localeContext";
import { createLocaleValue } from "./createLocaleValue";

function readStored(): LocaleId | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocaleId(raw) ? raw : undefined;
  } catch {
    return undefined;
  }
}

function writeStored(locale: LocaleId) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* almacenamiento bloqueado (modo privado): el idioma vive solo en memoria */
  }
}

/**
 * El idioma de la interfaz, con la misma forma que `ThemeProvider`: un
 * proveedor arriba del árbol, un hook (`useLocale`) para leerlo y el valor
 * recordado en el navegador.
 *
 * Qué traduce y qué no: las cadenas que el sistema de diseño trae de fábrica
 * —botones, tablas, fechas, el marco— salen de aquí. El contenido de cada
 * aplicación (sus pantallas, sus datos) lo traduce la aplicación con su
 * propia herramienta; lo que comparte con el sistema es **este** idioma
 * activo, para que haya un solo interruptor y no dos.
 */
export function LocaleProvider({
  children,
  /** Idioma inicial si no hay nada guardado; por defecto, el del navegador. */
  defaultLocale,
  /**
   * El diccionario propio de la aplicación. Lo que traiga gana sobre el del
   * sistema, así que sirve tanto para sumar cadenas como para cambiar una que
   * en tu producto se dice de otra forma.
   */
  messages,
  /**
   * Un idioma fijo que gana a lo guardado y no se guarda: la reserva en línea anidada
   * dentro de la app habla el idioma que eligió la barbería, sin tocar el de quien mira.
   */
  forcedLocale,
}: {
  children: React.ReactNode;
  defaultLocale?: LocaleId;
  messages?: AppMessages;
  forcedLocale?: LocaleId;
}) {
  const [chosen, setLocaleState] = React.useState<LocaleId>(
    () => readStored() ?? defaultLocale ?? detectBrowserLocale() ?? DEFAULT_LOCALE
  );
  const locale = forcedLocale ?? chosen;

  const current = React.useMemo(() => findLocale(locale), [locale]);

  // `lang` en el documento no es decoración: de él dependen el lector de
  // pantalla para pronunciar, el navegador para ofrecer traducción y el CSS
  // para partir palabras con las reglas del idioma.
  React.useEffect(() => {
    // Al desmontar devuelve el anterior: un proveedor anidado (la reserva) no deja su idioma puesto.
    const previous = document.documentElement.lang;
    document.documentElement.lang = current.intl;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [current.intl]);

  const setLocale = React.useCallback((next: LocaleId) => {
    setLocaleState(next);
    writeStored(next);
  }, []);

  const value = React.useMemo<LocaleContextValue>(
    () => createLocaleValue(locale, setLocale, messages),
    [locale, setLocale, messages]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
