import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Resizable
 *
 * Paneles que se reparten el ancho (o el alto) del grupo y se redimensionan
 * arrastrando el asa que los separa. El reparto vive en el grupo como un array
 * de porcentajes que siempre suma 100: cada panel lo recibe como `flex-basis`,
 * así que el arrastre no toca el DOM de los hijos ni obliga a medir nada más
 * que el contenedor.
 *
 * Sin dependencias: `onPointerDown` + `setPointerCapture` bastan para seguir el
 * puntero fuera del asa (incluso fuera de la ventana) sin escuchar en `window`.
 */

/** Cuánto mueve el asa cada pulsación de flecha, en puntos porcentuales. */
const KEYBOARD_STEP = 2;

/** Un panel `collapsible` se pliega a 0 al arrastrarlo por debajo de esta fracción de su mínimo. */
const COLLAPSE_RATIO = 0.5;

/** Delta lo bastante grande como para que el recorte lo lleve a un extremo (Home/End). */
const EDGE_DELTA = 100;

export type ResizableDirection = "horizontal" | "vertical";

interface PanelConstraint {
  min: number;
  max: number;
  collapsible: boolean;
}

const FREE_CONSTRAINT: PanelConstraint = { min: 0, max: 100, collapsible: false };

interface DragState {
  index: number;
  /** Coordenada del puntero al empezar, en el eje del grupo. */
  origin: number;
  /** Reparto vigente al empezar: el arrastre siempre se calcula contra él, nunca acumulando. */
  sizes: number[];
  /** Píxeles de pista repartible (el contenedor menos las asas). */
  track: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/** Reescala un reparto para que sume 100 sin cambiar las proporciones. */
function normalize(sizes: readonly number[]): number[] {
  if (sizes.length === 0) return [];
  const total = sizes.reduce((sum, size) => sum + size, 0);
  if (!Number.isFinite(total) || total <= 0) return sizes.map(() => 100 / sizes.length);
  return sizes.map((size) => (size * 100) / total);
}

/** Los paneles sin `defaultSize` se reparten a partes iguales lo que sobra. */
function resolveDefaults(panels: readonly ResizablePanelProps[]): number[] {
  const declared = panels.map((panel) => panel.defaultSize);
  const claimed = declared.reduce<number>((sum, size) => sum + (size ?? 0), 0);
  const pending = declared.filter((size) => size === undefined).length;
  const share = pending > 0 ? Math.max(0, 100 - claimed) / pending : 0;
  return normalize(declared.map((size) => size ?? share));
}

/**
 * Mueve el asa `index`: el par de paneles que toca se reparte su total, el
 * resto no se entera. Los límites efectivos salen de cruzar el mínimo y el
 * máximo de los dos, por eso `minSize` de un panel también topa al vecino.
 */
function resizePair(
  base: readonly number[],
  index: number,
  delta: number,
  constraints: readonly PanelConstraint[],
  allowCollapse: boolean
): number[] {
  const before = constraints[index] ?? FREE_CONSTRAINT;
  const after = constraints[index + 1] ?? FREE_CONSTRAINT;
  const pair = base[index] + base[index + 1];
  const lower = Math.max(before.min, pair - after.max);
  const upper = Math.min(before.max, pair - after.min);
  const desired = base[index] + delta;

  const collapseBefore = allowCollapse && before.collapsible && desired < before.min * COLLAPSE_RATIO;
  const collapseAfter = allowCollapse && after.collapsible && pair - desired < after.min * COLLAPSE_RATIO;
  const size = collapseBefore ? 0 : collapseAfter ? Math.min(pair, before.max) : clamp(desired, lower, upper);

  return base.map((current, position) =>
    position === index ? size : position === index + 1 ? pair - size : current
  );
}

/** Píxeles realmente repartibles: el contenedor menos lo que ocupan sus propias asas. */
function measureTrack(container: HTMLElement, direction: ResizableDirection): number {
  const rect = container.getBoundingClientRect();
  const full = direction === "horizontal" ? rect.width : rect.height;
  const handles = Array.from(container.querySelectorAll<HTMLElement>(":scope > [data-resizable-handle]"));
  const used = handles.reduce((sum, handle) => {
    const box = handle.getBoundingClientRect();
    return sum + (direction === "horizontal" ? box.width : box.height);
  }, 0);
  return Math.max(0, full - used);
}

function readStoredSizes(key: string | undefined, count: number): number[] | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== count) return null;
    if (!parsed.every((size) => typeof size === "number" && Number.isFinite(size) && size >= 0)) return null;
    return normalize(parsed as number[]);
  } catch {
    // localStorage bloqueado o contenido corrupto: se cae al reparto por defecto.
    return null;
  }
}

