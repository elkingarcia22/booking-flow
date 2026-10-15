import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { ActionTile, IconTile } from "@/components/utility";
import { ThemaIcon } from "@/icons";
import { clockMinutes } from "../../bookingFormat";
import { useBookingFlow } from "../../flow/BookingContext";
import { BookingOverlay } from "../../flow/BookingOverlay";
import { BranchProfileBody } from "../../flow/BranchProfileSheet";
import { ShopBrand } from "../../flow/ShopBrand";
import type { BookingBranch } from "../../types";

/** El horario de hoy de toda la barbería: desde la sede que abre primero hasta la que cierra última. */
function shopHours(branches: readonly BookingBranch[]): { from: string; to: string } | null {
  if (branches.length === 0) return null;
  const from = branches.reduce((earliest, branch) => (clockMinutes(branch.opensAt) < clockMinutes(earliest) ? branch.opensAt : earliest), branches[0].opensAt);
  const to = branches.reduce((latest, branch) => (clockMinutes(branch.closesAt) > clockMinutes(latest) ? branch.closesAt : latest), branches[0].closesAt);
  return { from, to };
}

/**
 * Las sedes en la portada, agrupadas en una sola tarjeta: el logo de la barbería, dónde queda y a
 * qué hora atiende hoy. «Ver sede» (una) abre su perfil; «Ver sedes» (varias) abre la lista y, sin
 * salir de la ventana, el perfil de cada una con «Volver». La ventana es la de la reserva: sube
 * desde abajo en celular y tablet, es un modal en monitor.
 */
export function ShopBranchesCard() {
  const t = useAppT();
  const { shop, fmt } = useBookingFlow();
  const [open, setOpen] = React.useState(false);
  const [viewing, setViewing] = React.useState<string | null>(null);
  const topRef = React.useRef<HTMLDivElement>(null);
  const branches = shop.branches;
  const isSingle = branches.length === 1;
  const shown = isSingle ? branches[0] : branches.find((branch) => branch.id === viewing);
  const hours = shopHours(branches);

  // Al pasar de la lista a una sede (o volver) se arranca desde arriba.
  React.useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" });
  }, [viewing]);

  if (branches.length === 0) return null;

  const cities = [...new Set(branches.map((branch) => branch.city))].join(" · ");
  const where = isSingle ? `${branches[0].address}, ${branches[0].city}` : t("booking.entry.branchesWhere", { count: branches.length, cities });

  const openChange = (next: boolean) => {
    setOpen(next);
    if (!next) setViewing(null);
  };

  return (
    <section aria-labelledby="cover-branches" className="flex flex-col gap-3">
      <Text id="cover-branches" size="xs" weight="semibold" tone="muted" className="uppercase tracking-wide">
        {isSingle ? t("booking.entry.branch") : t("booking.entry.branches")}
      </Text>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3" data-testid="cover-branches-card">
        <ShopBrand shop={shop} iconOnly className="shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Text size="sm" weight="semibold" truncate>
            {shop.name}
          </Text>
          <Text size="xs" tone="secondary" className="flex min-w-0 items-center gap-1.5">
            <ThemaIcon name="compass" size="xs" className="shrink-0" />
            <span className="truncate">{where}</span>
          </Text>
          {hours && (
            <Text size="xs" tone="muted" tabular className="flex min-w-0 items-center gap-1.5">
              <ThemaIcon name="clock" size="xs" className="shrink-0" />
              <span className="truncate">{t("booking.branch.hours", { from: fmt.clock(hours.from), to: fmt.clock(hours.to) })}</span>
            </Text>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setOpen(true)}>
          {isSingle ? t("booking.entry.viewBranch") : t("booking.entry.viewBranches")}
        </Button>
      </div>

      <BookingOverlay
        open={open}
        onOpenChange={openChange}
        size="lg"
        title={shown ? shown.name : t("booking.entry.branches")}
        description={shown ? `${shown.address}, ${shown.city}` : t("booking.branch.lead")}
        leading={
          <span className="flex items-center gap-2">
            {shown && !isSingle && (
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setViewing(null)} aria-label={t("common.back")} className="-ml-1">
                <ThemaIcon name="arrowLeft" />
              </Button>
            )}
            {shown ? <IconTile size="md" src={shown.imageUrl ?? undefined} icon={<ThemaIcon name="building" />} /> : <ShopBrand shop={shop} iconOnly />}
          </span>
        }
      >
        <div ref={topRef} />
        {shown ? (
          <div key={shown.id} className={isSingle ? undefined : "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-4 motion-safe:duration-200"}>
            <BranchProfileBody branchId={shown.id} />
          </div>
        ) : (
          <ul className="flex flex-col gap-2" aria-label={t("booking.entry.branches")}>
            {branches.map((branch) => (
              <li key={branch.id}>
                <ActionTile
                  onClick={() => setViewing(branch.id)}
                  leading={<IconTile size="lg" src={branch.imageUrl ?? undefined} icon={<ThemaIcon name="building" />} />}
                  title={<span className="block truncate">{branch.name}</span>}
                  description={
                    <>
                      <span className="block truncate">
                        {branch.address}, {branch.city}
                      </span>
                      <span className="block truncate tabular-nums">
                        {t("booking.branch.hours", { from: fmt.clock(branch.opensAt), to: fmt.clock(branch.closesAt) })} · {t("booking.branch.barbers", { count: branch.barbers })}
                      </span>
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </BookingOverlay>
    </section>
  );
}
