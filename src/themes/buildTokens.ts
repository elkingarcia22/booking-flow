import { apcaContrast, hexToChannels, hexToHsl, hexToRgb, hslChannels, hslToHex, mix, readableForeground, shiftLightness } from "./color";
import { findFont, resolveHeadingFont, type FontId, type HeadingFontId } from "./fonts";
import type { ThemePreset } from "./presets";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedMode = "light" | "dark";
export type RadiusScale = "none" | "sm" | "md" | "lg";

/** Mapa `--variable` → valor, listo para `style.setProperty` o para un bloque CSS. */
export type ThemeTokens = Readonly<Record<string, string>>;

/** Radios base del sistema (px) en su escala "md"; ver tokens.css. */
const BASE_RADII: Readonly<Record<string, number>> = {
  "--radius-xs": 6,
  "--radius-sm": 8,
  "--radius-md": 10,
  "--radius-lg": 12,
  "--radius-xl": 14,
  "--radius-2xl": 16,
  "--radius-3xl": 24,
};

export const RADIUS_FACTORS: Readonly<Record<RadiusScale, number>> = {
  none: 0,
  sm: 0.6,
  md: 1,
  lg: 1.45,
};

export function buildRadiusTokens(scale: RadiusScale): ThemeTokens {
  const factor = RADIUS_FACTORS[scale];
  return Object.fromEntries(
    Object.entries(BASE_RADII).map(([name, px]) => [name, `${Math.round(px * factor)}px`])
  );
}

/**
 * Densidad del espaciado. Escala la unidad base de 4px (compacta 3.5px,
 * normal 4px, amplia 4.5px): la misma pantalla cabe en un portátil o respira
 * en un monitor sin tocar ningún componente. Solo mueve los tokens `--space-*`
 * y sus alias semánticos; los utilitarios numéricos de Tailwind (`p-4`) no
 * cambian, así que un layout que necesite un valor fijo lo sigue teniendo.
 */
export type DensityScale = "compact" | "normal" | "comfortable";

export const DENSITY_FACTORS: Readonly<Record<DensityScale, number>> = {
  compact: 0.875,
  normal: 1,
  comfortable: 1.125,
};

/** Pasos de la escala en unidades de 4px; los alias semánticos apuntan a ellos. */
const SPACE_STEPS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16] as const;

const SPACE_ALIASES: Readonly<Record<string, number>> = {
  "--space-inline": 2, // separación entre elementos en una fila (8px)
  "--space-stack": 3, // separación vertical entre elementos (12px)
  "--space-card": 6, // padding interior de una card (24px)
  "--space-page": 6, // margen lateral del contenido (24px)
  "--space-section": 8, // aire entre secciones (32px)
};

export function buildSpacingTokens(density: DensityScale): ThemeTokens {
  const unit = 4 * DENSITY_FACTORS[density];
  const px = (steps: number) => `${Math.round(steps * unit * 2) / 2}px`;
  return {
    "--space-unit": `${unit}px`,
    ...Object.fromEntries(SPACE_STEPS.map((step) => [`--space-${step}`, px(step)])),
    ...Object.fromEntries(Object.entries(SPACE_ALIASES).map(([name, step]) => [name, px(step)])),
  };
}

export interface ThemeFonts {
  body: FontId;
  heading: HeadingFontId;
}

export function buildFontTokens(fonts: ThemeFonts): ThemeTokens {
  return {
    "--font-body": findFont(fonts.body).family,
    "--font-heading": resolveHeadingFont(fonts.heading, fonts.body).family,
  };
}

/**
 * La familia de IA es siempre un gradiente y ahora sigue al tema: arranca en
 * el primario y recorre ~120° del círculo cromático, con paradas intermedias
 * para las mallas y el loader. Un preset puede fijar sus dos extremos.
 */
