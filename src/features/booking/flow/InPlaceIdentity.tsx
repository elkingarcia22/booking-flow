import * as React from "react";
import type { BookingAction } from "../bookingState";
import { AgendaIdentity } from "../variants/agenda/AgendaIdentity";
import { BookingFlowProvider, useBookingFlow } from "./BookingContext";

/** Las acciones de «quién eres» que, fuera de la hoja, cambiarían de pantalla (p. ej. a «Escribe el código»). */
const IDENTITY_ACTIONS: ReadonlySet<BookingAction["type"]> = new Set(["codeSent", "customerFound", "customerIsNew", "customerBlocked", "signOut"]);

/**
 * El celular, el código y la ficha (`AgendaIdentity`) resueltos dentro de una hoja: la pantalla de
 * detrás (las horas, la agenda) se queda donde está. Sin esto, mandar el código llevaba la reserva al
 * paso «Escribe el código» y se veía detrás del modal.
 */
export function InPlaceIdentity() {
  const flow = useBookingFlow();
  const { dispatch, state } = flow;
  const step = state.step;
  const inPlace = React.useMemo(
    () => ({
      ...flow,
      dispatch: (action: BookingAction) => {
        dispatch(action);
        if (IDENTITY_ACTIONS.has(action.type)) dispatch({ type: "goTo", step });
      },
    }),
    [flow, dispatch, step]
  );
  return (
    <BookingFlowProvider value={inPlace}>
      <AgendaIdentity />
    </BookingFlowProvider>
  );
}
