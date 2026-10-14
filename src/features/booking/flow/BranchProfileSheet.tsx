import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Heading, Text } from "@/components/typography";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { WEEK_ORDER, formatPhone, initialsOf, openStateOf, parseStart } from "../bookingFormat";
import { useBookingCatalogQuery, useBranchDetailQuery } from "../queries";
import { useBookingFlow } from "./BookingContext";
import { BookingOverlay } from "./BookingOverlay";
import { GalleryViewer } from "./GalleryViewer";
import { PhotoStrip } from "./PhotoStrip";

const FIRST_SERVICES = 6;
const FIRST_BARBERS = 4;

const SOCIALS = [
  { key: "website", icon: "globe", label: "booking.branchProfile.website" },
  { key: "instagram", icon: "instagram", label: "booking.branchProfile.instagram" },
  { key: "facebook", icon: "facebook", label: "booking.branchProfile.facebook" },
] as const;

interface BranchProfileSheetProps {
  /** La sede que se mira; `null` lo mantiene cerrado. */
  branchId: string | null;
  onOpenChange: (open: boolean) => void;
  /** Si se pasa, el pie ofrece elegir esta sede. */
  onChoose?: (branchId: string) => void;
}

/**
 * El perfil de una sede, para decidir dónde reservar: fotos, si está abierta
 * ahora, cómo llegar, el horario de la semana, lo que se hace y quién atiende.
 * La descripción, la dirección y el teléfono son los de Configuración ›
 * Sucursales; los servicios y el equipo, los reservables en esa sede.
 */
export function BranchProfileSheet({ branchId, onOpenChange, onChoose }: BranchProfileSheetProps) {
  const t = useAppT();
  const { state } = useBookingFlow();
  const { data: detail } = useBranchDetailQuery(branchId);

  return (
    <BookingOverlay
      open={branchId !== null}
      onOpenChange={onOpenChange}
      size="lg"
      title={detail?.name ?? ""}
      description={detail ? `${detail.address}, ${detail.city}` : undefined}
      leading={<IconTile size="lg" icon={<ThemaIcon name="building" />} src={detail?.gallery[0]} />}
      actions={
        detail && onChoose && detail.id !== state.branchId ? (
          <Button type="button" size="lg" className="w-full" onClick={() => onChoose(detail.id)}>
            {t("booking.branchProfile.choose", { name: detail.name })}
          </Button>
        ) : detail && onChoose ? (
          <Button type="button" size="lg" variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            {t("booking.branchProfile.current")}
          </Button>
        ) : undefined
      }
    >
      {branchId && <BranchProfileBody branchId={branchId} />}
    </BookingOverlay>
  );
}

/**
 * Lo de adentro del perfil, sin la ventana: el cajón lo usa y también la lista
 * de sedes de la Agenda, que lo abre sin salir de su modal.
 */