function buildAiTokens(preset: ThemePreset, mode: ResolvedMode): ThemeTokens {
  const primary = hexToHsl(preset.primary[mode]);
  const lift = mode === "dark" ? 8 : 0;
  const start = preset.ai
    ? shiftLightness(preset.ai.start, lift)
    : hslToHex({ h: primary.h, s: Math.max(primary.s, 84), l: Math.min(Math.max(primary.l, 46), 58) + lift });
  const end = preset.ai
    ? shiftLightness(preset.ai.end, lift)
    : hslToHex({ h: primary.h + 120, s: Math.max(primary.s, 86), l: 50 + lift });
  const hue = hexToHsl(start).h;
  // Paradas intermedias saturadas al máximo: un gradiente de IA que se vea
  // "suave" deja de leerse como IA y pasa a leerse como un pastel.
  const stop = (offset: number, s: number, l: number) => hslToHex({ h: hue + offset, s, l: l + lift });
  const stops = preset.ai?.stops
    ? preset.ai.stops.map((hex) => shiftLightness(hex, lift))
    : [start, stop(50, 92, 52), stop(115, 98, 48), stop(115, 98, 48), stop(155, 100, 52)];
  const rgb = (hex: string) => hexToRgb(hex).join(", ");
  const pastel = (hex: string) => hslChannels({ ...hexToHsl(hex), l: Math.min(hexToHsl(hex).l + 10, 78) });
  const tokens: Record<string, string> = {
    "--color-ai-gradient-start": start,
    "--color-ai-gradient-end": end,
    "--color-ai-gradient-start-hsl": hexToChannels(start),
    "--color-ai-gradient-end-hsl": hexToChannels(end),
    "--color-ai-gradient-start-pastel-hsl": pastel(start),
    "--color-ai-gradient-end-pastel-hsl": pastel(end),
    "--ai-gradient-start": hexToChannels(start),
    "--ai-gradient-end": hexToChannels(end),
    "--ai-gradient-start-pastel": pastel(start),
    "--ai-gradient-end-pastel": pastel(end),
    "--color-ai-bg":
      preset.ai?.bg?.[mode] ??
      (mode === "light" ? hslToHex({ h: hue + 20, s: 100, l: 97 }) : hslToHex({ h: hue + 20, s: 33, l: 15 })),
    "--color-ai-border":
      preset.ai?.border?.[mode] ??
      (mode === "light" ? hslToHex({ h: hue + 12, s: 96, l: 79 }) : hslToHex({ h: hue + 14, s: 38, l: 48 })),
    "--shadow-ai-premium": `0 4px 15px rgba(${rgb(start)}, 0.3), 0 2px 5px rgba(${rgb(end)}, 0.2)`,
  };
  stops.forEach((hex, index) => {
    tokens[`--color-ai-stop-${index + 1}`] = hex;
    tokens[`--color-ai-stop-${index + 1}-rgb`] = rgb(hex);
  });
  tokens["--color-ai-ink"] = aiInk([stops[0], stops[1], stops[2], stops[4]]);
  return tokens;
}

/** La tinta oscura que va sobre el gradiente de IA cuando el blanco no se lee. */
export const AI_DARK_INK = "#111827";
/** Cuántos puntos del gradiente se miran y cuánto (en Lc) debe ganar el blanco para elegirse. */
const AI_INK_SAMPLES = 11;
const AI_INK_TIE = 5;

/**
 * El texto sobre el gradiente de IA (el botón principal de IA): blanco o tinta oscura, por tema y por
 * modo. Se muestrea el gradiente (paradas 1, 2, 3 y 5 en 0 %, 40 %, 75 % y 100 %, como lo pinta
 * `aiButton.css`) en el tramo donde cae el texto, del 15 % al 85 %, y gana la tinta cuyo punto más
 * débil se lea mejor con contraste perceptual (APCA). Si empatan casi, gana la tinta oscura.
 */
export function aiInk(stops: readonly string[]): string {
  const positions = [0, 0.4, 0.75, 1];
  const colorAt = (t: number) => {
    const i = Math.max(0, positions.findIndex((p, k) => t >= p && t <= positions[k + 1]));
    return mix(stops[i], stops[i + 1], (t - positions[i]) / (positions[i + 1] - positions[i]));
  };
  const samples = Array.from({ length: AI_INK_SAMPLES }, (_, k) => colorAt(0.15 + (0.7 * k) / (AI_INK_SAMPLES - 1)));
  const weakest = (ink: string) => Math.min(...samples.map((color) => Math.abs(apcaContrast(ink, color))));
  return weakest("#ffffff") > weakest(AI_DARK_INK) + AI_INK_TIE ? "#ffffff" : AI_DARK_INK;
}

/**
 * El gradiente de marca es la versión "con luz" del primario: un paso más
 * claro, el primario y un paso más oscuro, en diagonal. Un preset puede fijar
 * sus tres paradas (el oro del tema Premium no se deriva bien: aclarado se
 * vuelve amarillo). El glow es la sombra coloreada que acompaña a un botón
 * primario en hover o a una card destacada.
 */
