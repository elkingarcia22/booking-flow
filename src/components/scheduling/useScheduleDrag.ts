import * as React from "react";
import type { ScheduleDrop, ScheduleDropValidator, ScheduleEvent } from "./scheduleTypes";
import { atMinutes, clamp, eventMinutes, minutesOfDay, snapMinutes } from "./scheduleUtils";

/**
 * El arrastre de una tarjeta dentro de la rejilla: moverla a otra hora o a
 * otra columna, o estirarla desde el borde de abajo para cambiar la
 * duración. Trabaja con eventos de puntero y captura, así el gesto sigue
 * aunque el cursor salga de la tarjeta.
 *
 * Solo ratón y lápiz: en pantalla táctil el dedo sirve para desplazar la
 * agenda, y un arrastre accidental movería citas sin querer. Ahí la hora se
 * cambia desde el detalle.
 */

export type DragMode = "move" | "resize";

export interface DragPreview {
  mode: DragMode;
  eventId: string;
  resourceId: string;
  startMin: number;
  endMin: number;
  /** Por qué ahí no se puede soltar, si no se puede. */
  reason: string | null;
}

interface DragOrigin {
  mode: DragMode;
  event: ScheduleEvent;
  pointerId: number;
  clientX: number;
  clientY: number;
  startMin: number;
  endMin: number;
  active: boolean;
}

export interface UseScheduleDragOptions {
  /** El cuerpo de la rejilla (columnas sin cabecera): de su alto salen los minutos por píxel. */
  bodyRef: React.RefObject<HTMLElement | null>;
  day: Date;
  /** El día de una columna cuando no es el de la rejilla (la semana de una persona): la fecha al soltar es la suya. */
  dayOf?: (resourceId: string) => Date;
  dayStart: number;
  dayEnd: number;
  step: number;
  onMove?: (event: ScheduleEvent, drop: ScheduleDrop) => void;
  onResize?: (event: ScheduleEvent, drop: ScheduleDrop) => void;
  /** Decide si un destino vale; mientras se arrastra se enseña el motivo y al soltar no se mueve. */
  validate?: ScheduleDropValidator;
  /** Se soltó en un sitio que no vale. */
  onRejected?: (event: ScheduleEvent, drop: ScheduleDrop, reason: string) => void;
}

/** Cuántos píxeles hay que moverse antes de que un clic pase a ser arrastre. */
const DRAG_THRESHOLD_PX = 4;

