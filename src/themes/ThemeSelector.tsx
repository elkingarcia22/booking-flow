import * as React from "react";
import { Moon, Monitor, Palette, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedGroup } from "@/components/ui/segmented-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "./themeContext";
import type { DensityScale, RadiusScale, ThemeMode } from "./buildTokens";
import type { FontOption, HeadingFontId } from "./fonts";
import type { ThemePreset } from "./presets";
import { CUSTOM_THEME_ID } from "./customTheme";
import { CustomThemeEditor, type DefaultLogo } from "./CustomThemeEditor";

const MODES: readonly { id: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "light", label: "Claro", icon: Sun },
  { id: "dark", label: "Oscuro", icon: Moon },
  { id: "system", label: "Sistema", icon: Monitor },
];

const RADII: readonly { id: RadiusScale; label: string; px: number }[] = [
  { id: "none", label: "Recto", px: 0 },
  { id: "sm", label: "Suave", px: 6 },
  { id: "md", label: "Normal", px: 10 },
  { id: "lg", label: "Amplio", px: 14 },
];

const DENSITIES: readonly { id: DensityScale; label: string; gap: number }[] = [
  { id: "compact", label: "Compacta", gap: 1 },
  { id: "normal", label: "Normal", gap: 2 },
  { id: "comfortable", label: "Amplia", gap: 3 },
];

/** Muestra pequeña de un preset: el primario claro y el oscuro, en diagonal. */
export function ThemeSwatch({ preset, className }: { preset: ThemePreset; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-4 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15", className)}
      style={{
        background: `linear-gradient(135deg, ${preset.primary.light} 50%, ${preset.primary.dark} 50%)`,
      }}
    />
  );
}

