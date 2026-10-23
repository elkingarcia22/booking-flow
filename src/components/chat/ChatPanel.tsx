import * as React from "react";
import { cn } from "@/lib/utils";
import { ThemaIcon } from "@/icons/ThemaIcon";
import { ShellAgentPanelSlot } from "@/components/app-shell/shellAgentPanelSlot";
import { AGENT_PANEL_OUTER_WIDTH, AGENT_PANEL_WIDTH, OVERLAY_INSET, agentPanelTransition } from "@/components/ai/agentPanelMotion";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/typography";
import { useT } from "@/i18n";
import { useActiveConversation, useChatActions, useChatContext } from "./useChat";
import { ChatComposer } from "./ChatComposer";
import { ChatThread } from "./ChatThread";
import { ChatGreeting } from "./ChatGreeting";
import { ChatHistoryList } from "./ChatHistoryList";
import { ChatMark } from "./ChatMark";

export interface ChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Por defecto «Agente IA»; el chat de ayuda pone «Ayuda». */
  title?: string;
  subtitle?: string;
  /** El «Más» de cada respuesta. */
  onMore?: (messageId: string, action: "share" | "task" | "report") => void;
}

/**
 * El chat como panel lateral. Se porta al ancla que AdminShell reserva
 * junto a la columna de contenido, así abrirlo estrecha la pantalla en vez
 * de taparla, y flota a `OVERLAY_INSET` del borde como el resto de paneles.
 *
 * Arranca con el saludo, la caja y unas preguntas; en cuanto hay
 * conversación, el hilo va arriba y la caja se queda abajo. Desde la
 * cabecera se empieza otra conversación o se abre esta en pantalla
 * completa, donde está el historial.
 */
