import * as React from "react";
import { toast } from "sonner";
import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemaIcon, type IconName } from "@/icons";
import { cn } from "@/lib/utils";
import { useBookingFormat } from "../bookingFormat";
import { PROMOS, type Promo } from "../pricing";

/** Cuánto se queda el visto después de copiar. */
const COPIED_MS = 1500;
const GIFT_CODE = "REGALO-50";
const GIFT_BALANCE = 50;

interface DemoRow {
  label: string;
  /** Lo que se ve a la derecha: el dato que se escribe en la reserva. */
  value: string;
  /** Solo explica, no hay nada que copiar (el cliente nuevo: cualquier número). */
  isPlain?: boolean;
  /** Lo que se copia, si no es lo mismo que se ve (el celular, sin espacios). */
  copy?: string;
  /** La condición, cuando la hay: sin decirla parecía que el cupón no servía. */
  note?: string;
}

interface DemoGroup {
  id: string;
  title: string;
  icon: IconName;
  rows: DemoRow[];
}

/** Una fila: qué es a la izquierda; el valor, listo para copiar, a la derecha. */
function DemoValue({ row, copied, onCopy }: { row: DemoRow; copied: boolean; onCopy: (row: DemoRow) => void }) {
  const t = useAppT();
  return (
    <li className="flex items-center gap-3 py-1.5">
      <div className="flex min-w-0 flex-1 flex-col">
        <Text size="sm" weight="medium">
          {row.label}
        </Text>
        {row.note && (
          <Text size="xs" tone="muted">
            {row.note}
          </Text>
        )}
      </div>
      {!row.isPlain ? (
        <button
          type="button"
          onClick={() => onCopy(row)}
          aria-label={t("booking.preview.demoCopy", { label: row.label })}
          className={cn(
            "group flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface-subtle px-2 py-1 font-mono text-xs text-foreground transition-colors duration-fast",
            "hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            copied && "border-success/50 bg-success/10"
          )}
        >
          {row.value}
          <ThemaIcon name={copied ? "check" : "copy"} size="xs" tone={copied ? "positive" : "muted"} className={cn(!copied && "opacity-60 group-hover:opacity-100")} />
        </button>
      ) : (
        <Text size="xs" tone="secondary" className="shrink-0">
          {row.value}
        </Text>
      )}
    </li>
  );
}

/**
 * Los datos para probar la demo, agrupados: los celulares de cada tipo de
 * cliente y el código, las tarjetas, y cada cupón con su condición (uno es
 * solo para clientes nuevos y otro pide dos citas: sin decirlo parecía que no
 * servían). Cada valor se copia con un toque. Solo en la vista previa; el
 * cliente real nunca lo ve.
 */
export function DemoHints() {
  const t = useAppT();
  const fmt = useBookingFormat();
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const timer = React.useRef<number | undefined>(undefined);
  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async (row: DemoRow) => {
    try {
      await navigator.clipboard.writeText(row.copy ?? row.value);
      setCopiedKey(row.value);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopiedKey(null), COPIED_MS);
    } catch {
      // Sin permiso para el portapapeles (como «Copiar enlace»): el valor sale en un aviso para escribirlo.
      toast(row.copy ?? row.value);
    }
  };

  const promoRow = (promo: Promo): DemoRow => {
    const off = promo.type === "percent" ? `${promo.value} %` : fmt.money(promo.value);
    const note = promo.firstVisitOnly
      ? t("booking.preview.demoPromoNewNote")
      : promo.minAppointments
        ? t("booking.preview.demoPromoMinNote", { count: promo.minAppointments })
        : t("booking.preview.demoPromoAnyNote");
    return { label: t("booking.preview.demoOff", { off }), value: promo.code, note };
  };

  const groups: DemoGroup[] = [
    {
      id: "clients",
      title: t("booking.preview.demoGroupClients"),
      icon: "users",
      rows: [
        { label: t("booking.preview.demoReturning"), value: "320 217 2738", copy: "3202172738" },
        { label: t("booking.preview.demoNewClient"), value: t("booking.preview.demoAnyNumber"), isPlain: true },
        { label: t("booking.preview.demoBlockedClient"), value: "300 999 9999", copy: "3009999999" },
        { label: t("booking.preview.demoCode"), value: "246810" },
      ],
    },
    {
      id: "payments",
      title: t("booking.preview.demoGroupPay"),
      icon: "lock",
      rows: [
        { label: t("booking.preview.demoCardOk"), value: "4242 4242 4242 4242", copy: "4242424242424242" },
        { label: t("booking.preview.demoCardDeclined"), value: "4000 0000 0000 0002", copy: "4000000000000002" },
      ],
    },
    {
      id: "promos",
      title: t("booking.preview.demoGroupPromos"),
      icon: "ticket",
      rows: [
        ...PROMOS.map(promoRow),
        { label: t("booking.preview.demoGiftLabel"), value: GIFT_CODE, note: t("booking.preview.demoGiftNote", { amount: fmt.money(GIFT_BALANCE) }) },
      ],
    },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <ThemaIcon name="idea" />
          {t("booking.preview.demoTitle")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex flex-col gap-0.5 border-b border-border px-4 py-3">
          <Text weight="semibold">{t("booking.preview.demoTitle")}</Text>
          <Text size="xs" tone="muted">
            {t("booking.preview.demoLead")}
          </Text>
        </div>
        <div className="flex max-h-[min(34rem,calc(100vh-9rem))] flex-col gap-1 overflow-y-auto px-4 py-2">
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`demo-${group.id}`} className="flex flex-col pt-2">
              <Text id={`demo-${group.id}`} size="xs" weight="semibold" tone="muted" className="flex items-center gap-1.5 uppercase tracking-widest">
                <ThemaIcon name={group.icon} size="xs" />
                {group.title}
              </Text>
              <ul className="flex flex-col divide-y divide-border/60">
                {group.rows.map((row) => (
                  <DemoValue key={row.label + row.value} row={row} copied={copiedKey === row.value} onCopy={(next) => void copy(next)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
