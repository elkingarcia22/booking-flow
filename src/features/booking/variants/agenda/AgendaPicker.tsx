import * as React from "react";
import { useAppT } from "@/app/i18n";
import { DrawerShell } from "@/components/overlays";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon, type IconName } from "@/icons";
import { cn } from "@/lib/utils";
import { useBookingFlow } from "../../flow/BookingContext";
import { DRAWER_FIT_STYLE, sheetSide } from "../../flow/drawerFit";

/**
 * Las dos piezas de la Agenda con selector: un campo que se lee como un select
 * (foto, lo elegido y un detalle) y la ventana que abre la lista. La sede y los
 * servicios las comparten para verse y comportarse igual.
 */

interface PickerFieldProps {
  /** El id del rótulo de la sección: el campo se anuncia como «rótulo + valor». */
  labelledBy: string;
  imageUrl?: string | null;
  icon: IconName;
  /** Foto redonda: es una persona. */
  round?: boolean;
  /** Lo elegido; sin él se ve el `placeholder`. */
  value?: string;
  detail?: string;
  placeholder: string;
  open: boolean;
  onOpen: () => void;
  testId?: string;
  /** Tarjeta (los campos de sede, servicio y barbero van en fila); si no, fila de siempre. */
  asCard?: boolean;
  /** El nombre del campo dentro de la fila («Sede»), cuando no lleva título encima (celular). */
  eyebrow?: string;
}

export function PickerField({ labelledBy, imageUrl, icon, round = false, value, detail, placeholder, open, onOpen, testId, asCard = false, eyebrow }: PickerFieldProps) {
  const { touch, layout } = useBookingFlow();
  const valueId = React.useId();
  // Tarjeta solo donde caben en fila (tablet y monitor); en celular, la fila de siempre.
  const isDense = asCard && (layout === "wide" || touch === "lg");
  // Donde la lista entra por el lado (tablet y monitor), la flecha apunta hacia allá.
  const opensAside = sheetSide({ layout, touch }) === "right";
  const arrow = opensAside ? (
    <ThemaIcon name="chevronRight" size="sm" tone="muted" className="shrink-0 transition-transform duration-fast group-hover:translate-x-0.5" />
  ) : (
    <ThemaIcon name="chevronDown" size="sm" tone="muted" className="shrink-0 transition-transform duration-fast group-aria-expanded:rotate-180" />
  );
  const base = cn(
    // Fondo de tarjeta, no de página: en claro el campo se despegaba del fondo solo por un filo.
    "group w-full rounded-xl border border-input bg-surface text-left shadow-xs outline-none transition-[border-color,box-shadow] duration-fast",
    "hover:border-primary/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
  );

  // Como tarjetas, una al lado de la otra: foto arriba y el texto debajo, a dos líneas.
  if (isDense) {
    return (
      <button type="button" aria-haspopup="dialog" aria-expanded={open} aria-labelledby={`${labelledBy} ${valueId}`} onClick={onOpen} data-testid={testId} className={cn(base, "flex h-full flex-col", layout === "wide" ? "gap-3 p-3" : "gap-2 p-2.5")}>
        <span className="flex w-full items-start justify-between gap-2">
          <IconTile size={layout === "wide" ? "md" : "sm"} shape={round ? "circle" : "rounded"} src={imageUrl ?? undefined} icon={<ThemaIcon name={icon} />} tone={value ? "primary" : "neutral"} />
          {arrow}
        </span>
        <span id={valueId} className="flex w-full min-w-0 flex-col">
          {eyebrow && (
            <Text as="span" size="xs" tone="muted" className="truncate">
              {eyebrow}
            </Text>
          )}
          {/* En tarjetas angostas, las palabras largas («Massachusetts») parten en vez de cortarse. */}
          <Text as="span" size="sm" weight="medium" tone={value ? "default" : "muted"} className="line-clamp-2 hyphens-auto [overflow-wrap:anywhere]" lang="es">
            {value ?? placeholder}
          </Text>
          {value && detail && (
            <Text as="span" size="xs" tone="muted" tabular className="line-clamp-2 [overflow-wrap:anywhere]">
              {detail}
            </Text>
          )}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-labelledby={`${labelledBy} ${valueId}`}
      onClick={onOpen}
      data-testid={testId}
      className={cn(base, "flex items-center gap-3 px-3", touch === "lg" ? "min-h-[4.5rem] py-3" : "min-h-16 py-2.5")}
    >
      <IconTile size={touch === "lg" ? "lg" : "md"} shape={round ? "circle" : "rounded"} src={imageUrl ?? undefined} icon={<ThemaIcon name={icon} />} tone={value ? "primary" : "neutral"} />
      <span id={valueId} className="flex min-w-0 flex-1 flex-col">
        {eyebrow && (
          <Text as="span" size="xs" tone="muted" className="truncate">
            {eyebrow}
          </Text>
        )}
        {value ? (
          <>
            <Text as="span" weight="medium" className="truncate">
              {value}
            </Text>
            {detail && (
              <Text as="span" size="xs" tone="muted" tabular className="truncate">
                {detail}
              </Text>
            )}
          </>
        ) : (
          <Text as="span" tone="muted">
            {placeholder}
          </Text>
        )}
      </span>
      {arrow}
    </button>
  );
}

interface PickerOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** El pie fijo (resumen y botón); sin él, la ventana es solo la lista. */
  footer?: React.ReactNode;
  /** Dónde cae el foco al abrir: la lista, no un buscador (en táctil el teclado la taparía). */
  focusRef: React.RefObject<HTMLElement | null>;
  /**
   * Para navegar dentro de la ventana (la lista → el perfil de uno): con
   * `onBack` la cabecera muestra «Volver», y al cambiar `view` el contenido
   * vuelve arriba y el foco pasa a «Volver» o, de regreso, a la lista.
   */
  view?: string;
  onBack?: () => void;
  /** Foto o avatar junto al título (el de la sede o el barbero que se mira). */
  leading?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Se abre donde se siente nativa en cada pantalla: en celular y en el widget
 * sube desde abajo, al alcance del pulgar; en tablet y monitor es un modal
 * centrado (una hoja a lo ancho de una tablet se ve estirada). En los dos casos
 * dentro de la reserva —el marco del dispositivo—, no de la ventana.
 */
export function PickerOverlay({ open, onOpenChange, title, description, footer, focusRef, view = "list", onBack, leading, children }: PickerOverlayProps) {
  const t = useAppT();
  const { layout, touch } = useBookingFlow();
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const backRef = React.useRef<HTMLButtonElement>(null);
  const isDetail = Boolean(onBack);

  const focusSelected = () => {
    const list = focusRef.current;
    const target = list?.querySelector<HTMLElement>('[aria-checked="true"]') ?? list?.querySelector<HTMLElement>("[role=checkbox],[role=radio]");
    target?.focus();
  };
  const focusList = (event: Event) => {
    event.preventDefault();
    focusSelected();
  };

  // Al pasar de la lista a un perfil (o volver) se arranca desde arriba y el foco no se queda en un botón que ya no está.
  const shownView = React.useRef(view);
  React.useEffect(() => {
    if (view === shownView.current) return;
    shownView.current = view;
    const scroller = bodyRef.current?.parentElement;
    if (scroller) scroller.scrollTop = 0;
    if (isDetail) backRef.current?.focus();
    else focusSelected();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar de vista
  }, [view]);

  const heading = (
    <span className="flex min-w-0 items-center gap-2">
      {onBack && (
        <Button ref={backRef} type="button" variant="ghost" size="icon-sm" onClick={onBack} aria-label={t("common.back")} className="-ml-1 shrink-0">
          <ThemaIcon name="arrowLeft" />
        </Button>
      )}
      {leading && <span className="shrink-0">{leading}</span>}
    </span>
  );
  const hasHeading = Boolean(onBack || leading);
  const content = (
    <div
      key={view}
      ref={bodyRef}
      // El perfil entra desde el lado, como una pantalla que se apila; la lista solo aparece.
      className={cn("flex flex-col", isDetail && "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-4 motion-safe:duration-200")}
    >
      {children}
    </div>
  );

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      side={sheetSide({ layout, touch })}
      contentStyle={DRAWER_FIT_STYLE}
      title={title}
      description={description}
      leading={hasHeading ? heading : undefined}
      actions={footer}
      onOpenAutoFocus={focusList}
      disablePadding
    >
      {content}
    </DrawerShell>
  );
}

