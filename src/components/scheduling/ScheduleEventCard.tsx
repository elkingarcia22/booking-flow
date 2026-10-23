import * as React from "react";
import { BadgeCheck, Ban, CalendarClock, Check, CheckCheck, CircleSlash, Footprints, Globe, Link2, Repeat, Star, StickyNote, TriangleAlert, UserRoundPlus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ScheduleEvent, ScheduleMarkerIcon, ScheduleTone } from "./scheduleTypes";
import { scheduleColorClass } from "./scheduleUtils";
import "./schedule.css";

/**
 * La tarjeta de una cita dentro de la rejilla y la franja tachada de un
 * bloqueo.
 *
 * Dice tres cosas, en este orden: **quién** (el nombre y su etiqueta —el
 * tipo de cliente—), **en qué va** (la píldora de estado: «Ya ingresó», «En
 * silla», «Cobrada») y **qué se hace ahora** (el botón del siguiente
 * paso). Con `color` todas las tarjetas van sin borde y con el mismo relleno sólido
 * (tono suave de la marca en claro, gris en oscuro); el servicio se identifica por un círculo de color junto al nombre.
 * Con `fill: "category"` o `fill: "tone"` la tarjeta se tiñe del pastel de su color o de su tono,
 * mezclado con la superficie del tema (`.schedule-pastel` en schedule.css).
 *
 * Cuánto cuenta depende de su alto: en una línea, el nombre y el estado; con
 * dos, también el siguiente paso; con más sitio, el servicio y la hora. Lo
 * que no cabe vive en el tooltip.
 *
 * Una propuesta (`ghost`) se dibuja translúcida y con borde discontinuo: un
 * hueco sugerido o a dónde iría una cita si se reacomoda. Tocarla es aceptar.
 *
 * Las citas enlazadas (`group`: salieron de un mismo agendamiento o se
 * enlazaron a mano) llevan un icono de enlace con «1/2» en el color de su
 * grupo; resaltadas (`group.highlight`), además un borde discontinuo de ese
 * color, para ver de un vistazo qué va con qué.
 *
 * Una cita con varios servicios (`segments`) es una sola tarjeta en un solo
 * hueco: una línea punteada marca por dentro dónde empieza cada servicio y
 * cada tramo lleva su nombre. Donde un tramo no da para su línea, el nombre
 * queda en el tooltip.
 *
 * Para no anidar un botón dentro de otro, abrirla es un botón estirado
 * detrás del contenido y la acción es otro botón por encima: el lector de
 * pantalla encuentra los dos y el ratón también.
 */

/** El color de la tarjeta: fondo teñido y un borde del mismo tono, sin filete lateral. */
const TONE_CARD: Record<ScheduleTone, string> = {
  primary: "border-primary/35 bg-primary/10",
  positive: "border-success/35 bg-success/10",
  warning: "border-warning/40 bg-warning/15",
  negative: "border-destructive/35 bg-destructive/10",
  info: "border-info/35 bg-info/10",
  neutral: "border-border bg-surface-muted",
  accent: "border-[color-mix(in_srgb,var(--color-indigo)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-indigo)_10%,transparent)]",
};

const TONE_BADGE: Record<ScheduleTone, string> = {
  primary: "bg-primary text-primary-foreground",
  positive: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning",
  negative: "bg-destructive/10 text-destructive",
  info: "bg-info/15 text-info",
  neutral: "bg-muted text-text-secondary",
  accent: "bg-[color-mix(in_srgb,var(--color-indigo)_15%,transparent)] text-[var(--color-indigo)]",
};

/** El punto de la píldora de estado. */
const TONE_DOT: Record<ScheduleTone, string> = {
  primary: "bg-primary",
  positive: "bg-success",
  warning: "bg-warning",
  negative: "bg-destructive",
  info: "bg-info",
  neutral: "bg-text-muted",
  accent: "bg-[var(--color-indigo)]",
};

const MARKER_ICON: Record<ScheduleMarkerIcon, LucideIcon> = {
  online: Globe,
  walkIn: Footprints,
  new: UserRoundPlus,
  note: StickyNote,
  paid: BadgeCheck,
  repeat: Repeat,
  requested: Star,
  confirmed: CheckCheck,
  risk: TriangleAlert,
  reschedule: CalendarClock,
  declined: CircleSlash,
};

