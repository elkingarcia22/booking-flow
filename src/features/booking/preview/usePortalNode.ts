import * as React from "react";

/**
 * Un nodo del DOM propio y estable: lo que se pinta en él con `createPortal`
 * sigue en el mismo lugar del árbol de React aunque el nodo cambie de sitio
 * en la página (ver `PortalSlot`). Así una sola reserva pasa del marco del
 * celular al de la tablet, al monitor o al panel del widget sin desmontarse.
 * Se crea al primer render, no en un efecto: la reserva se pinta desde el
 * principio, sin un fotograma vacío.
 */
export function usePortalNode(className: string): HTMLDivElement {
  const [node] = React.useState(() => {
    const element = document.createElement("div");
    element.className = className;
    return element;
  });
  return node;
}