interface PickerRowProps {
  role: "checkbox" | "radio";
  checked: boolean;
  label: string;
  imageUrl?: string | null;
  icon: IconName;
  /** Foto redonda: es una persona. */
  round?: boolean;
  onClick: () => void;
  /** «Ver perfil» / «Ver detalle»: un botón al lado (un botón no va dentro de otro). */
  action?: { label: string; ariaLabel: string; onClick: () => void };
  /** Algo más debajo del texto, dentro de la tarjeta (la cantidad de un producto elegido). */
  below?: React.ReactNode;
  children: React.ReactNode;
}

/** Una fila de la lista: foto, texto y la marca (casilla si se pueden varios, círculo si uno). */
export function PickerRow({ role, checked, label, imageUrl, icon, round = false, onClick, action, below, children }: PickerRowProps) {
  const { touch } = useBookingFlow();
  const isLarge = touch === "lg";
  const hasBelow = Boolean(action || below);
  // El fondo (pasar el puntero, lo elegido) es de la tarjeta entera: con «Ver detalle» debajo, lo cubre también.
  // `foreground/5` aclara en oscuro y oscurece en claro: `bg-muted` sobre el popover se veía como un hueco negro.
  const surface = cn("rounded-xl transition-colors duration-fast hover:bg-foreground/5", checked && "bg-primary/10 hover:bg-primary/15");
  const row = (
    <button
      type="button"
      role={role}
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "group/row flex w-full min-w-0 items-center gap-3 rounded-xl px-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        !hasBelow && surface,
        !hasBelow && "active:bg-foreground/10",
        isLarge ? "min-h-16 py-2.5" : "min-h-14 py-2",
        hasBelow && "pb-1"
      )}
    >
      <IconTile size={isLarge ? "lg" : "md"} shape={round ? "circle" : "rounded"} src={imageUrl ?? undefined} icon={<ThemaIcon name={icon} />} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</span>
      <span
        aria-hidden
        className={cn(
          "flex size-6 shrink-0 items-center justify-center border transition-colors duration-fast",
          role === "radio" ? "rounded-full" : "rounded-md",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background group-hover/row:border-primary/50"
        )}
      >
        {checked && <ThemaIcon name="check" size="xs" tone="inverse" />}
      </span>
    </button>
  );
  if (!hasBelow) return row;
  return (
    <div className={surface}>
      {row}
      {/* Alineado con el texto de la fila (relleno + foto + hueco), debajo de él y no al lado: la fila conserva su ancho. */}
      <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 pb-2 pr-2", isLarge ? "pl-[4.25rem]" : "pl-14")}>
        {below}
        {action && (
          <Button type="button" variant="link" size="sm" onClick={action.onClick} aria-label={action.ariaLabel} className="h-auto gap-1 px-0 py-1 text-xs font-medium">
            {action.label}
            <ThemaIcon name="chevronRight" size="xs" data-icon="inline-end" />
          </Button>
        )}
      </div>
    </div>
  );
}
