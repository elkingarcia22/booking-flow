import * as React from "react";
import { createPortal } from "react-dom";

/** Pinta `children` dentro del nodo de `usePortalNode`, esté donde esté. */
export function PortalContent({ node, children }: { node: HTMLDivElement; children: React.ReactNode }) {
  return createPortal(children, node);
}

/** El hueco donde se coloca el nodo: al montarse lo trae, sin volver a crear lo que lleva dentro. */
export function PortalSlot({ node, className }: { node: HTMLDivElement; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.appendChild(node);
    return () => {
      if (node.parentElement === host) host.removeChild(node);
    };
  }, [node]);
  return <div ref={ref} className={className} />;
}