export function ChatPanel({ open, onOpenChange, title, subtitle, onMore }: ChatPanelProps) {
  const t = useT();
  // El aviso de novedad no cabe en el panel: se enseña en la pantalla completa.
  const { user, suggestions, connectors, onToggleConnector, onAddConnectors, onOpenFull, onOpenVoice } = useChatContext();
  const conversation = useActiveConversation();
  const actions = useChatActions();
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = React.useState("");
  // Lo que se ve: la conversación (nueva o andada) o la lista de las anteriores.
  const [view, setView] = React.useState<"chat" | "history">("chat");
  const hasThread = Boolean(conversation && conversation.messages.length > 0);
  const showingHistory = view === "history";

  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);

  const startNew = () => {
    actions.newConversation();
    setView("chat");
    window.setTimeout(() => inputRef.current?.focus(), 60);
  };

  const openConversation = (id: string) => {
    actions.setActive(id);
    setView("chat");
  };

  // Abrir pone el cursor en la pregunta; Escape cierra, como el resto de paneles.
  React.useEffect(() => {
    if (!open) return;
    const focus = window.setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focus);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const composerProps = {
    // Adjuntar se apaga mientras quien responde no lea archivos: ofrecerlo y descartarlos engaña.
    attach: false,
    value: draft,
    onChange: setDraft,
    onSend: (text: string) => actions.send(text),
    inputRef,
    connectors,
    onToggleConnector,
    onAddConnectors,
    onVoice: onOpenVoice,
  };

  return (
    <ShellAgentPanelSlot>
      {/* En escritorio el envoltorio es lo que se anima: al crecer estrecha la
          columna de contenido y recorta el panel de ancho fijo mientras se abre.
          En el celular no hay sitio para empujar nada: el panel es una hoja a
          pantalla completa que sube por encima del contenido. Los anchos van en
          variables para que las clases del celular puedan ganarles. */}
      <div
        className={cn(
          "h-full w-[var(--agent-panel-w)] shrink-0 overflow-hidden md:[transition:var(--agent-panel-transition)]",
          "max-md:fixed max-md:inset-0 max-md:z-[60] max-md:h-dvh max-md:w-full max-md:transition-transform max-md:duration-300 max-md:ease-out motion-reduce:max-md:transition-none",
          open ? "max-md:translate-y-0" : "max-md:pointer-events-none max-md:invisible max-md:translate-y-full"
        )}
        data-agent-panel-open={open || undefined}
        style={{ "--agent-panel-w": open ? AGENT_PANEL_OUTER_WIDTH : "0px", "--agent-panel-transition": agentPanelTransition("width") } as React.CSSProperties}
      >
        <div
          className="h-full w-[var(--agent-panel-outer)] pb-[var(--agent-panel-inset)] pr-[var(--agent-panel-inset)] pt-[var(--agent-panel-inset)] max-md:w-full max-md:p-0"
          style={{ "--agent-panel-outer": AGENT_PANEL_OUTER_WIDTH, "--agent-panel-inset": `${OVERLAY_INSET}px` } as React.CSSProperties}
        >
          <aside
            aria-label={title ?? t("chat.title")}
            aria-hidden={!open}
            data-testid="chat-panel"
            className={cn(
              "flex h-full w-[var(--agent-panel-inner)] flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface ai-mesh-agent shadow-card",
              "max-md:w-full max-md:rounded-none max-md:border-0 max-md:pt-[env(safe-area-inset-top)] max-md:pb-[env(safe-area-inset-bottom)]",
              !open && "invisible"
            )}
            style={{ "--agent-panel-inner": AGENT_PANEL_WIDTH } as React.CSSProperties}
          >
            <header className="flex shrink-0 items-center gap-3 border-b border-border/20 px-4 py-3">
              <ChatMark size="md" motion={hasThread ? "still" : "breathing"} />
              <div className="min-w-0 flex-1">
                <Text as="h2" size="sm" weight="bold" className="leading-tight">
                  {title ?? t("chat.title")}
                </Text>
                <Text size="xs" tone="muted" className="truncate">
                  {subtitle ?? t("chat.subtitle")}
                </Text>
              </div>
              {/* Las dos puertas de siempre: empezar otro chat y ver los anteriores. */}
              <Button
                type="button"
                variant={showingHistory ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setView(showingHistory ? "chat" : "history")}
                aria-label={t("chat.history")}
                title={t("chat.history")}
                aria-pressed={showingHistory}
                data-testid="chat-panel-history"
              >
                <ThemaIcon className="text-current" name="clock" size="sm" decorative />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={startNew} aria-label={t("chat.newConversation")} title={t("chat.newConversation")} data-testid="chat-panel-new">
                <ThemaIcon className="text-current" name="plus" size="sm" decorative />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={close} aria-label={t("common.close")}>
                <ThemaIcon className="text-current" name="close" size="sm" decorative />
              </Button>
            </header>

            {showingHistory ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                  <ChatHistoryList activeId={conversation?.id ?? null} onSelect={openConversation} onNew={startNew} onRemove={actions.remove} />
                </div>
                {onOpenFull && (
                  <div className="shrink-0 border-t border-border/20 px-4 py-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        close();
                        onOpenFull(conversation?.id ?? null);
                      }}
                    >
                      <ThemaIcon className="text-current" name="expand" size="xs" decorative />
                      {t("chat.openFull")}
                    </Button>
                  </div>
                )}
              </div>
            ) : hasThread && conversation ? (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
                  <ChatThread conversation={conversation} onMore={onMore} />
                </div>
                <div className="shrink-0 px-4 pb-4 pt-2">
                  <ChatComposer {...composerProps} compact placeholder={t("chat.placeholder.followup")} disclaimer={false} />
                </div>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-6">
                <ChatGreeting name={user.name} variant="panel" className="mb-5" />
                <ChatComposer {...composerProps} autoFocus={open} />
                {suggestions && suggestions.length > 0 && (
                  <div className="mt-5 flex flex-col gap-2.5" data-testid="chat-suggestions">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => actions.send(suggestion)}
                        className="rounded-2xl border border-border/70 bg-surface p-3 text-left text-xs font-medium leading-snug text-text-secondary transition-colors hover:border-primary/40 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </ShellAgentPanelSlot>
  );
}
