import { useAppT } from "@/app/i18n";
import * as React from "react";
import { Chip } from "@/components/ai-interaction";
import { Rating } from "@/components/forms";
import { Heading, Text } from "@/components/typography";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemaIcon } from "@/icons";
import { initialsOf } from "../bookingFormat";
import type { BookingBarber } from "../types";
import { useBookingFlow } from "./BookingContext";
import { GalleryViewer } from "./GalleryViewer";
import { PhotoStrip } from "./PhotoStrip";
import { BookingOverlay } from "./BookingOverlay";

interface BarberProfileDrawerProps {
  barber: BookingBarber | null;
  serviceIds: readonly string[];
  onOpenChange: (open: boolean) => void;
  onChoose: (barber: BookingBarber) => void;
}

const SOCIALS = [
  { key: "instagram", icon: "instagram", label: "booking.branchProfile.instagram" },
  { key: "facebook", icon: "facebook", label: "booking.branchProfile.facebook" },
] as const;

/** El perfil de un barbero: quién es, sus trabajos y lo que cobra por cada servicio. */
export function BarberProfileDrawer({ barber, serviceIds, onOpenChange, onChoose }: BarberProfileDrawerProps) {
  const t = useAppT();

  return (
    <BookingOverlay
      open={barber !== null}
      onOpenChange={onOpenChange}
      title={barber?.name ?? ""}
      description={barber?.level ?? undefined}
      leading={barber ? <BarberAvatar barber={barber} /> : null}
      actions={
        barber ? (
          <Button type="button" size="lg" className="w-full" onClick={() => onChoose(barber)}>
            {t("booking.barber.choose", { name: barber.name.split(" ")[0] ?? barber.name })}
          </Button>
        ) : null
      }
    >
      {barber && <BarberProfileBody barber={barber} serviceIds={serviceIds} />}
    </BookingOverlay>
  );
}

export function BarberAvatar({ barber }: { barber: BookingBarber }) {
  return (
    <Avatar size="lg">
      {barber.avatarUrl && <AvatarImage src={barber.avatarUrl} alt="" />}
      <AvatarFallback>{initialsOf(barber.name)}</AvatarFallback>
    </Avatar>
  );
}

/**
 * Lo de adentro del perfil, sin la ventana: el cajón lo usa y también la lista
 * de barberos de la Agenda, que lo abre sin salir de su modal.
 */
export function BarberProfileBody({ barber, serviceIds }: { barber: BookingBarber; serviceIds: readonly string[] }) {
  const t = useAppT();
  const { catalog, fmt } = useBookingFlow();
  const [viewing, setViewing] = React.useState<number | null>(null);
  const socials = SOCIALS.filter((social) => barber[social.key]);
  const services = (catalog?.services ?? []).filter((service) => barber.prices[service.id] !== undefined);

  return (
    <>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-1.5">
          <Heading level={6}>{t("booking.barber.about", { name: barber.name.split(" ")[0] ?? barber.name })}</Heading>
          <Text tone="secondary">{barber.description}</Text>
          {/* Solo la calificación: sin la lista de reseñas ni cuántas son. */}
          <div className="flex items-center gap-2">
            <Text size="lg" weight="semibold" tabular>
              {barber.rating.toFixed(1)}
            </Text>
            <Rating value={Math.round(barber.rating * 2) / 2} allowHalf readOnly size="sm" aria-label={`${barber.rating.toFixed(1)} / 5`} />
          </div>
        </section>
        {barber.skills.length > 0 && (
          <section className="flex flex-col gap-2">
            <Heading level={6}>{t("booking.barber.skills")}</Heading>
            <div className="flex flex-wrap gap-2">
              {barber.skills.map((skill) => (
                <Chip key={skill} label={skill} tone="primary" />
              ))}
            </div>
          </section>
        )}
        {(barber.instagram || barber.facebook) && (
          <section className="flex flex-wrap gap-2" aria-label={t("booking.barber.social")}>
            {socials.map((social) => (
              <Button key={social.key} asChild variant="outline" size="sm">
                <a href={barber[social.key]} target="_blank" rel="noreferrer noopener">
                  <ThemaIcon name={social.icon} />
                  {t(social.label)}
                </a>
              </Button>
            ))}
          </section>
        )}
        {barber.gallery.length > 0 && (
          <section className="flex flex-col gap-2">
            <Heading level={6}>{t("booking.barber.work")}</Heading>
            <PhotoStrip photos={barber.gallery} onOpen={setViewing} />
          </section>
        )}
        <section className="flex flex-col gap-2">
          <Heading level={6}>{t("booking.barber.prices")}</Heading>
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {services.map((service) => (
              <li key={service.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <Text size="sm" weight={serviceIds.includes(service.id) ? "semibold" : "normal"}>
                  {service.name}
                </Text>
                <Text size="sm" tabular tone="secondary">
                  {fmt.money(barber.prices[service.id] ?? service.price)}
                </Text>
              </li>
            ))}
          </ul>
        </section>
      </div>
    <GalleryViewer photos={barber.gallery} index={viewing} title={barber.name} onClose={() => setViewing(null)} />
    </>
  );
}