export function useScheduleDrag({ bodyRef, day, dayOf, dayStart, dayEnd, step, onMove, onResize, validate, onRejected }: UseScheduleDragOptions) {
  const origin = React.useRef<DragOrigin | null>(null);
  const suppressClick = React.useRef(false);
  const [preview, setPreview] = React.useState<DragPreview | null>(null);

  const resourceAt = React.useCallback(
    (clientX: number, fallback: string): string => {
      const columns = bodyRef.current?.querySelectorAll<HTMLElement>("[data-resource-id]") ?? [];
      for (const column of columns) {
        const rect = column.getBoundingClientRect();
        if (clientX >= rect.left && clientX < rect.right) return column.dataset.resourceId ?? fallback;
      }
      return fallback;
    },
    [bodyRef]
  );

  const toDrop = React.useCallback(
    (resourceId: string, startMin: number, endMin: number): ScheduleDrop => {
      const target = dayOf?.(resourceId) ?? day;
      return { resourceId, start: atMinutes(target, startMin), end: atMinutes(target, endMin) };
    },
    [day, dayOf]
  );

  const computePreview = React.useCallback(
    (current: DragOrigin, clientX: number, clientY: number): DragPreview => {
      const rect = bodyRef.current?.getBoundingClientRect();
      const pxPerMinute = rect && rect.height > 0 ? rect.height / (dayEnd - dayStart) : 1;
      const delta = (clientY - current.clientY) / pxPerMinute;
      const duration = current.endMin - current.startMin;
      if (current.mode === "resize") {
        const endMin = clamp(snapMinutes(current.endMin + delta, step), current.startMin + step, dayEnd);
        const reason = validate?.(current.event, toDrop(current.event.resourceId, current.startMin, endMin)) ?? null;
        return { mode: "resize", eventId: current.event.id, resourceId: current.event.resourceId, startMin: current.startMin, endMin, reason };
      }
      const startMin = clamp(snapMinutes(current.startMin + delta, step), dayStart, dayEnd - duration);
      const resourceId = resourceAt(clientX, current.event.resourceId);
      const reason = validate?.(current.event, toDrop(resourceId, startMin, startMin + duration)) ?? null;
      return { mode: "move", eventId: current.event.id, resourceId, startMin, endMin: startMin + duration, reason };
    },
    [bodyRef, dayEnd, dayStart, resourceAt, step, toDrop, validate]
  );

  const start = React.useCallback(
    (event: ScheduleEvent, mode: DragMode, nativeEvent: React.PointerEvent<HTMLElement>) => {
      const canDrag = mode === "move" ? Boolean(onMove) : Boolean(onResize);
      if (!canDrag || event.locked || event.ghost || nativeEvent.button !== 0 || nativeEvent.pointerType === "touch") return;
      const startMin = minutesOfDay(event.start);
      origin.current = {
        mode,
        event,
        pointerId: nativeEvent.pointerId,
        clientX: nativeEvent.clientX,
        clientY: nativeEvent.clientY,
        startMin,
        endMin: startMin + eventMinutes(event),
        active: false,
      };
      // La captura del puntero se pide al superar el umbral, no aquí: con
      // captura desde el primer pointerdown el clic normal ya no llega al
      // botón que abre la tarjeta.
    },
    [onMove, onResize]
  );

  const move = React.useCallback(
    (nativeEvent: React.PointerEvent<HTMLElement>) => {
      const current = origin.current;
      if (!current || current.pointerId !== nativeEvent.pointerId) return;
      if (!current.active) {
        const travelled = Math.hypot(nativeEvent.clientX - current.clientX, nativeEvent.clientY - current.clientY);
        if (travelled < DRAG_THRESHOLD_PX) return;
        current.active = true;
        nativeEvent.currentTarget.setPointerCapture(nativeEvent.pointerId);
      }
      nativeEvent.preventDefault();
      setPreview(computePreview(current, nativeEvent.clientX, nativeEvent.clientY));
    },
    [computePreview]
  );

  const finish = React.useCallback(
    (nativeEvent: React.PointerEvent<HTMLElement>) => {
      const current = origin.current;
      if (!current || current.pointerId !== nativeEvent.pointerId) return;
      origin.current = null;
      if (nativeEvent.currentTarget.hasPointerCapture(nativeEvent.pointerId)) {
        nativeEvent.currentTarget.releasePointerCapture(nativeEvent.pointerId);
      }
      setPreview(null);
      if (!current.active) return;
      // El clic que sigue a un arrastre no debe abrir la tarjeta.
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      if (nativeEvent.type === "pointercancel") return;
      const result = computePreview(current, nativeEvent.clientX, nativeEvent.clientY);
      const unchanged =
        result.resourceId === current.event.resourceId && result.startMin === current.startMin && result.endMin === current.endMin;
      if (unchanged) return;
      const drop = toDrop(result.resourceId, result.startMin, result.endMin);
      if (result.reason) {
        onRejected?.(current.event, drop, result.reason);
        return;
      }
      if (current.mode === "move") onMove?.(current.event, drop);
      else onResize?.(current.event, drop);
    },
    [computePreview, onMove, onRejected, onResize, toDrop]
  );

  /** Las props de puntero de una tarjeta. `mode` decide qué gesto empieza. */
  const bind = React.useCallback(
    (event: ScheduleEvent, mode: DragMode) => ({
      onPointerDown: (nativeEvent: React.PointerEvent<HTMLElement>) => start(event, mode, nativeEvent),
      onPointerMove: move,
      onPointerUp: finish,
      onPointerCancel: finish,
    }),
    [finish, move, start]
  );

  /** `true` justo después de soltar un arrastre: el clic no cuenta. */
  const wasDragged = React.useCallback(() => suppressClick.current, []);

  return { preview, bind, wasDragged };
}
