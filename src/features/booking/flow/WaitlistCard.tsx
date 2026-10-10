import * as React from "react";
import { toast } from "./bookingToast";
import { useAppT } from "@/app/i18n";
import { SegmentedControl } from "@/components/selection";
import { Heading, Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { clockMinutes, dayKeyOf } from "../bookingFormat";
import { useJoinWaitlistMutation, useLeaveWaitlistMutation } from "../queries";
import type { WaitlistWindow } from "../types";
import { useBookingFlow } from "./BookingContext";
import { WINDOW_KEYS } from "./waitlist";

/** Desde esta hora es noche (la misma frontera que el selector de horas). */
const EVENING_FROM_MINUTES = 18 * 60;


interface WaitlistCardProps {
  day: Date;
  /**
   * El día sí tiene horas: la lista de espera queda como una línea discreta bajo
   * ellas («¿Ninguna te sirve?») y se abre al tocarla, para no competir con las horas.
   */
  hasSlots?: boolean;
}

/**
 * La lista de espera: siempre a mano, haya horas o no —puede que ninguna de las
 * libres le sirva—. Se apunta con la franja que le sirve. La entrada cae en la misma lista
 * de espera que ve la barbería en el Calendario, que le escribe si alguien cancela.
 * Lo apuntado vive en la reserva (`state.waitlist`): sobrevive a cambiar de día y
 * volver, y sin hora apartada apuntarse lleva directo a su confirmación (`WaitlistedStep`).
 */
export function WaitlistCard({ day, hasSlots = false }: WaitlistCardProps) {
  const t = useAppT();
  const { state, dispatch, shop, catalog, fmt } = useBookingFlow();
  const [window, setWindow] = React.useState<WaitlistWindow>("any");
  const [isOpen, setIsOpen] = React.useState(false);
  const join = useJoinWaitlistMutation(state.token);
  const leave = useLeaveWaitlistMutation(state.token);
  const draft = state.draft;
  const customer = state.customer;
  const barber = catalog?.barbers.find((item) => item.id === draft?.barberId);
  if (!draft || !customer || !state.branchId) return null;
  const branchId = state.branchId;
  const dayKey = dayKeyOf(day);
  const joined = state.waitlist.find((entry) => entry.branchId === branchId && entry.date === dayKey && entry.barberId === draft.barberId) ?? null;
  const dayLabel = fmt.dayLong(day);
  // «Noche» solo si la sede trabaja de noche.
  const branch = shop.branches.find((item) => item.id === state.branchId);
  const worksEvenings = branch ? clockMinutes(branch.closesAt) > EVENING_FROM_MINUTES : false;
  const windows = (Object.keys(WINDOW_KEYS) as WaitlistWindow[]).filter((value) => value !== "evening" || worksEvenings);

  if (joined) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl border border-success/40 bg-success/10 p-4">
        <IconTile size="md" shape="circle" tone="positive" icon={<ThemaIcon name="check" />} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Text size="sm" weight="semibold">
            {t("booking.waitlist.joined")}
          </Text>
          <Text size="sm" tone="secondary">
            {t("booking.waitlist.joinedDetail", { day: dayLabel, window: t(WINDOW_KEYS[joined.window]) })}
          </Text>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="self-start px-0"
            disabled={leave.isPending}
            onClick={() =>
              leave.mutate(
                joined.id,
                { onSuccess: () => (dispatch({ type: "waitlistLeft", id: joined.id }), toast(t("booking.waitlist.left"))), onError: () => toast.error(t("booking.waitlist.error")) }
              )
            }
          >
            {t("booking.waitlist.leave")}
          </Button>
        </div>
      </div>
    );
  }

  if (hasSlots && !isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-expanded={false}
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border p-3 text-left transition-colors duration-fast ease-out-expo hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none"
      >
        <IconTile size="md" shape="circle" icon={<ThemaIcon name="notification" />} />
        <span className="flex min-w-0 flex-1 flex-col">
          <Text as="span" size="sm" weight="medium">
            {t("booking.waitlist.prompt")}
          </Text>
          <Text as="span" size="xs" tone="secondary">
            {t("booking.waitlist.promptHint")}
          </Text>
        </span>
        <ThemaIcon name="chevronRight" size="sm" tone="muted" />
      </button>
    );
  }

  return (
    <section aria-labelledby="waitlist-title" className="flex flex-col gap-3 rounded-2xl border border-dashed border-border p-4">
      <div className="flex items-start gap-3">
        <IconTile size="md" shape="circle" icon={<ThemaIcon name="notification" />} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Heading level={6} id="waitlist-title">
            {barber && !hasSlots ? t("booking.waitlist.titleWith", { name: barber.name.split(" ")[0] }) : t("booking.waitlist.title")}
          </Heading>
          <Text size="sm" tone="secondary">
            {t(hasSlots ? "booking.waitlist.leadOther" : "booking.waitlist.lead", { day: dayLabel })}
          </Text>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Text size="xs" tone="muted">
          {t("booking.waitlist.window")}
        </Text>
        <SegmentedControl
          size="sm"
          fullWidth
          value={window}
          onChange={(value) => setWindow(value as WaitlistWindow)}
          options={windows.map((value) => ({ value, label: t(WINDOW_KEYS[value]) }))}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={join.isPending}
        onClick={() =>
          join.mutate(
            { branchId, date: dayKey, serviceIds: draft.serviceIds, barberId: draft.barberId, window },
            {
              onSuccess: (entry) => dispatch({ type: "waitlistJoined", entry: { ...entry, branchId, serviceIds: [...draft.serviceIds], barberId: draft.barberId } }),
              onError: () => toast.error(t("booking.waitlist.error")),
            }
          )
        }
      >
        <ThemaIcon name="notification" />
        {t("booking.waitlist.join")}
      </Button>
    </section>
  );
}
