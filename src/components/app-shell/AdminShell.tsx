import * as React from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import { FeedbackDialog } from "@/components/feedback-loop";
import { ThemaLogo } from "@/components/ui/ThemaLogo";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { AgentView } from "./AgentView";
import { ShellHeaderSlotProvider } from "./shellHeaderSlot";
import { ShellRailSlotProvider } from "./shellRailSlot";
import { ShellAgentPanelSlotProvider, ShellSidePanelSlotProvider } from "./shellAgentPanelSlot";
import type { ShellMode } from "./shellTypes";
import { ShellConfigContext, resolveShellConfig, type ShellConfig, type ShellConfigOverrides, type ShellContentWidth } from "./shellConfig";
import { SEARCH_RECORDS, navigationPaths } from "./appShellData";

/**
 * Los tres anchos del sistema (Fundamentos › Espaciado) más el lienzo
 * completo. El marco los aplica una sola vez: ninguna pantalla vuelve a
 * fijar su ancho máximo.
 */
const CONTENT_WIDTH_CLASSES: Record<ShellContentWidth, string> = {
  narrow: "max-w-narrow",
  normal: "max-w-normal",
  wide: "max-w-wide",
  full: "max-w-full",
};
import type { GlobalSearchProps } from "@/components/search";

interface AdminShellProps {
  /**
   * When true the content area scrolls (dashboard-style pages) and shows the
   * legal footer; app-like screens that manage their own scroll pass false.
   */
  scrollContent?: boolean;
  /** Fired when the user navigates back to Encuestas from the sidebar. */
  onNavigateHome?: () => void;
  /** Force the footer to show even if scrollContent is false. */
  showFooter?: boolean;
  /** Usuario, navegación, notificaciones y callbacks; lo que falte usa los valores demo. */
  config?: ShellConfigOverrides;
  children: React.ReactNode;
}


