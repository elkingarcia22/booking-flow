import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MagicCard } from "@/components/ui/magic-card";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { useBookingFlow } from "../flow/BookingContext";
import { BranchProfileSheet } from "../flow/BranchProfileSheet";
import { SelectMark } from "@/components/selection";
import { StepLayout } from "../flow/StepLayout";

/**
 * La sede, con foto: se reconoce el local antes que la dirección. Tocar la
 * tarjeta elige y avanza; no hay «Siguiente» para una sola decisión.
 */
export function BranchStep() {
  const t = useAppT();
  const { shop, state, dispatch, fmt, layout } = useBookingFlow();
  const [viewing, setViewing] = React.useState<string | null>(null);
  return (
    <StepLayout title={t("booking.branch.title")} lead={t("booking.branch.lead")} cover>
      {state.items.length > 0 && (
        <Alert variant="warning">
          <ThemaIcon name="warning" />
          <AlertDescription>{t("booking.branch.changeWarning")}</AlertDescription>
        </Alert>
      )}
      <div role="radiogroup" aria-label={t("booking.branch.title")} className={cn("grid grid-cols-1 gap-3", layout === "wide" && "sm:grid-cols-2")}>
        {shop.branches.map((branch) => (
          <div key={branch.id} className="relative">
          <MagicCard
            role="radio"
            aria-checked={branch.id === state.branchId}
            aria-label={`${branch.name}, ${branch.address}`}
            isSelected={branch.id === state.branchId}
            onClick={() => dispatch({ type: "chooseBranch", branchId: branch.id })}
            className="w-full"
            contentClassName="items-start gap-4 pb-9 text-left"
          >
            <IconTile size="xl" src={branch.imageUrl} icon={<ThemaIcon name="building" />} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <Text weight="semibold" truncate>
                {branch.name}
              </Text>
              <Text size="xs" tone="secondary" className="flex items-center gap-1.5">
                <ThemaIcon name="compass" size="xs" />
                <span className="truncate">
                  {branch.address}, {branch.city}
                </span>
              </Text>
              <Text size="xs" tone="secondary" className="flex items-center gap-1.5">
                <ThemaIcon name="clock" size="xs" />
                {t("booking.branch.hours", { from: fmt.clock(branch.opensAt), to: fmt.clock(branch.closesAt) })}
              </Text>
              <Text size="xs" tone="muted" className="flex items-center gap-1.5">
                <ThemaIcon name="users" size="xs" />
                {t("booking.branch.barbers", { count: branch.barbers })}
              </Text>
            </span>
            <SelectMark kind="radio" checked={branch.id === state.branchId} />
          </MagicCard>
          {/* El perfil es otro botón, fuera de la tarjeta (un botón no va dentro de otro), puesto bajo la
              cantidad de barberos: alineado con el texto (borde + relleno + foto + hueco). */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute bottom-3 left-[calc(6rem+1.5px)] z-raised -translate-x-2.5 text-primary hover:text-primary"
            onClick={() => setViewing(branch.id)}
            aria-label={`${t("booking.branch.viewProfile")}: ${branch.name}`}
          >
            {t("booking.branch.viewProfile")}
            <ThemaIcon name="chevronRight" size="xs" data-icon="inline-end" />
          </Button>
          </div>
        ))}
      </div>
      <BranchProfileSheet
        branchId={viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        onChoose={(branchId) => {
          setViewing(null);
          dispatch({ type: "chooseBranch", branchId });
        }}
      />
    </StepLayout>
  );
}
