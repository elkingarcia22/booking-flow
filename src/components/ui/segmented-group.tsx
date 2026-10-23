import * as React from "react";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/selection/SegmentedControl";

export interface SegmentedGroupOption<T extends string> {
  id: T;
  label: string;
  render?: React.ReactNode;
}

export interface SegmentedGroupProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedGroupOption<T>[];
  /** Una línea bajo el control que explica la opción elegida. */
  hint?: React.ReactNode;
  className?: string;
  "data-testid"?: string;
}

/**
 * Un ajuste del cromo (menús del marco y selector de tema): la etiqueta en
 * versalitas de 11px —la escala propia del marco, ver Fundamentos › Tipografía—
 * sobre el `SegmentedControl` del sistema a todo el ancho. El control es el
 * mismo de las pantallas: aquí solo cambia la etiqueta. Modo, idioma, radio,
 * densidad y dónde van las acciones se eligen así.
 */
export function SegmentedGroup<T extends string>({ label, value, onChange, options, hint, className, "data-testid": testId }: SegmentedGroupProps<T>) {
  const segments = React.useMemo(
    () =>
      options.map((option) => ({
        value: option.id,
        label: option.label,
        icon: option.render ? () => <>{option.render}</> : undefined,
      })),
    [options]
  );

  return (
    // `min-w-0`: un fieldset no encoge por debajo de su contenido y desbordaba los paneles estrechos.
    <fieldset className={cn("min-w-0 space-y-2", className)} data-testid={testId}>
      <legend className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</legend>
      <SegmentedControl fullWidth ariaLabel={label} options={segments} value={value} onChange={(next) => onChange(next as T)} />
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </fieldset>
  );
}
