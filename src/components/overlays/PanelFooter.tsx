import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * PANEL FOOTER
 *
 * La acción principal de un panel (o de una de sus páginas) queda fija abajo,
 * como pie, aunque el formulario de arriba se desplace. Quien la declara puede
 * estar tan dentro del cuerpo como haga falta: se lleva al hueco que el panel
 * (`SidePanelShell` o `DrawerShell`) deja bajo el cuerpo. Fuera de un panel se
 * pinta donde está.
 */

const PanelFooterSlotContext = React.createContext<HTMLElement | null>(null);

/** El hueco del pie: el panel lo pinta bajo el cuerpo y lo comparte con lo de dentro. */
export function usePanelFooterSlot(): [HTMLElement | null, (node: HTMLElement | null) => void] {
  return React.useState<HTMLElement | null>(null);
}

export const PanelFooterSlotProvider = PanelFooterSlotContext.Provider;

/** Clases del hueco: se oculta solo mientras nadie pone nada en él. */
export const PANEL_FOOTER_SLOT_CLASS = "flex shrink-0 flex-col gap-3 border-t border-border bg-surface px-5 py-4 empty:hidden";

export function PanelFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  const slot = React.useContext(PanelFooterSlotContext);
  const content = <div className={cn("flex flex-col gap-3", className)} data-slot="panel-footer">{children}</div>;
  return slot ? createPortal(content, slot) : content;
}
