import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { ThemaIcon } from "@/icons";

interface VisitGroupProps {
  parts: number;
  onJoin: () => void;
  /** Las tarjetas de cada parte, en orden de hora. */
  children: React.ReactNode;
}

/**
 * Las partes de una misma visita (un servicio separado para otro barbero u otra hora), juntas y
 * unidas por una línea. Sin caja propia: cada parte ya es una tarjeta. «Juntar de nuevo» las
 * vuelve una sola cita.
 */
export function VisitGroup({ parts, onJoin, children }: VisitGroupProps) {
  const t = useAppT();
  return (
    <section aria-label={t("booking.visit.title", { count: parts })} className="flex flex-col gap-2">
      <div className="flex items-center gap-2 pl-1">
        <ThemaIcon name="link" size="sm" tone="primary" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Text size="sm" weight="medium" truncate>
            {t("booking.visit.title", { count: parts })}
          </Text>
          <Text size="xs" tone="muted">
            {t("booking.visit.lead")}
          </Text>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onJoin}>
          {t("booking.visit.join")}
        </Button>
      </div>
      <div className="ml-2 flex flex-col gap-3 border-l-2 border-primary/40 pl-3">{children}</div>
    </section>
  );
}
