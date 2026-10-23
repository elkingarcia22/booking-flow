import * as React from "react";
import { buildFontTokens, buildRadiusTokens, buildSpacingTokens, buildThemeTokens, type DensityScale, type RadiusScale, type ResolvedMode, type ThemeMode, type ThemeTokens } from "./buildTokens";
import { DEFAULT_THEME_ID, findPreset, THEME_PRESETS } from "./presets";
import { DEFAULT_BODY_FONT, DEFAULT_HEADING_FONT, ensureFontLoaded, findFont, FONT_OPTIONS, isFontId, resolveHeadingFont, type FontId, type HeadingFontId } from "./fonts";
import { ThemeContext, THEME_STORAGE_KEY, type ThemeContextValue } from "./themeContext";
import { buildCustomPreset, CUSTOM_THEME_ID, DEFAULT_CUSTOM_COLORS, isCustomColors, type CustomColors } from "./customTheme";

/**
 * Lo que una pantalla fuerza mientras está montada, sin tocar lo guardado: el login usa
 * solo el preset; la reserva en línea, la apariencia que eligió la barbería entera.
 */
export interface ThemeOverride {
  preset: string;
  /** Los colores cuando `preset` es «Personalizado». */
  custom?: CustomColors | null;
  /** Sin él, el modo que eligió quien mira. */
  mode?: ThemeMode;
}

/** Lo que se guarda del tema; también la «foto» que toma Personalización para deshacer. */
export interface StoredTheme {
  preset: string;
  mode: ThemeMode;
  radius: RadiusScale;
  density: DensityScale;
  /** Ausente = usar la sugerencia del preset (o Inter). */
  font?: FontId;
  headingFont?: HeadingFontId;
  /** Los colores del tema «Personalizado»; se guardan aunque se elija otro, para volver a ellos. */
  custom?: CustomColors;
}

const DEFAULT_STORED: StoredTheme = { preset: DEFAULT_THEME_ID, mode: "dark", radius: "md", density: "normal" };

function readStored(): StoredTheme {
  if (typeof window === "undefined") return DEFAULT_STORED;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_STORED;
    const parsed = JSON.parse(raw) as Partial<StoredTheme>;
    return {
      preset: parsed.preset === CUSTOM_THEME_ID ? CUSTOM_THEME_ID : findPreset(parsed.preset).id,
      mode: parsed.mode === "light" || parsed.mode === "system" ? parsed.mode : "dark",
      radius: parsed.radius === "none" || parsed.radius === "sm" || parsed.radius === "lg" ? parsed.radius : "md",
      density: parsed.density === "compact" || parsed.density === "comfortable" ? parsed.density : "normal",
      font: isFontId(parsed.font) ? parsed.font : undefined,
      headingFont: parsed.headingFont === "same" || isFontId(parsed.headingFont) ? parsed.headingFont : undefined,
      custom: isCustomColors(parsed.custom) ? parsed.custom : undefined,
    };
  } catch {
    return DEFAULT_STORED;
  }
}

function writeStored(value: StoredTheme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* almacenamiento bloqueado (modo privado): el tema vive solo en memoria */
  }
}