export function BranchProfileBody({ branchId }: { branchId: string }) {
  const t = useAppT();
  const { fmt } = useBookingFlow();
  const [viewing, setViewing] = React.useState<number | null>(null);
  const [showAllServices, setShowAllServices] = React.useState(false);
  const [showAllBarbers, setShowAllBarbers] = React.useState(false);
  const { data: detail, isLoading } = useBranchDetailQuery(branchId);
  const { data: catalog } = useBookingCatalogQuery(branchId);
  const [now] = React.useState(() => new Date());
  const openState = detail ? openStateOf(detail.hours, now) : null;
  const today = now.getDay();
  const services = catalog?.services ?? [];
  const barbers = catalog?.barbers ?? [];
  const priceFrom = (serviceId: string, fallback: number) => {
    const prices = barbers.map((barber) => barber.prices[serviceId]).filter((value): value is number => value !== undefined);
    return prices.length > 0 ? Math.min(...prices) : fallback;
  };
  const shownServices = showAllServices ? services : services.slice(0, FIRST_SERVICES);
  const shownBarbers = showAllBarbers ? barbers : barbers.slice(0, FIRST_BARBERS);

  return (
    <>
      {isLoading || !detail ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {openState && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={openState.kind === "open" ? "secondary" : "outline"}>
                {openState.kind === "open"
                  ? t("booking.branchProfile.open")
                  : openState.kind === "opensLater"
                    ? t("booking.branchProfile.closedNow")
                    : t("booking.branchProfile.closedToday")}
              </Badge>
              <Text size="sm" tone="secondary">
                {openState.kind === "open"
                  ? t("booking.branchProfile.closesAt", { time: fmt.clock(openState.closesAt) })
                  : openState.kind === "opensLater"
                    ? t("booking.branchProfile.opensAt", { time: fmt.clock(openState.opensAt) })
                    : null}
              </Text>
              <Text size="sm" tone="muted" tabular>
                {t("booking.branch.barbers", { count: detail.barbers })}
              </Text>
            </div>
          )}

          {detail.gallery.length > 0 && (
            <section aria-label={t("booking.branchProfile.photos")}>
              <PhotoStrip photos={detail.gallery} onOpen={setViewing} featured />
            </section>
          )}

          <section className="flex flex-col gap-1.5">
            <Heading level={6}>{t("booking.branchProfile.about")}</Heading>
            <Text tone="secondary">{detail.description}</Text>
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="branch-contact">
            <Heading level={6} id="branch-contact">
              {t("booking.branchProfile.contact")}
            </Heading>
            <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
              <div className="flex items-center gap-3 p-3">
                <ThemaIcon name="compass" size="sm" tone="muted" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Text size="sm" weight="medium">
                    {detail.address}
                  </Text>
                  <Text size="xs" tone="muted">
                    {detail.city}, {detail.state} {detail.zipcode}
                  </Text>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a href={detail.mapsUrl} target="_blank" rel="noreferrer">
                    {t("booking.branchProfile.directions")}
                  </a>
                </Button>
              </div>
              <div className="flex items-center gap-3 p-3">
                <ThemaIcon name="phone" size="sm" tone="muted" />
                <Text size="sm" weight="medium" className="flex-1" tabular>
                  {formatPhone(detail.phone)}
                </Text>
                <Button asChild variant="outline" size="sm">
                  <a href={`tel:${detail.phone}`}>{t("booking.branchProfile.call")}</a>
                </Button>
              </div>
              {SOCIALS.filter((social) => detail.links[social.key]).map((social) => (
                <div key={social.key} className="flex items-center gap-3 p-3">
                  <ThemaIcon name={social.icon} size="sm" tone="muted" />
                  <Text size="sm" weight="medium" className="flex-1" truncate>
                    {t(social.label)}
                  </Text>
                  <Button asChild variant="outline" size="sm">
                    <a href={detail.links[social.key]} target="_blank" rel="noreferrer noopener">
                      {t("booking.branchProfile.visit")}
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2" aria-labelledby="branch-hours">
            <Heading level={6} id="branch-hours">
              {t("booking.branchProfile.hours")}
            </Heading>
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {WEEK_ORDER.map((day) => {
                const entry = detail.hours.find((item) => item.day === day);
                const isToday = day === today;
                return (
                  <li key={day} className={cn("flex items-center justify-between gap-3 px-3 py-2", isToday && "bg-primary/5")}>
                    <Text size="sm" weight={isToday ? "semibold" : "normal"} className="capitalize">
                      {fmt.weekday(day)}
                      {isToday && (
                        <Text as="span" size="xs" tone="primary" weight="medium">
                          {" · "}
                          {t("booking.branchProfile.today")}
                        </Text>
                      )}
                    </Text>
                    <Text size="sm" tone={entry?.opensAt ? "default" : "muted"} tabular>
                      {entry?.opensAt && entry.closesAt ? `${fmt.clock(entry.opensAt)} – ${fmt.clock(entry.closesAt)}` : t("booking.branchProfile.closed")}
                    </Text>
                  </li>
                );
              })}
            </ul>
            {detail.closures.map((closure) => (
              <Alert key={closure.startDate} variant="warning">
                <ThemaIcon name="warning" />
                <AlertDescription>
                  {closure.startDate === closure.endDate
                    ? t("booking.branchProfile.closureOne", { name: closure.description, date: fmt.day(parseStart(`${closure.startDate}T00:00`)) })
                    : t("booking.branchProfile.closureRange", { name: closure.description, from: fmt.day(parseStart(`${closure.startDate}T00:00`)), to: fmt.day(parseStart(`${closure.endDate}T00:00`)) })}
                </AlertDescription>
              </Alert>
            ))}
          </section>

          {services.length > 0 && (
            <section className="flex flex-col gap-2" aria-labelledby="branch-services">
              <Heading level={6} id="branch-services">
                {t("booking.branchProfile.services")}
              </Heading>
              <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
                {shownServices.map((service) => (
                  <li key={service.id} className="flex items-center gap-3 px-3 py-2.5">
                    <IconTile size="sm" src={service.imageUrl} icon={<ThemaIcon name="scissors" />} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <Text size="sm" weight="medium" truncate>
                        {service.name}
                      </Text>
                      <Text size="xs" tone="muted">
                        {t("booking.services.minutes", { count: service.durationMin })}
                      </Text>
                    </div>
                    <Text size="sm" tabular tone="secondary">
                      {t("booking.services.from", { price: fmt.money(priceFrom(service.id, service.price)) })}
                    </Text>
                  </li>
                ))}
              </ul>
              {services.length > FIRST_SERVICES && (
                <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setShowAllServices((current) => !current)}>
                  {showAllServices ? t("booking.branchProfile.showLess") : t("booking.branchProfile.showMore", { count: services.length - FIRST_SERVICES })}
                </Button>
              )}
            </section>
          )}

          {barbers.length > 0 && (
            <section className="flex flex-col gap-2" aria-labelledby="branch-team">
              <Heading level={6} id="branch-team">
                {t("booking.branchProfile.team")}
              </Heading>
              <ul className="grid grid-cols-4 gap-3">
                {shownBarbers.map((barber) => (
                  <li key={barber.id} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
                    <Avatar size="lg">
                      {barber.avatarUrl && <AvatarImage src={barber.avatarUrl} alt="" />}
                      <AvatarFallback>{initialsOf(barber.name)}</AvatarFallback>
                    </Avatar>
                    <Text size="xs" weight="medium" truncate className="w-full">
                      {barber.name.split(" ")[0]}
                    </Text>
                    {barber.level && (
                      <Text size="xs" tone="muted" truncate className="w-full">
                        {barber.level}
                      </Text>
                    )}
                  </li>
                ))}
              </ul>
              {barbers.length > FIRST_BARBERS && (
                <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setShowAllBarbers((current) => !current)}>
                  {showAllBarbers ? t("booking.branchProfile.showLess") : t("booking.branchProfile.showMore", { count: barbers.length - FIRST_BARBERS })}
                </Button>
              )}
            </section>
          )}
        </div>
      )}
      <GalleryViewer photos={detail?.gallery ?? []} index={viewing} title={detail?.name ?? ""} onClose={() => setViewing(null)} />
    </>
  );
}
