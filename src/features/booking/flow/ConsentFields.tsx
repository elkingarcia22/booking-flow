import * as React from "react";
import { ChevronDown } from "lucide-react";
import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { ThemaIcon } from "@/icons";
import { cn } from "@/lib/utils";
import { useConsentPack } from "./consentPack";

export interface ConsentFieldsProps {
  id: string;
  marketing: boolean;
  onMarketingChange: (value: boolean) => void;
}

/**
 * El permiso de promociones y el aviso de privacidad con el texto del país de la sede: la casilla empieza sin
 * marcar, lo que implica marcarla va al lado y el aviso completo se abre aquí mismo.
 */
export function ConsentFields({ id, marketing, onMarketingChange }: ConsentFieldsProps) {
  const t = useAppT();
  const pack = useConsentPack();
  const [open, setOpen] = React.useState(false);
  return (
    <div className="space-y-3" data-testid="booking-consent" data-version={pack.version}>
      <div className="flex items-start gap-3">
        <Checkbox id={id} checked={marketing} onCheckedChange={(checked) => onMarketingChange(checked === true)} className="mt-0.5" />
        <div className="space-y-1">
          <Label htmlFor={id} className="font-normal leading-snug">
            {pack.marketingLabel}
          </Label>
          <Text size="xs" tone="muted">
            {pack.marketingDisclosure}
          </Text>
        </div>
      </div>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Text size="xs" tone="muted" className="flex items-center gap-1.5">
            <ThemaIcon name="lock" size="xs" />
            {pack.privacyShort}
          </Text>
          <CollapsibleTrigger className="inline-flex items-center gap-1 rounded text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" data-testid="booking-privacy-toggle">
            {t("booking.profile.privacyMore")}
            <ChevronDown className={cn("size-3 transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="mt-2 space-y-1.5 rounded-lg bg-surface-subtle p-3">
          {pack.privacyNotice.map((paragraph) => (
            <Text key={paragraph} size="xs" tone="secondary">
              {paragraph}
            </Text>
          ))}
          <a href={pack.policyHref} target="_blank" rel="noreferrer" className="inline-block text-xs font-medium text-primary underline-offset-2 hover:underline" data-testid="booking-privacy-policy">
            {t("legal.booking.policy")}
          </a>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
