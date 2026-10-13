import { useAppT } from "@/app/i18n";
import { formatPhone } from "../../bookingFormat";
import { useBookingFlow } from "../../flow/BookingContext";
import { QuickActions } from "../../flow/QuickActions";

/**
 * Los dos atajos de la entrada que no pasan por el código: ver las citas que ya tiene y llamar a la
 * barbería. Pequeños, para que lo principal siga siendo reservar.
 */
export function EntryShortcuts() {
  const t = useAppT();
  const { shop, dispatch } = useBookingFlow();
  return (
    <QuickActions
      label={t("booking.welcome.shortcuts")}
      actions={[
        { id: "manage", icon: "calendar", label: t("booking.phone.manage"), onClick: () => dispatch({ type: "openManage" }) },
        { id: "call", icon: "phone", label: t("booking.entry.call"), hint: formatPhone(shop.phone), href: `tel:${shop.phone}` },
      ]}
    />
  );
}
