import type * as React from "react";
import { Text } from "@/components/typography";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon, type IconName } from "@/icons";

/**
 * Las tarjetas que suman algo a la reserva («Agregar otra cita», «Agregar productos»): secundarias,
 * sin botón, pero con el filo y el fondo dorados de «Lo antes posible» para que se noten. Las mismas
 * en Paso a paso y en la Agenda.
 */
export const ADD_CARD_CLASS =
  "group flex w-full items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-3 text-left transition-colors duration-fast hover:border-primary/70 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** La flecha de la derecha, que se mueve un poco al pasar por encima. */
export function AddCardArrow() {
  return <ThemaIcon name="chevronRight" size="sm" tone="muted" className="shrink-0 transition-transform duration-fast group-hover:translate-x-0.5" />;
}

interface AddCardProps extends Omit<React.ComponentProps<"button">, "title"> {
  title: React.ReactNode;
  hint: React.ReactNode;
  icon?: IconName;
}

/** «Agregar otra cita»: el + dorado, qué hace y una pista. */
export function AddCard({ title, hint, icon = "plus", type = "button", className, ...props }: AddCardProps) {
  return (
    <button type={type} className={className ? `${ADD_CARD_CLASS} ${className}` : ADD_CARD_CLASS} {...props}>
      <IconTile size="md" icon={<ThemaIcon name={icon} />} />
      <span className="flex min-w-0 flex-1 flex-col">
        <Text as="span" weight="semibold">
          {title}
        </Text>
        <Text as="span" size="xs" tone="muted">
          {hint}
        </Text>
      </span>
      <AddCardArrow />
    </button>
  );
}
