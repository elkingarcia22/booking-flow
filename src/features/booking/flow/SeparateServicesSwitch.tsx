import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Switch } from "@/components/ui/switch";

interface SeparateServicesSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Cuántos servicios hay elegidos: el texto dice cuántas partes salen. */
  count: number;
}

/**
 * «Cada servicio con su barbero u hora»: con dos o más servicios, en vez de ir seguidos con el
 * mismo barbero, cada uno se arma como una parte de la visita. Poco frecuente: apagado de entrada.
 */
export function SeparateServicesSwitch({ checked, onCheckedChange, count }: SeparateServicesSwitchProps) {
  const t = useAppT();
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <span className="flex min-w-0 flex-1 flex-col">
        <Text as="span" size="sm" weight="medium">
          {t("booking.visit.separate")}
        </Text>
        <Text as="span" size="xs" tone="muted">
          {checked ? t("booking.visit.separateOn", { count }) : t("booking.visit.separateOff")}
        </Text>
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={t("booking.visit.separate")} />
    </label>
  );
}
