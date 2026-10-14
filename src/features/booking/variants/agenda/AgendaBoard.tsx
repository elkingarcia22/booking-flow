import * as React from "react";
import { startOfDay } from "date-fns";
import { useAppT } from "@/app/i18n";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Heading, Text } from "@/components/typography";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { personName } from "../../bookingState";
import { dayKeyOf, firstBookableDay, parseStart } from "../../bookingFormat";
import { useBookingFlow } from "../../flow/BookingContext";
import { STEP_WIDTH } from "../../flow/stepWidth";
import { AlternativeBarbers } from "../../flow/AlternativeBarbers";
import { EarliestSlot } from "../../flow/EarliestSlot";
import { PersonPicker } from "../../flow/PersonPicker";
import { WaitlistCard } from "../../flow/WaitlistCard";
import { useAvailabilityQuery, useEarliestQuery } from "../../queries";
import { ableBarbers, timesByWindow } from "./agendaModel";
import { TimeWindows } from "./AgendaLanes";
import { HeldAppointments } from "./HeldAppointments";
import { AgendaSelectFields } from "./AgendaSelectFields";
import { DayStrip } from "./DayStrip";

/** Lo de siempre ya está puesto: el atajo sobra. */
const sameServices = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((id) => b.includes(id));

/** Cuántos días se recorren en la tira. */
/** Los avisos van sobre la foto: fondo sólido con el tinte encima, para que no se transparenten. */
const SOLID_INFO = "bg-surface dark:bg-surface bg-[linear-gradient(hsl(var(--info)/0.08),hsl(var(--info)/0.08))]";

const DAYS_AHEAD = 21;
const SKELETON_LANES = 3;

/**
 * El tablero de la Agenda: sede, servicios y barbero arriba, como
 * campos que abren su lista; el día en una tira y, debajo, las horas libres por
 * franja. Una hora se aparta con un toque y cae en «Tu reserva»; quién es el
 * cliente se pregunta después, al confirmar.
 */
export function AgendaBoard({ onNeedSignIn, timeMissing = false, heldCount = 0, onBackToHeld }: { onNeedSignIn: () => void; /** Tocó «Continuar» sin hora: la sección de día y hora se marca en rojo. */ timeMissing?: boolean; /** Citas ya confirmadas antes de sumar otra: la hora que se aparta es la siguiente a ellas. */ heldCount?: number; /** Volver a «Confirma tu cita» sin sumar la otra. */ onBackToHeld?: () => void }) {
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
  const slots = chosenBarber ? allSlots.filter((slot) => slot.barberIds.includes(chosenBarber.id)).map((slot) => ({ ...slot, barberIds: [chosenBarber.id] })) : allSlots;
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

  const heading = (
    <header className="flex flex-wrap items-end justify-between gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300">
      {/* Sobre la foto. En claro va en vidrio ahumado: la foto desenfocada y más viva detrás, un canto de luz
          arriba y texto blanco (un vidrio claro sobre una foto oscura salía gris). En oscuro basta la sombra del fondo. */}
      <div className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-white/25 bg-black/30 px-4 py-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_10px_28px_-14px_rgb(0_0_0/0.6)] backdrop-blur-xl backdrop-saturate-150 dark:rounded-none dark:border-0 dark:bg-transparent dark:p-0 dark:shadow-none dark:backdrop-blur-none dark:backdrop-saturate-100">
        <Heading level={layout === "wide" ? 2 : 3} tone="inverse" className="dark:text-text-primary dark:[text-shadow:0_1px_16px_hsl(var(--background))]">
          {t("booking.agenda.selectTitle")}
        </Heading>
        <Text tone="inverse" className="dark:text-text-primary dark:[text-shadow:0_1px_10px_hsl(var(--background))]">{t("booking.agenda.selectLead")}</Text>
      </div>
    </header>
  );
  // La portada (como la entrada de Paso a paso): la foto de la barbería de fondo, que se funde hacia abajo.
  const cover = shop.coverUrl ?? shop.branches.find((branch) => branch.imageUrl)?.imageUrl ?? null;

  return (
    <>
    {/* Encuadrada arriba (donde está la cara) y desvanecida por máscara, para fundirse con cualquier fondo de debajo. */}
    <div className={cn("relative shrink-0 overflow-hidden dark:[mask-image:linear-gradient(to_bottom,black_55%,transparent)]", layout === "wide" ? "h-72" : "h-48 dark:h-56")} aria-hidden>
      {cover && <img src={cover} alt="" className="size-full object-cover object-[50%_15%] brightness-[1.2] dark:brightness-100 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700" />}
      {/* En claro la foto va entera, sin velo ni desvanecido y algo más clara: cualquier fundido la lavaba de
          blanco. En oscuro el velo la cubre entera y el título se lee sobre ella. */}
      <div className="absolute inset-0 hidden bg-gradient-to-t from-background via-background/85 via-50% to-background/45 dark:block" />
    </div>
    {/* Se lee como Paso a paso: una columna centrada, del mismo ancho. */}
    <div className={cn("relative mx-auto flex w-full flex-col gap-6 px-5 pb-8 pt-6", STEP_WIDTH[layout], layout === "wide" ? "-mt-60 px-8 pt-8" : "-mt-40 dark:-mt-48")}>

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

      {/* Las que ya apartó: se ven de un vistazo y se abren para ver el detalle. */}
      {heldCount > 0 && !editing && <HeldAppointments count={heldCount} onBack={onBackToHeld} />}

      {/* Título y lo que se elige sobre la foto de fondo, sin caja; las horas van debajo. */}
      <section className="flex flex-col gap-5">
        {heading}
        {/* Sin cuenta no hay a quién más elegir: el nombre de quien viene se pide al final, con sus datos. */}
        {state.customer && <PersonPicker />}
        <AgendaSelectFields barbers={barbers} usualId={usualId} onUsual={usual && !editing && !sameServices(usual.serviceIds, serviceIds) ? applyUsual : undefined} />
      </section>

      {/* El día y la hora aparecen cuando les toca, como cada pregunta: con sede y servicios ya respondidos. */}
      {isReady && (
        <section aria-labelledby="agenda-when" className="flex flex-col gap-3">
          <div className="flex min-h-8 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            {/* La última pregunta: después de sede, servicios y barbero. */}
            <Text id="agenda-when" size="sm" weight="medium" tone={timeMissing ? "negative" : undefined} className="flex items-center gap-2.5">
              {t("booking.agenda.whenLabel")}
            </Text>
            <Text size="sm" tone="muted" className="first-letter:uppercase">
              {fmt.dayLong(day)}
            </Text>
          </div>
          {timeMissing && (
            <Text role="alert" size="sm" tone="negative" weight="medium" className="flex items-center gap-1.5">
              <ThemaIcon name="error" size="sm" tone="negative" />
              {t("booking.agenda.pickTime")}
            </Text>
          )}
          {/* «Lo antes posible» se calcula con sede y servicio: hasta entonces solo se ven los días. */}
          {!editing && <EarliestSlot />}
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
            <TimeWindows className={cn(timeMissing && "rounded-2xl outline outline-1 outline-offset-4 outline-destructive")} groups={windows} timeLabel={timeLabel} withName={chosenBarber?.name.split(" ")[0]} selectedTime={selectedTime} onPick={(time, freeIds) => pick(time, chosenBarber?.id ?? null, freeIds)} />
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
        </>
      )}
    </div>
    </>
  );
}
