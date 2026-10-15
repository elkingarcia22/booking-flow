import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MagicCard } from "@/components/ui/magic-card";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { initialsOf } from "../bookingFormat";
import { useBookingFlow } from "../flow/BookingContext";
import { BarberProfileDrawer } from "../flow/BarberProfileDrawer";
import { SelectMark } from "@/components/selection";
import { StepLayout } from "../flow/StepLayout";
import { VisitPartNote } from "../flow/VisitPartNote";
import type { BookingBarber } from "../types";
import { itemPrice } from "../useBookingTotals";

/**
 * El barbero: «Sin preferencia» primero —es el que más horas abre— y luego
 * cada uno con su foto, su nivel, lo que cobra por lo elegido y su perfil.
 * Solo aparecen quienes hacen todos los servicios de la cita.
 */
export function BarberStep() {
  const t = useAppT();
  const { state, dispatch, catalog, fmt, layout } = useBookingFlow();
  const [profile, setProfile] = React.useState<BookingBarber | null>(null);
  const serviceIds = state.draft?.serviceIds ?? [];
  const lastBarberId = state.customer?.lastVisit?.barberId ?? null;
  const able = (catalog?.barbers ?? [])
    .filter((barber) => serviceIds.every((id) => barber.prices[id] !== undefined))
    // El de la última vez va primero: es a quien la mayoría vuelve.
    .sort((a, b) => Number(b.id === lastBarberId) - Number(a.id === lastBarberId));
  const choose = (barberId: string | null) => dispatch({ type: "chooseBarber", barberId });
  // «Sin preferencia» solo cuenta como elegida cuando ya se eligió con quién (el borrador arranca sin barbero).
  const isAny = Boolean(state.draft?.barberChosen) && state.draft?.barberId === null;

  return (
    <StepLayout title={t("booking.barber.title")} lead={t("booking.barber.lead")} cover>
      {/* Cada parte de una visita: cuál es y, aquí mismo, para quién (puede ser otra persona). */}
      <VisitPartNote withPerson showDone />
      {able.length === 0 ? (
        <Alert variant="warning">
          <ThemaIcon name="warning" />
          <AlertDescription>{t("booking.barber.none")}</AlertDescription>
        </Alert>
      ) : (
        <div role="radiogroup" aria-label={t("booking.barber.title")} className={cn("grid grid-cols-1 gap-3", layout === "wide" && "lg:grid-cols-2")}>
          {able.length > 1 && (
            <MagicCard role="radio" aria-label={t("booking.barber.any")} aria-checked={isAny} isSelected={isAny} onClick={() => choose(null)} className="w-full" contentClassName="items-center gap-3 text-left">
              <IconTile size="lg" shape="circle" icon={<ThemaIcon name="users" />} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Text weight="semibold">{t("booking.barber.any")}</Text>
                <Text size="xs" tone="secondary">
                  {t("booking.barber.anyLead")}
                </Text>
                <Text size="sm" weight="medium" tabular as="span">
                  {t("booking.services.from", { price: fmt.money(itemPrice({ serviceIds, barberId: null }, catalog)) })}
                </Text>
              </span>
              <SelectMark kind="radio" checked={isAny} />
            </MagicCard>
          )}
          {able.map((barber) => (
            <div key={barber.id} className="relative">
              <MagicCard role="radio" aria-label={barber.name} aria-checked={state.draft?.barberId === barber.id} isSelected={state.draft?.barberId === barber.id} onClick={() => choose(barber.id)} className="w-full" contentClassName="items-start gap-3 pb-9 text-left">
                <Avatar size="lg">
                  {barber.avatarUrl && <AvatarImage src={barber.avatarUrl} alt="" />}
                  <AvatarFallback>{initialsOf(barber.name)}</AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Text weight="semibold" truncate>
                    {barber.name}
                  </Text>
                  <Text size="xs" tone="secondary" className="flex flex-wrap items-center gap-x-1">
                    {barber.id === lastBarberId ? <span className="font-medium text-primary">{t("booking.barber.lastTime")}</span> : barber.level}
                    <span aria-hidden>·</span>
                    <span className="text-warning" aria-hidden>
                      ★
                    </span>
                    <span className="tabular-nums">{barber.rating.toFixed(1)}</span>
                  </Text>
                  <Text size="sm" weight="medium" tabular as="span">
                    {fmt.money(itemPrice({ serviceIds, barberId: barber.id }, catalog))}
                  </Text>
                </span>
                <SelectMark kind="radio" checked={state.draft?.barberId === barber.id} />
              </MagicCard>
              {/* El perfil es otro botón, fuera de la tarjeta (un botón no va dentro de otro), puesto bajo el precio y
                  alineado con el texto (borde + relleno + foto + hueco): igual que el de la sede. */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute bottom-3 left-[calc(4.25rem+1.5px)] z-raised -translate-x-2.5 text-primary hover:text-primary"
                onClick={() => setProfile(barber)}
                aria-label={`${t("booking.barber.profile")}: ${barber.name}`}
              >
                {t("booking.barber.profile")}
                <ThemaIcon name="chevronRight" size="xs" data-icon="inline-end" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <BarberProfileDrawer
        barber={profile}
        serviceIds={serviceIds}
        onOpenChange={(open) => !open && setProfile(null)}
        onChoose={(barber) => {
          setProfile(null);
          choose(barber.id);
        }}
      />
    </StepLayout>
  );
}