function writeStoredSizes(key: string | undefined, sizes: readonly number[]): void {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(sizes.map((size) => Math.round(size * 100) / 100)));
  } catch {
    // Modo privado o cuota llena: el reparto sigue vivo en memoria.
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Panel                                    */
/* -------------------------------------------------------------------------- */

export interface ResizablePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Porcentaje inicial del grupo. Sin él, el panel se reparte a partes iguales lo que sobre. */
  defaultSize?: number;
  /** Porcentaje mínimo. Topa también al panel vecino al arrastrar. */
  minSize?: number;
  /** Porcentaje máximo. */
  maxSize?: number;
  /** Deja que el panel se pliegue a 0 al arrastrarlo por debajo de la mitad de `minSize`. */
  collapsible?: boolean;
  /** Lo inyecta `ResizableGroup`. */
  "data-panel-index"?: number;
  /** Lo inyecta `ResizableGroup` cuando el panel está plegado. */
  "data-collapsed"?: string;
}

/**
 * Un panel del grupo. `ResizableGroup` le inyecta el `flex-basis`; aquí solo
 * queda el recorte (`min-w-0` evita que el contenido impida encogerlo).
 */
export const ResizablePanel = React.forwardRef<HTMLDivElement, ResizablePanelProps>(({ className, ...props }, ref) => {
  // `defaultSize`, `minSize`, `maxSize` y `collapsible` los lee el grupo del
  // elemento; aquí se quitan para que no lleguen al DOM como atributos.
  const { defaultSize: _defaultSize, minSize: _minSize, maxSize: _maxSize, collapsible: _collapsible, ...rest } = props;
  void _defaultSize;
  void _minSize;
  void _maxSize;
  void _collapsible;
  return <div ref={ref} className={cn("relative min-h-0 min-w-0 overflow-auto", className)} {...rest} />;
});
ResizablePanel.displayName = "ResizablePanel";

/* -------------------------------------------------------------------------- */
/*                                    Asa                                     */
/* -------------------------------------------------------------------------- */

export interface ResizableHandleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Dibuja el tirador central, para que se vea que el borde se puede arrastrar. */
  withGrip?: boolean;
  /** Lo inyecta `ResizableGroup`. */
  "data-direction"?: ResizableDirection;
  /** Lo inyecta `ResizableGroup`. */
  "data-resizable-handle"?: string;
  /** Lo inyecta `ResizableGroup` mientras se arrastra esta asa. */
  "data-dragging"?: string;
}

/**
 * El asa entre dos paneles. Es un `role="separator"` enfocable: el grupo le
 * inyecta los `aria-value*` y los manejadores, aquí solo vive lo visual.
 */
export const ResizableHandle = React.forwardRef<HTMLDivElement, ResizableHandleProps>(
  ({ className, withGrip = false, children, ...props }, ref) => {
    const isRow = (props["data-direction"] ?? "horizontal") === "horizontal";

    return (
      <div
        ref={ref}
        className={cn(
          "group/handle relative flex shrink-0 touch-none select-none items-center justify-center outline-none",
          isRow ? "w-2 cursor-col-resize" : "h-2 cursor-row-resize",
          "rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50",
          className
        )}
        {...props}
      >
        <span
          aria-hidden
          className={cn(
            "absolute bg-border transition-colors duration-fast ease-out-expo motion-reduce:transition-none",
            "group-hover/handle:bg-primary group-focus-visible/handle:bg-primary group-data-[dragging]/handle:bg-primary",
            isRow ? "inset-y-0 w-px" : "inset-x-0 h-px"
          )}
        />
        {withGrip && (
          <span
            aria-hidden
            className={cn(
              "relative rounded-full border border-border bg-surface transition-colors duration-fast ease-out-expo motion-reduce:transition-none",
              "group-hover/handle:border-primary group-focus-visible/handle:border-primary group-data-[dragging]/handle:border-primary",
              isRow ? "h-8 w-1.5" : "h-1.5 w-8"
            )}
          />
        )}
        {children}
      </div>
    );
  }
);
ResizableHandle.displayName = "ResizableHandle";

/* -------------------------------------------------------------------------- */
/*                                   Grupo                                    */
/* -------------------------------------------------------------------------- */

export interface ResizableGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Eje del reparto. `horizontal` pone los paneles en fila. */
  direction?: ResizableDirection;
  /** Se llama con el reparto (porcentajes que suman 100) cada vez que cambia. */
  onLayout?: (sizes: number[]) => void;
  /** Clave de `localStorage` donde se recuerda el reparto entre visitas. */
  storageKey?: string;
}

