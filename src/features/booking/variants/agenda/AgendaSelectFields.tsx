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
import { useAgendaListMode } from "./AgendaPicker";
import { AgendaServiceField } from "./AgendaServicePicker";

interface AgendaSelectFieldsProps {
  /** Quienes hacen lo elegido, ya ordenados (el de siempre primero). */
  barbers: readonly BookingBarber[];
  usualId: string | null;
  /** «Lo de siempre», si aplica: el atajo junto a los servicios. */
  onUsual?: () => void;
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
 * Las preguntas de la Agenda con selector, en orden y numeradas: dónde, con quién y qué.
 * Cada una es un campo que abre su lista; las horas van aparte, debajo.
 */
export function AgendaSelectFields({ barbers, usualId, onUsual }: AgendaSelectFieldsProps) {
  const t = useAppT();
  const { shop, layout, touch, state } = useBookingFlow();
  // La Agenda en lista: filas una debajo de otra en todos los tamaños, y un paso a la vez: cada
  // pregunta aparece cuando la anterior ya tiene respuesta (sede → barbero → servicios).
  const listMode = useAgendaListMode();
  const showBarber = !listMode || Boolean(state.branchId);
  const showServices = showBarber && (!listMode || Boolean(state.draft?.barberId) || Boolean(state.draft?.barberChosen) || (state.draft?.serviceIds.length ?? 0) > 0);
  const reveal = listMode ? "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-300" : undefined;
  const hasBranches = shop.branches.length > 1;
  // La lista de sedes se abre desde su campo o desde Servicios y Barbero cuando aún no hay sede.
  const [branchOpen, setBranchOpen] = React.useState(false);
  const needBranch = hasBranches ? () => setBranchOpen(true) : undefined;
  const isWide = layout === "wide";
  // Las preguntas van numeradas: sede, barbero y servicios; con una sola sede, Barbero es la 1.
  const first = hasBranches ? 2 : 1;
  // En celular (y el widget) no caben tres en fila: van una debajo de otra, como filas.
  const asCards = (isWide || touch === "lg") && !listMode;
  return (
    // Tablet y monitor: tarjetas una al lado de la otra; celular: una debajo de otra.
    <div className={asCards ? cn("grid items-stretch", isWide ? "gap-3" : "gap-2", hasBranches ? "grid-cols-3" : "grid-cols-2") : "flex flex-col gap-2"}>
      {hasBranches && (
        <FieldSection id="agenda-where" label={t("booking.step.branch")} inline>
          <AgendaBranchField labelledBy="agenda-where" eyebrow={t("booking.step.branch")} step={1} open={branchOpen} onOpenChange={setBranchOpen} />
        </FieldSection>
      )}
      {showBarber && (
        <FieldSection id="agenda-who" label={t("booking.step.barber")} inline className={reveal}>
          <AgendaBarberField labelledBy="agenda-who" barbers={barbers} usualId={usualId} eyebrow={t("booking.step.barber")} step={first} onNeedBranch={needBranch} />
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
          <AgendaServiceField labelledBy="agenda-what" eyebrow={t("booking.step.services")} step={first + 1} onNeedBranch={needBranch} />
        </FieldSection>
      )}
    </div>
  );
}
