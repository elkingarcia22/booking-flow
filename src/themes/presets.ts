/**
 * Catálogo de temas. Cada tema es, como en shadcn, un color primario por modo
 * y una decisión sobre cómo teñir los neutros. Todo lo demás —hover, pressed,
 * fondo de app, pista de pestañas, superficies del modo oscuro— se deriva en
 * `buildThemeTokens`, así que añadir un tema nuevo es añadir una entrada aquí.
 *
 * Los estados semánticos (positivo, negativo, warning, info, IA) no cambian
 * con el tema: son significado, no decoración.
 */

import type { FontId, HeadingFontId } from "./fonts";

export type NeutralTint = "tinted" | "gray";

/**
 * Profundidad del modo oscuro. `standard` es la escala de siempre (fondo al
 * 9% de luz, card al 14%); `deep` la hunde hasta el carbón (5% / 9.5%) y
 * convierte los bordes en hairlines: es lo que hace que un tema se lea como
 * "pantalla OLED" en vez de "gris oscuro".
 */
export type DarkDepth = "standard" | "deep";

/**
 * Nivel del tema. `premium` activa la hoja `src/styles/themes/premium.css`
 * (sombras con filo de luz, barniz sobre las cards y halo en el ítem activo;
 * los botones son planos en todos los temas) a través de `data-tier` en <html>. Es una capa de
 * acabado, no de color: el color sigue saliendo de los tokens.
 */
export type ThemeTier = "standard" | "premium";

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  primary: { light: string; dark: string };
  /**
   * `tinted` tiñe fondos y superficies con el matiz del primario (como el
   * azul Thema original, cuyo fondo de app es un blanco azulado). `gray`
   * mantiene los neutros neutros: útil para temas oscuros o monocromos.
   */
  neutral: NeutralTint;
  /** Matiz alternativo para los neutros; por defecto el del primario. */
  neutralHue?: number;
  /**
   * Saturación de los neutros en modo oscuro (0–100). El navy Thema original
   * es muy saturado (45%) y funciona porque es azul; para el resto de matices
   * el valor por defecto (24%) evita que toda la pantalla se vuelva verde o
   * morada.
   */
  darkNeutralSaturation?: number;
  /**
   * Saturación del fondo y superficies teñidas en modo claro (0–100). Por
   * defecto 100 —el blanco azulado del tema Azul—; bajarla da un marfil o un
   * papel cálido en vez de una crema. Solo aplica con `neutral: "tinted"`.
   */
  lightNeutralSaturation?: number;
  /** Profundidad del modo oscuro; `standard` si se omite. */
  depth?: DarkDepth;
  /** Nivel de acabado; `standard` si se omite. */
  tier?: ThemeTier;
  /**
   * Gradiente de marca (`--color-brand-gradient`, `bg-brand-gradient`,
   * `text-brand-gradient`). Por defecto se deriva del primario: un paso más
   * claro, el primario y un paso más oscuro. Tres paradas por modo.
   */
  brandGradient?: { light: readonly [string, string, string]; dark: readonly [string, string, string] };
  /**
   * Gradiente de IA. Por defecto arranca en el primario y termina 120° más
   * allá en el círculo cromático; aquí se puede fijar otro par de colores.
   * `stops` fija las cinco paradas de las mallas (si no, se rotan desde el
   * inicio) y `bg`/`border` las superficies pálidas de IA por modo.
   */
  ai?: {
    start: string;
    end: string;
    stops?: readonly [string, string, string, string, string];
    bg?: { light: string; dark: string };
    border?: { light: string; dark: string };
  };
  /** Tipografías sugeridas por el tema; el selector permite cambiarlas. */
  fonts?: { body?: FontId; heading?: HeadingFontId };
}

