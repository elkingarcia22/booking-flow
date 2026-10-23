import * as React from "react";
import { isSameDay } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/i18n";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ScheduleDrop, ScheduleDropValidator, ScheduleEvent, ScheduleResource, ScheduleResourceAction, ScheduleSlot, ScheduleTone } from "./scheduleTypes";
import { RowContextMenu, type RowAction } from "@/components/data-display";
import { ScheduleEventCard } from "./ScheduleEventCard";
import { useScheduleDrag, type DragPreview } from "./useScheduleDrag";
import { ColumnResizeHandle } from "./ColumnResizeHandle";

import {
  atMinutes,
  columnTrack,
  earliestWorkingMinute,
  eventMinutes,
  eventsForResource,
  formatClock,
  formatClockRange,
  initialsOf,
  isWorkingAt,
  layoutEvents,
  minutesOfDay,
  nowPercent,
  SCHEDULE_COLUMN_DEFAULT,
  SLOT_HEIGHT_PX,
  slotMinutes,
} from "./scheduleUtils";

/**
 * El aire entre dos citas, en los cuatro lados. Las tarjetas no llevan borde:
 * sin este hueco, dos citas seguidas del mismo barbero se leían como un solo bloque (salvo las de un grupo, que se pegan a propósito).
 */
const EVENT_GAP_PX = 4;
/** El aire de arriba y de abajo de una tarjeta: nada donde se pega a otra de su grupo (salvo mientras se arrastra). */
const gapTop = (event: ScheduleEvent, dragging: unknown): number => (event.group?.joinTop && !dragging ? 0 : EVENT_GAP_PX / 2);
const gapBottom = (event: ScheduleEvent, dragging: unknown): number => (event.group?.joinBottom && !dragging ? 0 : EVENT_GAP_PX / 2);

/**
 * RESOURCE DAY GRID
 *
 * El día de una barbería: una columna por barbero, las horas hacia abajo y
 * cada cita como tarjeta dentro de la columna de quien la atiende. Las horas
 * en las que alguien no trabaja salen oscurecidas y rayadas, lo que ya pasó se atenúa,
 * una línea marca «ahora» y cada hueco libre es un botón para agendar ahí
 * mismo.
 *
 * La rejilla es su propia región de scroll: así la fila de barberos y la
 * columna de horas se quedan fijas mientras se recorre la jornada, y al
 * abrir el día se coloca sola en la hora actual (o en la primera hora en
 * que alguien trabaja). Con más columnas de las que caben se desplaza a lo
 * ancho, y la columna de horas se queda pegada a la izquierda.
 *
 * Las tarjetas se arrastran a otra hora o a otra columna y se estiran desde
 * abajo. Con `validateDrop` la rejilla pregunta antes de soltar: mientras se
 * arrastra enseña el motivo («Se pisa con Marcela») y al soltar no mueve nada,
 * avisa por `onDropRejected`. El componente no guarda nada: avisa por
 * `onEventMove` y `onEventResize` y quien lo monta decide si acepta el cambio.
 *
 * Con `onColumnResize` cada columna se ensancha o se estrecha desde el borde
 * derecho de su cabecera, como en una tabla, y con doble clic vuelve a su
 * ancho de siempre. Tampoco aquí se guarda nada: el ancho elegido llega en
 * `columnWidths` y la rejilla solo pinta en vivo el arrastre en curso.
 */

