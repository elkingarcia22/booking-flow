import * as React from "react";
import { Heading, Text } from "@/components/typography";
import { cn } from "@/lib/utils";
import { useBookingFlow } from "./BookingContext";
import { useAsideFooter } from "./asideSlot";
import { AgendaCover, AgendaCoverTitle } from "./AgendaCover";
import { useBookingSkin } from "./bookingSkin";
import { STEP_WIDTH } from "./stepWidth";

interface StepLayoutProps {
  title: string;
  lead?: string;
  /** Lo que va a la derecha del título: un enlace secundario, un chip. */
  aside?: React.ReactNode;
  /** El pie fijo del paso: lo elegido hasta ahora y el botón para seguir. */
  footer?: React.ReactNode;
  /**
   * Al entrar, el foco va al título (para el lector de pantalla). Un paso cuyo primer campo ya
   * lo dice todo —el código— lo apaga para que el teclado se abra solo en ese campo.
   */
  focusTitle?: boolean;
  /**
   * Un paso de elegir (sede, servicios, barbero, hora): con la piel de la Agenda («Según el cliente») va
   * sobre la foto de la barbería con el título en vidrio, como el tablero de la Agenda.
   */
  cover?: boolean;
  children: React.ReactNode;
}

/**
 * El molde de cada paso: título que dice qué se decide aquí, el contenido y
 * un pie pegado abajo con el botón principal, siempre en el mismo sitio para
 * que el pulgar lo encuentre sin buscar.
 */
export function StepLayout({ title, lead, aside, footer, focusTitle = true, cover = false, children }: StepLayoutProps) {
  const { layout } = useBookingFlow();
  const skin = useBookingSkin();
  const onCover = cover && skin === "agenda";
  // En monitor, el pie de cada paso va al pie del resumen de la derecha; sin resumen, en la barra de abajo.
  const { footer: bar, portal } = useAsideFooter(footer);
  const headingRef = React.useRef<HTMLDivElement>(null);
  // Al cambiar de paso el foco va al título: quien navega con lector sabe dónde está.
  React.useEffect(() => {
    if (focusTitle) headingRef.current?.focus({ preventScroll: true });
  }, [title, focusTitle]);

  const bottomBar = footer && bar && (
    // La barra va de lado a lado; lo de dentro se alinea con el contenido del paso.
    <div className="sticky bottom-0 z-sticky border-t border-border bg-surface px-5 py-3 shadow-[0_-8px_16px_-12px_hsl(var(--foreground)/0.25)]">
      <div className={cn("mx-auto w-full", STEP_WIDTH[layout], layout === "wide" && "px-3")}>{bar}</div>
    </div>
  );

  if (onCover) {
    return (
      <div className="flex flex-1 flex-col">
        <AgendaCover className="flex-1">
          <div ref={headingRef} tabIndex={-1} className="outline-none">
            <AgendaCoverTitle title={title} lead={lead} aside={aside} />
          </div>
          <div className="flex flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">{children}</div>
        </AgendaCover>
        {portal}
        {bottomBar}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className={cn("mx-auto flex w-full flex-1 flex-col gap-6 px-5 pb-6 pt-6", STEP_WIDTH[layout], layout === "wide" && "px-8 pt-8")}>
        <header className="flex items-start justify-between gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300">
          <div ref={headingRef} tabIndex={-1} className="flex min-w-0 flex-col gap-1.5 outline-none">
            <Heading level={layout === "wide" ? 2 : 3}>{title}</Heading>
            {lead && <Text tone="secondary">{lead}</Text>}
          </div>
          {aside}
        </header>
        <div className="flex flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">{children}</div>
      </div>
      {portal}
      {bottomBar}
    </div>
  );
}
