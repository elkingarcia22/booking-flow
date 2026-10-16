import * as React from "react";
import { startOfDay } from "date-fns";
import { useAppT } from "@/app/i18n";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Text } from "@/components/typography";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { personName } from "../../bookingState";
import { dayKeyOf, firstBookableDay, parseStart } from "../../bookingFormat";
import { useBookingFlow } from "../../flow/BookingContext";
import { AgendaCover, AgendaCoverTitle } from "../../flow/AgendaCover";
import { AlternativeBarbers } from "../../flow/AlternativeBarbers";
import { NextToPart } from "../../flow/NextToPart";
import { CallCard, ScheduleHeading } from "../../flow/ScheduleParts";
import { SeparateServicesSwitch } from "../../flow/SeparateServicesSwitch";
import { VisitPartNote } from "../../flow/VisitPartNote";
import { PersonPicker } from "../../flow/PersonPicker";
import { WaitlistCard } from "../../flow/WaitlistCard";
import { useAvailabilityQuery, useEarliestQuery } from "../../queries";
import { itemDuration } from "../../useBookingTotals";
import { busyRanges, overlapsBusy } from "../../visit";
import { ableBarbers, timesByWindow } from "./agendaModel";
import { TimeWindows } from "./AgendaLanes";
import { HeldAppointments } from "./HeldAppointments";
import { AgendaSelectFields } from "./AgendaSelectFields";
import { DayStrip } from "@/components/scheduling";

/** Lo de siempre ya está puesto: el atajo sobra. */
/** «HH:mm» de una hora del día, como la escriben las franjas. */
const clockOf = (date: Date): string => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const sameServices = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((id) => b.includes(id));

/** Cuántos días se recorren en la tira. */
/** Los avisos van sobre la foto: fondo sólido con el tinte encima, para que no se transparenten. */
const SOLID_INFO = "bg-surface dark:bg-surface bg-[linear-gradient(hsl(var(--info)/0.08),hsl(var(--info)/0.08))]";

const DAYS_AHEAD = 21;
/** Entre una pieza y la siguiente de la cascada al cambiar de parte. */
const CASCADE_STEP_MS = 180;
const CASCADE = "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-4 motion-safe:duration-700 motion-safe:ease-out-expo motion-safe:[animation-fill-mode:both]";
const SKELETON_LANES = 3;

/**
 * El tablero de la Agenda: sede, servicios y barbero arriba, como
 * campos que abren su lista; el día en una tira y, debajo, las horas libres por
 * franja. Una hora se aparta con un toque y cae en «Tu reserva»; quién es el
 * cliente se pregunta después, al confirmar.
 */
