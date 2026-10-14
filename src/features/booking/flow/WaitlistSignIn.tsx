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
 * La lista de espera en Paso a paso, igual que en la Agenda: con cuenta, la tarjeta para
 * apuntarse; sin confirmar, «Avísame si se libera una hora» abre la hoja del código
 * (`AgendaIdentity`), que va directo al celular ya escrito (o lo pide si no lo hay). Entrar desde aquí no mueve de la pantalla de horas y, ya
 * dentro, la tarjeta queda abierta para elegir la franja.
 */
export function WaitlistSignIn({ day, hasSlots }: WaitlistSignInProps) {
  const t = useAppT();
  const [open, setOpen] = React.useState(false);
  const [signedInHere, setSignedInHere] = React.useState(false);
  const { state } = useBookingFlow();

  // Ya se sabe quién es: la hoja se cierra sola y la tarjeta se abre.
  if (open && state.customer && state.verified) {
    setOpen(false);
    setSignedInHere(true);
  }

  if (state.customer && state.verified) return <WaitlistCard day={day} hasSlots={hasSlots} defaultOpen={signedInHere} />;

  return (
    <>
      <Button type="button" variant="link" size="sm" className="self-start px-0" onClick={() => setOpen(true)}>
        <ThemaIcon name="notification" />
        {t("booking.agenda.waitlistSignIn")}
      </Button>
      <BookingSheet open={open} onOpenChange={setOpen} title={t(state.phone ? "booking.payIdentity.title" : "booking.agenda.signInTitle")} description={t(state.phone ? "booking.waitlist.codeLead" : "booking.waitlist.signInLead")}>
        <InPlaceIdentity />
      </BookingSheet>
    </>
  );
}
