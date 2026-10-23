import * as React from "react";
import { Bell, HelpCircle, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SHELL_MENU_PANEL } from "./shellPanel";
import { AccountMenu } from "./AccountMenu";
import { NewsMenu } from "./NewsMenu";
import { HelpMenu } from "./HelpMenu";
import { ProcessCenter } from "./ProcessCenter";
import { useLiquidOrigin } from "./useLiquidOrigin";
import { GlobalSearch } from "@/components/search";
import { useT } from "@/i18n";
import { useShellConfig } from "./shellConfig";

interface AppHeaderProps {
  onToggleSidebar: () => void;
  /** @deprecated – Novedades is now self-contained in the header. Kept for backward compat. */
  onOpenNews: () => void;
  /** Receives the host element that screens portal their own identity into. */
  onSlotRef: (element: HTMLDivElement | null) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onToggleSidebar, onSlotRef }) => {
  const [notifOpen, setNotifOpen] = React.useState(false);
  const notifOrigin = useLiquidOrigin();

  const t = useT();
  const {
    user,
    news,
    notifications,
    onMarkAllNotificationsRead,
    onLogout,
    onOpenHelp,
    onOpenProcessHistory,
    helpActions,
    headerActions,
    chrome,
    search,
    roles,
    activeRoleId,
    onSelectRole,
    companies,
    companyMenuLinks,
    workspaceLabels,
    showWorkspaceUsage,
    activeCompanyId,
    onSelectCompany,
  } = useShellConfig();

  // El espacio activo puede venir de fuera (la app sabe en qué sucursal está)
  // o gestionarlo el shell, igual que el rol.
  const [ownCompanyId, setOwnCompanyId] = React.useState<string | undefined>(() => activeCompanyId ?? companies[0]?.id);
  const activeCompany = companies.find((company) => company.id === (activeCompanyId ?? ownCompanyId)) ?? companies[0];
  const handleSelectCompany = React.useCallback(
    (id: string) => {
      setOwnCompanyId(id);
      onSelectCompany?.(id);
    },
    [onSelectCompany]
  );

  // El rol activo puede venir de fuera (la app lo sabe) o gestionarlo el
  // shell, igual que la empresa activa del sidebar.
  const [ownRoleId, setOwnRoleId] = React.useState<string | undefined>(() => activeRoleId ?? roles[0]?.id);
  const activeRole = roles.find((role) => role.id === (activeRoleId ?? ownRoleId)) ?? roles[0];
  const handleSelectRole = React.useCallback(
    (id: string) => {
      setOwnRoleId(id);
      onSelectRole?.(id);
    },
    [onSelectRole]
  );
  // Con avisos reales (con id) cuenta los no leídos; con los de demo, las dos primeras son «nuevas».
  const real = notifications.some((item) => item.id !== undefined);
  const isUnread = (item: (typeof notifications)[number], index: number) => (real ? item.unread === true : index < 2);
  const unreadCount = real ? notifications.filter((item) => item.unread).length : Math.min(2, notifications.length);

  // The strip reads as surface behind the actions on the right and dissolves
  // to nothing towards the sidebar, where the theme's atmosphere takes over.
  // Both stops are `card` (the surface colour in HSL channels, so it accepts
  // an alpha modifier) — fading from `transparent` instead would drift through
  // grey on its way to white. `border-b` is all that divides it from the page.
  // With the Agente IA or help panel open the header ends against the panel,
  // not the window edge, and the solid `card` stop read as a vertical divider
  // there — so the strip goes flat while a panel (`data-agent-panel-open`) is open.
  return (
    <header className="flex h-14 shrink-0 items-center gap-1.5 border-b border-border/60 bg-gradient-to-r from-card/0 via-card/0 via-45% to-card px-4 sm:gap-3 sm:px-6 [:has([data-agent-panel-open])_&]:bg-none">
      {/* ---------- Sidebar toggle ----------
          Only below lg: there the sidebar is an off-canvas drawer, so its own
          edge handle is out of reach. On desktop that handle takes over. */}
      <button
        onClick={onToggleSidebar}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-surface text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary lg:hidden"
        title="Menú"
        aria-label={t("shell.menu")}
      >
        <PanelLeft className="h-4 w-4" strokeWidth={2} />
      </button>

      {/* Where the mounted screen renders its own live identity (e.g. the
          ciclo builder's name + estado) — no breadcrumb trail here anymore.
          `overflow-hidden`: en pantalla estrecha este hueco se queda sin
          ancho, y sin recorte su contenido se montaba encima de los botones
          de la derecha en vez de ceder el sitio. */}
      <div ref={onSlotRef} className="flex min-w-0 flex-1 basis-0 items-center gap-2 overflow-hidden" />

      {/* ---------- Búsqueda general (⌘K) ----------
          En el centro de la cabecera: los dos lados crecen por igual
          (`flex-1 basis-0`), así que queda centrada respecto a la franja y no
          respecto a lo que haya a cada lado. Si la derecha necesita más
          sitio del que hay, cede el centrado antes que recortar acciones. */}
      {chrome.search && search && <GlobalSearch {...search} className="shrink-0 md:w-72 lg:w-80" />}

      {/* ---------- Right actions ---------- */}
      {/* En el móvil solo queda lo que responde a dónde estás: búsqueda,
          avisos y el chip de la cuenta. Novedades baja al pie del menú
          lateral y la ayuda se va: son lo único de esta fila que no depende
          de la pantalla que estás mirando. */}
      <div className="flex flex-1 basis-0 items-center justify-end gap-1.5 sm:gap-3">

        {/* ---------- Novedades ----------
            Por debajo de `md` se va al pie del menú lateral: el chip de la
            cuenta necesita ese ancho para seguir diciendo dónde estás y como
            quién, y «Novedades» es lo único de esta fila que no responde a
            nada de la pantalla actual. */}
        {chrome.news && <NewsMenu items={news} className="max-md:hidden" />}

        {/* ---------- Ayuda ---------- */}
        {chrome.help && helpActions?.length ? (
          <HelpMenu actions={helpActions} label={t("shell.help")} className="max-sm:hidden" />
        ) : chrome.help && (
          <button
            type="button"
            onClick={onOpenHelp}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-surface text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary max-sm:hidden"
            title={t("shell.help")}
            aria-label={t("shell.help")}
            data-testid="shell-help"
          >
            <HelpCircle className="h-4 w-4" strokeWidth={2} />
          </button>
        )}

        {/* ---------- Notifications ---------- */}
        {headerActions}
        {chrome.notifications && (
          <Popover open={notifOpen} onOpenChange={setNotifOpen}>
            <PopoverTrigger asChild>
              <button
                ref={notifOrigin.triggerRef}
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-surface text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary",
                  notifOpen && "bg-surface-muted text-text-primary"
                )}
                title={t("shell.notifications")}
                aria-label={t("shell.notifications")}
                aria-description={unreadCount > 0 ? t("shell.notificationsUnread", { count: unreadCount }) : undefined}
              >
                <Bell className="h-4 w-4" strokeWidth={2} />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1 h-2 w-2 rounded-full border-[1.5px] border-surface bg-primary" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              ref={notifOrigin.contentRef}
              align="end"
              sideOffset={8}
              liquid
              style={notifOrigin.style}
              className={cn("w-[340px] p-0 overflow-hidden", SHELL_MENU_PANEL)}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <span className="text-[13px] font-bold text-text-primary">{t("shell.notifications")}</span>
                {unreadCount > 0 && (
                  <span className="inline-flex h-5 items-center rounded-full bg-primary px-2 text-[11px] font-bold text-primary-foreground">
                    {t("shell.notificationsNew", { count: unreadCount })}
                  </span>
                )}
              </div>

              {/* Lista con stagger */}
              <div className="flex flex-col gap-0.5 overflow-y-auto p-2" style={{ maxHeight: "380px" }}>
                {notifications.length === 0 && <p className="px-3 py-6 text-center text-xs text-text-muted">{t("shell.notificationsEmpty")}</p>}
                {notifications.map((notification, index) => (
                  <div
                    key={notification.id ?? notification.title}
                    className={cn("rounded-xl transition-colors hover:bg-background", "opacity-0 translate-y-2", notifOpen && "opacity-100 translate-y-0")}
                    style={{
                      transition: notifOpen
                        ? `opacity 280ms cubic-bezier(0.16,1,0.3,1) ${index * 45}ms, transform 280ms cubic-bezier(0.16,1,0.3,1) ${index * 45}ms`
                        : "none",
                    }}
                  >
                  <button
                    type="button"
                    onClick={() => {
                      notification.onSelect?.();
                      if (notification.onSelect) setNotifOpen(false);
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-left"
                  >
                    <div className="flex items-start gap-2.5">
                      {isUnread(notification, index) && (
                        <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                      <div className={cn("min-w-0 flex-1", !isUnread(notification, index) && "pl-[14px]")}>
                        <div className={cn(
                          "text-[13px] text-text-primary",
                          isUnread(notification, index) ? "font-bold" : "font-semibold"
                        )}>
                          {notification.title}
                        </div>
                        <div className="mt-0.5 text-xs leading-snug text-text-secondary">{notification.description}</div>
                        <div className="mt-1 text-[11px] text-text-muted">{notification.date}</div>
                      </div>
                    </div>
                  </button>
                  {/* Lo que se hace sin abrir nada (llamar, reintentar): botones aparte, no dentro del aviso. */}
                  {notification.actions && notification.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-3 pb-2.5 pl-[26px]" data-testid="notification-actions">
                      {notification.actions.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() => {
                            action.onSelect();
                            setNotifOpen(false);
                          }}
                          className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-text-primary transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                          data-testid={`notification-action-${action.id}`}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                  </div>
                ))}
              </div>

              {/* Footer */}
              {onMarkAllNotificationsRead && unreadCount > 0 && (
                <div className="border-t border-border/60 px-4 py-2.5">
                  <button type="button" onClick={onMarkAllNotificationsRead} className="text-[12px] font-semibold text-primary transition-colors hover:text-primary/80" data-testid="notifications-read-all">
                    {t("shell.notificationsReadAll")}
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}

        {/* ---------- Centro de procesos ----------
            Por debajo de `sm` se va: en el móvil la fila es para lo que
            responde a dónde estás, y un proceso sigue corriendo igual. */}
        {chrome.processes && <ProcessCenter onOpenHistory={onOpenProcessHistory} className="max-sm:hidden" />}

        {/* ---------- La cuenta y su contexto ----------
            Quién eres, en qué sucursal estás y como quién miras: una sola
            puerta en la esquina. Antes eran tres —chip de sucursal a la
            izquierda, chip de rol y avatar a la derecha— y las tres
            respondían a la misma pregunta. El tema y el idioma no están
            aquí: son de la plataforma, no de la cuenta, y viven en
            «Personalización», colgando de la marca. */}
        {(chrome.profile || chrome.company) && (
          <AccountMenu
            user={chrome.profile ? user : undefined}
            onLogout={chrome.profile ? onLogout : undefined}
            companies={chrome.company ? companies : undefined}
            activeCompany={chrome.company ? activeCompany : undefined}
            onSelectCompany={handleSelectCompany}
            links={companyMenuLinks}
            labels={workspaceLabels}
            showUsage={showWorkspaceUsage}
            roles={chrome.role ? roles : undefined}
            activeRole={activeRole}
            onSelectRole={handleSelectRole}
          />
        )}
      </div>
    </header>
  );
};