/** Con menos minutos que esto la tarjeta se considera corta (se usa cuando no llega el alto en píxeles). */
export const COMPACT_BELOW_MINUTES = 45;
/** Desde cuántos píxeles de alto cabe cada línea: la del estado, la del servicio, la de la hora y la del detalle. */
const TWO_LINES_FROM_PX = 46;
const SERVICE_FROM_PX = 76;
const TIME_FROM_PX = 100;
const DETAIL_FROM_PX = 124;
/** Desde cuántos píxeles de alto un tramo de servicio lleva su nombre (y uno con la fila de estado debajo). */
const SEGMENT_LABEL_FROM_PX = 18;
const SEGMENT_WITH_FOOTER_FROM_PX = 40;
/** Píxeles por minuto con la densidad normal, para cuando solo se conocen los minutos. */
const DEFAULT_PX_PER_MINUTE = 56 / 30;

export interface ScheduleEventCardProps {
  event: ScheduleEvent;
  /** «10:30 – 11:00», ya formateado por quien sabe el idioma. */
  timeLabel: string;
  minutes: number;
  /** El alto que tendrá en pantalla: decide cuántas líneas caben. Sin él, se calcula de los minutos. */
  heightPx?: number;
  onOpen?: (event: ScheduleEvent) => void;
  /** Se está arrastrando: se eleva y deja de responder al ratón. */
  dragging?: boolean;
  /** Etiqueta de la sombra mientras se arrastra: la hora nueva. */
  dragLabel?: string;
  /** Mientras se arrastra, por qué ahí no cabe: la tarjeta se pinta en rojo. */
  dragReason?: string | null;
  onResizeStart?: (nativeEvent: React.PointerEvent<HTMLElement>) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const ScheduleEventCard = React.forwardRef<HTMLDivElement, ScheduleEventCardProps & Omit<React.HTMLAttributes<HTMLDivElement>, "style" | "className" | "title">>(
  function ScheduleEventCard({ event, timeLabel, minutes, heightPx, onOpen, dragging, dragLabel, dragReason, onResizeStart, className, style, ...rest }, ref) {
    const t = useT();
    const tone = event.tone ?? (event.kind === "block" ? "neutral" : "primary");
    const height = heightPx ?? minutes * DEFAULT_PX_PER_MINUTE;
    const oneLine = height < TWO_LINES_FROM_PX;
    const isBlock = event.kind === "block";
    const isGhost = Boolean(event.ghost);
    // Con color de la paleta categórica la tarjeta va sobria —superficie y borde neutros— y el color
    // vive solo en un círculo junto al nombre: se identifica el servicio sin teñir la agenda entera.
    const palette = event.color !== undefined && !isGhost && !isBlock;
    // Con `fill` la tarjeta se tiñe del pastel de su servicio o de su estado (lo pide la vista).
    const pastelClass =
      isGhost || isBlock || event.muted
        ? null
        : event.fill === "category" && event.color !== undefined
          ? scheduleColorClass(event.color)
          : event.fill === "tone"
            ? `schedule-tone-${tone}`
            : null;
    // Teñida por servicio, el punto sobra: la tarjeta entera ya es el color.
    // Con varios servicios cada tramo lleva su círculo; el nombre del cliente, ninguno.
    const hasSegments = !oneLine && Boolean(event.segments && event.segments.length > 1);
    const dot = palette && event.fill !== "category" && !hasSegments ? <ScheduleColorDot color={event.color ?? 1} className="size-2.5" /> : null;
    const markers = event.markers ?? [];
    const group = event.group;
    // El icono de enlace va en el color de su grupo: dos grupos a la vez se distinguen de un vistazo.
    const groupColored = group?.color !== undefined;
    const groupPill = group && group.size > 1 && (
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1 text-[10px] font-semibold leading-4 tabular-nums",
          groupColored ? scheduleColorClass(group.color ?? 1) : "bg-primary/15 text-primary"
        )}
        style={groupColored ? { color: "hsl(var(--schedule-color))", backgroundColor: "hsl(var(--schedule-color) / 0.15)" } : undefined}
        data-group-color={group.color}
        role="img"
        aria-label={t("schedule.group", { index: group.index, total: group.size })}
      >
        <Link2 className="size-2.5" aria-hidden="true" />
        {t("schedule.groupShort", { index: group.index, total: group.size })}
      </span>
    );
    const status = event.urgent ? { label: event.urgent, tone: "negative" as const } : event.status;

