import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ColorPicker, type ColorPickerSwatch } from "@/components/forms/ColorPicker";
import { Button } from "@/components/ui/button";
import { ThemaIcon } from "@/icons";
import { SegmentedGroup } from "@/components/ui/segmented-group";
import { useTheme } from "./themeContext";
import { extractLogoPalette, proposeAiColors, proposeBrandColors } from "./logoPalette";
import { automaticAiColors, buildCustomPreset, type AiColors, type CustomColors } from "./customTheme";

type Slot = "primary" | "secondary" | "ai";
type AiSlot = "start" | "end";

/** Los colores del logo, leídos una vez por logo (la consulta los guarda mientras dure la sesión). */
function useLogoPalette(logoSrc: string | null | undefined) {
  return useQuery({
    queryKey: ["logo-palette", logoSrc],
    queryFn: () => extractLogoPalette(logoSrc as string),
    enabled: Boolean(logoSrc),
    staleTime: Infinity,
    retry: false,
  });
}

function Dot({ color }: { color: string }) {
  return <span aria-hidden className="size-3 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15" style={{ backgroundColor: color }} />;
}

/** Una muestra del degradado de IA, para la pestaña y la propuesta. */
function AiDot({ ai }: { ai: AiColors }) {
  return (
    <span
      aria-hidden
      className="size-3 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15"
      style={{ background: `linear-gradient(135deg, ${ai.start}, ${ai.end})` }}
    />
  );
}

const sameAi = (a: AiColors | undefined, b: AiColors | undefined) =>
  Boolean(a && b && a.start === b.start && a.end === b.end && (a.stops ?? []).join() === (b.stops ?? []).join());

export interface CustomThemeEditorProps {
  /** El logo propio de la barbería, si subió uno: se le leen los colores. */
  logoSrc?: string | null;
  /** El logo que se ve cuando no hay uno propio (el de Barberlytics): sus colores y su IA. */
  defaultLogo?: DefaultLogo;
}

export interface DefaultLogo {
  colors: readonly string[];
  /** Su degradado de IA; sin él se propone uno desde `colors`. */
  ai?: AiColors;
}

/** El texto junto a la propuesta, según de dónde sale y si ya está aplicada. */
function proposalLabel({ isDefault, singleColor, applied }: { isDefault: boolean; singleColor: boolean; applied: boolean }): string {
  if (isDefault) return applied ? "Usas los colores de Barberlytics." : "Los de Barberlytics, tu logo por defecto, con su IA.";
  if (singleColor) return applied ? "Tu color, un tono suyo y su IA." : "Un color: lo combinamos con un tono suyo y su IA.";
  return applied ? "Estás usando los colores de tu logo." : "Tu logo propone estos colores y su IA.";
}

/**
 * El degradado de IA: automático (del primario al secundario) o elegido a mano, con su
 * inicio y su fin. Lo que se toca aquí solo cambia la IA; marca y botones siguen igual.
 */
function AiColorsEditor({ swatches, value: customColors, onChange: setCustomColors }: { swatches: readonly ColorPickerSwatch[] } & ColorsControl) {
  const preset = React.useMemo(() => buildCustomPreset(customColors), [customColors]);
  const [part, setPart] = React.useState<AiSlot>("start");
  const isAutomatic = !customColors.ai;
  const current = customColors.ai ?? automaticAiColors(customColors);
  const stops = preset.ai?.stops ?? [current.start, current.end];

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div aria-hidden className="h-3 w-full rounded-full" style={{ background: `linear-gradient(90deg, ${stops.join(", ")})` }} />
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-xs leading-snug text-text-secondary">
            {isAutomatic ? "Automático: va del primario al secundario." : "Elegido por ti. Se ve en el asistente y en todo lo de IA."}
          </span>
          {!isAutomatic && (
            <Button size="sm" variant="ghost" onClick={() => setCustomColors({ primary: customColors.primary, secondary: customColors.secondary })}>
              Automático
            </Button>
          )}
        </div>
      </div>

      <SegmentedGroup<AiSlot>
        label="Degradado de IA"
        value={part}
        onChange={setPart}
        options={[
          { id: "start", label: "Inicio", render: <Dot color={current.start} /> },
          { id: "end", label: "Fin", render: <Dot color={current.end} /> },
        ]}
      />

      <ColorPicker
        key={`ai-${part}`}
        label={part === "start" ? "Inicio del degradado de IA" : "Fin del degradado de IA"}
        value={current[part]}
        // Al mover un extremo, las paradas fijas (las de «Forja») ya no casan: se vuelven a interpolar.
        onChange={(color) => setCustomColors({ ...customColors, ai: { start: current.start, end: current.end, [part]: color } })}
        swatches={swatches}
        swatchesLabel="Sugeridos"
      />
    </div>
  );
}

/** Un editor controlado: recibe los colores y avisa cada cambio. */
interface ColorsControl {
  value: CustomColors;
  onChange: (colors: CustomColors) => void;
}