export function ResizableGroup({
  direction = "horizontal",
  onLayout,
  storageKey,
  className,
  children,
  ...props
}: ResizableGroupProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<DragState | null>(null);
  const [draggingIndex, setDraggingIndex] = React.useState<number | null>(null);

  const items = React.Children.toArray(children).filter(React.isValidElement);
  const panels = items.filter(
    (item): item is React.ReactElement<ResizablePanelProps> => item.type === ResizablePanel
  );
  const constraints: PanelConstraint[] = panels.map((panel) => ({
    min: panel.props.minSize ?? 0,
    max: panel.props.maxSize ?? 100,
    collapsible: Boolean(panel.props.collapsible),
  }));
  const defaultSizes = resolveDefaults(panels.map((panel) => panel.props));

  const [sizes, setSizes] = React.useState<number[]>(
    () => readStoredSizes(storageKey, panels.length) ?? defaultSizes
  );
  // Si cambia el número de paneles el reparto guardado deja de valer.
  const current = sizes.length === panels.length ? sizes : defaultSizes;
  const isDragging = draggingIndex !== null;

  const commit = (next: number[], persist: boolean) => {
    setSizes(next);
    onLayout?.(next);
    if (persist) writeStoredSizes(storageKey, next);
  };

  const handlePointerDown = (index: number) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const container = containerRef.current;
    if (!container) return;
    const track = measureTrack(container, direction);
    if (track <= 0) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      index,
      origin: direction === "horizontal" ? event.clientX : event.clientY,
      sizes: current,
      track,
    };
    setDraggingIndex(index);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const position = direction === "horizontal" ? event.clientX : event.clientY;
    const delta = ((position - drag.origin) / drag.track) * 100;
    commit(resizePair(drag.sizes, drag.index, delta, constraints, true), false);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDraggingIndex(null);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    // Solo se guarda al soltar: durante el arrastre hay un cambio por frame.
    writeStoredSizes(storageKey, current);
  };

  const handleKeyDown = (index: number) => (event: React.KeyboardEvent<HTMLDivElement>) => {
    const backward = direction === "horizontal" ? "ArrowLeft" : "ArrowUp";
    const forward = direction === "horizontal" ? "ArrowRight" : "ArrowDown";
    const delta =
      event.key === backward
        ? -KEYBOARD_STEP
        : event.key === forward
          ? KEYBOARD_STEP
          : event.key === "Home"
            ? -EDGE_DELTA
            : event.key === "End"
              ? EDGE_DELTA
              : null;
    if (delta === null) return;

    event.preventDefault();
    // Por teclado nunca se pliega: Home lleva al mínimo, no a 0.
    commit(resizePair(current, index, delta, constraints, false), true);
  };

  const handleDoubleClick = () => commit(defaultSizes, true);

  /**
   * Cuántos paneles hay antes de una posición. Se calcula por posición en vez
   * de llevar un contador mutable: un `let` que crece dentro del `map` se
   * reasigna después de que el render termine, y el compilador de React lo
   * rechaza. Con dos o tres paneles el coste es irrelevante.
   */
  const panelsBefore = (position: number) => items.slice(0, position).filter((item) => item.type === ResizablePanel).length;

  const rendered = items.map((item, position) => {
    if (item.type === ResizablePanel) {
      const index = panelsBefore(position);
      const panel = item as React.ReactElement<ResizablePanelProps>;
      const size = current[index] ?? 0;
      const injected = {
        key: panel.key ?? `panel-${index}`,
        style: { ...panel.props.style, flexBasis: `${size}%`, flexGrow: 0, flexShrink: 1 },
        "data-panel-index": index,
        "data-collapsed": size <= 0 ? "" : undefined,
      };
      return React.cloneElement(panel, injected);
    }

    if (item.type === ResizableHandle) {
      // El asa reparte entre el panel anterior y el siguiente.
      const index = panelsBefore(position) - 1;
      // Un asa suelta (sin panel a cada lado) no tiene nada que repartir.
      if (index < 0 || index + 1 >= current.length) return null;

      const handle = item as React.ReactElement<ResizableHandleProps>;
      const before = constraints[index];
      const after = constraints[index + 1];
      const pair = current[index] + current[index + 1];
      const injected = {
        key: handle.key ?? `handle-${index}`,
        role: "separator",
        tabIndex: 0,
        // El separador de un grupo en fila es una barra vertical, y al revés.
        "aria-orientation": direction === "horizontal" ? ("vertical" as const) : ("horizontal" as const),
        "aria-valuenow": Math.round(current[index]),
        "aria-valuemin": Math.round(Math.max(before.min, pair - after.max)),
        "aria-valuemax": Math.round(Math.min(before.max, pair - after.min)),
        "aria-label": handle.props["aria-label"] ?? "Redimensionar paneles",
        "data-resizable-handle": "",
        "data-direction": direction,
        "data-dragging": draggingIndex === index ? "" : undefined,
        onPointerDown: handlePointerDown(index),
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerEnd,
        onPointerCancel: handlePointerEnd,
        onLostPointerCapture: handlePointerEnd,
        onKeyDown: handleKeyDown(index),
        onDoubleClick: handleDoubleClick,
      };
      return React.cloneElement(handle, injected);
    }

    return item;
  });

  return (
    <div
      ref={containerRef}
      data-direction={direction}
      className={cn(
        "flex w-full",
        direction === "horizontal" ? "flex-row" : "flex-col",
        isDragging && "select-none",
        isDragging && (direction === "horizontal" ? "cursor-col-resize" : "cursor-row-resize"),
        className
      )}
      {...props}
    >
      {rendered}
    </div>
  );
}
ResizableGroup.displayName = "ResizableGroup";
