import type { CommentLocation } from "@/components/comments";

/**
 * Dónde cayó un comentario, en palabras de quien lo lee en la hoja: la ruta, el módulo (la ruta del
 * menú que muestra la cabecera), la sección (título de la página, pestaña activa y el encabezado más
 * cercano al punto) y el elemento exacto (un botón, un campo, una fila…).
 */

const MAX_TEXT = 60;
const SEPARATOR = " › ";

/** Lo que se considera «un elemento» al subir desde el punto del clic, del más concreto al más general. */
const ELEMENT_SELECTOR = [
  "button",
  "a[href]",
  "input",
  "select",
  "textarea",
  "[role=button]",
  "[role=tab]",
  "[role=radio]",
  "[role=checkbox]",
  "[role=switch]",
  "[role=menuitem]",
  "[role=option]",
  "[role=row]",
  "tr",
  "li",
  "label",
  "img",
].join(",");

/** Contenedores que suelen tener su propio título. */
const SECTION_SELECTOR = "section, article, form, fieldset, aside, [role=dialog], [role=region], [data-slot=card], [data-slot=side-panel]";
const HEADING_SELECTOR = "h1, h2, h3, h4, legend, [data-slot=card-title]";

const clean = (text: string | null | undefined): string => (text ?? "").replace(/\s+/g, " ").trim();
const short = (text: string): string => (text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text);
/** La primera línea visible: una etiqueta con su ayuda debajo se nombra por la etiqueta. */
const firstLine = (element: Element | null | undefined): string =>
  element ? clean(((element as HTMLElement).innerText ?? element.textContent ?? "").split("\n").find((line) => clean(line)) ?? "") : "";

/** El tipo de elemento en palabras: «Botón», «Campo», «Fila»… */
function kindOf(element: Element): string {
  const role = element.getAttribute("role");
  const tag = element.tagName.toLowerCase();
  if (role === "tab") return "Pestaña";
  if (role === "radio" || role === "checkbox" || role === "switch") return "Opción";
  if (role === "menuitem" || role === "option") return "Opción de menú";
  if (role === "row" || tag === "tr") return "Fila";
  if (tag === "button" || role === "button") return "Botón";
  if (tag === "a") return "Enlace";
  if (tag === "input" || tag === "select" || tag === "textarea") return "Campo";
  if (tag === "img") return "Imagen";
  if (tag === "label") return "Etiqueta";
  return "Elemento";
}

/** El nombre de un elemento: su etiqueta accesible, su texto o, en un campo, su placeholder. */
function nameOf(element: Element): string {
  const labelledBy = element.getAttribute("aria-labelledby");
  const fromId = labelledBy ? clean(labelledBy.split(" ").map((id) => element.ownerDocument.getElementById(id)?.textContent ?? "").join(" ")) : "";
  const label = clean(element.getAttribute("aria-label")) || fromId;
  if (label) return short(label);
  // Un control con su <label for> (un campo, un interruptor de Radix): ese es su nombre.
  const forLabel = element.id ? element.ownerDocument.querySelector(`label[for="${CSS.escape(element.id)}"]`) : null;
  const wrapping = element.closest("label");
  const labelText = firstLine(forLabel) || (wrapping && wrapping !== element ? firstLine(wrapping) : "");
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return short(labelText || clean(element.placeholder) || clean(element.name));
  }
  if (labelText && !clean((element as HTMLElement).innerText ?? element.textContent)) return short(labelText);
  if (element instanceof HTMLImageElement) return short(clean(element.alt));
  return short(clean((element as HTMLElement).innerText ?? element.textContent));
}

/** «Botón «Guardar cambios»»: el elemento concreto bajo el clic, o el texto más cercano si no hay uno. */
export function describeElement(target: Element): string | undefined {
  const element = target.closest(ELEMENT_SELECTOR);
  if (element) {
    const name = nameOf(element);
    return name ? `${kindOf(element)} «${name}»` : kindOf(element);
  }
  // Un bloque con varias líneas (una tarjeta, un indicador) se nombra por la primera: suele ser su título.
  const raw = (target as HTMLElement).innerText ?? target.textContent ?? "";
  const lines = raw.split("\n").map(clean).filter(Boolean);
  if (lines.length === 0) return undefined;
  return lines.length > 1 ? `Bloque «${short(lines[0])}»` : `Texto «${short(lines[0])}»`;
}

