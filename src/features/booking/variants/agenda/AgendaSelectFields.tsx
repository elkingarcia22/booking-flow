import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { useBookingFlow } from "../../flow/BookingContext";
import type { BookingBarber } from "../../types";
import { AgendaBarberField } from "./AgendaBarberField";
import { AgendaBranchField } from "./AgendaBranchField";
import { AgendaServiceField } from "./AgendaServicePicker";

interface AgendaSelectFieldsProps {
  /** Quienes hacen lo elegido, ya ordenados (el de siempre primero). */
  barbers: readonly BookingBarber[];
  usualId: string | null;
  /** «Lo de siempre», si aplica: el atajo junto a los servicios. */
  onUsual?: () => void;
  /** Lo que va pegado a Servicios, debajo (el «cada servicio con su barbero u hora»). */
  afterServices?: React.ReactNode;
}

/** Una pregunta con su campo debajo: el mismo título para todas. */
function FieldSection({ id, label, aside, inline = false, className, children }: { id: string; label: string; aside?: React.ReactNode; /** El título va dentro del campo: se ahorra una línea por pregunta. */ inline?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col gap-2 [&>button]:flex-1", className)}>
      {inline ? (
        <>
          <span id={id} className="sr-only">
            {label}
          </span>
          {aside && <div className="-mb-1 flex justify-end">{aside}</div>}
        </>
      ) : (
        <div className="flex min-h-8 items-center justify-between gap-3">
          <Text id={id} size="sm" weight="medium" className="truncate">
            {label}
          </Text>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Las preguntas de la Agenda, en filas y de a una: dónde, qué y con quién. Cada una es un campo
 * que abre su lista y aparece cuando la anterior ya tiene respuesta; las horas van aparte, debajo.
 */
export function AgendaSelectFields({ barbers, usualId, onUsual, afterServices }: AgendaSelectFieldsProps) {
  const t = useAppT();
  const { shop, state } = useBookingFlow();
  const showServices = Boolean(state.branchId);
  const showBarber = showServices && (state.draft?.serviceIds.length ?? 0) > 0;
  const reveal = "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-300";
  const hasBranches = shop.branches.length > 1;
  // La lista de sedes se abre desde su campo o desde Servicios y Barbero cuando aún no hay sede.
  const [branchOpen, setBranchOpen] = React.useState(false);
  const needBranch = hasBranches ? () => setBranchOpen(true) : undefined;
  return (
    <div className="flex flex-col gap-2">
      {hasBranches && (
        <FieldSection id="agenda-where" label={t("booking.step.branch")} inline>
          <AgendaBranchField labelledBy="agenda-where" eyebrow={t("booking.step.branch")} open={branchOpen} onOpenChange={setBranchOpen} />
        </FieldSection>
      )}
      {showServices && (
        <FieldSection
          id="agenda-what"
          label={t("booking.step.services")}
          inline
          className={reveal}
          aside={
            onUsual && (
              <Button type="button" variant="ghost" size="sm" className="-mr-2 text-primary" onClick={onUsual}>
                <ThemaIcon name="refresh" />
                {t("booking.agenda.usual")}
              </Button>
            )
          }
        >
          <AgendaServiceField labelledBy="agenda-what" eyebrow={t("booking.step.services")} onNeedBranch={needBranch} />
        </FieldSection>
      )}
      {showServices && afterServices && <div className={cn("px-1 py-1", reveal)}>{afterServices}</div>}
      {showBarber && (
        <FieldSection id="agenda-who" label={t("booking.step.barber")} inline className={reveal}>
          <AgendaBarberField labelledBy="agenda-who" barbers={barbers} usualId={usualId} eyebrow={t("booking.step.barber")} onNeedBranch={needBranch} />
        </FieldSection>
      )}
    </div>
  );
}
