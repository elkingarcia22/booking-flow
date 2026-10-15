import * as React from "react";
import { startOfDay } from "date-fns";
import { useAppT } from "@/app/i18n";
import { EmptyState } from "@/components/feedback/EmptyState";
import { TimeSlotPicker } from "@/components/scheduling";
import { Text } from "@/components/typography";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { clockMinutes, dayKeyOf, firstBookableDay, initialsOf, isSameDayAs, isTodayOver, parseStart, toStart } from "../bookingFormat";
import { AlternativeBarbers } from "../flow/AlternativeBarbers";
import { EarliestSlot } from "../flow/EarliestSlot";
import { NextToPart } from "../flow/NextToPart";
import { useBookingFlow } from "../flow/BookingContext";
import { StepLayout } from "../flow/StepLayout";
import { useBookingSkin } from "../flow/bookingSkin";
import { CallCard, ScheduleHeading } from "../flow/ScheduleParts";
import { timesByWindow } from "../variants/agenda/agendaModel";
import { TimeWindows } from "../variants/agenda/AgendaLanes";
import { DayStrip } from "@/components/scheduling";
import { VisitPartNote } from "../flow/VisitPartNote";
import { WaitlistSignIn } from "../flow/WaitlistSignIn";
import { useAvailabilityQuery, useEarliestQuery } from "../queries";
import type { DraftItem } from "../bookingState";
import { itemDuration } from "../useBookingTotals";
import { busyRanges, overlapsBusy } from "../visit";

/** Cuántos días hacia delante se puede reservar. */
const BOOKING_WINDOW_DAYS = 42;
const HOUR = 60;

const clockOf = (date: Date): string => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

/**
 * Cuándo: el día en una tira y solo las horas libres de ese día, para el
 * barbero elegido o para cualquiera. La disponibilidad se pide al servidor
 * por día, así lo que se ve es lo que se puede reservar. Un día sin horas no
 * es un callejón: propone otros barberos que hacen lo mismo. La lista de espera está
 * siempre, haya horas o no.
 */