function buildBrandGradientTokens(preset: ThemePreset, mode: ResolvedMode): ThemeTokens {
  const primary = preset.primary[mode];
  const [from, via, to] = preset.brandGradient?.[mode] ?? [
    shiftLightness(primary, 12),
    primary,
    shiftLightness(primary, -10),
  ];
  const rgb = hexToRgb(primary).join(", ");
  // La gradación de página: un halo del primario arriba a la izquierda,
  // donde vive la marca, que se funde en el fondo antes de la mitad de la
  // pantalla. Es la "atmósfera" de cada tema; `.page-atmosphere` la pinta.
  // En oscuro pide casi el doble de alfa: sobre un fondo casi negro —el de
  // los presets `deep` baja al 5% de luz— un tinte al 9% no llega a leerse.
  const glow = mode === "light" ? 0.1 : 0.18;
  const atmosphere = `radial-gradient(1400px 1000px at 12% -12%, rgba(${rgb}, ${glow}), transparent 70%)`;
  return {
    "--color-brand-rgb": rgb,
    "--page-atmosphere": atmosphere,
    "--color-brand-gradient-from": from,
    "--color-brand-gradient-via": via,
    "--color-brand-gradient-to": to,
    "--color-brand-gradient": `linear-gradient(135deg, ${from} 0%, ${via} 52%, ${to} 100%)`,
    "--shadow-glow-brand": `0 0 0 1px rgba(${rgb}, 0.18), 0 10px 32px -10px rgba(${rgb}, 0.45)`,
  };
}

/**
 * Los neutros del sistema son blancos y grises con un ligero tinte del matiz
 * del primario. Cada tema define ese matiz y cuánta saturación admite: los
 * temas "gray" bajan la saturación para que un naranja no vuelva beige toda
 * la pantalla.
 */
function neutralScale(preset: ThemePreset, mode: ResolvedMode) {
  const hue = preset.neutralHue ?? hexToHsl(preset.primary.light).h;
  const tinted = preset.neutral === "tinted";
  // En claro la saturación teñida se escala respecto a 100 (el blanco azulado
  // original), así un preset puede pedir un marfil bajando un solo número.
  const lightScale = tinted ? (preset.lightNeutralSaturation ?? 100) / 100 : 1;
  const sat = (tintedValue: number, grayValue: number) =>
    tinted ? Math.round(tintedValue * lightScale) : grayValue;
  const at = (s: number, l: number) => ({ h: hue, s, l });

  if (mode === "light" && preset.id === "premium") {
    // Oro en claro (solo este preset; Jade y Platino siguen con la escala general): papel sobre lino. El fondo baja a un pergamino y la
    // card queda en un blanco cálido, así se separan por tono y no solo por
    // sombra; el borde deja el gris y pasa a un filo champán del matiz del tema.
    return {
      bgApp: at(sat(100, 20), 96),
      surface: at(sat(70, 0), 99.6),
      surfaceMuted: at(sat(100, 18), 96.5),
      surfaceSubtle: at(sat(100, 20), 98.5),
      tabTrack: at(sat(58, 14), 93.5),
      accent: at(sat(66, 10), 91),
      border: at(sat(42, 3), 85),
      borderStrong: at(sat(36, 4), 66),
      // Tinta espresso en vez de gris: el texto lleva el matiz del oro, como
      // la impresión en sepia de una carta de restaurante. El tenue (etiquetas,
      // ayudas, placeholders) da 4,5:1 sobre el fondo más oscuro donde vive (la
      // pista de pestañas): a 54 % daba 2,8:1 y casi no se leía. El secundario
      // baja con él para que sigan siendo tres niveles.
      textPrimary: at(sat(60, 10), 14),
      textSecondary: at(sat(40, 6), 29),
      textMuted: at(sat(29, 4), 40),
    };
  }
  if (mode === "light") {
    return {
      bgApp: at(sat(100, 20), 98.5),
      surface: at(0, 100),
      surfaceMuted: at(sat(100, 18), 97),
      surfaceSubtle: at(sat(100, 20), 99),
      tabTrack: at(sat(58, 14), 95),
      accent: at(sat(28, 10), 90),
      border: at(sat(4, 3), 82),
      borderStrong: at(sat(6, 4), 62),
      // El tenue da 4,5:1 sobre la pista de pestañas (a 62 % daba 2,4:1); el
      // secundario baja con él para que principal, secundario y tenue se distingan.
      textPrimary: at(sat(19, 10), 23),
      textSecondary: at(sat(10, 6), 33),
      textMuted: at(sat(6, 4), 43),
    };
  }
  // En oscuro la saturación base la fija el preset (45 para el navy Thema,
  // 24 por defecto) y cada superficie se escala respecto a ella, así la
  // relación entre fondo, card y borde es la misma en todos los temas.
  const base = tinted ? (preset.darkNeutralSaturation ?? 24) : 10;
  const scaled = (ratio: number) => Math.round(base * ratio);
  // `deep` hunde toda la escala: el fondo baja al carbón (5%), las cards se
  // separan por luz propia y no por borde, y el borde queda como hairline.
  const deep = preset.depth === "deep";
  const l = (standard: number, deepValue: number) => (deep ? deepValue : standard);
  return {
    bgApp: at(scaled(1), l(9, 5)),
    surface: at(scaled(0.8), l(14, 9.5)),
    popover: at(scaled(0.82), l(17, 12)),
    surfaceMuted: at(scaled(0.69), l(19, 14)),
    surfaceSubtle: at(scaled(1.04), l(11, 7)),
    // La pista va POR DEBAJO de `surface`, los mismos 5 puntos de luz que en
    // claro (95 bajo el 100 de la card): la pastilla activa de un segmentado
    // se apoya en `surface`, así que una pista más clara la hundía en vez de
    // levantarla y el estado activo no se distinguía en oscuro.
    tabTrack: at(scaled(0.64), l(9, 4.5)),
    accent: at(scaled(1.04), l(20, 15)),
    border: at(scaled(0.36), l(29, 18)),
    borderStrong: at(scaled(0.22), l(35, 26)),
    textPrimary: at(sat(6, 3), l(93, 92)),
    textSecondary: at(sat(6, 3), 64),
    textMuted: at(sat(6, 3), 46),
  };
}

