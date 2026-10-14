import * as React from "react";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import { CuttingScissors, type CuttingScissorsHandle } from "./CuttingScissors";
import { cutPointAt, openingAt, scissorsAt, snipTimes, SWEEP_MS } from "./scissorsPath";
import { createSnipPlayer } from "./scissorSnipSound";

const MAX_DPR = 2;
/** Tope y piso de pelos, sea cual sea el ancho. */
const MIN_CLIPPINGS = 14;
const MAX_CLIPPINGS = 300;
/** Alto de referencia (un celular): en pantallas más altas caen más rápido para cruzarla en el mismo tiempo. */
const REFERENCE_HEIGHT_PX = 640;
/** No caen todos a la vez: van soltándose durante este rato, más al principio. */
const RELEASE_MS = 1400;
/** Cuánto dura la caída entera, en ms; desde `FADE_START` cada pelo se va apagando. */
const DURATION_MS = 4600;
const FADE_START_MS = 3300;
/** Con tijeras la caída empieza más tarde (en cada corte): dura un poco más. */
const CUT_DURATION_MS = SWEEP_MS + 3800;
const CUT_FADE_START_MS = SWEEP_MS + 2500;
/** Los pelos de un corte no salen todos en el mismo instante. */
const CUT_SPREAD_MS = 90;
/** Un fotograma de referencia (60 fps): la física se escala al tiempo real transcurrido. */
const FRAME_MS = 1000 / 60;
/** Puntos con que se traza cada pelo; con más, la curva sale lisa. */
const STRAND_POINTS = 12;
/** Desde qué parte del largo el pelo empieza a afinarse hacia la punta. */
const TAPER_FROM = 0.55;

/*
 * Colores de pelo de verdad (negro, castaños, alguna cana), no los del tema: es material, como
 * una foto. Sobre fondo oscuro van algo más claros, como el pelo bajo la luz del local, para que
 * se vean. El último de cada lista sale poco: son las canas.
 */
const HAIR_ON_LIGHT = ["#16110e", "#231a15", "#33261e", "#4a382b", "#6b6460"] as const;
const HAIR_ON_DARK = ["#5b4a3e", "#6e5848", "#816a58", "#9a8370", "#b9b2ab"] as const;
const GREY_SHARE = 0.08;

interface Clipping {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Cuándo se suelta, en ms desde el inicio: no caen todos a la vez. */
  delay: number;
  /** Cada pelo pesa distinto: unos caen rápido y otros flotan. */
  gravity: number;
  drag: number;
  /** Cuánto lo arrastra la brisa. */
  catchWind: number;
  angle: number;
  spin: number;
  /** El trazo del pelo en su propio sistema, centrado en el origen. */
  points: ReadonlyArray<readonly [number, number]>;
  /** Grosor en el extremo cortado; la punta se afina. */
  width: number;
  sway: number;
  swaySpeed: number;
  /** Cuánto se mece de lado a lado al caer. */
  flutter: number;
  alpha: number;
  color: string;
}

/** Si el fondo del tema es oscuro: la luminosidad de `--background` (tripleta HSL) bajo el 50 %. */
function isDarkBackground(): boolean {
  const triplet = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
  const lightness = Number.parseFloat(triplet.split(/\s+/)[2] ?? "100");
  return lightness < 50;
}

function pickColor(palette: readonly string[]): string {
  if (Math.random() < GREY_SHARE) return palette[palette.length - 1];
  return palette[Math.floor(Math.random() * (palette.length - 1))];
}

/** Recentra el trazo en su punto medio, para que gire sobre sí mismo. */
function centered(points: Array<[number, number]>): Array<[number, number]> {
  const [cx, cy] = points[Math.floor(points.length / 2)];
  return points.map(([x, y]) => [x - cx, y - cy]);
}

/** Un pelo fino y largo, muestreado en `STRAND_POINTS` puntos: casi siempre una C suave, a veces una S. */
function strandPoints(): Array<[number, number]> {
  const steps = Array.from({ length: STRAND_POINTS }, (_, i) => i / (STRAND_POINTS - 1));
  const isWave = Math.random() < 0.35;
  const length = 16 + Math.random() * 20;
  const amplitude = isWave ? 1.5 + Math.random() * 2 : (Math.random() - 0.5) * 6;
  const wavelength = isWave ? 2 : 1;
  return centered(steps.map((t) => [t * length, Math.sin(Math.PI * wavelength * t) * amplitude]));
}

