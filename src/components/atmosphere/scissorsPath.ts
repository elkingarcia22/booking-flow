/**
 * El recorrido de las tijeras de `HairBurst`: por dónde cruzan, cuándo cortan y cuánto abren
 * las hojas en cada momento. Sin React, para animarlo fotograma a fotograma y probarlo aparte.
 */

/** Cuántos cortes dan las tijeras al cruzar y cuánto tardan en cruzar. */
export const SNIP_COUNT = 6;
export const SWEEP_MS = 1900;
/** Lo que tardan las hojas en cerrarse y en volver a abrirse en cada corte. */
const CLOSE_MS = 60;
const REOPEN_MS = 150;
/** Lo abiertas que van entre corte y corte, en grados por hoja. */
export const OPEN_DEG = 24;

/** El dibujo mide 84 × 48 px y el tornillo (el eje de las hojas) cae en (36, 24). */
export const WIDTH_PX = 84;
export const HEIGHT_PX = 48;
export const PIVOT_X_PX = 36;
export const PIVOT_Y_PX = 24;
/** Donde se cruzan las hojas al cerrarse: de ahí sale el pelo cortado. */
const CUT_POINT_PX = 26;
/** Las tijeras entran y salen enteras, fuera del borde. */
export const OFFSCREEN_PX = 70;

/** Los momentos (ms desde que empiezan a cruzar) en que se cierran las hojas, repartidos a lo ancho. */
export const snipTimes = (): number[] => Array.from({ length: SNIP_COUNT }, (_, index) => ((index + 0.6) / SNIP_COUNT) * SWEEP_MS);

/**
 * Dónde va el tornillo a los `elapsed` ms: cruza de izquierda a derecha por arriba, ondulando un
 * poco. Con `lineY` (una línea que cortar, como el borde del header) va recto sobre ella.
 */
export function scissorsAt(elapsed: number, width: number, height: number, lineY?: number): { x: number; y: number } {
  const progress = Math.min(1, Math.max(0, elapsed / SWEEP_MS));
  const x = -OFFSCREEN_PX + progress * (width + OFFSCREEN_PX * 2);
  if (lineY !== undefined) return { x, y: lineY };
  const baseY = Math.min(150, Math.max(70, height * 0.16));
  return { x, y: baseY + Math.sin(progress * Math.PI * 2) * 10 };
}

/** El punto del corte (donde salen los pelos) a los `elapsed` ms. */
export function cutPointAt(elapsed: number, width: number, height: number, lineY?: number): { x: number; y: number } {
  const { x, y } = scissorsAt(elapsed, width, height, lineY);
  return { x: x + CUT_POINT_PX, y };
}

/** Cuánto abre cada hoja, en grados: se cierran de golpe en cada corte y se vuelven a abrir. */
export function openingAt(elapsed: number, snips: readonly number[]): number {
  for (const at of snips) {
    const offset = elapsed - at;
    if (offset > -CLOSE_MS && offset <= 0) return OPEN_DEG * (-offset / CLOSE_MS);
    if (offset > 0 && offset < REOPEN_MS) return OPEN_DEG * (offset / REOPEN_MS);
  }
  return OPEN_DEG;
}
