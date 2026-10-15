import { useAppT } from "@/app/i18n";
import { Button } from "@/components/ui/button";
import { ThemaIcon } from "@/icons";
import { personName, type DraftItem } from "../bookingState";
import { parseStart } from "../bookingFormat";
import { itemDuration, itemPrice } from "../useBookingTotals";
import { AppointmentCard } from "./AppointmentCard";
import { useBookingFlow } from "./BookingContext";

/** Las citas ya apartadas, cada una en su tarjeta (y su «Editar»): la hoja de «las que ya apartaste» (Agenda y Paso a paso). */
export function HeldCards({ items, onEdit }: { items: readonly DraftItem[]; /** «Editar» en cada una: la reabre para cambiarla. */ onEdit?: (item: DraftItem) => void }) {
  const t = useAppT();
  const { state, catalog, fmt } = useBookingFlow();
  const serviceNames = (serviceIds: readonly string[]) => serviceIds.map((id) => catalog?.services.find((service) => service.id === id)?.name ?? id);
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => {
        const barber = catalog?.barbers.find((entry) => entry.id === item.barberId);
        return (
          <AppointmentCard
            key={item.key}
            data={{
              personName: personName(item.person, state.customer) || t("booking.person.self"),
              relation: item.person.kind === "self" ? null : item.person.relation,
              services: serviceNames(item.serviceIds),
              barberName: barber?.name ?? t("booking.review.noPreference"),
              barberAvatarUrl: barber?.avatarUrl,
              day: item.start ? fmt.day(parseStart(item.start)) : "",
              time: item.start ? fmt.time(parseStart(item.start)) : "",
              duration: t("booking.review.minutes", { count: itemDuration(item.serviceIds, catalog) }),
              price: fmt.money(itemPrice(item, catalog)),
            }}
            actions={
              onEdit && (
                <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(item)}>
                  <ThemaIcon name="edit" />
                  {t("booking.review.edit")}
                </Button>
              )
            }
          />
        );
      })}
    </div>
  );
}
