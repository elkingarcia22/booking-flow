import * as React from "react";
import { useAppT } from "@/app/i18n";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconTile } from "@/components/utility/IconTile";
import { ThemaIcon, type IconName } from "@/icons";
import { cn } from "@/lib/utils";
import { useBookingFlow } from "../../flow/BookingContext";
import { BookingOverlay } from "../../flow/BookingOverlay";
import { overlayKind } from "../../flow/drawerFit";

/**
 * La Agenda en lista: la misma agenda, pero las preguntas van en filas (también en tablet y monitor) y,
 * fuera del celular, cada lista se abre ahí mismo debajo de su fila en vez de en una hoja o un modal.
 */
const AgendaListModeContext = React.createContext(false);
export const AgendaListModeProvider = AgendaListModeContext.Provider;
export const useAgendaListMode = () => React.useContext(AgendaListModeContext);

/** ¿Las listas se abren en su sitio? En la Agenda en lista, fuera del celular y el widget. */
export function useInlineLists(): boolean {
  const listMode = useAgendaListMode();
  const { layout, touch } = useBookingFlow();
  return listMode && (layout === "wide" || touch === "lg");
}

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
  /** Aún no se puede responder (falta la sede): apagado y sin abrir. */
  disabled?: boolean;
  /** Ya respondida: borde y fondo de marca para distinguirla de las que faltan. Por defecto, si tiene `value`. */
  selected?: boolean;
  /** El número de la pregunta en «Arma tu cita» (1 sede, 2 servicios…), delante del `eyebrow`. */
  step?: number;
}

/** El número de una pregunta de «Arma tu cita»: círculo lleno del color de marca, bien visible en claro y en oscuro. */
export function StepNumber({ value, className }: { value: number; className?: string }) {
  return (
    <span aria-hidden className={cn("flex size-5 shrink-0 items-center justify-center rounded-full bg-primary [&>span]:text-primary-foreground", className)}>
      <Text as="span" size="xs" weight="semibold" tabular>
        {value}
      </Text>
    </span>
  );
}

/** El nombre del campo, encima de lo elegido. */
function Eyebrow({ text }: { text: string }) {
  return (
    <Text as="span" size="xs" tone="muted" className="truncate">
      {text}
    </Text>
  );
}