export const AdminShell: React.FC<AdminShellProps> = ({
  scrollContent = true,
  showFooter,
  onNavigateHome,
  config: overrides,
  children,
}) => {
  const resolved = React.useMemo(() => resolveShellConfig(overrides), [overrides]);
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  // El modo lo puede llevar la app (para abrir el chat en pantalla completa
  // desde fuera del shell); si no, lo guarda el shell.
  const [innerMode, setInnerMode] = React.useState<ShellMode>("workspace");
  const mode = resolved.mode ?? innerMode;
  const setMode = React.useCallback(
    (next: ShellMode) => {
      setInnerMode(next);
      resolved.onModeChange?.(next);
    },
    [resolved]
  );
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);
  // Dónde está la persona, tal como lo dice el menú: «Equipo › Horarios».
  const activeLabel = React.useMemo(
    () => navigationPaths(resolved.navigation).find((destination) => destination.id === resolved.activeNavId)?.path.join(" › "),
    [resolved.navigation, resolved.activeNavId]
  );
  const [headerSlot, setHeaderSlot] = React.useState<HTMLDivElement | null>(null);
  const [railSlot, setRailSlot] = React.useState<HTMLDivElement | null>(null);
  const [agentPanelSlot, setAgentPanelSlot] = React.useState<HTMLDivElement | null>(null);
  const [sidePanelSlot, setSidePanelSlot] = React.useState<HTMLDivElement | null>(null);
  // Pending auto-collapse: fires once, shortly after mount, so the sidebar
  // shows its labels first and then tucks itself away. Any manual toggle
  // before it fires cancels it — the user has already made the call.
  const autoCollapseTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const AUTO_COLLAPSE_DELAY_MS = 2200;
    autoCollapseTimeoutRef.current = setTimeout(() => {
      setCollapsed(true);
      autoCollapseTimeoutRef.current = null;
    }, AUTO_COLLAPSE_DELAY_MS);
    return () => {
      if (autoCollapseTimeoutRef.current) clearTimeout(autoCollapseTimeoutRef.current);
    };
  }, []);

  const toggleSidebar = () => {
    if (autoCollapseTimeoutRef.current) {
      clearTimeout(autoCollapseTimeoutRef.current);
      autoCollapseTimeoutRef.current = null;
    }
    // Below lg the sidebar is a floating drawer instead of a collapsible rail.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setMobileOpen((open) => !open);
      return;
    }
    setCollapsed((value) => !value);
  };

  const isAgent = mode === "agent";
  const t = useT();

  /*
   * El índice efectivo de la búsqueda general. Se arma aquí, y no en la
   * cabecera, porque preguntar al agente cambia el modo del shell y eso es
   * estado de este componente. Lo que venga en `config.search` gana: una app
   * real pasa sus propios registros y su propio alcance.
   */
  const search = React.useMemo<Partial<GlobalSearchProps>>(
    () => ({
      objects: SEARCH_RECORDS.map((record) => ({
        id: record.id,
        title: record.title,
        meta: record.meta,
        onSelect: () => resolved.onNavigate?.(record.id, record.path),
      })),
      navigate: [
        ...navigationPaths(resolved.navigation).map((destination) => ({
          id: destination.id,
          path: destination.path,
          onSelect: () => resolved.onNavigate?.(destination.id, destination.route),
        })),
        /*
         * Los ajustes también son destinos. Al salir del árbol de navegación
         * dejaron de aparecer aquí, y la búsqueda es justo por donde se llega
         * a algo que se toca una vez al año y de lo que no se recuerda el
         * grupo: "propinas" tiene que encontrarlo.
         */
        ...(resolved.chrome.settings
          ? resolved.settings.flatMap((group) =>
              group.items.map((item) => ({
                id: `settings-${item.id}`,
                path: [t("shell.settings"), group.label, item.label],
                onSelect: () => resolved.onNavigate?.(item.id, item.path),
              }))
            )
          : []),
      ],
      // Solo se ofrece preguntar si el agente es alcanzable: sin su
      // conmutador no hay panel al que llevar la pregunta, y la documentación
      // es justo ese caso.
      onAsk: resolved.chrome.modeSwitch
        ? (question) => {
            setMode("agent");
            resolved.onAgentPrompt?.(question);
          }
        : undefined,
      askHint: resolved.chrome.modeSwitch ? "Se responde en el panel del Agente IA" : undefined,
      scope: resolved.brand.productName,
      ...resolved.search,
    }),
    [resolved, t]
  );

  const config = React.useMemo<ShellConfig>(() => ({ ...resolved, search }), [resolved, search]);

  const footerVisible = showFooter ?? (scrollContent || isAgent);
  /*
   * El pie legal, extraído para poder montarlo en dos sitios distintos según
   * el caso: dentro del scroller (para que quede al final de la página, no
   * pegado a la ventana) o fuera de él (agente y pantallas tipo app, que no
   * tienen ese scroller que ofrecerle).
   */
  const legalFooter = (
    /*
     * `role="contentinfo"` explícito: dentro del scroller el pie queda anidado
     * en `<main>`, y ahí un `<footer>` pierde su rol implícito de landmark.
     * Sin él, un lector de pantalla no tiene cómo saltar al pie.
     */
    <footer
      role="contentinfo"
      className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-border/60 px-4 py-2.5 text-xs text-text-muted"
    >
      <ThemaLogo size={16} color="var(--color-text-muted)" className="hover:scale-100" />
      <span className="font-bold tracking-tight">{resolved.brand.productName}</span>
      <span className="opacity-50">|</span>
      {resolved.brand.termsHref ? (
        <a href={resolved.brand.termsHref} target="_blank" rel="noreferrer" className="transition-colors hover:text-text-secondary hover:underline">
          {t("shell.terms")}
        </a>
      ) : (
        <span>{t("shell.terms")}</span>
      )}
      <span className="opacity-50">|</span>
      {resolved.brand.privacyHref ? (
        <a href={resolved.brand.privacyHref} target="_blank" rel="noreferrer" className="transition-colors hover:text-text-secondary hover:underline">
          {t("shell.privacy")}
        </a>
      ) : (
        <span>{t("shell.privacy")}</span>
      )}
    </footer>
  );

  return (
    <ShellConfigContext.Provider value={config}>
    <div
      className={cn(
        "flex h-dvh w-full overflow-hidden bg-background font-sans",
        isAgent && "ai-mesh-agent"
      )}
    >
      <AppSidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        mode={mode}
        onModeChange={setMode}
        onNavigateHome={onNavigateHome}
        onCloseMobile={() => setMobileOpen(false)}
        onToggleCollapse={toggleSidebar}
        onOpenFeedback={resolved.onOpenFeedback ?? (() => setFeedbackOpen(true))}
      />

      {/* Mobile scrim behind the drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* The atmosphere sits on the whole column, header included, so the
          theme's halo runs from the top of the screen down into the page
          without a tonal step where the header ends. */}
      <div className="page-atmosphere flex min-w-0 flex-1 flex-col">
        <AppHeader
          onToggleSidebar={toggleSidebar}
          onOpenNews={() => {/* handled inside AppHeader */}}
          onSlotRef={setHeaderSlot}
        />

        {/* Bajo la cabecera, la pantalla y su panel de trabajo van en fila: el
            panel (ver `SidePanelShell`) le quita ancho a la pantalla sin
            mover la cabecera. */}
        <div className="flex min-h-0 flex-1">
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <ShellSidePanelSlotProvider value={sidePanelSlot}>
          <ShellHeaderSlotProvider value={headerSlot}>
            <ShellRailSlotProvider value={railSlot}>
              <ShellAgentPanelSlotProvider value={agentPanelSlot}>
              {isAgent ? (
                (resolved.agentView ?? <AgentView />)
              ) : scrollContent ? (
                // `flex flex-col`: with short content, the padded wrapper's
                // own `flex-1` stretches to fill this scroller and pushes the
                // footer to the bottom of the viewport — the same place it
                // sits today. With content taller than the viewport, this div
                // is what scrolls, so the footer rides along at the true end
                // of the page instead of staying pinned while everything
                // above it scrolls underneath.
                // `relative`: the scroller has to be the containing block of
                // anything absolute inside it (every `sr-only` is). Without
                // it those boxes anchor to `<main>`, escape the scroll clip
                // and make the shell root scrollable — focusing a control
                // then shifts the whole frame up by a few pixels.
                <div className="relative min-h-0 flex-1 overflow-y-auto flex flex-col">
                  {/* The content column, on the same gutter + centered-cap
                      rhythm the docs shell uses: it never sits flush against
                      the header, the sidebar or the window, and past its
                      configured cap it centers instead of stretching across an
                      ultra-wide monitor. No frame of its own — it shares the page
                      background, and the header's `border-b` is the only line
                      that divides them. Plain utilities on purpose: the
                      semantic `p-page` scale only resolves once Tailwind
                      reloads the config, so a running dev server would
                      silently render it with no padding. */}
                  <div className="flex flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                    <div className={cn("mx-auto w-full flex-1 flex flex-col", CONTENT_WIDTH_CLASSES[config.contentWidth])}>
                      {children}
                    </div>
                  </div>
                  {footerVisible && legalFooter}
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
              )}
              </ShellAgentPanelSlotProvider>
            </ShellRailSlotProvider>
          </ShellHeaderSlotProvider>
          </ShellSidePanelSlotProvider>

          {/* Floating-rail anchor: outside the scroller, so a screen's rail
              stays put while its content scrolls underneath. */}
          <div
            ref={setRailSlot}
            className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex justify-center"
          />
        </main>
        <div ref={setSidePanelSlot} className="flex min-h-0 shrink-0 empty:hidden" />
        </div>

        {/* Solo aquí, fuera del scroller: el modo agente y las pantallas tipo
            app (`scrollContent={false}`) no tienen un scroller propio al que
            unir el pie, así que sigue pegado a la ventana como antes. Con
            `scrollContent`, el pie ya viaja dentro del scroller de arriba. */}
        {footerVisible && !(scrollContent && !isAgent) && legalFooter}
      </div>

      {/* Agente IA anchor: a flex sibling of the content column, not an
          overlay above it — the panel that portals in here (see
          `shellAgentPanelSlot`) carries its own width, so mounting it takes
          space from this row and narrows the column next to it instead of
          floating over the page. */}
      <div ref={setAgentPanelSlot} className="relative z-[51] flex h-full shrink-0 empty:hidden" />

      {/* ---------- Feedback ----------
          El mismo diálogo que abre una campaña. Aquí no tiene a dónde enviar:
          una app real pasa `onOpenFeedback` y abre el suyo, con destino. */}
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} context={activeLabel} onSubmit={() => undefined} />
    </div>
    </ShellConfigContext.Provider>
  );
};
