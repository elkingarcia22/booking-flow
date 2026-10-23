import * as React from "react";
import { bookingReducer, initialBookingState } from "./bookingState";
import { useBookingFormat } from "./bookingFormat";
import type { BookingFlowValue, BookingLayout } from "./flow/BookingContext";
import { useFunnelTracking, type BookingSurface } from "./funnel";
import { useBookingCatalogQuery, useBookingShopQuery } from "./queries";
import { useBookingTotals, activeBranch } from "./useBookingTotals";
import { prefillAsLastVisit, readRebookLink } from "./rebookLink";

interface BookingEngineOptions {
  layout: BookingLayout;
  touch: "default" | "lg";
  surface: BookingSurface;
  isPhone: boolean;
}

/**
 * El motor de la reserva, sin interfaz: la barbería, el catálogo de la sede, el
 * estado (quién reserva, el carrito), las cuentas y el embudo. Las tres versiones
 * lo montan igual; lo que cada una cambia es cómo se recorre.
 */
export function useBookingEngine({ layout, touch, surface, isPhone }: BookingEngineOptions) {
  const shopQuery = useBookingShopQuery();
  const [state, dispatch] = React.useReducer(bookingReducer, undefined, () => initialBookingState());
  const shop = shopQuery.data;
  const catalogQuery = useBookingCatalogQuery(state.branchId);
  const totals = useBookingTotals(state, catalogQuery.data, shop);
  // Cada sucursal cobra en su moneda; antes de elegirla, la de la barbería.
  const fmt = useBookingFormat(activeBranch(shop, state.branchId)?.currency ?? shop?.currency);

  // La propina por defecto de la barbería, una vez que se sabe cuál es.
  const defaultTip = shop?.defaultTipId ?? null;
  const tipSeeded = React.useRef(false);
  React.useEffect(() => {
    if (tipSeeded.current || defaultTip === null) return;
    tipSeeded.current = true;
    dispatch({ type: "setTip", tipId: defaultTip });
  }, [defaultTip]);

  // Un enlace de reagendar (lo manda la barbería desde la agenda): al identificarse, va directo a la hora.
  const prefill = React.useMemo(() => (typeof window === "undefined" ? null : readRebookLink(window.location.search)), []);
  const prefillUsed = React.useRef(false);
  React.useEffect(() => {
    if (!prefill || prefillUsed.current || !state.customer) return;
    prefillUsed.current = true;
    dispatch({ type: "repeatLastVisit", lastVisit: prefillAsLastVisit(prefill) });
  }, [prefill, state.customer]);

  // La sesión vive en el estado de la reserva: empezar de nuevo («¿No eres tú?») la borra sola.
  const tracking = useFunnelTracking(state.step, surface);
  const setToken = React.useCallback((token: string | null) => dispatch({ type: "setToken", token }), []);
  const value = React.useMemo<BookingFlowValue | null>(
    () => (shop ? { state, dispatch, shop, catalog: catalogQuery.data, catalogLoading: catalogQuery.isLoading, totals, fmt, layout, touch, isPhone, token: state.token, setToken, utm: tracking.utm } : null),
    [shop, state, catalogQuery.data, catalogQuery.isLoading, totals, fmt, layout, touch, isPhone, setToken, tracking.utm]
  );

  return { shopQuery, value };
}
