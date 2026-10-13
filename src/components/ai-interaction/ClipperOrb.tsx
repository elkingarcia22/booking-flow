import type * as React from "react";
import { cn } from "@/lib/utils";
import "./clipperOrb.css";

export type ClipperOrbState = "idle" | "listening" | "thinking";

export interface ClipperOrbProps {
  /** Lado en px. Pequeño (18–24) acompaña al nombre; grande (120+) es la portada. */
  size?: number;
  /** En reposo gira despacio; escuchando, rápido y late; pensando, el halo se aviva. */
  state?: ClipperOrbState;
  /** Sin halo ni anillo: para tamaños pequeños, junto a un texto. */
  bare?: boolean;
  className?: string;
}

/*
 * Las franjas del poste, en un lienzo de 100×100: rectas, paralelas y a 45°, de borde a borde.
 * `STRIPE_PERIOD` es lo que se desplaza la animación (en `clipperOrb.css`) para que el ciclo
 * empalme sin salto.
 */
const STRIPE_PERIOD = 24;
const STRIPE_THICKNESS = 12;

function stripePath(baseline: number) {
  return `M-2,${baseline + 52}L102,${baseline - 52}L102,${baseline - 52 + STRIPE_THICKNESS}L-2,${baseline + 52 + STRIPE_THICKNESS}Z`;
}

const STRIPES = Array.from({ length: 14 }, (_, i) => stripePath(-96 + i * STRIPE_PERIOD)).join("");

/** Desde este lado (px) hacia abajo el orbe es «chico»: franjas de CSS en vez del SVG, que a ese tamaño se veía roto. */
const SMALL_ORB = 28;

/**
 * El orbe de Clipper, el agente de IA de Barberlytics: el poste de barbería hecho esfera de vidrio
 * con el gradiente de IA. Tiene vida propia —gira, respira, late— y cambia con lo que hace Clipper
 * (escucha, piensa). No es un icono: es su presencia. Todo es CSS sobre los tokens del gradiente de IA.
 */
export function ClipperOrb({ size = 128, state = "idle", bare = false, className }: ClipperOrbProps) {
  const isSmall = size <= SMALL_ORB;
  return (
    <span aria-hidden data-slot="clipper-orb" data-state={state} data-small={isSmall || undefined} className={cn("clipper-orb inline-block", className)} style={{ "--clipper-orb-size": `${size}px` } as React.CSSProperties}>
      {!bare && <span className="clipper-orb__halo" />}
      {!bare && <span className="clipper-orb__ring" />}
      <span className="clipper-orb__sphere">
        {!isSmall && (
          <svg className="clipper-orb__stripes" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
            <path className="clipper-orb__stripes-band" d={STRIPES} />
          </svg>
        )}
      </span>
      <span className="clipper-orb__glass" />
    </span>
  );
}