/**
 * «Personalizado» de la Personalización: el mismo editor sobre los colores guardados en
 * este navegador, que se aplican al instante.
 */
export function CustomThemeEditor(props: CustomThemeEditorProps) {
  const { customColors, setCustomColors } = useTheme();
  return <CustomColorsEditor {...props} value={customColors} onChange={setCustomColors} />;
}

/**
 * El primario, el secundario y el degradado de IA, elegidos en el espectro o propuestos a
 * partir del logo —el propio o, si no hay uno, el de Barberlytics—. Controlado: lo usan la
 * Personalización (colores de este navegador) y la apariencia de la reserva en línea
 * (colores guardados en la barbería).
 */
export function CustomColorsEditor({ logoSrc, defaultLogo, value: customColors, onChange: setCustomColors }: CustomThemeEditorProps & ColorsControl) {
  const preset = React.useMemo(() => buildCustomPreset(customColors), [customColors]);
  const [slot, setSlot] = React.useState<Slot>("primary");
  const logo = useLogoPalette(logoSrc);
  const isDefault = !logoSrc;
  const logoColors = isDefault ? (defaultLogo?.colors ?? []) : (logo.data ?? []);
  const logoAi = isDefault && defaultLogo?.ai ? defaultLogo.ai : null;
  const proposal = logoColors.length > 0 ? { ...proposeBrandColors(logoColors), ai: logoAi ?? proposeAiColors(logoColors) } : null;
  const proposalApplied =
    proposal && proposal.primary === customColors.primary && proposal.secondary === customColors.secondary && sameAi(proposal.ai, customColors.ai);

  const logoSwatches = logoColors.map((color) => ({ color, label: `Del logo: ${color}` }));
  const swatchesLabel = isDefault ? "Colores de Barberlytics" : "Colores de tu logo";
  const chosen = slot === "ai" ? null : customColors[slot];
  // El primario se aclara u oscurece para leerse en cada modo; se avisa para que no sorprenda.
  const adjusted = slot === "primary" && chosen !== null && preset.primary.light !== chosen.toUpperCase() && preset.primary.dark !== chosen.toUpperCase();
  const currentAi = customColors.ai ?? automaticAiColors(customColors);

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-surface-subtle p-3">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Desde tu logo</p>
        {!isDefault && logo.isPending && <p className="text-xs text-text-secondary">Leyendo los colores del logo…</p>}
        {!isDefault && logo.isError && <p className="text-xs text-text-secondary">{logo.error.message} Elige los colores a mano.</p>}
        {!isDefault && logo.isSuccess && !proposal && <p className="text-xs text-text-secondary">Tu logo no tiene color (es blanco, negro o gris): elige los tuyos.</p>}
        {proposal && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Dot color={proposal.primary} />
              <Dot color={proposal.secondary} />
              <AiDot ai={proposal.ai} />
            </span>
            {/* Sin `truncate`: con el botón al lado el texto cabe en dos líneas, no a medias. */}
            <span className="min-w-0 flex-1 text-xs leading-snug text-text-secondary">
              {proposalLabel({ isDefault, singleColor: proposal.singleColor, applied: Boolean(proposalApplied) })}
            </span>
            {!proposalApplied && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCustomColors({ primary: proposal.primary, secondary: proposal.secondary, ai: proposal.ai })}>
                <ThemaIcon name="sparkles" size="xs" />
                Usarlos
              </Button>
            )}
          </div>
        )}
      </div>

      <SegmentedGroup<Slot>
        label="Editar"
        value={slot}
        onChange={setSlot}
        options={[
          { id: "primary", label: "Primario", render: <Dot color={customColors.primary} /> },
          { id: "secondary", label: "Secundario", render: <Dot color={customColors.secondary} /> },
          { id: "ai", label: "IA", render: <AiDot ai={currentAi} /> },
        ]}
        hint={
          slot === "primary"
            ? "Botones, enlaces y la marca."
            : slot === "secondary"
              ? "Cierra el degradado de marca."
              : "El asistente, las sugerencias y todo lo que hace la IA."
        }
      />

      {slot === "ai" ? (
        <AiColorsEditor
          value={customColors}
          onChange={setCustomColors}
          swatches={[...logoSwatches, ...(proposal ? [proposal.ai.start, proposal.ai.end].map((color) => ({ color, label: `IA del logo: ${color}` })) : [])]}
        />
      ) : (
        <ColorPicker
          key={slot}
          label={slot === "primary" ? "Color primario" : "Color secundario"}
          value={chosen ?? customColors.primary}
          onChange={(color) => setCustomColors({ ...customColors, [slot]: color })}
          swatches={logoSwatches}
          swatchesLabel={swatchesLabel}
        />
      )}

      {adjusted && (
        <p className="text-[11px] leading-snug text-text-muted">Lo aclaramos u oscurecemos un poco en cada modo para que el texto se lea sobre el fondo.</p>
      )}
    </div>
  );
}
