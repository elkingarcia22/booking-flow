import type * as React from "react";
import { ActionTile, IconTile } from "@/components/utility";
import { ThemaIcon, type IconName } from "@/icons";

interface AddCardProps extends Omit<React.ComponentProps<"button">, "title"> {
  title: React.ReactNode;
  hint: React.ReactNode;
  icon?: IconName;
}

/**
 * Las tarjetas que suman algo a la reserva («Agregar otra cita», «Agregar productos»): secundarias, sin
 * botón, con el filo y el fondo de marca de «Lo antes posible» para que se noten. Un `ActionTile` del
 * sistema; las mismas en Paso a paso y en la Agenda.
 */
export function AddCard({ title, hint, icon = "plus", type = "button", ...props }: AddCardProps) {
  return <ActionTile tone="accent" leading={<IconTile size="md" icon={<ThemaIcon name={icon} />} />} title={title} description={hint} type={type} {...props} />;
}
