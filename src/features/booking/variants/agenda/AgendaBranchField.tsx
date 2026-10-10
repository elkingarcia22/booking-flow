import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { useBookingFlow } from "../../flow/BookingContext";
import { BranchProfileBody } from "../../flow/BranchProfileSheet";
import { PickerField, PickerOverlay, PickerRow } from "./AgendaPicker";

/**
 * La sede en la Agenda con selector: el mismo campo que los servicios (foto del
 * local, nombre y dirección) y la lista de sedes en la misma ventana. Tocar una
 * sede la elige y cierra; «Ver detalle» abre su perfil sin salir de la ventana
 * (con «Volver» a la lista). Con citas ya apartadas cambiar vacía la reserva
 * (barberos y precios son de cada sede): la sede queda marcada y el pie pide
 * confirmarlo antes. Sin sede elegida (sin cuenta) el campo va vacío; la
 * apertura se puede llevar desde fuera para que Servicios o Barbero la pidan.
 */
export function AgendaBranchField({ labelledBy, eyebrow, open: openProp, onOpenChange }: { labelledBy: string; eyebrow?: string; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const t = useAppT();
  const { shop, state, dispatch, fmt } = useBookingFlow();
  const [openState, setOpenState] = React.useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  const [pending, setPending] = React.useState<string | null>(null);
  const [viewing, setViewing] = React.useState<string | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const current = shop.branches.find((branch) => branch.id === state.branchId);
  if (shop.branches.length < 2) return null;

  const openChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setPending(null);
      setViewing(null);
    }
  };
  const choose = (branchId: string) => {
    dispatch({ type: "chooseBranch", branchId });
    // Los barberos son de cada sede: el que estaba elegido no sigue.
    if (state.draft?.barberId) dispatch({ type: "chooseBarber", barberId: null });
    openChange(false);
  };
  const pick = (branchId: string) => {
    if (branchId === state.branchId) return openChange(false);
    if (state.items.length > 0) return setPending(branchId);
    choose(branchId);
  };
  const marked = pending ?? state.branchId;
  const shown = viewing ? shop.branches.find((branch) => branch.id === viewing) : undefined;

  const footer = pending ? (
    <div className="flex w-full flex-col gap-3">
      <Text size="sm" tone="secondary" aria-live="polite">
        {t("booking.agenda.branchChangeBody")} {t("booking.agenda.branchChangeCount", { count: state.items.length })}
      </Text>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" size="lg" onClick={() => setPending(null)}>
          {t("booking.agenda.branchChangeCancel")}
        </Button>
        <Button type="button" size="lg" onClick={() => choose(pending)}>
          {t("booking.agenda.branchChangeOk")}
        </Button>
      </div>
    </div>
  ) : shown ? (
    shown.id === state.branchId ? (
      <Button type="button" size="lg" variant="outline" className="w-full" onClick={() => openChange(false)}>
        {t("booking.branchProfile.current")}
      </Button>
    ) : (
      <Button type="button" size="lg" className="w-full" onClick={() => pick(shown.id)}>
        {t("booking.branchProfile.choose", { name: shown.name })}
      </Button>
    )
  ) : undefined;

  return (
    <>
      <PickerField
        asCard
        eyebrow={eyebrow}
        labelledBy={labelledBy}
        imageUrl={current?.imageUrl}
        icon="building"
        value={current?.name}
        detail={current ? `${current.address}, ${current.city}` : undefined}
        placeholder={t("booking.agenda.wherePlaceholder")}
        open={open}
        onOpen={() => setOpen(true)}
        testId="agenda-branch-field"
      />
      <PickerOverlay
        open={open}
        onOpenChange={openChange}
        title={shown ? shown.name : t("booking.agenda.whereLabel")}
        description={shown ? `${shown.address}, ${shown.city}` : t("booking.branch.lead")}
        leading={shown ? <IconTile size="md" src={shown.imageUrl ?? undefined} icon={<ThemaIcon name="building" />} /> : undefined}
        onBack={shown ? () => setViewing(null) : undefined}
        view={shown ? `branch:${shown.id}` : "list"}
        footer={footer}
        focusRef={listRef}
      >
        {shown ? (
          <div className="p-4">
            <BranchProfileBody branchId={shown.id} />
          </div>
        ) : (
          <div ref={listRef} role="radiogroup" aria-label={t("booking.agenda.whereLabel")} className="flex flex-col gap-0.5 p-2">
            {shop.branches.map((branch) => (
              <PickerRow
                key={branch.id}
                role="radio"
                checked={branch.id === marked}
                label={`${branch.name}, ${branch.address}`}
                imageUrl={branch.imageUrl}
                icon="building"
                onClick={() => pick(branch.id)}
                action={{ label: t("booking.agenda.detail"), ariaLabel: `${t("booking.agenda.detail")}: ${branch.name}`, onClick: () => setViewing(branch.id) }}
              >
                <Text as="span" weight="medium" className="truncate">
                  {branch.name}
                </Text>
                <Text as="span" size="xs" tone="secondary" className="truncate">
                  {branch.address}, {branch.city}
                </Text>
                <Text as="span" size="xs" tone="muted" tabular className="flex min-w-0 items-center gap-1.5">
                  <ThemaIcon name="clock" size="xs" className="shrink-0" />
                  <span className="truncate">{t("booking.branch.hours", { from: fmt.clock(branch.opensAt), to: fmt.clock(branch.closesAt) })}</span>
                </Text>
                <Text as="span" size="xs" tone="muted" tabular className="flex min-w-0 items-center gap-1.5">
                  <ThemaIcon name="users" size="xs" className="shrink-0" />
                  <span className="truncate">{t("booking.branch.barbers", { count: branch.barbers })}</span>
                </Text>
              </PickerRow>
            ))}
          </div>
        )}
      </PickerOverlay>
    </>
  );
}
