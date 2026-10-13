import { useAppT } from "@/app/i18n";
import { Heading, Text } from "@/components/typography";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { useBookingFlow } from "../../flow/BookingContext";
import { ShopBrand } from "../../flow/ShopBrand";
import { STEP_WIDTH } from "../../flow/stepWidth";
import { ChatTrigger } from "../../flow/ChatTrigger";
import { EntryShortcuts } from "./EntryShortcuts";
import { PhoneEntryActions, PhoneEntryField } from "./PhoneEntryParts";
import { usePhoneEntry } from "./usePhoneEntry";

/**
 * Entrada «Portada»: la foto de la barbería arriba, como la vitrina, y encima una tarjeta con su
 * marca y el celular. Debajo, las sedes con su horario de hoy. Se siente como llegar al local.
 */
export function CoverEntry() {
  const t = useAppT();
  const { shop, fmt, layout, touch } = useBookingFlow();
  const entry = usePhoneEntry();
  const cover = shop.coverUrl ?? shop.branches.find((branch) => branch.imageUrl)?.imageUrl ?? null;
  const isWide = layout === "wide";

  return (
    <form onSubmit={entry.submit} noValidate className="relative flex flex-1 flex-col">
      {/* La foto crece con la pantalla (en una franja baja y ancha solo se veía la capa), se encuadra arriba,
          donde está la cara, y se desvanece por máscara: un degradado del color del fondo dejaba una línea
          donde el halo aclara el fondo de debajo. */}
      <div
        // En claro la foto va entera, sin desvanecer y algo más clara, y la tarjeta la tapa desde su mitad; en oscuro, como estaba.
        className={cn("relative shrink-0 overflow-hidden dark:[mask-image:linear-gradient(to_bottom,black_45%,transparent)]", isWide ? "h-80" : touch === "lg" ? "h-60" : "h-44")}
        aria-hidden
      >
        {cover && <img src={cover} alt="" className={cn("size-full object-cover object-[50%_15%] brightness-[1.2] dark:brightness-100 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700")} />}
      </div>
      {/* Clipper arriba a la derecha, sobre la foto: a la vista sin competir con «Continuar». */}
      <div className="absolute right-4 top-4 z-raised">
        <ChatTrigger full />
      </div>

      <div className={cn("relative mx-auto -mt-32 flex dark:-mt-16 w-full flex-1 flex-col gap-6 px-5 pb-6", STEP_WIDTH[layout], isWide && "px-8")}>
        <section className="flex flex-col gap-5 rounded-3xl border border-border bg-surface p-5 shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
          <div className="flex items-center gap-3">
            <ShopBrand shop={shop} iconOnly />
            <div className="flex min-w-0 flex-col">
              <Text weight="semibold" truncate>
                {shop.name}
              </Text>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Heading level={2}>{t("booking.phone.title")}</Heading>
            <Text tone="secondary">{t("booking.entry.coverLead")}</Text>
          </div>
          <PhoneEntryField entry={entry} />
        </section>

        <EntryShortcuts />

        <section aria-labelledby="cover-branches" className="flex flex-col gap-3">
          <Text id="cover-branches" size="xs" weight="semibold" tone="muted" className="uppercase tracking-wide">
            {t("booking.entry.branches")}
          </Text>
          <ul className={cn("grid gap-2", shop.branches.length > 1 && isWide ? "grid-cols-2" : "grid-cols-1")}>
            {shop.branches.map((branch) => (
              <li key={branch.id} className="flex items-center gap-3 rounded-2xl border border-border p-2.5">
                <IconTile size="lg" src={branch.imageUrl ?? undefined} icon={<ThemaIcon name="building" />} />
                <div className="flex min-w-0 flex-col">
                  <Text size="sm" weight="medium" truncate>
                    {branch.name}
                  </Text>
                  <Text size="xs" tone="muted" truncate>
                    {branch.address}
                  </Text>
                  <Text size="xs" tone="secondary" tabular>
                    {fmt.clock(branch.opensAt)} – {fmt.clock(branch.closesAt)}
                  </Text>
                </div>
              </li>
            ))}
          </ul>
        </section>

      </div>

      <div className="sticky bottom-0 z-sticky border-t border-border bg-surface px-5 py-3 shadow-[0_-8px_16px_-12px_hsl(var(--foreground)/0.25)]">
        <div className={cn("mx-auto w-full", STEP_WIDTH[layout], isWide && "px-3")}>
          <PhoneEntryActions entry={entry} />
        </div>
      </div>
    </form>
  );
}