/**
 * El rail y la nav son "cromo": una pieza oscura que flota sobre el contenido
 * en los dos modos, no una superficie más. Del tema solo toman el matiz y la
 * temperatura; la luz la fija esta escala, para que el dock siga leyéndose
 * como pieza aparte cuando el resto de la interfaz está en claro.
 */
function navScale(preset: ThemePreset) {
  const hue = preset.neutralHue ?? hexToHsl(preset.primary.light).h;
  const tinted = preset.neutral === "tinted";
  return {
    surface: {
      h: hue,
      // Un punto por encima de la saturación de los neutros oscuros: el cromo
      // admite más tinte que una card porque nunca lleva texto largo encima.
      s: tinted ? Math.round((preset.darkNeutralSaturation ?? 24) * 1.05) : 10,
      l: preset.depth === "deep" ? 7 : 11,
    },
    foreground: { h: hue, s: tinted ? 12 : 0, l: 98 },
  };
}

/**
 * Deriva todos los tokens de color que dependen del tema para un modo dado.
 * Los estados semánticos (positivo, negativo, warning, info, IA) no aparecen
 * aquí a propósito: viven en tokens.css y no cambian entre temas.
 */
export function buildThemeTokens(preset: ThemePreset, mode: ResolvedMode): ThemeTokens {
  const primary = preset.primary[mode];
  const hoverDelta = mode === "light" ? -8 : 8;
  const brandHover = shiftLightness(primary, hoverDelta);
  const brandPressed = shiftLightness(primary, hoverDelta * 2);
  const primaryForeground = readableForeground(primary);
  const n = neutralScale(preset, mode);
  const nav = navScale(preset);

  // Tinte de las sombras: el matiz de los neutros, oscuro y poco saturado,
  // para que una sombra sea navy en el tema Azul y sepia en Premium, nunca
  // negro puro sobre un fondo teñido.
  const shadowTint = hexToRgb(hslToHex({ ...n.textPrimary, s: Math.max(n.textPrimary.s, 25), l: 18 })).join(", ");

  const common: Record<string, string> = {
    "--shadow-tint-rgb": shadowTint,
    "--color-brand": primary,
    "--color-brand-hover": brandHover,
    "--color-brand-pressed": brandPressed,
    "--color-brand-hsl": hexToChannels(primary),
    "--primary": hexToChannels(primary),
    "--primary-foreground": hexToChannels(primaryForeground),
    "--ring": hexToChannels(primary),

    "--color-bg-app": hslToHex(n.bgApp),
    "--color-bg-app-hsl": hslChannels(n.bgApp),
    "--background": hslChannels(n.bgApp),
    "--color-surface": hslToHex(n.surface),
    "--color-surface-hsl": hslChannels(n.surface),
    "--card": hslChannels(n.surface),
    "--color-surface-muted": hslToHex(n.surfaceMuted),
    "--color-surface-muted-hsl": hslChannels(n.surfaceMuted),
    "--secondary": hslChannels(n.surfaceMuted),
    "--color-surface-subtle": hslToHex(n.surfaceSubtle),
    "--color-surface-subtle-hsl": hslChannels(n.surfaceSubtle),
    "--color-tab-track": hslToHex(n.tabTrack),
    "--accent": hslChannels(n.accent),

    "--color-surface-nav": hslToHex(nav.surface),
    "--color-surface-nav-hsl": hslChannels(nav.surface),
    "--nav": hslChannels(nav.surface),
    "--nav-foreground": hslChannels(nav.foreground),

    "--color-border": hslToHex(n.border),
    "--color-border-hsl": hslChannels(n.border),
    "--border": hslChannels(n.border),
    "--input": hslChannels(n.border),
    "--color-border-strong": hslToHex(n.borderStrong),
    "--color-border-strong-hsl": hslChannels(n.borderStrong),

    "--color-text-primary": hslToHex(n.textPrimary),
    "--color-text-primary-hsl": hslChannels(n.textPrimary),
    "--foreground": hslChannels(n.textPrimary),
    "--card-foreground": hslChannels(n.textPrimary),
    "--popover-foreground": hslChannels(n.textPrimary),
    "--secondary-foreground": hslChannels(n.textPrimary),
    "--accent-foreground": hslChannels(n.textPrimary),
    "--color-text-secondary": hslToHex(n.textSecondary),
    "--color-text-secondary-hsl": hslChannels(n.textSecondary),
    "--muted-foreground": hslChannels(n.textSecondary),
    "--color-text-muted": hslToHex(n.textMuted),
  };

  const ai = buildAiTokens(preset, mode);
  const gradient = buildBrandGradientTokens(preset, mode);
  const schedule = buildScheduleTokens(preset, mode);
  if (mode === "light") {
    return {
      ...common,
      ...gradient,
      ...ai,
      ...schedule,
      "--popover": hslChannels(n.surface),
      "--muted": hslChannels(n.surfaceMuted),
    };
  }
  return {
    ...common,
    ...gradient,
    ...ai,
    ...schedule,
    "--popover": hslChannels(n.popover ?? n.surface),
    "--muted": hslChannels(n.surfaceSubtle),
  };
}