export interface ResourceDayGridProps {
  date: Date;
  resources: readonly ScheduleResource[];
  events: readonly ScheduleEvent[];
  /** Primera y última hora visibles (la última exclusiva): de 6 a 24 por defecto. */
  startHour?: number;
  endHour?: number;
  /** Minutos por franja de la rejilla. */
  slotMinutes?: number;
  /** Alto de cada franja en píxeles: la densidad. `SCHEDULE_DENSITIES` trae las tres. */
  slotHeight?: number;
  /** El «ahora» de la línea roja. Inyectable para que la doc y las pruebas no cambien cada día. */
  now?: Date;
  onSlotClick?: (slot: ScheduleSlot) => void;
  onEventClick?: (event: ScheduleEvent) => void;
  onEventMove?: (event: ScheduleEvent, drop: ScheduleDrop) => void;
  onEventResize?: (event: ScheduleEvent, drop: ScheduleDrop) => void;
  /** Si un destino vale al arrastrar; devuelve el motivo cuando no. */
  validateDrop?: ScheduleDropValidator;
  /** Se soltó una tarjeta donde `validateDrop` dijo que no. */
  onDropRejected?: (event: ScheduleEvent, drop: ScheduleDrop, reason: string) => void;
  /** Lo que se puede hacer desde el nombre de un recurso (ver perfil, bloquear…). */
  resourceActions?: (resource: ScheduleResource) => readonly ScheduleResourceAction[];
  /**
   * El clic derecho sobre una tarjeta: sus acciones (abrir, el siguiente paso, cancelar…). Es un atajo
   * de lo que ya ofrece la tarjeta al abrirla; sin acciones, el clic derecho es el del navegador.
   */
  eventActions?: (event: ScheduleEvent) => readonly RowAction[];
  /** El ancho de cada columna que se ajustó, en píxeles, por id de recurso. Las demás se reparten el sitio. */
  columnWidths?: Readonly<Record<string, number>>;
  /** Se cambió el ancho de una columna; `null` es volver al de siempre. Sin él, las columnas no se ajustan. */
  onColumnResize?: (resourceId: string, width: number | null) => void;
  /** Alto de la región con scroll. Por defecto, lo que queda de pantalla. */
  height?: string;
  /**
   * Ocupa el alto que le deje su contenedor flex en vez de medir la ventana:
   * la rejilla es entonces lo único que se desplaza y la página no suma una
   * segunda barra. El contenedor debe ser una columna flex con alto definido.
   */
  fill?: boolean;
  className?: string;
}

const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 24;
const DEFAULT_SLOT_MINUTES = 30;
const DEFAULT_HEIGHT = "max(28rem, calc(100dvh - 17rem))";
/** Ancho de la columna de horas y mínimo de cada columna de recurso. */
const GUTTER = "4.5rem";
/** El rayado de las horas en que el recurso no trabaja: se nota sin gritar, en claro y en oscuro. */
const OFF_HOURS_PATTERN = "repeating-linear-gradient(135deg, hsl(var(--foreground) / 0.07) 0 1px, transparent 1px 8px)";
/**
 * Las flechas para ver más barberos flotan sobre las cabeceras: necesitan fondo opaco. El `outline`
 * del botón es translúcido en oscuro y dejaba ver el avatar de debajo a través de la flecha.
 */
const SCROLL_BUTTON = "bg-surface shadow-md dark:border-border-strong dark:bg-surface-muted dark:hover:bg-muted";
/** Mínimo de una columna cuando cada una es un día (la semana de una persona): 7 × 8rem caben en una pantalla de escritorio. */
const DAY_COLUMN_MIN = "8rem";
/** Margen para decidir que el scroll llegó a un borde. */
const EDGE_TOLERANCE_PX = 4;

const ALERT_TONE: Record<ScheduleTone, string> = {
  primary: "bg-primary/10 text-primary hover:bg-primary/20",
  positive: "bg-success/15 text-success hover:bg-success/25",
  warning: "bg-warning/15 text-warning hover:bg-warning/25",
  negative: "bg-destructive/10 text-destructive hover:bg-destructive/20",
  info: "bg-info/15 text-info hover:bg-info/25",
  neutral: "bg-muted text-text-secondary hover:bg-muted/80",
  accent: "bg-[color-mix(in_srgb,var(--color-indigo)_15%,transparent)] text-[var(--color-indigo)] hover:bg-[color-mix(in_srgb,var(--color-indigo)_25%,transparent)]",
};

