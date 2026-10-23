import * as React from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import { useActiveConversation, useChatActions, useChatContext } from "./useChat";
import { ChatComposer } from "./ChatComposer";
import { ChatThread } from "./ChatThread";
import { ChatGreeting } from "./ChatGreeting";
import { ChatIdeas } from "./ChatIdeas";
import "./chat.css";
import { ChatHistoryPanel } from "./ChatHistoryPanel";

export interface ChatScreenProps {
  /** El historial al lado, con «Nuevo chat». Apágalo si la app lo enseña en otro sitio. */
  history?: boolean;
  /** El «Más» de cada respuesta. */
  onMore?: (messageId: string, action: "share" | "task" | "report") => void;
  className?: string;
}

/**
 * El chat a pantalla completa: lo que enseña el modo «Agente IA» del shell.
 * Una conversación nueva arranca en la portada de Clipper (la misma de la
 * reserva): rejilla de puntos, orbe y saludo, la caja y las ideas numeradas
 * debajo; con hilo, los mensajes ocupan la pantalla y la
 * caja se queda abajo. A la izquierda, el historial con «Nuevo chat», que
 * se pliega para dejarle todo el ancho al hilo.
 */
export function ChatScreen({ history = true, onMore, className }: ChatScreenProps) {
  const t = useT();
  const { user, suggestions, connectors, onToggleConnector, onAddConnectors, news, onOpenVoice } = useChatContext();
  const conversation = useActiveConversation();
  const actions = useChatActions();
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = React.useState("");
  const hasThread = Boolean(conversation && conversation.messages.length > 0);

  // Cambiar de conversación devuelve el cursor a la caja.
  React.useEffect(() => {
    inputRef.current?.focus();
  }, [conversation?.id]);

  const composerProps = {
    // Adjuntar se apaga mientras quien responde no lea archivos: ofrecerlo y descartarlos engaña.
    attach: false,
    value: draft,
    onChange: setDraft,
    onSend: (text: string) => actions.send(text),
    inputRef,
    news,
    connectors,
    onToggleConnector,
    onAddConnectors,
    onVoice: onOpenVoice,
  };

  const main =
    hasThread && conversation ? (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
          <div className="mx-auto w-full max-w-3xl py-6">
            <ChatThread conversation={conversation} onMore={onMore} />
          </div>
        </div>
        <div className="shrink-0 px-4 pb-4 pt-2 sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <ChatComposer {...composerProps} placeholder={t("chat.placeholder.followup")} />
          </div>
        </div>
      </div>
    ) : (
      <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 sm:px-6">
        {/* La portada de Clipper: su rejilla de puntos, el orbe y el saludo, la caja y las ideas numeradas debajo. */}
        <div aria-hidden className="chat-dots pointer-events-none absolute inset-0" />
        <div className="relative mx-auto flex w-full max-w-2xl flex-col gap-7 py-10">
          <ChatGreeting name={user.name} />
          <ChatComposer {...composerProps} autoFocus />
          <ChatIdeas ideas={suggestions ?? []}onPick={(idea) => actions.send(idea)} />
        </div>
      </div>
    );

  return (
    <div className={cn("flex h-full min-h-0", className)} data-testid="chat-screen">
      {history && <ChatHistoryPanel />}
      {main}
    </div>
  );
}