export function PickerField({ labelledBy, imageUrl, icon, round = false, value, detail, placeholder, open, onOpen, testId, asCard = false, eyebrow, step, selected = Boolean(value), disabled = false }: PickerFieldProps) {
  const { touch, layout } = useBookingFlow();
  const listMode = useAgendaListMode();
  const inline = useInlineLists();
  const valueId = React.useId();
  // Tarjeta solo donde caben en fila (tablet y monitor); en celular y en la Agenda en lista, la fila de siempre.
  const isDense = asCard && !listMode && (layout === "wide" || touch === "lg");
  // En monitor la lista abre en un modal: la flecha apunta a la derecha; donde sube desde abajo, hacia abajo.
  const opensAside = !inline && overlayKind({ layout, touch }) === "modal";
  const arrow = opensAside ? (
    <ThemaIcon name="chevronRight" size="sm" tone="muted" className="shrink-0 transition-transform duration-fast group-hover:translate-x-0.5" />
  ) : (
    <ThemaIcon name="chevronDown" size="sm" tone="muted" className="shrink-0 transition-transform duration-fast group-aria-expanded:rotate-180" />
  );
  const base = cn(
    // Fondo de tarjeta, no de página: en claro el campo se despegaba del fondo solo por un filo.
    "group w-full rounded-xl border text-left shadow-xs outline-none transition-[border-color,box-shadow,background-color] duration-fast",
    "hover:border-primary/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
    // Siempre con fondo sólido (va sobre la foto). Respondida: filo de marca y un tinte encima del fondo, no en vez de él.
    "bg-surface",
    // Apagada: el contenido tenue, el fondo sólido (una tarjeta transparente dejaba ver la foto de atrás).
    "disabled:cursor-not-allowed disabled:shadow-none disabled:hover:border-input [&:disabled>*]:opacity-50",
    selected && !disabled ? "border-primary/60 bg-[linear-gradient(hsl(var(--primary)/0.06),hsl(var(--primary)/0.06))]" : "border-input"
  );

  // Como tarjetas, una al lado de la otra. Dos franjas que se alinean entre las tres: arriba el número y el
  // nombre de la pregunta («1 · SEDE») con la flecha; debajo, el icono o la foto junto a lo elegido.
  if (isDense) {
    return (
      <button type="button" aria-haspopup="dialog" aria-expanded={open} aria-labelledby={`${labelledBy} ${valueId}`} disabled={disabled} onClick={onOpen} data-testid={testId} className={cn(base, "flex h-full flex-col", layout === "wide" ? "gap-3 p-4" : "gap-2.5 p-3")}>
        <span className="flex w-full items-center gap-2">
          {step !== undefined && <StepNumber value={step} className="size-6" />}
          {eyebrow && (
            <Text as="span" size="xs" weight="semibold" tone="muted" className="truncate uppercase tracking-wide">
              {eyebrow}
            </Text>
          )}
          <span className="ml-auto">{arrow}</span>
        </span>
        <span className="flex w-full min-w-0 items-center gap-3">
          <IconTile size={layout === "wide" ? "md" : "sm"} shape={round ? "circle" : "rounded"} src={imageUrl ?? undefined} icon={<ThemaIcon name={icon} />} tone={value ? "primary" : "neutral"} />
          <span id={valueId} className="flex min-w-0 flex-1 flex-col">
            {/* En tarjetas angostas, las palabras largas («Massachusetts») parten en vez de cortarse. */}
            <Text as="span" size="sm" weight={value ? "semibold" : "medium"} tone={value ? "default" : "muted"} className="line-clamp-2 hyphens-auto [overflow-wrap:anywhere]" lang="es">
              {value ?? placeholder}
            </Text>
            {value && detail && (
              <Text as="span" size="xs" tone="muted" tabular className="line-clamp-1 [overflow-wrap:anywhere]">
                {detail}
              </Text>
            )}
          </span>
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
      disabled={disabled}
      onClick={onOpen}
      data-testid={testId}
      className={cn(base, "flex items-center gap-3 px-3", touch === "lg" ? "min-h-[4.5rem] py-3" : "min-h-16 py-2.5")}
    >
      {step !== undefined && <StepNumber value={step} className="size-6" />}
      <IconTile size={touch === "lg" ? "lg" : "md"} shape={round ? "circle" : "rounded"} src={imageUrl ?? undefined} icon={<ThemaIcon name={icon} />} tone={value ? "primary" : "neutral"} />
      <span id={valueId} className="flex min-w-0 flex-1 flex-col">
        {eyebrow && <Eyebrow text={eyebrow} />}
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
  const inline = useInlineLists();
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const backRef = React.useRef<HTMLButtonElement>(null);
  const isDetail = Boolean(onBack);

  const focusSelected = () => {
    const list = focusRef.current;
    const target = list?.querySelector<HTMLElement>('[aria-checked="true"]') ?? list?.querySelector<HTMLElement>("[role=checkbox],[role=radio]");
    // Sin desplazar: el panel aún está entrando desde abajo y el navegador movía la página de atrás para «mostrarlo».
    target?.focus({ preventScroll: true });
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
    if (isDetail) backRef.current?.focus({ preventScroll: true });
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

  if (inline) {
    if (!open) return null;
    return (
      <InlinePanel title={title} description={description} heading={hasHeading ? heading : null} footer={footer} onClose={() => onOpenChange(false)} onShown={focusSelected}>
        {content}
      </InlinePanel>
    );
  }

  return (
    <BookingOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      leading={hasHeading ? heading : undefined}
      actions={footer}
      onOpenAutoFocus={focusList}
      disablePadding
    >
      {content}
    </BookingOverlay>
  );
}

/** La lista abierta en su sitio (Agenda en lista, fuera del celular): se asoma a la vista y pone el foco en lo elegido. */
function InlinePanel({ title, description, heading, footer, onClose, onShown, children }: { title: string; description?: string; heading: React.ReactNode; footer?: React.ReactNode; onClose: () => void; onShown: () => void; children: React.ReactNode }) {
  const t = useAppT();
  const ref = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    onShown();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, []);
  return (
    <section
      ref={ref}
      aria-label={title}
      className="flex scroll-mt-4 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200"
    >
      <header className="flex items-start gap-3 border-b border-border bg-muted/30 px-4 py-3">
        {heading}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Text as="span" weight="semibold">
            {title}
          </Text>
          {description && (
            <Text as="span" size="xs" tone="muted">
              {description}
            </Text>
          )}
        </span>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label={t("common.close")} className="-mr-1 shrink-0">
          <ThemaIcon name="close" />
        </Button>
      </header>
      <div className="max-h-[26rem] overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">{children}</div>
      {footer && <footer className="flex flex-col gap-2 border-t border-border bg-muted/30 px-4 py-3">{footer}</footer>}
    </section>
  );
}

/** Desde cuántas opciones la lista lleva buscador. */
export const PICKER_SEARCH_FROM = 7;

/** Sin tildes ni mayúsculas, para buscar «andres» y encontrar «Andrés». */
export const plainText = (value: string): string => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** El buscador de arriba de una lista larga; se queda pegado al desplazar. */
export function PickerSearch({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="sticky top-0 z-10 bg-popover px-4 pb-2 pt-3">
      <div className="relative">
        <ThemaIcon name="search" size="sm" tone="muted" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
        <Input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} className="pl-9" />
      </div>
    </div>
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