export function ResourceDayGrid({
  date,
  resources,
  events,
  startHour = DEFAULT_START_HOUR,
  endHour = DEFAULT_END_HOUR,
  slotMinutes: step = DEFAULT_SLOT_MINUTES,
  slotHeight = SLOT_HEIGHT_PX,
  now,
  onSlotClick,
  onEventClick,
  onEventMove,
  onEventResize,
  validateDrop,
  onDropRejected,
  resourceActions,
  eventActions,
  columnWidths,
  onColumnResize,
  height = DEFAULT_HEIGHT,
  fill = false,
  className,
}: ResourceDayGridProps) {
  const t = useT();
  const { current } = useLocale();
  const intl = current.intl;
  const slots = React.useMemo(() => slotMinutes(startHour, endHour, step), [startHour, endHour, step]);
  const dayStart = slots[0];
  const dayEnd = slots[slots.length - 1] + step;
  const nowDate = React.useMemo(() => now ?? new Date(), [now]);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  // Con una columna por día, soltar en otra columna es cambiar de día: la fecha del destino es la de esa columna.
  const dayByResource = React.useMemo(() => new Map(resources.flatMap((resource) => (resource.date ? [[resource.id, resource.date] as const] : []))), [resources]);
  const dropDayOf = React.useCallback((resourceId: string): Date => dayByResource.get(resourceId) ?? date, [dayByResource, date]);
  const { preview, bind, wasDragged } = useScheduleDrag({ bodyRef, day: date, dayOf: dropDayOf, dayStart, dayEnd, step, onMove: onEventMove, onResize: onEventResize, validate: validateDrop, onRejected: onDropRejected });

  // Cada columna enseña su propio día (la semana de una persona) o el de la rejilla.
  const dayOf = React.useCallback((resource: ScheduleResource): Date => resource.date ?? date, [date]);
  const perDay = resources.some((resource) => resource.date !== undefined);
  const todayColumn = resources.find((resource) => nowPercent(nowDate, dayOf(resource), dayStart, dayEnd) !== null);
  const showsNow = todayColumn !== undefined;
  const todayKey = perDay ? resources.find((resource) => resource.date && isSameDay(resource.date, nowDate))?.id : undefined;

  // Al abrir un día la rejilla se coloca sola: en «ahora» si es hoy, y si no
  // una hora antes de que alguien empiece a trabajar. Depende del día y de esa
  // hora —no de la lista de recursos, que cambia de identidad al repintar—:
  // así no devuelve el scroll a su sitio cada vez que algo se actualiza.
  const dayKey = date.getTime();
  const earliest = earliestWorkingMinute(resources);
  React.useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const pxPerMinute = slotHeight / step;
    const target = showsNow ? minutesOfDay(nowDate) - 60 : (earliest ?? dayStart) - 60;
    node.scrollTop = Math.max(0, (target - dayStart) * pxPerMinute);
    // En la semana de una persona, si no caben todos los días, se empieza por hoy.
    const todayCell = todayKey ? bodyRef.current?.querySelector<HTMLElement>(`[data-resource-id="${CSS.escape(todayKey)}"]`) : null;
    if (todayCell) node.scrollLeft = todayCell.offsetLeft;
  }, [dayKey, dayEnd, dayStart, earliest, nowDate, showsNow, slotHeight, step, todayKey]);

  // Con más columnas de las que caben, la rejilla se desplaza a lo ancho: dos
  // botones en la cabecera dicen que hay más barberos a cada lado y saltan a ellos.
  const [edges, setEdges] = React.useState({ previous: false, next: false });
  const measureEdges = React.useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const previous = node.scrollLeft > EDGE_TOLERANCE_PX;
    const next = node.scrollLeft + node.clientWidth < node.scrollWidth - EDGE_TOLERANCE_PX;
    setEdges((current) => (current.previous === previous && current.next === next ? current : { previous, next }));
  }, []);
  React.useEffect(() => {
    const node = scrollRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measureEdges);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    return () => observer.disconnect();
  }, [measureEdges, resources.length]);
  /**
   * Avanza o retrocede por columnas enteras, dejando una a la vista como referencia. Mide cada
   * columna en el momento: con anchos ajustados no todas miden lo mismo.
   */
  const scrollColumns = (direction: 1 | -1) => {
    const node = scrollRef.current;
    const body = bodyRef.current;
    if (!node || !body) return;
    const cells = Array.from(body.querySelectorAll<HTMLElement>("[data-resource-id]")).map((cell) => ({ left: cell.offsetLeft, right: cell.offsetLeft + cell.offsetWidth }));
    if (cells.length === 0) return;
    // Lo visible del cuerpo: la columna de horas, pegada a la izquierda, tapa su propio ancho.
    const viewLeft = node.scrollLeft;
    const viewWidth = node.clientWidth - body.offsetLeft;
    const viewRight = viewLeft + viewWidth;
    const fully = cells.map((cell, index) => ({ ...cell, index })).filter((cell) => cell.left >= viewLeft - EDGE_TOLERANCE_PX && cell.right <= viewRight + EDGE_TOLERANCE_PX);
    let target: number;
    if (direction === 1) {
      const last = fully.at(-1)?.index ?? cells.findIndex((cell) => cell.right > viewLeft);
      const anchor = cells[last].left > viewLeft + EDGE_TOLERANCE_PX ? last : Math.min(last + 1, cells.length - 1);
      target = cells[anchor].left;
    } else {
      const first = fully[0]?.index ?? cells.findIndex((cell) => cell.right > viewLeft);
      const aligned = cells[first].right - viewWidth;
      target = aligned < viewLeft - EDGE_TOLERANCE_PX ? aligned : cells[Math.max(0, first - 1)].left;
    }
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollTo({ left: Math.max(0, target), behavior: reduced ? "auto" : "smooth" });
  };

  // El arrastre de un asa se pinta en vivo sin pasar por quien monta la rejilla: solo el final se guarda.
  const [resizing, setResizing] = React.useState<{ id: string; width: number } | null>(null);
  const widthOf = (id: string): number | undefined => (resizing?.id === id ? resizing.width : columnWidths?.[id]);
  // Si todas las columnas a la vista tienen ancho fijo (p. ej. un solo barbero ajustado), la última
  // se estira: si no, la rejilla quedaba pegada a la izquierda con el resto vacío.
  // Los siete días de una semana caben a lo ancho en escritorio: su columna puede ser más angosta que la de un barbero.
  const trackOf = (width: number | undefined): string => (width === undefined && perDay ? `minmax(${DAY_COLUMN_MIN}, 1fr)` : columnTrack(width));
  const allFixed = resources.length > 0 && resources.every((resource) => widthOf(resource.id) !== undefined);
  const tracks =
    resources.length > 0
      ? resources
          .map((resource, index) => {
            const width = widthOf(resource.id);
            return allFixed && index === resources.length - 1 && resizing?.id !== resource.id ? `minmax(${columnTrack(width)}, 1fr)` : trackOf(width);
          })
          .join(" ")
      : columnTrack(undefined);
  const contentWidth = resources.map((resource) => {
    const width = widthOf(resource.id);
    if (width === undefined) return perDay ? DAY_COLUMN_MIN : SCHEDULE_COLUMN_DEFAULT;
    return columnTrack(width);
  });
  const columns = `${GUTTER} ${tracks}`;
  const measureColumn = (id: string): number => bodyRef.current?.querySelector<HTMLElement>(`[data-resource-id="${CSS.escape(id)}"]`)?.getBoundingClientRect().width ?? 0;
  const marker = todayColumn ? nowPercent(nowDate, dayOf(todayColumn), dayStart, dayEnd) : null;

  const openEvent = (event: ScheduleEvent) => {
    if (wasDragged()) return;
    onEventClick?.(event);
  };

  return (
    <section aria-label={t("schedule.grid")} className={cn("relative isolate overflow-hidden rounded-xl border border-border bg-surface", fill && "flex min-h-[24rem] flex-1 flex-col", className)}>
      {marker !== null && <p className="sr-only">{t("schedule.now", { time: formatClock(nowDate, intl) })}</p>}
      {edges.previous && (
        <Button type="button" variant="outline" size="icon-sm" aria-label={t("schedule.scrollPrevious")} onClick={() => scrollColumns(-1)} className={cn("absolute top-3 z-overlay rounded-full", SCROLL_BUTTON)} style={{ left: `calc(${GUTTER} + 0.375rem)` }} data-testid="schedule-scroll-previous">
          <ChevronLeft />
        </Button>
      )}
      {edges.next && (
        <Button type="button" variant="outline" size="icon-sm" aria-label={t("schedule.scrollNext")} onClick={() => scrollColumns(1)} className={cn("absolute right-1.5 top-3 z-overlay rounded-full", SCROLL_BUTTON)} data-testid="schedule-scroll-next">
          <ChevronRight />
        </Button>
      )}
      <div ref={scrollRef} onScroll={measureEdges} className={cn("relative overflow-auto overscroll-contain", fill && "min-h-0 flex-1 basis-0")} style={fill ? undefined : { maxHeight: height }}>
        <div className={cn("grid", resizing && "cursor-col-resize select-none")} style={{ gridTemplateColumns: columns, width: `max(100%, calc(${[GUTTER, ...contentWidth].join(" + ")}))` }}>
          {/* Cabecera pegajosa: un barbero por columna. La esquina va al final
              del DOM para pintarse encima cuando las dos pegajosas se cruzan. */}
          {resources.map((resource) => (
            <ResourceHeader
              key={resource.id}
              resource={resource}
              isToday={resource.date !== undefined && isSameDay(resource.date, nowDate)}
              actions={resourceActions?.(resource)}
              resizeHandle={
                onColumnResize && (
                  <ColumnResizeHandle
                    label={resource.name}
                    width={widthOf(resource.id)}
                    measure={() => measureColumn(resource.id)}
                    onPreview={(width) => setResizing(width === null ? null : { id: resource.id, width })}
                    onCommit={(width) => onColumnResize(resource.id, width)}
                  />
                )
              }
            />
          ))}
          <div className="sticky left-0 top-0 z-sticky border-b border-r border-border bg-surface" style={{ gridColumn: 1, gridRow: 1 }} aria-hidden="true" />

          {/* Columna de horas; la pastilla de «ahora» vive aquí para quedarse a la vista al desplazar. */}
          <div className={cn("sticky left-0 z-raised border-r border-border bg-surface", edges.previous && "shadow-card")} style={{ gridColumn: 1, gridRow: 2 }} aria-hidden="true">
            <div className="relative">
              {slots.map((minute) => (
                <div key={minute} className="relative border-b border-border/60 pr-1.5 text-right" style={{ height: slotHeight }}>
                  {/* En una sola línea: «12:00 p. m.» partido en dos se leía como dos horas. */}
                  <span className="-translate-y-1/2 inline-block whitespace-nowrap text-xs tabular-nums text-text-muted">{formatClock(atMinutes(date, minute), intl)}</span>
                </div>
              ))}
              {marker !== null && (
                <span
                  className="absolute left-1 inline-flex -translate-y-1/2 items-center whitespace-nowrap rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-destructive-foreground shadow-card"
                  style={{ top: `${marker}%` }}
                >
                  {formatClock(nowDate, intl)}
                </span>
              )}
            </div>
          </div>

          {/* Las columnas: comparten cuerpo para que la línea de «ahora» las cruce. */}
          <div ref={bodyRef} className="relative grid" style={{ gridColumn: "2 / -1", gridRow: 2, gridTemplateColumns: tracks }}>
            {resources.map((resource) => (
              <ResourceColumn
                key={resource.id}
                date={dayOf(resource)}
                resource={resource}
                events={eventsForResource(events, dayOf(resource), resource.id)}
                slots={slots}
                slotHeight={slotHeight}
                step={step}
                dayStart={dayStart}
                dayEnd={dayEnd}
                nowMarker={nowPercent(nowDate, dayOf(resource), dayStart, dayEnd)}
                drawNowLine={perDay}
                intl={intl}
                preview={preview}
                bind={bind}
                canResize={Boolean(onEventResize)}
                onSlotClick={onSlotClick}
                onOpen={onEventClick ? openEvent : undefined}
                eventActions={eventActions}
              />
            ))}

            {marker !== null && !perDay && (
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-raised flex items-center" style={{ top: `${marker}%` }}>
                <span className="h-0.5 flex-1 bg-destructive" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- header */

function DayIdentity({ resource, isToday }: { resource: ScheduleResource & { date: Date }; isToday: boolean }) {
  const { current } = useLocale();
  const weekday = new Intl.DateTimeFormat(current.intl, { weekday: "short" }).format(resource.date).replace(".", "");
  return (
    <span className="flex min-w-0 flex-col items-center">
      <span className={cn("text-xs font-semibold uppercase tracking-wide", isToday ? "text-primary" : "text-text-muted")}>{weekday}</span>
      <span
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-full text-xl font-semibold tabular-nums",
          isToday ? "bg-primary text-primary-foreground" : "text-text-primary"
        )}
        aria-current={isToday ? "date" : undefined}
      >
        {resource.date.getDate()}
      </span>
      {resource.subtitle && <span className="max-w-full truncate text-xs text-text-muted">{resource.subtitle}</span>}
    </span>
  );
}

function ResourceHeader({ resource, isToday = false, actions, resizeHandle }: { resource: ScheduleResource; isToday?: boolean; actions?: readonly ScheduleResourceAction[]; resizeHandle?: React.ReactNode }) {
  const t = useT();
  const identity = resource.date ? (
    <DayIdentity resource={{ ...resource, date: resource.date }} isToday={isToday} />
  ) : (
    <>
      <Avatar size="sm">
        {resource.avatarUrl && <AvatarImage src={resource.avatarUrl} alt="" />}
        <AvatarFallback>{initialsOf(resource.name)}</AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-col text-left">
        <span className="truncate text-sm font-semibold text-text-primary">{resource.name}</span>
        {resource.subtitle && <span className="truncate text-xs text-text-muted">{resource.subtitle}</span>}
      </span>
    </>
  );

  const progress = resource.progress === undefined ? null : Math.min(1, Math.max(0, resource.progress));
  const alert = resource.alert;

  return (
    <div className="sticky top-0 z-sticky flex min-w-0 flex-col items-center justify-center gap-1 border-b border-l border-border bg-surface px-2 py-2">
      {progress !== null && (
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-border/60" role="progressbar" aria-label={`${t("schedule.occupancy")}: ${resource.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <span className="block h-full origin-left bg-primary transition-transform duration-normal ease-out-expo motion-reduce:transition-none" style={{ transform: `scaleX(${progress})` }} />
        </span>
      )}
      {actions && actions.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("schedule.resourceMenu", { name: resource.name })}
              className={cn(
                "flex min-w-0 max-w-full items-center gap-2 rounded-lg px-2 py-1",
                "transition-colors duration-fast ease-out-expo hover:bg-surface-subtle motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              )}
            >
              {identity}
              <ChevronDown className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            {actions.map((action) => (
              <DropdownMenuItem key={action.id} onSelect={() => action.onSelect()}>
                {action.icon}
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex min-w-0 max-w-full items-center gap-2 px-2 py-1">{identity}</div>
      )}

      {/* El aviso de la columna («Hueco 15:00 · 2 en espera»): un chip que lleva a resolverlo. */}
      {alert &&
        (alert.onClick ? (
          <button
            type="button"
            onClick={alert.onClick}
            data-testid={`schedule-alert-${resource.id}`}
            className={cn(
              "max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-semibold",
              "transition-colors duration-fast ease-out-expo motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              ALERT_TONE[alert.tone ?? "warning"]
            )}
          >
            {alert.label}
          </button>
        ) : (
          <span data-testid={`schedule-alert-${resource.id}`} className={cn("max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-semibold", ALERT_TONE[alert.tone ?? "warning"])}>
            {alert.label}
          </span>
        ))}
      {resizeHandle}
    </div>
  );
}

/* ---------------------------------------------------------------- column */

interface ResourceColumnProps {
  date: Date;
  resource: ScheduleResource;
  events: ScheduleEvent[];
  slots: number[];
  slotHeight: number;
  step: number;
  dayStart: number;
  dayEnd: number;
  /** Dónde cae «ahora» en la columna (porcentaje), o `null` si no es hoy. */
  nowMarker: number | null;
  /** Cada columna es un día: la línea de «ahora» la pinta solo la de hoy, no cruza la rejilla. */
  drawNowLine?: boolean;
  intl: string;
  preview: DragPreview | null;
  bind: ReturnType<typeof useScheduleDrag>["bind"];
  canResize: boolean;
  onSlotClick?: (slot: ScheduleSlot) => void;
  onOpen?: (event: ScheduleEvent) => void;
  eventActions?: (event: ScheduleEvent) => readonly RowAction[];
}

function ResourceColumn({ date, resource, events, slots, slotHeight, step, dayStart, dayEnd, nowMarker, drawNowLine = false, intl, preview, bind, canResize, onSlotClick, onOpen, eventActions }: ResourceColumnProps) {
  const t = useT();
  const placed = React.useMemo(() => layoutEvents(events, dayStart, dayEnd), [events, dayStart, dayEnd]);
  const total = dayEnd - dayStart;
  const worksToday = (resource.workingHours?.length ?? 0) > 0;
  // Lo que se arrastra hacia esta columna desde otra se dibuja aquí como sombra.
  const incoming = preview && preview.mode === "move" && preview.resourceId === resource.id && !events.some((event) => event.id === preview.eventId) ? preview : null;

  return (
    <div data-resource-id={resource.id} className="relative border-l border-border">
      {slots.map((minute) => {
        const slotDate = atMinutes(date, minute);
        const time = formatClock(slotDate, intl);
        const working = isWorkingAt(resource.workingHours, minute);
        return (
          <button
            key={minute}
            type="button"
            aria-label={working ? t("schedule.slotCreate", { time, name: resource.name }) : t("schedule.slotOffHours", { time, name: resource.name })}
            onClick={() => onSlotClick?.({ resourceId: resource.id, start: slotDate, isWorking: working })}
            className={cn(
              "block w-full border-b border-border/60",
              "transition-colors duration-fast ease-out-expo motion-reduce:transition-none",
              working ? "bg-surface hover:bg-primary/5" : "border-border/30 bg-foreground/[0.06] hover:bg-foreground/10",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
            )}
            data-off-hours={!working || undefined}
            style={{ height: slotHeight, backgroundImage: working ? undefined : OFF_HOURS_PATTERN }}
          />
        );
      })}

      {/* Lo que ya pasó hoy se atenúa: la vista va a lo que queda por atender. */}
      {nowMarker !== null && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 bg-foreground/[0.035]" style={{ height: `${nowMarker}%` }} />}
      {nowMarker !== null && drawNowLine && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-raised flex items-center" style={{ top: `${nowMarker}%` }}>
          <span className="-ml-1 size-2.5 shrink-0 rounded-full bg-destructive" />
          <span className="h-0.5 flex-1 bg-destructive" />
        </div>
      )}

      {!worksToday && (
        <span className="pointer-events-none absolute inset-x-0 top-2 text-center text-xs text-text-muted">{t("schedule.notWorking")}</span>
      )}

      <div className="pointer-events-none absolute inset-0 px-1">
        {placed.map(({ event, top, height, column, columns }) => {
          const dragged = preview?.eventId === event.id ? preview : null;
          const start = dragged ? atMinutes(date, dragged.startMin) : event.start;
          const end = dragged ? atMinutes(date, dragged.endMin) : event.end;
          const shownTop = dragged ? ((dragged.startMin - dayStart) / total) * 100 : top;
          const shownHeight = dragged ? ((dragged.endMin - dragged.startMin) / total) * 100 : height;
          const isBlock = event.kind === "block";
          const moveHandlers = (onOpen || canResize) && !event.ghost ? bind(event, "move") : {};
          const card = (
            <ScheduleEventCard
              key={event.id}
              event={event}
              minutes={eventMinutes({ ...event, start, end })}
              heightPx={(eventMinutes({ ...event, start, end }) / step) * slotHeight}
              timeLabel={formatClockRange(start, end, intl)}
              onOpen={onOpen}
              dragging={Boolean(dragged) && dragged?.resourceId === resource.id}
              dragLabel={dragged ? formatClockRange(start, end, intl) : undefined}
              dragReason={dragged?.reason}
              onResizeStart={canResize && !isBlock && !event.ghost ? bind(event, "resize").onPointerDown : undefined}
              className={cn("pointer-events-auto", isBlock && "z-base", dragged && dragged.resourceId !== resource.id && "opacity-30")}
              style={{
                // Las citas de un mismo grupo pegadas en la columna no dejan aire entre ellas: se leen como un bloque.
                top: `calc(${shownTop}% + ${gapTop(event, dragged)}px)`,
                height: `calc(${shownHeight}% - ${gapTop(event, dragged) + gapBottom(event, dragged)}px)`,
                left: `calc(${(column / columns) * 100}% + ${EVENT_GAP_PX / 2}px)`,
                width: `calc(${100 / columns}% - ${EVENT_GAP_PX}px)`,
              }}
              {...moveHandlers}
            />
          );
          // Las propuestas no tienen menú: se aceptan tocándolas o se descartan desde su aviso.
          const actions = !event.ghost && !dragged ? (eventActions?.(event) ?? []) : [];
          return actions.length > 0 ? (
            <RowContextMenu key={event.id} rowLabel={event.title} actions={actions}>
              {card}
            </RowContextMenu>
          ) : (
            card
          );
        })}

        {incoming && (
          <div
            aria-hidden="true"
            className={cn("absolute inset-x-1 rounded-lg border-2 border-dashed", incoming.reason ? "border-destructive/60 bg-destructive/10" : "border-primary/60 bg-primary/10")}
            style={{ top: `${((incoming.startMin - dayStart) / total) * 100}%`, height: `${((incoming.endMin - incoming.startMin) / total) * 100}%` }}
          >
            <span className={cn("absolute right-1 top-1 max-w-[calc(100%-0.5rem)] truncate rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tabular-nums", incoming.reason ? "bg-destructive text-destructive-foreground" : "bg-foreground text-background")}>
              {incoming.reason ?? formatClockRange(atMinutes(date, incoming.startMin), atMinutes(date, incoming.endMin), intl)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
