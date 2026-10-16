import { useAppT } from "@/app/i18n";
import { useBookingFlow } from "../../flow/BookingContext";
import { QuickActions } from "../../flow/QuickActions";

/**
 * El atajo de la entrada que no pasa por el código: ver las citas que ya tiene. Llamar vive en la ficha
 * de cada sucursal. Pequeño, para que lo principal siga siendo reservar.
 */
export function EntryShortcuts() {
  const t = useAppT();
  const { dispatch } = useBookingFlow();
  return (
    <QuickActions
      label={t("booking.welcome.shortcuts")}
      actions={[
        { id: "manage", icon: "calendar", label: t("booking.phone.manage"), onClick: () => dispatch({ type: "openManage" }) },
      ]}
    />
  );
}