    const statusPill = status && (
      <span
        className={cn(
          "inline-flex min-w-0 shrink items-center gap-1 rounded-full px-1.5 text-[10px] font-semibold leading-4",
          // Lo ya cerrado (cobrada) va relleno y con su marca: se distingue de un vistazo de lo que sigue abierto.
          // Lo ya cobrado se distingue con su marca y un verde tenue, sin pesar más que el resto.
          status.tone === "positive" ? "bg-success/15 text-success" : "bg-surface text-text-primary"
        )}
        data-status-tone={status.tone ?? "neutral"}
      >
        {status.tone === "positive" ? <Check className="size-2.5 shrink-0" aria-hidden="true" /> : <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[status.tone ?? "neutral"])} />}
        <span className="truncate">{status.label}</span>
      </span>
    );

    const warning = event.warning && (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="pointer-events-auto inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-warning/20 text-warning" role="img" aria-label={event.warning}>
            <TriangleAlert className="size-2.5" aria-hidden="true" />
          </span>
        </TooltipTrigger>
        <TooltipContent>{event.warning}</TooltipContent>
      </Tooltip>
    );

    const action = event.action && (
      <Button
        type="button"
        size="xs"
        variant="outline"
        // Cede ante el nombre y el estado: en una columna estrecha su texto termina en «…» en vez de cortarse.
        className="pointer-events-auto ml-auto h-5 min-w-0 shrink bg-surface px-1.5"
        onPointerDown={(nativeEvent) => nativeEvent.stopPropagation()}
        onClick={(nativeEvent) => {
          nativeEvent.stopPropagation();
          event.action?.onClick();
        }}
      >
        {event.action.icon}
        <span className="min-w-0 truncate">{event.action.label}</span>
      </Button>
    );

    const segments = !oneLine && event.segments && event.segments.length > 1 ? event.segments : null;
    // El total cede ante el estado y el siguiente paso: con los dos, la fila de abajo ya va llena.
    const meta = segments && event.meta && !(statusPill && action) ? event.meta : null;

    return (
      <div
        ref={ref}
        data-schedule-event={event.id}
        data-kind={event.kind ?? "appointment"}
        data-tone={tone}
        data-ghost={isGhost || undefined}
        data-active={(isGhost && event.active) || undefined}
        data-flexible={event.flexible || undefined}
        data-group={group?.id}
        style={style}
        title={[event.title, group && group.size > 1 ? t("schedule.group", { index: group.index, total: group.size }) : null, event.badge?.label, status?.label, timeLabel, event.segments && event.segments.length > 1 ? event.segments.map((segment) => segment.label).join(" · ") : event.subtitle, event.meta, event.note, event.warning, ...markers.map((marker) => marker.label)].filter(Boolean).join(" · ")}
        className={cn(
          // Las tarjetas de la agenda (neutral, pastel o vivo) van con esquinas rectas: bloques que se
          // apilan en la rejilla. Solo las de tono semántico conservan el radio.
          // `schedule-card`: la tarjeta es su propio contenedor, y en una columna estrecha suelta primero
          // los iconos y luego la etiqueta (schedule.css) para que el nombre siga leyéndose.
          "schedule-card group/event absolute overflow-hidden border text-left",
          pastelClass || palette ? "rounded-none" : "rounded-lg",
          "transition-[box-shadow,opacity] duration-fast ease-out-expo motion-reduce:transition-none",
          // Sin borde: el relleno sólido separa la tarjeta del fondo (`.schedule-card-fill` en schedule.css:
          // papel con sombra en claro, gris en oscuro). Al pasar el ratón cambia la sombra o el relleno, nunca un borde.
          pastelClass
            ? cn("schedule-pastel border-transparent", pastelClass)
            : palette
              ? "schedule-card-fill border-transparent bg-surface"
              : TONE_CARD[tone],
          event.flexible && !isGhost && "border-dashed",
          // Un grupo pegado en la misma columna pierde ese lado del borde y el radio. El borde
          // discontinuo de su color solo sale al resaltar el grupo (`highlight`, más abajo).
          group?.joinTop && "rounded-t-none border-t-0",
          group?.joinBottom && "rounded-b-none border-b-0",
          isGhost && "z-raised border-dashed border-primary/70 bg-primary/5 opacity-85",
          // Opaca (superficie + tinte de marca encima): lo que hay debajo no se transparenta ni se encima con su texto.
          isGhost && event.active && "border-2 border-primary bg-surface bg-[linear-gradient(hsl(var(--primary)/0.16),hsl(var(--primary)/0.16))] opacity-100 shadow-md ring-2 ring-primary/25",
          event.muted && "opacity-60",
          event.faded && "opacity-30 saturate-50",
          dragging && "z-raised opacity-90 shadow-lg ring-2 ring-ring/40",
          dragging && dragReason && "ring-destructive/60",
          !event.locked && !isGhost && onOpen && "cursor-grab active:cursor-grabbing",
          isGhost && onOpen && "cursor-pointer",
          className
        )}
        {...rest}
      >
        {isBlock && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: "repeating-linear-gradient(135deg, hsl(var(--foreground) / 0.06) 0 6px, transparent 6px 14px)" }}
          />
        )}

        {group?.joinTop && <span aria-hidden="true" className="pointer-events-none absolute inset-x-2 top-0 border-t border-foreground/10" />}

        {group?.highlight && !isGhost && (
          <span
            aria-hidden="true"
            data-group-highlight
            className={cn("pointer-events-none absolute inset-0 rounded-[inherit] border-2 border-dashed", groupColored && scheduleColorClass(group.color ?? 1))}
            style={{ borderColor: groupColored ? "hsl(var(--schedule-color))" : "hsl(var(--primary))" }}
          />
        )}

        {onOpen && (
          <button
            type="button"
            aria-label={isGhost ? t("schedule.acceptProposal", { title: `${event.title}, ${timeLabel}` }) : t("schedule.open", { title: `${event.title}, ${timeLabel}` })}
            onClick={() => onOpen(event)}
            className="absolute inset-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
          />
        )}

        {oneLine ? (
          /* Una línea: quién y en qué va. El siguiente paso se da al abrirla. */
          <div className="pointer-events-none relative flex h-full min-w-0 items-center gap-1.5 px-2">
            {isBlock && <Ban className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />}
            {dot}
            <span data-card-ink className={cn("min-w-[2.5rem] flex-1 truncate text-xs font-semibold text-text-primary", event.muted && "line-through")}>{event.title}</span>
            {groupPill}
            {warning}
            {statusPill ?? (isGhost && event.badge && <CardBadge badge={event.badge} tone={tone} />)}
          </div>
        ) : (
          <div className="pointer-events-none relative flex h-full min-w-0 flex-col gap-0.5 px-2 py-1">
            <div className="flex min-w-0 items-center gap-1.5">
              {isBlock && <Ban className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />}
              {dot}
              <span data-card-ink className={cn("min-w-[2.5rem] flex-1 truncate text-xs font-semibold text-text-primary", event.muted && "line-through")}>{event.title}</span>
              {groupPill}
              {markers.length > 0 && <ScheduleMarkers markers={markers} />}
              {event.badge && <CardBadge badge={event.badge} tone={palette ? "neutral" : tone} sober={palette} />}
            </div>

            {segments ? (
              <SegmentLines segments={segments} heightPx={height} hasFooter={Boolean(statusPill || warning || action || meta)} />
            ) : (
              <>
                {event.note && <span className="truncate text-xs italic text-text-secondary">{event.note}</span>}
                {height >= SERVICE_FROM_PX && event.subtitle && <span data-card-ink className="truncate text-xs text-text-secondary">{event.subtitle}</span>}
                {height >= TIME_FROM_PX && !event.hideTime && <span className="truncate text-xs tabular-nums text-text-muted">{timeLabel}</span>}
                {height >= DETAIL_FROM_PX && event.detail && <span className="truncate text-xs text-text-muted">{event.detail}</span>}
              </>
            )}

            {(statusPill || warning || action || meta) && (
              <div className="mt-auto flex min-w-0 items-center gap-1">
                {statusPill}
                {warning}
                {meta && <span className={cn("min-w-0 shrink truncate text-xs font-semibold tabular-nums text-text-primary", !action && "ml-auto")}>{meta}</span>}
                {action}
              </div>
            )}
          </div>
        )}

        {dragging && (dragReason || dragLabel) && (
          <span
            className={cn(
              "pointer-events-none absolute right-1 top-1 max-w-[calc(100%-0.5rem)] truncate rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
              dragReason ? "bg-destructive text-destructive-foreground" : "bg-foreground text-background"
            )}
          >
            {dragReason ?? dragLabel}
          </span>
        )}

        {onResizeStart && !event.locked && !isGhost && (
          <span
            role="presentation"
            aria-hidden="true"
            title={t("schedule.resize")}
            onPointerDown={(nativeEvent) => {
              nativeEvent.stopPropagation();
              onResizeStart(nativeEvent);
            }}
            className={cn(
              "absolute inset-x-0 bottom-0 flex h-2.5 cursor-ns-resize items-end justify-center opacity-0",
              "transition-opacity duration-fast group-hover/event:opacity-100 motion-reduce:transition-none"
            )}
          >
            <span className="mb-0.5 h-1 w-8 rounded-full bg-text-muted/60" />
          </span>
        )}
      </div>
    );
  }
);

