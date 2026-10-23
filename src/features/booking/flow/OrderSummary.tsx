import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Separator } from "@/components/ui/separator";
import type { Totals } from "../pricing";

export interface OrderLine {
  id: string;
  label: string;
  detail?: string;
  amount: number;
}

interface OrderSummaryProps {
  totals: Totals;
  money: (value: number) => string;
  /** El detalle: una línea por cita y por producto. Sin él, solo los subtotales. */
  lines?: readonly OrderLine[];
  promoCode?: string | null;
}

/** «Tu orden»: lo comprado, el descuento, el impuesto, la propina, los cargos (recargo por tarjeta) y el total, como un ticket. */
export function OrderSummary({ totals, money, lines, promoCode }: OrderSummaryProps) {
  const t = useAppT();
  const row = (label: string, amount: number, tone: "default" | "positive" = "default") => (
    <div className="flex items-center justify-between gap-3">
      <Text size="sm" tone={tone === "positive" ? "positive" : "secondary"}>
        {label}
      </Text>
      <Text size="sm" tabular tone={tone === "positive" ? "positive" : "default"}>
        {tone === "positive" ? `−${money(amount)}` : money(amount)}
      </Text>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {lines && lines.length > 0 && (
        <>
          {lines.map((line) => (
            <div key={line.id} className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <Text size="sm" weight="medium" truncate>
                  {line.label}
                </Text>
                {line.detail && (
                  <Text size="xs" tone="muted" truncate>
                    {line.detail}
                  </Text>
                )}
              </div>
              <Text size="sm" tabular>
                {money(line.amount)}
              </Text>
            </div>
          ))}
          <Separator className="my-1" />
        </>
      )}
      {!lines && row(t("booking.payment.services"), totals.services)}
      {!lines && totals.products > 0 && row(t("booking.payment.products"), totals.products)}
      {totals.prepaid > 0 && row(t("booking.packages.line"), totals.prepaid, "positive")}
      {totals.reward > 0 && row(t("booking.loyalty.line"), totals.reward, "positive")}
      {totals.discount > 0 && row(promoCode ? `${t("booking.payment.discount")} · ${promoCode}` : t("booking.payment.discount"), totals.discount, "positive")}
      {row(t("booking.payment.subtotal"), totals.subtotal)}
      {row(t(totals.taxIncluded ? "booking.payment.taxIncluded" : "booking.payment.tax"), totals.tax)}
      {totals.tip > 0 && row(t("booking.payment.tipLine"), totals.tip)}
      {totals.fee > 0 && row(totals.feeName ?? t("booking.payment.fee"), totals.fee)}
      {totals.gift > 0 && row(t("booking.gift.line"), totals.gift, "positive")}
      <Separator className="my-1" />
      <div className="flex items-center justify-between gap-3">
        <Text weight="semibold">{t("booking.payment.total")}</Text>
        <Text size="lg" weight="bold" tabular>
          {money(totals.total)}
        </Text>
      </div>
    </div>
  );
}
