import type * as React from "react";
import { useAppT } from "@/app/i18n";
import { Grain, Halo } from "@/components/atmosphere";
import { Heading, Text } from "@/components/typography";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { ShopBrand } from "../flow/ShopBrand";
import { initialsOf, useBookingFormat } from "../bookingFormat";
import { useBookingCatalogQuery, useBookingShopQuery } from "../queries";

const FEATURED_SERVICES = 4;
const FEATURED_BARBERS = 6;

interface DemoSiteProps {
  /** Si el panel del widget está abierto. Lo lleva la vista previa: al entrar a esta vista se abre. */
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Lo que va en el panel: la reserva, que la vista previa comparte con los demás marcos. */
  children: React.ReactNode;
}

/**
 * Un sitio de barbería de ejemplo con el widget puesto: el botón flotante
 * abajo a la derecha abre la reserva en un panel sin salir de la página. Es
 * lo que la barbería pega en su web con el script de «Enlaces y widgets».
 */
export function DemoSite({ isOpen, onOpenChange, children }: DemoSiteProps) {
  const t = useAppT();
  const setIsOpen = onOpenChange;
  const { data: shop } = useBookingShopQuery();
  const { data: catalog } = useBookingCatalogQuery(shop?.branches[0]?.id ?? null);
  const fmt = useBookingFormat(shop?.currency);

  return (
    <div className="relative h-full overflow-hidden bg-background">
      <div className="h-full overflow-y-auto">
        <header className="sticky top-0 z-sticky flex items-center justify-between gap-4 border-b border-border bg-background/80 px-6 py-3 backdrop-blur">
          {shop && <ShopBrand shop={shop} />}
          <nav aria-label={shop?.name} className="hidden items-center gap-6 sm:flex">
            {(["booking.site.nav.services", "booking.site.nav.team", "booking.site.nav.visit"] as const).map((key) => (
              <Text key={key} size="sm" tone="secondary" as="span">
                {t(key)}
              </Text>
            ))}
          </nav>
          <Button type="button" size="sm" onClick={() => setIsOpen(true)}>
            {t("booking.site.fab")}
          </Button>
        </header>

        <section className="relative isolate overflow-hidden">
          {shop?.coverUrl && <img src={shop.coverUrl} alt="" width={1600} height={900} className="absolute inset-0 -z-10 size-full object-cover opacity-30" />}
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/70 to-background/20" aria-hidden />
          <Halo x="20%" y="30%" strength={0.2} />
          <Grain scope="container" />
          <div className="flex flex-col items-start gap-4 px-6 py-20 sm:px-12 sm:py-28">
            <Text size="xs" weight="semibold" tone="primary" className="uppercase tracking-widest">
              {t("booking.site.heroEyebrow")}
            </Text>
            <Heading level={1} weight="bold" className="max-w-xl">
              {t("booking.site.heroTitle")}
            </Heading>
            <Text size="lg" tone="secondary" className="max-w-lg">
              {t("booking.site.heroLead")}
            </Text>
            <Button type="button" size="lg" onClick={() => setIsOpen(true)}>
              <ThemaIcon name="calendar" />
              {t("booking.site.fab")}
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-6 px-6 py-14 sm:px-12">
          <Heading level={3}>{t("booking.site.servicesTitle")}</Heading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(catalog?.services ?? []).slice(0, FEATURED_SERVICES).map((service) => (
              <div key={service.id} className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
                <IconTile size="xl" src={service.imageUrl} icon={<ThemaIcon name="scissors" />} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Text weight="semibold">{service.name}</Text>
                  <Text size="sm" tone="muted">
                    {t("booking.services.minutes", { count: service.durationMin })} · {fmt.money(service.price)}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-6 px-6 pb-28 pt-4 sm:px-12">
          <Heading level={3}>{t("booking.site.teamTitle")}</Heading>
          <div className="flex flex-wrap gap-6">
            {(catalog?.barbers ?? []).slice(0, FEATURED_BARBERS).map((barber) => (
              <div key={barber.id} className="flex w-24 flex-col items-center gap-2 text-center">
                <Avatar size="lg">
                  {barber.avatarUrl && <AvatarImage src={barber.avatarUrl} alt="" />}
                  <AvatarFallback>{initialsOf(barber.name)}</AvatarFallback>
                </Avatar>
                <Text size="xs" weight="medium">
                  {barber.name.split(" ")[0]}
                </Text>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* El panel del widget: se queda montado al cerrarlo para no perder lo que se llevaba. */}
      <div
        role="dialog"
        aria-modal="false"
        aria-label={t("booking.preview.title")}
        aria-hidden={!isOpen}
        className={cn(
          "absolute bottom-24 right-4 z-overlay h-[min(720px,calc(100%-7.5rem))] w-[min(420px,calc(100%-2rem))] overflow-hidden rounded-3xl border border-border shadow-2xl",
          "origin-bottom-right transition-[opacity,transform] duration-normal ease-out-expo motion-reduce:transition-none",
          isOpen ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        )}
      >
        {children}
      </div>

      <Button
        type="button"
        size="lg"
        // Abierto, el botón principal es el de la reserva (pagar, continuar): cerrar pasa a secundario.
        variant={isOpen ? "secondary" : "default"}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="absolute bottom-6 right-4 z-overlay shadow-xl"
      >
        <ThemaIcon name={isOpen ? "close" : "calendar"} />
        {isOpen ? t("booking.site.close") : t("booking.site.fab")}
      </Button>
    </div>
  );
}
