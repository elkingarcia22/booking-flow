import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Carousel, type CarouselApi, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";

interface PhotoStripProps {
  photos: readonly string[];
  /** Se llama con la posición de la foto tocada (para abrirla a pantalla completa). */
  onOpen: (index: number) => void;
  /** Alto de las fotos; el ancho sale de su proporción. */
  className?: string;
  /** Con foto principal, la primera es más ancha. */
  featured?: boolean;
}

/**
 * Una tira de fotos que se recorre arrastrando —con el dedo o con el mouse— o
 * con las flechas, sin tener que abrirlas. Tocar una (sin arrastrar) la abre en
 * la galería. Con el overflow del navegador solo se desplaza con el dedo o la
 * rueda; con Embla también se arrastra con el puntero.
 */
export function PhotoStrip({ photos, onOpen, className, featured = false }: PhotoStripProps) {
  const t = useAppT();
  const [api, setApi] = React.useState<CarouselApi>();
  return (
    <Carousel setApi={setApi} opts={{ align: "start", dragFree: true, containScroll: "trimSnaps" }} className={cn("-mx-6", className)}>
      <CarouselContent className="-ml-2 px-6">
        {photos.map((src, position) => (
          <CarouselItem key={src} className={cn("pl-2", featured && position === 0 ? "basis-[64%]" : "basis-[40%]")}>
            <button
              type="button"
              onClick={() => onOpen(position)}
              aria-label={t("booking.barber.openPhoto", { current: position + 1, total: photos.length })}
              className="group relative block h-44 w-full overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <img src={src} alt="" loading={position < 2 ? "eager" : "lazy"} draggable={false} className="size-full select-none object-cover transition-transform duration-slow ease-out-expo group-hover:scale-105 motion-reduce:transition-none" />
            </button>
          </CarouselItem>
        ))}
      </CarouselContent>
      {/* Un solo botón para toda la tira (cada foto ya se abre al tocarla): abre la que va primera a la vista. */}
      <button
        type="button"
        onClick={() => onOpen(api?.selectedScrollSnap() ?? 0)}
        aria-label={t("booking.gallery.expand")}
        className="absolute right-8 top-2 flex size-8 items-center justify-center rounded-full bg-white text-black shadow-md ring-1 ring-black/15 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
      >
        <ThemaIcon name="expand" size="sm" className="text-black" />
      </button>
      {photos.length > 2 && (
        <>
          <CarouselPrevious className="left-8 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70 hover:text-white disabled:opacity-0" aria-label={t("booking.gallery.previous")} />
          <CarouselNext className="right-8 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70 hover:text-white disabled:opacity-0" aria-label={t("booking.gallery.next")} />
        </>
      )}
    </Carousel>
  );
}
