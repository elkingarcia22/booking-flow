import { hexToHsl, hslToHex, rgbToHex } from "./color";

/**
 * Los colores de un logo, para proponerlos como primario y secundario del tema.
 *
 * Se agrupan los píxeles por matiz y se devuelven los grupos más grandes, de mayor a
 * menor. Fondo, sombras y textos (transparentes, casi blancos, casi negros o grises)
 * no cuentan: en un logo casi siempre son el lienzo, no la marca.
 */

/** El logo se reduce a este lado antes de leerlo: sobra para contar colores y es instantáneo. */
const SAMPLE_SIZE = 64;
/** Cajones de matiz de 15°: separa rojo de naranja sin partir un mismo color en muchos. */
const HUE_BUCKETS = 24;
/** Un color que ocupa menos de esto del logo es un detalle, no la marca. */
const MIN_SHARE = 0.04;
/** Dos propuestas más cerca que esto en el círculo se leen como el mismo color. */
const MIN_HUE_DISTANCE = 28;

const MIN_ALPHA = 200;
const MIN_SATURATION = 22;
const MIN_LIGHTNESS = 12;
const MAX_LIGHTNESS = 92;

interface Bucket {
  r: number;
  g: number;
  b: number;
  count: number;
}

const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/**
 * Los colores dominantes de unos píxeles RGBA (los de `ImageData.data`), como HEX y de
 * mayor a menor presencia. Vacío si el logo no tiene color (negro, blanco o gris).
 */
export function paletteFromPixels(data: ArrayLike<number>, max = 4): string[] {
  const buckets: Bucket[] = Array.from({ length: HUE_BUCKETS }, () => ({ r: 0, g: 0, b: 0, count: 0 }));
  let colorful = 0;

  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < MIN_ALPHA) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const { h, s, l } = hexToHsl(rgbToHex(r, g, b));
    if (s < MIN_SATURATION || l < MIN_LIGHTNESS || l > MAX_LIGHTNESS) continue;
    const bucket = buckets[Math.floor(h / (360 / HUE_BUCKETS)) % HUE_BUCKETS];
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.count += 1;
    colorful += 1;
  }
  if (colorful === 0) return [];

  const ranked = buckets
    .filter((bucket) => bucket.count / colorful >= MIN_SHARE)
    .sort((a, b) => b.count - a.count)
    .map((bucket) => rgbToHex(bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count).toUpperCase());

  const picked: string[] = [];
  for (const color of ranked) {
    const hue = hexToHsl(color).h;
    if (picked.every((other) => hueDistance(hexToHsl(other).h, hue) >= MIN_HUE_DISTANCE)) picked.push(color);
    if (picked.length === max) break;
  }
  return picked;
}

/** Saturación mínima de los colores de IA propuestos: un degradado apagado no se lee como IA. */
const AI_MIN_SATURATION = 72;
/** Si el logo da un solo matiz, el fin del degradado de IA se aleja este tanto en el círculo. */
const AI_HUE_SPREAD = 40;

const vivid = (hex: string, hueShift = 0) => {
  const hsl = hexToHsl(hex);
  return hslToHex({ h: hsl.h + hueShift, s: Math.max(hsl.s, AI_MIN_SATURATION), l: Math.min(Math.max(hsl.l, 45), 62) }).toUpperCase();
};

/**
 * El degradado de IA que se propone desde el logo: sus colores, avivados. Con tres o más,
 * del segundo al tercero (el primario ya tiene su sitio); con dos, del primero al segundo;
 * con uno (o dos del mismo matiz), ese color y un vecino en el círculo para que se vea.
 */
export function proposeAiColors(colors: readonly string[]): { start: string; end: string } {
  const [first, second, third] = colors;
  const [from, to] = third ? [second, third] : [first, second];
  const start = vivid(from);
  // Dos tonos del mismo color (dos dorados) darían un degradado que no se ve: el fin se aleja.
  if (!to || hueDistance(hexToHsl(from).h, hexToHsl(to).h) < MIN_HUE_DISTANCE) return { start, end: vivid(from, AI_HUE_SPREAD) };
  return { start, end: vivid(to) };
}

/** Cuánto se aleja el tono del secundario cuando el logo tiene un solo color. */
const SINGLE_COLOR_TONE_SHIFT = 22;

/**
 * La propuesta del logo. Con dos colores, son esos dos. Con uno solo, el secundario
 * no se inventa otro color (un rojo no trae un verde): es un tono del mismo, más
 * profundo, o más claro si el color ya es oscuro.
 */
export function proposeBrandColors(colors: readonly string[]): { primary: string; secondary: string; singleColor: boolean } {
  const [primary, second] = colors;
  if (second) return { primary, secondary: second, singleColor: false };
  const hsl = hexToHsl(primary);
  const l = hsl.l > 40 ? hsl.l - SINGLE_COLOR_TONE_SHIFT : hsl.l + SINGLE_COLOR_TONE_SHIFT;
  return { primary, secondary: hslToHex({ ...hsl, l }).toUpperCase(), singleColor: true };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // Una URL de otro dominio solo se puede leer si lo permite (CORS); un data URL, siempre.
    if (!src.startsWith("data:")) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo cargar el logo."));
    image.src = src;
  });
}

/** Lee el logo de `src` (URL o data URL) y devuelve sus colores dominantes. */
export async function extractLogoPalette(src: string, max = 4): Promise<string[]> {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("El navegador no deja leer la imagen.");
  context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  try {
    return paletteFromPixels(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data, max);
  } catch {
    // Un logo de otro dominio sin CORS «ensucia» el canvas y no deja leer sus píxeles.
    throw new Error("No se pueden leer los colores de este logo.");
  }
}