export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: "thema",
    name: "Azul",
    description: "Azul clásico sobre neutros fríos; el punto de partida.",
    primary: { light: "#0C5BEF", dark: "#3865F5" },
    neutral: "tinted",
    neutralHue: 222,
    darkNeutralSaturation: 45,
    ai: { start: "#2d5cf7", end: "#e11d48" },
  },
  {
    id: "premium",
    name: "Premium",
    description: "Oro champán sobre carbón cálido; hairlines, brillo contenido y serif editorial.",
    // Oro antiguo en claro (5.35:1 con texto blanco; el bronce anterior,
    // #98621B, tiraba a óxido y se leía café; uno más amarillo que pase el
    // contraste se vuelve oliva) y champán en oscuro (9:1 sobre el carbón,
    // texto oscuro encima). Los neutros llevan el matiz del oro casi sin
    // saturar: pergamino de día, carbón cálido de noche.
    primary: { light: "#8A6420", dark: "#D9B36A" },
    neutral: "tinted",
    neutralHue: 40,
    lightNeutralSaturation: 45,
    darkNeutralSaturation: 9,
    depth: "deep",
    tier: "premium",
    brandGradient: {
      light: ["#D9B46A", "#8A6420", "#5A3F12"],
      dark: ["#F3E1AE", "#D9B36A", "#A8823A"],
    },
    // "Forja": oro → cobre → turquesa → azul eléctrico. Metal caliente que se
    // enfría, pero con corriente: la versión anterior mantenía el orden de
    // matices y se quedaba apagada, con las paradas medias sin saturación.
    // Ahora ninguna baja de 5,8:1 sobre el fondo oscuro y las dos del medio
    // pasan de 8:1, así que el degradado brilla y sigue sirviendo como texto.
    // La rotación por defecto llevaría el oro al verde; el violeta y el
    // frambuesa de la primera versión leían en pastel sobre carbón.
    ai: {
      start: "#F0CE86",
      end: "#3F72D8",
      stops: ["#F0CE86", "#DE8C3A", "#2E9CB0", "#2E9CB0", "#3F72D8"],
      bg: { light: "#EFF4F8", dark: "#141B24" },
      border: { light: "#BFD3E2", dark: "#36536E" },
    },
    fonts: { body: "plus-jakarta", heading: "fraunces" },
  },
  {
    id: "premium-jade",
    name: "Premium Jade",
    description: "Jade sobre verde-negro profundo; fresco, mineral, de galería.",
    // Jade bosque en claro (5.2:1 con texto blanco) y celadón luminoso en
    // oscuro. Los neutros llevan el verde casi sin saturar: papel de arroz
    // de día, verde-negro de noche.
    primary: { light: "#1F7A5A", dark: "#7FD8AF" },
    neutral: "tinted",
    neutralHue: 160,
    lightNeutralSaturation: 30,
    darkNeutralSaturation: 10,
    depth: "deep",
    tier: "premium",
    brandGradient: {
      light: ["#5FB893", "#1F7A5A", "#125240"],
      dark: ["#CDF3E1", "#7FD8AF", "#3AA47A"],
    },
    // Jade → cian → azul → violeta: la IA sale del primario pero se va
    // hacia el frío en vez de al amarillo.
    ai: {
      start: "#7FE0B8",
      end: "#A66CF0",
      stops: ["#7FE0B8", "#4FC8D6", "#5F8CF0", "#5F8CF0", "#A66CF0"],
      bg: { light: "#EEF8F3", dark: "#14201B" },
      border: { light: "#A8DEC6", dark: "#3E6B57" },
    },
    fonts: { body: "satoshi", heading: "fraunces" },
  },
  {
    id: "premium-platino",
    name: "Premium Platino",
    description: "Platino sobre grafito azulado; frío, técnico, de relojería.",
    // Acero en claro (7.6:1 con texto blanco) y platino en oscuro (texto
    // oscuro encima). Es el Premium para producto técnico: sin color de
    // marca que grite, la jerarquía la hacen la luz y las hairlines.
    primary: { light: "#4A5B70", dark: "#C8D3E0" },
    neutral: "tinted",
    neutralHue: 215,
    lightNeutralSaturation: 30,
    darkNeutralSaturation: 12,
    depth: "deep",
    tier: "premium",
    brandGradient: {
      light: ["#7C8EA3", "#4A5B70", "#2C3A4B"],
      dark: ["#F1F5FA", "#C8D3E0", "#8EA0B5"],
    },
    // Platino → hielo → azul → violeta: la única saturación del tema.
    ai: {
      start: "#DDE6F0",
      end: "#A78BFA",
      stops: ["#DDE6F0", "#8FC1F2", "#6D8FF5", "#6D8FF5", "#A78BFA"],
      bg: { light: "#F2F5F9", dark: "#191E26" },
      border: { light: "#C3D0DF", dark: "#4E5D72" },
    },
    fonts: { body: "geist", heading: "space-grotesk" },
  },
  {
    id: "indigo",
    name: "Índigo",
    description: "Más profundo y editorial, para paneles densos.",
    primary: { light: "#4F46E5", dark: "#818CF8" },
    neutral: "tinted",
  },
  {
    id: "violet",
    name: "Violeta",
    description: "Creativo, cercano a la familia de IA.",
    primary: { light: "#7C3AED", dark: "#A78BFA" },
    neutral: "tinted",
    fonts: { body: "satoshi", heading: "space-grotesk" },
  },
  {
    id: "emerald",
    name: "Esmeralda",
    description: "Crecimiento, bienestar, resultados positivos.",
    primary: { light: "#059669", dark: "#34D399" },
    neutral: "tinted",
  },
  {
    id: "teal",
    name: "Teal",
    description: "Sereno y técnico, a medio camino entre azul y verde.",
    primary: { light: "#0D9488", dark: "#2DD4BF" },
    neutral: "tinted",
  },
  {
    id: "cyan",
    name: "Cian",
    description: "Luminoso, para tableros con mucha visualización.",
    primary: { light: "#0891B2", dark: "#22D3EE" },
    neutral: "tinted",
  },
  {
    id: "crimson",
    name: "Rojo",
    description: "Carmesí decidido; para marcas con carácter y avisos que importan.",
    primary: { light: "#DC2626", dark: "#F87171" },
    neutral: "gray",
    neutralHue: 350,
    // Rojo → naranja → ámbar: la IA se calienta en vez de irse al verde.
    ai: { start: "#EF4444", end: "#F59E0B", stops: ["#EF4444", "#F0653A", "#F58A2A", "#F58A2A", "#F5B01B"] },
  },
];

export const DEFAULT_THEME_ID = "premium";

export function findPreset(id: string | null | undefined): ThemePreset {
  // Un id que ya no existe (un tema retirado que quedó guardado) cae en el tema por defecto.
  return THEME_PRESETS.find((preset) => preset.id === id) ?? THEME_PRESETS.find((preset) => preset.id === DEFAULT_THEME_ID) ?? THEME_PRESETS[0];
}
