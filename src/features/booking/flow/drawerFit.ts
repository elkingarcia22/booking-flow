import type * as React from "react";

/**
 * El drawer de abajo se limita por defecto al alto de la ventana (`100dvh`).
 * Dentro de la reserva se abre en su propio contenedor —el marco del celular,
 * el panel del widget—, así que el tope es el alto de ese contenedor.
 */
export const DRAWER_FIT_STYLE: React.CSSProperties = { maxHeight: "calc(100% - 1.5rem)" };

/**
 * Cómo se abren las ventanas de la reserva: en celular, tablet y widget como hoja que sube desde
 * abajo (al alcance del pulgar); en monitor, donde sobra pantalla, como modal centrado.
 */
export function overlayKind({ layout }: { layout: "compact" | "wide"; touch: "default" | "lg" }): "sheet" | "modal" {
  return layout === "wide" ? "modal" : "sheet";
}

/**
 * En celular, tablet y widget la columna que se desplaza no muestra su barra (en pantallas táctiles
 * no se ve igual): así la barra fija de abajo llega de lado a lado sin dejar el hueco del scroll.
 */
export const HIDE_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
