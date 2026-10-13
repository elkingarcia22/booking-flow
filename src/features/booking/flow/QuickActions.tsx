import type * as React from "react";
import { Text } from "@/components/typography";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon, type IconName } from "@/icons";
import { cn } from "@/lib/utils";

export interface QuickAction {
  id: string;
  icon: IconName;
  label: string;
  /** Un dato corto al lado (el teléfono) o un número (las citas próximas). */
  hint?: string;
  count?: number;
  onClick?: () => void;
  /** Un enlace en vez de un botón (llamar). */
  href?: string;
}

/** Tarjetas bajas, del estilo de las sedes, con todo en una línea. */
const PILL =
  "flex min-w-0 items-center gap-2.5 rounded-2xl border border-border bg-surface px-3 py-2.5 text-left outline-none transition-colors duration-fast hover:border-primary/50 hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring/50";

function PillBody({ icon, label, hint, count }: Pick<QuickAction, "icon" | "label" | "hint" | "count">): React.ReactNode {
  return (
    <>
      <IconTile size="sm" shape="circle" tone="neutral" icon={<ThemaIcon name={icon} />} />
      <Text as="span" size="sm" weight="semibold" className="shrink-0">
        {label}
      </Text>
      {hint && (
        <Text as="span" size="xs" tone="muted" tabular truncate>
          {hint}
        </Text>
      )}
      {count ? (
        <span aria-hidden className="grid h-4 min-w-4 place-items-center rounded-full bg-primary/15 px-1 text-xs font-semibold leading-none text-primary tabular-nums">
          {count}
        </span>
      ) : null}
    </>
  );
}

/** Tarjetas en columna (icono encima, nombre debajo): caben cuatro en una fila de celular. */
const TILE =
  "flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border border-border bg-surface px-1 py-3 outline-none transition-colors duration-fast hover:border-primary/50 hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring/50";

function TileBody({ icon, label, count }: Pick<QuickAction, "icon" | "label" | "count">): React.ReactNode {
  return (
    <>
      <span className="relative">
        <ThemaIcon name={icon} tone="primary" />
        {count ? (
          <span aria-hidden className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-xs font-semibold leading-none text-primary-foreground tabular-nums">
            {count}
          </span>
        ) : null}
      </span>
      <Text as="span" size="xs" weight="medium" className="w-full truncate text-center">
        {label}
      </Text>
    </>
  );
}

/** Con 2, 3 o 4 se reparten el ancho por igual, en una sola fila. */
const COLUMNS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };

/**
 * Lo que se puede hacer además de reservar (ver tus citas, llamar, paquetes, regalar), para que no
 * compita con la cita. `row`: tarjetas bajas con todo en una línea (dos atajos con su dato, como
 * «Llamar» y el teléfono). `tiles`: tarjetas con el icono encima, todas en una sola fila.
 */
export function QuickActions({ actions, label, layout = "row", className }: { actions: readonly QuickAction[]; label: string; layout?: "row" | "tiles"; className?: string }) {
  const isTiles = layout === "tiles";
  const itemClass = isTiles ? TILE : PILL;
  return (
    <nav aria-label={label} className={cn("grid gap-2", isTiles ? COLUMNS[actions.length] : "grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]", className)}>
      {actions.map((item) => {
        const aria = item.count ? `${item.label} · ${item.count}` : undefined;
        const body = isTiles ? <TileBody {...item} /> : <PillBody {...item} />;
        return item.href ? (
          <a key={item.id} href={item.href} className={itemClass} aria-label={aria}>
            {body}
          </a>
        ) : (
          <button key={item.id} type="button" className={itemClass} onClick={item.onClick} aria-label={aria}>
            {body}
          </button>
        );
      })}
    </nav>
  );
}
