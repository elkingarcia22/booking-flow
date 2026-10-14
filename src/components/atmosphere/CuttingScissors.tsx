import * as React from "react";

import { cn } from "@/lib/utils";
import { HEIGHT_PX, OFFSCREEN_PX, OPEN_DEG, PIVOT_X_PX, PIVOT_Y_PX, WIDTH_PX } from "./scissorsPath";

export interface CuttingScissorsHandle {
  /** Coloca las tijeras y abre las hojas; se llama en cada fotograma, sin pasar por React. */
  place: (x: number, y: number, opening: number) => void;
}

/** Una mitad de las tijeras: la hoja a la derecha del tornillo y el aro a la izquierda. */
function ScissorsHalf() {
  return (
    <>
      <path d="M-2,-1.8 C10,-3.4 24,-2.6 36,-0.3 L36,0.3 C24,0.9 10,1.2 -2,1.6 Z" className="fill-muted-foreground" />
      <path d="M2,-0.9 C12,-2 24,-1.6 34,-0.2" className="fill-none stroke-background/50" strokeWidth={0.6} />
      <path d="M1,0.5 L-11,5" className="fill-none stroke-primary" strokeWidth={3} strokeLinecap="round" />
      <circle cx={-16.5} cy={7} r={5.6} className="fill-none stroke-primary" strokeWidth={2.6} />
    </>
  );
}

/**
 * Unas tijeras de barbero que cruzan cortando: dos hojas de acero que giran sobre su tornillo y
 * aros del color de la marca. La posición y la apertura las pone quien anima (`place`) en cada
 * fotograma, para no rehacer el árbol de React 60 veces por segundo.
 */
export const CuttingScissors = React.forwardRef<CuttingScissorsHandle, { className?: string }>(function CuttingScissors({ className }, ref) {
  const rootRef = React.useRef<SVGSVGElement>(null);
  const upperRef = React.useRef<SVGGElement>(null);
  const lowerRef = React.useRef<SVGGElement>(null);

  React.useImperativeHandle(ref, () => ({
    place: (x, y, opening) => {
      // Se ladean un poco al abrirse, como en la mano del barbero.
      rootRef.current?.style.setProperty("transform", `translate3d(${x - PIVOT_X_PX}px, ${y - PIVOT_Y_PX}px, 0) rotate(${-4 + opening * 0.15}deg)`);
      upperRef.current?.setAttribute("transform", `rotate(${-opening})`);
      lowerRef.current?.setAttribute("transform", `rotate(${opening}) scale(1,-1)`);
    },
  }));

  return (
    <svg
      ref={rootRef}
      aria-hidden
      data-slot="cutting-scissors"
      width={WIDTH_PX}
      height={HEIGHT_PX}
      viewBox="-30 -20 70 40"
      className={cn("pointer-events-none absolute left-0 top-0 overflow-visible drop-shadow-md will-change-transform", className)}
      style={{ transform: `translate3d(${-OFFSCREEN_PX - WIDTH_PX}px, 0, 0)`, transformOrigin: `${PIVOT_X_PX}px ${PIVOT_Y_PX}px` }}
    >
      <g ref={lowerRef} transform={`rotate(${OPEN_DEG}) scale(1,-1)`}>
        <ScissorsHalf />
      </g>
      <g ref={upperRef} transform={`rotate(${-OPEN_DEG})`}>
        <ScissorsHalf />
      </g>
      <circle r={2} className="fill-primary stroke-background/60" strokeWidth={0.6} />
    </svg>
  );
});