/**
 * Los pasteles de la agenda. Las tarjetas teñidas por servicio o por estado
 * mezclan su color con la card del tema (`.schedule-pastel`), así el pastel
 * hereda el matiz de cada tema; aquí se fija cuánto color entra y cuánta
 * saturación lleva la paleta de servicios. En claro poco, para que la agenda
 * siga sobria; en oscuro algo más, porque sobre carbón un tinte leve no se
 * lee. Los premium van un punto por debajo y con la paleta apagada: un
 * pastel chillón rompe el acabado.
 */
function buildScheduleTokens(preset: ThemePreset, mode: ResolvedMode): ThemeTokens {
  const premium = preset.tier === "premium";
  const strength = mode === "light" ? (premium ? 18 : 20) : premium ? 24 : 28;
  // El estilo «vivo»: más color en el relleno; la barra y el texto ya van en el tono pleno.
  const vivid = mode === "light" ? (premium ? 30 : 34) : premium ? 36 : 42;
  return {
    "--schedule-pastel-strength": `${strength}%`,
    "--schedule-vivid-strength": `${vivid}%`,
    "--schedule-chroma": premium ? "0.62" : "1",
  };
}

/**
 * Versión estática del tema, como el bloque que shadcn deja copiar desde su
 * página de temas: `:root` con el modo claro y `.dark` con el oscuro. Sirve
 * para llevarse un tema a otro proyecto sin cargar el provider.
 */
export function themeToCss(
  preset: ThemePreset,
  radius: RadiusScale = "md",
  fonts?: ThemeFonts,
  density: DensityScale = "normal"
): string {
  const block = (selector: string, tokens: ThemeTokens) =>
    `${selector} {\n${Object.entries(tokens)
      .map(([name, value]) => `  ${name}: ${value};`)
      .join("\n")}\n}`;
  const light = {
    ...buildThemeTokens(preset, "light"),
    ...buildRadiusTokens(radius),
    ...buildSpacingTokens(density),
    ...(fonts ? buildFontTokens(fonts) : {}),
  };
  const dark = buildThemeTokens(preset, "dark");
  return `/* Tema "${preset.name}" — generado por Thema */\n${block(":root", light)}\n\n${block(".dark", dark)}\n`;
}