export function AgendaBoard({ onNeedSignIn, timeMissing = false, heldCount = 0 }: { onNeedSignIn: () => void; /** Tocó «Continuar» sin hora: la sección de día y hora se marca en rojo. */ timeMissing?: boolean; /** Citas ya confirmadas antes de sumar otra: la hora que se aparta es la siguiente a ellas. */ heldCount?: number }) {
  const t = useAppT();
  const { state, dispatch, shop, catalog, fmt, layout, touch } = useBookingFlow();
  const branch = shop.branches.find((item) => item.id === state.branchId);
  const first = React.useMemo(() => (branch ? firstBookableDay(branch.closesAt, shop.minNoticeMinutes) : startOfDay(new Date())), [branch, shop.minNoticeMinutes]);
  const [day, setDay] = React.useState<Date>(first);
  const draft = state.draft;

  const serviceIds = draft?.serviceIds ?? [];
  // Las tres respuestas de arriba: sede, servicios y barbero (que siempre tiene una, «Sin preferencia» de entrada).
  const isReady = Boolean(state.branchId) && serviceIds.length > 0;
  const dayKey = dayKeyOf(day);

  // Al cambiar una cita del carrito, la agenda salta a su día.
  const editingStart = state.editingIndex !== null ? state.items[state.editingIndex]?.start : null;
  const [editingSeen, setEditingSeen] = React.useState(editingStart);
  if (editingStart !== editingSeen) {
    setEditingSeen(editingStart);
    if (editingStart) setDay(startOfDay(parseStart(editingStart)));
  }

  const usualId = state.customer && !state.customer.isNew ? (state.customer.lastVisit?.barberId ?? null) : null;
  const barbers = ableBarbers(catalog?.barbers ?? [], serviceIds, usualId);
  const availability = useAvailabilityQuery({ branchId: state.branchId, date: dayKey, serviceIds, barberId: null });
  const allSlots = availability.data?.date === dayKey ? availability.data.slots : [];
  const isWaiting = availability.isLoading || (availability.isFetching && availability.data?.date !== dayKey);
  const marked = React.useMemo(() => new Set(state.items.map((item) => item.start?.slice(0, 10)).filter((key): key is string => Boolean(key))), [state.items]);
  const services = catalog?.services ?? [];
  // El barbero se elige en su campo: las horas de abajo son solo las suyas.
  const chosenBarber = barbers.find((barber) => barber.id === draft?.barberId) ?? null;
  const editing = state.editingIndex !== null ? state.items[state.editingIndex] : null;
  // Lo que la misma persona ya tiene apartado (sin la hora que se está eligiendo, que se reemplaza):
  // esas horas no salen, nadie puede estar en dos sillas.
  const minutes = itemDuration(serviceIds, catalog);
  const others = state.items.map((item, index) => (index === heldCount ? { ...item, start: null } : item));
  const busy = draft ? busyRanges(others, draft, state.editingIndex, (item) => itemDuration(item.serviceIds, catalog)) : [];
  const isBlocked = (date: Date) => overlapsBusy(date, minutes, busy);
  const parts = draft?.visitId ? busy.filter((range) => range.item.visitId === draft.visitId) : [];
  const barberSlots = chosenBarber ? allSlots.filter((slot) => slot.barberIds.includes(chosenBarber.id)).map((slot) => ({ ...slot, barberIds: [chosenBarber.id] })) : allSlots;
  const slots = busy.length > 0 ? barberSlots.filter((slot) => !isBlocked(parseStart(`${dayKey}T${slot.time}`))) : barberSlots;
  const hidesBusy = slots.length < barberSlots.length;
  // Al pasar de una parte a otra, la parte, los campos y las horas entran en cascada: se nota que cambió.
  // Cada pieza con su clave propia (la misma en hermanos dejaba la parte vieja junto a la nueva).
  const cascadeKey = draft?.visitId ? draft.key : "board";
  const cascade = (position: number) => (draft?.visitId ? cn(CASCADE, position > 0 && "motion-safe:[animation-delay:var(--cascade-delay)]") : undefined);
  const cascadeDelay = (position: number): React.CSSProperties | undefined => (draft?.visitId ? ({ "--cascade-delay": `${position * CASCADE_STEP_MS}ms` } as React.CSSProperties) : undefined);
  // Una parte nueva de la visita (aún sin hora apartada) abre en el día de la otra parte.
  const [partSeen, setPartSeen] = React.useState(draft?.key);
  if (draft && draft.key !== partSeen) {
    setPartSeen(draft.key);
    if (parts[0] && !state.items[heldCount]) setDay(startOfDay(new Date(parts[0].start)));
  }
  const earliest = useEarliestQuery({ branchId: state.branchId, serviceIds, barberId: chosenBarber?.id ?? null });
  const timeLabel = (time: string) => fmt.clock(time);
  // «Lo de siempre»: lo de su última visita, si fue en esta sede y sigue en el catálogo.
  const lastVisit = state.customer && !state.customer.isNew ? state.customer.lastVisit : null;
  const usual = lastVisit && lastVisit.branchId === state.branchId && lastVisit.serviceIds.every((id) => services.some((service) => service.id === id)) ? lastVisit : null;

  const applyUsual = () => usual && dispatch({ type: "openDraft", person: draft?.person ?? { kind: "self" }, serviceIds: usual.serviceIds, barberId: null });

  const pick = (time: string, barberId: string | null, freeIds: readonly string[] = []) => {
    if (!draft) return;
    const start = `${dayKey}T${time}`;
    dispatch({ type: "chooseBarber", barberId });
    dispatch({ type: "chooseTime", start, assignedBarberId: barberId ? null : (freeIds[0] ?? null) });
  };

  // Una cita por elegir: lo apartado no se descuenta de las horas, se marca (y tocar otra la reemplaza).
  const windows = timesByWindow(slots, dayKey, [], null);
  const pickedStart = state.items[heldCount]?.start ?? null;
  const selectedTime = pickedStart?.startsWith(dayKey) ? pickedStart.slice(11, 16) : null;
  const hasSlots = slots.length > 0;
  const nextSlot = earliest.data?.slot ?? null;

  const heading = <AgendaCoverTitle title={t("booking.agenda.selectTitle")} lead={t("booking.agenda.selectLead")} />;

  return (
    <AgendaCover>
      {editing && (
        <Alert variant="info" className={SOLID_INFO}>
          <ThemaIcon name="edit" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{t("booking.agenda.editing", { name: personName(editing.person, state.customer) || t("booking.person.self") })}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => dispatch({ type: "discardDraft" })}>
              {t("booking.agenda.editingCancel")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Las que ya apartó: se ven de un vistazo y se abren para ver el detalle (y editar). Por separado,
          lo dice el talón de la parte, como en Paso a paso. Volver a «Confirma tu cita» es «Atrás». */}
      {heldCount > 0 && !editing && !draft?.visitId && <HeldAppointments count={heldCount} />}

      {/* Título y lo que se elige sobre la foto de fondo, sin caja; las horas van debajo. */}
      <section className="flex flex-col gap-5">
        {heading}
        {/* Por separado, la tarjeta de la parte dice cuál se elige y, con cuenta, para quién: reemplaza al selector de siempre. */}
        <div key={`${cascadeKey}-part`} className={cascade(0)} style={cascadeDelay(0)}>
          <VisitPartNote items={state.items.filter((_, index) => index !== heldCount)} withPerson={Boolean(state.customer)} showDone />
        </div>
        {/* Sin cuenta no hay a quién más elegir: el nombre de quien viene se pide al final, con sus datos. */}
        {state.customer && !draft?.visitId && <PersonPicker />}
        <div key={`${cascadeKey}-fields`} className={cascade(1)} style={cascadeDelay(1)}>
          <AgendaSelectFields
            barbers={barbers}
            usualId={usualId}
            // Por separado no hay «Lo de siempre»: cada parte es un servicio, el atajo armaría otra cosa.
            onUsual={usual && !editing && !draft?.visitId && !sameServices(usual.serviceIds, serviceIds) ? applyUsual : undefined}
            afterServices={
              // Con dos o más servicios, pegado a ellos: cada uno con su barbero u hora. Encendido desaparece
              // (la tarjeta de la parte trae «Juntar todo»).
              !editing && serviceIds.length > 1 && !draft?.visitId ? (
                <SeparateServicesSwitch checked={false} onCheckedChange={(checked) => checked && dispatch({ type: "bookSeparately" })} count={serviceIds.length} />
              ) : undefined
            }
          />
        </div>
      </section>

      {/* El día y la hora aparecen cuando les toca, como cada pregunta: con sede y servicios ya respondidos. */}
      {isReady && (
        <section key={`${cascadeKey}-when`} aria-labelledby="agenda-when" className={cn("flex flex-col gap-3", cascade(2))} style={cascadeDelay(2)}>
          {/* La última pregunta: después de sede, servicios y barbero. Por separado: de qué servicio es la hora. */}
          <ScheduleHeading id="agenda-when" day={day} missing={timeMissing} label={draft?.visitId ? t("booking.visit.whenFor", { service: services.filter((service) => serviceIds.includes(service.id)).map((service) => service.name).join(" + ") }) : undefined} />
          {timeMissing && (
            <Text role="alert" size="sm" tone="negative" weight="medium" className="flex items-center gap-1.5">
              <ThemaIcon name="error" size="sm" tone="negative" />
              {t("booking.agenda.pickTime")}
            </Text>
          )}
          <DayStrip first={first} count={DAYS_AHEAD} value={day} onChange={setDay} marked={marked} size={touch} />
        </section>
      )}

      {/* Sin sede o sin servicio no hay aviso abajo: las tarjetas y el día apagado ya dicen qué falta. */}
      {!isReady ? null : (
        <>
          {isWaiting ? (
            <div className={cn("grid grid-cols-1 gap-3", layout === "wide" && "grid-cols-2")}>
              {Array.from({ length: SKELETON_LANES }, (_, index) => (
                <Skeleton key={index} className="h-36 rounded-2xl" />
              ))}
            </div>
          ) : !hasSlots ? (
            <EmptyState
              icon="calendar"
              title={chosenBarber ? t("booking.agenda.emptyBarberDay", { name: chosenBarber.name.split(" ")[0] ?? chosenBarber.name, day: fmt.dayLong(day) }) : t("booking.agenda.emptyDayTitle", { day: fmt.dayLong(day) })}
              description={chosenBarber ? t("booking.agenda.emptyBarberDayLead") : t("booking.agenda.emptyDayLead")}
              action={
                nextSlot && nextSlot.date !== dayKey ? (
                  <Button type="button" onClick={() => setDay(startOfDay(parseStart(`${nextSlot.date}T00:00`)))}>
                    {t("booking.agenda.jumpTo", { day: fmt.dayShort(parseStart(`${nextSlot.date}T00:00`)) })}
                    <ThemaIcon name="arrowRight" />
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              {parts.length > 0 && (
                <NextToPart
                  day={day}
                  parts={parts}
                  busy={busy}
                  minutes={minutes}
                  isFree={(date) => slots.some((slot) => slot.time === clockOf(date))}
                  onPick={(date) => {
                    const time = clockOf(date);
                    pick(time, chosenBarber?.id ?? null, slots.find((slot) => slot.time === time)?.barberIds ?? []);
                  }}
                />
              )}
              <TimeWindows className={cn(timeMissing && "rounded-2xl outline outline-1 outline-offset-4 outline-destructive")} groups={windows} timeLabel={timeLabel} withName={chosenBarber?.name.split(" ")[0]} selectedTime={selectedTime} onPick={(time, freeIds) => pick(time, chosenBarber?.id ?? null, freeIds)} />
              {hidesBusy && (
                <Text size="xs" tone="muted" className="flex items-start gap-2">
                  <ThemaIcon name="info" size="sm" />
                  {t("booking.visit.busyHidden")}
                </Text>
              )}
            </>
          )}

          {/* Un día sin horas, como en Paso a paso: otros barberos que sí tienen, con sus primeras horas
              (parecidos al elegido o, sin preferencia, quién tiene horas más pronto). */}
          {!isWaiting && !hasSlots && <AlternativeBarbers day={day} onDayChange={setDay} />}

          {!isWaiting &&
            (state.customer && state.verified ? (
              <WaitlistCard
                key={`${dayKey}|${draft?.barberId ?? "any"}`}
                day={day}
                hasSlots={hasSlots}
              />
            ) : (
              <Button type="button" variant="link" size="sm" className="self-start px-0" onClick={onNeedSignIn}>
                <ThemaIcon name="notification" />
                {t("booking.agenda.waitlistSignIn")}
              </Button>
            ))}

          {/* Al final de todo, igual que en Paso a paso: si aquí no hay horario o algo falla, se agenda por teléfono. */}
          {!isWaiting && branch && <CallCard phone={branch.phone} />}
        </>
      )}
    </AgendaCover>
  );
}
