import type { FaviconStops } from "./barberlyticsFavicon";

/**
 * El gradiente de marca de Barberlytics, fijo: el oro champán del tema
 * Premium, el que definió la identidad original. No sigue al tema que haya
 * elegido quien mira la pantalla — como el logo de cualquier producto real,
 * no cambia de color porque alguien prefiera el tema Violeta o Esmeralda.
 * Úsalo donde la marca deba leerse siempre igual: la marca del menú, el pie
 * de la documentación y el favicon.
 */
export const BARBERLYTICS_BRAND_LIGHT: FaviconStops = ["#D2A45A", "#98621B", "#6B4312"];
export const BARBERLYTICS_BRAND_DARK: FaviconStops = ["#F3E1AE", "#D9B36A", "#A8823A"];

/**
 * El icono oficial (favicon y apple-touch-icon): el cuadro con el gradiente
 * champán del modo oscuro y la flecha en el carbón de ese mismo modo
 * (`--color-bg-app` de Premium oscuro). Es la versión que eligió la marca.
 */
export const BARBERLYTICS_ICON_TILE: FaviconStops = BARBERLYTICS_BRAND_DARK;
export const BARBERLYTICS_ICON_ARROW = "#0E0D0C";

/**
 * Los dos colores del logo de Barberlytics como marca de una barbería: el champán y el
 * bronce profundo del gradiente. «Personalizado» los propone cuando la barbería no ha
 * subido un logo propio y en su menú se ve el de Barberlytics.
 */
export const BARBERLYTICS_LOGO_COLORS: readonly string[] = [BARBERLYTICS_BRAND_DARK[1], BARBERLYTICS_BRAND_LIGHT[2]];

/** La IA de Barberlytics, «Forja» (la del tema Premium): oro que se enfría hasta el azul eléctrico. */
export const BARBERLYTICS_LOGO_AI = {
  start: "#F0CE86",
  end: "#3F72D8",
  // Por el cobre y el turquesa, como en Premium: interpolado por el matiz pasaría por el verde.
  stops: ["#F0CE86", "#DE8C3A", "#2E9CB0", "#2E9CB0", "#3F72D8"],
} as const;

/** El logo de Barberlytics como «logo de la barbería» cuando no subió uno: sus colores y su IA, para proponerlos. */
export const BARBERLYTICS_DEFAULT_LOGO = { colors: BARBERLYTICS_LOGO_COLORS, ai: BARBERLYTICS_LOGO_AI };