/**
 * Los tramos de una cita de varios servicios: el primero va bajo el nombre y
 * los demás arrancan en su línea punteada, a la altura del minuto en que
 * empiezan. Un tramo sin alto para su nombre deja solo la línea.
 */
function SegmentLines({ segments, heightPx, hasFooter }: { segments: readonly NonNullable<ScheduleEvent["segments"]>[number][]; heightPx: number; hasFooter: boolean }) {
  const total = segments.reduce((sum, segment) => sum + segment.minutes, 0) || 1;
  // Cuántos minutos van antes de cada tramo: ahí arranca su línea.
  const starts = segments.map((_, index) => segments.slice(0, index).reduce((sum, segment) => sum + segment.minutes, 0));
  return (
    <>
      {segments.map((segment, index) => {
        const top = starts[index] / total;
        const segmentPx = (segment.minutes / total) * heightPx;
        const isLast = index === segments.length - 1;
        const fits = segmentPx >= (isLast && hasFooter ? SEGMENT_WITH_FOOTER_FROM_PX : SEGMENT_LABEL_FROM_PX);
        const label = fits && (
          <span data-segment-label className="flex min-w-0 items-center gap-1.5">
            {segment.color !== undefined && <ScheduleColorDot color={segment.color} className="size-2" />}
            <span data-card-ink className="truncate text-xs text-text-secondary">
              {segment.label}
            </span>
          </span>
        );
        // El primer tramo sigue el flujo bajo el nombre; los demás se cuelgan de su línea.
        if (index === 0) return <React.Fragment key={segment.id}>{label}</React.Fragment>;
        return (
          <span key={segment.id} data-segment className="absolute inset-x-0 border-t border-dashed border-foreground/20 px-2 pt-0.5" style={{ top: `${top * 100}%` }}>
            {label}
          </span>
        );
      })}
    </>
  );
}

