import { useBookingFlow } from "../../flow/BookingContext";

/** ¿Las listas se abren en su sitio? Fuera del celular y el widget: debajo de su fila, en vez de en una hoja o un modal. */
export function useInlineLists(): boolean {
  const { layout, touch } = useBookingFlow();
  return layout === "wide" || touch === "lg";
}
