import * as React from "react";
import { Heading, Text } from "@/components/typography";
import { cn } from "@/lib/utils";

export interface CoverHeroProps {
  /** La foto de fondo (una barbería, un local). Sin ella solo queda el espacio. */
  imageUrl?: string | null;
  /** Más alta, para pantallas anchas. */
  wide?: boolean;
  /** El ancho de la columna del contenido (lo pone el marco: `max-w-…`). */
  columnClassName?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * La portada de una pantalla: la foto arriba, encuadrada donde está la cara y fundida hacia abajo, con
 * la columna del contenido montada sobre ella. En claro la foto va entera y algo más clara —cualquier
 * fundido la lavaba de blanco—; en oscuro un velo la cubre y el título se lee sobre ella.
 */
export function CoverHero({ imageUrl, wide = false, columnClassName, className, children }: CoverHeroProps) {
  return (
    <>
      <div data-slot="cover-hero" aria-hidden className={cn("relative shrink-0 overflow-hidden dark:[mask-image:linear-gradient(to_bottom,black_55%,transparent)]", wide ? "h-72" : "h-48 dark:h-56")}>
        {imageUrl && <img src={imageUrl} alt="" className="size-full object-cover object-[50%_15%] brightness-[1.2] dark:brightness-100 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700" />}
        <div className="absolute inset-0 hidden bg-gradient-to-t from-background via-background/85 via-50% to-background/45 dark:block" />
      </div>
      <div className={cn("relative mx-auto flex w-full flex-col gap-6 px-5 pb-8 pt-6", wide ? "-mt-60 px-8 pt-8" : "-mt-40 dark:-mt-48", columnClassName, className)}>{children}</div>
    </>
  );
}

export interface CoverTitleProps {
  title: string;
  lead?: string;
  /** Lo que va a la derecha del título: un enlace secundario, un chip. */
  aside?: React.ReactNode;
  wide?: boolean;
}

/**
 * El título sobre la foto de `CoverHero`. En claro va en vidrio ahumado —la foto desenfocada y más viva
 * detrás, un canto de luz arriba y texto blanco—; en oscuro basta la sombra del fondo.
 */
export function CoverTitle({ title, lead, aside, wide = false }: CoverTitleProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300">
      <div className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-white/25 bg-black/30 px-4 py-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_10px_28px_-14px_rgb(0_0_0/0.6)] backdrop-blur-xl backdrop-saturate-150 dark:rounded-none dark:border-0 dark:bg-transparent dark:p-0 dark:shadow-none dark:backdrop-blur-none dark:backdrop-saturate-100">
        <Heading level={wide ? 2 : 3} tone="inverse" className="dark:text-text-primary dark:[text-shadow:0_1px_16px_hsl(var(--background))]">
          {title}
        </Heading>
        {lead && (
          <Text tone="inverse" className="dark:text-text-primary dark:[text-shadow:0_1px_10px_hsl(var(--background))]">
            {lead}
          </Text>
        )}
      </div>
      {aside}
    </header>
  );
}
