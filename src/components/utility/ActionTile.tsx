import * as React from "react";
import { cva } from "class-variance-authority";
import { Text } from "@/components/typography";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";

const actionTileVariants = cva(
  "group/tile flex w-full rounded-2xl border text-left outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      tone: {
        /** Un filo neutro: una acción más entre varias. */
        default: "border-border bg-surface hover:border-primary/50 hover:bg-surface-subtle",
        /** Punteada: algo opcional que se ofrece, no un dato que falte. */
        dashed: "border-dashed border-border hover:bg-surface-subtle",
        /** Filo y fondo de marca: algo que se suma y debe notarse («Agregar otra cita»). */
        accent: "border-primary/40 bg-primary/5 hover:border-primary/70 hover:bg-primary/10",
      },
      layout: {
        row: "items-center gap-3 p-3",
        stacked: "flex-col items-start gap-2 p-3",
      },
    },
    defaultVariants: { tone: "default", layout: "row" },
  }
);

type NativeProps = Omit<React.ComponentProps<"button">, "title" | "type">;

export interface ActionTileProps extends NativeProps {
  /** Lo de la izquierda (o de arriba, en `stacked`): un `IconTile`. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  /** Una línea de ayuda, o varias apiladas (un `ReactNode`). */
  description?: React.ReactNode;
  tone?: "default" | "dashed" | "accent";
  layout?: "row" | "stacked";
  /** La flecha a la derecha, que se mueve un poco al pasar el puntero. Por defecto, solo en `row`. */
  chevron?: boolean;
  /** Si lleva `href`, es un enlace en vez de un botón. */
  href?: string;
  type?: "button" | "submit" | "reset";
}

/**
 * Una tarjeta pulsable con icono, título y una pista: «Agregar otra cita», «Enviar recibo», «Avísame si
 * se libera una hora». Es la acción secundaria que ocupa su propio sitio sin ser un botón: tres tonos
 * (neutro, punteada y de marca) y dos disposiciones (en fila o apilada, para ponerlas en rejilla).
 */
export function ActionTile({ leading, title, description, tone = "default", layout = "row", chevron, href, type = "button", className, ...props }: ActionTileProps) {
  const showChevron = chevron ?? layout === "row";
  const body = (
    <>
      {leading}
      <span className={cn("flex min-w-0 flex-col", layout === "row" && "flex-1")}>
        <Text as="span" size={layout === "stacked" ? "sm" : undefined} weight="semibold">
          {title}
        </Text>
        {description && (
          <Text as="span" size="xs" tone="muted">
            {description}
          </Text>
        )}
      </span>
      {showChevron && <ThemaIcon name="chevronRight" size="sm" tone="muted" className="shrink-0 transition-transform duration-fast group-hover/tile:translate-x-0.5 motion-reduce:transition-none" />}
    </>
  );
  const classes = cn(actionTileVariants({ tone, layout }), className);
  if (href) {
    return (
      <a data-slot="action-tile" href={href} className={classes}>
        {body}
      </a>
    );
  }
  return (
    <button data-slot="action-tile" type={type} className={classes} {...props}>
      {body}
    </button>
  );
}
