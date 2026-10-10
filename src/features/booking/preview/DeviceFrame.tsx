import * as React from "react";
import { Text } from "@/components/typography";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";

export type PreviewDevice = "phone" | "tablet" | "monitor";

interface DeviceFrameProps {
  device: PreviewDevice;
  /** La dirección que se lee en la barra del navegador (monitor). */
  address?: string;
  children: React.ReactNode;
}

/**
 * La silueta de la pantalla donde el cliente ve la reserva: un celular, la
 * tablet del local o un monitor con su navegador. Solo es un marco; el
 * contenido se adapta por `layout`, no por el ancho de la ventana.
 *
 * Los tres marcos son el mismo árbol (solo cambian las clases, la barra del
 * navegador y la muesca): así, al pasar de celular a tablet o a monitor, la
 * reserva que va dentro no se desmonta y sigue en el paso en que estaba.
 *
 * El bisel y la muesca son negros como un equipo de verdad: en claro salen del
 * texto (casi negro); en oscuro, del cromo de navegación (`--nav`), porque el
 * texto ahí es casi blanco. Un filo con el borde lo separa del fondo oscuro.
 * El relleno va como `hsl(var(--nav))` y no `bg-nav`: `globals.css` fija
 * `.bg-nav` a un azul marino con `!important` y la muesca salía azul.
 */
const BEZEL = "border-foreground/85 bg-foreground/85 dark:border-nav dark:bg-[hsl(var(--nav))] dark:ring-1 dark:ring-border";
export function DeviceFrame({ device, address, children }: DeviceFrameProps) {
  const isPhone = device === "phone";
  const isMonitor = device === "monitor";
  return (
    <div
      data-device={device}
      className={cn(
        "relative flex flex-col overflow-hidden shadow-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500",
        isMonitor && "h-full w-full max-w-wide rounded-xl border border-border bg-surface",
        isPhone && cn("h-[min(844px,100%)] w-[390px] shrink-0 rounded-[3rem] border-[10px]", BEZEL),
        device === "tablet" && cn("h-[min(1112px,100%)] w-[min(834px,100%)] shrink-0 rounded-[2.25rem] border-[14px]", BEZEL)
      )}
    >
      {isMonitor && (
        <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border bg-surface-subtle px-4">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-destructive/70" />
            <span className="size-2.5 rounded-full bg-warning/70" />
            <span className="size-2.5 rounded-full bg-success/70" />
          </span>
          <span className="mx-auto flex min-w-0 max-w-md flex-1 items-center gap-2 rounded-md border border-border bg-surface px-3 py-1">
            <ThemaIcon name="lock" size="xs" tone="muted" />
            <Text size="xs" tone="muted" truncate>
              {address}
            </Text>
          </span>
          <span className="w-12" aria-hidden />
        </div>
      )}
      {isPhone && <span className="absolute left-1/2 top-2 z-raised h-6 w-28 -translate-x-1/2 rounded-full bg-foreground dark:bg-[hsl(var(--nav))]" aria-hidden />}
      <div className={cn("min-h-0 flex-1 overflow-hidden", !isMonitor && "bg-background", isPhone && "rounded-[2.4rem] pt-7", device === "tablet" && "rounded-[1.4rem]")}>{children}</div>
    </div>
  );
}