/** La etiqueta junto al nombre: el tipo de cliente. */
function CardBadge({ badge, tone, sober = false }: { badge: NonNullable<ScheduleEvent["badge"]>; tone: ScheduleTone; sober?: boolean }) {
  // En una tarjeta sobria la etiqueta tampoco lleva color: se lee, no compite con el círculo del servicio.
  // Cede antes que el nombre: en una columna estrecha termina en «…» en vez de cortarse contra el borde.
  return <span data-card-badge className={cn("min-w-0 shrink truncate rounded-sm px-1 text-[10px] font-semibold uppercase leading-4 tracking-wide", sober ? TONE_BADGE.neutral : TONE_BADGE[badge.tone ?? tone])}>{badge.label}</span>;
}

/**
 * Los iconos de detalle junto al nombre (desde dos líneas de alto): cada uno con su significado para el
 * lector de pantalla. Pública para que otra vista de las mismas citas (la lista de la agenda) pinte los
 * mismos iconos que la tarjeta.
 */
export function ScheduleMarkers({ markers }: { markers: readonly NonNullable<ScheduleEvent["markers"]>[number][] }) {
  return (
    <span data-card-markers className="flex shrink-0 items-center gap-1 text-text-muted" role="list">
      {markers.map((marker) => {
        const Icon = MARKER_ICON[marker.icon];
        return <Icon key={marker.id} className="size-3" role="listitem" aria-label={marker.label} />;
      })}
    </span>
  );
}

/** El punto de un color de la paleta categórica: la leyenda de una lista (un servicio, una categoría). */
export function ScheduleColorDot({ color, className }: { color: number; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2 shrink-0 rounded-full", scheduleColorClass(color), className)} style={{ backgroundColor: "hsl(var(--schedule-color))" }} />;
}