function useSystemPrefersDark(): boolean {
  const query = "(prefers-color-scheme: dark)";
  const subscribe = React.useCallback((onChange: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}

/**
 * Aplica el tema al `<html>`: la clase `.dark`, `data-theme` con el id del
 * preset y todas las variables derivadas como estilos inline, que ganan a
 * cualquier regla de tokens.css / globals.css.
 */
function applyToDocument(tokens: ThemeTokens, resolvedMode: ResolvedMode, presetId: string, tier: string, previous: string[]) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolvedMode === "dark");
  root.dataset.theme = presetId;
  // `data-tier` enciende las hojas de acabado por nivel (themes/premium.css).
  root.dataset.tier = tier;
  root.style.colorScheme = resolvedMode;
  for (const name of previous) {
    if (!(name in tokens)) root.style.removeProperty(name);
  }
  for (const [name, value] of Object.entries(tokens)) {
    root.style.setProperty(name, value);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [stored, setStored] = React.useState<StoredTheme>(readStored);
  // Lo que una pantalla fuerza sin guardarlo (el login, la reserva en línea); `null` = lo elegido.
  const [override, setOverride] = React.useState<ThemeOverride | null>(null);
  const prefersDark = useSystemPrefersDark();

  const customColors = stored.custom ?? DEFAULT_CUSTOM_COLORS;
  const customPreset = React.useMemo(
    // `customColors` solo cambia de referencia cuando cambian los colores (primario, secundario o IA):
    // los demás ajustes conservan `stored.custom` al copiar lo guardado.
    () => buildCustomPreset(customColors),
    [customColors]
  );
  const setPresetOverride = React.useCallback((id: string | null) => setOverride(id ? { preset: id } : null), []);
  const overrideCustom = override?.custom ?? null;
  const overridePreset = React.useMemo(() => (overrideCustom ? buildCustomPreset(overrideCustom) : null), [overrideCustom]);
  const activeId = override?.preset ?? stored.preset;
  const preset =
    activeId !== CUSTOM_THEME_ID ? findPreset(activeId) : override?.preset === CUSTOM_THEME_ID ? (overridePreset ?? customPreset) : customPreset;
  const mode: ThemeMode = override?.mode ?? stored.mode;
  const resolvedMode: ResolvedMode = mode === "system" ? (prefersDark ? "dark" : "light") : mode;

  // La tipografía guardada gana; si no hay, la sugerencia del preset; si no, Inter.
  const font: FontId = stored.font ?? preset.fonts?.body ?? DEFAULT_BODY_FONT;
  const headingFont: HeadingFontId = stored.headingFont ?? preset.fonts?.heading ?? DEFAULT_HEADING_FONT;

  const tokens = React.useMemo<ThemeTokens>(
    () => ({
      ...buildThemeTokens(preset, resolvedMode),
      ...buildRadiusTokens(stored.radius),
      ...buildSpacingTokens(stored.density),
      ...buildFontTokens({ body: font, heading: headingFont }),
    }),
    [preset, resolvedMode, stored.radius, stored.density, font, headingFont]
  );

  React.useEffect(() => {
    ensureFontLoaded(findFont(font));
    ensureFontLoaded(resolveHeadingFont(headingFont, font));
  }, [font, headingFont]);

  const appliedRef = React.useRef<string[]>([]);
  React.useLayoutEffect(() => {
    applyToDocument(tokens, resolvedMode, preset.id, preset.tier ?? "standard", appliedRef.current);
    appliedRef.current = Object.keys(tokens);
  }, [tokens, resolvedMode, preset.id, preset.tier]);

  React.useEffect(() => {
    writeStored(stored);
  }, [stored]);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      preset,
      presets: THEME_PRESETS,
      setPreset: (id) => setStored((prev) => ({ ...prev, preset: id === CUSTOM_THEME_ID ? CUSTOM_THEME_ID : findPreset(id).id })),
      customColors,
      setCustomColors: (colors) => setStored((prev) => ({ ...prev, preset: CUSTOM_THEME_ID, custom: colors })),
      snapshot: stored,
      restoreSnapshot: (snapshot) => setStored(snapshot),
      // De fábrica es el color y el modo; radio, densidad y tipografía no se tocan desde Personalización.
      resetAppearance: () => setStored((prev) => ({ ...prev, preset: DEFAULT_STORED.preset, mode: DEFAULT_STORED.mode, custom: undefined })),
      setPresetOverride,
      setThemeOverride: setOverride,
      mode: stored.mode,
      setMode: (mode) => setStored((prev) => ({ ...prev, mode })),
      resolvedMode,
      radius: stored.radius,
      setRadius: (radius) => setStored((prev) => ({ ...prev, radius })),
      density: stored.density,
      setDensity: (density) => setStored((prev) => ({ ...prev, density })),
      font,
      setFont: (next) => setStored((prev) => ({ ...prev, font: next })),
      headingFont,
      setHeadingFont: (next) => setStored((prev) => ({ ...prev, headingFont: next })),
      fonts: FONT_OPTIONS,
      tokens,
    }),
    [preset, customColors, stored, resolvedMode, setPresetOverride, tokens, font, headingFont]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
