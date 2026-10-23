import * as React from "react";
import type { DensityScale, RadiusScale, ResolvedMode, ThemeMode, ThemeTokens } from "./buildTokens";
import type { FontId, FontOption, HeadingFontId } from "./fonts";
import type { ThemePreset } from "./presets";
import type { CustomColors } from "./customTheme";
import type { StoredTheme, ThemeOverride } from "./ThemeProvider";

export const THEME_STORAGE_KEY = "thema-theme";

export interface ThemeContextValue {
  /** El preset en uso: el forzado por la pantalla, si lo hay; si no, el elegido. */
  preset: ThemePreset;
  presets: readonly ThemePreset[];
  setPreset: (id: string) => void;
  /** Fuerza un preset sin guardarlo (el login usa `premium`); `null` lo suelta. Ver `useForcedPreset`. */
  setPresetOverride: (id: string | null) => void;
  /** Fuerza preset, colores y modo sin guardarlos; `null` lo suelta. Ver `useForcedAppearance`. */
  setThemeOverride: (override: ThemeOverride | null) => void;
  /** Primario y secundario del tema «Personalizado» (los últimos elegidos, aunque no esté activo). */
  customColors: CustomColors;
  /** Guarda los colores y activa «Personalizado». */
  setCustomColors: (colors: CustomColors) => void;
  /** Todo lo guardado ahora mismo, para volver a ello con `restoreSnapshot` (cerrar sin guardar). */
  snapshot: StoredTheme;
  restoreSnapshot: (snapshot: StoredTheme) => void;
  /** Color y modo de fábrica (Premium, oscuro), sin colores personalizados. */
  resetAppearance: () => void;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** El modo realmente aplicado, con `system` ya resuelto. */
  resolvedMode: ResolvedMode;
  radius: RadiusScale;
  setRadius: (radius: RadiusScale) => void;
  /** Densidad del espaciado (`--space-*`). */
  density: DensityScale;
  setDensity: (density: DensityScale) => void;
  /** Fuente del cuerpo y de los títulos ("same" = la misma del cuerpo). */
  font: FontId;
  setFont: (font: FontId) => void;
  headingFont: HeadingFontId;
  setHeadingFont: (font: HeadingFontId) => void;
  fonts: readonly FontOption[];
  /** Los tokens activos en este momento (color, radio y tipografía). */
  tokens: ThemeTokens;
}

export const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  }
  return context;
}
