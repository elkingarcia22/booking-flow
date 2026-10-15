import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { initialsOf } from "../bookingFormat";

export interface AppointmentCardData {
  personName: string;
  relation?: string | null;
  services: readonly string[];
  barberName: string | null;
  barberAvatarUrl?: string | null;
  /** El día ya formateado: «vie, 9 de oct». */
  day: string;
  /** La hora ya formateada: «9:00 a. m.». */
  time: string;
  duration: string;
  price: string;
  branchName?: string;
}

interface AppointmentCardProps {
  data: AppointmentCardData;
  /** Estado o etiqueta arriba a la derecha (Confirmada, Pagada…). */
  status?: React.ReactNode;
  actions?: React.ReactNode;
  /** Lo que va al final de la fila «Para» (cambiar para quién es, en el resumen). */
  personAction?: React.ReactNode;
  /** Atenuada: cancelada o pasada. */
  muted?: boolean;
  /**
   * Con dos o más servicios, cada uno trae «Separar»: sale a una parte propia de la visita, con
   * otro barbero u otra hora. Recibe la posición del servicio en `data.services`.
   */
  onSplitService?: (position: number) => void;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-center gap-3">
      <Text size="xs" tone="muted" as="dt">
        {label}
      </Text>
      <dd className="flex min-w-0 items-center gap-2">{children}</dd>
    </div>
  );
}

/**
 * Una cita como la lee el cliente, la misma en el resumen, en la confirmación
 * y en «Mis citas». Cuándo arriba y grande —es lo que se busca—; debajo, en
 * filas con su etiqueta, qué se hace, para quién y con quién; abajo el precio
 * y lo que se puede hacer con ella.
 */
export function AppointmentCard({ data, status, actions, personAction, muted = false, onSplitService }: AppointmentCardProps) {
  const t = useAppT();
  return (
    <article className={cn("flex flex-col rounded-2xl border border-border bg-surface shadow-xs", muted && "opacity-60")}>
      <header className="flex items-center gap-3 p-4">
        <IconTile size="lg" icon={<ThemaIcon name="calendar" />} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Text weight="semibold" className="first-letter:uppercase" truncate>
            {data.day}
          </Text>
          <Text size="sm" tone="secondary" tabular truncate>
            {data.time} · {data.duration}
          </Text>
        </div>
        {status}
      </header>

      <dl className="flex flex-col gap-2.5 border-t border-border px-4 py-3">
        <DetailRow label={t("booking.card.services")}>
          {onSplitService && data.services.length > 1 ? (
            <ul className="flex min-w-0 flex-1 flex-col gap-1">
              {data.services.map((name, position) => (
                <li key={name} className="flex items-center gap-2">
                  <Text size="sm" weight="medium" className="min-w-0 flex-1" truncate>
                    {name}
                  </Text>
                  <Button type="button" variant="link" size="sm" className="h-auto shrink-0 px-0" onClick={() => onSplitService(position)} aria-label={t("booking.visit.splitAria", { service: name })}>
                    {t("booking.visit.split")}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <Text size="sm" weight="medium">
              {data.services.join(" + ")}
            </Text>
          )}
        </DetailRow>
        <DetailRow label={t("booking.card.for")}>
          {/* Una sola línea: el nombre y, en gris, la relación; la acción a la derecha sin empujarlos. */}
          <Text size="sm" className="min-w-0 flex-1" truncate>
            {data.personName}
            {data.relation && (
              <Text as="span" size="sm" tone="muted">
                {` · ${data.relation}`}
              </Text>
            )}
          </Text>
          {personAction && <span className="-my-1 shrink-0">{personAction}</span>}
        </DetailRow>
        <DetailRow label={t("booking.card.barber")}>
          {data.barberAvatarUrl || data.barberName ? (
            <Avatar size="sm">
              {data.barberAvatarUrl && <AvatarImage src={data.barberAvatarUrl} alt="" />}
              <AvatarFallback>{initialsOf(data.barberName ?? "")}</AvatarFallback>
            </Avatar>
          ) : null}
          <Text size="sm" truncate>
            {data.barberName}
          </Text>
        </DetailRow>
        {data.branchName && (
          <DetailRow label={t("booking.card.branch")}>
            <Text size="sm" truncate>
              {data.branchName}
            </Text>
          </DetailRow>
        )}
      </dl>

      <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5">
        <Text weight="semibold" tabular>
          {data.price}
        </Text>
        {actions && <div className="-mr-2 flex items-center gap-1">{actions}</div>}
      </footer>
    </article>
  );
}