export function TimeStep() {
  const t = useAppT();
  const { state, dispatch, shop, catalog, touch, fmt } = useBookingFlow();
  const skin = useBookingSkin();
  const draft = state.draft;
  const branch = shop.branches.find((item) => item.id === state.branchId);
  const todayOver = branch ? isTodayOver(branch.closesAt, shop.minNoticeMinutes) : false;
  // Lo que la misma persona ya tiene en el carrito: esas horas no se ofrecen (no puede estar en dos sillas).
  const busy = draft ? busyRanges(state.items, draft, state.editingIndex, (item: DraftItem) => itemDuration(item.serviceIds, catalog)) : [];
  // Las otras partes de su visita: la tira abre en su día y se propone encadenarla.
  const parts = draft?.visitId ? busy.filter((range) => range.item.visitId === draft.visitId) : [];
  const [day, setDay] = React.useState<Date>(() =>
    draft?.start ? startOfDay(parseStart(draft.start)) : parts[0] ? startOfDay(new Date(parts[0].start)) : branch ? firstBookableDay(branch.closesAt, shop.minNoticeMinutes) : startOfDay(new Date())
  );
  const availability = useAvailabilityQuery({ branchId: state.branchId, date: dayKeyOf(day), serviceIds: draft?.serviceIds ?? [], barberId: draft?.barberId ?? null });
  const free = React.useMemo(() => new Set((availability.data?.date === dayKeyOf(day) ? availability.data.slots : []).map((slot) => slot.time)), [availability.data, day]);
  // El primer hueco libre (la misma consulta que «Lo antes posible»): el aviso del día vacío salta a él.
  const nextSlot = useEarliestQuery({ branchId: state.branchId, serviceIds: draft?.serviceIds ?? [], barberId: draft?.barberId ?? null }).data?.slot ?? null;
  const isWaiting = availability.isLoading || (availability.isFetching && availability.data?.date !== dayKeyOf(day));
  const barber = catalog?.barbers.find((item) => item.id === draft?.barberId);
  const minutes = itemDuration(draft?.serviceIds ?? [], catalog);
  const services = (draft?.serviceIds ?? []).map((id) => catalog?.services.find((service) => service.id === id)?.name).filter(Boolean);

  if (!draft || !branch) return null;

  const isBlocked = (date: Date) => overlapsBusy(date, minutes, busy);
  const pick = (date: Date) => {
    const start = toStart(date);
    // Sin preferencia, el precio es el de quien la agenda asigna a esa hora: el primero libre.
    const assignedBarberId = availability.data?.slots.find((slot) => slot.time === start.slice(11, 16))?.barberIds[0] ?? null;
    dispatch({ type: "chooseTime", start, assignedBarberId });
  };
  const hidesBusy = busy.some((range) => isSameDayAs(new Date(range.start), day));
  const firstDay = firstBookableDay(branch.closesAt, shop.minNoticeMinutes);
  const daySlots = (availability.data?.date === dayKeyOf(day) ? availability.data.slots : []).filter((slot) => !isBlocked(parseStart(`${dayKeyOf(day)}T${slot.time}`)));
  const windows = timesByWindow(daySlots, dayKeyOf(day), [], null);
  const selectedTime = draft.start?.startsWith(dayKeyOf(day)) ? draft.start.slice(11, 16) : null;
  // El mismo aviso que la Agenda en lista: qué día no tiene horas y un salto al primero que sí.
  const emptyDay = (
    <EmptyState
      icon="calendar"
      title={barber ? t("booking.agenda.emptyBarberDay", { name: barber.name.split(" ")[0] ?? barber.name, day: fmt.dayLong(day) }) : t("booking.agenda.emptyDayTitle", { day: fmt.dayLong(day) })}
      description={barber ? t("booking.agenda.emptyBarberDayLead") : t("booking.agenda.emptyDayLead")}
      action={
        nextSlot && nextSlot.date !== dayKeyOf(day) ? (
          <Button type="button" onClick={() => setDay(startOfDay(parseStart(`${nextSlot.date}T00:00`)))}>
            {t("booking.agenda.jumpTo", { day: fmt.dayShort(parseStart(`${nextSlot.date}T00:00`)) })}
            <ThemaIcon name="arrowRight" />
          </Button>
        ) : undefined
      }
    />
  );

  return (
    <StepLayout title={t("booking.time.title")} lead={t("booking.time.lead")} cover>
      <VisitPartNote showDone />
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-subtle p-3">
        {barber ? (
          <Avatar>
            {barber.avatarUrl && <AvatarImage src={barber.avatarUrl} alt="" />}
            <AvatarFallback>{initialsOf(barber.name)}</AvatarFallback>
          </Avatar>
        ) : (
          <IconTile size="md" shape="circle" icon={<ThemaIcon name="users" />} />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <Text size="sm" weight="medium" truncate>
            {barber ? t("booking.time.with", { name: barber.name }) : t("booking.time.withAny")}
          </Text>
          <Text size="xs" tone="muted" truncate>
            {services.join(" + ")} · {t("booking.review.minutes", { count: minutes })}
          </Text>
        </div>
        {/* «Cambiar» vuelve al comienzo de lo elegido: los servicios (siguen marcados) y luego el barbero. */}
        <Button type="button" variant="ghost" size="sm" onClick={() => dispatch({ type: "goTo", step: "services" })}>
          {t("booking.time.change")}
        </Button>
      </div>

      {/* Mismo orden que la Agenda: el título del día, «Lo antes posible» y la tira. */}
      {skin === "agenda" && <ScheduleHeading day={day} />}

      {parts.length > 0 && !isWaiting && <NextToPart day={day} parts={parts} busy={busy} minutes={minutes} isFree={(date) => free.has(clockOf(date))} onPick={pick} />}

      <EarliestSlot isBlocked={isBlocked} />

      {skin === "agenda" ? (
        // La cara de la Agenda («Según el cliente»): la tira de días grande y las horas por franja.
        <div className="flex flex-col gap-4">
          <DayStrip first={firstDay} count={BOOKING_WINDOW_DAYS} value={day} onChange={setDay} size={touch} />
          {isWaiting ? <Skeleton className="h-36 rounded-2xl" /> : windows.length > 0 ? <TimeWindows groups={windows} timeLabel={fmt.clock} withName={barber?.name.split(" ")[0]} selectedTime={selectedTime} onPick={(time) => pick(parseStart(`${dayKeyOf(day)}T${time}`))} /> : emptyDay}
        </div>
      ) : (
        <TimeSlotPicker
          value={draft.start ? parseStart(draft.start) : null}
          onChange={pick}
          day={day}
          onDayChange={setDay}
          daysCount={BOOKING_WINDOW_DAYS}
          startHour={Math.floor(clockMinutes(branch.opensAt) / HOUR)}
          endHour={Math.ceil(clockMinutes(branch.closesAt) / HOUR)}
          slotMinutes={shop.slotMinutes}
          isDayDisabled={(date) => todayOver && isSameDayAs(date, new Date())}
          isSlotDisabled={(date) => !free.has(clockOf(date)) || isBlocked(date)}
          hideUnavailable
          emptyDay={emptyDay}
          loading={isWaiting}
          size={touch}
        />
      )}

      {hidesBusy && !isWaiting && (
        <Text size="xs" tone="muted" className="flex items-start gap-2">
          <ThemaIcon name="info" size="sm" />
          {t("booking.visit.busyHidden")}
        </Text>
      )}

      {!isWaiting && free.size === 0 && <AlternativeBarbers day={day} onDayChange={setDay} />}

      {/* Siempre: aunque haya horas, puede que ninguna le sirva. Sin cuenta, pide el celular y el código, como la Agenda. */}
      {!isWaiting && <WaitlistSignIn key={`${dayKeyOf(day)}|${draft.barberId ?? "any"}`} day={day} hasSlots={free.size > 0} />}

      {/* Al final de todo: si aquí no hay horario o algo falla, se agenda por teléfono. */}
      {!isWaiting && <CallCard phone={branch.phone} />}
    </StepLayout>
  );
}
