import * as React from "react";
import { ChevronRight, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeSwatch, useTheme } from "@/themes";
import { useT } from "@/i18n";
import { useCloseWorkspaceMenu } from "./workspaceMenuContext";

export interface PersonalizationMenuProps {
  /** Abre el panel de Personalización (la app lo pinta al lado del contenido). */
  onOpen: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * «Personalización» en el menú de la marca: la fila con la pastilla del color activo.
 * Ya no despliega un panel flotante: cierra el menú y abre el panel lateral que
 * empuja la página, para ver los cambios en la pantalla de verdad mientras se eligen.
 */
export function PersonalizationMenu({ onOpen, className, style }: PersonalizationMenuProps) {
  const t = useT();
  const { preset } = useTheme();
  const closeWorkspaceMenu = useCloseWorkspaceMenu();

  return (
    <button
      type="button"
      aria-label={`${t("shell.personalization")}: ${preset.name}`}
      aria-haspopup="dialog"
      data-testid="personalization-switch"
      onClick={() => {
        closeWorkspaceMenu();
        onOpen();
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-background hover:text-text-primary",
        className
      )}
      style={style}
    >
      <Palette className="h-4 w-4 shrink-0 text-text-muted" strokeWidth={2} />
      <span className="flex-1 text-left">{t("shell.personalization")}</span>
      <ThemeSwatch preset={preset} className="size-3.5" />
      <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" strokeWidth={2} />
    </button>
  );
}