/** El título de un contenedor: su `aria-labelledby`, su `aria-label` o su primer encabezado. */
function titleOf(container: Element): string {
  const labelledBy = container.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = clean(labelledBy.split(" ").map((id) => container.ownerDocument.getElementById(id)?.textContent ?? "").join(" "));
    if (text) return text;
  }
  const label = clean(container.getAttribute("aria-label"));
  if (label) return label;
  return clean(container.querySelector(HEADING_SELECTOR)?.textContent);
}

/** Los títulos de los contenedores que rodean al punto, del más externo al más interno, sin repetir. */
function sectionsAround(target: Element, stopAt: Element | null): string[] {
  const titles: string[] = [];
  let current: Element | null = target.closest(SECTION_SELECTOR);
  while (current && current !== stopAt) {
    const title = short(titleOf(current));
    if (title && !titles.includes(title)) titles.unshift(title);
    current = current.parentElement?.closest(SECTION_SELECTOR) ?? null;
  }
  return titles;
}

/**
 * «Reservas online › Apariencia › Apariencia de la reserva»: el título de la página, la pestaña
 * activa (si hay) y los títulos de las secciones que rodean el punto.
 */
export function describeSection(target: Element, root: ParentNode = document): string | undefined {
  const main = target.closest("main") ?? (root instanceof Element ? root : null);
  const scope: ParentNode = main ?? root;
  const page = short(clean(scope.querySelector("h1")?.textContent));
  const tab = short(clean(scope.querySelector('[role=tab][aria-selected="true"], [role=tab][data-state="active"]')?.textContent));
  const parts = [page, tab, ...sectionsAround(target, main)].filter((part, index, all) => part && all.indexOf(part) === index);
  return parts.length > 0 ? parts.join(SEPARATOR) : undefined;
}

/** La ruta del menú que muestra la cabecera: «Configuración › Negocio › Reservas online». */
export function describeModule(root: ParentNode = document): string | undefined {
  const crumbs = root.querySelector('nav[aria-label="Breadcrumb"]');
  if (!crumbs) return undefined;
  // Cada tramo es un texto suelto (los separadores son iconos): se juntan con « › ».
  const walker = crumbs.ownerDocument.createTreeWalker(crumbs, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = clean(node.textContent);
    if (text && text !== "/" && text !== "›" && text !== ">") parts.push(text);
  }
  return parts.length > 0 ? parts.join(SEPARATOR) : undefined;
}

export interface LocateOptions {
  /** El módulo cuando la pantalla no tiene ruta de menú en la cabecera (la reserva en línea). */
  module?: string;
  /** Una sección fija antes de la que se calcula (p. ej. la versión y el dispositivo de la vista previa). */
  sectionPrefix?: string;
}

/** Lo que hay bajo el punto, saltando la capa de los comentarios (su capa de clics y sus pins). */
function targetAt(x: number, y: number): Element | null {
  const stack = typeof document.elementsFromPoint === "function" ? document.elementsFromPoint(x, y) : [];
  return stack.find((element) => !element.closest("[data-comment-overlay], [data-slot=comment-pin], [data-slot=comment-draft]")) ?? null;
}

/** La ubicación completa de un clic en la ventana (`clientX`, `clientY`). */
export function locateCommentPoint(point: { x: number; y: number }, options: LocateOptions = {}): CommentLocation {
  const target = targetAt(point.x, point.y);
  const route = `${window.location.pathname}${window.location.search}`;
  const module = describeModule() ?? options.module;
  const computed = target ? describeSection(target) : undefined;
  const section = [options.sectionPrefix, computed].filter(Boolean).join(SEPARATOR) || undefined;
  return { route, module, section, element: target ? describeElement(target) : undefined };
}