/** Lo que cae más rápido en una pantalla alta, para cruzarla en el mismo tiempo que un celular. */
function fallScaleFor(height: number): number {
  return Math.min(1.8, Math.max(0.9, height / REFERENCE_HEIGHT_PX));
}

/** Nace por encima del borde de arriba, en cualquier punto a lo ancho: cae desde el header. */
function spawnClipping(width: number, fallScale: number, palette: readonly string[]): Clipping {
  return {
    x: Math.random() * width,
    y: -8 - Math.random() * 40,
    vx: (Math.random() - 0.5) * 2.4,
    vy: 0.4 + Math.random() * 2,
    delay: Math.random() ** 1.6 * RELEASE_MS,
    gravity: (0.08 + Math.random() * 0.1) * fallScale,
    drag: 0.955 + Math.random() * 0.02,
    catchWind: 0.4 + Math.random() * 0.9,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.16,
    points: strandPoints(),
    width: 0.6 + Math.random() * 0.5,
    sway: Math.random() * Math.PI * 2,
    swaySpeed: 0.03 + Math.random() * 0.08,
    flutter: 0.3 + Math.random() * 1,
    alpha: 0.8 + Math.random() * 0.2,
    color: pickColor(palette),
  };
}

/**
 * Un pelo recién cortado: sale de entre las hojas en el momento del corte, con un pequeño salto
 * hacia los lados y hacia delante (las tijeras siguen avanzando), y desde ahí cae como los demás.
 */
function spawnCutClipping(origin: { x: number; y: number }, delay: number, fallScale: number, palette: readonly string[]): Clipping {
  return {
    ...spawnClipping(0, fallScale, palette),
    x: origin.x + (Math.random() - 0.5) * 22,
    y: origin.y + (Math.random() - 0.5) * 10,
    vx: (Math.random() - 0.35) * 3.4,
    vy: -1.4 + Math.random() * 1.8,
    delay,
  };
}

/** La brisa del local: cambia de lado y de fuerza con el tiempo, así no caen en fila. */
function windAt(elapsed: number, phase: number): number {
  return 0.6 * Math.sin(elapsed / 650 + phase) + 0.3 * Math.sin(elapsed / 240 + phase * 2.3);
}

function stepClipping(clipping: Clipping, dt: number, wind: number): Clipping {
  const drag = clipping.drag ** dt;
  const vx = clipping.vx * drag + wind * clipping.catchWind * 0.05 * dt;
  const vy = clipping.vy * drag + clipping.gravity * dt;
  const sideways = Math.sin(clipping.sway) * clipping.flutter;
  return {
    ...clipping,
    vx,
    vy,
    x: clipping.x + (vx + sideways) * dt,
    y: clipping.y + vy * dt,
    // Da vueltas a su ritmo y se ladea al mecerse, como un pelo de verdad.
    angle: clipping.angle + (clipping.spin + Math.cos(clipping.sway) * 0.015) * dt,
    sway: clipping.sway + clipping.swaySpeed * dt,
  };
}

/**
 * El pelo como una línea continua: tramo a tramo sobre su trazo, del grosor
 * del corte a una punta casi invisible, con los extremos redondeados.
 */
function drawStrand(context: CanvasRenderingContext2D, points: Clipping["points"], width: number) {
  const last = points.length - 1;
  for (let i = 0; i < last; i++) {
    const t = i / last;
    const taper = t < TAPER_FROM ? 1 : 1 - 0.85 * ((t - TAPER_FROM) / (1 - TAPER_FROM));
    context.beginPath();
    context.moveTo(points[i][0], points[i][1]);
    context.lineTo(points[i + 1][0], points[i + 1][1]);
    context.lineWidth = width * taper;
    context.stroke();
  }
}

export interface HairBurstProps {
  className?: string;
  /** Pelos por cada 100 px de ancho: unos 37 en un celular, unos 120 en un monitor. */
  density?: number;
  /**
   * Unas tijeras cruzan por arriba cortando y el pelo sale de cada corte, en vez de llover
   * desde el borde.
   */
  scissors?: boolean;
  /** Con `scissors`, suena el «chas» de cada corte (Web Audio, sin archivos). */
  sound?: boolean;
  /**
   * Con `scissors`, la línea que cortan, en px desde arriba del contenedor (el borde del header):
   * cruzan rectas sobre ella y el pelo sale de ahí. Sin ella, van por arriba ondulando.
   */
  cutY?: number;
  /** Al terminar la caída (o enseguida, con «reducir movimiento»). */
  onDone?: () => void;
}

