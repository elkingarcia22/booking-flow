import * as React from "react";
import { CoverHero, CoverTitle } from "@/components/layout";
import { useBookingFlow } from "./BookingContext";
import { STEP_WIDTH } from "./stepWidth";

/**
 * La portada de la reserva: `CoverHero` del sistema con la foto de la barbería y el ancho de columna de
 * los pasos. La usan el tablero de la Agenda y, en «Según el cliente», los pasos de elegir del cliente
 * nuevo: así las dos mitades de la experiencia se ven iguales.
 */
export function AgendaCover({ className, children }: { className?: string; children: React.ReactNode }) {
  const { shop, layout } = useBookingFlow();
  const cover = shop.coverUrl ?? shop.branches.find((branch) => branch.imageUrl)?.imageUrl ?? null;
  return (
    <CoverHero imageUrl={cover} wide={layout === "wide"} columnClassName={STEP_WIDTH[layout]} className={className}>
      {children}
    </CoverHero>
  );
}

/** El título de la portada: `CoverTitle` del sistema con el tamaño de la pantalla. */
export function AgendaCoverTitle({ title, lead, aside }: { title: string; lead?: string; aside?: React.ReactNode }) {
  const { layout } = useBookingFlow();
  return <CoverTitle title={title} lead={lead} aside={aside} wide={layout === "wide"} />;
}
