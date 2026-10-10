import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBookingFlow } from "../../flow/BookingContext";
import { BarberAvatar, BarberProfileBody } from "../../flow/BarberProfileDrawer";
import type { BookingBarber } from "../../types";
import { itemPrice } from "../../useBookingTotals";
import { PickerField, PickerOverlay, PickerRow } from "./AgendaPicker";

interface AgendaBarberFieldProps {
  eyebrow?: string;
  labelledBy: string;
  /** Quienes hacen todo lo elegido, ya ordenados (el de siempre primero). */
  barbers: readonly BookingBarber[];
  usualId: string | null;
  /** Sin sede no hay barberos (son de cada sede): tocar el campo abre primero la sede. */
  onNeedBranch?: () => void;
}

/**
 * «¿Con quién?» en la Agenda con selector, debajo de lo que se va a hacer: el
 * mismo campo y la misma ventana que la sede. «Sin preferencia» primero (más
 * horas para elegir) y luego quienes hacen lo elegido, con su nota y lo que
 * cobran por eso. «Ver perfil» abre su perfil dentro de la ventana. Lo elegido
 * filtra las horas de abajo; las horas se eligen aparte.
 */
export function AgendaBarberField({ labelledBy, barbers, usualId, eyebrow, onNeedBranch }: AgendaBarberFieldProps) {
  const t = useAppT();
  const { state, dispatch, catalog, fmt } = useBookingFlow();
  const [open, setOpen] = React.useState(false);
  const [viewing, setViewing] = React.useState<string | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const serviceIds = state.draft?.serviceIds ?? [];
  const chosen = barbers.find((barber) => barber.id === state.draft?.barberId) ?? null;
  const shown = viewing ? (barbers.find((barber) => barber.id === viewing) ?? null) : null;
  const firstName = (barber: BookingBarber) => barber.name.split(" ")[0] ?? barber.name;

  const openChange = (next: boolean) => {
    setOpen(next);
    if (!next) setViewing(null);
  };
  const choose = (barberId: string | null) => {
    if (barberId !== (state.draft?.barberId ?? null)) dispatch({ type: "chooseBarber", barberId });
    openChange(false);
  };

  return (
    <>
      <PickerField
        asCard
        eyebrow={eyebrow}
        labelledBy={labelledBy}
        imageUrl={chosen?.avatarUrl}
        icon="users"
        round={Boolean(chosen)}
        value={chosen ? chosen.name : t("booking.barber.any")}
        detail={chosen ? [chosen.level, `★ ${chosen.rating.toFixed(1)}`].filter(Boolean).join(" · ") : t("booking.barber.anyLead")}
        placeholder={t("booking.barber.any")}
        open={open}
        onOpen={() => (!state.branchId && onNeedBranch ? onNeedBranch() : setOpen(true))}
        testId="agenda-barber-field"
      />
      <PickerOverlay
        open={open}
        onOpenChange={openChange}
        title={shown ? shown.name : t("booking.agenda.whoLabel")}
        description={shown ? (shown.level ?? undefined) : t("booking.barber.lead")}
        leading={shown ? <BarberAvatar barber={shown} /> : undefined}
        onBack={shown ? () => setViewing(null) : undefined}
        view={shown ? `barber:${shown.id}` : "list"}
        footer={
          shown ? (
            <Button type="button" size="lg" className="w-full" onClick={() => choose(shown.id)}>
              {t("booking.barber.choose", { name: firstName(shown) })}
            </Button>
          ) : undefined
        }
        focusRef={listRef}
      >
        {shown ? (
          <div className="p-4">
            <BarberProfileBody barber={shown} serviceIds={serviceIds} />
          </div>
        ) : (
          <div ref={listRef} role="radiogroup" aria-label={t("booking.agenda.whoLabel")} className="flex flex-col gap-0.5 p-2">
            <PickerRow role="radio" checked={!chosen} label={t("booking.barber.any")} icon="users" round onClick={() => choose(null)}>
              <Text as="span" weight="medium" className="truncate">
                {t("booking.barber.any")}
              </Text>
              <Text as="span" size="xs" tone="muted">
                {t("booking.barber.anyLead")}
              </Text>
            </PickerRow>
            {barbers.length === 0 && (
              <Text size="sm" tone="muted" className="px-2 py-3">
                {t("booking.barber.none")}
              </Text>
            )}
            {barbers.map((barber) => {
              const price = t("booking.services.from", { price: fmt.money(itemPrice({ serviceIds, barberId: barber.id }, catalog)) });
              return (
                <PickerRow
                  key={barber.id}
                  role="radio"
                  checked={chosen?.id === barber.id}
                  label={`${barber.name} · ${price}`}
                  imageUrl={barber.avatarUrl}
                  icon="users"
                  round
                  onClick={() => choose(barber.id)}
                  action={{ label: t("booking.barber.profile"), ariaLabel: `${t("booking.barber.profile")}: ${barber.name}`, onClick: () => setViewing(barber.id) }}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Text as="span" weight="medium" className="truncate">
                      {barber.name}
                    </Text>
                    {barber.id === usualId && <Badge variant="secondary">{t("booking.barber.lastTime")}</Badge>}
                  </span>
                  <Text as="span" size="xs" tone="muted" tabular className="truncate">
                    {[barber.level, `★ ${barber.rating.toFixed(1)}`].filter(Boolean).join(" · ")} · <span className="font-medium text-text-primary">{price}</span>
                  </Text>
                </PickerRow>
              );
            })}
          </div>
        )}
      </PickerOverlay>
    </>
  );
}
