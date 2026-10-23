import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Button } from "@/components/ui/button";
import { ThemaIcon } from "@/icons";
import { useBookingFlow } from "./BookingContext";
import { InPlaceIdentity } from "./InPlaceIdentity";
import { BookingSheet } from "./BookingSheet";
import { WaitlistCard } from "./WaitlistCard";

interface WaitlistSignInProps {
  day: Date;
  hasSlots: boolean;
}

/**
 * La lista de espera en Paso a paso, igual que en la Agenda: sabiendo quién es, la tarjeta para
 * apuntarse; si no, «Avísame si se libera una hora» abre la hoja de `AgendaIdentity` (sin código: busca
 * el celular ya escrito o lo pide, y al nuevo le pide su ficha). Entrar desde aquí no mueve de la
 * pantalla de horas y, ya dentro, la tarjeta queda abierta para elegir la franja.
 */
export function WaitlistSignIn({ day, hasSlots }: WaitlistSignInProps) {
  const t = useAppT();
  const [open, setOpen] = React.useState(false);
  const [signedInHere, setSignedInHere] = React.useState(false);
  const { state } = useBookingFlow();

  // Ya se sabe quién es: la hoja se cierra sola y la tarjeta se abre.
  if (open && state.customer) {
    setOpen(false);
    setSignedInHere(true);
  }

  if (state.customer) return <WaitlistCard day={day} hasSlots={hasSlots} defaultOpen={signedInHere} />;

  return (
    <>
      <Button type="button" variant="link" size="sm" className="self-start px-0" onClick={() => setOpen(true)}>
        <ThemaIcon name="notification" />
        {t("booking.agenda.waitlistSignIn")}
      </Button>
      <BookingSheet open={open} onOpenChange={setOpen} title={t(state.token ? "booking.payIdentity.newTitle" : "booking.agenda.signInTitle")} description={t(state.token ? "booking.waitlist.newLead" : "booking.waitlist.signInLead")}>
        <InPlaceIdentity />
      </BookingSheet>
    </>
  );
}
