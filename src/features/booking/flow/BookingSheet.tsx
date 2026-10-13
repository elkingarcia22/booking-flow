import * as React from "react";
import { BookingOverlay } from "./BookingOverlay";

interface BookingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Los botones del pie. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Las decisiones cortas de la reserva (cambiar de sede, para quién es, cancelar,
 * enviar el recibo): en celular, tablet y widget suben desde abajo, al alcance
 * del pulgar, como cualquier hoja de una app; en monitor son un modal centrado.
 */
export function BookingSheet({ open, onOpenChange, title, description, actions, children }: BookingSheetProps) {
  return (
    <BookingOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      actions={actions}
    >
      {children}
    </BookingOverlay>
  );
}
