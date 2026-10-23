import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Heading, Text } from "@/components/typography";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { dayKeyOf, initialsOf, parseStart } from "../bookingFormat";
import { useAlternativesQuery } from "../queries";
import type { BookingBarber } from "../types";
import { BarberProfileDrawer } from "./BarberProfileDrawer";
import { useBookingFlow } from "./BookingContext";

/**
 * Cuando el barbero elegido no tiene horas ese día: otros que hacen los
 * mismos servicios, ordenados por cuánto se parecen (las habilidades que
 * cubren lo pedido y las que comparten con el elegido), con sus primeras horas
 * libres —ese día o el próximo que tengan—. Tocar una hora reserva con él, y
 * «Ver perfil» enseña quién es (habilidades, trabajos, precios) antes de decidir.
 */
export function AlternativeBarbers({ day, onDayChange }: { day: Date; onDayChange: (day: Date) => void }) {
  const t = useAppT();
  const { state, dispatch, catalog, fmt, layout } = useBookingFlow();
  const draft = state.draft;
  const query = useAlternativesQuery({ branchId: state.branchId, date: dayKeyOf(day), serviceIds: draft?.serviceIds ?? [], barberId: draft?.barberId ?? null }, Boolean(draft));
  const items = query.data?.items ?? [];
  const [profile, setProfile] = React.useState<{ barber: BookingBarber; date: string } | null>(null);

  const pick = (barberId: string, date: string, time: string) => {
    // La hora puede ser de otro día («Libre el lun 12»): la agenda va a ese día, donde ese barbero sí tiene horas.
    if (date !== dayKeyOf(day)) onDayChange(parseStart(`${date}T00:00`));
    dispatch({ type: "chooseBarber", barberId });
    dispatch({ type: "chooseTime", start: `${date}T${time}` });
  };

  return (
    <section aria-labelledby="alt-title" aria-busy={query.isLoading} className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <Heading level={6} id="alt-title">
          {draft?.barberId ? t("booking.alt.title") : t("booking.alt.titleAny")}
        </Heading>
        <Text size="sm" tone="secondary">
          {t("booking.alt.lead")}
        </Text>
      </div>

      {query.isLoading ? (
        <div className="flex flex-col gap-3" aria-label={t("booking.alt.loading")}>
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      ) : items.length === 0 ? (
        <Text size="sm" tone="muted">
          {t("booking.alt.none")}
        </Text>
      ) : (
        <ul className={cn("grid gap-3", layout === "wide" && "grid-cols-2")}>
          {items.map((item) => {
            const barber = catalog?.barbers.find((entry) => entry.id === item.barberId);
            if (!barber) return null;
            const sameDay = item.date === dayKeyOf(day);
            return (
              <li key={item.barberId} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="size-11">
                    {barber.avatarUrl && <AvatarImage src={barber.avatarUrl} alt="" />}
                    <AvatarFallback>{initialsOf(barber.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Text size="sm" weight="semibold" truncate>
                      {barber.name}
                    </Text>
                    <Text size="xs" tone="muted" className="flex items-center gap-1" tabular>
                      {barber.level && <span>{barber.level}{barber.reviews > 0 && " ·"}</span>}
                      {barber.reviews > 0 && (
                        <>
                          <span className="text-warning" aria-hidden>
                            ★
                          </span>
                          {barber.rating.toFixed(1)}
                        </>
                      )}
                    </Text>
                  </div>
                  <Badge variant={sameDay ? "positive" : "neutral"} className="shrink-0">
                    {sameDay ? t("booking.alt.sameDay") : t("booking.alt.otherDay", { day: fmt.dayShort(parseStart(`${item.date}T00:00`)) })}
                  </Badge>
                </div>

                <Button type="button" variant="ghost" size="sm" className="-mt-1 self-start text-primary hover:text-primary" onClick={() => setProfile({ barber, date: item.date })} aria-label={`${t("booking.barber.profile")}: ${barber.name}`}>
                  {t("booking.barber.profile")}
                  <ThemaIcon name="chevronRight" size="xs" data-icon="inline-end" />
                </Button>

                {item.skills.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Text size="xs" tone="muted">
                      {t("booking.alt.skills")}
                    </Text>
                    {item.skills.map((skill) => (
                      <Badge key={skill} variant="outline">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {item.times.map((time) => {
                    const label = fmt.time(parseStart(`${item.date}T${time}`));
                    return (
                      <Button key={time} type="button" variant="outline" size="sm" onClick={() => pick(item.barberId, item.date, time)} aria-label={t("booking.alt.pick", { name: barber.name, time: label })}>
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <BarberProfileDrawer
        barber={profile?.barber ?? null}
        serviceIds={draft?.serviceIds ?? []}
        onOpenChange={(open) => !open && setProfile(null)}
        onChoose={(barber) => {
          // Elegirlo desde el perfil lleva a su día libre: sigue en «Fecha y hora», con sus horas.
          if (profile) onDayChange(parseStart(`${profile.date}T00:00`));
          setProfile(null);
          dispatch({ type: "chooseBarber", barberId: barber.id });
        }}
      />
    </section>
  );
}
