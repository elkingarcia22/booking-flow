import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const stubVariants = cva("flex w-20 shrink-0 flex-col items-center justify-center gap-0.5 border-r-2 border-dashed py-4", {
  variants: {
    tone: {
      brand: "border-primary-foreground/40 bg-primary text-primary-foreground",
      neutral: "border-border bg-surface-subtle text-text-primary",
    },
  },
  defaultVariants: { tone: "brand" },
});

/** Dónde cae la perforación y qué radio tiene la muesca (la mitad del `size-4` del contorno). */
const NOTCH_X = "5rem";
const NOTCH_R = "8px";

/**
 * Las muescas se recortan de la tarjeta con una máscara —así se ve el fondo de verdad, sea cual sea— y
 * un contorno de media luna las rodea: el borde de la tarjeta sigue la forma del talón en vez de
 * cruzar la entrada de la muesca. El recorte parte del filo de afuera de la tarjeta (1px sobre el
 * borde interior donde se dibuja el arco).
 */
const NOTCH_MASK = (() => {
  const hole = (y: string) => `radial-gradient(circle ${NOTCH_R} at ${NOTCH_X} ${y}, transparent calc(${NOTCH_R} - 0.5px), black ${NOTCH_R})`;
  return { image: `${hole("1px")}, ${hole("calc(100% - 1px)")}` };
})();

const NOTCH_STYLE = {
  maskImage: NOTCH_MASK.image,
  WebkitMaskImage: NOTCH_MASK.image,
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
} as React.CSSProperties;

/** El arco de la muesca: el mismo filo del cuerpo (en oscuro no hay filo), centrado donde se recortó. */
const NOTCH_RING = "absolute left-[calc(5rem-9px)] size-4 rounded-full border border-border dark:border-transparent";

export interface TicketCardProps extends Omit<React.ComponentProps<"section">, "children"> {
  /** Lo que va en el talón: un número grande, «Parte 2 de 3». Es decorativo para el lector de pantalla si lo repites en el cuerpo. */
  stub: React.ReactNode;
  /** `brand`: el talón relleno en el color de la marca. `neutral`: gris suave. */
  tone?: "brand" | "neutral";
  /** El cuerpo: el título, lo que sigue y las acciones. */
  children: React.ReactNode;
}

/**
 * Una entrada: a la izquierda el talón —un número, una etiqueta— y, tras una línea de puntos con sus
 * dos muescas, el cuerpo con lo que importa. Sirve para decir «en qué parte vas» sin parecer otra
 * tarjeta más: es la que marca cada parte de una visita en la reserva. En oscuro el cuerpo es grafito;
 * en claro, una superficie blanca con filo (el gris suave se confundía con el fondo). Las muescas son un recorte real: el fondo se ve por dentro y el borde las rodea.
 */
export function TicketCard({ stub, tone = "brand", className, children, ...props }: TicketCardProps) {
  return (
    // La sombra va en el envoltorio (`drop-shadow`): la máscara de adentro la recortaría.
    <section data-slot="ticket-card" className={cn("relative isolate drop-shadow-sm", className)} {...props}>
      <div style={NOTCH_STYLE} className="relative flex overflow-hidden rounded-2xl border border-border bg-surface dark:border-transparent dark:bg-surface-muted">
        <div data-slot="ticket-stub" className={stubVariants({ tone })} aria-hidden>
          {stub}
        </div>
        <span aria-hidden className={cn(NOTCH_RING, "-top-2")} />
        <span aria-hidden className={cn(NOTCH_RING, "-bottom-2")} />
        <div data-slot="ticket-body" className="flex min-w-0 flex-1 flex-col gap-2.5 p-3.5">
          {children}
        </div>
      </div>
    </section>
  );
}
