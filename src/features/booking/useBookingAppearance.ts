import type { LocaleId } from "@/i18n";
import { bookingLocale, bookingThemeOverride, type BookingAppearanceMode } from "@/lib/booking/appearance";
import { useForcedAppearance } from "@/themes";
import { useBookingShopQuery } from "./queries";

/**
 * Pone la apariencia que eligió la barbería para la reserva (Configuración › Reserva online
 * › Apariencia): fuerza su tema y su modo mientras se ve y devuelve su idioma. No toca lo
 * que tiene personalizado quien mira; al salir vuelve lo suyo. Mientras carga, la general.
 * `previewMode` deja mirar la vista previa en el otro modo sin cambiar lo configurado.
 */
export function useBookingAppearance(previewMode?: BookingAppearanceMode): LocaleId {
  const { data: shop } = useBookingShopQuery();
  useForcedAppearance(bookingThemeOverride(shop?.appearance, previewMode));
  return bookingLocale(shop?.appearance);
}

