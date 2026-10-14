import * as React from "react";
import { HairBurst } from "@/components/atmosphere";
import { useBookingFlow } from "./BookingContext";

/**
 * La celebración de una cita recién creada: unas tijeras cruzan por arriba
 * cortando la línea del header —con el «chas» de cada corte— y el pelo cae
 * como confeti. Vive en la raíz de `BookingFlow`, así
 * sale igual en todas las versiones (Paso a paso, la agenda y la Conversación).
 * Solo salta con una reserva nueva: la que ya estaba al montar (se volvió a
 * la confirmación) no se celebra otra vez.
 */
/** Dónde queda el borde de abajo del header, en px desde arriba de la reserva; sin header, nada. */
function headerLineY(container: HTMLElement | null): number | undefined {
  const header = container?.querySelector("header");
  if (!container || !header) return undefined;
  return header.getBoundingClientRect().bottom - container.getBoundingClientRect().top - 0.5;
}

export function ReservedHairBurst() {
  const { state } = useBookingFlow();
  const reservationId = state.reservation?.id ?? null;
  const seen = React.useRef(reservationId);
  const anchorRef = React.useRef<HTMLSpanElement>(null);
  const [burst, setBurst] = React.useState<{ id: string; cutY: number | undefined } | null>(null);

  React.useEffect(() => {
    if (!reservationId || seen.current === reservationId) return;
    seen.current = reservationId;
    // Las tijeras cortan la línea del header de la confirmación, que ya está pintada.
    setBurst({ id: reservationId, cutY: headerLineY(anchorRef.current?.parentElement ?? null) });
  }, [reservationId]);

  return (
    <>
      <span ref={anchorRef} hidden />
      {burst && <HairBurst key={burst.id} scissors sound cutY={burst.cutY} className="z-toast" onDone={() => setBurst(null)} />}
    </>
  );
}
