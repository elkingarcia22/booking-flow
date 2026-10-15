import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Heading, Text } from "@/components/typography";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SelectMark } from "@/components/selection";
import { Button } from "@/components/ui/button";
import { MagicCard } from "@/components/ui/magic-card";
import { Skeleton } from "@/components/ui/skeleton";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { initialsOf, parseStart } from "../bookingFormat";
import { QuickActions, type QuickAction } from "../flow/QuickActions";
import { StepLayout } from "../flow/StepLayout";
import { useWelcomeData } from "./useWelcomeData";

const WEEK_DAYS = 7;
const DAY_MS = 86_400_000;


/**
 * El cliente que vuelve, pensado para el pulgar: arriba su ritmo; en medio, lo de siempre en una
 * fila y las horas que le tocan como lista grande (fecha a la izquierda, hora y barbero a la
 * derecha); debajo, en pequeño, los atajos (algo nuevo, mis citas…); abajo, el botón fijo.
 */
export function WelcomeStep() {
  const t = useAppT();
  const data = useWelcomeData();
  const { customer, services, barber, suggestion, price, durationMin, fmt, actions, catalog, last } = data;
  const [picked, setPicked] = React.useState(0);
  // Sin visitas ni propuesta no hay nada que repetir: va directo a armar su cita, sin pantalla vacía.
  const isEmpty = !data.isLoading && !data.suggestion && !data.canRepeat;
  const { startFresh } = actions;
  React.useEffect(() => {
    if (isEmpty) startFresh();
  }, [isEmpty, startFresh]);
  // «Hace N días» se mide contra el momento en que se abrió la pantalla, no en cada render.
  const [now] = React.useState(() => Date.now());
  if (!customer || isEmpty) return null;
  const option = suggestion?.options[picked] ?? suggestion?.options[0] ?? null;
  const when = option ? parseStart(option.start) : null;
  const lead = services[0];

  const rhythm = suggestion
    ? suggestion.everyDays % WEEK_DAYS === 0
      ? t("booking.suggest.everyWeeks", { count: suggestion.everyDays / WEEK_DAYS })
      : t("booking.suggest.everyDays", { count: suggestion.everyDays })
    : null;
  const daysSince = last ? Math.max(0, Math.round((now - new Date(last.at).getTime()) / DAY_MS)) : null;
  const leadText = [rhythm, daysSince !== null ? t("booking.suggest.lastVisit", { count: daysSince }) : null].filter(Boolean).join(" · ");

  const shortcuts: QuickAction[] = [
    { id: "new", icon: "plus", label: t("booking.welcome.somethingNew"), onClick: actions.startFresh },
    ...(customer.upcoming > 0 ? [{ id: "manage", icon: "calendar" as const, label: t("booking.welcome.appointments"), count: customer.upcoming, onClick: actions.manage }] : []),
    ...(data.hasPackages ? [{ id: "packages", icon: "layers" as const, label: t("booking.welcome.packages"), onClick: actions.packages }] : []),
    ...(data.canGift ? [{ id: "gift", icon: "ticket" as const, label: t("booking.welcome.gift"), onClick: actions.gift }] : []),
  ];

  const footer = (
    <div className="flex items-center gap-4">
      <div className="flex min-w-0 flex-1 flex-col">
        <Text size="sm" weight="semibold" tabular truncate className="first-letter:uppercase">
          {when ? `${fmt.dayShort(when)} · ${fmt.time(when)}` : t("booking.welcome.pickTime")}
        </Text>
        <Text size="xs" tone="muted" tabular>
          {fmt.money(price)}
          {customer.credit > 0 ? ` · ${t("booking.welcome.creditShort", { amount: fmt.money(customer.credit) })}` : ""}
        </Text>
      </div>
      {option ? (
        <Button type="button" size="lg" aria-label={when ? t("booking.suggest.book", { when: `${fmt.dayShort(when)} · ${fmt.time(when)}` }) : undefined} onClick={() => actions.book(option)}>
          {t("booking.welcome.book")}
          <ThemaIcon name="arrowRight" />
        </Button>
      ) : (
        <Button type="button" size="lg" disabled={!data.canRepeat} onClick={actions.repeat}>
          {t("booking.welcome.repeat")}
          <ThemaIcon name="arrowRight" />
        </Button>
      )}
    </div>
  );

  return (
    <StepLayout title={t("booking.welcome.title", { name: customer.firstName })} lead={leadText || undefined} footer={footer}>
      {data.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          {lead && (
            <section aria-labelledby="rhythm-usual" className="flex flex-col gap-2">
              <Text size="xs" weight="semibold" tone="muted" className="uppercase tracking-widest">
                {t("booking.welcome.usual")}
              </Text>
              <div className="flex items-center gap-3">
                <IconTile size="lg" src={lead.imageUrl} icon={<ThemaIcon name="scissors" />} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Text weight="semibold" truncate id="rhythm-usual">
                    {services.map((item) => item.name).join(" + ")}
                  </Text>
                  <Text size="xs" tone="muted" truncate>
                    {t("booking.services.minutes", { count: durationMin })}
                    {barber ? ` · ${t("booking.welcome.with", { name: barber.name })}` : ""}
                  </Text>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={actions.startFresh}>
                  {t("booking.welcome.change")}
                </Button>
              </div>
            </section>
          )}

          <section aria-labelledby="rhythm-times" className="flex flex-col gap-3">
            <Heading level={5} id="rhythm-times" className="first-letter:uppercase">
              {suggestion ? (suggestion.isOverdue ? t("booking.suggest.overdue") : t("booking.suggest.due", { date: fmt.dayShort(parseStart(suggestion.options[0]?.start ?? suggestion.dueDate)) })) : t("booking.welcome.pickTime")}
            </Heading>
            {suggestion && suggestion.options.length > 0 ? (
              <div role="radiogroup" aria-label={t("booking.suggest.options")} className="flex flex-col gap-2">
                {suggestion.options.map((item, index) => {
                  const date = parseStart(item.start);
                  const isPicked = index === picked;
                  const who = item.sameBarber ? barber : catalog?.barbers.find((entry) => entry.id === item.barberId);
                  return (
                    <MagicCard
                      key={item.start + item.barberId}
                      role="radio"
                      aria-checked={isPicked}
                      aria-label={`${fmt.day(date)} · ${fmt.time(date)}${who ? ` · ${who.name}` : ""}`}
                      isSelected={isPicked}
                      onClick={() => setPicked(index)}
                      className="w-full"
                      contentClassName="items-center gap-4 text-left"
                    >
                      {/* La fecha como hoja de calendario: el día de la semana pequeño y el número grande. */}
                      <span className={cn("flex w-12 shrink-0 flex-col items-center rounded-xl py-1.5", isPicked ? "bg-primary text-primary-foreground" : "bg-surface-subtle")}>
                        <span className="text-xs font-semibold uppercase opacity-80">{fmt.dayShort(date).split(" ")[0]}</span>
                        <span className="text-lg font-semibold leading-6 tabular-nums">{date.getDate()}</span>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <Text as="span" size="lg" weight="semibold" tabular>
                          {fmt.time(date)}
                        </Text>
                        <Text as="span" size="xs" tone="muted" truncate>
                          {item.sameBarber ? t("booking.welcome.yourBarber") : t("booking.welcome.otherBarber")}
                          {who ? ` · ${who.name}` : ""}
                        </Text>
                      </span>
                      {who && (
                        <Avatar size="sm">
                          {who.avatarUrl && <AvatarImage src={who.avatarUrl} alt="" />}
                          <AvatarFallback>{initialsOf(who.name)}</AvatarFallback>
                        </Avatar>
                      )}
                      <SelectMark kind="radio" checked={isPicked} />
                    </MagicCard>
                  );
                })}
                <Button type="button" variant="ghost" className="self-start" onClick={actions.repeat}>
                  <ThemaIcon name="calendar" />
                  {t("booking.suggest.other")}
                </Button>
              </div>
            ) : (
              <Text size="sm" tone="secondary">
                {t("booking.welcome.noSuggestion")}
              </Text>
            )}
          </section>
        </>
      )}

      {/* Lo demás que se puede hacer, debajo de las horas y en pequeño: no compite con la cita. */}
      <QuickActions label={t("booking.welcome.shortcuts")} actions={shortcuts} layout="tiles" />

      <Button type="button" variant="link" size="sm" className="self-center" onClick={actions.notYou}>
        {t("booking.welcome.notYou")}
      </Button>
    </StepLayout>
  );
}
