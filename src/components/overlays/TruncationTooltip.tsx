import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Lo que se espera antes de mostrarlo: al cruzar una tabla con el ratón no debe parpadear. */
const SHOW_DELAY_MS = 300;
/** Cuántos padres se suben desde el elemento bajo el puntero buscando el que corta el texto. */
const MAX_ANCESTOR_HOPS = 4;
/** Cuántos hijos se revisan al enfocar un botón o un enlace que contiene el texto cortado. */
const MAX_FOCUS_DESCENDANTS = 40;
/** Margen para el redondeo de subpíxeles al comparar anchos. */
const OVERFLOW_TOLERANCE_PX = 1;

const OPT_OUT_SELECTOR = '[data-truncation-tooltip="off"]';
/** Ya tiene su propio tooltip o su propio `title`: no se duplica. */
const HAS_OWN_TOOLTIP_SELECTOR = '[data-slot="tooltip-trigger"], [data-slot="tooltip-content"]';
const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

interface Shown {
  text: string;
  rect: DOMRect;
}

function overflowsHorizontally(element: HTMLElement): boolean {
  if (element.scrollWidth - element.clientWidth > OVERFLOW_TOLERANCE_PX) return true;
  // `scrollWidth` redondea: un texto cortado por medio píxel no se nota ahí, pero sí midiendo el texto.
  const range = document.createRange();
  range.selectNodeContents(element);
  if (typeof range.getBoundingClientRect !== "function") return false;
  return range.getBoundingClientRect().width - element.getBoundingClientRect().width > OVERFLOW_TOLERANCE_PX;
}

/** El elemento corta su texto con elipsis (`truncate`, `text-ellipsis`) o con `line-clamp-*`, y de verdad le sobra texto. */
export function isTextTruncated(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  const lineClamp = style.getPropertyValue("-webkit-line-clamp");
  if (lineClamp && lineClamp !== "none") return element.scrollHeight - element.clientHeight > OVERFLOW_TOLERANCE_PX;
  const clips = [style.overflowX, style.overflow].some((value) => value !== "" && value !== "visible");
  if (style.textOverflow === "ellipsis" && clips) return overflowsHorizontally(element);
  return false;
}

function isEligible(element: HTMLElement): boolean {
  return !element.closest(OPT_OUT_SELECTOR) && !element.closest(HAS_OWN_TOOLTIP_SELECTOR) && !element.hasAttribute("title") && !element.matches(EDITABLE_SELECTOR);
}

function truncatedFromPointer(target: EventTarget | null): HTMLElement | null {
  let node = target instanceof HTMLElement ? target : null;
  for (let hop = 0; node && hop <= MAX_ANCESTOR_HOPS; hop += 1, node = node.parentElement) {
    if (isTextTruncated(node)) return isEligible(node) ? node : null;
  }
  return null;
}

function truncatedFromFocus(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  if (isTextTruncated(target)) return isEligible(target) ? target : null;
  const descendants = Array.from(target.querySelectorAll<HTMLElement>("*")).slice(0, MAX_FOCUS_DESCENDANTS);
  return descendants.find((child) => isTextTruncated(child) && isEligible(child)) ?? null;
}

function isKeyboardFocus(element: HTMLElement): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return false;
  }
}

/**
 * La regla de todo el sistema: **un texto que se corta con elipsis muestra el texto completo en un
 * tooltip**, al pasar el ratón o al llegar con el teclado. Se monta una vez junto al
 * `TooltipProvider` global y vigila el documento entero, así que vale para cualquier pieza
 * —`<Text truncate>`, `truncate`, `text-ellipsis`, `line-clamp-*`— sin envolver nada, y solo
 * aparece cuando el texto de verdad no cabe (en móvil, al angostar la ventana o con nombres largos).
 *
 * No se muestra si el elemento ya tiene su propio tooltip o `title`, si es un campo editable o si
 * él o un padre llevan `data-truncation-tooltip="off"`.
 */
export function TruncationTooltip() {
  const [shown, setShown] = React.useState<Shown | null>(null);
  const anchorRef = React.useRef<HTMLElement | null>(null);
  const timerRef = React.useRef<number | undefined>(undefined);
  /** El último elemento revisado bajo el puntero: se mira una vez por elemento, no en cada movimiento. */
  const lastTargetRef = React.useRef<EventTarget | null>(null);

  React.useEffect(() => {
    const cancelPending = () => window.clearTimeout(timerRef.current);
    const hide = () => {
      cancelPending();
      anchorRef.current = null;
      // Tras un scroll o un clic, el siguiente movimiento vuelve a mirar aunque el puntero no haya salido.
      lastTargetRef.current = null;
      setShown(null);
    };
    const showSoon = (element: HTMLElement) => {
      if (anchorRef.current === element) return;
      hide();
      anchorRef.current = element;
      timerRef.current = window.setTimeout(() => {
        // `innerText` respeta los saltos que se ven; `textContent` por si el entorno no lo implementa.
        const text = (element.innerText || element.textContent || "").trim();
        if (anchorRef.current !== element || !element.isConnected || text === "") return;
        setShown({ text, rect: element.getBoundingClientRect() });
      }, SHOW_DELAY_MS);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" || event.target === lastTargetRef.current) return;
      lastTargetRef.current = event.target;
      const element = truncatedFromPointer(event.target);
      if (element) showSoon(element);
    };
    const onPointerOut = (event: PointerEvent) => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const next = event.relatedTarget;
      if (next instanceof Node && anchor.contains(next)) return;
      hide();
    };
    const onFocusIn = (event: FocusEvent) => {
      // Solo con teclado: un clic también enfoca y no queremos el tooltip encima de lo que se acaba de pulsar.
      if (!(event.target instanceof HTMLElement) || !isKeyboardFocus(event.target)) return;
      const element = truncatedFromFocus(event.target);
      if (element) showSoon(element);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });
    document.addEventListener("pointerdown", hide, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", hide);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    window.addEventListener("resize", hide, { passive: true });
    return () => {
      cancelPending();
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("pointerdown", hide);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", hide, { capture: true });
      window.removeEventListener("resize", hide);
    };
  }, []);

  if (!shown) return null;
  const { rect, text } = shown;
  return (
    <Tooltip open onOpenChange={(open) => !open && setShown(null)}>
      <TooltipTrigger asChild>
        {/* Un ancla invisible encima del texto cortado: Radix posiciona el tooltip contra ella. */}
        <span
          aria-hidden
          data-truncation-tooltip="off"
          className="pointer-events-none fixed"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        />
      </TooltipTrigger>
      <TooltipContent className="pointer-events-none z-popover max-w-sm whitespace-pre-line break-words">{text}</TooltipContent>
    </Tooltip>
  );
}
