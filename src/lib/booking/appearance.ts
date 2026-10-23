import { z } from "zod";
import { detectBrowserLocale, type LocaleId } from "@/i18n";
import { CUSTOM_THEME_ID, DEFAULT_THEME_ID, isCustomColors, type CustomColors, type ThemeOverride } from "@/themes";

/**
 * Cómo se ve la reserva en línea: la ve el cliente de la barbería desde su navegador, así
 * que no puede depender de la Personalización de quien la administra (esa vive en su
 * navegador). Se guarda en el servidor con el resto de Configuración › Reserva online.
 *
 * Con `useGeneral` la reserva se ve como la marca por defecto: el logo de Identidad de
 * marca, el tema Premium en oscuro y el idioma del navegador del cliente. Sin él, la
 * barbería elige tema (o sus colores), modo, idioma y un logo propio para la reserva.
 */

const customColorsSchema = z.custom<CustomColors>((value) => isCustomColors(value), "Colores no válidos.");

export const bookingAppearanceSchema = z.object({
  useGeneral: z.boolean(),
  /** Un preset de `@/themes` o «custom». */
  theme: z.string(),
  /** Primario, secundario e IA cuando `theme` es «custom». */
  custom: customColorsSchema.nullable(),
  /** `system` = el que tenga el dispositivo del cliente. */
  mode: z.enum(["light", "dark", "system"]),
  /** `auto` = el idioma del navegador del cliente (español si no es uno que hablemos). */
  locale: z.enum(["es", "en", "auto"]),
  /** El logo propio de la reserva; `null` = el de Identidad de marca. */
  logo: z.string().nullable(),
  logoDark: z.string().nullable(),
});
export type BookingAppearance = z.infer<typeof bookingAppearanceSchema>;
export type BookingAppearanceMode = BookingAppearance["mode"];
export type BookingAppearanceLocale = BookingAppearance["locale"];

/** La marca por defecto, la que se ve con «Usar la apariencia general». */
export const GENERAL_BOOKING_APPEARANCE: BookingAppearance = {
  useGeneral: true,
  theme: DEFAULT_THEME_ID,
  custom: null,
  mode: "dark",
  locale: "auto",
  logo: null,
  logoDark: null,
};

/** Lo que de verdad se aplica: la general si `useGeneral`, si no la elegida. */
export function effectiveBookingAppearance(appearance: BookingAppearance | null | undefined): BookingAppearance {
  return !appearance || appearance.useGeneral ? GENERAL_BOOKING_APPEARANCE : appearance;
}

/** El tema que fuerza la reserva mientras está en pantalla. `mode` permite verla en otro modo sin guardarlo. */
export function bookingThemeOverride(appearance: BookingAppearance | null | undefined, mode?: BookingAppearanceMode): ThemeOverride {
  const effective = effectiveBookingAppearance(appearance);
  const resolvedMode = mode ?? effective.mode;
  if (effective.theme !== CUSTOM_THEME_ID) return { preset: effective.theme, mode: resolvedMode };
  // «Personalizado» sin colores guardados no tiene qué pintar: va la marca por defecto.
  return effective.custom ? { preset: CUSTOM_THEME_ID, custom: effective.custom, mode: resolvedMode } : { preset: DEFAULT_THEME_ID, mode: resolvedMode };
}

/** El idioma de la reserva: el elegido o, con `auto`, el del navegador. */
export function bookingLocale(appearance: BookingAppearance | null | undefined): LocaleId {
  const { locale } = effectiveBookingAppearance(appearance);
  return locale === "auto" ? (detectBrowserLocale() ?? "es") : locale;
}