function FontSelect({
  id,
  label,
  value,
  onChange,
  fonts,
  allowSame,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  fonts: readonly FontOption[];
  allowSame?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[11px] font-medium text-text-secondary">
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        {/*
          `position="popper"` en vez del `item-aligned` por defecto: solo el
          contenido posicionado por Popper lleva el atributo que globals.css
          usa para forzar `z-index: 9999` en los overlays (línea ~575). Sin
          esto, el listado de fuentes se queda con su z-index base y sale
          detrás del popover "Personalizar tema" que lo contiene.
        */}
        <SelectContent position="popper">
          {allowSame && (
            <SelectItem value="same" className="text-xs">
              Igual que el cuerpo
            </SelectItem>
          )}
          {fonts.map((font) => (
            <SelectItem key={font.id} value={font.id} className="text-xs" style={{ fontFamily: font.family }}>
              {font.name}
              <span className="ml-1.5 text-[10px] text-text-muted">{font.category === "serif" ? "serif" : ""}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export interface ThemeSelectorProps {
  /** Botón compacto (solo icono) para cabeceras estrechas. */
  compact?: boolean;
  className?: string;
}

/**
 * El cuerpo del selector: paleta de presets y modo, siempre a la vista, y
 * radio, densidad y tipografía detrás de un acordeón —se eligen una vez y no
 * se vuelven a tocar, así que no necesitan sitio fijo cada vez que se abre
 * el panel. Separado de `ThemeSelector` para poder empotrarlo en otro menú
 * —el combinado «Personalización» del shell— sin arrastrar su propio
 * disparador ni su propio Popover.
 *
 * Sin `<div>` propio a propósito: sus secciones (Color, Modo, el acordeón)
 * salen como hermanas directas de quien lo monta, para que el `space-y-*`
 * de ese contenedor las espacie a todas por igual. Envolverlas aquí en su
 * propio `space-y` duplicaba el hueco alrededor de cualquier divisor que el
 * contenedor metiera entre medio —el de «Personalización», antes de
 * Idioma— y el ritmo dejaba de ser parejo.
 */
export function ThemeSelectorPanel({
  /**
   * Radio, densidad y tipografía: se eligen una vez al montar el negocio, no
   * en el día a día. `Personalización`, que sí es de todos los días, las
   * apaga; el selector completo (`ThemeSelector`) las deja encendidas.
   */
  advanced = true,
  logoSrc,
  defaultLogo,
}: {
  advanced?: boolean;
  /** El logo de la barbería: en «Personalizado» se le leen los colores para proponerlos. */
  logoSrc?: string | null;
  /** El logo que se ve sin uno propio (colores e IA); «Personalizado» lo propone. */
  defaultLogo?: DefaultLogo;
}) {
  const { preset, presets, setPreset, customColors, mode, setMode, radius, setRadius, density, setDensity, font, setFont, headingFont, setHeadingFont, fonts } = useTheme();

  const isCustom = preset.id === CUSTOM_THEME_ID;

  return (
    <>
      {/* `min-w-0`: un fieldset no encoge por debajo de su contenido y, con el editor
          de «Personalizado» abierto, desbordaba el panel. */}
      <fieldset className="min-w-0 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <legend className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Color</legend>
          <span className="truncate text-[11px] font-medium text-text-secondary">{preset.name}</span>
        </div>
        {/* Solo la pastilla, sin el nombre de cada una: con una docena de presets, la
            versión con nombre ocupaba siete filas. El nombre se lee en el
            tooltip y, del activo, en la etiqueta de arriba. */}
        <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-2">
          {presets.map((item) => {
            const active = item.id === preset.id;
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={item.name}
                    onClick={() => setPreset(item.id)}
                    className={cn(
                      "relative flex size-7 shrink-0 items-center justify-center rounded-full p-0.5 ring-2 ring-transparent transition-all",
                      "hover:scale-110 focus-visible:outline-none focus-visible:ring-primary/60",
                      active ? "ring-primary" : "hover:ring-border-strong/60"
                    )}
                  >
                    <ThemeSwatch preset={item} className="size-full" />
                    {item.tier === "premium" && (
                      <span
                        aria-hidden
                        className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-brand-gradient ring-2 ring-surface"
                      />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{item.description}</TooltipContent>
              </Tooltip>
            );
          })}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="radio"
                aria-checked={isCustom}
                aria-label="Personalizado"
                data-testid="theme-custom"
                onClick={() => setPreset(CUSTOM_THEME_ID)}
                className={cn(
                  "relative flex size-7 shrink-0 items-center justify-center rounded-full p-0.5 ring-2 ring-transparent transition-all",
                  "hover:scale-110 focus-visible:outline-none focus-visible:ring-primary/60",
                  isCustom ? "ring-primary" : "hover:ring-border-strong/60"
                )}
              >
                <span
                  aria-hidden
                  className="block size-full rounded-full ring-1 ring-black/10 dark:ring-white/15"
                  style={{ background: `linear-gradient(135deg, ${customColors.primary} 50%, ${customColors.secondary} 50%)` }}
                />
                {/* El arcoíris dice «elige el tuyo», como el premium dice «acabado». */}
                <span
                  aria-hidden
                  className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-surface"
                  style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Tus colores: elige primario y secundario, o tómalos de tu logo.</TooltipContent>
          </Tooltip>
        </div>
        {isCustom && <CustomThemeEditor logoSrc={logoSrc} defaultLogo={defaultLogo} />}
      </fieldset>

      <SegmentedGroup
        label="Modo"
        value={mode}
        onChange={setMode}
        options={MODES.map((item) => ({ id: item.id, label: item.label, render: <item.icon className="size-3.5" /> }))}
      />

      {advanced && (
        <Accordion type="single" collapsible className="border-t border-border/60">
          <AccordionItem value="advanced" className="border-none">
            <AccordionTrigger className="rounded-none py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-text-primary hover:no-underline focus-visible:border-transparent focus-visible:after:border-transparent">
              Más ajustes
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-1 pt-1">
              <SegmentedGroup
                label="Radio"
                value={radius}
                onChange={setRadius}
                options={RADII.map((item) => ({
                  id: item.id,
                  label: item.label,
                  render: (
                    <span
                      aria-hidden
                      className="block size-3.5 border-l-2 border-t-2 border-current"
                      style={{ borderTopLeftRadius: item.px }}
                    />
                  ),
                }))}
              />

              <SegmentedGroup
                label="Densidad"
                value={density}
                onChange={setDensity}
                options={DENSITIES.map((item) => ({
                  id: item.id,
                  label: item.label,
                  render: (
                    <span aria-hidden className="flex flex-col" style={{ gap: item.gap }}>
                      <span className="block h-0.5 w-3.5 rounded-full bg-current" />
                      <span className="block h-0.5 w-3.5 rounded-full bg-current" />
                      <span className="block h-0.5 w-3.5 rounded-full bg-current" />
                    </span>
                  ),
                }))}
              />

              <fieldset className="space-y-2">
                <legend className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Tipografía</legend>
                <div className="grid grid-cols-2 gap-2">
                  <FontSelect id="theme-font-body" label="Cuerpo" value={font} onChange={(value) => setFont(value as FontOption["id"])} fonts={fonts} />
                  <FontSelect
                    id="theme-font-heading"
                    label="Títulos"
                    value={headingFont}
                    onChange={(value) => setHeadingFont(value as HeadingFontId)}
                    fonts={fonts}
                    allowSame
                  />
                </div>
                <p className="text-[11px] leading-snug text-text-muted" style={{ fontFamily: "var(--font-heading)" }}>
                  Los títulos se ven así. <span style={{ fontFamily: "var(--font-body)" }}>Y el cuerpo, así.</span>
                </p>
              </fieldset>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </>
  );
}

/**
 * El selector de tema: el disparador de siempre, con `ThemeSelectorPanel`
 * dentro de su propio Popover. Todo se aplica al instante y queda guardado en
 * localStorage a través del provider.
 */
export function ThemeSelector({ compact = false, className }: ThemeSelectorProps) {
  const { preset } = useTheme();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size={compact ? "icon" : "default"} className={cn("gap-2", className)} aria-label="Cambiar tema">
          <Palette />
          {!compact && (
            <>
              <span className="hidden sm:inline">{preset.name}</span>
              <ThemeSwatch preset={preset} className="size-3.5" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] space-y-5 rounded-2xl p-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-text-primary">Personalizar tema</p>
          <p className="text-xs text-text-secondary">Los cambios se aplican a toda la interfaz y se recuerdan en este navegador.</p>
        </div>
        <ThemeSelectorPanel />
      </PopoverContent>
    </Popover>
  );
}

/** Conmutador rápido claro ⇄ oscuro, para ponerlo al lado del selector. */
export function ThemeModeToggle({ className }: { className?: string }) {
  const { resolvedMode, setMode } = useTheme();
  const next: ThemeMode = resolvedMode === "dark" ? "light" : "dark";
  const Icon = resolvedMode === "dark" ? Sun : Moon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className={className} onClick={() => setMode(next)} aria-label={`Cambiar a modo ${next === "dark" ? "oscuro" : "claro"}`}>
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{resolvedMode === "dark" ? "Modo claro" : "Modo oscuro"}</TooltipContent>
    </Tooltip>
  );
}
