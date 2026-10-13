import { DrawerShell, type DrawerShellProps } from "@/components/overlays";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useBookingFlow } from "./BookingContext";
import { DRAWER_FIT_STYLE, overlayKind } from "./drawerFit";

export type BookingOverlayProps = Omit<DrawerShellProps, "side" | "contentStyle" | "trigger"> & {
  /** Ancho del modal en monitor. */
  modalSize?: "md" | "lg" | "xl";
};

const MODAL_WIDTH = { md: "sm:max-w-md", lg: "sm:max-w-lg", xl: "sm:max-w-xl" } as const;

/**
 * Las ventanas de la reserva (elegir sede, barbero o servicios, el perfil de un barbero, los
 * productos, cambiar una cita…): en celular y tablet suben desde abajo, al alcance del pulgar;
 * en monitor, donde sobra pantalla, son un modal centrado. Mismas partes en los dos: título,
 * descripción, algo a la izquierda del título, cuerpo que se desplaza y pie con las acciones.
 */
export function BookingOverlay({
  open,
  onOpenChange,
  title,
  description,
  leading,
  children,
  footer,
  actions,
  className,
  showCloseButton = true,
  disablePadding = false,
  onInteractOutside,
  onOpenAutoFocus,
  modalSize = "lg",
  ...rest
}: BookingOverlayProps) {
  const { layout, touch } = useBookingFlow();
  if (overlayKind({ layout, touch }) === "sheet") {
    return (
      <DrawerShell
        {...rest}
        open={open}
        onOpenChange={onOpenChange}
        side="bottom"
        contentStyle={DRAWER_FIT_STYLE}
        title={title}
        description={description}
        leading={leading}
        footer={footer}
        actions={actions}
        className={className}
        showCloseButton={showCloseButton}
        disablePadding={disablePadding}
        onInteractOutside={onInteractOutside}
        onOpenAutoFocus={onOpenAutoFocus}
      >
        {children}
      </DrawerShell>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={showCloseButton}
        aria-describedby={undefined}
        onInteractOutside={onInteractOutside}
        onOpenAutoFocus={onOpenAutoFocus}
        // El alto se mide contra el marco de la reserva (monitor o widget), no contra la ventana.
        className={cn("flex max-h-[min(85%,48rem)] flex-col gap-0 overflow-hidden p-0", MODAL_WIDTH[modalSize], className)}
      >
        {(title || description) && (
          <header className={cn("flex shrink-0 border-b bg-muted/30 px-5 py-4 pr-12", leading ? "items-center gap-3" : "flex-col gap-1")}>
            {leading && <div className="shrink-0">{leading}</div>}
            <div className={cn("flex min-w-0 flex-col gap-1", leading && "flex-1")}>
              {title && <DialogTitle className="text-base font-semibold">{title}</DialogTitle>}
              {description && <DialogDescription>{description}</DialogDescription>}
            </div>
          </header>
        )}
        <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto [scrollbar-gutter:stable]", !disablePadding && "p-5")}>{children}</div>
        {footer ? footer : actions ? <footer className="flex shrink-0 flex-col gap-2 border-t bg-muted/30 px-5 py-4">{actions}</footer> : null}
      </DialogContent>
    </Dialog>
  );
}
