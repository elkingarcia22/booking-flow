import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { useBookingFlow } from "../../flow/BookingContext";
import { ChatTrigger } from "../../flow/ChatTrigger";
import { ShopBrand } from "../../flow/ShopBrand";

interface AgendaHeaderProps {
  onBack: (() => void) | null;
  onSignIn: () => void;
  trailing?: React.ReactNode;
  /** «Agenda con Clipper» solo en la primera pantalla (la agenda), no ya en el cierre. */
  showChat?: boolean;
}

/**
 * La cabecera de la agenda: la barbería, «Agenda con Clipper», entrar como
 * cliente (no hace falta para mirar horas) y «Mis citas». Sin menú de «más
 * opciones» (regalos y paquetes): arriba solo queda lo de agendar. No cuenta
 * pasos: aquí no hay pasos.
 */
export function AgendaHeader({ onBack, onSignIn, trailing, showChat = false }: AgendaHeaderProps) {
  const t = useAppT();
  const { shop, state, dispatch, layout, touch } = useBookingFlow();
  const isWide = layout === "wide";
  // «Mis citas» solo con texto (monitor); el botón de solo icono no va.
  const showMyAppointments = state.step !== "manage" && isWide;

  return (
    <header className="relative z-sticky shrink-0 border-b border-border bg-surface/90 backdrop-blur">
      <div className={cn("flex h-14 items-center gap-2 px-3", isWide && "h-16 px-6")}>
        {onBack && (
          <Button type="button" variant="ghost" size="icon-sm" onClick={onBack} aria-label={t("booking.header.back")}>
            <ThemaIcon name="chevronLeft" />
          </Button>
        )}
        <div className="flex min-w-0 flex-1 items-center">
          {/* Solo la marca (en celular, solo el logo): la sede ya se ve y se cambia en su campo. */}
          <ShopBrand shop={shop} iconOnly={!isWide && touch !== "lg"} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {showChat && <ChatTrigger full />}
          {/* Ya dentro, «Mis citas». «Entrar» solo si aún no dio su celular: la portada ya lo pide y el código va al pagar. */}
          {state.customer ? (
            <>
              <Text size="sm" weight="medium" className={cn("px-2", !isWide && "sr-only")}>
                {t("booking.agenda.signedAs", { name: state.customer.firstName })}
              </Text>
              {showMyAppointments && (
                <Button type="button" variant="outline" size={isWide ? "sm" : "icon-sm"} onClick={() => dispatch({ type: "openManage" })} aria-label={t("booking.header.myAppointments")}>
                  <ThemaIcon name="calendar" />
                  {isWide && t("booking.header.myAppointments")}
                </Button>
              )}
            </>
          ) : !state.phone ? (
            <Button type="button" variant="outline" size="sm" onClick={onSignIn}>
              <ThemaIcon name="login" />
              {isWide ? t("booking.agenda.signIn") : t("booking.agenda.signInShort")}
            </Button>
          ) : null}
          {trailing}
        </div>
      </div>
    </header>
  );
}