/**
 * Pelo de barba que cae para celebrar: como el confeti, pero con los pelos
 * finos que quedan tras un arreglo de barba —largos, con una curva suave y
 * afinándose hacia la punta— en colores de pelo de verdad. Cae una sola vez
 * al montarse, desde arriba del contenedor (que debe ser `relative`) y a todo
 * su ancho: se van soltando escalonados, cada uno con su peso, y una brisa
 * los lleva de lado. Se apaga en unos 4,5 s. Para repetirla, cambia su `key`.
 * Con `prefers-reduced-motion` no se monta.
 */
export function HairBurst({ className, density = 10, scissors = false, sound = false, cutY, onDone }: HairBurstProps) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const scissorsRef = React.useRef<CuttingScissorsHandle>(null);
  const reducedMotion = useReducedMotion();
  const onDoneRef = React.useRef(onDone);
  React.useEffect(() => {
    onDoneRef.current = onDone;
  });

  React.useEffect(() => {
    if (reducedMotion) {
      onDoneRef.current?.();
      return;
    }
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    const context = canvas?.getContext("2d");
    if (!canvas || !parent || !context) return;

    const rect = parent.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const palette = isDarkBackground() ? HAIR_ON_DARK : HAIR_ON_LIGHT;
    const fallScale = fallScaleFor(rect.height);
    const total = Math.min(MAX_CLIPPINGS, Math.max(MIN_CLIPPINGS, Math.round((rect.width / 100) * density)));
    const snips = scissors ? snipTimes() : [];
    // Con tijeras, cada pelo sale de uno de los cortes, por turnos: así se reparten a lo ancho.
    let clippings = Array.from({ length: total }, (_, index) => {
      if (!scissors) return spawnClipping(rect.width, fallScale, palette);
      const at = snips[index % snips.length];
      return spawnCutClipping(cutPointAt(at, rect.width, rect.height, cutY), at + Math.random() * CUT_SPREAD_MS, fallScale, palette);
    });
    const duration = scissors ? CUT_DURATION_MS : DURATION_MS;
    const fadeStart = scissors ? CUT_FADE_START_MS : FADE_START_MS;
    const player = scissors && sound ? createSnipPlayer() : null;
    const windPhase = Math.random() * Math.PI * 2;
    // El reloj arranca en el primer fotograma: es la misma base que los siguientes.
    let startedAt: number | null = null;
    let last = 0;
    let frame = 0;

    const draw = (now: number) => {
      if (startedAt === null) {
        startedAt = now;
        last = now;
        player?.schedule(snips);
      }
      const elapsed = now - startedAt;
      const dt = Math.min(now - last, 48) / FRAME_MS;
      last = now;
      const fade = elapsed < fadeStart ? 1 : Math.max(0, 1 - (elapsed - fadeStart) / (duration - fadeStart));
      if (scissors) {
        const { x, y } = scissorsAt(elapsed, rect.width, rect.height, cutY);
        scissorsRef.current?.place(x, y, openingAt(elapsed, snips));
      }
      const wind = windAt(elapsed, windPhase);

      context.clearRect(0, 0, rect.width, rect.height);
      clippings = clippings.map((clipping) => (elapsed < clipping.delay ? clipping : stepClipping(clipping, dt, wind)));
      for (const clipping of clippings) {
        if (elapsed < clipping.delay) continue;
        context.save();
        context.translate(clipping.x, clipping.y);
        context.rotate(clipping.angle);
        context.globalAlpha = clipping.alpha * fade;
        context.strokeStyle = clipping.color;
        context.lineCap = "round";
        context.lineJoin = "round";
        drawStrand(context, clipping.points, clipping.width);
        context.restore();
      }

      if (elapsed < duration) {
        frame = requestAnimationFrame(draw);
        return;
      }
      context.clearRect(0, 0, rect.width, rect.height);
      onDoneRef.current?.();
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      player?.stop();
    };
  }, [density, scissors, sound, cutY, reducedMotion]);

  if (reducedMotion) return null;

  const canvas = <canvas ref={ref} aria-hidden data-slot="hair-burst" className={cn("pointer-events-none absolute inset-0 h-full w-full", className)} />;
  if (!scissors) return canvas;
  // Las tijeras van encima del pelo, en la misma capa (las clases de capa del canvas valen para las dos).
  return (
    <>
      {canvas}
      <CuttingScissors ref={scissorsRef} className={className} />
    </>
  );
}
