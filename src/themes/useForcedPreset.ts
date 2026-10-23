import * as React from "react";
import { useTheme } from "./themeContext";
import type { ThemeOverride } from "./ThemeProvider";

/**
 * Fuerza un preset mientras la pantalla está montada, sin tocar el que la
 * persona eligió: no se guarda y al desmontar vuelve el suyo. Es lo que usa
 * el login para presentarse siempre con el tema premium.
 */
export function useForcedPreset(id: string) {
  const { setPresetOverride } = useTheme();

  React.useLayoutEffect(() => {
    setPresetOverride(id);
    return () => setPresetOverride(null);
  }, [id, setPresetOverride]);
}

/**
 * Fuerza una apariencia entera (preset, colores personalizados y modo) mientras la
 * pantalla está montada, sin tocar lo que eligió quien mira. Es lo que usa la reserva en
 * línea para verse como la configuró la barbería. `null` no fuerza nada.
 */
export function useForcedAppearance(override: ThemeOverride | null) {
  const { setThemeOverride } = useTheme();
  // Por valor: el objeto llega nuevo en cada render y no debe re-aplicar el tema.
  const key = override ? JSON.stringify(override) : null;

  React.useLayoutEffect(() => {
    setThemeOverride(key ? (JSON.parse(key) as ThemeOverride) : null);
    return () => setThemeOverride(null);
  }, [key, setThemeOverride]);
}
