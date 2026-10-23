import { contrastRatio, hexToHsl, hslToHex, shiftLightness } from "./color";
import type { ThemePreset } from "./presets";

/**
 * El tema «Personalizado»: la barbería elige su primario y su secundario (a mano o
 * desde los colores de su logo) y de ahí sale un tema completo, como un preset más.
 *
 * El color elegido no se usa tal cual en los dos modos: un amarillo claro no se lee
 * como texto sobre blanco ni un azul marino sobre carbón. Se conserva el matiz y la
 * saturación y se ajusta la luz hasta que contraste con el fondo de cada modo.
 */

export const CUSTOM_THEME_ID = "custom";

export interface CustomColors {
  /** El color de botones, enlaces y la marca (HEX `#rrggbb`). */
  primary: string;
  /** El acompañante: cierra el degradado de marca y, si no hay `ai`, el de IA (HEX `#rrggbb`). */
  secondary: string;
  /**
   * El degradado de IA, de `start` a `end`. Sin él sale del primario y el secundario
   * (`automaticAiColors`); con él, la barbería lo eligió a mano o desde su logo.
   */
  ai?: AiColors;
}

export interface AiColors {
  start: string;
  end: string;
  /**
   * Las cinco paradas de las mallas, si se fijan a mano. Sin ellas se interpolan por el
   * matiz, que entre colores opuestos (oro y azul) pasa por el verde: un degradado de
   * marca como «Forja» las trae puestas.
   */
  stops?: readonly [string, string, string, string, string];
}

/** El punto de partida al abrir «Personalizado» por primera vez: el oro y el azul de Premium. */
export const DEFAULT_CUSTOM_COLORS: CustomColors = { primary: "#B8862E", secondary: "#3F72D8" };

const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

function isAiColors(value: unknown): value is AiColors {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AiColors>;
  const stopsOk = candidate.stops === undefined || (Array.isArray(candidate.stops) && candidate.stops.length === 5 && candidate.stops.every(isHexColor));
  return isHexColor(candidate.start) && isHexColor(candidate.end) && stopsOk;
}

export function isCustomColors(value: unknown): value is CustomColors {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CustomColors>;
  return isHexColor(candidate.primary) && isHexColor(candidate.secondary) && (candidate.ai === undefined || isAiColors(candidate.ai));
}

/** Fondos de referencia de cada modo para medir el contraste (los de los neutros teñidos). */
const LIGHT_BG = "#FFFFFF";
const DARK_BG = "#15171B";
/** Texto y enlaces en color de marca: el AA de texto normal. */
const TEXT_CONTRAST = 4.5;
/** Paradas de degradado y adornos: basta con el AA de elementos gráficos. */
const GRAPHIC_CONTRAST = 3;
const STEP = 2;

/**
 * Mueve la luz de `hex` (oscureciendo en claro, aclarando en oscuro) hasta que llegue
 * a `ratio` contra el fondo del modo. Si ya llega, lo deja como está.
 */
export function fitToMode(hex: string, mode: "light" | "dark", ratio = TEXT_CONTRAST): string {
  const background = mode === "light" ? LIGHT_BG : DARK_BG;
  const delta = mode === "light" ? -STEP : STEP;
  let color = hex;
  for (let guard = 0; guard < 50 && contrastRatio(color, background) < ratio; guard++) {
    color = shiftLightness(color, delta);
  }
  return color.toUpperCase();
}

/** Cinco paradas del degradado de IA, del primario al secundario por el camino corto del círculo. */
function hueStops(from: string, to: string): readonly [string, string, string, string, string] {
  const a = hexToHsl(from);
  const b = hexToHsl(to);
  const span = ((b.h - a.h + 540) % 360) - 180;
  const at = (t: number) => hslToHex({ h: a.h + span * t, s: a.s + (b.s - a.s) * t, l: a.l + (b.l - a.l) * t });
  return [from, at(0.3), at(0.55), at(0.55), to];
}

function aiPreset({ start, end, stops }: AiColors): NonNullable<ThemePreset["ai"]> {
  return { start, end, stops: stops ?? hueStops(start, end) };
}

/** Por debajo de esta saturación el primario es un gris: los neutros no se tiñen. */
const GRAY_SATURATION = 8;

/** El degradado de IA cuando no se eligió uno: del primario al secundario, en su versión para oscuro. */
export function automaticAiColors({ primary, secondary }: Pick<CustomColors, "primary" | "secondary">): AiColors {
  return { start: fitToMode(primary, "dark"), end: fitToMode(secondary, "dark", GRAPHIC_CONTRAST) };
}

export function buildCustomPreset({ primary, secondary, ai }: CustomColors): ThemePreset {
  const primaryLight = fitToMode(primary, "light");
  const primaryDark = fitToMode(primary, "dark");
  const secondaryLight = fitToMode(secondary, "light", GRAPHIC_CONTRAST);
  const secondaryDark = fitToMode(secondary, "dark", GRAPHIC_CONTRAST);
  const hsl = hexToHsl(primary);
  const isGray = hsl.s < GRAY_SATURATION;

  return {
    id: CUSTOM_THEME_ID,
    name: "Personalizado",
    description: "Los colores de tu marca: el primario y el secundario los eliges tú o salen de tu logo.",
    primary: { light: primaryLight, dark: primaryDark },
    neutral: isGray ? "gray" : "tinted",
    neutralHue: Math.round(hsl.h),
    // Neutros con poco tinte: con un color cualquiera, uno al 100 % tiñe toda la pantalla.
    lightNeutralSaturation: 30,
    darkNeutralSaturation: 14,
    brandGradient: {
      light: [shiftLightness(primaryLight, 10), primaryLight, secondaryLight],
      dark: [shiftLightness(primaryDark, 10), primaryDark, secondaryDark],
    },
    ai: aiPreset(
      ai
        ? { start: fitToMode(ai.start, "dark", GRAPHIC_CONTRAST), end: fitToMode(ai.end, "dark", GRAPHIC_CONTRAST), stops: ai.stops }
        : automaticAiColors({ primary, secondary })
    ),
  };
}
