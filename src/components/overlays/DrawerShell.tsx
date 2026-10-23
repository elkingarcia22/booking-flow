import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  useBodyScrollLock,
} from "@/components/ui/sheet"
import { PANEL_FOOTER_SLOT_CLASS, PanelFooterSlotProvider, usePanelFooterSlot } from "./PanelFooter"

export interface DrawerShellProps {
  /** Controlled open state */
  open?: boolean
  /** Event handler for open state changes */
  onOpenChange?: (open: boolean) => void
  /** The element that triggers the drawer */
  trigger?: React.ReactNode
  /** Main title of the drawer */
  title?: string
  /** Brief description or subtitle */
  description?: string
  /** Avatar o icono a la izquierda del título: quién o qué es lo que se abre. */
  leading?: React.ReactNode
  /** Botones de icono en la cabecera, antes del cierre (terciarios, con su tooltip). */
  headerActions?: React.ReactNode
  /** Drawer body content */
  children?: React.ReactNode
  /** Custom footer content (replaces actions) */
  footer?: React.ReactNode
  /** Action buttons (usually Primary and Cancel) */
  actions?: React.ReactNode
  /** Side from which the drawer appears */
  side?: "left" | "right" | "top" | "bottom"
  /** Enterprise size variants */
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl" | "full"
  /** Custom classes for the sheet content */
  className?: string
  /** Whether to show the close button (default: true) */
  showCloseButton?: boolean
  /** Whether to disable default padding in the content area (default: false) */
  disablePadding?: boolean
  /** Whether to disable scrollbar-gutter: stable (default: false) */
  disableScrollbarGutter?: boolean
  /** Prevent closing on outside interaction */
  onInteractOutside?: (e: Event) => void
  /**
   * Dónde cae el foco al abrir. Por defecto, en lo primero enfocable: si eso
   * es un buscador, en un celular sube el teclado y tapa la lista. Quien no
   * lo quiera lo cancela aquí y pone el foco donde toca.
   */
  onOpenAutoFocus?: (e: Event) => void
  /**
   * Si el drawer acapara la pantalla (por defecto sí).
   *
   * En modo modal Radix apaga los eventos de puntero del `body` y marca como
   * `aria-hidden` todo lo que no sea el drawer: nada de fuera se puede tocar
   * ni leer. Un drawer que convive con un panel propio fuera de su caja —el
   * del Agente IA, que vive en la concha de la app y no en el portal— tiene
   * que apagarlo mientras ese panel esté abierto, o el panel queda muerto.
   * El velo sigue estando: lo dibuja `SheetContent` por su cuenta.
   */
  modal?: boolean
  /** Recorta el velo para dejar a la vista —y clicable— lo que convive con el
   *  drawer, como el panel del Agente IA. */
  overlayClassName?: string
  /**
   * Estilo en línea del cajón y de su velo.
   *
   * Existe para el movimiento: un drawer que se corre para hacerle sitio a
   * otra cosa tiene que ir con la misma curva y la misma duración que ella, y
   * las clases de Tailwind no pueden garantizarlo aquí —la animación de
   * entrada del `Sheet` trae su propia `duration-500` con una variante que
   * pesa más—. En línea gana siempre y el número se lee donde se decide.
   */
  contentStyle?: React.CSSProperties
  overlayStyle?: React.CSSProperties
}

const sideSizeClasses = {
  right: {
    sm: "sm:max-w-sm", // 384px
    md: "sm:max-w-md", // 448px
    lg: "sm:max-w-lg", // 512px
    xl: "sm:max-w-xl", // 576px
    "2xl": "sm:max-w-2xl", // 672px
    "3xl": "sm:max-w-3xl", // 768px
    "4xl": "sm:max-w-4xl", // 896px
    "5xl": "sm:max-w-5xl", // 1024px
    "6xl": "sm:max-w-6xl", // 1152px
    "7xl": "sm:max-w-7xl", // 1280px
    "full": "sm:max-w-[calc(100%-1.5rem)]",
  },
  left: {
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
    xl: "sm:max-w-xl",
    "2xl": "sm:max-w-2xl",
    "3xl": "sm:max-w-3xl",
    "4xl": "sm:max-w-4xl",
    "5xl": "sm:max-w-5xl",
    "6xl": "sm:max-w-6xl",
    "7xl": "sm:max-w-7xl",
    "full": "sm:max-w-[calc(100%-1.5rem)]",
  },
  top: {
    sm: "", md: "", lg: "", xl: "", "2xl": "", "3xl": "", "4xl": "", "5xl": "", "6xl": "", "7xl": "", full: "",
  },
  bottom: {
    sm: "", md: "", lg: "", xl: "", "2xl": "", "3xl": "", "4xl": "", "5xl": "", "6xl": "", "7xl": "", full: "",
  },
}

export function DrawerShell({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  leading,
  headerActions,
  children,
  footer,
  actions,
  side = "right",
  size = "md",
  className,
  showCloseButton = true,
  disablePadding = false,
  disableScrollbarGutter = false,
  onInteractOutside,
  onOpenAutoFocus,
  modal = true,
  overlayClassName,
  contentStyle,
  overlayStyle,
}: DrawerShellProps) {
  const sizeClass = sideSizeClasses[side][size]
  const [footerSlot, setFooterSlot] = usePanelFooterSlot()

  // Un drawer no modal tapa la página igual que uno modal, pero Radix ya no le
  // congela el fondo, así que lo pide por su cuenta mientras está abierto.
  useBodyScrollLock(open === true && !modal)

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={modal}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent 
        side={side} 
        className={cn(sizeClass, className)}
        showCloseButton={showCloseButton}
        modal={modal}
        style={contentStyle}
        overlayClassName={overlayClassName}
        overlayStyle={overlayStyle}
        aria-describedby={undefined}
        onInteractOutside={onInteractOutside}
        onOpenAutoFocus={onOpenAutoFocus}
      >
        {(title || description) && (
          <SheetHeader className={cn("border-b bg-muted/30", (leading || headerActions) && "flex-row items-center gap-3")}>
            {leading && <div className="shrink-0">{leading}</div>}
            <div className={cn((leading || headerActions) && "min-w-0 flex-1 space-y-1.5")}>
              {title && <SheetTitle>{title}</SheetTitle>}
              {description && <SheetDescription>{description}</SheetDescription>}
            </div>
            {/* El cierre de la hoja va en la esquina: las acciones le dejan su sitio. */}
            {headerActions && <div className={cn("flex shrink-0 items-center gap-1", showCloseButton && "mr-8")}>{headerActions}</div>}
          </SheetHeader>
        )}
        
        <div
          className={cn(
            // `scrollbar-gutter: stable` reserves the scrollbar's space even
            // when nothing overflows yet — without it, switching to content
            // tall enough to need a scrollbar shifts every row a few pixels
            // narrower, which can flip a borderline-length line from one
            // line to two (or back) depending on what's selected above.
            "flex-1 overflow-y-auto flex flex-col",
            !disableScrollbarGutter && "[scrollbar-gutter:stable]",
            !disablePadding && "p-4"
          )}
        >
          <PanelFooterSlotProvider value={footerSlot}>{children}</PanelFooterSlotProvider>
        </div>
        <div ref={setFooterSlot} className={PANEL_FOOTER_SLOT_CLASS} />

        {footer ? (
          footer
        ) : actions ? (
          <SheetFooter className="border-t bg-muted/30">
            {actions}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
